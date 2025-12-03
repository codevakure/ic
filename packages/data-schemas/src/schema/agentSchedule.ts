import { Schema } from 'mongoose';
import type { IAgentSchedule } from '~/types';

/**
 * Schema for agent scheduling configuration.
 * Stores cron/interval triggers for automated agent execution.
 */
const agentScheduleSchema = new Schema<IAgentSchedule>(
  {
    /** Reference to the Agent being scheduled */
    agentId: {
      type: String,
      required: true,
      index: true,
    },
    /** Unique trigger ID for the TriggerRegistry */
    triggerId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    /** Whether this schedule is active */
    enabled: {
      type: Boolean,
      default: true,
    },
    /** Schedule configuration */
    schedule: {
      /** 'interval' or 'cron' */
      mode: {
        type: String,
        enum: ['interval', 'cron'],
        required: true,
      },
      /** For interval mode: the numeric value */
      value: {
        type: Number,
      },
      /** For interval mode: 'seconds', 'minutes', 'hours', 'days', 'weeks' */
      unit: {
        type: String,
        enum: ['seconds', 'minutes', 'hours', 'days', 'weeks'],
      },
      /** For cron mode: the cron expression */
      expression: {
        type: String,
      },
      /** Timezone for cron expressions */
      timezone: {
        type: String,
      },
    },
    /** The prompt to send to the agent when triggered */
    prompt: {
      type: String,
      required: true,
    },
    /** Optional: Maximum number of runs before auto-disable */
    maxRuns: {
      type: Number,
    },
    /** User who created this schedule */
    author: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    /** Last successful run timestamp */
    lastRun: {
      type: Date,
    },
    /** Next scheduled run timestamp */
    nextRun: {
      type: Date,
    },
    /** Total number of executions */
    runCount: {
      type: Number,
      default: 0,
    },
    /** Number of successful runs */
    successCount: {
      type: Number,
      default: 0,
    },
    /** Number of failed runs */
    failCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  },
);

// Compound index for efficient queries
agentScheduleSchema.index({ author: 1, enabled: 1 });
agentScheduleSchema.index({ agentId: 1, enabled: 1 });

export default agentScheduleSchema;
