# Redis Comprehensive Monitoring & Logging

## Overview

This system provides end-to-end monitoring and logging for Redis connections, memory usage, client connections, performance metrics, and automatic alerting for critical conditions.

## Features

### 1. **Connection Logging**
- Detailed configuration logging on startup
- Connection state transitions (connecting, connected, ready, reconnecting, closed)
- Both ioredis and @keyv/redis client monitoring
- Connection pool information

### 2. **Memory Monitoring**
- Used memory vs. max memory tracking
- Free memory calculation
- Memory usage percentage
- Peak memory tracking
- Fragmentation ratio
- Memory overhead analysis
- Eviction policy monitoring

### 3. **Client Connection Tracking**
- Connected clients count
- Blocked clients count
- Total connections received
- Rejected connections tracking
- Connection pool status

### 4. **Performance Metrics**
- Operations per second
- Total commands processed
- Keyspace hit/miss ratio
- Evicted keys count
- Expired keys count
- CPU usage (system and user)

### 5. **Keyspace Statistics**
- Total keys across all databases
- Keys with TTL
- Average TTL per database
- Per-database breakdowns

### 6. **Automatic Alerts**
- High memory usage (90% threshold by default)
- Critical memory (95% threshold)
- High client count
- Rejected connections
- Key evictions
- Configurable alert cooldowns (1 minute default)

## Environment Variables

### Core Redis Configuration

```bash
# Enable Redis
USE_REDIS=true

# Redis connection URI (supports multiple for cluster)
REDIS_URI=redis://localhost:6379
# or for cluster:
REDIS_URI=redis://node1:6379,redis://node2:6379,redis://node3:6379

# Cluster mode
USE_REDIS_CLUSTER=false

# Authentication
REDIS_USERNAME=
REDIS_PASSWORD=your_password

# TLS/SSL
REDIS_CA=/path/to/ca-cert.pem

# Key prefix for multi-tenant deployments
REDIS_KEY_PREFIX=myapp
# or use env var name:
REDIS_KEY_PREFIX_VAR=DEPLOYMENT_ID

# Connection settings
REDIS_MAX_LISTENERS=200
REDIS_CONNECT_TIMEOUT=10000  # milliseconds
REDIS_RETRY_MAX_ATTEMPTS=10
REDIS_RETRY_MAX_DELAY=3000   # milliseconds
REDIS_ENABLE_OFFLINE_QUEUE=true
REDIS_PING_INTERVAL=0        # seconds, 0 = disabled

# AWS ElastiCache specific
REDIS_USE_ALTERNATIVE_DNS_LOOKUP=false
```

### Monitoring Configuration

```bash
# Enable/disable monitoring (auto-disabled in CI)
REDIS_MONITORING_ENABLED=true

# Monitoring interval in milliseconds (default: 5 minutes)
REDIS_MONITORING_INTERVAL=300000

# Memory usage alert threshold (0.0 - 1.0)
REDIS_MEMORY_ALERT_THRESHOLD=0.9

# Client connection alert threshold
REDIS_CLIENT_ALERT_THRESHOLD=1000
```

### Cache Configuration

```bash
# Force specific caches to use in-memory storage (comma-separated)
FORCED_IN_MEMORY_CACHE_NAMESPACES=cache1,cache2
```

## Log Output Examples

### Connection Initialization

```
🔌 [Redis] ========== REDIS CONNECTION INITIALIZATION ==========
🔌 [Redis] Configuration: {
  redis_uri: 'redis://localhost:6379',
  total_urls: 1,
  mode: 'STANDALONE',
  use_cluster: false,
  has_username: false,
  has_password: true,
  has_tls: false,
  key_prefix: 'myapp',
  max_listeners: 200,
  connect_timeout: '10000ms',
  retry_max_attempts: 10,
  retry_max_delay: '3000ms',
  offline_queue: true,
  ping_interval: 'disabled',
  use_alternative_dns: false
}
🔌 [Redis] Creating standalone ioredis client...
✅ [Redis ioredis] Client connected successfully
✅ [Redis ioredis] Client READY - connection fully established
📊 [Redis Server Info]: { version: '7.2.0', mode: 'standalone', uptime: '24 hours' }
💾 [Redis Memory Info]: { used_memory: '2.5M', max_memory: '1.0G', eviction_policy: 'allkeys-lru' }
⚡ [Redis Stats Info]: { connected_clients: '5', ops_per_sec: '150' }
📊 [Redis Monitor] Started with 300s interval
```

### Memory Statistics (Every 5 minutes)

```
💾 [Redis Monitor] MEMORY STATS: {
  used_memory: '2500.50 MB',
  used_memory_human: '2.50M',
  max_memory: '10000.00 MB',
  free_memory: '7500.00 MB',
  usage_percentage: '25.00%',
  peak_memory: '3.2M',
  fragmentation_ratio: '1.05',
  maxmemory_policy: 'allkeys-lru'
}
```

### Client Statistics

```
👥 [Redis Monitor] CLIENT STATS: {
  connected_clients: 25,
  blocked_clients: 0,
  total_connections: 1543,
  rejected_connections: 0
}
```

### Performance Statistics

```
⚡ [Redis Monitor] PERFORMANCE STATS: {
  ops_per_sec: 250,
  total_commands: 1245789,
  keyspace_hit_rate: '95.50%',
  keyspace_hits: 1189001,
  keyspace_misses: 56788,
  evicted_keys: 0,
  expired_keys: 1205
}
```

### Keyspace Statistics

```
🔑 [Redis Monitor] KEYSPACE STATS: {
  total_keys: 15234,
  total_with_ttl: 8932,
  databases: 2,
  details: {
    db0: { keys: 12045, expires: 7123, avg_ttl: 3600000 },
    db1: { keys: 3189, expires: 1809, avg_ttl: 7200000 }
  }
}
```

### Cache Creation

```
🗄️ [Cache Factory] Creating REDIS cache: {
  namespace: 'user_sessions',
  ttl: '86400000ms',
  forcedInMemory: false,
  redisAvailable: true
}
✅ [Cache Factory] Redis cache created for namespace: user_sessions
```

### Alerts

```
🚨 [Redis Monitor] HIGH MEMORY ALERT: {
  used: '9.2G',
  max: '10.0G',
  percentage: '92.00%',
  threshold: '90%',
  policy: 'allkeys-lru',
  action_required: 'Consider increasing memory limit or investigating memory usage'
}

🔴 [Redis Monitor] CRITICAL MEMORY ALERT: {
  used: '9.6G',
  max: '10.0G',
  percentage: '96.00%',
  message: 'Redis is at critical memory capacity!',
  recommendation: 'Immediate action required: Scale up Redis or clear unused keys'
}

🚨 [Redis Monitor] HIGH CLIENT COUNT ALERT: {
  connected_clients: 1250,
  threshold: 1000,
  rejected_connections: 0,
  message: 'High number of concurrent Redis connections',
  recommendation: 'Review connection pooling and client cleanup'
}
```

## API Endpoints

### Health Check

```bash
GET /api/redis/health
```

**Response:**
```json
{
  "success": true,
  "timestamp": "2025-11-20T10:30:00.000Z",
  "redis": {
    "enabled": true,
    "ioredis": {
      "status": "ready",
      "options": {
        "keyPrefix": "myapp::",
        "maxRetriesPerRequest": 3,
        "enableOfflineQueue": true,
        "connectTimeout": 10000
      }
    },
    "keyv": {
      "isOpen": true,
      "isReady": true
    }
  },
  "caches": {
    "totalInstances": 12,
    "redisConnected": true,
    "redisMode": "standalone",
    "instances": [
      {
        "namespace": "user_sessions",
        "type": "redis",
        "createdAt": "2025-11-20T08:00:00.000Z",
        "ttl": 86400000
      }
    ]
  }
}
```

### Statistics (Admin Only)

```bash
GET /api/redis/stats
```

**Response:**
```json
{
  "success": true,
  "timestamp": "2025-11-20T10:30:00.000Z",
  "message": "Stats collected and logged. Check server logs for detailed information.",
  "summary": {
    "redis": { ... },
    "caches": { ... }
  }
}
```

## Programmatic Access

```typescript
import { redisMonitor } from '~/cache';

// Get pool information
const poolInfo = await redisMonitor.getPoolInfo();

// Set custom alert thresholds
redisMonitor.setAlertThresholds({
  memoryThreshold: 0.85,      // 85%
  clientThreshold: 500,        // 500 clients
  alertCooldownMs: 120000      // 2 minutes
});

// Start/stop monitoring
redisMonitor.startMonitoring(60000);  // Every 1 minute
redisMonitor.stopMonitoring();
```

## Best Practices

1. **Production Settings**
   ```bash
   REDIS_MONITORING_INTERVAL=300000    # 5 minutes
   REDIS_MEMORY_ALERT_THRESHOLD=0.85   # Alert at 85%
   REDIS_CLIENT_ALERT_THRESHOLD=500    # Based on your infra
   ```

2. **Development Settings**
   ```bash
   REDIS_MONITORING_INTERVAL=60000     # 1 minute for faster feedback
   REDIS_MEMORY_ALERT_THRESHOLD=0.9    # Less sensitive
   ```

3. **CI/Testing**
   - Monitoring is automatically disabled in CI environments
   - Use `REDIS_MONITORING_ENABLED=false` to explicitly disable

4. **Monitoring Alerts**
   - Configure alert thresholds based on your infrastructure
   - Set up external alerting (PagerDuty, Slack) by monitoring logs
   - Alerts have 1-minute cooldown by default to prevent spam

5. **Memory Management**
   - Monitor eviction policies (`allkeys-lru` recommended for caches)
   - Set `maxmemory` in Redis configuration
   - Watch for fragmentation ratio > 1.5

6. **Connection Pooling**
   - Monitor rejected connections closely
   - Adjust `REDIS_MAX_LISTENERS` based on your application scale
   - Review connection lifecycle in logs

## Troubleshooting

### High Memory Usage
1. Check eviction policy: `maxmemory_policy`
2. Review `evicted_keys` count
3. Check fragmentation ratio
4. Consider increasing Redis memory or optimizing key TTLs

### Connection Issues
1. Check connection logs for retry attempts
2. Verify network connectivity
3. Check `rejected_connections` count
4. Review `REDIS_MAX_LISTENERS` setting

### Performance Issues
1. Monitor `instantaneous_ops_per_sec`
2. Check `keyspace_hit_rate` (should be >90%)
3. Review `used_cpu_sys` and `used_cpu_user`
4. Look for slow commands in Redis logs

## Integration with MCP OAuth Flow

The Redis monitoring system tracks all OAuth flow state operations:

```
💾 [Redis Monitor] KEYSPACE STATS: {
  ...
  details: {
    db0: {
      keys: 5234,  // Includes MCP OAuth flow states
      expires: 3421,
      avg_ttl: 180000  // 3 minutes for OAuth flows
    }
  }
}
```

Monitor `evicted_keys` for OAuth flows - if > 0, increase Redis memory or reduce other cache usage.
