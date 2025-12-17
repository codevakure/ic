/**
 * Admin Dashboard Page
 * 
 * Modern observability dashboard with real-time metrics, hourly activity charts,
 * and comprehensive LLM usage analytics. All data is from the database - no mocks.
 * 
 * Uses shared Recoil cache for Tools and Guardrails data - if user visits
 * individual pages first, the data is reused here and vice versa.
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  MessageSquare,
  Activity,
  Coins,
  RefreshCw,
  UserCheck,
  AlertCircle,
  Ban,
  Calendar,
  TrendingUp,
  Zap,
  Clock,
  Bot,
  Hash,
  BarChart3,
  Wrench,
  Shield,
} from 'lucide-react';
import {
  AdminAreaChart,
  AdminBarChart,
  AdminMultiBarChart,
  AdminMultiAreaChart,
  CHART_COLORS,
} from '../components/Charts';
import {
  dashboardApi,
  systemApi,
  usersApi,
  type DashboardOverview,
  type TokenMetrics,
  type HourlyActivity,
  type ConversationMetrics,
  type UserMetrics,
  type SystemHealth,
} from '../services/adminApi';
import { useToolMetrics, useGuardrailsMetrics } from '../hooks/useAdminMetrics';
import { 
  DashboardPageSkeleton,
  StatCardSkeleton,
  ChartSkeleton,
  StatsGridSkeleton,
} from '../components/Skeletons';
import { cn } from '~/utils';

// Date range presets
const DATE_PRESETS = [
  { label: 'Today', value: 'today' },
  { label: 'Yesterday', value: 'yesterday' },
  { label: 'Last 7 days', value: '7d' },
  { label: 'Last 30 days', value: '30d' },
  { label: 'This Month', value: 'month' },
  { label: 'Custom', value: 'custom' },
] as const;

// Format large numbers
const formatNumber = (num: number): string => {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toLocaleString();
};

// Format currency
const formatCurrency = (num: number): string => {
  if (num >= 1000) return `$${(num / 1000).toFixed(2)}K`;
  return `$${num.toFixed(2)}`;
};

// Format date for input (using local time consistently)
const formatDateForInput = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Metric card component
interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  iconColor: string;
  iconBg: string;
  trend?: { value: number; label: string };
  onClick?: () => void;
  loading?: boolean;
  size?: 'default' | 'large';
}

const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  iconColor,
  iconBg,
  trend,
  onClick,
  loading,
  size = 'default',
}) => (
  <div
    onClick={onClick}
    className={cn(
      'group rounded-xl border border-border-light bg-surface-secondary p-4 transition-all',
      onClick && 'cursor-pointer hover:border-[var(--surface-submit)] hover:shadow-lg'
    )}
  >
    <div className="flex items-start justify-between h-full">
      <div className="flex-1 min-w-0 flex flex-col justify-center">
        <p className={cn(
          'font-medium text-text-secondary truncate',
          size === 'large' ? 'text-sm' : 'text-xs'
        )}>{title}</p>
        <p className={cn(
          'mt-1 font-bold text-text-primary',
          size === 'large' ? 'text-3xl' : 'text-2xl'
        )}>
          {loading ? (
            <span className="inline-block h-7 w-16 animate-pulse rounded bg-surface-tertiary" />
          ) : typeof value === 'number' ? formatNumber(value) : value}
        </p>
        {(subtitle || trend) && (
          <div className="mt-1 flex items-center gap-2">
            {trend && (
              <span className={cn(
                'flex items-center gap-1 font-medium',
                size === 'large' ? 'text-sm' : 'text-xs',
                trend.value >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
              )}>
                <TrendingUp className={cn('h-3 w-3', trend.value < 0 && 'rotate-180')} />
                {Math.abs(trend.value)}%
              </span>
            )}
            {subtitle && <span className={cn(
              'text-text-tertiary truncate',
              size === 'large' ? 'text-sm' : 'text-xs'
            )}>{subtitle}</span>}
          </div>
        )}
      </div>
      <div className={cn(
        'flex flex-shrink-0 items-center justify-center rounded-lg',
        size === 'large' ? 'h-11 w-11' : 'h-9 w-9',
        iconBg
      )}>
        <div className={iconColor}>{icon}</div>
      </div>
    </div>
  </div>
);

function DashboardPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [datePreset, setDatePreset] = useState<string>('today');
  
  // Individual metric loading states for filter changes
  const [metricsLoading, setMetricsLoading] = useState({
    overview: true,
    tokens: true,
    conversations: true,
    users: true,
  });
  
  // Custom date range
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [showCustomPicker, setShowCustomPicker] = useState(false);

  // Dashboard data (dashboard-specific only)
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [tokenMetrics, setTokenMetrics] = useState<TokenMetrics | null>(null);
  const [conversationMetrics, setConversationMetrics] = useState<ConversationMetrics | null>(null);
  const [userMetrics, setUserMetrics] = useState<UserMetrics | null>(null);
  const [hourlyActivity, setHourlyActivity] = useState<HourlyActivity | null>(null);
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [bannedCount, setBannedCount] = useState<number>(0);

  // Calculate date range from preset
  const dateRange = useMemo(() => {
    const now = new Date();
    let startDate: Date;
    let endDate: Date = now;
    
    switch (datePreset) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'yesterday':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        endDate.setMilliseconds(-1); // End of yesterday
        break;
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'custom':
        if (customStartDate && customEndDate) {
          startDate = new Date(customStartDate);
          endDate = new Date(customEndDate);
          endDate.setHours(23, 59, 59, 999);
        } else {
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        }
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    }
    
    return {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    };
  }, [datePreset, customStartDate, customEndDate]);

  // Convert dateRange to the format hooks expect (YYYY-MM-DD strings)
  const hookDateRange = useMemo(() => ({
    startDate: dateRange.startDate.split('T')[0],
    endDate: dateRange.endDate.split('T')[0],
  }), [dateRange]);

  // Use shared cached hooks for Tools and Guardrails
  // These cache in Recoil - if user already visited ToolsPage or GuardrailsPage, data is reused
  const {
    summary: toolsSummary,
    summaryLoading: toolsSummaryLoading,
    trend: toolsTrend,
    detailsLoading: toolsDetailsLoading,
    refetch: refetchTools,
  } = useToolMetrics(hookDateRange);

  const {
    summary: guardrailsSummary,
    summaryLoading: guardrailsSummaryLoading,
    trend: guardrailsTrend,
    detailsLoading: guardrailsDetailsLoading,
    refetch: refetchGuardrails,
  } = useGuardrailsMetrics(hookDateRange);

  const fetchData = useCallback(async () => {
    // Set loading states for metrics affected by date filter
    setMetricsLoading(prev => ({
      ...prev,
      overview: true,
      tokens: true,
      conversations: true,
      users: true,
    }));
    setError(null);

    try {
      // Fetch dashboard-specific data only
      // Tools and Guardrails data comes from shared hooks (cached in Recoil)
      const [
        overviewRes, 
        tokensRes, 
        conversationsRes,
        usersRes,
        healthRes, 
        hourlyRes,
      ] = await Promise.allSettled([
        dashboardApi.getOverview(dateRange),
        dashboardApi.getTokenMetrics(dateRange),
        dashboardApi.getConversationMetrics(dateRange),
        dashboardApi.getUserMetrics(dateRange),
        systemApi.getHealth(),
        dashboardApi.getHourlyActivity('America/Chicago'),
      ]);

      if (overviewRes.status === 'fulfilled') {
        setOverview(overviewRes.value);
        setMetricsLoading(prev => ({ ...prev, overview: false }));
      }
      if (tokensRes.status === 'fulfilled') {
        setTokenMetrics(tokensRes.value);
        setMetricsLoading(prev => ({ ...prev, tokens: false }));
      }
      if (conversationsRes.status === 'fulfilled') {
        setConversationMetrics(conversationsRes.value);
        setMetricsLoading(prev => ({ ...prev, conversations: false }));
      }
      if (usersRes.status === 'fulfilled') {
        setUserMetrics(usersRes.value);
        setMetricsLoading(prev => ({ ...prev, users: false }));
      }
      if (healthRes.status === 'fulfilled') setSystemHealth(healthRes.value);
      if (hourlyRes.status === 'fulfilled') setHourlyActivity(hourlyRes.value);

      // Fetch banned users count using proper API
      try {
        const bannedData = await usersApi.list({ status: 'banned', limit: 1 });
        setBannedCount(bannedData.pagination?.total || 0);
      } catch {
        // Ignore error for banned count
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
    } finally {
      setLoading(false);
      setMetricsLoading({ overview: false, tokens: false, conversations: false, users: false });
    }
  }, [dateRange]);

  // Combined refresh that also refreshes tools and guardrails from hooks
  const handleRefresh = useCallback(() => {
    fetchData();
    refetchTools();
    refetchGuardrails();
  }, [fetchData, refetchTools, refetchGuardrails]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-refresh every 60 seconds
  useEffect(() => {
    const interval = setInterval(handleRefresh, 60000);
    return () => clearInterval(interval);
  }, [handleRefresh]);

  // Handle date preset change
  const handleDatePresetChange = (value: string) => {
    if (value === 'custom') {
      setShowCustomPicker(true);
      // Set default custom dates to last 7 days
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      setCustomStartDate(formatDateForInput(weekAgo));
      setCustomEndDate(formatDateForInput(now));
    } else {
      setShowCustomPicker(false);
    }
    setDatePreset(value);
  };

  // Transform hourly API data for chart - using real data only with separate series
  const hourlyData = useMemo(() => {
    if (!hourlyActivity?.hourlyData?.length) {
      return [];
    }
    return hourlyActivity.hourlyData.map(h => ({
      name: h.label,
      conversations: h.conversations,
      messages: h.messages,
      sessions: h.sessions,
      activeUsers: h.activeUsers,
    }));
  }, [hourlyActivity]);

  // Daily trend data from token metrics - real data only
  const dailyLLMData = useMemo(() => {
    if (!tokenMetrics?.trend?.length) {
      return [];
    }
    return tokenMetrics.trend.map(d => ({
      name: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      input: d.inputTokens,
      output: d.outputTokens,
    }));
  }, [tokenMetrics?.trend]);

  // Model usage distribution - real data only
  const modelUsageData = useMemo(() => {
    if (!tokenMetrics?.byModel?.length) return [];
    
    // Sort by total tokens and limit to top 5 for better display
    return tokenMetrics.byModel
      .sort((a, b) => b.totalTokens - a.totalTokens)
      .slice(0, 5)
      .map(m => ({
        name: m.name || m.model?.split('-').slice(0, 2).join('-') || 'Unknown',
        value: m.totalTokens,
      }));
  }, [tokenMetrics?.byModel]);

  // Conversations by endpoint - real data
  const endpointData = useMemo(() => {
    if (!conversationMetrics?.byEndpoint?.length) return [];
    return conversationMetrics.byEndpoint.slice(0, 5).map(e => ({
      name: e.endpoint || 'Unknown',
      value: e.count,
    }));
  }, [conversationMetrics?.byEndpoint]);

  // Daily conversations trend - real data
  const dailyConversationsData = useMemo(() => {
    if (!conversationMetrics?.trend?.length) return [];
    return conversationMetrics.trend.map(d => ({
      name: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      value: d.count,
    }));
  }, [conversationMetrics?.trend]);

  // Conversations by model - real data (for the new chart)
  const conversationsByModelData = useMemo(() => {
    if (!conversationMetrics?.byModel?.length) return [];
    return conversationMetrics.byModel.slice(0, 5).map(m => ({
      name: m.model?.split('-').slice(0, 2).join('-') || 'Unknown',
      value: m.count,
    }));
  }, [conversationMetrics?.byModel]);

  // Tools usage trend - from shared hook
  const toolsUsageData = useMemo(() => {
    if (!toolsTrend?.length) return [];
    return toolsTrend.map(d => ({
      name: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      value: d.count,
    }));
  }, [toolsTrend]);

  // Guardrails trend - from shared hook with all 3 categories
  const guardrailsData = useMemo(() => {
    if (!guardrailsTrend?.length) return [];
    return guardrailsTrend.map(d => ({
      name: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      blocked: d.blocked,
      intervened: d.intervened,
      anonymized: d.anonymized,
    }));
  }, [guardrailsTrend]);

  // Get display label for date range
  const dateRangeLabel = useMemo(() => {
    if (datePreset === 'custom' && customStartDate && customEndDate) {
      return `${new Date(customStartDate).toLocaleDateString()} - ${new Date(customEndDate).toLocaleDateString()}`;
    }
    return DATE_PRESETS.find(p => p.value === datePreset)?.label || 'Today';
  }, [datePreset, customStartDate, customEndDate]);

  // Show full skeleton on initial load
  if (loading && !overview) {
    return <DashboardPageSkeleton />;
  }

  return (
    <div className="space-y-5 p-4 md:p-6">
      {/* Page Header with Date Filter */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Dashboard</h1>
          <p className="mt-1 text-sm text-text-secondary">
            LLM Observability • {dateRangeLabel}
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          {/* Date Range Selector */}
          <div className="flex items-center gap-1 rounded-lg border border-border-light bg-surface-secondary p-1">
            <Calendar className="ml-2 h-4 w-4 text-text-tertiary" />
            {DATE_PRESETS.map(preset => (
              <button
                key={preset.value}
                onClick={() => handleDatePresetChange(preset.value)}
                className={cn(
                  'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                  datePreset === preset.value
                    ? 'bg-[var(--surface-submit)] text-white'
                    : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'
                )}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Custom Date Range Picker */}
          {showCustomPicker && (
            <div className="flex items-center gap-2 rounded-lg border border-border-light bg-surface-secondary px-3 py-1.5">
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="bg-transparent text-xs text-text-primary outline-none"
              />
              <span className="text-text-tertiary">to</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="bg-transparent text-xs text-text-primary outline-none"
              />
            </div>
          )}

          {/* System Status */}
          {systemHealth && (
            <span
              className={cn(
                'flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium',
                systemHealth.status === 'healthy'
                  ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                  : systemHealth.status === 'degraded'
                    ? 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400'
                    : 'bg-red-500/10 text-red-600 dark:text-red-400'
              )}
            >
              <span
                className={cn(
                  'h-2 w-2 rounded-full',
                  systemHealth.status === 'healthy'
                    ? 'bg-green-500 animate-pulse'
                    : systemHealth.status === 'degraded'
                      ? 'bg-yellow-500'
                      : 'bg-red-500'
                )}
              />
              {systemHealth.status === 'healthy' ? 'Healthy' : systemHealth.status}
            </span>
          )}
          
          {/* Refresh Button */}
          <button
            onClick={handleRefresh}
            disabled={loading || toolsDetailsLoading || guardrailsDetailsLoading}
            className="flex items-center gap-2 rounded-lg bg-surface-tertiary px-3 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-surface-hover disabled:opacity-50"
          >
            <RefreshCw className={cn('h-4 w-4', (loading || toolsDetailsLoading || guardrailsDetailsLoading) && 'animate-spin')} />
          </button>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
          <AlertCircle className="h-5 w-5" />
          {error}
        </div>
      )}

      {/* ROW 1: Activity Chart (8 grid) + 4 Key Metrics (4 grid) */}
      <div className="grid gap-5 grid-cols-1 lg:grid-cols-12">
        {/* Activity Chart - 8 columns */}
        <div className="lg:col-span-8 rounded-xl border border-border-light bg-surface-secondary p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-text-primary">Activity (24h)</h3>
              <p className="text-xs text-text-secondary">Conversations, Messages & Sessions (CST)</p>
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-surface-tertiary px-2 py-1">
              <Clock className="h-3 w-3 text-text-tertiary" />
              <span className="text-xs font-medium text-text-secondary">Live</span>
            </div>
          </div>
          {loading && !hourlyActivity ? (
            <div className="h-[220px] w-full rounded bg-surface-tertiary animate-pulse" />
          ) : hourlyData.length > 0 ? (
            <AdminMultiAreaChart
              data={hourlyData}
              dataKeys={[
                { key: 'conversations', color: CHART_COLORS.primary, name: 'Conversations' },
                { key: 'messages', color: CHART_COLORS.success, name: 'Messages' },
                { key: 'activeUsers', color: CHART_COLORS.orange, name: 'Active Users' },
              ]}
              height={220}
              formatter={formatNumber}
            />
          ) : (
            <div className="flex h-[220px] items-center justify-center text-text-tertiary text-sm">
              No activity data in the last 24 hours
            </div>
          )}
        </div>

        {/* 4 Key Metrics - 4 columns (2x2 grid) - These respond to date filter */}
        <div className="lg:col-span-4 grid gap-3 grid-cols-2">
          <MetricCard
            title="Conversations"
            value={conversationMetrics?.summary?.newInPeriod ?? overview?.conversations.total ?? 0}
            subtitle={datePreset === 'today' ? 'Today' : `In ${dateRangeLabel}`}
            icon={<MessageSquare className="h-4 w-4" />}
            iconColor="text-teal-600 dark:text-teal-400"
            iconBg="bg-teal-500/10"
            loading={metricsLoading.conversations}
            size="large"
          />
          <MetricCard
            title="Avg Msgs/Conv"
            value={conversationMetrics?.summary?.avgMessagesPerConversation ?? 0}
            subtitle={`Max: ${conversationMetrics?.summary?.maxMessagesInConversation ?? 0}`}
            icon={<Hash className="h-4 w-4" />}
            iconColor="text-cyan-600 dark:text-cyan-400"
            iconBg="bg-cyan-500/10"
            loading={metricsLoading.conversations}
            size="large"
          />
          <MetricCard
            title="Tokens Used"
            value={tokenMetrics?.summary?.totalTokens ?? 0}
            subtitle={`In: ${formatNumber(tokenMetrics?.summary?.totalInputTokens ?? 0)}`}
            icon={<Zap className="h-4 w-4" />}
            iconColor="text-yellow-600 dark:text-yellow-400"
            iconBg="bg-yellow-500/10"
            loading={metricsLoading.tokens}
            size="large"
          />
          <MetricCard
            title="Cost"
            value={formatCurrency(tokenMetrics?.summary?.totalCost ?? 0)}
            subtitle={tokenMetrics?.summary?.totalCacheSavings ? `Saved ${formatCurrency(tokenMetrics.summary.totalCacheSavings)} from cache` : (datePreset === 'today' ? 'Today' : `In ${dateRangeLabel}`)}
            icon={<Coins className="h-4 w-4" />}
            iconColor="text-orange-600 dark:text-orange-400"
            iconBg="bg-orange-500/10"
            onClick={() => navigate('/admin/costs')}
            loading={metricsLoading.tokens}
            size="large"
          />
        </div>
      </div>

      {/* ROW 2: 4 More Metric Cards (responds to filter) */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Active Users"
          value={overview?.users.activeToday ?? 0}
          subtitle={`${overview?.users.activeThisWeek ?? 0} this week`}
          icon={<UserCheck className="h-4 w-4" />}
          iconColor="text-blue-600 dark:text-blue-400"
          iconBg="bg-blue-500/10"
          loading={metricsLoading.users}
        />
        <MetricCard
          title="New Users"
          value={overview?.users?.inRange ?? overview?.users?.today ?? 0}
          subtitle={datePreset === 'today' ? 'Today' : `In ${dateRangeLabel}`}
          icon={<TrendingUp className="h-4 w-4" />}
          iconColor="text-emerald-600 dark:text-emerald-400"
          iconBg="bg-emerald-500/10"
          loading={metricsLoading.overview}
        />
        <MetricCard
          title="Transactions"
          value={tokenMetrics?.summary?.totalTransactions ?? 0}
          subtitle="Token transactions"
          icon={<Activity className="h-4 w-4" />}
          iconColor="text-violet-600 dark:text-violet-400"
          iconBg="bg-violet-500/10"
          loading={metricsLoading.tokens}
        />
        <MetricCard
          title="Avg Tokens/Conv"
          value={conversationMetrics?.summary?.newInPeriod ? Math.round((tokenMetrics?.summary?.totalTokens ?? 0) / conversationMetrics.summary.newInPeriod) : 0}
          subtitle="Per conversation"
          icon={<BarChart3 className="h-4 w-4" />}
          iconColor="text-rose-600 dark:text-rose-400"
          iconBg="bg-rose-500/10"
          loading={metricsLoading.conversations || metricsLoading.tokens}
        />
      </div>

      {/* ROW 3: Model Usage (6 grid) + Token Usage Trend (6 grid) */}
      <div className="grid gap-5 lg:grid-cols-2">
        {/* Model Usage Chart */}
        <div className="rounded-xl border border-border-light bg-surface-secondary p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-text-primary">Model Usage</h3>
              <p className="text-xs text-text-secondary">Token consumption by model (Top 5)</p>
            </div>
            <Zap className="h-4 w-4 text-text-tertiary" />
          </div>
          {loading && !tokenMetrics ? (
            <div className="h-[200px] w-full rounded bg-surface-tertiary animate-pulse" />
          ) : modelUsageData.length > 0 ? (
            <AdminBarChart
              data={modelUsageData}
              height={200}
              color={CHART_COLORS.primary}
              formatter={formatNumber}
              horizontal
            />
          ) : (
            <div className="flex h-[200px] items-center justify-center text-text-tertiary text-sm">
              No model usage data
            </div>
          )}
        </div>

        {/* Token Usage Trend */}
        <div className="rounded-xl border border-border-light bg-surface-secondary p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-text-primary">Token Usage Trend</h3>
              <p className="text-xs text-text-secondary">Input vs Output tokens per day</p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <div className="flex items-center gap-1">
                <div className="h-2 w-2 rounded-full bg-blue-500" />
                <span className="text-text-secondary">Input</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="h-2 w-2 rounded-full bg-green-500" />
                <span className="text-text-secondary">Output</span>
              </div>
            </div>
          </div>
          {loading && !tokenMetrics ? (
            <div className="h-[200px] w-full rounded bg-surface-tertiary animate-pulse" />
          ) : dailyLLMData.length > 0 ? (
            <AdminMultiBarChart
              data={dailyLLMData}
              dataKeys={[
                { key: 'input', color: CHART_COLORS.primary, name: 'Input' },
                { key: 'output', color: CHART_COLORS.success, name: 'Output' },
              ]}
              height={200}
              formatter={formatNumber}
              stacked
            />
          ) : (
            <div className="flex h-[200px] items-center justify-center text-text-tertiary text-sm">
              No token data for selected period
            </div>
          )}
        </div>
      </div>

      {/* ROW 4: By Endpoint (6 grid) + Conversations by Model (6 grid) */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* By Endpoint */}
        <div className="rounded-xl border border-border-light bg-surface-secondary p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-text-primary">By Endpoint</h3>
              <p className="text-xs text-text-secondary">Conversations by endpoint</p>
            </div>
            <Activity className="h-4 w-4 text-text-tertiary" />
          </div>
          {loading && !conversationMetrics ? (
            <div className="h-[160px] w-full rounded bg-surface-tertiary animate-pulse" />
          ) : endpointData.length > 0 ? (
            <AdminBarChart
              data={endpointData}
              height={160}
              color={CHART_COLORS.teal}
              formatter={formatNumber}
              horizontal
            />
          ) : (
            <div className="flex h-[160px] items-center justify-center text-text-tertiary text-sm">
              No endpoint data
            </div>
          )}
        </div>

        {/* Conversations by Model */}
        <div className="rounded-xl border border-border-light bg-surface-secondary p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-text-primary">Conversations by Model</h3>
              <p className="text-xs text-text-secondary">Model distribution (Top 5)</p>
            </div>
            <Bot className="h-4 w-4 text-text-tertiary" />
          </div>
          {loading && !conversationMetrics ? (
            <div className="h-[160px] w-full rounded bg-surface-tertiary animate-pulse" />
          ) : conversationsByModelData.length > 0 ? (
            <AdminBarChart
              data={conversationsByModelData}
              height={160}
              color={CHART_COLORS.purple}
              formatter={formatNumber}
              horizontal
            />
          ) : (
            <div className="flex h-[160px] items-center justify-center text-text-tertiary text-sm">
              No model data
            </div>
          )}
        </div>
      </div>

      {/* ROW 5: Tools Usage + Guardrails */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Tools Usage Trend */}
        <div 
          className="rounded-xl border border-border-light bg-surface-secondary p-4 cursor-pointer hover:border-[var(--surface-submit)] transition-colors"
          onClick={() => navigate('/admin/tools')}
        >
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-text-primary">Tools Usage</h3>
              <p className="text-xs text-text-secondary">
                {toolsSummary?.totalInvocations ?? 0} invocations • {toolsSummary?.totalTools ?? 0} tools
              </p>
            </div>
            <Wrench className="h-4 w-4 text-text-tertiary" />
          </div>
          {toolsDetailsLoading ? (
            <div className="h-[160px] w-full rounded bg-surface-tertiary animate-pulse" />
          ) : toolsUsageData.length > 0 ? (
            <AdminAreaChart
              data={toolsUsageData}
              dataKey="value"
              height={160}
              color={CHART_COLORS.warning}
              formatter={formatNumber}
            />
          ) : (
            <div className="flex h-[160px] items-center justify-center text-text-tertiary text-sm">
              No tool usage data
            </div>
          )}
        </div>

        {/* Guardrails Activity */}
        <div 
          className="rounded-xl border border-border-light bg-surface-secondary p-4 cursor-pointer hover:border-[var(--surface-submit)] transition-colors"
          onClick={() => navigate('/admin/guardrails')}
        >
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-text-primary">Guardrails</h3>
              <p className="text-xs text-text-secondary">
                {guardrailsSummary?.totalEvents ?? 0} events • {guardrailsSummary?.blocked ?? 0} blocked • {guardrailsSummary?.anonymized ?? 0} anonymized
              </p>
            </div>
            <Shield className="h-4 w-4 text-text-tertiary" />
          </div>
          {guardrailsDetailsLoading ? (
            <div className="h-[160px] w-full rounded bg-surface-tertiary animate-pulse" />
          ) : guardrailsData.length > 0 ? (
            <AdminMultiBarChart
              data={guardrailsData}
              dataKeys={[
                { key: 'blocked', color: CHART_COLORS.danger, name: 'Blocked' },
                { key: 'intervened', color: CHART_COLORS.warning, name: 'Intervened' },
                { key: 'anonymized', color: CHART_COLORS.info, name: 'Anonymized' },
              ]}
              height={160}
              formatter={formatNumber}
              stacked={true}
            />
          ) : (
            <div className="flex h-[160px] items-center justify-center text-text-tertiary text-sm">
              No guardrails data
            </div>
          )}
        </div>
      </div>

      {/* ROW 6: Cost Breakdown Table */}
      {tokenMetrics?.byModel && tokenMetrics.byModel.length > 0 && (
        <div className="rounded-xl border border-border-light bg-surface-secondary p-4">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-text-primary">Cost Breakdown by Model</h3>
              <p className="text-xs text-text-secondary">Detailed usage and cost analysis for selected period</p>
            </div>
            <Coins className="h-4 w-4 text-text-tertiary" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-light text-left text-xs font-medium text-text-tertiary">
                  <th className="pb-2 pr-4">Model</th>
                  <th className="pb-2 pr-4 text-right">Input</th>
                  <th className="pb-2 pr-4 text-right">Output</th>
                  <th className="pb-2 pr-4 text-right">Total</th>
                  <th className="pb-2 text-right">Cost</th>
                </tr>
              </thead>
              <tbody>
                {tokenMetrics.byModel.slice(0, 10).map((m, i) => (
                  <tr key={m.model || i} className="border-b border-border-light/50">
                    <td className="py-2 pr-4">
                      <span className="font-medium text-text-primary text-xs">
                        {m.name || m.model?.split('-').slice(0, 3).join('-') || 'Unknown'}
                      </span>
                    </td>
                    <td className="py-2 pr-4 text-right text-text-secondary text-xs">
                      {formatNumber(m.inputTokens)}
                    </td>
                    <td className="py-2 pr-4 text-right text-text-secondary text-xs">
                      {formatNumber(m.outputTokens)}
                    </td>
                    <td className="py-2 pr-4 text-right font-medium text-text-primary text-xs">
                      {formatNumber(m.totalTokens)}
                    </td>
                    <td className="py-2 text-right font-medium text-green-600 dark:text-green-400 text-xs">
                      ${m.totalCost?.toFixed(4) || '0.00'}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="font-medium">
                  <td className="pt-2 pr-4 text-text-primary text-xs">Total</td>
                  <td className="pt-2 pr-4 text-right text-text-primary text-xs">
                    {formatNumber(tokenMetrics.summary?.totalInputTokens ?? 0)}
                  </td>
                  <td className="pt-2 pr-4 text-right text-text-primary text-xs">
                    {formatNumber(tokenMetrics.summary?.totalOutputTokens ?? 0)}
                  </td>
                  <td className="pt-2 pr-4 text-right text-text-primary text-xs">
                    {formatNumber(tokenMetrics.summary?.totalTokens ?? 0)}
                  </td>
                  <td className="pt-2 text-right text-base text-green-600 dark:text-green-400">
                    {formatCurrency(tokenMetrics.summary?.totalCost ?? 0)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* ROW 6: 4 Static Metrics (don't change with filter) */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <MetricCard
          key="active-sessions"
          title="Active Sessions"
          value={overview?.activeSessions ?? 0}
          subtitle="Currently online"
          icon={<Activity className="h-4 w-4" />}
          iconColor="text-green-600 dark:text-green-400"
          iconBg="bg-green-500/10"
          loading={loading}
        />
        <MetricCard
          key="total-messages"
          title="Total Messages"
          value={overview?.messages.total ?? 0}
          subtitle={`${overview?.messages.today ?? 0} today`}
          icon={<Hash className="h-4 w-4" />}
          iconColor="text-cyan-600 dark:text-cyan-400"
          iconBg="bg-cyan-500/10"
          loading={loading}
        />
        <MetricCard
          key="total-users"
          title="Total Users"
          value={overview?.users.total ?? 0}
          subtitle={`${overview?.users.thisMonth ?? 0} this month`}
          icon={<Users className="h-4 w-4" />}
          iconColor="text-indigo-600 dark:text-indigo-400"
          iconBg="bg-indigo-500/10"
          onClick={() => navigate('/admin/users')}
          loading={loading}
        />
        <MetricCard
          key="total-conversations"
          title="Total Conversations"
          value={conversationMetrics?.summary?.total ?? overview?.conversations.total ?? 0}
          subtitle="All time"
          icon={<MessageSquare className="h-4 w-4" />}
          iconColor="text-teal-600 dark:text-teal-400"
          iconBg="bg-teal-500/10"
          loading={loading}
        />
        <MetricCard
          key="agents"
          title="Agents"
          value={overview?.agents?.total ?? 0}
          subtitle="Custom assistants"
          icon={<Bot className="h-4 w-4" />}
          iconColor="text-purple-600 dark:text-purple-400"
          iconBg="bg-purple-500/10"
          loading={loading}
        />
        <MetricCard
          key="banned-users"
          title="Banned Users"
          value={bannedCount}
          subtitle="Access restricted"
          icon={<Ban className="h-4 w-4" />}
          iconColor="text-red-600 dark:text-red-400"
          iconBg="bg-red-500/10"
          onClick={() => navigate('/admin/users?status=banned')}
          loading={loading}
        />
      </div>

      {/* ROW 8: User Distribution */}
      {userMetrics?.byRole && userMetrics.byRole.length > 0 && (
        <div className="rounded-xl border border-border-light bg-surface-secondary p-5">
          <div className="mb-4">
            <h3 className="text-base font-semibold text-text-primary">User Distribution</h3>
            <p className="text-xs text-text-secondary">Users by role</p>
          </div>
          <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
            {userMetrics.byRole.map(r => (
              <div key={r.role} className="rounded-lg bg-surface-tertiary p-3">
                <p className="text-xs text-text-secondary capitalize">{r.role}</p>
                <p className="text-xl font-bold text-text-primary">{r.count}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default DashboardPage;
