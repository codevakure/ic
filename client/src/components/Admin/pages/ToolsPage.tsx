import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Wrench,
  RefreshCw,
  Calendar,
  TrendingUp,
  CheckCircle,
  XCircle,
  Activity,
  Zap,
  ArrowRight,
} from 'lucide-react';
import { Button, Spinner } from '@librechat/client';
import { dashboardApi, type ToolMetrics, type ToolUsage } from '../services/adminApi';
import { AdminBarChart, CHART_COLORS } from '../components/Charts';

function ToolsPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<ToolMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Date filter state
  const [dateRange, setDateRange] = useState<{ startDate?: string; endDate?: string }>({});

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await dashboardApi.getToolMetrics(dateRange);
      setData(response);
      setError(null);
    } catch (err) {
      setError('Failed to load tools metrics');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDateChange = (type: 'start' | 'end', value: string) => {
    setDateRange(prev => ({
      ...prev,
      [type === 'start' ? 'startDate' : 'endDate']: value || undefined,
    }));
  };

  const navigateToTraces = (toolName?: string) => {
    const params = new URLSearchParams();
    if (toolName) {
      params.set('toolName', toolName);
    }
    navigate(`/admin/traces?${params.toString()}`);
  };

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner className="text-orange-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center text-red-400 py-8">
        {error}
        <Button variant="outline" onClick={fetchData} className="mt-4">
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 md:p-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)] flex items-center gap-2">
            <Wrench className="h-7 w-7 text-orange-500" />
            Tools Analytics
          </h1>
          <p className="text-[var(--text-secondary)] mt-1">
            Monitor tool usage patterns, success rates, and invocation trends
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={fetchData}
            disabled={loading}
            className="border-[var(--border-light)]"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
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

      {/* Date Filters */}
      <div className="bg-[var(--surface-primary)] rounded-xl border border-[var(--border-light)] p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-[var(--text-tertiary)]" />
            <span className="text-sm text-[var(--text-secondary)]">Date Range:</span>
          </div>
          <input
            type="date"
            value={dateRange.startDate || ''}
            onChange={(e) => handleDateChange('start', e.target.value)}
            className="px-3 py-2 bg-[var(--surface-secondary)] border border-[var(--border-light)] rounded-lg text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
          <span className="text-[var(--text-tertiary)]">to</span>
          <input
            type="date"
            value={dateRange.endDate || ''}
            onChange={(e) => handleDateChange('end', e.target.value)}
            className="px-3 py-2 bg-[var(--surface-secondary)] border border-[var(--border-light)] rounded-lg text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
          {(dateRange.startDate || dateRange.endDate) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDateRange({})}
              className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
            >
              Clear
            </Button>
          )}
        </div>
      </div>

      {data && (
        <>
          {/* Summary Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Total Invocations */}
            <div className="bg-[var(--surface-primary)] rounded-xl border border-[var(--border-light)] p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-500/20">
                  <Zap className="h-5 w-5 text-orange-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-[var(--text-primary)]">
                    {(data.summary?.totalInvocations || 0).toLocaleString()}
                  </p>
                  <p className="text-sm text-[var(--text-secondary)]">Total Invocations</p>
                </div>
              </div>
            </div>

            {/* Total Tools */}
            <div className="bg-[var(--surface-primary)] rounded-xl border border-[var(--border-light)] p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/20">
                  <Wrench className="h-5 w-5 text-blue-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-[var(--text-primary)]">
                    {data.summary?.totalTools || 0}
                  </p>
                  <p className="text-sm text-[var(--text-secondary)]">Unique Tools</p>
                </div>
              </div>
            </div>

            {/* Success Rate */}
            <div className="bg-[var(--surface-primary)] rounded-xl border border-[var(--border-light)] p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/20">
                  <CheckCircle className="h-5 w-5 text-green-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-[var(--text-primary)]">
                    {data.summary?.avgSuccessRate !== undefined 
                      ? `${(data.summary.avgSuccessRate * 100).toFixed(1)}%` 
                      : 'N/A'}
                  </p>
                  <p className="text-sm text-[var(--text-secondary)]">Avg Success Rate</p>
                </div>
              </div>
            </div>

            {/* Most Used Tool */}
            <div className="bg-[var(--surface-primary)] rounded-xl border border-[var(--border-light)] p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/20">
                  <TrendingUp className="h-5 w-5 text-purple-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-lg font-bold text-[var(--text-primary)] truncate" title={data.summary?.mostUsedTool}>
                    {data.summary?.mostUsedTool || 'N/A'}
                  </p>
                  <p className="text-sm text-[var(--text-secondary)]">Most Used Tool</p>
                </div>
              </div>
            </div>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Tool Usage Chart */}
            <div className="bg-[var(--surface-primary)] rounded-xl border border-[var(--border-light)] p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-[var(--text-primary)]">Tool Usage</h3>
              </div>
              {data.tools && data.tools.length > 0 ? (
                <AdminBarChart
                  data={data.tools.slice(0, 10).map(t => ({
                    name: (t.displayName || t.toolName).length > 20 ? (t.displayName || t.toolName).substring(0, 20) + '...' : (t.displayName || t.toolName),
                    value: t.invocations,
                  }))}
                  height={280}
                  color={CHART_COLORS.orange}
                />
              ) : (
                <div className="flex items-center justify-center h-[280px] text-[var(--text-tertiary)]">
                  No tool usage data available
                </div>
              )}
            </div>

            {/* Trend Chart */}
            <div className="bg-[var(--surface-primary)] rounded-xl border border-[var(--border-light)] p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-[var(--text-primary)]">Usage Trend</h3>
              </div>
              {data.trend && data.trend.length > 0 ? (
                <AdminBarChart
                  data={data.trend.map(t => ({
                    name: new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                    value: t.count,
                  }))}
                  height={280}
                  color={CHART_COLORS.primary}
                />
              ) : (
                <div className="flex items-center justify-center h-[280px] text-[var(--text-tertiary)]">
                  No trend data available
                </div>
              )}
            </div>
          </div>

          {/* Tools Table */}
          <div className="bg-[var(--surface-primary)] rounded-xl border border-[var(--border-light)] overflow-hidden">
            <div className="px-5 py-4 border-b border-[var(--border-light)]">
              <h3 className="text-lg font-semibold text-[var(--text-primary)]">All Tools</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-[var(--surface-secondary)]">
                    <th className="px-5 py-3 text-left text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">
                      Tool Name
                    </th>
                    <th className="px-5 py-3 text-right text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">
                      Invocations
                    </th>
                    <th className="px-5 py-3 text-right text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">
                      Success Rate
                    </th>
                    <th className="px-5 py-3 text-right text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">
                      Avg Duration
                    </th>
                    <th className="px-5 py-3 text-center text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-light)]">
                  {data.tools && data.tools.length > 0 ? (
                    data.tools.map((tool, idx) => {
                      const successRate = tool.invocations > 0 
                        ? tool.successCount / tool.invocations 
                        : undefined;
                      return (
                        <tr key={idx} className="hover:bg-[var(--surface-secondary)] transition-colors">
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-500/20">
                                <Wrench className="h-4 w-4 text-orange-400" />
                              </div>
                              <div>
                                <span className="text-sm font-medium text-[var(--text-primary)]">
                                  {tool.displayName || tool.toolName}
                                </span>
                                {tool.category && (
                                  <p className="text-xs text-[var(--text-tertiary)]">{tool.category}</p>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-4 text-right">
                            <span className="text-sm font-semibold text-[var(--text-primary)]">
                              {tool.invocations.toLocaleString()}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-right">
                            {successRate !== undefined ? (
                              <span className={`inline-flex items-center gap-1 text-sm font-medium ${
                                successRate >= 0.9 ? 'text-green-400' : 
                                successRate >= 0.7 ? 'text-yellow-400' : 'text-red-400'
                              }`}>
                                {successRate >= 0.9 ? <CheckCircle className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                                {(successRate * 100).toFixed(1)}%
                              </span>
                            ) : (
                              <span className="text-sm text-[var(--text-tertiary)]">N/A</span>
                            )}
                          </td>
                          <td className="px-5 py-4 text-right">
                            <span className="text-sm text-[var(--text-secondary)]">
                              {tool.avgDuration ? `${tool.avgDuration.toFixed(0)}ms` : 'N/A'}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-center">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => navigateToTraces(tool.toolName)}
                              className="text-blue-400 hover:text-blue-300"
                            >
                              View Traces
                              <ArrowRight className="h-3.5 w-3.5 ml-1" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-5 py-8 text-center text-[var(--text-tertiary)]">
                        No tools data available
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default ToolsPage;
