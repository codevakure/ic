/**
 * TraceTreeView
 *
 * A Camunda-style tree visualization of an execution trace.
 * Shows the step-by-step flow of LLM calls, tool invocations, and agent switches.
 */

import React, { Fragment } from 'react';
import {
  X,
  Bot,
  Wrench,
  Users,
  MessageSquare,
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
  ChevronDown,
  ChevronRight,
  Zap,
} from 'lucide-react';
import type { ExecutionTraceStep, ExecutionTraceTree } from 'ranger-data-provider';
import { useExecutionTraceQuery } from '~/data-provider/Executions';
import { cn } from '~/utils';

interface TraceTreeViewProps {
  agentId: string;
  executionId: string;
  onClose: () => void;
}

const stepTypeConfig = {
  llm: {
    icon: Bot,
    color: 'text-purple-500',
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/30',
    label: 'LLM',
  },
  tool: {
    icon: Wrench,
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30',
    label: 'Tool',
  },
  agent_switch: {
    icon: Users,
    color: 'text-orange-500',
    bgColor: 'bg-orange-500/10',
    borderColor: 'border-orange-500/30',
    label: 'Agent Switch',
  },
  message: {
    icon: MessageSquare,
    color: 'text-green-500',
    bgColor: 'bg-green-500/10',
    borderColor: 'border-green-500/30',
    label: 'Message',
  },
};

const statusConfig = {
  running: {
    icon: Loader2,
    color: 'text-blue-500',
    animate: true,
  },
  completed: {
    icon: CheckCircle2,
    color: 'text-green-500',
    animate: false,
  },
  failed: {
    icon: XCircle,
    color: 'text-red-500',
    animate: false,
  },
};

function formatDuration(ms?: number): string {
  if (!ms) return '';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function formatTokens(tokenUsage?: { prompt?: number; completion?: number; total?: number }): string {
  if (!tokenUsage?.total) return '';
  return `${tokenUsage.total} tokens`;
}

function truncateText(text: string | undefined, maxLength: number = 100): string {
  if (!text) return '';
  const str = typeof text === 'string' ? text : JSON.stringify(text);
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength) + '...';
}

function DataBlock({
  label,
  data,
  expanded,
}: {
  label: string;
  data: unknown;
  expanded?: boolean;
}) {
  const [isExpanded, setIsExpanded] = React.useState(expanded ?? false);

  if (!data) return null;

  const content = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  const isLong = content.length > 100;

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => isLong && setIsExpanded(!isExpanded)}
        className={cn(
          'flex items-center gap-1 text-xs text-text-tertiary',
          isLong && 'cursor-pointer hover:text-text-secondary',
        )}
      >
        {isLong && (isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />)}
        <span className="font-medium">{label}:</span>
      </button>
      <pre
        className={cn(
          'mt-1 overflow-x-auto rounded bg-surface-tertiary p-2 text-xs text-text-secondary',
          !isExpanded && isLong && 'max-h-16 overflow-hidden',
        )}
      >
        {isExpanded || !isLong ? content : truncateText(content, 150)}
      </pre>
    </div>
  );
}

function TraceStep({
  step,
  isLast,
  level = 0,
}: {
  step: ExecutionTraceStep;
  isLast: boolean;
  level?: number;
}) {
  const [expanded, setExpanded] = React.useState(false);
  const typeConfig = stepTypeConfig[step.stepType] || stepTypeConfig.tool;
  const status = statusConfig[step.status] || statusConfig.completed;
  const TypeIcon = typeConfig.icon;
  const StatusIcon = status.icon;

  const hasDetails = step.input || step.output || step.error || step.tokenUsage;

  return (
    <div className="relative flex">
      {/* Vertical line connector */}
      {!isLast && (
        <div
          className="absolute left-5 top-10 w-0.5 bg-border-light"
          style={{ height: 'calc(100% - 24px)', marginLeft: level * 20 }}
        />
      )}

      {/* Step content */}
      <div className="flex-1 pb-4" style={{ marginLeft: level * 20 }}>
        <div
          className={cn(
            'group relative flex items-start gap-3 rounded-lg border p-3 transition-all',
            typeConfig.bgColor,
            typeConfig.borderColor,
            hasDetails && 'cursor-pointer hover:shadow-md',
          )}
          onClick={() => hasDetails && setExpanded(!expanded)}
        >
          {/* Step icon */}
          <div
            className={cn(
              'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full',
              typeConfig.bgColor,
            )}
          >
            <TypeIcon className={cn('h-5 w-5', typeConfig.color)} />
          </div>

          {/* Step info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-text-primary">{step.stepName}</span>
              <span className={cn('text-xs', typeConfig.color)}>{typeConfig.label}</span>
              <StatusIcon
                className={cn('h-4 w-4 ml-auto', status.color, status.animate && 'animate-spin')}
              />
            </div>

            <div className="mt-1 flex items-center gap-3 text-xs text-text-tertiary">
              {step.durationMs && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatDuration(step.durationMs)}
                </span>
              )}
              {step.tokenUsage?.total && (
                <span className="flex items-center gap-1">
                  <Zap className="h-3 w-3" />
                  {formatTokens(step.tokenUsage)}
                </span>
              )}
              {step.error && (
                <span className="text-red-500">Error: {truncateText(step.error, 50)}</span>
              )}
            </div>

            {/* Expanded details */}
            {expanded && (
              <div className="mt-3 border-t border-border-light pt-3">
                {step.input && <DataBlock label="Input" data={step.input} />}
                {step.output && <DataBlock label="Output" data={step.output} />}
                {step.error && (
                  <div className="mt-2">
                    <span className="text-xs font-medium text-red-500">Error:</span>
                    <pre className="mt-1 overflow-x-auto rounded bg-red-500/10 p-2 text-xs text-red-500">
                      {step.error}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Expand indicator */}
          {hasDetails && (
            <div className="absolute right-3 top-3 opacity-0 group-hover:opacity-100 transition-opacity">
              {expanded ? (
                <ChevronDown className="h-4 w-4 text-text-tertiary" />
              ) : (
                <ChevronRight className="h-4 w-4 text-text-tertiary" />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TraceContent({ trace }: { trace: ExecutionTraceTree }) {
  const status = statusConfig[trace.status as keyof typeof statusConfig] || statusConfig.completed;
  const StatusIcon = status.icon;

  return (
    <div className="flex flex-col gap-4">
      {/* Summary header */}
      <div className="flex items-center justify-between rounded-lg bg-surface-secondary p-4">
        <div className="flex items-center gap-3">
          <StatusIcon
            className={cn('h-6 w-6', status.color, status.animate && 'animate-spin')}
          />
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium text-text-primary">
                Execution {trace.executionId.slice(0, 8)}...
              </span>
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-xs font-medium',
                  trace.status === 'completed' && 'bg-green-500/10 text-green-500',
                  trace.status === 'failed' && 'bg-red-500/10 text-red-500',
                  trace.status === 'running' && 'bg-blue-500/10 text-blue-500',
                )}
              >
                {trace.status}
              </span>
            </div>
            <div className="mt-1 flex items-center gap-3 text-sm text-text-tertiary">
              <span>{trace.stepCount} steps</span>
              <span>•</span>
              <span>{formatDuration(trace.totalDurationMs)}</span>
              {trace.triggeredAt && (
                <>
                  <span>•</span>
                  <span>{new Date(trace.triggeredAt).toLocaleString()}</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Input/Output summary when no trace steps */}
      {trace.steps.length === 0 && (trace.input || trace.output || trace.error) && (
        <div className="rounded-lg border border-border-light p-4">
          <h3 className="mb-3 text-sm font-medium text-text-primary">Execution Summary</h3>
          {trace.input && (
            <div className="mb-3">
              <span className="text-xs font-medium text-text-secondary">Input Prompt:</span>
              <pre className="mt-1 overflow-x-auto rounded bg-surface-secondary p-3 text-sm text-text-primary whitespace-pre-wrap">
                {trace.input}
              </pre>
            </div>
          )}
          {trace.output && (
            <div className="mb-3">
              <span className="text-xs font-medium text-text-secondary">Output:</span>
              <pre className="mt-1 overflow-x-auto rounded bg-surface-secondary p-3 text-sm text-text-primary whitespace-pre-wrap">
                {trace.output}
              </pre>
            </div>
          )}
          {trace.error && (
            <div>
              <span className="text-xs font-medium text-red-500">Error:</span>
              <pre className="mt-1 overflow-x-auto rounded bg-red-500/10 p-3 text-sm text-red-500 whitespace-pre-wrap">
                {trace.error}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* Empty state when no steps and no input/output */}
      {trace.steps.length === 0 && !trace.input && !trace.output && !trace.error && (
        <div className="flex flex-col items-center justify-center py-8 text-text-tertiary">
          <MessageSquare className="h-12 w-12 mb-2 opacity-50" />
          <p className="text-sm">No trace details available</p>
          <p className="text-xs mt-1">Execution data will appear once the agent runs</p>
        </div>
      )}

      {/* Steps tree */}
      {trace.steps.length > 0 && (
        <div className="relative">
          {trace.steps.map((step, index) => (
            <TraceStep
              key={step.id}
              step={step}
              isLast={index === trace.steps.length - 1}
              level={0}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function TraceTreeView({ agentId, executionId, onClose }: TraceTreeViewProps) {
  const { data: trace, isLoading, error } = useExecutionTraceQuery(agentId, executionId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="relative max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-xl bg-surface-primary shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border-light px-6 py-4">
          <h2 className="text-lg font-semibold text-text-primary">Execution Trace</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-text-secondary hover:bg-surface-hover hover:text-text-primary"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="max-h-[calc(90vh-120px)] overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-text-tertiary" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-red-500">
              <XCircle className="h-8 w-8" />
              <span>Failed to load execution trace</span>
            </div>
          ) : trace ? (
            <TraceContent trace={trace} />
          ) : null}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end border-t border-border-light px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-surface-secondary px-4 py-2 text-sm font-medium text-text-primary hover:bg-surface-hover"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default TraceTreeView;
