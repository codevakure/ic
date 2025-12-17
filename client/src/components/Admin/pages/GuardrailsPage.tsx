/**
 * Admin Guardrails Page
 * 
 * Guardrails usage metrics and analytics - showing blocked, intervened, and anonymized events.
 * Uses split API calls: summary (fast) + details (slower) for progressive loading.
 * Leverages Recoil store for caching across navigation.
 */
import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ColumnDef } from '@tanstack/react-table';
import {
  Shield,
  ShieldX,
  ShieldAlert,
  ShieldCheck,
  Users,
  MessageSquare,
  ArrowRight,
} from 'lucide-react';
import { AdminDataTable, SortableHeader } from '../components/DataTable';
import { AdminMultiBarChart, CHART_COLORS } from '../components/Charts';
import { AdminDateRangePicker } from '../components/AdminDateRangePicker';
import { useGuardrailsMetrics } from '../hooks/useAdminMetrics';
import { StatsGridSkeleton, ChartSkeleton } from '../components/Skeletons';
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

  // Date filters - default to today for faster page load
  const [startDate, setStartDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });

  // Handle date change from the picker
  const handleDateChange = useCallback(({ startDate: start, endDate: end }: { startDate: string; endDate: string }) => {
    setStartDate(start);
    setEndDate(end);
  }, []);

  // Use the cached hook for split API calls
  const {
    summary,
    summaryLoading,
    summaryError,
    violations,
    violationBreakdown,
    trend,
    detailsLoading,
    detailsError,
    refetch,
  } = useGuardrailsMetrics({ startDate, endDate });

  // Combined loading state
  const isLoading = summaryLoading || detailsLoading;
  const error = summaryError || detailsError;

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  // Chart data for trend with all 3 categories
  const trendData = useMemo(() => {
    if (!trend?.length) return [];
    return trend.map(d => ({
      name: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      blocked: d.blocked,
      intervened: d.intervened,
      anonymized: d.anonymized,
    }));
  }, [trend]);

  // Violation breakdown data for stacked chart
  const violationBreakdownData = useMemo(() => {
    if (!violationBreakdown?.length) return [];
    return violationBreakdown.map(v => ({
      name: v.type,
      blocked: v.blocked,
      intervened: v.intervened,
      anonymized: v.anonymized,
    }));
  }, [violationBreakdown]);

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

  // Summary stats cards - memoized for performance
  const stats = useMemo(() => [
    {
      label: 'Total Events',
      value: summary?.totalEvents ?? 0,
      icon: Shield,
      color: 'text-blue-400',
      bg: 'bg-blue-500/10',
    },
    {
      label: 'Blocked',
      value: summary?.blocked ?? 0,
      icon: ShieldX,
      color: 'text-red-400',
      bg: 'bg-red-500/10',
      onClick: () => navigate('/admin/traces?guardrails=blocked'),
    },
    {
      label: 'Intervened',
      value: summary?.intervened ?? 0,
      icon: ShieldAlert,
      color: 'text-yellow-400',
      bg: 'bg-yellow-500/10',
      onClick: () => navigate('/admin/traces?guardrails=intervened'),
    },
    {
      label: 'Anonymized',
      value: summary?.anonymized ?? 0,
      icon: ShieldAlert,
      color: 'text-purple-400',
      bg: 'bg-purple-500/10',
      onClick: () => navigate('/admin/traces?guardrails=anonymized'),
    },
  ], [summary, navigate]);

  // Secondary stats from summary
  const secondaryStats = useMemo(() => ({
    blockRate: summary?.blockRate ?? 0,
    passed: summary?.passed ?? 0,
    userCount: summary?.userCount ?? 0,
    conversationCount: summary?.conversationCount ?? 0,
  }), [summary]);

  // Progressive loading - don't block the whole page, show header immediately
  return (
    <div className="space-y-4 p-4 md:p-5">
      {/* Header with Date Range Picker */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-xl font-bold text-text-primary">Guardrails</h1>
          <p className="text-sm text-text-secondary">
            Content moderation and policy enforcement across all conversations
          </p>
        </div>

        <AdminDateRangePicker
          startDate={startDate}
          endDate={endDate}
          onDateChange={handleDateChange}
          onRefresh={refetch}
          isLoading={isLoading}
        />
      </div>

      {/* Stats Cards */}
      {summaryLoading ? (
        <StatsGridSkeleton count={4} />
      ) : (
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <div
                key={stat.label}
                onClick={stat.onClick}
                className={cn(
                  'rounded-lg border border-border-light bg-surface-secondary p-3 transition-all',
                  stat.onClick && 'cursor-pointer hover:border-[var(--surface-submit)] hover:shadow-lg'
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs text-text-secondary">{stat.label}</span>
                  <div className={cn('rounded-lg p-1.5', stat.bg)}>
                    <Icon className={cn('h-3.5 w-3.5', stat.color)} />
                  </div>
                </div>
                <p className="mt-1 text-xl font-bold text-text-primary">
                  {formatNumber(stat.value)}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {/* Block Rate & User/Conversation Stats - Show skeleton while loading summary */}
      {summaryLoading ? (
        <StatsGridSkeleton count={4} />
      ) : (
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-border-light bg-surface-secondary p-3">
            <span className="text-xs text-text-secondary">Block Rate</span>
            <p className="mt-1 text-xl font-bold text-red-400">
              {secondaryStats.blockRate}%
            </p>
          </div>
          <div className="rounded-lg border border-border-light bg-surface-secondary p-3">
            <span className="text-xs text-text-secondary">Passed</span>
            <p className="mt-1 text-xl font-bold text-green-400">
              {formatNumber(secondaryStats.passed)}
            </p>
          </div>
          <div className="rounded-lg border border-border-light bg-surface-secondary p-3">
            <div className="flex items-center gap-1">
              <Users className="h-3 w-3 text-text-tertiary" />
              <span className="text-xs text-text-secondary">Users Affected</span>
            </div>
            <p className="mt-1 text-xl font-bold text-text-primary">
              {formatNumber(secondaryStats.userCount)}
            </p>
          </div>
          <div className="rounded-lg border border-border-light bg-surface-secondary p-3">
            <div className="flex items-center gap-1">
              <MessageSquare className="h-3 w-3 text-text-tertiary" />
              <span className="text-xs text-text-secondary">Conversations</span>
            </div>
            <p className="mt-1 text-xl font-bold text-text-primary">
              {formatNumber(secondaryStats.conversationCount)}
            </p>
          </div>
        </div>
      )}

      {/* Trend Chart - Show skeleton while loading details */}
      {detailsLoading ? (
        <ChartSkeleton height={220} />
      ) : (
        <div className="rounded-lg border border-border-light bg-surface-primary p-4">
          <div className="mb-3 flex items-center justify-between">
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
      )}

      {/* Violation Breakdown by Type Chart - Show skeleton while loading details */}
      {detailsLoading ? (
        <ChartSkeleton height={200} />
      ) : violationBreakdownData.length > 0 ? (
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
      ) : null}

      {/* Violations Table - Show skeleton while loading details */}
      {detailsLoading ? (
        <div className="rounded-xl border border-border-light bg-surface-secondary">
          <div className="flex items-center justify-between border-b border-border-light p-4">
            <div className="flex items-center gap-2">
              <ShieldX className="h-5 w-5 text-red-400" />
              <h3 className="text-base font-semibold text-text-primary">Violation Breakdown</h3>
            </div>
          </div>
          <div className="p-4">
            <div className="animate-pulse space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-10 bg-surface-tertiary rounded" />
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-border-light bg-surface-secondary">
          <div className="flex items-center justify-between border-b border-border-light p-4">
            <div className="flex items-center gap-2">
              <ShieldX className="h-5 w-5 text-red-400" />
              <h3 className="text-base font-semibold text-text-primary">Violation Breakdown</h3>
            </div>
          </div>
          <div className="p-4">
            {violations && violations.length > 0 ? (
              <AdminDataTable
                columns={columns}
                data={violations}
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
      )}
    </div>
  );
}

export default GuardrailsPage;
