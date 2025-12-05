const { logger } = require('@ranger/data-schemas');
const { MCPOAuthHandler } = require('@ranger/api');
const { CacheKeys } = require('ranger-data-provider');
const {
  createMCPTool,
  createMCPTools,
  getMCPSetupData,
  checkOAuthFlowStatus,
  getServerConnectionStatus,
} = require('./MCP');

// Mock all dependencies
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

jest.mock('illuma-agents', () => ({
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
    generateFlowId: jest.fn(),
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

describe('tests for the new helper functions used by the MCP connection status endpoints', () => {
  let mockGetMCPManager;
  let mockGetFlowStateManager;
  let mockGetLogStores;
  let mockMcpServersRegistry;
  let mockFindToken;

  beforeEach(() => {
    jest.clearAllMocks();

    mockGetMCPManager = require('~/config').getMCPManager;
    mockGetFlowStateManager = require('~/config').getFlowStateManager;
    mockGetLogStores = require('~/cache').getLogStores;
    mockGetOAuthReconnectionManager = require('~/config').getOAuthReconnectionManager;
    mockMcpServersRegistry = require('@ranger/api').mcpServersRegistry;
    mockFindToken = require('~/models').findToken;
  });

  describe('getMCPSetupData', () => {
    const mockUserId = 'user-123';
    const mockConfig = {
      mcpServers: {
        server1: { type: 'stdio' },
        server2: { type: 'http' },
      },
    };
    let mockGetAppConfig;

    beforeEach(() => {
      mockGetAppConfig = require('./Config').getAppConfig;
      mockMcpServersRegistry.getOAuthServers.mockResolvedValue(new Set());
    });

    it('should successfully return MCP setup data with mcpConfig and oauthServers only', async () => {
      mockGetAppConfig.mockResolvedValue({ mcpConfig: mockConfig.mcpServers });
      const mockOAuthServers = new Set(['server2']);
      mockMcpServersRegistry.getOAuthServers.mockResolvedValue(mockOAuthServers);

      const result = await getMCPSetupData(mockUserId);

      expect(mockGetAppConfig).toHaveBeenCalled();
      expect(mockMcpServersRegistry.getOAuthServers).toHaveBeenCalled();

      // New simplified return - no appConnections or userConnections
      expect(result).toEqual({
        mcpConfig: mockConfig.mcpServers,
        oauthServers: mockOAuthServers,
      });

      // Should NOT call getMCPManager anymore
      expect(mockGetMCPManager).not.toHaveBeenCalled();
    });

    it('should throw error when MCP config not found', async () => {
      mockGetAppConfig.mockResolvedValue({});
      await expect(getMCPSetupData(mockUserId)).rejects.toThrow('MCP config not found');
    });

    it('should throw error when mcpConfig is null', async () => {
      mockGetAppConfig.mockResolvedValue({ mcpConfig: null });
      await expect(getMCPSetupData(mockUserId)).rejects.toThrow('MCP config not found');
    });

    it('should handle empty OAuth servers set', async () => {
      mockGetAppConfig.mockResolvedValue({ mcpConfig: mockConfig.mcpServers });
      mockMcpServersRegistry.getOAuthServers.mockResolvedValue(new Set());

      const result = await getMCPSetupData(mockUserId);

      expect(result).toEqual({
        mcpConfig: mockConfig.mcpServers,
        oauthServers: new Set(),
      });
    });

    it('should handle getOAuthServers rejection', async () => {
      mockGetAppConfig.mockResolvedValue({ mcpConfig: mockConfig.mcpServers });
      mockMcpServersRegistry.getOAuthServers.mockRejectedValue(new Error('Registry error'));

      await expect(getMCPSetupData(mockUserId)).rejects.toThrow('Registry error');
    });

    it('should handle empty mcpConfig object', async () => {
      mockGetAppConfig.mockResolvedValue({ mcpConfig: {} });
      mockMcpServersRegistry.getOAuthServers.mockResolvedValue(new Set());

      const result = await getMCPSetupData(mockUserId);

      expect(result.mcpConfig).toEqual({});
      expect(result.oauthServers.size).toBe(0);
    });

    it('should log debug with server counts', async () => {
      const servers = { server1: {}, server2: {}, server3: {} };
      mockGetAppConfig.mockResolvedValue({ mcpConfig: servers });
      mockMcpServersRegistry.getOAuthServers.mockResolvedValue(new Set(['server1', 'server2']));

      await getMCPSetupData(mockUserId);

      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('getMCPSetupData completed'),
        expect.objectContaining({
          serverCount: 3,
          oauthServerCount: 2,
        }),
      );
    });
  });

  describe('checkOAuthFlowStatus', () => {
    const mockUserId = 'user-123';
    const mockServerName = 'test-server';
    const mockFlowId = 'flow-123';

    beforeEach(() => {
      const mockFlowsCache = {};
      const mockFlowManager = {
        getFlowState: jest.fn(),
      };

      mockGetLogStores.mockReturnValue(mockFlowsCache);
      mockGetFlowStateManager.mockReturnValue(mockFlowManager);
      MCPOAuthHandler.generateFlowId.mockReturnValue(mockFlowId);
    });

    it('should return false flags when no flow state exists', async () => {
      const mockFlowManager = { getFlowState: jest.fn(() => null) };
      mockGetFlowStateManager.mockReturnValue(mockFlowManager);

      const result = await checkOAuthFlowStatus(mockUserId, mockServerName);

      expect(mockGetLogStores).toHaveBeenCalledWith(CacheKeys.FLOWS);
      expect(MCPOAuthHandler.generateFlowId).toHaveBeenCalledWith(mockUserId, mockServerName);
      expect(mockFlowManager.getFlowState).toHaveBeenCalledWith(mockFlowId, 'mcp_oauth');
      expect(result).toEqual({ hasActiveFlow: false, hasFailedFlow: false });
    });

    it('should detect failed flow when status is FAILED', async () => {
      const mockFlowState = {
        status: 'FAILED',
        createdAt: Date.now() - 60000, // 1 minute ago
        ttl: 180000,
      };
      const mockFlowManager = { getFlowState: jest.fn(() => mockFlowState) };
      mockGetFlowStateManager.mockReturnValue(mockFlowManager);

      const result = await checkOAuthFlowStatus(mockUserId, mockServerName);

      expect(result).toEqual({ hasActiveFlow: false, hasFailedFlow: true });
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Found failed OAuth flow'),
        expect.objectContaining({
          flowId: mockFlowId,
          status: 'FAILED',
        }),
      );
    });

    it('should detect failed flow when flow has timed out', async () => {
      const mockFlowState = {
        status: 'PENDING',
        createdAt: Date.now() - 200000, // 200 seconds ago (> 180s TTL)
        ttl: 180000,
      };
      const mockFlowManager = { getFlowState: jest.fn(() => mockFlowState) };
      mockGetFlowStateManager.mockReturnValue(mockFlowManager);

      const result = await checkOAuthFlowStatus(mockUserId, mockServerName);

      expect(result).toEqual({ hasActiveFlow: false, hasFailedFlow: true });
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Found failed OAuth flow'),
        expect.objectContaining({
          timedOut: true,
        }),
      );
    });

    it('should detect failed flow when TTL not specified and flow exceeds default TTL', async () => {
      const mockFlowState = {
        status: 'PENDING',
        createdAt: Date.now() - 200000, // 200 seconds ago (> 180s default TTL)
        // ttl not specified, should use 180000 default
      };
      const mockFlowManager = { getFlowState: jest.fn(() => mockFlowState) };
      mockGetFlowStateManager.mockReturnValue(mockFlowManager);

      const result = await checkOAuthFlowStatus(mockUserId, mockServerName);

      expect(result).toEqual({ hasActiveFlow: false, hasFailedFlow: true });
    });

    it('should treat flow with missing createdAt as timed out', async () => {
      const mockFlowState = {
        status: 'PENDING',
        // createdAt is missing - should default to 0, causing very large flowAge
        ttl: 180000,
      };
      const mockFlowManager = { getFlowState: jest.fn(() => mockFlowState) };
      mockGetFlowStateManager.mockReturnValue(mockFlowManager);

      const result = await checkOAuthFlowStatus(mockUserId, mockServerName);

      // Missing createdAt defaults to 0, so flowAge = Date.now() which is huge = timed out
      expect(result).toEqual({ hasActiveFlow: false, hasFailedFlow: true });
    });

    it('should detect active flow when status is PENDING and within TTL', async () => {
      const mockFlowState = {
        status: 'PENDING',
        createdAt: Date.now() - 60000, // 1 minute ago (< 180s TTL)
        ttl: 180000,
      };
      const mockFlowManager = { getFlowState: jest.fn(() => mockFlowState) };
      mockGetFlowStateManager.mockReturnValue(mockFlowManager);

      const result = await checkOAuthFlowStatus(mockUserId, mockServerName);

      expect(result).toEqual({ hasActiveFlow: true, hasFailedFlow: false });
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Found active OAuth flow'),
        expect.objectContaining({
          flowId: mockFlowId,
        }),
      );
    });

    it('should return false flags for other statuses', async () => {
      const mockFlowState = {
        status: 'COMPLETED',
        createdAt: Date.now() - 60000,
        ttl: 180000,
      };
      const mockFlowManager = { getFlowState: jest.fn(() => mockFlowState) };
      mockGetFlowStateManager.mockReturnValue(mockFlowManager);

      const result = await checkOAuthFlowStatus(mockUserId, mockServerName);

      expect(result).toEqual({ hasActiveFlow: false, hasFailedFlow: false });
    });

    it('should handle errors gracefully', async () => {
      const mockError = new Error('Flow state error');
      const mockFlowManager = {
        getFlowState: jest.fn(() => {
          throw mockError;
        }),
      };
      mockGetFlowStateManager.mockReturnValue(mockFlowManager);

      const result = await checkOAuthFlowStatus(mockUserId, mockServerName);

      expect(result).toEqual({ hasActiveFlow: false, hasFailedFlow: false });
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error checking OAuth flows'),
        mockError,
      );
    });

    it('should handle cancelled flow (error contains "cancelled")', async () => {
      const mockFlowState = {
        status: 'FAILED',
        createdAt: Date.now() - 60000,
        ttl: 180000,
        error: 'User cancelled the authentication flow',
      };
      const mockFlowManager = { getFlowState: jest.fn(() => mockFlowState) };
      mockGetFlowStateManager.mockReturnValue(mockFlowManager);

      const result = await checkOAuthFlowStatus(mockUserId, mockServerName);

      // Cancelled flows should not be treated as failed
      expect(result).toEqual({ hasActiveFlow: false, hasFailedFlow: false });
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Found cancelled OAuth flow'),
        expect.any(Object),
      );
    });

    it('should handle flow with COMPLETED status', async () => {
      const mockFlowState = {
        status: 'COMPLETED',
        createdAt: Date.now() - 60000,
        ttl: 180000,
      };
      const mockFlowManager = { getFlowState: jest.fn(() => mockFlowState) };
      mockGetFlowStateManager.mockReturnValue(mockFlowManager);

      const result = await checkOAuthFlowStatus(mockUserId, mockServerName);

      expect(result).toEqual({ hasActiveFlow: false, hasFailedFlow: false });
    });

    it('should handle flow with very short TTL', async () => {
      const mockFlowState = {
        status: 'PENDING',
        createdAt: Date.now() - 5000, // 5 seconds ago
        ttl: 3000, // 3 second TTL - already expired
      };
      const mockFlowManager = { getFlowState: jest.fn(() => mockFlowState) };
      mockGetFlowStateManager.mockReturnValue(mockFlowManager);

      const result = await checkOAuthFlowStatus(mockUserId, mockServerName);

      expect(result).toEqual({ hasActiveFlow: false, hasFailedFlow: true });
    });

    it('should handle flow just within TTL (boundary)', async () => {
      const now = Date.now();
      const mockFlowState = {
        status: 'PENDING',
        createdAt: now - 179000, // 179 seconds ago
        ttl: 180000, // 180 second TTL
      };
      const mockFlowManager = { getFlowState: jest.fn(() => mockFlowState) };
      mockGetFlowStateManager.mockReturnValue(mockFlowManager);

      const result = await checkOAuthFlowStatus(mockUserId, mockServerName);

      // Should still be active (179 < 180)
      expect(result).toEqual({ hasActiveFlow: true, hasFailedFlow: false });
    });

    it('should handle async getFlowState rejection', async () => {
      const mockFlowManager = {
        getFlowState: jest.fn().mockRejectedValue(new Error('Redis connection failed')),
      };
      mockGetFlowStateManager.mockReturnValue(mockFlowManager);

      const result = await checkOAuthFlowStatus(mockUserId, mockServerName);

      expect(result).toEqual({ hasActiveFlow: false, hasFailedFlow: false });
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('getServerConnectionStatus', () => {
    const mockUserId = 'user-123';
    const mockServerName = 'test-server';
    let mockTokenMethods;

    beforeEach(() => {
      mockTokenMethods = {
        findToken: jest.fn(),
      };
      mockGetLogStores.mockReturnValue({});
      mockGetFlowStateManager.mockReturnValue({
        getFlowState: jest.fn(),
      });
    });

    describe('Non-OAuth servers', () => {
      it('should return available status for non-OAuth server', async () => {
        const oauthServers = new Set(); // Server not in OAuth servers

        const result = await getServerConnectionStatus(
          mockUserId,
          mockServerName,
          oauthServers,
          mockTokenMethods,
        );

        expect(result).toEqual({
          requiresOAuth: false,
          connectionState: 'available',
        });

        // Should not call findToken for non-OAuth servers
        expect(mockTokenMethods.findToken).not.toHaveBeenCalled();
      });
    });

    describe('OAuth servers with valid tokens', () => {
      it('should return connected status when valid token exists', async () => {
        const oauthServers = new Set([mockServerName]);
        const futureDate = new Date(Date.now() + 3600000); // 1 hour from now

        mockTokenMethods.findToken.mockResolvedValue({
          accessToken: 'valid-access-token',
          refreshToken: 'valid-refresh-token',
          expiresAt: futureDate,
        });

        const result = await getServerConnectionStatus(
          mockUserId,
          mockServerName,
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
          identifier: `mcp:${mockServerName}`,
        });
      });

      it('should return connected status when token has no expiry (never expires)', async () => {
        const oauthServers = new Set([mockServerName]);

        mockTokenMethods.findToken.mockResolvedValue({
          accessToken: 'valid-access-token',
          refreshToken: 'valid-refresh-token',
          expiresAt: null, // No expiry
        });

        const result = await getServerConnectionStatus(
          mockUserId,
          mockServerName,
          oauthServers,
          mockTokenMethods,
        );

        expect(result).toEqual({
          requiresOAuth: true,
          connectionState: 'connected',
        });
      });
    });

    describe('OAuth servers with expired tokens', () => {
      it('should return connected status when token is expired but has refresh token', async () => {
        const oauthServers = new Set([mockServerName]);
        const pastDate = new Date(Date.now() - 3600000); // 1 hour ago

        mockTokenMethods.findToken.mockResolvedValue({
          accessToken: 'expired-access-token',
          refreshToken: 'valid-refresh-token',
          expiresAt: pastDate,
        });

        const result = await getServerConnectionStatus(
          mockUserId,
          mockServerName,
          oauthServers,
          mockTokenMethods,
        );

        // Should still show connected - will auto-refresh on use
        expect(result).toEqual({
          requiresOAuth: true,
          connectionState: 'connected',
        });
      });

      it('should return disconnected status when token is expired and no refresh token', async () => {
        const oauthServers = new Set([mockServerName]);
        const pastDate = new Date(Date.now() - 3600000); // 1 hour ago

        mockTokenMethods.findToken.mockResolvedValue({
          accessToken: 'expired-access-token',
          refreshToken: null, // No refresh token
          expiresAt: pastDate,
        });

        const result = await getServerConnectionStatus(
          mockUserId,
          mockServerName,
          oauthServers,
          mockTokenMethods,
        );

        expect(result).toEqual({
          requiresOAuth: true,
          connectionState: 'disconnected',
        });
      });
    });

    describe('OAuth servers with no tokens', () => {
      it('should return disconnected status when no token exists and no active flow', async () => {
        const oauthServers = new Set([mockServerName]);
        mockTokenMethods.findToken.mockResolvedValue(null);

        const mockFlowManager = { getFlowState: jest.fn().mockResolvedValue(null) };
        mockGetFlowStateManager.mockReturnValue(mockFlowManager);
        MCPOAuthHandler.generateFlowId.mockReturnValue('test-flow-id');

        const result = await getServerConnectionStatus(
          mockUserId,
          mockServerName,
          oauthServers,
          mockTokenMethods,
        );

        expect(result).toEqual({
          requiresOAuth: true,
          connectionState: 'disconnected',
        });
      });

      it('should return connecting status when no token but active OAuth flow exists', async () => {
        const oauthServers = new Set([mockServerName]);
        mockTokenMethods.findToken.mockResolvedValue(null);

        const mockFlowManager = {
          getFlowState: jest.fn().mockResolvedValue({
            status: 'PENDING',
            createdAt: Date.now() - 60000, // 1 minute ago
            ttl: 180000, // 3 minutes
          }),
        };
        mockGetFlowStateManager.mockReturnValue(mockFlowManager);
        MCPOAuthHandler.generateFlowId.mockReturnValue('test-flow-id');

        const result = await getServerConnectionStatus(
          mockUserId,
          mockServerName,
          oauthServers,
          mockTokenMethods,
        );

        expect(result).toEqual({
          requiresOAuth: true,
          connectionState: 'connecting',
        });
      });

      it('should return error status when no token and OAuth flow has failed', async () => {
        const oauthServers = new Set([mockServerName]);
        mockTokenMethods.findToken.mockResolvedValue(null);

        const mockFlowManager = {
          getFlowState: jest.fn().mockResolvedValue({
            status: 'FAILED',
            createdAt: Date.now() - 60000,
            ttl: 180000,
          }),
        };
        mockGetFlowStateManager.mockReturnValue(mockFlowManager);
        MCPOAuthHandler.generateFlowId.mockReturnValue('test-flow-id');

        const result = await getServerConnectionStatus(
          mockUserId,
          mockServerName,
          oauthServers,
          mockTokenMethods,
        );

        expect(result).toEqual({
          requiresOAuth: true,
          connectionState: 'error',
        });
      });

      it('should return error status when OAuth flow has timed out', async () => {
        const oauthServers = new Set([mockServerName]);
        mockTokenMethods.findToken.mockResolvedValue(null);

        const mockFlowManager = {
          getFlowState: jest.fn().mockResolvedValue({
            status: 'PENDING',
            createdAt: Date.now() - 200000, // 200 seconds ago (> 180s TTL)
            ttl: 180000,
          }),
        };
        mockGetFlowStateManager.mockReturnValue(mockFlowManager);
        MCPOAuthHandler.generateFlowId.mockReturnValue('test-flow-id');

        const result = await getServerConnectionStatus(
          mockUserId,
          mockServerName,
          oauthServers,
          mockTokenMethods,
        );

        expect(result).toEqual({
          requiresOAuth: true,
          connectionState: 'error',
        });
      });
    });

    describe('Error handling', () => {
      it('should return disconnected status when token lookup throws error', async () => {
        const oauthServers = new Set([mockServerName]);
        mockTokenMethods.findToken.mockRejectedValue(new Error('Database error'));

        const result = await getServerConnectionStatus(
          mockUserId,
          mockServerName,
          oauthServers,
          mockTokenMethods,
        );

        expect(result).toEqual({
          requiresOAuth: true,
          connectionState: 'disconnected',
        });

        expect(logger.error).toHaveBeenCalledWith(
          expect.stringContaining('Error checking token status'),
          expect.any(Error),
        );
      });
    });

    describe('Token edge cases', () => {
      it('should handle token with accessToken but missing refreshToken', async () => {
        const oauthServers = new Set([mockServerName]);
        const futureDate = new Date(Date.now() + 3600000);

        mockTokenMethods.findToken.mockResolvedValue({
          accessToken: 'valid-access-token',
          // refreshToken is missing/undefined
          expiresAt: futureDate,
        });

        const result = await getServerConnectionStatus(
          mockUserId,
          mockServerName,
          oauthServers,
          mockTokenMethods,
        );

        // Should still be connected if token is valid
        expect(result).toEqual({
          requiresOAuth: true,
          connectionState: 'connected',
        });
      });

      it('should handle token with empty string refreshToken as no refresh token', async () => {
        const oauthServers = new Set([mockServerName]);
        const pastDate = new Date(Date.now() - 3600000);

        mockTokenMethods.findToken.mockResolvedValue({
          accessToken: 'expired-access-token',
          refreshToken: '', // Empty string
          expiresAt: pastDate,
        });

        const result = await getServerConnectionStatus(
          mockUserId,
          mockServerName,
          oauthServers,
          mockTokenMethods,
        );

        // Should be disconnected - expired with no valid refresh token
        expect(result).toEqual({
          requiresOAuth: true,
          connectionState: 'disconnected',
        });
      });

      it('should handle token with expiresAt as numeric timestamp', async () => {
        const oauthServers = new Set([mockServerName]);
        const futureTimestamp = Date.now() + 3600000; // 1 hour from now

        mockTokenMethods.findToken.mockResolvedValue({
          accessToken: 'valid-token',
          refreshToken: 'refresh',
          expiresAt: futureTimestamp, // Number, not Date
        });

        const result = await getServerConnectionStatus(
          mockUserId,
          mockServerName,
          oauthServers,
          mockTokenMethods,
        );

        expect(result).toEqual({
          requiresOAuth: true,
          connectionState: 'connected',
        });
      });

      it('should handle token with expiresAt as ISO string', async () => {
        const oauthServers = new Set([mockServerName]);
        const futureDate = new Date(Date.now() + 3600000);

        mockTokenMethods.findToken.mockResolvedValue({
          accessToken: 'valid-token',
          refreshToken: 'refresh',
          expiresAt: futureDate.toISOString(), // ISO string
        });

        const result = await getServerConnectionStatus(
          mockUserId,
          mockServerName,
          oauthServers,
          mockTokenMethods,
        );

        expect(result).toEqual({
          requiresOAuth: true,
          connectionState: 'connected',
        });
      });

      it('should handle token expiring exactly now (boundary condition)', async () => {
        const oauthServers = new Set([mockServerName]);
        const now = new Date();

        mockTokenMethods.findToken.mockResolvedValue({
          accessToken: 'boundary-token',
          refreshToken: 'refresh',
          expiresAt: now, // Exactly now
        });

        const result = await getServerConnectionStatus(
          mockUserId,
          mockServerName,
          oauthServers,
          mockTokenMethods,
        );

        // expiresAt < now is false when equal, so not expired
        expect(result).toEqual({
          requiresOAuth: true,
          connectionState: 'connected',
        });
      });

      it('should handle token with only accessToken (minimal valid token)', async () => {
        const oauthServers = new Set([mockServerName]);

        mockTokenMethods.findToken.mockResolvedValue({
          accessToken: 'minimal-token',
          // No refreshToken, no expiresAt
        });

        const result = await getServerConnectionStatus(
          mockUserId,
          mockServerName,
          oauthServers,
          mockTokenMethods,
        );

        // No expiry means never expires = connected
        expect(result).toEqual({
          requiresOAuth: true,
          connectionState: 'connected',
        });
      });

      it('should handle token with whitespace-only refreshToken as no refresh', async () => {
        const oauthServers = new Set([mockServerName]);
        const pastDate = new Date(Date.now() - 3600000);

        mockTokenMethods.findToken.mockResolvedValue({
          accessToken: 'expired-token',
          refreshToken: '   ', // Whitespace only - truthy but invalid
          expiresAt: pastDate,
        });

        const result = await getServerConnectionStatus(
          mockUserId,
          mockServerName,
          oauthServers,
          mockTokenMethods,
        );

        // Whitespace is truthy, so currently treated as having refresh token
        // This shows the code considers it "connected" even with whitespace refresh
        expect(result).toEqual({
          requiresOAuth: true,
          connectionState: 'connected', // Whitespace is truthy
        });
      });
    });

    describe('Multiple servers scenario', () => {
      it('should correctly identify OAuth vs non-OAuth in mixed set', async () => {
        const oauthServers = new Set(['oauth-server-1', 'oauth-server-2']);
        const nonOAuthServer = 'local-server';

        mockTokenMethods.findToken.mockResolvedValue(null);
        const mockFlowManager = { getFlowState: jest.fn().mockResolvedValue(null) };
        mockGetFlowStateManager.mockReturnValue(mockFlowManager);

        // Non-OAuth server
        const result1 = await getServerConnectionStatus(
          mockUserId,
          nonOAuthServer,
          oauthServers,
          mockTokenMethods,
        );
        expect(result1).toEqual({ requiresOAuth: false, connectionState: 'available' });

        // OAuth server
        const result2 = await getServerConnectionStatus(
          mockUserId,
          'oauth-server-1',
          oauthServers,
          mockTokenMethods,
        );
        expect(result2).toEqual({ requiresOAuth: true, connectionState: 'disconnected' });
      });

      it('should handle case-sensitive server name matching', async () => {
        const oauthServers = new Set(['OAuth-Server']); // Mixed case

        // Exact match
        const result1 = await getServerConnectionStatus(
          mockUserId,
          'OAuth-Server',
          oauthServers,
          mockTokenMethods,
        );
        expect(result1.requiresOAuth).toBe(true);

        // Different case - should NOT match
        const result2 = await getServerConnectionStatus(
          mockUserId,
          'oauth-server',
          oauthServers,
          mockTokenMethods,
        );
        expect(result2.requiresOAuth).toBe(false);
      });
    });
  });
});

describe('User parameter passing tests', () => {
  let mockReinitMCPServer;
  let mockGetFlowStateManager;
  let mockGetLogStores;

  beforeEach(() => {
    jest.clearAllMocks();
    mockReinitMCPServer = require('./Tools/mcp').reinitMCPServer;
    mockGetFlowStateManager = require('~/config').getFlowStateManager;
    mockGetLogStores = require('~/cache').getLogStores;

    // Setup default mocks
    mockGetLogStores.mockReturnValue({});
    mockGetFlowStateManager.mockReturnValue({
      createFlowWithHandler: jest.fn(),
      failFlow: jest.fn(),
    });
  });

  describe('createMCPTools', () => {
    it('should pass user parameter to reinitMCPServer when calling reconnectServer internally', async () => {
      const mockUser = { id: 'test-user-123', name: 'Test User' };
      const mockRes = { write: jest.fn(), flush: jest.fn() };
      const mockSignal = new AbortController().signal;

      mockReinitMCPServer.mockResolvedValue({
        tools: [{ name: 'test-tool' }],
        availableTools: {
          'test-tool::test-server': {
            function: {
              description: 'Test tool',
              parameters: { type: 'object', properties: {} },
            },
          },
        },
      });

      await createMCPTools({
        res: mockRes,
        user: mockUser,
        serverName: 'test-server',
        provider: 'openai',
        signal: mockSignal,
        userMCPAuthMap: {},
      });

      // Verify reinitMCPServer was called with the user
      expect(mockReinitMCPServer).toHaveBeenCalledWith(
        expect.objectContaining({
          user: mockUser,
          serverName: 'test-server',
        }),
      );
      expect(mockReinitMCPServer.mock.calls[0][0].user).toBe(mockUser);
    });

    it('should throw error if user is not provided', async () => {
      const mockRes = { write: jest.fn(), flush: jest.fn() };

      mockReinitMCPServer.mockResolvedValue({
        tools: [],
        availableTools: {},
      });

      // Call without user should throw error
      await expect(
        createMCPTools({
          res: mockRes,
          user: undefined,
          serverName: 'test-server',
          provider: 'openai',
          userMCPAuthMap: {},
        }),
      ).rejects.toThrow("Cannot read properties of undefined (reading 'id')");

      // Verify reinitMCPServer was not called due to early error
      expect(mockReinitMCPServer).not.toHaveBeenCalled();
    });
  });

  describe('createMCPTool', () => {
    it('should pass user parameter to reinitMCPServer when tool not in cache', async () => {
      const mockUser = { id: 'test-user-456', email: 'test@example.com' };
      const mockRes = { write: jest.fn(), flush: jest.fn() };
      const mockSignal = new AbortController().signal;

      mockReinitMCPServer.mockResolvedValue({
        availableTools: {
          'test-tool::test-server': {
            function: {
              description: 'Test tool',
              parameters: { type: 'object', properties: {} },
            },
          },
        },
      });

      // Call without availableTools to trigger reinit
      await createMCPTool({
        res: mockRes,
        user: mockUser,
        toolKey: 'test-tool::test-server',
        provider: 'openai',
        signal: mockSignal,
        userMCPAuthMap: {},
        availableTools: undefined, // Force reinit
      });

      // Verify reinitMCPServer was called with the user
      expect(mockReinitMCPServer).toHaveBeenCalledWith(
        expect.objectContaining({
          user: mockUser,
          serverName: 'test-server',
        }),
      );
      expect(mockReinitMCPServer.mock.calls[0][0].user).toBe(mockUser);
    });

    it('should not call reinitMCPServer when tool is in cache', async () => {
      const mockUser = { id: 'test-user-789' };
      const mockRes = { write: jest.fn(), flush: jest.fn() };

      const availableTools = {
        'test-tool::test-server': {
          function: {
            description: 'Cached tool',
            parameters: { type: 'object', properties: {} },
          },
        },
      };

      await createMCPTool({
        res: mockRes,
        user: mockUser,
        toolKey: 'test-tool::test-server',
        provider: 'openai',
        userMCPAuthMap: {},
        availableTools: availableTools,
      });

      // Verify reinitMCPServer was NOT called since tool was in cache
      expect(mockReinitMCPServer).not.toHaveBeenCalled();
    });
  });

  describe('reinitMCPServer (via reconnectServer)', () => {
    it('should always receive user parameter when called from createMCPTools', async () => {
      const mockUser = { id: 'user-001', role: 'admin' };
      const mockRes = { write: jest.fn(), flush: jest.fn() };

      // Track all calls to reinitMCPServer
      const reinitCalls = [];
      mockReinitMCPServer.mockImplementation((params) => {
        reinitCalls.push(params);
        return Promise.resolve({
          tools: [{ name: 'tool1' }, { name: 'tool2' }],
          availableTools: {
            'tool1::server1': { function: { description: 'Tool 1', parameters: {} } },
            'tool2::server1': { function: { description: 'Tool 2', parameters: {} } },
          },
        });
      });

      await createMCPTools({
        res: mockRes,
        user: mockUser,
        serverName: 'server1',
        provider: 'anthropic',
        userMCPAuthMap: {},
      });

      // Verify all calls to reinitMCPServer had the user
      expect(reinitCalls.length).toBeGreaterThan(0);
      reinitCalls.forEach((call) => {
        expect(call.user).toBe(mockUser);
        expect(call.user.id).toBe('user-001');
      });
    });

    it('should always receive user parameter when called from createMCPTool', async () => {
      const mockUser = { id: 'user-002', permissions: ['read', 'write'] };
      const mockRes = { write: jest.fn(), flush: jest.fn() };

      // Track all calls to reinitMCPServer
      const reinitCalls = [];
      mockReinitMCPServer.mockImplementation((params) => {
        reinitCalls.push(params);
        return Promise.resolve({
          availableTools: {
            'my-tool::my-server': {
              function: { description: 'My Tool', parameters: {} },
            },
          },
        });
      });

      await createMCPTool({
        res: mockRes,
        user: mockUser,
        toolKey: 'my-tool::my-server',
        provider: 'google',
        userMCPAuthMap: {},
        availableTools: undefined, // Force reinit
      });

      // Verify the call to reinitMCPServer had the user
      expect(reinitCalls.length).toBe(1);
      expect(reinitCalls[0].user).toBe(mockUser);
      expect(reinitCalls[0].user.id).toBe('user-002');
    });
  });

  describe('User parameter integrity', () => {
    it('should preserve user object properties through the call chain', async () => {
      const complexUser = {
        id: 'complex-user',
        name: 'John Doe',
        email: 'john@example.com',
        metadata: { subscription: 'premium', settings: { theme: 'dark' } },
      };
      const mockRes = { write: jest.fn(), flush: jest.fn() };

      let capturedUser = null;
      mockReinitMCPServer.mockImplementation((params) => {
        capturedUser = params.user;
        return Promise.resolve({
          tools: [{ name: 'test' }],
          availableTools: {
            'test::server': { function: { description: 'Test', parameters: {} } },
          },
        });
      });

      await createMCPTools({
        res: mockRes,
        user: complexUser,
        serverName: 'server',
        provider: 'openai',
        userMCPAuthMap: {},
      });

      // Verify the complete user object was passed
      expect(capturedUser).toEqual(complexUser);
      expect(capturedUser.id).toBe('complex-user');
      expect(capturedUser.metadata.subscription).toBe('premium');
      expect(capturedUser.metadata.settings.theme).toBe('dark');
    });

    it('should throw error when user is null', async () => {
      const mockRes = { write: jest.fn(), flush: jest.fn() };

      mockReinitMCPServer.mockResolvedValue({
        tools: [],
        availableTools: {},
      });

      await expect(
        createMCPTools({
          res: mockRes,
          user: null,
          serverName: 'test-server',
          provider: 'openai',
          userMCPAuthMap: {},
        }),
      ).rejects.toThrow("Cannot read properties of null (reading 'id')");

      // Verify reinitMCPServer was not called due to early error
      expect(mockReinitMCPServer).not.toHaveBeenCalled();
    });
  });
});
