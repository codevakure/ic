/**
 * Admin Store - Recoil atoms for caching admin metrics
 * 
 * This store caches summary data to avoid redundant API calls across pages.
 * Summary data is lightweight and can be shared across Dashboard, Agents, Tools, etc.
 */
import { atom, selector } from 'recoil';

// Types for cached summaries
export interface AgentsSummary {
  total: number;
  public: number;
  private: number;
}

export interface ToolsSummary {
  totalInvocations: number;
  totalTools: number;
  avgSuccessRate: number;
  mostUsedTool: string;
}

export interface GuardrailsSummary {
  totalEvents: number;
  blocked: number;
  intervened: number;
  anonymized: number;
  passed: number;
  userCount: number;
  conversationCount: number;
  blockRate: number | string;
}

export interface CachedMetrics<T> {
  data: T | null;
  dateRange: { startDate: string; endDate: string } | null;
  fetchedAt: number | null;
  isLoading: boolean;
  error: string | null;
}

// Cache TTL in milliseconds (5 minutes)
const CACHE_TTL = 5 * 60 * 1000;

// Helper to check if cache is valid
export const isCacheValid = (fetchedAt: number | null, dateRange: { startDate: string; endDate: string } | null, requestedRange: { startDate: string; endDate: string }): boolean => {
  if (!fetchedAt || !dateRange) return false;
  
  // Check if same date range
  if (dateRange.startDate !== requestedRange.startDate || dateRange.endDate !== requestedRange.endDate) {
    return false;
  }
  
  // Check TTL
  return Date.now() - fetchedAt < CACHE_TTL;
};

// Agents Summary Atom
export const agentsSummaryAtom = atom<CachedMetrics<AgentsSummary>>({
  key: 'admin/agentsSummary',
  default: {
    data: null,
    dateRange: null,
    fetchedAt: null,
    isLoading: false,
    error: null,
  },
});

// Agents Details Atom (full agent list)
export const agentsDetailsAtom = atom<CachedMetrics<{
  agents: Array<{
    agentId: string;
    name: string;
    description?: string;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    totalCost: number;
    transactions: number;
    userCount: number;
  }>;
}>>({
  key: 'admin/agentsDetails',
  default: {
    data: null,
    dateRange: null,
    fetchedAt: null,
    isLoading: false,
    error: null,
  },
});

// Tools Summary Atom
export const toolsSummaryAtom = atom<CachedMetrics<ToolsSummary>>({
  key: 'admin/toolsSummary',
  default: {
    data: null,
    dateRange: null,
    fetchedAt: null,
    isLoading: false,
    error: null,
  },
});

// Tools Details Atom (full tools list + trend)
export const toolsDetailsAtom = atom<CachedMetrics<{
  tools: Array<{
    toolName: string;
    displayName: string;
    category: string;
    invocations: number;
    successCount: number;
    errorCount: number;
    avgDuration: number;
    userCount: number;
    conversationCount: number;
  }>;
  trend: Array<{ date: string; count: number }>;
}>>({
  key: 'admin/toolsDetails',
  default: {
    data: null,
    dateRange: null,
    fetchedAt: null,
    isLoading: false,
    error: null,
  },
});

// Guardrails Summary Atom
export const guardrailsSummaryAtom = atom<CachedMetrics<GuardrailsSummary>>({
  key: 'admin/guardrailsSummary',
  default: {
    data: null,
    dateRange: null,
    fetchedAt: null,
    isLoading: false,
    error: null,
  },
});

// Guardrails Details Atom
export const guardrailsDetailsAtom = atom<CachedMetrics<{
  violations: Array<{ type: string; category: string; count: number }>;
  violationBreakdown: Array<{ type: string; blocked: number; intervened: number; anonymized: number; total: number }>;
  trend: Array<{ date: string; total: number; blocked: number; intervened: number; anonymized: number }>;
}>>({
  key: 'admin/guardrailsDetails',
  default: {
    data: null,
    dateRange: null,
    fetchedAt: null,
    isLoading: false,
    error: null,
  },
});

// Current date range selector (today by default)
export const adminDateRangeAtom = atom<{ startDate: string; endDate: string }>({
  key: 'admin/dateRange',
  default: {
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  },
});

// Selector to check if all summaries are loaded for dashboard
export const dashboardSummariesLoadedSelector = selector({
  key: 'admin/dashboardSummariesLoaded',
  get: ({ get }) => {
    const agents = get(agentsSummaryAtom);
    const tools = get(toolsSummaryAtom);
    const guardrails = get(guardrailsSummaryAtom);
    
    return agents.data !== null && tools.data !== null && guardrails.data !== null;
  },
});
