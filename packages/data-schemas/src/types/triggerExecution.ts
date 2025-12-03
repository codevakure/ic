import { Document, Types } from 'mongoose';

/**
 * Execution status types
 * - 'pending': Execution is queued
 * - 'running': Execution is in progress
 * - 'completed': Execution finished successfully
 * - 'failed': Execution encountered an error
 */
export type ExecutionStatus = 'pending' | 'running' | 'completed' | 'failed';

/**
 * Trigger Execution document interface
 * Represents a single execution of a scheduled trigger
 */
export interface ITriggerExecution extends Document {
  /** Reference to the AgentSchedule document */
  scheduleId: Types.ObjectId;
  /** Reference to the Agent (string ID) */
  agentId: string;
  /** Reference to the User who owns this schedule */
  userId: Types.ObjectId;
  /** When the trigger was fired */
  triggeredAt: Date;
  /** When the execution completed (success or failure) */
  completedAt?: Date;
  /** Execution duration in milliseconds */
  durationMs?: number;
  /** Current execution status */
  status: ExecutionStatus;
  /** Input prompt sent to the agent */
  input?: string;
  /** Output from the agent (may be truncated for storage) */
  output?: string;
  /** Reference to the conversation created for this execution */
  conversationId?: string;
  /** Error message if execution failed */
  error?: string;
  /** Retry attempt number (1 = first attempt) */
  attempt: number;
  /** Timestamps */
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Input type for creating a trigger execution record
 */
export interface ITriggerExecutionInput {
  scheduleId: Types.ObjectId | string;
  agentId: string;
  userId: Types.ObjectId | string;
  triggeredAt?: Date;
  input?: string;
  attempt?: number;
}

/**
 * Input type for updating a trigger execution
 */
export interface ITriggerExecutionUpdate {
  completedAt?: Date;
  durationMs?: number;
  status?: ExecutionStatus;
  output?: string;
  conversationId?: string;
  error?: string;
}
