/**
 * Admin Costs Page
 * 
 * Cost breakdown by model with date filtering.
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ColumnDef } from '@tanstack/react-table';
import {
  DollarSign,
  TrendingUp,
  Cpu,
  ArrowUpRight,
  ArrowDownRight,
  Zap,
  Database,
  Clock,
} from 'lucide-react';
import { AdminDataTable, SortableHeader } from '../components/DataTable';
import { AdminDateRangePicker } from '../components/AdminDateRangePicker';
import { dashboardApi, type CostsMetrics } from '../services/adminApi';
import { CostsPageSkeleton, StatsGridSkeleton } from '../components/Skeletons';
import { cn } from '~/utils';

interface ModelCost {
  model: string;
  displayName: string;
  inputTokens: number;
  outputTokens: number;
  cacheWriteTokens: number;
  cacheReadTokens: number;
  totalTokens: number;
  inputCost: number;
  outputCost: number;
  cacheWriteCost: number;
  cacheReadCost: number;
  totalCost: number;
  cacheSavings: number;
  requestCount: number;
  totalDuration: number;
  avgDuration: number;
}

// Model display names
const MODEL_DISPLAY_NAMES: Record<string, string> = {
  'us.amazon.nova-micro-v1:0': 'Amazon Nova Micro',
  'us.anthropic.claude-haiku-4-5-20251001-v1:0': 'Claude Haiku 4.5',
  'us.anthropic.claude-sonnet-4-5-20250929-v1:0': 'Claude Sonnet 4.5',
  'global.anthropic.claude-opus-4-5-20251101-v1:0': 'Claude Opus 4.5',
  'global.amazon.nova-2-lite-v1:0': 'Amazon Nova 2 Lite',
};

function CostsPage() {
  const navigate = useNavigate();
  // State
  const [loading, setLoading] = useState(true);
  const [costsData, setCostsData] = useState<CostsMetrics | null>(null);

  // Date filters - default to today for faster initial load
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

  const fetchCosts = useCallback(async () => {
    setLoading(true);
    try {
      const data = await dashboardApi.getCostsMetrics({ startDate, endDate });
      setCostsData(data);
    } catch (error) {
      console.error('Failed to fetch costs:', error);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    fetchCosts();
  }, [fetchCosts]);

  // Transform data for table
  const modelCosts: ModelCost[] = useMemo(() => {
    if (!costsData?.byModel) return [];
    
    return costsData.byModel.map((model) => ({
      model: model.model,
      displayName: MODEL_DISPLAY_NAMES[model.model] || model.name || model.model,
      inputTokens: model.inputTokens || 0,
      outputTokens: model.outputTokens || 0,
      cacheWriteTokens: model.cacheWriteTokens || 0,
      cacheReadTokens: model.cacheReadTokens || 0,
      totalTokens: model.totalTokens || 0,
      inputCost: model.inputCost || 0,
      outputCost: model.outputCost || 0,
      cacheWriteCost: model.cacheWriteCost || 0,
      cacheReadCost: model.cacheReadCost || 0,
      totalCost: model.totalCost || 0,
      cacheSavings: model.cacheSavings || 0,
      requestCount: model.transactions || 0,
      totalDuration: model.totalDuration || 0,
      avgDuration: model.avgDuration || 0,
    }));
  }, [costsData]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 4,
      maximumFractionDigits: 4,
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  const formatCompact = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(2)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`;
    return `${(ms / 3600000).toFixed(1)}h`;
  };

  // Table columns
  const columns: ColumnDef<ModelCost>[] = useMemo(
    () => [
      {
        accessorKey: 'displayName',
        header: ({ column }) => <SortableHeader column={column}>Model</SortableHeader>,
        cell: ({ row }) => (
          <div 
            className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => navigate(`/admin/traces?model=${encodeURIComponent(row.original.model)}`)}
            title="Click to view traces for this model"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-tertiary">
              <Cpu className="h-4 w-4 text-text-secondary" />
            </div>
            <div>
              <p className="font-medium text-text-primary hover:text-blue-400 transition-colors">{row.original.displayName}</p>
              <p className="text-xs text-text-tertiary font-mono">{row.original.model}</p>
            </div>
          </div>
        ),
      },
      {
        accessorKey: 'inputTokens',
        header: ({ column }) => <SortableHeader column={column}>Input</SortableHeader>,
        cell: ({ row }) => (
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5">
              <ArrowDownRight className="h-3.5 w-3.5 text-blue-500" />
              <span className="text-sm text-text-secondary">{formatCompact(row.original.inputTokens)}</span>
            </div>
            <div className="text-xs text-blue-600 dark:text-blue-400">{formatCurrency(row.original.inputCost)}</div>
          </div>
        ),
      },
      {
        accessorKey: 'outputTokens',
        header: ({ column }) => <SortableHeader column={column}>Output</SortableHeader>,
        cell: ({ row }) => (
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5">
              <ArrowUpRight className="h-3.5 w-3.5 text-green-500" />
              <span className="text-sm text-text-secondary">{formatCompact(row.original.outputTokens)}</span>
            </div>
            <div className="text-xs text-green-600 dark:text-green-400">{formatCurrency(row.original.outputCost)}</div>
          </div>
        ),
      },
      {
        accessorKey: 'cacheWriteTokens',
        header: ({ column }) => <SortableHeader column={column}>Cache Write</SortableHeader>,
        cell: ({ row }) => (
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5">
              <Database className="h-3.5 w-3.5 text-purple-500" />
              <span className="text-sm text-text-secondary">{formatCompact(row.original.cacheWriteTokens)}</span>
            </div>
            <div className="text-xs text-purple-600 dark:text-purple-400">{formatCurrency(row.original.cacheWriteCost)}</div>
          </div>
        ),
      },
      {
        accessorKey: 'cacheReadTokens',
        header: ({ column }) => <SortableHeader column={column}>Cache Read</SortableHeader>,
        cell: ({ row }) => (
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5 text-yellow-500" />
              <span className="text-sm text-text-secondary">{formatCompact(row.original.cacheReadTokens)}</span>
            </div>
            <div className="text-xs text-yellow-600 dark:text-yellow-400">{formatCurrency(row.original.cacheReadCost)}</div>
          </div>
        ),
      },
      {
        accessorKey: 'totalCost',
        header: ({ column }) => <SortableHeader column={column}>Total Cost</SortableHeader>,
        cell: ({ row }) => (
          <div className="space-y-0.5">
            <span className="text-sm font-bold text-text-primary">
              {formatCurrency(row.original.totalCost)}
            </span>
            {row.original.cacheSavings > 0 && (
              <div className="text-xs text-green-500">
                Saved: {formatCurrency(row.original.cacheSavings)}
              </div>
            )}
          </div>
        ),
      },
      {
        accessorKey: 'requestCount',
        header: 'Requests',
        cell: ({ row }) => (
          <span className="rounded-full bg-surface-tertiary px-2 py-0.5 text-xs font-medium text-text-secondary">
            {formatNumber(row.original.requestCount)}
          </span>
        ),
      },
      {
        accessorKey: 'totalDuration',
        header: ({ column }) => <SortableHeader column={column}>Total Duration</SortableHeader>,
        cell: ({ row }) => (
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-cyan-500" />
              <span className="text-sm text-text-secondary">{formatDuration(row.original.totalDuration)}</span>
            </div>
            {row.original.avgDuration > 0 && (
              <div className="text-xs text-text-tertiary">
                Avg: {formatDuration(row.original.avgDuration)}
              </div>
            )}
          </div>
        ),
      },
    ],
    [navigate]
  );

  // Stats cards data - always show cache tokens (even if 0)
  const stats = useMemo(() => {
    if (!costsData?.summary) return [];
    const hasCacheSavings = (costsData.summary.totalCacheSavings || 0) > 0;
    
    return [
      {
        label: 'Total Cost',
        value: formatCurrency(costsData.summary.totalCost || 0),
        subValue: hasCacheSavings
          ? `Saved: ${formatCurrency(costsData.summary.totalCacheSavings)}`
          : undefined,
        icon: DollarSign,
        color: 'text-green-600 dark:text-green-400',
        bgColor: 'bg-green-500/10',
      },
      {
        label: 'Input Tokens',
        value: formatCompact(costsData.summary.totalInputTokens || 0),
        subValue: formatCurrency(costsData.summary.totalInputCost || 0),
        icon: ArrowDownRight,
        color: 'text-blue-600 dark:text-blue-400',
        bgColor: 'bg-blue-500/10',
      },
      {
        label: 'Output Tokens',
        value: formatCompact(costsData.summary.totalOutputTokens || 0),
        subValue: formatCurrency(costsData.summary.totalOutputCost || 0),
        icon: ArrowUpRight,
        color: 'text-purple-600 dark:text-purple-400',
        bgColor: 'bg-purple-500/10',
      },
      {
        label: 'Cache Write',
        value: formatCompact(costsData.summary.totalCacheWriteTokens || 0),
        subValue: formatCurrency(costsData.summary.totalCacheWriteCost || 0),
        icon: Database,
        color: 'text-orange-600 dark:text-orange-400',
        bgColor: 'bg-orange-500/10',
      },
      {
        label: 'Cache Read',
        value: formatCompact(costsData.summary.totalCacheReadTokens || 0),
        subValue: formatCurrency(costsData.summary.totalCacheReadCost || 0),
        icon: Zap,
        color: 'text-yellow-600 dark:text-yellow-400',
        bgColor: 'bg-yellow-500/10',
      },
      {
        label: 'Total Duration',
        value: formatDuration(costsData.summary.totalDuration || 0),
        subValue: `${formatNumber(costsData.summary.totalTransactions || 0)} requests`,
        icon: Clock,
        color: 'text-cyan-600 dark:text-cyan-400',
        bgColor: 'bg-cyan-500/10',
      },
      {
        label: 'Models Used',
        value: modelCosts.length.toString(),
        subValue: undefined,
        icon: Cpu,
        color: 'text-indigo-600 dark:text-indigo-400',
        bgColor: 'bg-indigo-500/10',
      },
    ];
  }, [costsData, modelCosts]);

  // Show full skeleton on initial load OR when filter changes and data is loading
  if (loading) {
    return <CostsPageSkeleton />;
  }

  return (
    <div className="space-y-4 p-4 md:p-5">
      {/* Page Header with Date Picker */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-text-primary">Costs</h1>
          <p className="text-sm text-text-secondary">
            Cost breakdown by model with detailed token usage
          </p>
        </div>
        <AdminDateRangePicker
          startDate={startDate}
          endDate={endDate}
          onDateChange={handleDateChange}
          onRefresh={fetchCosts}
          isLoading={loading}
        />
      </div>

      {/* Stats Cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        {stats.map((stat, index) => (
          <div
            key={index}
            className="rounded-lg border border-border-light bg-surface-secondary p-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs text-text-secondary">{stat.label}</span>
              <div className={cn('rounded-lg p-1.5', stat.bgColor)}>
                <stat.icon className={cn('h-3.5 w-3.5', stat.color)} />
              </div>
            </div>
            <p className="mt-1 text-xl font-bold text-text-primary">{stat.value}</p>
            {stat.subValue && (
              <p className="text-xs text-text-tertiary">{stat.subValue}</p>
            )}
          </div>
        ))}
      </div>

      {/* Models Table */}
      <div className="rounded-lg border border-border-light bg-surface-primary">
        <div className="border-b border-border-light p-3">
          <h2 className="flex items-center gap-2 text-base font-semibold text-text-primary">
            <TrendingUp className="h-4 w-4" />
            Cost Breakdown by Model
          </h2>
        </div>
        <div className="p-3">
          <AdminDataTable
            columns={columns}
            data={modelCosts}
            isLoading={loading}
            emptyMessage="No cost data available for the selected date range"
          />
        </div>
        
        {/* Pricing Reference */}
        <div className="border-t border-border-light bg-surface-secondary/50 p-4">
          <h3 className="text-sm font-semibold text-text-primary mb-3">Pricing Reference (per 1M tokens)</h3>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <div className="flex items-center justify-between rounded-lg bg-surface-tertiary px-3 py-2">
              <span className="text-sm text-text-secondary">Amazon Nova Micro</span>
              <span className="text-xs text-text-tertiary">$0.035 in / $0.14 out</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-surface-tertiary px-3 py-2">
              <span className="text-sm text-text-secondary">Amazon Nova Lite</span>
              <span className="text-xs text-text-tertiary">$0.06 in / $0.24 out</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-surface-tertiary px-3 py-2">
              <span className="text-sm text-text-secondary">Claude Haiku 4.5</span>
              <span className="text-xs text-text-tertiary">$1.00 in / $5.00 out</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-surface-tertiary px-3 py-2">
              <span className="text-sm text-text-secondary">Claude Sonnet 4.5</span>
              <span className="text-xs text-text-tertiary">$3.00 in / $15.00 out</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-surface-tertiary px-3 py-2">
              <span className="text-sm text-text-secondary">Claude Opus 4.5</span>
              <span className="text-xs text-text-tertiary">$5.00 in / $25.00 out</span>
            </div>
          </div>
          <p className="mt-2 text-xs text-text-tertiary">
            * Costs calculated using AWS Bedrock pricing. Prices may vary based on region and usage tier.
          </p>
        </div>
      </div>
    </div>
  );
}

export default CostsPage;
