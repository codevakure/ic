/**
 * Admin API Service
 * 
 * API calls for admin dashboard functionality.
 */
import axios from 'axios';

const BASE_URL = '/api/admin';

// Generic fetch wrapper with error handling using axios (to leverage global auth headers)
async function adminFetch<T>(endpoint: string, options?: { method?: string; body?: string }): Promise<T> {
  try {
    const config: { method: string; url: string; data?: unknown; headers?: Record<string, string> } = {
      method: options?.method || 'GET',
      url: `${BASE_URL}${endpoint}`,
    };

    if (options?.body) {
      config.data = JSON.parse(options.body);
    }

    const response = await axios(config);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const message = error.response?.data?.message || error.message || 'An error occurred';
      throw new Error(message);
    }
    throw error;
  }
}

// Dashboard Metrics
export interface DashboardOverview {
  users: {
    total: number;
    today: number;
    thisWeek: number;
    thisMonth: number;
    activeToday: number;
    activeThisWeek: number;
  };
  conversations: {
    total: number;
    today: number;
    thisWeek: number;
    thisMonth: number;
  };
  messages: {
    total: number;
    today: number;
    thisWeek: number;
  };
  tokens: {
    today: number;
    thisWeek: number;
    thisMonth: number;
    input: number;
    output: number;
    totalCost: number;
  };
  agents: {
    total: number;
  };
  activeSessions: number;
  totalFiles: number;
  generatedAt: string;
}

export interface UserMetrics {
  total: number;
  byRole: { role: string; count: number }[];
  byProvider: { provider: string; count: number }[];
  registrationTrend: { date: string; count: number }[];
  topUsers: { user: { _id: string; name: string; email: string }; count: number }[];
}

export interface ConversationMetrics {
  startDate: string;
  endDate: string;
  summary: {
    total: number;
    newInPeriod: number;
    avgMessagesPerConversation: number | string;
    maxMessagesInConversation: number;
  };
  trend: { date: string; count: number }[];
  byEndpoint: { endpoint: string; count: number }[];
  byModel: { model: string; count: number }[];
  generatedAt: string;
}

export interface TokenMetrics {
  startDate: string;
  endDate: string;
  summary: {
    totalInputTokens: number;
    totalOutputTokens: number;
    totalCacheWriteTokens: number;
    totalCacheReadTokens: number;
    totalTokens: number;
    totalInputCost: number;
    totalOutputCost: number;
    totalCacheWriteCost: number;
    totalCacheReadCost: number;
    totalCost: number;
    totalCacheSavings: number;
    totalTransactions: number;
    totalDuration?: number;
  };
  trend: {
    date: string;
    inputTokens: number;
    outputTokens: number;
    transactions: number;
  }[];
  byModel: {
    model: string;
    name: string;
    inputTokens: number;
    outputTokens: number;
    cacheWriteTokens: number;
    cacheReadTokens: number;
    totalTokens: number;
    inputCost: number;
    outputCost: number;
    cacheWriteCost: number;
    cacheReadCost: number;
    totalInputCost: number;
    totalCost: number;
    cacheSavings: number;
    transactions: number;
    totalDuration?: number;
    avgDuration?: number;
  }[];
  topUsers: {
    userId: string;
    email?: string;
    name?: string;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    totalCost: number;
    transactions: number;
  }[];
  generatedAt: string;
  // Legacy fields for backward compatibility
  totalTokens?: number;
  totalCost?: number;
}

export interface ModelMetrics {
  usage: { model: string; count: number; tokens: number }[];
  popular: { model: string; users: number }[];
}

export interface AgentMetrics {
  startDate: string;
  endDate: string;
  summary: {
    total: number;
    public: number;
    private: number;
  };
  agents: {
    agentId: string;
    name: string;
    description?: string;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    inputCost: number;
    outputCost: number;
    totalCost: number;
    transactions: number;
    userCount: number;
    conversationCount?: number;
  }[];
  generatedAt: string;
}

// CostsMetrics is the same as TokenMetrics (same backend endpoint)
export type CostsMetrics = TokenMetrics;

export interface ToolUsage {
  toolName: string;
  displayName: string;
  category: string;
  invocations: number;
  successCount: number;
  errorCount: number;
  avgDuration: number;
  userCount: number;
  conversationCount: number;
}

export interface ToolMetrics {
  startDate: string | null;
  endDate: string | null;
  tools: ToolUsage[];
  trend: { date: string; count: number }[];
  summary: {
    totalInvocations: number;
    totalTools: number;
    avgSuccessRate: number;
    mostUsedTool: string;
  };
  generatedAt: string;
}

export interface GuardrailsMetrics {
  startDate: string | null;
  endDate: string | null;
  summary: {
    totalEvents: number;
    blocked: number;
    intervened: number;
    anonymized: number;
    passed: number;
    userCount: number;
    conversationCount: number;
    blockRate: number | string;
  };
  outcomes: {
    blocked: number;
    intervened: number;
    anonymized: number;
    passed: number;
  };
  violations: { type: string; category: string; count: number }[];
  violationBreakdown?: { type: string; blocked: number; intervened: number; anonymized: number; total: number }[];
  trend: { date: string; total: number; blocked: number; intervened: number; anonymized: number }[];
  generatedAt: string;
}

export interface ActivityTimeline {
  timeline: { date: string; conversations: number; messages: number; users: number }[];
}

export interface HourlyActivity {
  timezone: string;
  hourlyData: {
    hour: number;
    label: string;
    conversations: number;
    messages: number;
    sessions: number;
    activeUsers: number;
  }[];
  totals: {
    conversations: number;
    messages: number;
    sessions: number;
    peakActiveUsers: number;
  };
  generatedAt: string;
}

export interface DateRangeParams {
  startDate?: string;
  endDate?: string;
}

export const dashboardApi = {
  getOverview: (params: DateRangeParams = {}) => {
    const query = new URLSearchParams();
    if (params.startDate) query.set('startDate', params.startDate);
    if (params.endDate) query.set('endDate', params.endDate);
    const queryStr = query.toString();
    return adminFetch<DashboardOverview>(`/dashboard/overview${queryStr ? `?${queryStr}` : ''}`);
  },
  getUserMetrics: (params: DateRangeParams = {}) => {
    const query = new URLSearchParams();
    if (params.startDate) query.set('startDate', params.startDate);
    if (params.endDate) query.set('endDate', params.endDate);
    const queryStr = query.toString();
    return adminFetch<UserMetrics>(`/dashboard/users${queryStr ? `?${queryStr}` : ''}`);
  },
  getConversationMetrics: (params: DateRangeParams = {}) => {
    const query = new URLSearchParams();
    if (params.startDate) query.set('startDate', params.startDate);
    if (params.endDate) query.set('endDate', params.endDate);
    const queryStr = query.toString();
    return adminFetch<ConversationMetrics>(`/dashboard/conversations${queryStr ? `?${queryStr}` : ''}`);
  },
  getTokenMetrics: (params: DateRangeParams = {}) => {
    const query = new URLSearchParams();
    if (params.startDate) query.set('startDate', params.startDate);
    if (params.endDate) query.set('endDate', params.endDate);
    const queryStr = query.toString();
    return adminFetch<TokenMetrics>(`/dashboard/tokens${queryStr ? `?${queryStr}` : ''}`);
  },
  getModelMetrics: (params: DateRangeParams = {}) => {
    const query = new URLSearchParams();
    if (params.startDate) query.set('startDate', params.startDate);
    if (params.endDate) query.set('endDate', params.endDate);
    const queryStr = query.toString();
    return adminFetch<ModelMetrics>(`/dashboard/models${queryStr ? `?${queryStr}` : ''}`);
  },
  getAgentMetrics: (params: DateRangeParams = {}) => {
    const query = new URLSearchParams();
    if (params.startDate) query.set('startDate', params.startDate);
    if (params.endDate) query.set('endDate', params.endDate);
    const queryStr = query.toString();
    return adminFetch<AgentMetrics>(`/dashboard/agents${queryStr ? `?${queryStr}` : ''}`);
  },
  // Get all agents list (no date filtering - returns all agents in database)
  getAllAgents: () => {
    return adminFetch<{ agents: Array<{ agentId: string; name: string; description?: string; isPublic: boolean }>; total: number }>(`/dashboard/agents/all`);
  },
  // Fast summary endpoint - just counts, no detailed list
  getAgentSummary: (params: DateRangeParams = {}) => {
    const query = new URLSearchParams();
    if (params.startDate) query.set('startDate', params.startDate);
    if (params.endDate) query.set('endDate', params.endDate);
    const queryStr = query.toString();
    return adminFetch<{ summary: { total: number; public: number; private: number; active: number }; generatedAt: string }>(`/dashboard/agents/summary${queryStr ? `?${queryStr}` : ''}`);
  },
  getCostsMetrics: (params: DateRangeParams = {}) => {
    const query = new URLSearchParams();
    if (params.startDate) query.set('startDate', params.startDate);
    if (params.endDate) query.set('endDate', params.endDate);
    const queryStr = query.toString();
    return adminFetch<CostsMetrics>(`/dashboard/costs${queryStr ? `?${queryStr}` : ''}`);
  },
  getToolMetrics: (params: DateRangeParams = {}) => {
    const query = new URLSearchParams();
    if (params.startDate) query.set('startDate', params.startDate);
    if (params.endDate) query.set('endDate', params.endDate);
    const queryStr = query.toString();
    return adminFetch<ToolMetrics>(`/dashboard/tools${queryStr ? `?${queryStr}` : ''}`);
  },
  // Fast summary endpoint - just counts, no detailed tool list
  getToolSummary: (params: DateRangeParams = {}) => {
    const query = new URLSearchParams();
    if (params.startDate) query.set('startDate', params.startDate);
    if (params.endDate) query.set('endDate', params.endDate);
    const queryStr = query.toString();
    return adminFetch<{ summary: { totalInvocations: number; totalTools: number; avgSuccessRate: number; mostUsedTool: string }; generatedAt: string }>(`/dashboard/tools/summary${queryStr ? `?${queryStr}` : ''}`);
  },
  getGuardrailsMetrics: (params: DateRangeParams = {}) => {
    const query = new URLSearchParams();
    if (params.startDate) query.set('startDate', params.startDate);
    if (params.endDate) query.set('endDate', params.endDate);
    const queryStr = query.toString();
    return adminFetch<GuardrailsMetrics>(`/dashboard/guardrails${queryStr ? `?${queryStr}` : ''}`);
  },
  // Fast summary endpoint - just counts, no detailed breakdown
  getGuardrailsSummary: (params: DateRangeParams = {}) => {
    const query = new URLSearchParams();
    if (params.startDate) query.set('startDate', params.startDate);
    if (params.endDate) query.set('endDate', params.endDate);
    const queryStr = query.toString();
    return adminFetch<{ summary: { totalEvents: number; blocked: number; intervened: number; anonymized: number; passed: number; userCount: number; conversationCount: number; blockRate: number | string }; generatedAt: string }>(`/dashboard/guardrails/summary${queryStr ? `?${queryStr}` : ''}`);
  },
  getActivityTimeline: (days?: number) =>
    adminFetch<ActivityTimeline>(`/dashboard/activity${days ? `?days=${days}` : ''}`),
  getHourlyActivity: (timezone?: string) =>
    adminFetch<HourlyActivity>(`/dashboard/hourly${timezone ? `?timezone=${timezone}` : ''}`),
};

// Groups Management API
export interface AdminGroup {
  _id: string;
  name: string;
  description?: string;
  source: 'local' | 'entra';
  memberCount: number;
  userCount: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface GroupsResponse {
  groups: AdminGroup[];
  total: number;
  generatedAt: string;
}

export interface AgentGroupAssociation {
  _id: string;
  name: string;
  source: 'local' | 'entra';
}

export const groupsApi = {
  getGroups: () => adminFetch<GroupsResponse>('/groups'),
  createGroup: (data: { name: string; description?: string }) =>
    adminFetch<AdminGroup>('/groups', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateGroup: (groupId: string, data: { name?: string; description?: string }) =>
    adminFetch<AdminGroup>(`/groups/${groupId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteGroup: (groupId: string) =>
    adminFetch<{ success: boolean; deletedGroup: string }>(`/groups/${groupId}`, {
      method: 'DELETE',
    }),
  getAgentGroupAssociations: () =>
    adminFetch<Record<string, AgentGroupAssociation[]>>('/agents/groups'),
};

// Agent Detail Types
export interface AgentDetail {
  agent: {
    id: string;
    _id: string;
    name: string;
    description?: string;
    isPublic: boolean;
    author?: string;
    createdAt: string;
    updatedAt?: string;
  };
  stats: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    inputCost: number;
    outputCost: number;
    totalCost: number;
    transactions: number;
    conversationCount: number;
    userCount: number;
  };
  usageByDay: Array<{
    date: string;
    inputTokens: number;
    outputTokens: number;
    inputCost: number;
    outputCost: number;
  }>;
  groups: Array<{
    _id: string;
    name: string;
    description?: string;
    source: string;
    memberCount: number;
  }>;
  users: Array<{
    _id: string;
    name: string;
    email: string;
    username?: string;
    avatar?: string;
  }>;
}

// Conversation message type for agent conversations (reuses same structure as user conversations)
export interface AgentConversationMessage {
  messageId: string;
  text: string;
  sender: string;
  isCreatedByUser: boolean;
  model?: string;
  createdAt: string;
  tokenCount?: number;
  error?: boolean;
  isError?: boolean;
  errorMessage?: string | null;
}

export interface AgentConversation {
  _id?: string;
  conversationId: string;
  title: string;
  user: {
    _id: string;
    name: string;
    email: string;
    avatar?: string;
  } | null;
  endpoint: string;
  model: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  errorCount?: number;
  hasErrors?: boolean;
  messages: AgentConversationMessage[];
}

export interface AgentConversationsResponse {
  conversations: AgentConversation[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    hasNext: boolean;
    totalPages: number;
  };
}

// Agent Detail API
export const agentDetailApi = {
  getAgentDetail: (agentId: string) => 
    adminFetch<AgentDetail>(`/agents/${agentId}`),
  getAgentConversations: (agentId: string, page = 1, limit = 20) =>
    adminFetch<AgentConversationsResponse>(`/agents/${agentId}/conversations?page=${page}&limit=${limit}`),
  getConversationMessages: (conversationId: string) =>
    adminFetch<{ messages: AgentConversation['messages'] }>(`/conversations/${conversationId}/messages`),
  updateAgentAccess: (agentId: string, access: { groups: string[]; users: string[] }) =>
    adminFetch<{ success: boolean; changes: { groupsAdded: number; groupsRemoved: number; usersAdded: number; usersRemoved: number } }>(`/agents/${agentId}/access`, {
      method: 'PUT',
      body: JSON.stringify(access),
    }),
};

// User Management
export interface UserListParams {
  page?: number;
  limit?: number;
  search?: string;
  role?: string;
  status?: 'active' | 'banned' | '';
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  group?: string; // OIDC group filter
}

export interface User {
  _id: string;
  name: string;
  username: string;
  email: string;
  avatar?: string;
  role: string;
  provider: string;
  createdAt: string;
  updatedAt?: string;
  banned?: boolean;
  banReason?: string;
  balance?: number;
  conversationCount?: number;
  messageCount?: number;
  // Token usage fields (populated by admin list endpoint)
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  totalCost?: number;
  // OIDC groups assigned to the user
  oidcGroups?: string[];
}

export interface UserListResponse {
  users: User[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface ActiveUser extends User {
  sessionCount: number;
  latestSession: string;
  earliestSession: string;
}

export interface UserStats {
  user: User;
  stats: {
    conversations: number;
    messages: number;
    balance: number;
    tokens: {
      totalTokens: number;
      totalCost: number;
      transactionCount: number;
    };
  };
  breakdowns: {
    byEndpoint: { endpoint: string; count: number }[];
    byModel: { model: string; count: number }[];
  };
  activityTimeline: { date: string; count: number }[];
  recentConversations: {
    conversationId: string;
    title: string;
    endpoint: string;
    model: string;
    createdAt: string;
    updatedAt: string;
  }[];
}

export interface UserSession {
  id: string;
  expiration: string;
  isActive: boolean;
}

export interface UserSessionsResponse {
  activeSessions: UserSession[];
  activeCount: number;
}

export interface Transaction {
  _id: string;
  tokenType: string;
  rawAmount: number;
  tokenValue?: number;
  model?: string;
  context?: string;
  createdAt: string;
}

export interface UserTransactionsResponse {
  transactions: Transaction[];
  summary: Record<string, { totalAmount: number; count: number }>;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  dateRange?: {
    startDate: string | null;
    endDate: string | null;
  };
}

export interface UserUsageResponse {
  userId: string;
  totals: {
    inputTokens: number;
    outputTokens: number;
    inputCost: number;
    outputCost: number;
    totalCost: number;
    transactionCount: number;
  };
  byModel: {
    model: string;
    modelName: string;
    inputTokens: number;
    outputTokens: number;
    inputCost: number;
    outputCost: number;
    totalCost: number;
    transactionCount: number;
  }[];
  dateRange: {
    startDate: string | null;
    endDate: string | null;
  };
  generatedAt: string;
}

export const usersApi = {
  list: (params: UserListParams = {}) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        query.set(key, String(value));
      }
    });
    return adminFetch<UserListResponse>(`/users?${query.toString()}`);
  },

  getActiveUsers: (params: { page?: number; limit?: number } = {}) => {
    const query = new URLSearchParams();
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));
    return adminFetch<{ users: ActiveUser[]; pagination: UserListResponse['pagination'] }>(
      `/users/active?${query.toString()}`
    );
  },

  getById: (userId: string) => adminFetch<User>(`/users/${userId}`),
  getUser: (userId: string) => adminFetch<User>(`/users/${userId}`),

  getStats: (userId: string) => adminFetch<UserStats>(`/users/${userId}/stats`),

  getSessions: (userId: string) => adminFetch<UserSessionsResponse>(`/users/${userId}/sessions`),

  getTransactions: (userId: string, params: { page?: number; limit?: number; startDate?: string; endDate?: string } = {}) => {
    const query = new URLSearchParams();
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));
    if (params.startDate) query.set('startDate', params.startDate);
    if (params.endDate) query.set('endDate', params.endDate);
    return adminFetch<UserTransactionsResponse>(`/users/${userId}/transactions?${query.toString()}`);
  },

  getUsage: (userId: string, params: { startDate?: string; endDate?: string } = {}) => {
    const query = new URLSearchParams();
    if (params.startDate) query.set('startDate', params.startDate);
    if (params.endDate) query.set('endDate', params.endDate);
    const queryStr = query.toString();
    return adminFetch<UserUsageResponse>(`/users/${userId}/usage${queryStr ? `?${queryStr}` : ''}`);
  },

  update: (userId: string, data: Partial<User>) =>
    adminFetch<{ message: string; user: User }>(`/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  updateRole: (userId: string, role: string) =>
    adminFetch<{ message: string; user: User }>(`/users/${userId}/role`, {
      method: 'PUT',
      body: JSON.stringify({ role }),
    }),

  updateUserRole: (userId: string, role: string) =>
    adminFetch<{ message: string; user: User }>(`/users/${userId}/role`, {
      method: 'PUT',
      body: JSON.stringify({ role }),
    }),

  toggleBan: (userId: string, banned: boolean, reason?: string) =>
    adminFetch<{ message: string; user: User }>(`/users/${userId}/ban`, {
      method: 'PUT',
      body: JSON.stringify({ banned, reason }),
    }),

  banUser: (userId: string, banned: boolean, reason?: string) =>
    adminFetch<{ message: string; user: User }>(`/users/${userId}/ban`, {
      method: 'PUT',
      body: JSON.stringify({ banned, reason }),
    }),

  delete: (userId: string, deleteData = true) =>
    adminFetch<{ message: string }>(`/users/${userId}?deleteData=${deleteData}`, {
      method: 'DELETE',
    }),

  deleteUser: (userId: string, deleteData = true) =>
    adminFetch<{ message: string }>(`/users/${userId}?deleteData=${deleteData}`, {
      method: 'DELETE',
    }),

  terminateSession: (userId: string, sessionId: string) =>
    adminFetch<{ message: string }>(`/users/${userId}/sessions/${sessionId}`, {
      method: 'DELETE',
    }),

  terminateAllUserSessions: (userId: string) =>
    adminFetch<{ message: string; deletedCount: number }>(`/users/${userId}/sessions`, {
      method: 'DELETE',
    }),

  clearAllSessions: () =>
    adminFetch<{ message: string; deletedCount: number }>(`/users/active/sessions`, {
      method: 'DELETE',
    }),

  clearAllBans: () =>
    adminFetch<{ message: string; success: boolean; clearedFromLogs: number; unbannedUsers: number }>(`/bans`, {
      method: 'DELETE',
    }),

  updateOidcGroups: (userId: string, oidcGroups: string[]) =>
    adminFetch<{ message: string; user: User }>(`/users/${userId}/oidc-groups`, {
      method: 'PUT',
      body: JSON.stringify({ oidcGroups }),
    }),
};

// Active Users API (for ActiveUsersPage)
export const activeUsersApi = {
  getActiveUsers: (params?: { startDate?: string; endDate?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.startDate) searchParams.set('startDate', params.startDate);
    if (params?.endDate) searchParams.set('endDate', params.endDate);
    const queryString = searchParams.toString();
    return adminFetch<{ 
      sessions: Array<{
        sessionId: string;
        userId: string;
        user: { id: string; name: string; email: string; avatar?: string; role: string };
        startTime: string;
        lastActivity: string;
        ipAddress?: string;
        userAgent?: string;
        conversationCount?: number;
        messageCount?: number;
        sessionCount?: number; // Number of active sessions for this user
        sessionsCreatedToday?: number; // Sessions created in date range
        isOnline?: boolean;
      }>;
      summary: {
        totalActiveSessions: number;
        uniqueActiveUsers: number;
        averageSessionDuration?: number;
        sessionsToday?: number; // Sessions created in date range
      };
    }>(`/users/active/sessions${queryString ? `?${queryString}` : ''}`);
  },
  
  getMicrosoftSessions: (params?: { startDate?: string; endDate?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.startDate) searchParams.set('startDate', params.startDate);
    if (params?.endDate) searchParams.set('endDate', params.endDate);
    const queryString = searchParams.toString();
    return adminFetch<{
      sessions: Array<{
        tokenId: string;
        userId: string;
        user: { id: string; name: string; email: string; username?: string; avatar?: string };
        serverName: string;
        createdAt: string;
        expiresAt: string;
        isActive: boolean;
      }>;
      summary: {
        totalActiveSessions: number;
        uniqueConnectedUsers: number;
        sessionsToday: number;
      };
    }>(`/users/active/microsoft${queryString ? `?${queryString}` : ''}`);
  },
};

// User Conversation types
export interface ConversationMessage {
  messageId: string;
  text: string;
  sender: string;
  isCreatedByUser: boolean;
  model?: string;
  createdAt: string;
  tokenCount?: number;
  error?: boolean;
  isError?: boolean;
  errorMessage?: string | null;
}

export interface UserConversation {
  _id: string;
  conversationId: string;
  title: string;
  endpoint: string;
  model: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  errorCount?: number;
  hasErrors?: boolean;
  messages: ConversationMessage[];
}

export interface UserConversationsResponse {
  conversations: UserConversation[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// User Detail API
export const userDetailApi = {
  getUserStats: (userId: string) => adminFetch<UserStats>(`/users/${userId}/stats`),
  getUserSessions: (userId: string) => adminFetch<UserSessionsResponse>(`/users/${userId}/sessions`),
  getUserTransactions: (userId: string) => adminFetch<UserTransactionsResponse>(`/users/${userId}/transactions`),
  getUserConversations: (userId: string, page = 1, limit = 20) => 
    adminFetch<UserConversationsResponse>(`/users/${userId}/conversations?page=${page}&limit=${limit}`),
  terminateSession: (userId: string, sessionId: string) =>
    adminFetch<{ message: string }>(`/users/${userId}/sessions/${sessionId}`, {
      method: 'DELETE',
    }),
};

// LLM Traces/Observability Types
export interface GuardrailViolation {
  type: 'CONTENT_POLICY' | 'TOPIC_POLICY' | 'WORD_POLICY' | 'PII_POLICY';
  category: string;
  confidence?: string;
  action?: string;
}

export interface GuardrailOutcomeData {
  outcome: 'blocked' | 'anonymized' | 'intervened' | 'passed';
  actionApplied: boolean;
  violations: GuardrailViolation[];
  reason: string;
  timestamp?: string;
  originalContent?: string;
  modifiedContent?: string;
  assessments?: unknown[];
}

export interface GuardrailsData {
  invoked: boolean;
  input: GuardrailOutcomeData | null;
  output: GuardrailOutcomeData | null;
}

export interface LLMTrace {
  id: string;
  messageId: string;
  conversationId: string;
  conversationTitle: string;
  user: { _id: string; name: string; email: string } | null;
  /** Error information if this trace resulted in an error */
  error: {
    isError: boolean;
    message: string;
    type: string;
    code: string | null;
    rawText: string;
  } | null;
  input: {
    messageId: string | null;
    text: string;
    tokenCount: number;
    createdAt: string | null;
  };
  output: {
    messageId: string;
    text: string;
    tokenCount: number;
    createdAt: string;
    isError?: boolean;
  };
  trace: {
    model: string;
    modelName: string;
    endpoint: string;
    sender: string;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    inputCost: number;
    outputCost: number;
    totalCost: number;
    thinking: string;
    toolCalls: Array<{
      id: string;
      name: string;
      args: string;
      output: string;
    }>;
    duration: number | null;
    /** Prompt caching information */
    caching?: {
      enabled: boolean;
      writeTokens: number;
      readTokens: number;
      writeCost: number;
      readCost: number;
      hitRatio?: number;
      estimatedSavings?: number;
    };
    /** Detailed token breakdown by component (what's in the context) */
    tokenBreakdown?: {
      // High-level totals
      instructions?: number;    // System prompt tokens
      artifacts?: number;       // Artifacts prompt tokens  
      tools?: number;           // Tool definitions tokens (total)
      toolCount?: number;       // Number of tools
      toolContext?: number;     // Tool usage instructions (total)
      total?: number;           // Total context tokens
      // Detailed per-tool breakdown
      toolsDetail?: Array<{ name: string; tokens: number }>;
      toolContextDetail?: Array<{ name: string; tokens: number }>;
      // Per-prompt token breakdown (branding, tool routing, etc.)
      prompts?: {
        branding: number;
        toolRouting: number;
        agentInstructions: number;
        mcpInstructions: number;
        artifacts: number;
        memory: number;
      };
    };
    /** Context analytics - message breakdown, TOON compression, utilization */
    contextAnalytics?: {
      messageCount: number;
      totalTokens: number;
      maxContextTokens: number;
      instructionTokens: number;
      utilizationPercent: number;
      breakdown?: Record<string, { tokens: number; percent: number }>;  // { human: { tokens, percent }, ai: {...}, tool: {...} }
      toonStats?: {
        compressedCount: number;
        charactersSaved: number;
        tokensSaved: number;
        avgReductionPercent: number;
      };
      cacheStats?: {
        cacheReadTokens: number;
        cacheCreationTokens: number;
      };
      pruningApplied: boolean;
      messagesPruned: number;
    };
  };
  guardrails: GuardrailsData | null;
  createdAt: string;
}

export interface LLMTracesResponse {
  traces: LLMTrace[];
  filters: {
    models: Array<{ id: string; name: string }>;
  };
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  summary: {
    totalTraces: number;
  };
  generatedAt: string;
}

export interface LLMTracesParams {
  page?: number;
  limit?: number;
  userId?: string;
  conversationId?: string;
  model?: string;
  agent?: string;
  guardrails?: string;
  startDate?: string;
  endDate?: string;
  toolName?: string;
  errorOnly?: boolean;
  search?: string;
}

// LLM Traces API for Observability
export const tracesApi = {
  getTraces: (params: LLMTracesParams = {}) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        query.set(key, String(value));
      }
    });
    return adminFetch<LLMTracesResponse>(`/dashboard/traces?${query.toString()}`);
  },
};

// System
export interface SystemHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  services: {
    mongodb: { status: string; connected: boolean };
    api: { status: string; uptime: number; uptimeFormatted: string };
  };
  process: {
    memory: {
      heapUsed: number;
      heapTotal: number;
      rss: number;
      heapUsedMB: number;
      heapTotalMB: number;
      rssMB: number;
    };
    cpu: { user: number; system: number };
    pid: number;
  };
  system: {
    platform: string;
    arch: string;
    hostname: string;
    cpuCount: number;
    loadAverage: number[];
    memory: {
      total: number;
      free: number;
      used: number;
      usedPercent: string;
      totalGB: string;
      freeGB: string;
    };
    uptime: number;
    uptimeFormatted: string;
  };
  node: {
    version: string;
    env: string;
  };
}

export const systemApi = {
  getHealth: () => adminFetch<SystemHealth>('/system/health'),
  getSystemHealth: () => adminFetch<SystemHealth>('/system/health'),
  getConfig: () => adminFetch<Record<string, unknown>>('/system/config'),
  getSystemSettings: () => adminFetch<Record<string, unknown>>('/system/settings'),
  updateSystemSettings: (settings: Record<string, unknown>) =>
    adminFetch<{ message: string }>('/system/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    }),
  getCacheStats: () => adminFetch<Record<string, unknown>>('/system/cache/stats'),
  flushCache: () =>
    adminFetch<{ message: string }>('/system/cache/flush', {
      method: 'POST',
    }),
  getLogs: (params?: { level?: string; limit?: number }) => {
    const query = new URLSearchParams();
    if (params?.level) query.set('level', params.level);
    if (params?.limit) query.set('limit', String(params.limit));
    return adminFetch<{ logs: unknown[] }>(`/system/logs?${query.toString()}`);
  },
};

// Role Management
export interface RolePermissions {
  BOOKMARKS?: { USE?: boolean; CREATE?: boolean; SHARE?: boolean };
  PROMPTS?: { USE?: boolean; CREATE?: boolean; SHARE?: boolean };
  MEMORIES?: { USE?: boolean; CREATE?: boolean; SHARE?: boolean };
  AGENTS?: { USE?: boolean; CREATE?: boolean; SHARE?: boolean; SHARED_GLOBAL?: boolean };
  MULTI_CONVO?: { USE?: boolean };
  CODE_INTERPRETER?: { USE?: boolean };
  MARKETPLACE?: { VIEW_LIST?: boolean; INSTALL?: boolean };
  PEOPLE_PICKER?: { USE?: boolean };
}

export interface Role {
  _id?: string;
  name: string;
  permissions: RolePermissions;
  createdAt?: string;
  updatedAt?: string;
}

export interface RoleListResponse {
  roles: Role[];
  systemRoles: string[];
}

export const rolesApi = {
  list: () => adminFetch<RoleListResponse>('/roles'),
  
  getByName: (roleName: string) => adminFetch<Role>(`/roles/${roleName}`),
  
  update: (roleName: string, updates: Partial<Role>) =>
    adminFetch<{ message: string; role: Role }>(`/roles/${roleName}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    }),
  
  create: (name: string, permissions?: RolePermissions) =>
    adminFetch<{ message: string; role: Role }>('/roles', {
      method: 'POST',
      body: JSON.stringify({ name, permissions }),
    }),
  
  delete: (roleName: string) =>
    adminFetch<{ message: string }>(`/roles/${roleName}`, {
      method: 'DELETE',
    }),
};

// Conversations
export interface Conversation {
  _id: string;
  conversationId: string;
  user: string | { _id: string; name: string; email: string };
  title: string;
  endpoint: string;
  model?: string;
  createdAt: string;
  updatedAt: string;
  messageCount?: number;
  errorCount?: number;
  hasErrors?: boolean;
  messages?: ConversationMessage[];
}

export interface ConversationListResponse {
  conversations: Conversation[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export const conversationsApi = {
  list: (params: { page?: number; limit?: number; userId?: string; endpoint?: string } = {}) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        query.set(key, String(value));
      }
    });
    return adminFetch<ConversationListResponse>(`/conversations?${query.toString()}`);
  },

  getById: (conversationId: string, includeMessages = false) => 
    adminFetch<Conversation>(`/conversations/${conversationId}?includeMessages=${includeMessages}`),

  delete: (conversationId: string) =>
    adminFetch<{ message: string }>(`/conversations/${conversationId}`, {
      method: 'DELETE',
    }),
};
