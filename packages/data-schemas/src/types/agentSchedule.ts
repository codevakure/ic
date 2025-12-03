import { Document, Types } from 'mongoose';

/**
 * Schedule mode types
 * - 'interval': Run every X units (seconds, minutes, hours, days, weeks)
 * - 'cron': Custom cron expression for advanced scheduling
 */
export type ScheduleMode = 'interval' | 'cron';

/**
 * Interval unit types for 'interval' mode
 */
export type IntervalUnit = 'seconds' | 'minutes' | 'hours' | 'days' | 'weeks';

/**
 * Schedule configuration object
 */
export interface IScheduleConfig {
  /** Schedule mode type */
  mode: ScheduleMode;
  /** Value for interval mode (e.g., 5 for "every 5 minutes") */
  value?: number;
  /** Unit for interval mode */
  unit?: IntervalUnit;
  /** Cron expression for cron mode */
  expression?: string;
  /** IANA timezone (e.g., "America/New_York") */
  timezone?: string;
}

/**
 * Agent Schedule document interface
 * Represents a scheduled trigger configuration for an agent
 */
export interface IAgentSchedule extends Document {
  /** Reference to the Agent (string ID) */
  agentId: string;
  /** Unique identifier for the trigger instance (used by @librechat/triggers) */
  triggerId: string;
  /** Whether this schedule is active */
  enabled: boolean;
  /** Schedule configuration */
  schedule: IScheduleConfig;
  /** Default prompt to use when triggering the agent */
  prompt: string;
  /** Maximum number of executions (undefined = unlimited) */
  maxRuns?: number;
  /** User who created this schedule */
  author: Types.ObjectId;
  /** Timestamp of the last execution */
  lastRun?: Date;
  /** Calculated next run time */
  nextRun?: Date;
  /** Total number of times this schedule has run */
  runCount: number;
  /** Number of successful runs */
  successCount: number;
  /** Number of failed runs */
  failCount: number;
  /** Timestamps */
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Input type for creating a new agent schedule
 */
export interface IAgentScheduleInput {
  agentId: string;
  enabled?: boolean;
  schedule: IScheduleConfig;
  prompt: string;
  maxRuns?: number;
  author: Types.ObjectId | string;
}

/**
 * Input type for updating an agent schedule
 */
export interface IAgentScheduleUpdate {
  enabled?: boolean;
  schedule?: Partial<IScheduleConfig>;
  prompt?: string;
  maxRuns?: number;
}
