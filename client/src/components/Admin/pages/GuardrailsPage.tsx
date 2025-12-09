/**
 * Admin Guardrails Page
 * 
 * Guardrails usage metrics and analytics - showing blocked, intervened, and anonymized events.
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ColumnDef } from '@tanstack/react-table';
import {
  Shield,
  ShieldX,
  ShieldAlert,
  ShieldCheck,
  RefreshCw,
  Calendar,
  TrendingUp,
  Users,
  MessageSquare,
  ArrowRight,
} from 'lucide-react';
import { AdminDataTable, SortableHeader } from '../components/DataTable';
import { AdminMultiBarChart, CHART_COLORS } from '../components/Charts';
import { dashboardApi, type GuardrailsMetrics } from '../services/adminApi';
import { GuardrailsPageSkeleton, StatsGridSkeleton, ChartSkeleton } from '../components/Skeletons';
import { cn } from '~/utils';

interface ViolationRow {
  type: string;
  category: string;
  count: number;
}

// Outcome icons and colors
const getOutcomeStyle = (outcome: string) => {
  switch (outcome) {
    case 'blocked':
      return { icon: ShieldX, color: 'text-red-400', bg: 'bg-red-500/10' };
    case 'intervened':
      return { icon: ShieldAlert, color: 'text-yellow-400', bg: 'bg-yellow-500/10' };
    case 'anonymized':
      return { icon: ShieldAlert, color: 'text-blue-400', bg: 'bg-blue-500/10' };
    case 'passed':
      return { icon: ShieldCheck, color: 'text-green-400', bg: 'bg-green-500/10' };
    default:
      return { icon: Shield, color: 'text-gray-400', bg: 'bg-gray-500/10' };
  }
};

function GuardrailsPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [guardrailsData, setGuardrailsData] = useState<GuardrailsMetrics | null>(null);

  // Date filters
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setDate(1);
    return date.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });

  const fetchGuardrails = useCallback(async () => {
    setLoading(true);
    try {
      const data = await dashboardApi.getGuardrailsMetrics({ startDate, endDate });
      setGuardrailsData(data);
    } catch (error) {
      console.error('Failed to fetch guardrails:', error);
      setGuardrailsData(null);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    fetchGuardrails();
  }, [fetchGuardrails]);

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  // Chart data for trend with all 3 categories
  const trendData = useMemo(() => {
    if (!guardrailsData?.trend?.length) return [];
    return guardrailsData.trend.map(d => ({
      name: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      blocked: d.blocked,
      intervened: d.intervened,
      anonymized: d.anonymized,
    }));
  }, [guardrailsData?.trend]);

  // Violation breakdown data for stacked chart
  const violationBreakdownData = useMemo(() => {
    if (!guardrailsData?.violationBreakdown?.length) return [];
    return guardrailsData.violationBreakdown.map(v => ({
      name: v.type,
      blocked: v.blocked,
      intervened: v.intervened,
      anonymized: v.anonymized,
    }));
  }, [guardrailsData?.violationBreakdown]);

  // Table columns for violations
  const columns: ColumnDef<ViolationRow>[] = useMemo(
    () => [
      {
        accessorKey: 'type',
        header: ({ column }) => <SortableHeader column={column}>Type</SortableHeader>,
        cell: ({ row }) => (
          <span className="font-medium text-text-primary">{row.original.type}</span>
        ),
      },
      {
        accessorKey: 'category',
        header: ({ column }) => <SortableHeader column={column}>Category</SortableHeader>,
        cell: ({ row }) => (
          <span className={cn(
            'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
            'bg-red-500/10 text-red-400'
          )}>
            {row.original.category}
          </span>
        ),
      },
      {
        accessorKey: 'count',
        header: ({ column }) => <SortableHeader column={column}>Count</SortableHeader>,
        cell: ({ row }) => (
          <span className="text-sm font-medium text-text-primary">
            {formatNumber(row.original.count)}
          </span>
        ),
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <button
            onClick={() => navigate(`/admin/traces?guardrails=${row.original.category.toLowerCase()}`)}
            className="flex items-center gap-1 text-xs text-text-tertiary hover:text-text-primary transition-colors"
          >
            View Traces <ArrowRight className="h-3 w-3" />
          </button>
        ),
      },
    ],
    [navigate]
  );

  // Summary stats cards
  const stats = [
    {
      label: 'Total Events',
      value: guardrailsData?.summary?.totalEvents ?? 0,
      icon: Shield,
      color: 'text-blue-400',
      bg: 'bg-blue-500/10',
    },
    {
      label: 'Blocked',
      value: guardrailsData?.summary?.blocked ?? 0,
      icon: ShieldX,
      color: 'text-red-400',
      bg: 'bg-red-500/10',
      onClick: () => navigate('/admin/traces?guardrails=blocked'),
    },
    {
      label: 'Intervened',
      value: guardrailsData?.summary?.intervened ?? 0,
      icon: ShieldAlert,
      color: 'text-yellow-400',
      bg: 'bg-yellow-500/10',
      onClick: () => navigate('/admin/traces?guardrails=intervened'),
    },
    {
      label: 'Anonymized',
      value: guardrailsData?.summary?.anonymized ?? 0,
      icon: ShieldAlert,
      color: 'text-purple-400',
      bg: 'bg-purple-500/10',
      onClick: () => navigate('/admin/traces?guardrails=anonymized'),
    },
  ];

  // Show full skeleton on initial load
  if (loading && !guardrailsData) {
    return <GuardrailsPageSkeleton />;
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Guardrails</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Content moderation and policy enforcement across all conversations
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Date Range */}
          <div className="flex items-center gap-2 rounded-lg border border-border-light bg-surface-secondary px-3 py-2">
            <Calendar className="h-4 w-4 text-text-tertiary" />
            <span className="text-xs text-text-tertiary">Range:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-transparent text-sm text-text-primary outline-none"
            />
            <span className="text-text-tertiary">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-transparent text-sm text-text-primary outline-none"
            />
          </div>

          {/* Quick Filters */}
          <div className="flex gap-1">
            {['This Month', '7 Days', '30 Days'].map((label) => (
              <button
                key={label}
                onClick={() => {
                  const now = new Date();
                  if (label === 'This Month') {
                    setStartDate(new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]);
                  } else if (label === '7 Days') {
                    setStartDate(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
                  } else {
                    setStartDate(new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
                  }
                  setEndDate(now.toISOString().split('T')[0]);
                }}
                className="px-3 py-1.5 text-xs font-medium text-text-secondary rounded-md border border-border-light hover:bg-surface-hover transition-colors"
              >
                {label}
              </button>
            ))}
          </div>

          {/* Refresh */}
          <button
            onClick={fetchGuardrails}
            disabled={loading}
            className="flex items-center gap-2 rounded-lg bg-[var(--surface-submit)] px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            Refresh
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              onClick={stat.onClick}
              className={cn(
                'rounded-xl border border-border-light bg-surface-secondary p-4 transition-all',
                stat.onClick && 'cursor-pointer hover:border-[var(--surface-submit)] hover:shadow-lg'
              )}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-text-secondary">{stat.label}</p>
                  <p className="mt-1 text-2xl font-bold text-text-primary">
                    {formatNumber(stat.value)}
                  </p>
                </div>
                <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', stat.bg)}>
                  <Icon className={cn('h-5 w-5', stat.color)} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Block Rate & User/Conversation Stats */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border-light bg-surface-secondary p-4">
          <p className="text-xs font-medium text-text-secondary">Block Rate</p>
          <p className="mt-1 text-2xl font-bold text-red-400">
            {guardrailsData?.summary?.blockRate ?? 0}%
          </p>
        </div>
        <div className="rounded-xl border border-border-light bg-surface-secondary p-4">
          <p className="text-xs font-medium text-text-secondary">Passed</p>
          <p className="mt-1 text-2xl font-bold text-green-400">
            {formatNumber(guardrailsData?.summary?.passed ?? 0)}
          </p>
        </div>
        <div className="rounded-xl border border-border-light bg-surface-secondary p-4">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-text-tertiary" />
            <p className="text-xs font-medium text-text-secondary">Users Affected</p>
          </div>
          <p className="mt-1 text-2xl font-bold text-text-primary">
            {formatNumber(guardrailsData?.summary?.userCount ?? 0)}
          </p>
        </div>
        <div className="rounded-xl border border-border-light bg-surface-secondary p-4">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-text-tertiary" />
            <p className="text-xs font-medium text-text-secondary">Conversations</p>
          </div>
          <p className="mt-1 text-2xl font-bold text-text-primary">
            {formatNumber(guardrailsData?.summary?.conversationCount ?? 0)}
          </p>
        </div>
      </div>

      {/* Trend Chart */}
      <div className="rounded-xl border border-border-light bg-surface-secondary p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-text-primary">Guardrails Activity Trend</h3>
            <p className="text-xs text-text-secondary">Blocked, intervened, and anonymized events over time</p>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1">
              <div className="h-2 w-2 rounded-full bg-red-500" />
              <span className="text-text-secondary">Blocked</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="h-2 w-2 rounded-full bg-yellow-500" />
              <span className="text-text-secondary">Intervened</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="h-2 w-2 rounded-full bg-blue-500" />
              <span className="text-text-secondary">Anonymized</span>
            </div>
          </div>
        </div>
        {trendData.length > 0 ? (
          <AdminMultiBarChart
            data={trendData}
            dataKeys={[
              { key: 'blocked', color: CHART_COLORS.danger, name: 'Blocked' },
              { key: 'intervened', color: CHART_COLORS.warning, name: 'Intervened' },
              { key: 'anonymized', color: CHART_COLORS.info, name: 'Anonymized' },
            ]}
            height={250}
            formatter={formatNumber}
            stacked={true}
          />
        ) : (
          <div className="flex h-[250px] items-center justify-center text-text-tertiary text-sm">
            No guardrails activity data available
          </div>
        )}
      </div>

      {/* Violation Breakdown by Type Chart */}
      {violationBreakdownData.length > 0 && (
        <div className="rounded-xl border border-border-light bg-surface-secondary p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-text-primary">Violation Breakdown by Type</h3>
              <p className="text-xs text-text-secondary">PII, toxicity, and other violation types</p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <div className="flex items-center gap-1">
                <div className="h-2 w-2 rounded-full bg-red-500" />
                <span className="text-text-secondary">Blocked</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="h-2 w-2 rounded-full bg-yellow-500" />
                <span className="text-text-secondary">Intervened</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="h-2 w-2 rounded-full bg-blue-500" />
                <span className="text-text-secondary">Anonymized</span>
              </div>
            </div>
          </div>
          <AdminMultiBarChart
            data={violationBreakdownData}
            dataKeys={[
              { key: 'blocked', color: CHART_COLORS.danger, name: 'Blocked' },
              { key: 'intervened', color: CHART_COLORS.warning, name: 'Intervened' },
              { key: 'anonymized', color: CHART_COLORS.info, name: 'Anonymized' },
            ]}
            height={200}
            formatter={formatNumber}
            stacked={true}
          />
        </div>
      )}

      {/* Violations Table */}
      <div className="rounded-xl border border-border-light bg-surface-secondary">
        <div className="flex items-center justify-between border-b border-border-light p-4">
          <div className="flex items-center gap-2">
            <ShieldX className="h-5 w-5 text-red-400" />
            <h3 className="text-base font-semibold text-text-primary">Violation Breakdown</h3>
          </div>
        </div>
        <div className="p-4">
          {guardrailsData?.violations && guardrailsData.violations.length > 0 ? (
            <AdminDataTable
              columns={columns}
              data={guardrailsData.violations}
              searchPlaceholder="Search violations..."
              searchColumn="category"
            />
          ) : (
            <div className="flex h-32 items-center justify-center text-text-tertiary text-sm">
              No violations recorded in this period
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default GuardrailsPage;
