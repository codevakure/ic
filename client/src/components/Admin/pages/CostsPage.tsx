/**
 * Admin Costs Page
 * 
 * Cost breakdown by model with date filtering.
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import {
  DollarSign,
  RefreshCw,
  Calendar,
  TrendingUp,
  Cpu,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import { AdminDataTable, SortableHeader } from '../components/DataTable';
import { dashboardApi, type CostsMetrics } from '../services/adminApi';
import { cn } from '~/utils';

interface ModelCost {
  model: string;
  displayName: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  inputCost: number;
  outputCost: number;
  totalCost: number;
  requestCount: number;
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
  // State
  const [loading, setLoading] = useState(true);
  const [costsData, setCostsData] = useState<CostsMetrics | null>(null);

  // Date filters - default to current month
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setDate(1);
    return date.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });

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
      totalTokens: model.totalTokens || 0,
      inputCost: model.inputCost || 0,
      outputCost: model.outputCost || 0,
      totalCost: model.totalCost || 0,
      requestCount: model.transactions || 0,
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

  // Table columns
  const columns: ColumnDef<ModelCost>[] = useMemo(
    () => [
      {
        accessorKey: 'displayName',
        header: ({ column }) => <SortableHeader column={column}>Model</SortableHeader>,
        cell: ({ row }) => (
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-tertiary">
              <Cpu className="h-4 w-4 text-text-secondary" />
            </div>
            <div>
              <p className="font-medium text-text-primary">{row.original.displayName}</p>
              <p className="text-xs text-text-tertiary font-mono">{row.original.model}</p>
            </div>
          </div>
        ),
      },
      {
        accessorKey: 'inputTokens',
        header: ({ column }) => <SortableHeader column={column}>Input Tokens</SortableHeader>,
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <ArrowDownRight className="h-4 w-4 text-blue-500" />
            <span className="text-sm text-text-secondary">{formatCompact(row.original.inputTokens)}</span>
          </div>
        ),
      },
      {
        accessorKey: 'outputTokens',
        header: ({ column }) => <SortableHeader column={column}>Output Tokens</SortableHeader>,
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <ArrowUpRight className="h-4 w-4 text-green-500" />
            <span className="text-sm text-text-secondary">{formatCompact(row.original.outputTokens)}</span>
          </div>
        ),
      },
      {
        accessorKey: 'inputCost',
        header: ({ column }) => <SortableHeader column={column}>Input Cost</SortableHeader>,
        cell: ({ row }) => (
          <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
            {formatCurrency(row.original.inputCost)}
          </span>
        ),
      },
      {
        accessorKey: 'outputCost',
        header: ({ column }) => <SortableHeader column={column}>Output Cost</SortableHeader>,
        cell: ({ row }) => (
          <span className="text-sm font-medium text-green-600 dark:text-green-400">
            {formatCurrency(row.original.outputCost)}
          </span>
        ),
      },
      {
        accessorKey: 'totalCost',
        header: ({ column }) => <SortableHeader column={column}>Total Cost</SortableHeader>,
        cell: ({ row }) => (
          <span className="text-sm font-bold text-text-primary">
            {formatCurrency(row.original.totalCost)}
          </span>
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
    ],
    []
  );

  // Stats cards data
  const stats = useMemo(() => {
    if (!costsData?.summary) return [];
    return [
      {
        label: 'Total Cost',
        value: formatCurrency(costsData.summary.totalCost || 0),
        icon: DollarSign,
        color: 'text-green-600 dark:text-green-400',
        bgColor: 'bg-green-500/10',
      },
      {
        label: 'Input Tokens',
        value: formatCompact(costsData.summary.totalInputTokens || 0),
        icon: ArrowDownRight,
        color: 'text-blue-600 dark:text-blue-400',
        bgColor: 'bg-blue-500/10',
      },
      {
        label: 'Output Tokens',
        value: formatCompact(costsData.summary.totalOutputTokens || 0),
        icon: ArrowUpRight,
        color: 'text-purple-600 dark:text-purple-400',
        bgColor: 'bg-purple-500/10',
      },
      {
        label: 'Models Used',
        value: modelCosts.length.toString(),
        icon: Cpu,
        color: 'text-orange-600 dark:text-orange-400',
        bgColor: 'bg-orange-500/10',
      },
    ];
  }, [costsData, modelCosts]);

  return (
    <div className="space-y-6 p-6 md:p-8">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Costs</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Cost breakdown by model with detailed token usage
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchCosts}
            disabled={loading}
            className="flex items-center gap-2 rounded-lg bg-[var(--surface-submit)] px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            Refresh
          </button>
        </div>
      </div>

      {/* Date Filters */}
      <div className="flex flex-wrap items-center gap-4 rounded-lg border border-border-light bg-surface-secondary p-4">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-text-tertiary" />
          <span className="text-sm font-medium text-text-secondary">Date Range:</span>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="rounded-lg border border-border-light bg-surface-primary px-3 py-1.5 text-sm text-text-primary focus:border-[var(--surface-submit)] focus:outline-none"
          />
          <span className="text-text-tertiary">to</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="rounded-lg border border-border-light bg-surface-primary px-3 py-1.5 text-sm text-text-primary focus:border-[var(--surface-submit)] focus:outline-none"
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              const now = new Date();
              const start = new Date(now);
              start.setDate(1);
              setStartDate(start.toISOString().split('T')[0]);
              setEndDate(now.toISOString().split('T')[0]);
            }}
            className="rounded-lg border border-border-light bg-surface-primary px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-surface-tertiary"
          >
            This Month
          </button>
          <button
            onClick={() => {
              const now = new Date();
              const start = new Date(now);
              start.setDate(now.getDate() - 7);
              setStartDate(start.toISOString().split('T')[0]);
              setEndDate(now.toISOString().split('T')[0]);
            }}
            className="rounded-lg border border-border-light bg-surface-primary px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-surface-tertiary"
          >
            Last 7 Days
          </button>
          <button
            onClick={() => {
              const now = new Date();
              const start = new Date(now);
              start.setDate(now.getDate() - 30);
              setStartDate(start.toISOString().split('T')[0]);
              setEndDate(now.toISOString().split('T')[0]);
            }}
            className="rounded-lg border border-border-light bg-surface-primary px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-surface-tertiary"
          >
            Last 30 Days
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, index) => (
          <div
            key={index}
            className="rounded-xl border border-border-light bg-surface-primary p-4"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm text-text-secondary">{stat.label}</span>
              <div className={cn('rounded-lg p-2', stat.bgColor)}>
                <stat.icon className={cn('h-4 w-4', stat.color)} />
              </div>
            </div>
            <p className="mt-2 text-2xl font-bold text-text-primary">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Models Table */}
      <div className="rounded-xl border border-border-light bg-surface-primary">
        <div className="border-b border-border-light p-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-text-primary">
            <TrendingUp className="h-5 w-5" />
            Cost Breakdown by Model
          </h2>
          <p className="mt-1 text-sm text-text-secondary">
            Detailed token usage and costs per model
          </p>
        </div>
        <div className="p-4">
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
