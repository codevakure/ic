/**
 * Admin Agents Page
 * 
 * Agent usage metrics and token consumption.
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import {
  Bot,
  RefreshCw,
  Calendar,
  Users,
  Cpu,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import { AdminDataTable, SortableHeader } from '../components/DataTable';
import { dashboardApi, type AgentMetrics } from '../services/adminApi';
import { cn } from '~/utils';

interface AgentData {
  agentId: string;
  name: string;
  description: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  totalCost: number;
  transactions: number;
  userCount: number;
}

function AgentsPage() {
  // State
  const [loading, setLoading] = useState(true);
  const [agentsData, setAgentsData] = useState<AgentMetrics | null>(null);

  // Date filters - default to current month
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setDate(1);
    return date.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });

  const fetchAgents = useCallback(async () => {
    setLoading(true);
    try {
      const data = await dashboardApi.getAgentMetrics({ startDate, endDate });
      setAgentsData(data);
    } catch (error) {
      console.error('Failed to fetch agents:', error);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  // Transform data for table
  const agents: AgentData[] = useMemo(() => {
    if (!agentsData?.agents) return [];
    
    return agentsData.agents.map((agent) => ({
      agentId: agent.agentId,
      name: agent.name || agent.agentId,
      description: agent.description || '',
      inputTokens: agent.inputTokens || 0,
      outputTokens: agent.outputTokens || 0,
      totalTokens: agent.totalTokens || 0,
      totalCost: agent.totalCost || 0,
      transactions: agent.transactions || 0,
      userCount: agent.userCount || 0,
    }));
  }, [agentsData]);

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

  // Calculate totals
  const totals = useMemo(() => {
    return agents.reduce(
      (acc, agent) => ({
        inputTokens: acc.inputTokens + agent.inputTokens,
        outputTokens: acc.outputTokens + agent.outputTokens,
        totalTokens: acc.totalTokens + agent.totalTokens,
        totalCost: acc.totalCost + agent.totalCost,
        transactions: acc.transactions + agent.transactions,
        users: acc.users + agent.userCount,
      }),
      { inputTokens: 0, outputTokens: 0, totalTokens: 0, totalCost: 0, transactions: 0, users: 0 }
    );
  }, [agents]);

  // Table columns
  const columns: ColumnDef<AgentData>[] = useMemo(
    () => [
      {
        accessorKey: 'name',
        header: ({ column }) => <SortableHeader column={column}>Agent</SortableHeader>,
        cell: ({ row }) => (
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-tertiary">
              <Bot className="h-4 w-4 text-text-secondary" />
            </div>
            <div>
              <p className="font-medium text-text-primary">{row.original.name}</p>
              <p className="text-xs text-text-tertiary font-mono">{row.original.agentId}</p>
            </div>
          </div>
        ),
      },
      {
        accessorKey: 'userCount',
        header: ({ column }) => <SortableHeader column={column}>Users</SortableHeader>,
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-text-tertiary" />
            <span className="text-sm text-text-secondary">{formatNumber(row.original.userCount)}</span>
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
        accessorKey: 'totalCost',
        header: ({ column }) => <SortableHeader column={column}>Total Cost</SortableHeader>,
        cell: ({ row }) => (
          <span className="text-sm font-bold text-text-primary">
            {formatCurrency(row.original.totalCost)}
          </span>
        ),
      },
      {
        accessorKey: 'transactions',
        header: 'Requests',
        cell: ({ row }) => (
          <span className="rounded-full bg-surface-tertiary px-2 py-0.5 text-xs font-medium text-text-secondary">
            {formatNumber(row.original.transactions)}
          </span>
        ),
      },
    ],
    []
  );

  // Stats cards data
  const stats = useMemo(() => {
    return [
      {
        label: 'Total Agents',
        value: agents.length.toString(),
        icon: Bot,
        color: 'text-purple-600 dark:text-purple-400',
        bgColor: 'bg-purple-500/10',
      },
      {
        label: 'Total Cost',
        value: formatCurrency(totals.totalCost),
        icon: DollarSign,
        color: 'text-green-600 dark:text-green-400',
        bgColor: 'bg-green-500/10',
      },
      {
        label: 'Total Tokens',
        value: formatCompact(totals.totalTokens),
        icon: Cpu,
        color: 'text-blue-600 dark:text-blue-400',
        bgColor: 'bg-blue-500/10',
      },
      {
        label: 'Total Requests',
        value: formatCompact(totals.transactions),
        icon: ArrowUpRight,
        color: 'text-orange-600 dark:text-orange-400',
        bgColor: 'bg-orange-500/10',
      },
    ];
  }, [agents, totals]);

  return (
    <div className="space-y-6 p-6 md:p-8">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Agents</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Agent usage metrics and token consumption
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchAgents}
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

      {/* Agents Table */}
      <div className="rounded-xl border border-border-light bg-surface-primary">
        <div className="border-b border-border-light p-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-text-primary">
            <Bot className="h-5 w-5" />
            Agent Usage Details
          </h2>
          <p className="mt-1 text-sm text-text-secondary">
            Token consumption and costs per agent
          </p>
        </div>
        <div className="p-4">
          <AdminDataTable
            columns={columns}
            data={agents}
            isLoading={loading}
            emptyMessage="No agent data available for the selected date range"
          />
        </div>
      </div>
    </div>
  );
}

export default AgentsPage;
