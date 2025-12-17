/**
 * Tools Analytics Page
 * 
 * Uses split API calls: summary (fast) + details (slower) for progressive loading.
 * Leverages Recoil store for caching across navigation.
 */
import React, { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Wrench,
  TrendingUp,
  CheckCircle,
  XCircle,
  Activity,
  Zap,
  ArrowRight,
} from 'lucide-react';
import { Button } from '@librechat/client';
import { useToolMetrics } from '../hooks/useAdminMetrics';
import { AdminBarChart, CHART_COLORS } from '../components/Charts';
import { AdminDateRangePicker } from '../components/AdminDateRangePicker';
import { StatsGridSkeleton, ChartSkeleton } from '../components/Skeletons';

function ToolsPage() {
  const navigate = useNavigate();
  
  // Date filter state - default to today for faster page load
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
    tools,
    trend,
    detailsLoading,
    detailsError,
    refetch,
  } = useToolMetrics({ startDate, endDate });

  // Combined loading state
  const isLoading = summaryLoading || detailsLoading;
  const error = summaryError || detailsError;

  const navigateToTraces = (toolName?: string) => {
    const params = new URLSearchParams();
    if (toolName) {
      params.set('toolName', toolName);
    }
    navigate(`/admin/traces?${params.toString()}`);
  };

  // Memoize computed summary values for stats cards
  const statsData = useMemo(() => ({
    totalInvocations: summary?.totalInvocations || 0,
    totalTools: summary?.totalTools || 0,
    avgSuccessRate: summary?.avgSuccessRate,
    mostUsedTool: summary?.mostUsedTool || 'N/A',
  }), [summary]);

  // Error state - show inline error, not full page block
  const renderError = () => (
    <div className="text-center text-red-400 py-8">
      {error}
      <Button variant="outline" onClick={refetch} className="mt-4">
        Retry
      </Button>
    </div>
  );

  // Progressive loading - show page structure immediately
  return (
    <div className="space-y-4 p-4 md:p-5">
      {/* Header with Date Range Picker */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-text-primary flex items-center gap-2">
            <Wrench className="h-5 w-5 text-orange-500" />
            Tools Analytics
          </h1>
          <p className="text-sm text-text-secondary">
            Monitor tool usage patterns, success rates, and invocation trends
          </p>
        </div>
        <div className="flex items-center gap-3">
          <AdminDateRangePicker
            startDate={startDate}
            endDate={endDate}
            onDateChange={handleDateChange}
            onRefresh={refetch}
            isLoading={isLoading}
          />
          <Button
            variant="outline"
            onClick={() => navigateToTraces()}
            className="border-[var(--border-light)]"
          >
            <Activity className="h-4 w-4 mr-2" />
            View All Traces
          </Button>
        </div>
      </div>

      {/* Show error inline if any */}
      {error && renderError()}

      {/* Summary Stats - Show skeleton while loading summary */}
      {summaryLoading ? (
        <StatsGridSkeleton count={4} />
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {/* Total Invocations */}
          <div className="rounded-lg border border-border-light bg-surface-secondary p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-text-secondary">Total Invocations</span>
              <div className="rounded-lg p-1.5 bg-orange-500/10">
                <Zap className="h-3.5 w-3.5 text-orange-400" />
              </div>
            </div>
            <p className="mt-1 text-xl font-bold text-text-primary">
              {statsData.totalInvocations.toLocaleString()}
            </p>
          </div>

          {/* Unique Tools */}
          <div className="rounded-lg border border-border-light bg-surface-secondary p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-text-secondary">Unique Tools</span>
              <div className="rounded-lg p-1.5 bg-blue-500/10">
                <Wrench className="h-3.5 w-3.5 text-blue-400" />
              </div>
            </div>
            <p className="mt-1 text-xl font-bold text-text-primary">
              {statsData.totalTools}
            </p>
          </div>

          {/* Avg Success Rate */}
          <div className="rounded-lg border border-border-light bg-surface-secondary p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-text-secondary">Avg Success Rate</span>
              <div className="rounded-lg p-1.5 bg-green-500/10">
                <CheckCircle className="h-3.5 w-3.5 text-green-400" />
              </div>
            </div>
            <p className="mt-1 text-xl font-bold text-text-primary">
              {statsData.avgSuccessRate !== undefined 
                ? `${(statsData.avgSuccessRate * 100).toFixed(1)}%` 
                : 'N/A'}
            </p>
          </div>

          {/* Most Used Tool */}
          <div className="rounded-lg border border-border-light bg-surface-secondary p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-text-secondary">Most Used Tool</span>
              <div className="rounded-lg p-1.5 bg-purple-500/10">
                <TrendingUp className="h-3.5 w-3.5 text-purple-400" />
              </div>
            </div>
            <p className="mt-1 text-xl font-bold text-text-primary truncate" title={statsData.mostUsedTool}>
              {statsData.mostUsedTool}
            </p>
          </div>
        </div>
      )}

      {/* Charts Row - Show skeleton while loading details */}
      {detailsLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartSkeleton height={240} />
          <ChartSkeleton height={240} />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Tool Usage Chart */}
            <div className="rounded-lg border border-border-light bg-surface-primary p-4">
              <h3 className="text-base font-semibold text-text-primary mb-3">Tool Usage</h3>
              {tools.length > 0 ? (
                <AdminBarChart
                  data={tools.slice(0, 10).map(t => ({
                    name: (t.displayName || t.toolName).length > 20 ? (t.displayName || t.toolName).substring(0, 20) + '...' : (t.displayName || t.toolName),
                    value: t.invocations,
                  }))}
                  height={240}
                  color={CHART_COLORS.orange}
                />
              ) : (
                <div className="flex items-center justify-center h-[240px] text-text-tertiary">
                  No tool usage data available
                </div>
              )}
            </div>

            {/* Trend Chart */}
            <div className="rounded-lg border border-border-light bg-surface-primary p-4">
              <h3 className="text-base font-semibold text-text-primary mb-3">Usage Trend</h3>
              {trend.length > 0 ? (
                <AdminBarChart
                  data={trend.map(t => ({
                    name: new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                    value: t.count,
                  }))}
                  height={240}
                  color={CHART_COLORS.primary}
                />
              ) : (
                <div className="flex items-center justify-center h-[240px] text-text-tertiary">
                  No trend data available
                </div>
              )}
            </div>
          </div>
      )}

      {/* Tools Table - Show skeleton while loading details */}
      {detailsLoading ? (
        <div className="bg-[var(--surface-primary)] rounded-xl border border-[var(--border-light)] overflow-hidden">
          <div className="px-5 py-4 border-b border-[var(--border-light)]">
            <h3 className="text-lg font-semibold text-[var(--text-primary)]">All Tools</h3>
          </div>
          <div className="p-5">
            <div className="animate-pulse space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-12 bg-[var(--surface-secondary)] rounded" />
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-border-light bg-surface-primary overflow-hidden">
          <div className="px-4 py-3 border-b border-border-light">
            <h3 className="text-base font-semibold text-text-primary">All Tools</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-surface-secondary">
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-text-secondary uppercase tracking-wider">
                    Tool Name
                  </th>
                  <th className="px-4 py-2.5 text-right text-xs font-medium text-text-secondary uppercase tracking-wider">
                    Invocations
                  </th>
                  <th className="px-4 py-2.5 text-right text-xs font-medium text-text-secondary uppercase tracking-wider">
                    Success Rate
                  </th>
                  <th className="px-4 py-2.5 text-right text-xs font-medium text-text-secondary uppercase tracking-wider">
                    Avg Duration
                  </th>
                  <th className="px-4 py-2.5 text-center text-xs font-medium text-text-secondary uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-light">
                {tools.length > 0 ? (
                  tools.map((tool, idx) => {
                    const successRate = tool.invocations > 0 
                      ? tool.successCount / tool.invocations 
                      : undefined;
                    return (
                      <tr key={idx} className="hover:bg-surface-secondary transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-500/20">
                              <Wrench className="h-3.5 w-3.5 text-orange-400" />
                            </div>
                            <div>
                              <span className="text-sm font-medium text-text-primary">
                                {tool.displayName || tool.toolName}
                              </span>
                              {tool.category && (
                                <p className="text-xs text-text-tertiary">{tool.category}</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-sm font-semibold text-text-primary">
                            {tool.invocations.toLocaleString()}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {successRate !== undefined ? (
                            <span className={`inline-flex items-center gap-1 text-sm font-medium ${
                              successRate >= 0.9 ? 'text-green-400' : 
                              successRate >= 0.7 ? 'text-yellow-400' : 'text-red-400'
                            }`}>
                              {successRate >= 0.9 ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                              {(successRate * 100).toFixed(1)}%
                            </span>
                          ) : (
                            <span className="text-sm text-text-tertiary">N/A</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-sm text-text-secondary">
                            {tool.avgDuration ? `${tool.avgDuration.toFixed(0)}ms` : 'N/A'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigateToTraces(tool.toolName)}
                            className="text-blue-400 hover:text-blue-300 text-xs"
                          >
                            View Traces
                            <ArrowRight className="h-3 w-3 ml-1" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-text-tertiary">
                      No tools data available
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default ToolsPage;
