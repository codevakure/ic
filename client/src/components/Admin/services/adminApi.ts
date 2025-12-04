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
    totalTokens: number;
    totalCost: number;
    totalTransactions: number;
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
    totalTokens: number;
    inputCost: number;
    outputCost: number;
    totalCost: number;
    transactions: number;
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

export interface CostsMetrics {
  startDate: string;
  endDate: string;
  summary: {
    totalInputTokens: number;
    totalOutputTokens: number;
    totalTokens: number;
    totalCost: number;
    totalTransactions: number;
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
    totalTokens: number;
    inputCost: number;
    outputCost: number;
    totalCost: number;
    transactions: number;
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
  getCostsMetrics: (params: DateRangeParams = {}) => {
    const query = new URLSearchParams();
    if (params.startDate) query.set('startDate', params.startDate);
    if (params.endDate) query.set('endDate', params.endDate);
    const queryStr = query.toString();
    return adminFetch<CostsMetrics>(`/dashboard/costs${queryStr ? `?${queryStr}` : ''}`);
  },
  getActivityTimeline: (days?: number) =>
    adminFetch<ActivityTimeline>(`/dashboard/activity${days ? `?days=${days}` : ''}`),
  getHourlyActivity: (timezone?: string) =>
    adminFetch<HourlyActivity>(`/dashboard/hourly${timezone ? `?timezone=${timezone}` : ''}`),
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
};

// Active Users API (for ActiveUsersPage)
export const activeUsersApi = {
  getActiveUsers: () => adminFetch<{ 
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
      isOnline?: boolean;
    }>;
    summary: {
      totalActiveSessions: number;
      uniqueActiveUsers: number;
      averageSessionDuration?: number;
    };
  }>('/users/active/sessions'),
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
export interface LLMTrace {
  id: string;
  messageId: string;
  conversationId: string;
  conversationTitle: string;
  user: { name: string; email: string } | null;
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
  };
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
  startDate?: string;
  endDate?: string;
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

  getById: (conversationId: string) => adminFetch<Conversation>(`/conversations/${conversationId}`),

  delete: (conversationId: string) =>
    adminFetch<{ message: string }>(`/conversations/${conversationId}`, {
      method: 'DELETE',
    }),
};
