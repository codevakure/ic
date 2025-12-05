/**
 * End-to-End MCP OAuth Lifecycle Tests
 * 
 * These tests cover the complete MCP OAuth lifecycle:
 * 1. Initial connection (no tokens)
 * 2. OAuth flow initiation
 * 3. Token storage after OAuth callback
 * 4. Token retrieval for subsequent connections
 * 5. Token expiration and auto-refresh
 * 6. Reconnection scenarios
 * 7. Status endpoint behavior
 */

const { logger } = require('@ranger/data-schemas');
const { MCPOAuthHandler } = require('@ranger/api');
const { CacheKeys } = require('ranger-data-provider');
const {
  getMCPSetupData,
  checkOAuthFlowStatus,
  getServerConnectionStatus,
} = require('./MCP');

// Mock all dependencies - must match MCP.spec.js
jest.mock('@ranger/data-schemas', () => ({
  logger: {
    debug: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  },
}));

jest.mock('@langchain/core/tools', () => ({
  tool: jest.fn((fn, config) => {
    const toolInstance = { _call: fn, ...config };
    return toolInstance;
  }),
}));

jest.mock('@ranger/agents', () => ({
  Providers: {
    VERTEXAI: 'vertexai',
    GOOGLE: 'google',
  },
  StepTypes: {
    TOOL_CALLS: 'tool_calls',
  },
  GraphEvents: {
    ON_RUN_STEP_DELTA: 'on_run_step_delta',
    ON_RUN_STEP: 'on_run_step',
  },
  Constants: {
    CONTENT_AND_ARTIFACT: 'content_and_artifact',
  },
}));

jest.mock('@ranger/api', () => ({
  MCPOAuthHandler: {
    generateFlowId: jest.fn((userId, serverName) => `${userId}:${serverName}`),
  },
  sendEvent: jest.fn(),
  normalizeServerName: jest.fn((name) => name),
  convertWithResolvedRefs: jest.fn((params) => params),
  mcpServersRegistry: {
    getOAuthServers: jest.fn(() => Promise.resolve(new Set())),
  },
}));

jest.mock('ranger-data-provider', () => ({
  CacheKeys: {
    FLOWS: 'flows',
  },
  Constants: {
    USE_PRELIM_RESPONSE_MESSAGE_ID: 'prelim_response_id',
    mcp_delimiter: '::',
    mcp_prefix: 'mcp_',
  },
  ContentTypes: {
    TEXT: 'text',
  },
  isAssistantsEndpoint: jest.fn(() => false),
  Time: {
    TWO_MINUTES: 120000,
  },
}));

jest.mock('./Config', () => ({
  loadCustomConfig: jest.fn(),
  getAppConfig: jest.fn(),
}));

jest.mock('~/config', () => ({
  getMCPManager: jest.fn(),
  getFlowStateManager: jest.fn(),
}));

jest.mock('~/cache', () => ({
  getLogStores: jest.fn(),
}));

jest.mock('~/models', () => ({
  findToken: jest.fn(),
  createToken: jest.fn(),
  updateToken: jest.fn(),
}));

jest.mock('./Tools/mcp', () => ({
  reinitMCPServer: jest.fn(),
}));

describe('MCP OAuth Lifecycle - End to End Tests', () => {
  let mockGetAppConfig;
  let mockGetFlowStateManager;
  let mockGetLogStores;
  let mockMcpServersRegistry;

  const mockUserId = 'user-lifecycle-test';
  const mockOAuthServerName = 'ms365-mcp';
  const mockNonOAuthServerName = 'local-mcp';

  beforeEach(() => {
    jest.clearAllMocks();

    mockGetAppConfig = require('./Config').getAppConfig;
    mockGetFlowStateManager = require('~/config').getFlowStateManager;
    mockGetLogStores = require('~/cache').getLogStores;
    mockMcpServersRegistry = require('@ranger/api').mcpServersRegistry;

    // Default setup
    mockGetAppConfig.mockResolvedValue({
      mcpConfig: {
        [mockOAuthServerName]: { type: 'sse', url: 'https://ms365.example.com' },
        [mockNonOAuthServerName]: { type: 'stdio', command: 'node', args: ['server.js'] },
      },
    });
    mockMcpServersRegistry.getOAuthServers.mockResolvedValue(new Set([mockOAuthServerName]));
    mockGetLogStores.mockReturnValue({});
  });

  describe('Phase 1: Initial State - No Tokens', () => {
    it('should show non-OAuth server as available without checking tokens', async () => {
      const mockTokenMethods = {
        findToken: jest.fn(),
      };

      const result = await getServerConnectionStatus(
        mockUserId,
        mockNonOAuthServerName,
        new Set([mockOAuthServerName]), // Only OAuth server in set
        mockTokenMethods,
      );

      expect(result).toEqual({
        requiresOAuth: false,
        connectionState: 'available',
      });
      expect(mockTokenMethods.findToken).not.toHaveBeenCalled();
    });

    it('should show OAuth server as disconnected when no token exists', async () => {
      const mockTokenMethods = {
        findToken: jest.fn().mockResolvedValue(null),
      };
      const mockFlowManager = { getFlowState: jest.fn().mockResolvedValue(null) };
      mockGetFlowStateManager.mockReturnValue(mockFlowManager);

      const result = await getServerConnectionStatus(
        mockUserId,
        mockOAuthServerName,
        new Set([mockOAuthServerName]),
        mockTokenMethods,
      );

      expect(result).toEqual({
        requiresOAuth: true,
        connectionState: 'disconnected',
      });
    });
  });

  describe('Phase 2: OAuth Flow Initiation', () => {
    it('should show connecting status when OAuth flow is pending', async () => {
      const mockTokenMethods = {
        findToken: jest.fn().mockResolvedValue(null),
      };
      const mockFlowManager = {
        getFlowState: jest.fn().mockResolvedValue({
          status: 'PENDING',
          createdAt: Date.now() - 30000, // 30 seconds ago
          ttl: 180000, // 3 minutes
        }),
      };
      mockGetFlowStateManager.mockReturnValue(mockFlowManager);

      const result = await getServerConnectionStatus(
        mockUserId,
        mockOAuthServerName,
        new Set([mockOAuthServerName]),
        mockTokenMethods,
      );

      expect(result).toEqual({
        requiresOAuth: true,
        connectionState: 'connecting',
      });
    });

    it('should show error status when OAuth flow fails', async () => {
      const mockTokenMethods = {
        findToken: jest.fn().mockResolvedValue(null),
      };
      const mockFlowManager = {
        getFlowState: jest.fn().mockResolvedValue({
          status: 'FAILED',
          createdAt: Date.now() - 60000,
          ttl: 180000,
          error: 'User denied access',
        }),
      };
      mockGetFlowStateManager.mockReturnValue(mockFlowManager);

      const result = await getServerConnectionStatus(
        mockUserId,
        mockOAuthServerName,
        new Set([mockOAuthServerName]),
        mockTokenMethods,
      );

      expect(result).toEqual({
        requiresOAuth: true,
        connectionState: 'error',
      });
    });

    it('should show error status when OAuth flow times out', async () => {
      const mockTokenMethods = {
        findToken: jest.fn().mockResolvedValue(null),
      };
      const mockFlowManager = {
        getFlowState: jest.fn().mockResolvedValue({
          status: 'PENDING',
          createdAt: Date.now() - 200000, // 200 seconds ago - exceeded TTL
          ttl: 180000,
        }),
      };
      mockGetFlowStateManager.mockReturnValue(mockFlowManager);

      const result = await getServerConnectionStatus(
        mockUserId,
        mockOAuthServerName,
        new Set([mockOAuthServerName]),
        mockTokenMethods,
      );

      expect(result).toEqual({
        requiresOAuth: true,
        connectionState: 'error',
      });
    });

    it('should treat cancelled flow as no active flow (disconnected)', async () => {
      const mockTokenMethods = {
        findToken: jest.fn().mockResolvedValue(null),
      };
      const mockFlowManager = {
        getFlowState: jest.fn().mockResolvedValue({
          status: 'FAILED',
          createdAt: Date.now() - 60000,
          ttl: 180000,
          error: 'User cancelled the OAuth flow',
        }),
      };
      mockGetFlowStateManager.mockReturnValue(mockFlowManager);

      const { hasActiveFlow, hasFailedFlow } = await checkOAuthFlowStatus(
        mockUserId,
        mockOAuthServerName,
      );

      // Cancelled should not be treated as failed
      expect(hasActiveFlow).toBe(false);
      expect(hasFailedFlow).toBe(false); // Cancelled flows return false for hasFailedFlow
    });
  });

  describe('Phase 3: After OAuth Callback - Token Stored', () => {
    it('should show connected status when valid token exists', async () => {
      const futureDate = new Date(Date.now() + 3600000); // 1 hour from now
      const mockTokenMethods = {
        findToken: jest.fn().mockResolvedValue({
          accessToken: 'valid-access-token-abc123',
          refreshToken: 'valid-refresh-token-xyz789',
          expiresAt: futureDate,
        }),
      };

      const result = await getServerConnectionStatus(
        mockUserId,
        mockOAuthServerName,
        new Set([mockOAuthServerName]),
        mockTokenMethods,
      );

      expect(result).toEqual({
        requiresOAuth: true,
        connectionState: 'connected',
      });

      // Verify correct token lookup
      expect(mockTokenMethods.findToken).toHaveBeenCalledWith({
        userId: mockUserId,
        type: 'mcp_oauth',
        identifier: `mcp:${mockOAuthServerName}`,
      });
    });
  });

  describe('Phase 4: Token Expiration and Auto-Refresh', () => {
    it('should show connected when token expired but refresh token available', async () => {
      const pastDate = new Date(Date.now() - 3600000); // 1 hour ago (expired)
      const mockTokenMethods = {
        findToken: jest.fn().mockResolvedValue({
          accessToken: 'expired-access-token',
          refreshToken: 'valid-refresh-token',
          expiresAt: pastDate,
        }),
      };

      const result = await getServerConnectionStatus(
        mockUserId,
        mockOAuthServerName,
        new Set([mockOAuthServerName]),
        mockTokenMethods,
      );

      // Should still show connected - auto-refresh will happen on next tool call
      expect(result).toEqual({
        requiresOAuth: true,
        connectionState: 'connected',
      });
    });

    it('should show disconnected when token expired and no refresh token', async () => {
      const pastDate = new Date(Date.now() - 3600000);
      const mockTokenMethods = {
        findToken: jest.fn().mockResolvedValue({
          accessToken: 'expired-access-token',
          refreshToken: null,
          expiresAt: pastDate,
        }),
      };

      const result = await getServerConnectionStatus(
        mockUserId,
        mockOAuthServerName,
        new Set([mockOAuthServerName]),
        mockTokenMethods,
      );

      // User needs to re-authenticate
      expect(result).toEqual({
        requiresOAuth: true,
        connectionState: 'disconnected',
      });
    });
  });

  describe('Phase 5: Reconnection Scenarios', () => {
    it('should handle reconnection after connection drop (token still valid)', async () => {
      const futureDate = new Date(Date.now() + 1800000); // 30 mins
      const mockTokenMethods = {
        findToken: jest.fn().mockResolvedValue({
          accessToken: 'still-valid-token',
          refreshToken: 'refresh-token',
          expiresAt: futureDate,
        }),
      };

      // Simulate: connection was dropped, but token is still valid
      // Status check should still show connected
      const result = await getServerConnectionStatus(
        mockUserId,
        mockOAuthServerName,
        new Set([mockOAuthServerName]),
        mockTokenMethods,
      );

      expect(result).toEqual({
        requiresOAuth: true,
        connectionState: 'connected',
      });
    });

    it('should handle reconnection when refresh token is also expired', async () => {
      const pastDate = new Date(Date.now() - 86400000); // 1 day ago
      const mockTokenMethods = {
        findToken: jest.fn().mockResolvedValue({
          accessToken: 'very-expired-token',
          refreshToken: null, // Refresh token is gone or also expired
          expiresAt: pastDate,
        }),
      };

      const result = await getServerConnectionStatus(
        mockUserId,
        mockOAuthServerName,
        new Set([mockOAuthServerName]),
        mockTokenMethods,
      );

      expect(result).toEqual({
        requiresOAuth: true,
        connectionState: 'disconnected',
      });
    });
  });

  describe('Phase 6: Status Endpoint Complete Flow', () => {
    it('should return correct statuses for mixed OAuth and non-OAuth servers', async () => {
      const oauthServers = new Set([mockOAuthServerName]);
      const futureDate = new Date(Date.now() + 3600000);

      // For OAuth server - has valid token
      const mockOAuthTokenMethods = {
        findToken: jest.fn().mockResolvedValue({
          accessToken: 'valid-token',
          refreshToken: 'refresh-token',
          expiresAt: futureDate,
        }),
      };

      // For non-OAuth server
      const mockNonOAuthTokenMethods = {
        findToken: jest.fn(),
      };

      // Check OAuth server
      const oauthStatus = await getServerConnectionStatus(
        mockUserId,
        mockOAuthServerName,
        oauthServers,
        mockOAuthTokenMethods,
      );

      // Check non-OAuth server
      const nonOAuthStatus = await getServerConnectionStatus(
        mockUserId,
        mockNonOAuthServerName,
        oauthServers,
        mockNonOAuthTokenMethods,
      );

      expect(oauthStatus).toEqual({
        requiresOAuth: true,
        connectionState: 'connected',
      });

      expect(nonOAuthStatus).toEqual({
        requiresOAuth: false,
        connectionState: 'available',
      });

      // Non-OAuth server should not have called findToken
      expect(mockNonOAuthTokenMethods.findToken).not.toHaveBeenCalled();
    });

    it('should handle getMCPSetupData returning correct structure', async () => {
      const result = await getMCPSetupData(mockUserId);

      expect(result).toHaveProperty('mcpConfig');
      expect(result).toHaveProperty('oauthServers');
      expect(result).not.toHaveProperty('appConnections');
      expect(result).not.toHaveProperty('userConnections');

      expect(result.mcpConfig).toEqual({
        [mockOAuthServerName]: { type: 'sse', url: 'https://ms365.example.com' },
        [mockNonOAuthServerName]: { type: 'stdio', command: 'node', args: ['server.js'] },
      });
      expect(result.oauthServers).toEqual(new Set([mockOAuthServerName]));
    });
  });

  describe('Error Resilience', () => {
    it('should handle database errors gracefully during token lookup', async () => {
      const mockTokenMethods = {
        findToken: jest.fn().mockRejectedValue(new Error('MongoDB connection lost')),
      };

      const result = await getServerConnectionStatus(
        mockUserId,
        mockOAuthServerName,
        new Set([mockOAuthServerName]),
        mockTokenMethods,
      );

      // Should return disconnected on error (safe default)
      expect(result).toEqual({
        requiresOAuth: true,
        connectionState: 'disconnected',
      });

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error checking token status'),
        expect.any(Error),
      );
    });

    it('should handle flow state manager errors gracefully', async () => {
      const mockTokenMethods = {
        findToken: jest.fn().mockResolvedValue(null),
      };
      const mockFlowManager = {
        getFlowState: jest.fn().mockRejectedValue(new Error('Redis connection error')),
      };
      mockGetFlowStateManager.mockReturnValue(mockFlowManager);

      const { hasActiveFlow, hasFailedFlow } = await checkOAuthFlowStatus(
        mockUserId,
        mockOAuthServerName,
      );

      // Should return safe defaults on error
      expect(hasActiveFlow).toBe(false);
      expect(hasFailedFlow).toBe(false);

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error checking OAuth flows'),
        expect.any(Error),
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle token with no expiry date (never expires)', async () => {
      const mockTokenMethods = {
        findToken: jest.fn().mockResolvedValue({
          accessToken: 'permanent-token',
          refreshToken: 'refresh-token',
          expiresAt: null, // No expiry
        }),
      };

      const result = await getServerConnectionStatus(
        mockUserId,
        mockOAuthServerName,
        new Set([mockOAuthServerName]),
        mockTokenMethods,
      );

      expect(result).toEqual({
        requiresOAuth: true,
        connectionState: 'connected',
      });
    });

    it('should handle token with invalid expiry date (treats as no expiry = connected)', async () => {
      const mockTokenMethods = {
        findToken: jest.fn().mockResolvedValue({
          accessToken: 'token-with-bad-expiry',
          refreshToken: 'refresh-token',
          expiresAt: 'invalid-date', // Invalid date string
        }),
      };

      const result = await getServerConnectionStatus(
        mockUserId,
        mockOAuthServerName,
        new Set([mockOAuthServerName]),
        mockTokenMethods,
      );

      // Invalid date is treated as no expiry, so token is considered valid
      expect(result).toEqual({
        requiresOAuth: true,
        connectionState: 'connected',
      });
    });

    it('should handle empty string refresh token as no refresh token', async () => {
      const pastDate = new Date(Date.now() - 3600000);
      const mockTokenMethods = {
        findToken: jest.fn().mockResolvedValue({
          accessToken: 'expired-token',
          refreshToken: '', // Empty string
          expiresAt: pastDate,
        }),
      };

      const result = await getServerConnectionStatus(
        mockUserId,
        mockOAuthServerName,
        new Set([mockOAuthServerName]),
        mockTokenMethods,
      );

      expect(result).toEqual({
        requiresOAuth: true,
        connectionState: 'disconnected',
      });
    });

    it('should handle token lookup returning undefined', async () => {
      const mockTokenMethods = {
        findToken: jest.fn().mockResolvedValue(undefined),
      };
      const mockFlowManager = { getFlowState: jest.fn().mockResolvedValue(null) };
      mockGetFlowStateManager.mockReturnValue(mockFlowManager);

      const result = await getServerConnectionStatus(
        mockUserId,
        mockOAuthServerName,
        new Set([mockOAuthServerName]),
        mockTokenMethods,
      );

      expect(result).toEqual({
        requiresOAuth: true,
        connectionState: 'disconnected',
      });
    });

    it('should handle concurrent status checks for same user', async () => {
      const mockTokenMethods = {
        findToken: jest.fn().mockResolvedValue({
          accessToken: 'token',
          expiresAt: new Date(Date.now() + 3600000),
        }),
      };

      // Simulate concurrent requests
      const promises = [
        getServerConnectionStatus(mockUserId, mockOAuthServerName, new Set([mockOAuthServerName]), mockTokenMethods),
        getServerConnectionStatus(mockUserId, mockOAuthServerName, new Set([mockOAuthServerName]), mockTokenMethods),
        getServerConnectionStatus(mockUserId, mockOAuthServerName, new Set([mockOAuthServerName]), mockTokenMethods),
      ];

      const results = await Promise.all(promises);

      // All should return same result
      results.forEach((result) => {
        expect(result).toEqual({ requiresOAuth: true, connectionState: 'connected' });
      });
    });

    it('should handle different users with different token states', async () => {
      const oauthServers = new Set([mockOAuthServerName]);
      
      // User 1: has valid token
      const user1TokenMethods = {
        findToken: jest.fn().mockResolvedValue({
          accessToken: 'user1-token',
          expiresAt: new Date(Date.now() + 3600000),
        }),
      };

      // User 2: no token
      const user2TokenMethods = {
        findToken: jest.fn().mockResolvedValue(null),
      };
      const mockFlowManager = { getFlowState: jest.fn().mockResolvedValue(null) };
      mockGetFlowStateManager.mockReturnValue(mockFlowManager);

      const result1 = await getServerConnectionStatus('user-1', mockOAuthServerName, oauthServers, user1TokenMethods);
      const result2 = await getServerConnectionStatus('user-2', mockOAuthServerName, oauthServers, user2TokenMethods);

      expect(result1.connectionState).toBe('connected');
      expect(result2.connectionState).toBe('disconnected');
    });

    it('should handle token with very far future expiry', async () => {
      const mockTokenMethods = {
        findToken: jest.fn().mockResolvedValue({
          accessToken: 'long-lived-token',
          expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
        }),
      };

      const result = await getServerConnectionStatus(
        mockUserId,
        mockOAuthServerName,
        new Set([mockOAuthServerName]),
        mockTokenMethods,
      );

      expect(result).toEqual({
        requiresOAuth: true,
        connectionState: 'connected',
      });
    });

    it('should handle token with expiresAt in past by 1ms (just expired)', async () => {
      const mockTokenMethods = {
        findToken: jest.fn().mockResolvedValue({
          accessToken: 'just-expired-token',
          refreshToken: 'refresh',
          expiresAt: new Date(Date.now() - 1), // 1ms in the past
        }),
      };

      const result = await getServerConnectionStatus(
        mockUserId,
        mockOAuthServerName,
        new Set([mockOAuthServerName]),
        mockTokenMethods,
      );

      // Expired but has refresh, so still connected
      expect(result).toEqual({
        requiresOAuth: true,
        connectionState: 'connected',
      });
    });

    it('should handle server name with special characters', async () => {
      const specialServerName = 'server-with_special.chars:8080';
      const oauthServers = new Set([specialServerName]);
      const mockTokenMethods = {
        findToken: jest.fn().mockResolvedValue({
          accessToken: 'token',
          expiresAt: new Date(Date.now() + 3600000),
        }),
      };

      const result = await getServerConnectionStatus(
        mockUserId,
        specialServerName,
        oauthServers,
        mockTokenMethods,
      );

      expect(result).toEqual({
        requiresOAuth: true,
        connectionState: 'connected',
      });

      expect(mockTokenMethods.findToken).toHaveBeenCalledWith({
        userId: mockUserId,
        type: 'mcp_oauth',
        identifier: `mcp:${specialServerName}`,
      });
    });
  });
});

describe('Connection Status State Machine', () => {
  /**
   * State machine for OAuth server status:
   * 
   * [No Token] ─── initiate OAuth ──→ [PENDING Flow] ─── callback success ──→ [Valid Token]
   *     ↑                                  │                                        │
   *     │                                  │ timeout/fail                           │ expires
   *     │                                  ↓                                        ↓
   *     └────── re-initiate ──────── [FAILED Flow]        [Expired Token] ─── has refresh? ──→ [Auto Refresh]
   *                                                              │                               │
   *                                                              │ no refresh                    │ success
   *                                                              ↓                               ↓
   *                                                        [No Token]                      [Valid Token]
   */

  let mockGetFlowStateManager;
  let mockGetLogStores;

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetFlowStateManager = require('~/config').getFlowStateManager;
    mockGetLogStores = require('~/cache').getLogStores;
    mockGetLogStores.mockReturnValue({});
  });

  it('should transition: No Token → PENDING Flow → Valid Token', async () => {
    const oauthServers = new Set(['test-server']);
    const userId = 'user-state-test';

    // State 1: No Token
    let mockTokenMethods = {
      findToken: jest.fn().mockResolvedValue(null),
    };
    let mockFlowManager = { getFlowState: jest.fn().mockResolvedValue(null) };
    mockGetFlowStateManager.mockReturnValue(mockFlowManager);

    let result = await getServerConnectionStatus(userId, 'test-server', oauthServers, mockTokenMethods);
    expect(result.connectionState).toBe('disconnected');

    // State 2: PENDING Flow (OAuth initiated)
    mockFlowManager = {
      getFlowState: jest.fn().mockResolvedValue({
        status: 'PENDING',
        createdAt: Date.now(),
        ttl: 180000,
      }),
    };
    mockGetFlowStateManager.mockReturnValue(mockFlowManager);

    result = await getServerConnectionStatus(userId, 'test-server', oauthServers, mockTokenMethods);
    expect(result.connectionState).toBe('connecting');

    // State 3: Valid Token (OAuth completed)
    mockTokenMethods = {
      findToken: jest.fn().mockResolvedValue({
        accessToken: 'new-token',
        refreshToken: 'refresh',
        expiresAt: new Date(Date.now() + 3600000),
      }),
    };

    result = await getServerConnectionStatus(userId, 'test-server', oauthServers, mockTokenMethods);
    expect(result.connectionState).toBe('connected');
  });

  it('should transition: Valid Token → Expired Token → Still Connected (auto-refresh)', async () => {
    const oauthServers = new Set(['test-server']);
    const userId = 'user-state-test';

    // State 1: Valid Token
    let mockTokenMethods = {
      findToken: jest.fn().mockResolvedValue({
        accessToken: 'valid-token',
        refreshToken: 'refresh-token',
        expiresAt: new Date(Date.now() + 3600000),
      }),
    };

    let result = await getServerConnectionStatus(userId, 'test-server', oauthServers, mockTokenMethods);
    expect(result.connectionState).toBe('connected');

    // State 2: Expired Token with Refresh (simulating time passage)
    mockTokenMethods = {
      findToken: jest.fn().mockResolvedValue({
        accessToken: 'expired-token',
        refreshToken: 'refresh-token',
        expiresAt: new Date(Date.now() - 3600000), // Expired
      }),
    };

    result = await getServerConnectionStatus(userId, 'test-server', oauthServers, mockTokenMethods);
    // Should still be connected - will auto-refresh on use
    expect(result.connectionState).toBe('connected');
  });

  it('should transition: Expired Token (no refresh) → Disconnected', async () => {
    const oauthServers = new Set(['test-server']);
    const userId = 'user-state-test';
    const mockFlowManager = { getFlowState: jest.fn().mockResolvedValue(null) };
    mockGetFlowStateManager.mockReturnValue(mockFlowManager);

    const mockTokenMethods = {
      findToken: jest.fn().mockResolvedValue({
        accessToken: 'expired-token',
        refreshToken: null, // No refresh token
        expiresAt: new Date(Date.now() - 3600000),
      }),
    };

    const result = await getServerConnectionStatus(userId, 'test-server', oauthServers, mockTokenMethods);
    expect(result.connectionState).toBe('disconnected');
  });
});
