import { Schema } from 'mongoose';
import type { IExecutionTrace } from '~/types';

/**
 * Schema for execution trace steps.
 * Records each step (LLM call, tool call, agent switch) during an agent execution.
 * Used to build a Camunda-style tree view of what happened during execution.
 */
const executionTraceSchema = new Schema<IExecutionTrace>(
  {
    /** Reference to the TriggerExecution this trace belongs to */
    executionId: {
      type: Schema.Types.ObjectId,
      ref: 'TriggerExecution',
      required: true,
      index: true,
    },
    /** Parent trace ID for nested steps (e.g., tool within agentic flow) */
    parentId: {
      type: Schema.Types.ObjectId,
      ref: 'ExecutionTrace',
      default: null,
    },
    /** Execution order (1, 2, 3...) */
    sequence: {
      type: Number,
      required: true,
    },
    /** Type of step */
    stepType: {
      type: String,
      enum: ['llm', 'tool', 'agent_switch', 'message'],
      required: true,
    },
    /** Name of the step (model name, tool name, agent name) */
    stepName: {
      type: String,
      required: true,
    },
    /** Current status of the step */
    status: {
      type: String,
      enum: ['running', 'completed', 'failed'],
      default: 'running',
    },
    /** When the step started */
    startedAt: {
      type: Date,
      required: true,
    },
    /** When the step completed */
    completedAt: {
      type: Date,
    },
    /** Duration in milliseconds */
    durationMs: {
      type: Number,
    },
    /** Input data (tool args, prompt, etc.) - stored as Mixed for flexibility */
    input: {
      type: Schema.Types.Mixed,
    },
    /** Output data (response, result, etc.) - stored as Mixed for flexibility */
    output: {
      type: Schema.Types.Mixed,
    },
    /** Token usage for LLM steps */
    tokenUsage: {
      prompt: { type: Number },
      completion: { type: Number },
      total: { type: Number },
    },
    /** Error message if step failed */
    error: {
      type: String,
    },
    /** Additional metadata */
    metadata: {
      type: Schema.Types.Mixed,
    },
  },
  {
    timestamps: true,
  },
);

// Compound index for efficient trace retrieval
executionTraceSchema.index({ executionId: 1, sequence: 1 });

// Index for finding child traces
executionTraceSchema.index({ parentId: 1 });

export default executionTraceSchema;
