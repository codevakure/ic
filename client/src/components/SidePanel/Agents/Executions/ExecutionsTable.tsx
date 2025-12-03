/**
 * ExecutionsTable
 *
 * Displays a table of agent execution history with status, timing, and step counts.
 * Clicking on a row opens the trace tree view.
 */

import React, { useState } from 'react';
import {
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Eye,
  AlertCircle,
} from 'lucide-react';
import { Button, useToastContext } from '@librechat/client';
import type { ExecutionSummary } from 'librechat-data-provider';
import {
  useAgentExecutionsQuery,
  useDeleteExecutionMutation,
  useDeleteExecutionsMutation,
} from '~/data-provider/Executions';
import { useLocalize } from '~/hooks';
import { cn } from '~/utils';
import { TraceTreeView } from './TraceTreeView';

interface ExecutionsTableProps {
  agentId: string;
  scheduleId?: string;
}

const statusConfig = {
  pending: {
    icon: Clock,
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-500/10',
    label: 'Pending',
    animate: false,
  },
  running: {
    icon: Loader2,
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
    label: 'Running',
    animate: true,
  },
  completed: {
    icon: CheckCircle2,
    color: 'text-green-500',
    bgColor: 'bg-green-500/10',
    label: 'Completed',
    animate: false,
  },
  failed: {
    icon: XCircle,
    color: 'text-red-500',
    bgColor: 'bg-red-500/10',
    label: 'Failed',
    animate: false,
  },
};

function formatDuration(ms?: number): string {
  if (!ms) return '-';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);

  if (diffHours < 24) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  if (diffHours < 168) {
    // 7 days
    return date.toLocaleDateString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: '2-digit' });
}

function StatusBadge({ status }: { status: string }) {
  const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
  const Icon = config.icon;

  return (
    <div className={cn('inline-flex items-center gap-1.5 rounded-full px-2 py-0.5', config.bgColor)}>
      <Icon
        className={cn('h-3.5 w-3.5', config.color, config.animate && 'animate-spin')}
      />
      <span className={cn('text-xs font-medium', config.color)}>{config.label}</span>
    </div>
  );
}

function ExecutionRow({
  execution,
  agentId,
  onViewTrace,
  onDelete,
}: {
  execution: ExecutionSummary;
  agentId: string;
  onViewTrace: () => void;
  onDelete: () => void;
}) {
  return (
    <tr className="group border-b border-border-light hover:bg-surface-hover transition-colors">
      <td className="px-2 py-2">
        <span className="text-xs font-medium text-text-primary">
          {formatDate(execution.triggeredAt)}
        </span>
      </td>
      <td className="px-2 py-2">
        <StatusBadge status={execution.status} />
      </td>
      <td className="px-2 py-2 text-xs text-text-secondary">
        {formatDuration(execution.durationMs)}
      </td>
      <td className="px-2 py-2">
        <span className="inline-flex items-center justify-center rounded-full bg-surface-tertiary px-1.5 py-0.5 text-xs font-medium text-text-secondary">
          {execution.stepCount}
        </span>
      </td>
      <td className="px-2 py-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onViewTrace}
            className="rounded p-1 text-blue-500 hover:bg-blue-500/10"
            title="View trace"
          >
            <Eye className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="rounded p-1 text-red-500 hover:bg-red-500/10"
            title="Delete"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </td>
    </tr>
  );
}

export function ExecutionsTable({ agentId, scheduleId }: ExecutionsTableProps) {
  const localize = useLocalize();
  const { showToast } = useToastContext();
  const [page, setPage] = useState(0);
  const [selectedExecutionId, setSelectedExecutionId] = useState<string | null>(null);
  const pageSize = 10;

  const { data, isLoading, error, refetch } = useAgentExecutionsQuery(agentId, {
    limit: pageSize,
    offset: page * pageSize,
    scheduleId,
  });

  const deleteExecution = useDeleteExecutionMutation({
    onSuccess: () => {
      showToast({ message: 'Execution deleted', status: 'success' });
      refetch();
    },
    onError: (err) => {
      showToast({ message: `Failed to delete: ${err.message}`, status: 'error' });
    },
  });

  const deleteAllExecutions = useDeleteExecutionsMutation({
    onSuccess: (result) => {
      showToast({
        message: `Deleted ${result.deletedExecutions} executions`,
        status: 'success',
      });
      refetch();
    },
    onError: (err) => {
      showToast({ message: `Failed to delete: ${err.message}`, status: 'error' });
    },
  });

  const executions = data?.executions || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / pageSize);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-text-tertiary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-8 text-red-500">
        <AlertCircle className="h-6 w-6" />
        <span className="text-sm">Failed to load executions</span>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          Retry
        </Button>
      </div>
    );
  }

  if (executions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-8 text-text-tertiary">
        <Clock className="h-8 w-8" />
        <span className="text-sm">No executions yet</span>
        <span className="text-xs">Executions will appear here when schedules run</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header with actions */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-text-secondary">
          {total} execution{total !== 1 ? 's' : ''}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => deleteAllExecutions.mutate({ agentId, scheduleId })}
          disabled={deleteAllExecutions.isLoading}
          className="text-red-500 hover:bg-red-500/10"
        >
          <Trash2 className="mr-1 h-4 w-4" />
          Clear All
        </Button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-border-light">
        <table className="w-full text-left">
          <thead className="bg-surface-secondary">
            <tr>
              <th className="px-2 py-2 text-xs font-medium text-text-secondary">Time</th>
              <th className="px-2 py-2 text-xs font-medium text-text-secondary">Status</th>
              <th className="px-2 py-2 text-xs font-medium text-text-secondary">Duration</th>
              <th className="px-2 py-2 text-xs font-medium text-text-secondary">Steps</th>
              <th className="px-2 py-2 text-xs font-medium text-text-secondary">Actions</th>
            </tr>
          </thead>
          <tbody>
            {executions.map((execution) => (
              <ExecutionRow
                key={execution.id}
                execution={execution}
                agentId={agentId}
                onViewTrace={() => setSelectedExecutionId(execution.id)}
                onDelete={() => deleteExecution.mutate({ agentId, executionId: execution.id })}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-text-tertiary">
            Page {page + 1} of {totalPages}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="rounded p-1 text-text-secondary hover:bg-surface-hover disabled:opacity-50"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="rounded p-1 text-text-secondary hover:bg-surface-hover disabled:opacity-50"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Trace Tree View Modal */}
      {selectedExecutionId && (
        <TraceTreeView
          agentId={agentId}
          executionId={selectedExecutionId}
          onClose={() => setSelectedExecutionId(null)}
        />
      )}
    </div>
  );
}

export default ExecutionsTable;
