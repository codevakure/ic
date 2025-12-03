import type { Document, Types } from 'mongoose';

/** Step types for execution traces */
export type ExecutionStepType = 'llm' | 'tool' | 'agent_switch' | 'message';

/** Status of an execution step */
export type ExecutionStepStatus = 'running' | 'completed' | 'failed';

/** Token usage information for LLM steps */
export interface ITokenUsage {
  prompt?: number;
  completion?: number;
  total?: number;
}

/**
 * Execution Trace document interface.
 * Represents a single step in an agent execution.
 */
export interface IExecutionTrace extends Document {
  /** Reference to the TriggerExecution this trace belongs to */
  executionId: Types.ObjectId;
  /** Parent trace ID for nested steps */
  parentId?: Types.ObjectId | null;
  /** Execution order (1, 2, 3...) */
  sequence: number;
  /** Type of step */
  stepType: ExecutionStepType;
  /** Name of the step (model name, tool name, agent name) */
  stepName: string;
  /** Current status of the step */
  status: ExecutionStepStatus;
  /** When the step started */
  startedAt: Date;
  /** When the step completed */
  completedAt?: Date;
  /** Duration in milliseconds */
  durationMs?: number;
  /** Input data (tool args, prompt, etc.) */
  input?: Record<string, unknown>;
  /** Output data (response, result, etc.) */
  output?: Record<string, unknown>;
  /** Token usage for LLM steps */
  tokenUsage?: ITokenUsage;
  /** Error message if step failed */
  error?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
  /** Mongoose timestamps */
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Input for creating a new execution trace
 */
export interface IExecutionTraceInput {
  executionId: Types.ObjectId | string;
  parentId?: Types.ObjectId | string | null;
  sequence: number;
  stepType: ExecutionStepType;
  stepName: string;
  status?: ExecutionStepStatus;
  startedAt: Date;
  input?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

/**
 * Input for updating an execution trace
 */
export interface IExecutionTraceUpdate {
  status?: ExecutionStepStatus;
  completedAt?: Date;
  durationMs?: number;
  output?: Record<string, unknown>;
  tokenUsage?: ITokenUsage;
  error?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Trace step for API responses (serialized version)
 */
export interface ExecutionTraceStep {
  id: string;
  parentId?: string | null;
  sequence: number;
  stepType: ExecutionStepType;
  stepName: string;
  status: ExecutionStepStatus;
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  tokenUsage?: ITokenUsage;
  error?: string;
}

/**
 * Full trace tree response
 */
export interface ExecutionTraceTree {
  executionId: string;
  status: ExecutionStepStatus;
  totalDurationMs: number;
  stepCount: number;
  steps: ExecutionTraceStep[];
}
