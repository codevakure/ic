import { Schema } from 'mongoose';
import type { ITriggerExecution } from '~/types';

/**
 * Schema for trigger execution history.
 * Records each execution of a scheduled agent trigger.
 */
const triggerExecutionSchema = new Schema<ITriggerExecution>(
  {
    /** Reference to the AgentSchedule */
    scheduleId: {
      type: Schema.Types.ObjectId,
      ref: 'AgentSchedule',
      required: true,
      index: true,
    },
    /** Reference to the Agent that was executed */
    agentId: {
      type: String,
      required: true,
      index: true,
    },
    /** User context for the execution */
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    /** When the trigger fired */
    triggeredAt: {
      type: Date,
      required: true,
      index: true,
    },
    /** When execution completed */
    completedAt: {
      type: Date,
    },
    /** Execution duration in milliseconds */
    durationMs: {
      type: Number,
    },
    /** Execution status */
    status: {
      type: String,
      enum: ['pending', 'running', 'completed', 'failed'],
      default: 'pending',
      index: true,
    },
    /** The prompt that was sent */
    input: {
      type: String,
    },
    /** Agent response (truncated for storage) */
    output: {
      type: String,
    },
    /** Conversation ID if a conversation was created */
    conversationId: {
      type: String,
    },
    /** Error message if failed */
    error: {
      type: String,
    },
    /** Retry attempt number */
    attempt: {
      type: Number,
      default: 1,
    },
  },
  {
    timestamps: true,
  },
);

// Index for efficient history queries
triggerExecutionSchema.index({ scheduleId: 1, triggeredAt: -1 });
triggerExecutionSchema.index({ agentId: 1, triggeredAt: -1 });
triggerExecutionSchema.index({ userId: 1, triggeredAt: -1 });
triggerExecutionSchema.index({ status: 1, triggeredAt: -1 });

// TTL index to auto-delete old executions (optional, 30 days)
// Uncomment if you want automatic cleanup
// triggerExecutionSchema.index({ triggeredAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

export default triggerExecutionSchema;
