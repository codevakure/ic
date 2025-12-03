/**
 * Execution Trace Types
 *
 * Types for the execution trace system used for Camunda-style tree view visualization.
 */

/**
 * Step type in an execution trace
 */
export type ExecutionStepType = 'llm' | 'tool' | 'agent_switch' | 'message';

/**
 * Status of an execution step
 */
export type ExecutionStepStatus = 'running' | 'completed' | 'failed';

/**
 * Token usage information for LLM steps
 */
export interface TokenUsage {
  prompt?: number;
  completion?: number;
  total?: number;
}

/**
 * Single step in an execution trace
 */
export interface ExecutionTraceStep {
  /** Unique identifier */
  id: string;
  /** Parent step ID for nested steps */
  parentId?: string | null;
  /** Execution order (1, 2, 3...) */
  sequence: number;
  /** Type of step */
  stepType: ExecutionStepType;
  /** Name of the step (model name, tool name, agent name) */
  stepName: string;
  /** Current status */
  status: ExecutionStepStatus;
  /** When the step started */
  startedAt: string;
  /** When the step completed */
  completedAt?: string;
  /** Duration in milliseconds */
  durationMs?: number;
  /** Input data (tool args, prompt, etc.) */
  input?: Record<string, unknown>;
  /** Output data (response, result, etc.) */
  output?: Record<string, unknown>;
  /** Token usage for LLM steps */
  tokenUsage?: TokenUsage;
  /** Error message if step failed */
  error?: string;
}

/**
 * Execution summary for list views
 */
export interface ExecutionSummary {
  /** Execution ID */
  id: string;
  /** Schedule ID that triggered this execution */
  scheduleId?: string;
  /** Agent ID */
  agentId: string;
  /** Execution status */
  status: ExecutionStepStatus | 'pending';
  /** When triggered */
  triggeredAt: string;
  /** When completed */
  completedAt?: string;
  /** Total duration in milliseconds */
  durationMs?: number;
  /** Input prompt */
  input?: string;
  /** Output response (truncated) */
  output?: string;
  /** Error message if failed */
  error?: string;
  /** Retry attempt number */
  attempt: number;
  /** Number of trace steps */
  stepCount: number;
}

/**
 * Full execution trace tree response
 */
export interface ExecutionTraceTree {
  /** Execution ID */
  executionId: string;
  /** Agent ID */
  agentId: string;
  /** Overall execution status */
  status: ExecutionStepStatus | 'pending';
  /** When triggered */
  triggeredAt: string;
  /** When completed */
  completedAt?: string;
  /** Total duration in milliseconds */
  totalDurationMs: number;
  /** Total number of steps */
  stepCount: number;
  /** Input prompt (from execution) */
  input?: string;
  /** Output response (from execution) */
  output?: string;
  /** Error message if failed */
  error?: string;
  /** All trace steps in order */
  steps: ExecutionTraceStep[];
}

/**
 * List executions request parameters
 */
export interface ListExecutionsParams {
  /** Maximum number of results */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
  /** Filter by status */
  status?: ExecutionStepStatus | 'pending';
  /** Filter by schedule ID */
  scheduleId?: string;
}

/**
 * List executions response
 */
export interface ExecutionListResponse {
  executions: ExecutionSummary[];
  total: number;
  limit: number;
  offset: number;
}

/**
 * Delete executions request parameters
 */
export interface DeleteExecutionsParams {
  /** Filter by status */
  status?: ExecutionStepStatus | 'pending';
  /** Filter by schedule ID */
  scheduleId?: string;
  /** Delete executions older than this date */
  olderThan?: string;
}

/**
 * Delete executions response
 */
export interface DeleteExecutionsResponse {
  success: boolean;
  deletedExecutions: number;
  deletedTraces: number;
}
