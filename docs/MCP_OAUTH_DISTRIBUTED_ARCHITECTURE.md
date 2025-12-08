# MCP OAuth Token Management - Distributed Architecture

## Overview

This document explains how OAuth token management works in the Model Context Protocol (MCP) system within a distributed, multi-instance deployment environment (such as Amazon ECS with multiple tasks).

**Last Updated:** November 4, 2025  
**Version:** 1.3.1

---

## ⚠️ Critical Clarification: MCP Server State Requirements

**TLDR:** The statement *"MCP servers don't need Redis"* is **MISLEADING**. Here's the truth:

### Two Layers of State in MCP Servers:

| Layer | Stateless? | Storage | Multi-Instance Support |
|-------|------------|---------|------------------------|
| **OAuth Authentication** | ✅ YES | Bearer tokens in request headers | No storage needed |
| **MCP Protocol Sessions** | ❌ NO | Redis EventStore required | **Requires Redis** for production |

### Quick Decision Guide:

**Use In-Memory Storage (`USE_REDIS=false`):**
- ✅ Development/testing on single machine
- ✅ Single-instance deployments (no load balancer)
- ❌ **NOT for production** with multiple instances

**Use Redis Storage (`USE_REDIS=true`):**
- ✅ Production multi-instance deployments
- ✅ Load-balanced environments
- ✅ High-availability requirements
- ✅ OAuth callbacks across different instances

**Why Redis is Required for Production:**
The MCP protocol specification requires persistent session state for:
- JSON-RPC conversation continuity
- Server-Sent Events (SSE) streams
- Event replay and message ordering
- Session recovery after instance restarts

**See [External MCP Server](#external-mcp-server) section for detailed technical explanation.**

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Component Responsibilities](#component-responsibilities)
3. [Token Storage and Retrieval](#token-storage-and-retrieval)
4. [Distributed Deployment](#distributed-deployment)
5. [OAuth Flow](#oauth-flow)
6. [Token Refresh Mechanism](#token-refresh-mechanism)
7. [Security Considerations](#security-considerations)
8. [Configuration](#configuration)
9. [Troubleshooting](#troubleshooting)
10. [Code Reference](#code-reference)

---

## Architecture Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Load Balancer / ALB                       │
└───────────────┬─────────────────┬───────────────────────────┘
                │                 │
    ┌───────────▼──────┐  ┌──────▼────────────┐
    │  Ranger Instance │  │  Ranger Instance  │  ... (Multiple ECS Tasks)
    │     (Task A)     │  │     (Task B)      │
    └───────────┬──────┘  └──────┬────────────┘
                │                 │
                └─────────┬───────┘
                          │
            ┌─────────────▼─────────────┐
            │                           │
    ┌───────▼────────┐         ┌───────▼────────┐
    │  Redis Cluster │         │    MongoDB      │
    │                │         │                 │
    │ • Ranger:      │         │ • Token Storage │
    │   - Leader     │         │   (Encrypted)   │
    │     Election   │         │ • Persistence   │
    │   - Config     │         │                 │
    │     Cache      │         │                 │
    │                │         │                 │
    │ • MCP Server:  │         └─────────────────┘
    │   - Session    │                  │
    │     State      │◄─────────────────┼─────────────────┐
    │   - Event      │                  │                 │
    │     Store      │                  │                 │
    │   - SSE        │                  │                 │
    │     Streams    │                  │                 │
    └────────────────┘                  │                 │
                                        │                 │
                          ┌─────────────▼─────────────────▼──┐
                          │  External MCP Server(s)           │
                          │  (e.g., MS365, SharePoint)        │
                          │                                   │
                          │  • Receives OAuth tokens in       │
                          │    Bearer header (stateless auth) │
                          │  • Stores MCP session state in    │
                          │    Redis (stateful protocol)      │
                          └───────────────────────────────────┘
```

**Architecture Notes:**
- **Ranger** stores OAuth tokens in MongoDB, uses Redis for coordination
- **MCP Server** receives OAuth tokens per-request, uses Redis for MCP protocol session state
- Both systems can scale horizontally with shared Redis and MongoDB

### Key Principles

1. **Shared Storage**: All Ranger instances share the same Redis cluster and MongoDB database
2. **Stateless Instances**: Each Ranger instance is stateless and can handle any request
3. **Centralized Tokens**: OAuth tokens are stored centrally in MongoDB (encrypted)
4. **Leader Coordination**: Redis handles leader election for MCP server initialization
5. **MCP Server State**: External MCP servers use Redis for MCP protocol session state in multi-instance deployments (see detailed explanation below)

---

## Component Responsibilities

### Ranger Instances (ECS Tasks)

**Role:** Application servers that handle user requests and manage MCP connections

**Responsibilities:**
- Process user authentication requests
- Store and retrieve OAuth tokens
- Initialize MCP connections (via leader election)
- Execute MCP tool calls with valid tokens
- Handle token refresh automatically

**Key Class:** `MCPTokenStorage` (`packages/api/src/mcp/oauth/tokens.ts`)

### Redis Cluster

**Role:** Distributed coordination and caching layer

**Responsibilities:**
- **Leader Election**: Ensures only ONE instance initializes MCP servers
- **Configuration Cache**: Caches MCP server configurations for performance
- **Registry Coordination**: Manages shared MCP registry state
- **NOT for tokens**: Tokens are NOT stored in Redis (they go to MongoDB)

**Libraries Used:**
- `ioredis` ^5.3.2
- `@keyv/redis` ^4.3.3

### MongoDB

**Role:** Persistent data storage

**Responsibilities:**
- Store OAuth tokens (encrypted)
- Store user data and conversations
- Persist MCP server metadata
- Survive instance restarts

**Token Schema:**
```javascript
{
  userId: String,          // User identifier
  type: String,            // 'mcp_oauth', 'mcp_oauth_refresh', 'mcp_oauth_client'
  identifier: String,      // Format: 'mcp:${serverName}'
  token: String,           // Encrypted token data
  expiresAt: Date,         // Token expiration timestamp
  metadata: Object,        // { serverName, userId, clientInfo }
  createdAt: Date,
  updatedAt: Date
}
```

### External MCP Server

**Role:** External service providing MCP tools via HTTP

**Responsibilities:**
- Expose MCP tools via HTTP/HTTPS endpoint using MCP protocol
- Manage MCP session state (JSON-RPC conversations, SSE streams)
- Handle tool execution requests
- Validate OAuth tokens (passed as Bearer tokens in request headers)
- Return tool results

**State Management:**

⚠️ **IMPORTANT CLARIFICATION**: The statement "MCP servers don't need Redis" is **PARTIALLY TRUE but MISLEADING**. Here's the nuanced reality:

#### Two Layers of State:

1. **✅ OAuth Layer (Stateless)**
   - OAuth tokens are NOT stored by the MCP server
   - Tokens are passed as Bearer tokens in every HTTP request header
   - Token validation happens per-request (truly stateless)
   - No database needed for OAuth credentials

2. **❌ MCP Protocol Layer (Stateful)**
   - The MCP protocol specification REQUIRES session state management
   - Maintains persistent `StreamableHTTPServerTransport` connections
   - Stores event streams for Server-Sent Events (SSE) and message replay
   - Manages JSON-RPC conversation state across multiple requests
   - Tracks active client sessions via `transports Map`

#### Redis Requirement for Production:

**Without Redis (`USE_REDIS=false`):**
- ✅ Single-instance deployments only
- ✅ Development environments
- ❌ In-memory session storage (lost on restart)
- ❌ Cannot handle load balancing (sessions not shared)
- ❌ OAuth callbacks fail if hitting different instance

**With Redis (`USE_REDIS=true`):**
- ✅ Multi-instance load-balanced deployments
- ✅ Session persistence across server restarts
- ✅ OAuth callbacks work across instances
- ✅ High-availability production environments
- ✅ Centralized event store via `RedisEventStore`

#### Code Evidence:

```typescript
// From streamableHttp.ts - Redis is REQUIRED for multi-instance
const eventStore = USE_REDIS 
  ? await getRedisEventStore()  // Redis-backed session storage
  : new InMemoryEventStore();    // Single-instance only

transport = new StreamableHTTPServerTransport({
  sessionIdGenerator: () => randomUUID(),
  eventStore, // Stores MCP protocol state
  onsessioninitialized: (newSessionId: string) => {
    transports.set(newSessionId, transport); // Session tracking
  }
});
```

**Verdict:** While the MCP server doesn't need Redis to store **OAuth tokens** (stateless Bearer authentication), it **DOES need Redis** for **MCP protocol session management** in production multi-instance deployments. The protocol's design requires persistent state for sessions, events, and JSON-RPC conversations.

**Reference:** See `REDIS_SETUP.md` in the MCP server codebase for configuration details.

---

## Token Storage and Retrieval

### Storage Process

**File:** `packages/api/src/mcp/oauth/tokens.ts`  
**Class:** `MCPTokenStorage`  
**Method:** `storeTokens()`

#### Flow Diagram

```
User Authenticates
      ↓
OAuth Provider Returns Tokens
      ↓
┌─────────────────────────────────────┐
│ MCPTokenStorage.storeTokens()       │
├─────────────────────────────────────┤
│ 1. Encrypt access_token             │
│ 2. Encrypt refresh_token (if any)   │
│ 3. Encrypt client_info (if any)     │
│ 4. Calculate expiry (expires_in)    │
│ 5. Store in MongoDB                 │
└─────────────────────────────────────┘
      ↓
Database Record Created:
  - type: 'mcp_oauth'
  - identifier: 'mcp:ms365-mcp'
  - token: <encrypted_access_token>
  - expiresAt: <timestamp>
```

#### Code Example

```typescript
// Simplified storage flow
await MCPTokenStorage.storeTokens({
  userId: 'user123',
  serverName: 'ms365-mcp',
  tokens: {
    access_token: 'ya29.a0...',
    refresh_token: '1//0e...',
    expires_in: 3600, // seconds
  },
  createToken,  // Database create function
  updateToken,  // Database update function
  findToken,    // Database find function
});
```

### Retrieval Process

**Method:** `getTokens()`

#### Flow Diagram

```
User Requests Tool Execution
      ↓
┌─────────────────────────────────────┐
│ MCPTokenStorage.getTokens()         │
├─────────────────────────────────────┤
│ 1. Query MongoDB by userId +        │
│    identifier ('mcp:serverName')    │
│ 2. Check if token exists            │
│ 3. Check if token expired           │
├─────────────────────────────────────┤
│ IF EXPIRED:                         │
│   a. Fetch refresh_token            │
│   b. Call OAuth provider            │
│   c. Get new access_token           │
│   d. Store new tokens               │
│   e. Return new tokens              │
├─────────────────────────────────────┤
│ IF VALID:                           │
│   a. Decrypt access_token           │
│   b. Return tokens                  │
└─────────────────────────────────────┘
      ↓
Tokens Used for MCP Request
```

#### Code Example

```typescript
// Simplified retrieval flow
const tokens = await MCPTokenStorage.getTokens({
  userId: 'user123',
  serverName: 'ms365-mcp',
  findToken,      // Database find function
  createToken,    // For storing refreshed tokens
  updateToken,    // For updating refreshed tokens
  refreshTokens,  // OAuth refresh function
});

if (!tokens) {
  // User needs to re-authenticate
  return { requiresAuth: true };
}

// Use tokens for MCP tool call
const result = await mcpClient.callTool('searchFiles', {
  query: 'Q4 report'
}, tokens.access_token);
```

---

## Distributed Deployment

### Multi-Instance Scenario

**Deployment:** Amazon ECS with 3 tasks (instances)

```
┌──────────────────────────────────────────────────────────┐
│                   Application Load Balancer              │
└────┬─────────────────────┬─────────────────────┬─────────┘
     │                     │                     │
┌────▼──────┐        ┌─────▼──────┐       ┌─────▼──────┐
│  Task A   │        │   Task B   │       │   Task C   │
│ (Leader)  │        │ (Follower) │       │ (Follower) │
└────┬──────┘        └─────┬──────┘       └─────┬──────┘
     │                     │                     │
     └──────────────┬──────┴──────┬──────────────┘
                    │             │
            ┌───────▼──────┐   ┌──▼───────────┐
            │    Redis     │   │   MongoDB    │
            │   Cluster    │   │  (Replica    │
            │              │   │   Set)       │
            └──────────────┘   └──────────────┘
```

### Request Flow Example

**Scenario:** User authenticates on Task A, then request routed to Task B

#### Step 1: Authentication on Task A

```
1. User clicks "Connect MS365" in UI
2. Request → Load Balancer → Task A
3. Task A redirects to Microsoft OAuth
4. User grants permissions
5. Microsoft redirects back with code
6. Task A exchanges code for tokens
7. Task A calls MCPTokenStorage.storeTokens()
8. Tokens encrypted and saved to MongoDB
9. Response: "Authentication successful"
```

#### Step 2: Tool Execution on Task B

```
1. User asks: "Find my Q4 reports"
2. Request → Load Balancer → Task B (different instance!)
3. Task B calls MCPTokenStorage.getTokens(userId, 'ms365-mcp')
4. MongoDB query: Find token where userId='user123' AND identifier='mcp:ms365-mcp'
5. Token found in database (stored by Task A)
6. Task B decrypts token
7. Task B calls MCP server with token
8. MCP server executes tool
9. Response: List of Q4 report files
```

**Key Point:** Task B successfully retrieves tokens stored by Task A because they share the same MongoDB instance.

### Leader Election

**Purpose:** Prevent duplicate MCP server initialization

**Implementation:** Redis-based leader election using `@ranger/agents` (Ranger fork: `illuma-agents`)

**Flow:**

```
Task A starts → Attempts leader lock → SUCCESS → Initializes MCP servers
Task B starts → Attempts leader lock → FAIL → Waits for initialization
Task C starts → Attempts leader lock → FAIL → Waits for initialization
                       ↓
           Leader (Task A) initializes servers
                       ↓
       Sets "initialized" flag in Redis cache
                       ↓
         All tasks read from shared registry
```

**Code Location:** `packages/api/src/mcp/registry/MCPServersInitializer.ts`

```typescript
// Simplified leader election
const isLeader = await leaderElection.tryAcquire();
if (isLeader) {
  logger.info('[MCP] This instance is the leader, initializing servers...');
  await initializeAllServers();
  await statusCache.setInitialized(true);
} else {
  logger.info('[MCP] Another instance is the leader, waiting...');
  await statusCache.waitForInitialization();
}
```

---

## OAuth Flow

### Initial Authentication

```
┌──────┐         ┌─────────┐         ┌──────────────┐         ┌──────────┐
│ User │         │ Ranger  │         │ OAuth Provider│         │ MongoDB  │
└──┬───┘         └────┬────┘         └──────┬───────┘         └────┬─────┘
   │                  │                     │                      │
   │ Click "Connect"  │                     │                      │
   ├─────────────────>│                     │                      │
   │                  │                     │                      │
   │                  │ Redirect to Auth    │                      │
   │<─────────────────┤                     │                      │
   │                  │                     │                      │
   │ Enter credentials│                     │                      │
   ├──────────────────┼────────────────────>│                      │
   │                  │                     │                      │
   │                  │ Redirect with code  │                      │
   │<─────────────────┼─────────────────────┤                      │
   │                  │                     │                      │
   │ Auth callback    │                     │                      │
   ├─────────────────>│                     │                      │
   │                  │                     │                      │
   │                  │ Exchange code       │                      │
   │                  ├────────────────────>│                      │
   │                  │                     │                      │
   │                  │ Return tokens       │                      │
   │                  │<────────────────────┤                      │
   │                  │                     │                      │
   │                  │ Store encrypted tokens                     │
   │                  ├────────────────────────────────────────────>│
   │                  │                     │                      │
   │ Success response │                     │                      │
   │<─────────────────┤                     │                      │
   │                  │                     │                      │
```

### Token Usage (Any Instance)

```
┌──────┐         ┌─────────┐         ┌──────────┐         ┌────────────┐
│ User │         │ Ranger  │         │ MongoDB  │         │ MCP Server │
└──┬───┘         └────┬────┘         └────┬─────┘         └─────┬──────┘
   │                  │                   │                      │
   │ Execute tool     │                   │                      │
   ├─────────────────>│                   │                      │
   │                  │                   │                      │
   │                  │ Get tokens        │                      │
   │                  ├──────────────────>│                      │
   │                  │                   │                      │
   │                  │ Return encrypted  │                      │
   │                  │<──────────────────┤                      │
   │                  │                   │                      │
   │                  │ Decrypt           │                      │
   │                  │                   │                      │
   │                  │ Call tool with token                     │
   │                  ├──────────────────────────────────────────>│
   │                  │                   │                      │
   │                  │                   │    Execute & Return  │
   │                  │<──────────────────────────────────────────┤
   │                  │                   │                      │
   │ Tool result      │                   │                      │
   │<─────────────────┤                   │                      │
   │                  │                   │                      │
```

---

## Token Refresh Mechanism

### Automatic Refresh

The `MCPTokenStorage.getTokens()` method automatically refreshes expired tokens:

```typescript
// Pseudo-code for token refresh logic
async getTokens() {
  const accessToken = await findToken(userId, 'mcp_oauth', identifier);
  
  // Check expiration
  if (!accessToken || isExpired(accessToken)) {
    // Get refresh token
    const refreshToken = await findToken(userId, 'mcp_oauth_refresh', identifier);
    
    if (!refreshToken) {
      return null; // User must re-authenticate
    }
    
    // Call OAuth provider to refresh
    try {
      const newTokens = await oauthProvider.refreshTokens(refreshToken);
      
      // Store new tokens
      await this.storeTokens(userId, serverName, newTokens);
      
      return newTokens;
    } catch (error) {
      // Refresh failed - user must re-authenticate
      return null;
    }
  }
  
  return decryptToken(accessToken);
}
```

### Refresh Flow Diagram

```
getTokens() called
      ↓
Check token expiration
      ↓
   ┌──▼─────────────┐
   │ Token valid?   │
   └──┬─────────┬───┘
      │ YES     │ NO
      │         │
      │         ▼
      │    ┌────────────────┐
      │    │ Refresh token  │
      │    │   available?   │
      │    └────┬───────┬───┘
      │         │ YES   │ NO
      │         │       │
      │         │       ▼
      │         │   Return null
      │         │   (Re-auth required)
      │         │
      │         ▼
      │    ┌────────────────┐
      │    │ Call OAuth     │
      │    │ provider to    │
      │    │ refresh        │
      │    └────┬───────────┘
      │         │
      │         ▼
      │    ┌────────────────┐
      │    │ Store new      │
      │    │ tokens in DB   │
      │    └────┬───────────┘
      │         │
      └─────────┼─────────────┐
                │             │
                ▼             ▼
        Return decrypted tokens
```

### Refresh Token Limitations

**Some OAuth providers don't support refresh tokens for certain client types:**

```typescript
// Error handling for unsupported refresh
catch (refreshError) {
  const errorMessage = String(refreshError);
  if (errorMessage.includes('unauthorized_client')) {
    logger.info('Server does not support refresh tokens. New authentication required.');
  }
  return null; // User must re-authenticate
}
```

**Example:** Microsoft's public clients may not support refresh for certain scopes.

---

## Security Considerations

### Encryption at Rest

**All tokens are encrypted before storage:**

**Encryption Method:**
- Algorithm: AES-256-GCM (via `encryptV2` utility)
- Key Management: Managed by Ranger's crypto module
- Location: `packages/api/server/services/Files/strategies/encryptMetadata.js`

**What's Encrypted:**
1. Access tokens
2. Refresh tokens
3. Client credentials (client_id, client_secret)

**Database Storage:**
```javascript
{
  // Visible metadata
  userId: "user123",
  type: "mcp_oauth",
  identifier: "mcp:ms365-mcp",
  
  // Encrypted data (cipher text)
  token: "04af3c7b9e6f...",  // Encrypted access_token
  
  // Expiration (not sensitive)
  expiresAt: ISODate("2025-11-04T15:30:00Z")
}
```

### Encryption in Transit

**Requirements:**
1. **HTTPS**: All OAuth provider communication must use HTTPS
2. **TLS**: Redis and MongoDB connections should use TLS in production
3. **VPC**: Keep databases in private subnets (no public access)

### Token Scope Minimization

**Best Practice:** Request only necessary OAuth scopes

**Example (ranger.yaml):**
```yaml
mcpServers:
  ms365-mcp:
    oauth:
      scopes:
        - 'https://graph.microsoft.com/Files.Read'
        - 'https://graph.microsoft.com/Sites.Read.All'
      # Don't request 'User.ReadWrite.All' unless absolutely necessary
```

### Token Rotation

**Automatic:**
- Tokens are automatically refreshed when expired
- New tokens replace old tokens in database

**Manual:**
- Users can revoke access via UI (deletes tokens from database)
- Admin can force token refresh via API

### Access Control

**Database Level:**
- MongoDB: User-specific tokens (indexed by userId)
- Only authenticated users can access their own tokens
- No cross-user token access

**Application Level:**
- Middleware validates user identity before token retrieval
- OAuth callbacks include state validation (CSRF protection)

---

## Configuration

### Ranger Configuration (ranger.yaml)

**Location:** `cortex.technology.ai.ui.enterprise-chat-develop/ranger.yaml`

#### OAuth MCP Server Example

```yaml
version: 1.3.1

mcpServers:
  ms365-mcp:
    type: streamable-http
    url: 'http://mcp-server-service:3001/sharepoint-mcp/mcp'
    
    # OAuth configuration
    oauth:
      authorization_url: 'https://login.microsoftonline.com/{tenant}/oauth2/v2.0/authorize'
      token_url: 'https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token'
      client_id: '${MS365_CLIENT_ID}'       # Environment variable
      client_secret: '${MS365_CLIENT_SECRET}' # Environment variable
      redirect_uri: 'http://localhost:3080/api/mcp/oauth/callback/ms365-mcp'
      scopes:
        - 'https://graph.microsoft.com/Files.Read'
        - 'https://graph.microsoft.com/Sites.Read.All'
        - 'offline_access'  # Required for refresh tokens
    
    # UI configuration
    startup: true      # Show in startup config
    chatMenu: true     # Show in chat menu
```

#### Non-OAuth MCP Server Example

```yaml
mcpServers:
  filesystem:
    type: stdio
    command: 'npx'
    args:
      - '-y'
      - '@modelcontextprotocol/server-filesystem'
      - '/home/user/documents'
    
    startup: false
    chatMenu: true
```

### Environment Variables

**Required for OAuth servers:**

```bash
# Microsoft 365
MS365_CLIENT_ID=your-azure-app-client-id
MS365_CLIENT_SECRET=your-azure-app-client-secret

# Google Drive (if configured)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Database
MONGO_URI=mongodb://user:pass@mongodb-service:27017/ranger

# Redis
REDIS_URI=redis://redis-cluster:6379
```

### ECS Task Definition (Docker)

```yaml
version: '3.8'

services:
  ranger-app:
    image: ranger:latest
    deploy:
      replicas: 3  # Multiple instances
    environment:
      - NODE_ENV=production
      - MONGO_URI=${MONGO_URI}
      - REDIS_URI=${REDIS_URI}
      - MS365_CLIENT_ID=${MS365_CLIENT_ID}
      - MS365_CLIENT_SECRET=${MS365_CLIENT_SECRET}
    depends_on:
      - mongodb
      - redis
    networks:
      - ranger-network

  mongodb:
    image: mongo:7
    volumes:
      - mongo-data:/data/db
    networks:
      - ranger-network

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes
    volumes:
      - redis-data:/data
    networks:
      - ranger-network

  mcp-server:
    image: ms365-mcp-server:latest
    deploy:
      replicas: 2  # Multiple instances for load balancing
    environment:
      - PORT=3001
      # MCP Server REQUIRES Redis for multi-instance deployments
      - USE_REDIS=true
      - REDIS_URL=redis://redis:6379
      # OAuth tokens passed via Bearer header (no storage needed)
    depends_on:
      - redis  # Required for MCP session state
    networks:
      - ranger-network

networks:
  ranger-network:
    driver: bridge

volumes:
  mongo-data:
  redis-data:
```

---

## Troubleshooting

### Issue: OAuth Server Not Appearing in UI

**Symptoms:**
- Server configured in ranger.yaml
- Backend logs show initialization
- UI doesn't show "Connect" button

**Diagnosis:**

1. Check backend logs:
```
[MCP][ms365-mcp] OAuth detected from config (manual configuration)
[MCP][ms365-mcp] Successfully added to sharedUserServers
```

2. Verify UI is fetching config:
```bash
# Check startup config endpoint
curl http://localhost:3080/api/config
```

**Solution:**

```javascript
// In api/server/controllers/mcp.js
// Ensure rawServerConfig is checked
if (server.tools.length > 0 || serverConfig || rawServerConfig) {
  mcpTools.push({
    name: serverName,
    tools: server.tools,
    authenticated: rawServerConfig?.requiresOAuth ? false : true,
  });
}
```

### Issue: 30-Second Timeout During Initialization

**Symptoms:**
```
[MCP][ms365-mcp] OAuth authentication required
[MCP] Initialization took 30000ms
```

**Cause:** Inspector attempting HTTP detection when OAuth is manually configured

**Solution:**

```typescript
// In MCPServerInspector.ts detectOAuth()
// Check for explicit oauth config FIRST
if (this.config.oauth != null && Object.keys(this.config.oauth).length > 0) {
  this.config.requiresOAuth = true;
  logger.info(`[MCP][${this.config.name}] OAuth detected from config (manual configuration)`);
  return; // Skip HTTP detection
}
```

### Issue: Token Not Found on Different Instance

**Symptoms:**
- User authenticates successfully
- Subsequent requests fail with "No authentication"
- Different instance handling request

**Diagnosis:**

1. Check MongoDB connection:
```javascript
// All instances must use same database
console.log(process.env.MONGO_URI);
// Should be same across all instances
```

2. Verify token storage:
```bash
# Connect to MongoDB
mongo mongodb://localhost:27017/ranger

# Check tokens collection
db.tokens.find({ userId: "user123", type: "mcp_oauth" })
```

**Solution:**

Ensure all instances use the **same** `MONGO_URI` environment variable.

### Issue: Redis Connection Failures

**Symptoms:**
```
Error: Could not connect to Redis
Leader election failed
```

**Diagnosis:**

1. Check Redis connectivity:
```bash
redis-cli -h redis-service -p 6379 ping
# Should return: PONG
```

2. Verify Redis configuration:
```javascript
// In config or environment
{
  redis: {
    uri: process.env.REDIS_URI || 'redis://localhost:6379'
  }
}
```

**Solution:**

- Ensure Redis is accessible from all instances
- Check network security groups (AWS)
- Verify Redis credentials if authentication enabled

### Issue: Token Refresh Failing

**Symptoms:**
```
[MCP][User: user123][ms365-mcp] Failed to refresh tokens
Error: unauthorized_client
```

**Cause:** OAuth provider doesn't support refresh for this client type

**Solution:**

1. **Check OAuth configuration** - Ensure app registration supports refresh tokens
2. **Request offline_access scope** (Microsoft) or `access_type=offline` (Google)
3. **Fall back to re-authentication** - UI should prompt user to reconnect

```typescript
// Graceful handling in code
const tokens = await MCPTokenStorage.getTokens({...});
if (!tokens) {
  return {
    requiresAuth: true,
    authUrl: generateOAuthUrl(serverName)
  };
}
```

### Issue: Encrypted Token Decryption Failure

**Symptoms:**
```
Error: Unable to decrypt token
Invalid authentication tag
```

**Cause:** Encryption key mismatch between instances

**Solution:**

Ensure all instances use the **same encryption key**:

```bash
# Environment variable (must be consistent)
CREDS_KEY=your-32-byte-encryption-key
CREDS_IV=your-16-byte-iv
```

**Important:** If key changes, all existing tokens must be re-encrypted or users must re-authenticate.

---

## Code Reference

### Key Files

#### 1. MCPTokenStorage (Token Management)
**Location:** `packages/api/src/mcp/oauth/tokens.ts`

**Key Methods:**
- `storeTokens()` - Encrypt and store OAuth tokens
- `getTokens()` - Retrieve and decrypt tokens (with auto-refresh)
- `getLogPrefix()` - Generate log prefixes for debugging

**Usage:**
```typescript
import { MCPTokenStorage } from '~/mcp/oauth/tokens';

// Store tokens after OAuth callback
await MCPTokenStorage.storeTokens({
  userId: req.user.id,
  serverName: 'ms365-mcp',
  tokens: oauthResponse,
  createToken: db.createToken,
  updateToken: db.updateToken,
  findToken: db.findToken,
});

// Retrieve tokens for tool execution
const tokens = await MCPTokenStorage.getTokens({
  userId: req.user.id,
  serverName: 'ms365-mcp',
  findToken: db.findToken,
  createToken: db.createToken,
  updateToken: db.updateToken,
  refreshTokens: async (refreshToken, metadata) => {
    return await oauthProvider.refresh(refreshToken);
  },
});
```

#### 2. MCPServerInspector (Server Detection)
**Location:** `packages/api/src/mcp/registry/MCPServerInspector.ts`

**Key Methods:**
- `inspect()` - Main inspection entry point
- `detectOAuth()` - Detect OAuth requirements
- `detectCapabilities()` - Discover server capabilities
- `inspectTools()` - Enumerate available tools

**Critical Fix:**
```typescript
async detectOAuth() {
  // Check for explicit config FIRST (prevents timeout)
  if (this.config.oauth != null && Object.keys(this.config.oauth).length > 0) {
    this.config.requiresOAuth = true;
    logger.info(`[MCP][${this.config.name}] OAuth detected from config`);
    return;
  }
  
  // Fall back to HTTP detection for auto-discovery
  // ... (HTTP detection code)
}
```

#### 3. MCPServersInitializer (Distributed Initialization)
**Location:** `packages/api/src/mcp/registry/MCPServersInitializer.ts`

**Key Methods:**
- `initialize()` - Main initialization with leader election
- `initializeServer()` - Initialize single server
- `resetCaches()` - Clear Redis caches

**Leader Election Logic:**
```typescript
async initialize() {
  const isLeader = await this.leaderElection.tryAcquire();
  
  if (isLeader) {
    logger.info('[MCP] This instance is the leader');
    await this.resetCaches();
    
    // Initialize all servers
    for (const [name, config] of Object.entries(mcpServers)) {
      await this.initializeServer(name, config);
    }
    
    await this.statusCache.setInitialized(true);
    this.leaderElection.release();
  } else {
    logger.info('[MCP] Waiting for leader to initialize');
    await this.statusCache.waitForInitialization();
  }
}
```

#### 4. MCP Controller (API Endpoint)
**Location:** `api/server/controllers/mcp.js`

**Key Functions:**
- `getMCPTools()` - Return available MCP tools for UI
- OAuth server visibility logic

**OAuth Detection:**
```javascript
const mcpTools = [];
for (const [serverName, server] of registry.getAllServers()) {
  const serverConfig = registry.getServerConfig(serverName);
  const rawServerConfig = await getMCPManager(req).getServerConfig(serverName);
  
  // Include OAuth servers even without tools
  if (server.tools.length > 0 || serverConfig || rawServerConfig) {
    mcpTools.push({
      name: serverName,
      tools: server.tools,
      authenticated: rawServerConfig?.requiresOAuth ? false : true,
    });
  }
}
```

#### 5. Config Route (Startup Configuration)
**Location:** `api/server/routes/config.js`

**Function:** `getMCPServers()` - Build MCP server list for UI

```javascript
function getMCPServers() {
  const servers = [];
  for (const [name, config] of registry.getAllServers()) {
    servers.push({
      name,
      isOAuth: config.requiresOAuth,
      startup: config.startup,
      chatMenu: config.chatMenu,
    });
  }
  return servers;
}
```

### Database Schema

#### Tokens Collection

```javascript
{
  _id: ObjectId("..."),
  userId: "user123",
  type: "mcp_oauth",  // or 'mcp_oauth_refresh', 'mcp_oauth_client'
  identifier: "mcp:ms365-mcp",
  token: "04af3c7b9e6f...",  // Encrypted
  expiresAt: ISODate("2025-11-04T15:30:00Z"),
  metadata: {
    serverName: "ms365-mcp",
    userId: "user123",
    clientInfo: {
      client_id: "...",
      // encrypted separately
    }
  },
  createdAt: ISODate("2025-11-04T14:30:00Z"),
  updatedAt: ISODate("2025-11-04T14:30:00Z")
}
```

**Indexes:**
```javascript
db.tokens.createIndex({ userId: 1, type: 1, identifier: 1 });
db.tokens.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
```

### Redis Keys

**Leader Election:**
```
mcp:leader:lock -> "instance-id-abc123"
TTL: 30 seconds (renewable)
```

**Initialization Status:**
```
mcp:initialized -> "true"
TTL: None (persistent)
```

**Server Configuration Cache:**
```
mcp:config:ms365-mcp -> JSON(serverConfig)
TTL: 300 seconds (5 minutes)
```

---

## Best Practices

### 1. Token Management

✅ **Do:**
- Always encrypt tokens before storage
- Use automatic token refresh when available
- Handle refresh failures gracefully (prompt re-auth)
- Set appropriate token expiration times
- Implement token revocation on user logout

❌ **Don't:**
- Store plain-text tokens in database
- Share tokens between users
- Log decrypted tokens (even in debug mode)
- Ignore token expiration
- Hardcode OAuth credentials

### 2. Distributed Deployment

✅ **Do:**
- Use same Redis cluster for all instances
- Use same MongoDB database for all instances
- Implement proper leader election
- Use environment variables for configuration
- Test with multiple instances locally (docker-compose scale)

❌ **Don't:**
- Give each instance its own database
- Skip leader election (causes duplicate initialization)
- Hardcode instance-specific URLs
- Assume requests hit the same instance

### 3. Security

✅ **Do:**
- Use HTTPS for all OAuth providers
- Enable TLS for Redis in production
- Enable TLS for MongoDB in production
- Rotate encryption keys periodically
- Implement rate limiting on OAuth endpoints
- Use VPC/private subnets for databases

❌ **Don't:**
- Expose databases to public internet
- Use weak encryption keys
- Skip OAuth state validation
- Allow cross-origin requests without CORS validation

### 4. Monitoring

✅ **Do:**
- Log OAuth flow events (without tokens)
- Monitor token refresh success/failure rates
- Track leader election changes
- Alert on initialization failures
- Monitor database connection health

❌ **Don't:**
- Log decrypted tokens
- Ignore repeated refresh failures
- Skip health checks
- Disable error logging

---

## Performance Considerations

### Token Caching

**Current:** Tokens are fetched from database on every request

**Optimization Opportunity:**
```typescript
// Add Redis cache layer for frequently used tokens
const cachedToken = await redis.get(`token:${userId}:${serverName}`);
if (cachedToken && !isExpired(cachedToken)) {
  return JSON.parse(cachedToken);
}

// Fetch from database
const token = await db.findToken({...});
await redis.setex(`token:${userId}:${serverName}`, 300, JSON.stringify(token));
```

**Trade-off:** Faster access vs. increased Redis memory usage

### Connection Pooling

**MongoDB:**
```javascript
// Use connection pooling (already implemented)
mongoose.connect(MONGO_URI, {
  maxPoolSize: 50,  // Max connections per instance
  minPoolSize: 10,
  socketTimeoutMS: 45000,
});
```

**Redis:**
```javascript
// Use cluster mode for high availability
const redis = new Redis.Cluster([
  { host: 'redis-1', port: 6379 },
  { host: 'redis-2', port: 6379 },
  { host: 'redis-3', port: 6379 },
]);
```

### Load Balancing

**Sticky Sessions:** Not required (stateless instances)

**Algorithm:** Round-robin or least-connections

**Health Checks:**
```javascript
// Implement health check endpoint
app.get('/health', async (req, res) => {
  const redisOk = await redis.ping() === 'PONG';
  const mongoOk = mongoose.connection.readyState === 1;
  
  if (redisOk && mongoOk) {
    res.status(200).json({ status: 'healthy' });
  } else {
    res.status(503).json({ status: 'unhealthy', redis: redisOk, mongo: mongoOk });
  }
});
```

---

## Migration Guide

### Upgrading from Previous Version

If you're upgrading from a version without distributed token management:

#### Step 1: Backup Database
```bash
mongodump --uri="mongodb://localhost:27017/ranger" --out=/backup/ranger-backup
```

#### Step 2: Update Code
```bash
git pull origin feat/mcp-registry-refactor-merge
npm install
npm run build:api
```

#### Step 3: Update Configuration

Add OAuth configuration to `ranger.yaml`:
```yaml
mcpServers:
  your-server:
    oauth:
      authorization_url: '...'
      token_url: '...'
      # ... other OAuth fields
```

#### Step 4: Deploy with Zero Downtime

```bash
# Deploy instances one at a time
# Instance 1: Stop, update, start
docker-compose up -d --no-deps --scale ranger-app=2 ranger-app

# Wait for health check
sleep 10

# Instance 2: Update
docker-compose up -d --no-deps --scale ranger-app=3 ranger-app
```

#### Step 5: Verify

```bash
# Check logs for successful initialization
docker-compose logs -f ranger-app | grep MCP

# Expected output:
# [MCP][ms365-mcp] OAuth detected from config
# [MCP][ms365-mcp] Successfully added to sharedUserServers
```

---

## Visual Comparison: Stateless vs Stateful

### Authentication Layer (Stateless) ✅

```
Request 1:  Client → [Bearer: token123] → MCP Server → Validates → Process
Request 2:  Client → [Bearer: token123] → MCP Server → Validates → Process
Request 3:  Client → [Bearer: token123] → MCP Server → Validates → Process

No state stored between requests!
Each request is independent.
```

### MCP Protocol Layer (Stateful) ❌

```
Session Init:  Client → [init] → MCP Server → Creates session ABC → Stores in Redis
                                                └─ EventStore
                                                └─ Transport Map
                                                └─ SSE Stream

Tool Call:     Client → [sessionId: ABC] → MCP Server → Finds session ABC in Redis
                                                       └─ Continues conversation
                                                       └─ Maintains context

SSE Stream:    Client ← [event stream] ← MCP Server ← Reads from Redis EventStore
                                                     └─ Replays messages
                                                     └─ Maintains order

State MUST persist across requests!
Session continuity requires storage.
```

### Side-by-Side Comparison

| Aspect | OAuth Auth Layer | MCP Protocol Layer |
|--------|------------------|-------------------|
| **State** | Stateless | Stateful |
| **Storage** | None (tokens in header) | Redis EventStore |
| **Multi-Instance** | Works without Redis | **Requires Redis** |
| **Request Dependency** | Independent | Depends on session history |
| **Example** | `Authorization: Bearer ya29...` | `mcp-session-id: uuid-123` |

---

## Related Documentation

- [MCP Registry System Architecture](./MCP_REGISTRY_ARCHITECTURE.md) *(if exists)*
- [OAuth 2.0 Specification](https://oauth.net/2/)
- [Model Context Protocol Specification](https://modelcontextprotocol.io/)
- [Redis Leader Election Pattern](https://redis.io/topics/distlock)
- [MongoDB Encryption at Rest](https://docs.mongodb.com/manual/core/security-encryption-at-rest/)
- **MCP Server Codebase:** `REDIS_SETUP.md`, `SESSION_VALIDATION.md`, `streamableHttp.ts`

---

## Glossary

| Term | Definition |
|------|------------|
| **MCP** | Model Context Protocol - Protocol for AI assistants to access external tools |
| **OAuth** | Open Authorization - Standard for access delegation |
| **Leader Election** | Distributed systems pattern where one instance is elected as coordinator |
| **ECS** | Amazon Elastic Container Service - Container orchestration service |
| **Task** | ECS term for a running instance of a container |
| **Redis** | In-memory data store used for caching and coordination (and MCP session state) |
| **MongoDB** | NoSQL database used for persistent storage |
| **Encryption at Rest** | Data encryption when stored on disk |
| **Encryption in Transit** | Data encryption when transmitted over network |
| **Access Token** | Short-lived OAuth token for API access |
| **Refresh Token** | Long-lived OAuth token for obtaining new access tokens |
| **Token Expiry** | Time when a token becomes invalid |
| **PKCE** | Proof Key for Code Exchange - OAuth extension for public clients |
| **StreamableHTTPServerTransport** | MCP SDK class for managing HTTP-based MCP connections with session state |
| **EventStore** | Interface for storing MCP protocol events (InMemoryEventStore or RedisEventStore) |
| **SSE** | Server-Sent Events - One-way streaming from server to client |
| **JSON-RPC** | JSON Remote Procedure Call - Protocol used by MCP for tool invocation |
| **Bearer Token** | HTTP authentication scheme where token is sent in Authorization header |
| **Session State** | Data about ongoing MCP conversations (transports, events, messages) |
| **Stateless Authentication** | Auth method where credentials are validated per-request without server-side storage |
| **Stateful Protocol** | Protocol requiring persistent connection state (like MCP sessions) |

---

## Support

For issues or questions:

1. Check [Troubleshooting](#troubleshooting) section
2. Review backend logs: `docker-compose logs -f ranger-app`
3. Check MongoDB tokens collection: `db.tokens.find({ userId: "your-user-id" })`
4. Verify Redis connectivity: `redis-cli ping`
5. Open GitHub issue with logs and configuration (redact secrets!)

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2025-11-04 | Initial documentation for distributed OAuth token management |
| 1.1.0 | 2025-11-04 | **CRITICAL CORRECTION**: Added clarification about MCP server Redis requirements |

---

## Final Summary: MCP Server Redis Requirements

### The Complete Picture

**For Ranger (Main Application):**
- ✅ Uses MongoDB for OAuth token storage (encrypted)
- ✅ Uses Redis for leader election and config caching
- ✅ Fully stateless - any instance can handle any request

**For MCP Server (External Tool Provider):**
- ✅ Receives OAuth tokens via Bearer header (stateless authentication)
- ❌ **Requires Redis** for MCP protocol session state (stateful protocol)
- ⚠️ Can run without Redis ONLY in single-instance development mode

### Production Deployment Checklist

**For Single-Instance Development:**
```bash
# MCP Server
USE_REDIS=false  # In-memory storage OK

# Ranger
MONGO_URI=mongodb://localhost:27017/ranger
REDIS_URI=redis://localhost:6379
```

**For Multi-Instance Production:**
```bash
# MCP Server (MUST have Redis)
USE_REDIS=true
REDIS_URL=redis://redis-cluster:6379

# Ranger (same as before)
MONGO_URI=mongodb://mongo-cluster:27017/ranger
REDIS_URI=redis://redis-cluster:6379
```

### Common Misconceptions Addressed

| Misconception | Reality |
|--------------|---------|
| "MCP servers are stateless" | ❌ OAuth auth is stateless, MCP protocol is stateful |
| "MCP servers don't need Redis" | ⚠️ Only true for single-instance deployments |
| "Redis is just for Ranger" | ❌ Both Ranger AND MCP servers use Redis (different purposes) |
| "OAuth tokens stored in Redis" | ❌ Tokens in MongoDB (Ranger), Redis stores MCP sessions |

### Architecture at a Glance

```
Ranger → MongoDB (OAuth tokens) + Redis (coordination)
   ↓ (Bearer token in request)
MCP Server → Redis (MCP session state) + NO token storage
   ↓ (validated request)
Microsoft Graph API (OAuth token used here)
```

**Key Insight:** Redis serves **different purposes** for each component:
- **Ranger**: Leader election, config cache
- **MCP Server**: Session state, event store, SSE streams

Both can scale horizontally when using Redis.

---

**Document Maintainer:** Development Team  
**Last Reviewed:** November 4, 2025  
**Next Review:** December 4, 2025

**Related Documentation:**
- MCP Server: `REDIS_SETUP.md` - Redis configuration guide
- MCP Server: `SESSION_VALIDATION.md` - Session management details
- Ranger: `deployment.txt` - Production deployment guide
