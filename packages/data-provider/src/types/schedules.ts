/**
 * Agent Schedule Types
 *
 * Types for the agent scheduling system.
 */

/**
 * Schedule mode types
 * - 'interval': Run every X units
 * - 'cron': Custom cron expression
 */
export type ScheduleMode = 'interval' | 'cron';

/**
 * Interval unit types
 */
export type IntervalUnit = 'seconds' | 'minutes' | 'hours' | 'days' | 'weeks';

/**
 * Schedule configuration
 */
export interface ScheduleConfig {
  /** Schedule mode type */
  mode: ScheduleMode;
  /** Value for interval mode */
  value?: number;
  /** Unit for interval mode */
  unit?: IntervalUnit;
  /** Cron expression for cron mode */
  expression?: string;
  /** IANA timezone */
  timezone?: string;
}

/**
 * Agent Schedule document
 */
export interface AgentSchedule {
  _id: string;
  agentId: string;
  triggerId: string;
  enabled: boolean;
  schedule: ScheduleConfig;
  prompt: string;
  maxRuns?: number;
  author: string;
  lastRun?: string;
  nextRun?: string;
  runCount: number;
  successCount: number;
  failCount: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Execution status types
 */
export type ExecutionStatus = 'pending' | 'running' | 'completed' | 'failed';

/**
 * Trigger Execution document
 */
export interface TriggerExecution {
  _id: string;
  scheduleId: string;
  agentId: string;
  userId: string;
  triggeredAt: string;
  completedAt?: string;
  durationMs?: number;
  status: ExecutionStatus;
  input?: string;
  output?: string;
  conversationId?: string;
  error?: string;
  attempt: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Create schedule parameters
 */
export interface CreateScheduleParams {
  schedule: ScheduleConfig;
  prompt: string;
  enabled?: boolean;
  maxRuns?: number;
}

/**
 * Update schedule parameters
 */
export interface UpdateScheduleParams {
  schedule?: Partial<ScheduleConfig>;
  prompt?: string;
  enabled?: boolean;
  maxRuns?: number;
}

/**
 * Schedule list response
 */
export interface ScheduleListResponse {
  schedules: AgentSchedule[];
}

/**
 * Schedule execution list response (for /schedules/:id/executions)
 */
export interface ScheduleExecutionListResponse {
  executions: TriggerExecution[];
}
