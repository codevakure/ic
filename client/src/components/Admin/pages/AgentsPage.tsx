/**
 * Admin Agents Page
 * 
 * Agent usage metrics and token consumption.
 * Uses split API calls: summary (fast) + details (slower) for progressive loading.
 */
import { useState, useMemo, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ColumnDef } from '@tanstack/react-table';
import {
  Bot,
  Users,
  Cpu,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import { AdminDataTable, SortableHeader } from '../components/DataTable';
import { AdminDateRangePicker } from '../components/AdminDateRangePicker';
import { dashboardApi, groupsApi, type AgentGroupAssociation } from '../services/adminApi';
import { StatsGridSkeleton } from '../components/Skeletons';
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
  directUserCount: number;
  groups?: AgentGroupAssociation[];
}

interface AllAgentData {
  agentId: string;
  name: string;
  description: string;
  directUserCount?: number;
  isPublic: boolean;
}

function AgentsPage() {
  const navigate = useNavigate();

  // Date filters - default to today for metrics
  const [startDate, setStartDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });

  // All agents (fetched once, no date filter)
  const [allAgents, setAllAgents] = useState<AllAgentData[]>([]);
  const [allAgentsLoading, setAllAgentsLoading] = useState(true);
  
  // Agent-group associations (fetched once)
  const [agentGroups, setAgentGroups] = useState<Record<string, AgentGroupAssociation[]>>({});
  
  // Metrics (filtered by date range)
  const [metricsData, setMetricsData] = useState<Record<string, { inputTokens: number; outputTokens: number; totalTokens: number; totalCost: number; transactions: number; userCount: number }>>({});
  const [metricsLoading, setMetricsLoading] = useState(true);

  // Fetch all agents and group associations once on mount
  useEffect(() => {
    const fetchAllAgents = async () => {
      try {
        setAllAgentsLoading(true);
        const [agentsResponse, groupsResponse] = await Promise.all([
          dashboardApi.getAllAgents(),
          groupsApi.getAgentGroupAssociations(),
        ]);
        setAllAgents(agentsResponse.agents || []);
        setAgentGroups(groupsResponse || {});
      } catch (error) {
        console.error('Error fetching all agents:', error);
      } finally {
        setAllAgentsLoading(false);
      }
    };
    fetchAllAgents();
  }, []);

  // Fetch metrics whenever date range changes
  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        setMetricsLoading(true);
        const response = await dashboardApi.getAgentMetrics({ startDate, endDate });
        // Build a map of agentId -> metrics
        const metricsMap: Record<string, typeof metricsData[string]> = {};
        (response.agents || []).forEach((agent: { agentId: string; inputTokens?: number; outputTokens?: number; totalTokens?: number; totalCost?: number; transactions?: number; userCount?: number }) => {
          metricsMap[agent.agentId] = {
            inputTokens: agent.inputTokens || 0,
            outputTokens: agent.outputTokens || 0,
            totalTokens: agent.totalTokens || 0,
            totalCost: agent.totalCost || 0,
            transactions: agent.transactions || 0,
            userCount: agent.userCount || 0,
          };
        });
        setMetricsData(metricsMap);
      } catch (error) {
        console.error('Error fetching metrics:', error);
      } finally {
        setMetricsLoading(false);
      }
    };
    fetchMetrics();
  }, [startDate, endDate]);

  // Handle date change from the picker
  const handleDateChange = useCallback(({ startDate: start, endDate: end }: { startDate: string; endDate: string }) => {
    setStartDate(start);
    setEndDate(end);
  }, []);

  const refetch = useCallback(() => {
    setMetricsLoading(true);
    // Trigger re-fetch by updating a dependency
    setStartDate(prev => prev);
  }, []);

  // Combine all agents with their metrics and groups
  const agents: AgentData[] = useMemo(() => {
    return allAgents.map((agent) => {
      const metrics = metricsData[agent.agentId] || {
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        totalCost: 0,
        transactions: 0,
        userCount: 0,
      };
      return {
        agentId: agent.agentId,
        name: agent.name || agent.agentId,
        description: agent.description || '',
        groups: agentGroups[agent.agentId] || [],
        directUserCount: agent.directUserCount || 0,
        ...metrics,
      };
    });
  }, [allAgents, metricsData, agentGroups]);

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
        users: acc.users + agent.directUserCount,
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
            onClick={() => navigate(`/admin/agents/${encodeURIComponent(row.original.agentId)}`)}
            title="Click to view agent details"
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
        id: 'groups',
        header: 'Groups',
        cell: ({ row }) => {
          const groups = row.original.groups || [];
          return (
            <div className="flex flex-wrap gap-1">
              {groups.length === 0 ? (
                <span className="text-xs text-text-tertiary italic">All users</span>
              ) : (
                groups.map(group => (
                  <span
                    key={group._id}
                    className="px-2 py-0.5 text-xs font-medium bg-purple-500/20 text-purple-400 rounded-full"
                  >
                    {group.name.replace('LibreChat', '')}
                  </span>
                ))
              )}
            </div>
          );
        },
      },
      {
        accessorKey: 'directUserCount',
        header: ({ column }) => <SortableHeader column={column}>Users</SortableHeader>,
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-text-tertiary" />
            <span className="text-sm text-text-secondary">{formatNumber(row.original.directUserCount)}</span>
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

  // Stats cards data - use agents list for total, metrics for usage data
  const stats = useMemo(() => {
    const hasAgents = !allAgentsLoading && allAgents.length > 0;
    const hasMetrics = !metricsLoading;
    
    return [
      {
        label: 'Total Agents',
        // Always show total agent count from allAgents (not date-filtered)
        value: hasAgents ? allAgents.length.toString() : '—',
        icon: Bot,
        color: 'text-purple-600 dark:text-purple-400',
        bgColor: 'bg-purple-500/10',
      },
      {
        label: 'Total Cost',
        // Cost is filtered by date range
        value: hasMetrics ? formatCurrency(totals.totalCost) : '—',
        icon: DollarSign,
        color: 'text-green-600 dark:text-green-400',
        bgColor: 'bg-green-500/10',
      },
      {
        label: 'Total Tokens',
        value: hasMetrics ? formatCompact(totals.totalTokens) : '—',
        icon: Cpu,
        color: 'text-blue-600 dark:text-blue-400',
        bgColor: 'bg-blue-500/10',
      },
      {
        label: 'Total Requests',
        value: hasMetrics ? formatCompact(totals.transactions) : '—',
        icon: ArrowUpRight,
        color: 'text-orange-600 dark:text-orange-400',
        bgColor: 'bg-orange-500/10',
      },
    ];
  }, [allAgentsLoading, allAgents.length, metricsLoading, totals]);

  // Combined loading state for UI feedback
  const isLoading = allAgentsLoading || metricsLoading;

  // Don't block the entire page - render header and filters immediately
  return (
    <div className="space-y-4 p-4 md:p-6">
      {/* Page Header with Date Range Picker */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-text-primary">Agents</h1>
          <p className="text-sm text-text-secondary">
            Agent usage metrics and token consumption
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

      {/* Stats Cards - show skeleton animation when loading */}
      {allAgentsLoading ? (
        <StatsGridSkeleton count={4} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
            </div>
          ))}
        </div>
      )}

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
            isLoading={allAgentsLoading}
            emptyMessage="No agents found"
          />
        </div>
      </div>
    </div>
  );
}

export default AgentsPage;
