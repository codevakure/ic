/**
 * Admin Agents Page
 * 
 * Agent usage metrics and token consumption.
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
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
  const navigate = useNavigate();
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
          <div 
            className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => navigate(`/admin/traces?agent=${encodeURIComponent(row.original.agentId)}`)}
            title="Click to view traces for this agent"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-tertiary">
              <Bot className="h-4 w-4 text-text-secondary" />
            </div>
            <div>
              <p className="font-medium text-text-primary hover:text-blue-400 transition-colors">{row.original.name}</p>
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
    [navigate]
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
    <div className="space-y-4 p-4 md:p-6">
      {/* Page Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-text-primary">Agents</h1>
          <p className="text-sm text-text-secondary">
            Agent usage metrics and token consumption
          </p>
        </div>
        <button
          onClick={fetchAgents}
          disabled={loading}
          className="flex items-center gap-2 rounded-lg bg-[var(--surface-submit)] px-3 py-1.5 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50"
        >
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          Refresh
        </button>
      </div>

      {/* Date Filters */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border-light bg-surface-secondary p-3">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-text-tertiary" />
          <span className="text-sm text-text-secondary">Range:</span>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="rounded border border-border-light bg-surface-primary px-2 py-1 text-sm text-text-primary focus:border-[var(--surface-submit)] focus:outline-none"
          />
          <span className="text-text-tertiary">to</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="rounded border border-border-light bg-surface-primary px-2 py-1 text-sm text-text-primary focus:border-[var(--surface-submit)] focus:outline-none"
          />
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => {
              const now = new Date();
              const start = new Date(now);
              start.setDate(1);
              setStartDate(start.toISOString().split('T')[0]);
              setEndDate(now.toISOString().split('T')[0]);
            }}
            className="rounded border border-border-light bg-surface-primary px-2 py-1 text-xs text-text-secondary hover:bg-surface-tertiary"
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
            className="rounded border border-border-light bg-surface-primary px-2 py-1 text-xs text-text-secondary hover:bg-surface-tertiary"
          >
            7 Days
          </button>
          <button
            onClick={() => {
              const now = new Date();
              const start = new Date(now);
              start.setDate(now.getDate() - 30);
              setStartDate(start.toISOString().split('T')[0]);
              setEndDate(now.toISOString().split('T')[0]);
            }}
            className="rounded border border-border-light bg-surface-primary px-2 py-1 text-xs text-text-secondary hover:bg-surface-tertiary"
          >
            Last 30 Days
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, index) => (
          <div
            key={index}
            className="rounded-lg border border-border-light bg-surface-primary p-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs text-text-secondary">{stat.label}</span>
              <div className={cn('rounded-lg p-1.5', stat.bgColor)}>
                <stat.icon className={cn('h-3.5 w-3.5', stat.color)} />
              </div>
            </div>
            <p className="mt-1 text-xl font-bold text-text-primary">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Agents Table */}
      <div className="rounded-lg border border-border-light bg-surface-primary">
        <div className="border-b border-border-light p-3">
          <h2 className="flex items-center gap-2 text-base font-semibold text-text-primary">
            <Bot className="h-4 w-4" />
            Agent Usage Details
          </h2>
        </div>
        <div className="p-3">
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
