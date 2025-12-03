/**
 * @librechat/triggers - Schedule Trigger Types
 *
 * Types for cron-based and interval-based scheduling.
 * Supports both simple intervals ("every 5 minutes") and
 * complex cron expressions ("0 9 * * 1-5").
 *
 * ## Cron Expression Format:
 * ```
 * ┌────────────── second (0-59) [optional]
 * │ ┌──────────── minute (0-59)
 * │ │ ┌────────── hour (0-23)
 * │ │ │ ┌──────── day of month (1-31)
 * │ │ │ │ ┌────── month (1-12)
 * │ │ │ │ │ ┌──── day of week (0-7, 0 or 7 is Sunday)
 * │ │ │ │ │ │
 * * * * * * *
 * ```
 *
 * ## Production Upgrade Path:
 * Current: node-cron (single process, in-memory)
 * Production: BullMQ (distributed, Redis-backed, persistent)
 *
 * Migration is simple - just swap the scheduler backend in ScheduleTrigger.
 * The config and interface remain identical.
 *
 * @packageDocumentation
 */

import type { TriggerConfig } from './base';

/**
 * Schedule mode discriminator.
 * - 'interval': Fixed time intervals (every N minutes/hours)
 * - 'cron': Cron expression for complex schedules
 */
export type ScheduleMode = 'interval' | 'cron';

/**
 * Time units for interval-based scheduling.
 */
export type IntervalUnit = 'seconds' | 'minutes' | 'hours' | 'days' | 'weeks';

/**
 * Interval-based schedule configuration.
 * Simpler alternative to cron for basic use cases.
 *
 * @example
 * // Every 5 minutes
 * { mode: 'interval', value: 5, unit: 'minutes' }
 *
 * // Every 2 hours
 * { mode: 'interval', value: 2, unit: 'hours' }
 */
export interface IntervalSchedule {
  mode: 'interval';

  /** Number of time units between runs */
  value: number;

  /** Time unit for the interval */
  unit: IntervalUnit;

  /**
   * Whether to run immediately on start.
   * Default: false (waits for first interval)
   */
  runOnStart?: boolean;
}

/**
 * Cron-based schedule configuration.
 * Supports standard cron expressions with optional timezone.
 *
 * @example
 * // Every day at 9am
 * { mode: 'cron', expression: '0 9 * * *' }
 *
 * // Weekdays at 9am EST
 * { mode: 'cron', expression: '0 9 * * 1-5', timezone: 'America/New_York' }
 *
 * // Every 30 minutes
 * { mode: 'cron', expression: '0,30 * * * *' }
 */
export interface CronSchedule {
  mode: 'cron';

  /**
   * Cron expression (5 or 6 fields).
   * 5 fields: minute hour dayOfMonth month dayOfWeek
   * 6 fields: second minute hour dayOfMonth month dayOfWeek
   */
  expression: string;

  /**
   * IANA timezone for the schedule.
   * Default: system timezone
   *
   * @example 'America/New_York', 'Europe/London', 'Asia/Tokyo'
   */
  timezone?: string;
}

/**
 * Union type for all schedule types.
 */
export type Schedule = IntervalSchedule | CronSchedule;

/**
 * Complete configuration for a schedule trigger.
 */
export interface ScheduleTriggerConfig extends TriggerConfig {
  type: 'schedule';

  /** Schedule configuration (interval or cron) */
  schedule: Schedule;

  /**
   * Optional start date - trigger won't run before this.
   */
  startDate?: Date;

  /**
   * Optional end date - trigger stops after this.
   */
  endDate?: Date;

  /**
   * Maximum number of runs before auto-disabling.
   * Useful for limited-time promotions, trials, etc.
   */
  maxRuns?: number;

  /**
   * Prompt or message to send when triggered.
   * Used for agent triggers.
   */
  prompt?: string;

  /**
   * Retry configuration for failed executions.
   */
  retry?: RetryConfig;

  /**
   * Execution timeout in milliseconds.
   * Default: 30000 (30 seconds)
   */
  timeout?: number;

  /**
   * Concurrency control - skip if previous run still executing.
   * Default: true (skip overlapping runs)
   */
  skipIfRunning?: boolean;
}

/**
 * Retry configuration for failed trigger executions.
 *
 * ## Production Notes:
 * BullMQ provides more sophisticated retry with:
 * - Exponential backoff built-in
 * - Dead letter queues for failed jobs
 * - Retry attempt tracking and limits
 */
export interface RetryConfig {
  /** Whether to retry on failure */
  enabled: boolean;

  /** Maximum retry attempts */
  maxAttempts: number;

  /**
   * Delay between retries in milliseconds.
   * Can be a number or exponential backoff config.
   */
  delay: number | ExponentialBackoff;
}

/**
 * Exponential backoff configuration for retries.
 */
export interface ExponentialBackoff {
  type: 'exponential';

  /** Initial delay in milliseconds */
  initial: number;

  /** Multiplier for each retry */
  multiplier: number;

  /** Maximum delay cap in milliseconds */
  maxDelay: number;
}

/**
 * Pre-built schedule presets for common use cases.
 * Use these for quick setup or as reference.
 *
 * @example
 * import { SchedulePresets } from '@librechat/triggers';
 *
 * const config = {
 *   type: 'schedule',
 *   schedule: SchedulePresets.EVERY_HOUR,
 * };
 */
export const SchedulePresets = {
  // Interval presets
  EVERY_MINUTE: { mode: 'interval', value: 1, unit: 'minutes' } as IntervalSchedule,
  EVERY_5_MINUTES: { mode: 'interval', value: 5, unit: 'minutes' } as IntervalSchedule,
  EVERY_15_MINUTES: { mode: 'interval', value: 15, unit: 'minutes' } as IntervalSchedule,
  EVERY_30_MINUTES: { mode: 'interval', value: 30, unit: 'minutes' } as IntervalSchedule,
  EVERY_HOUR: { mode: 'interval', value: 1, unit: 'hours' } as IntervalSchedule,
  EVERY_6_HOURS: { mode: 'interval', value: 6, unit: 'hours' } as IntervalSchedule,
  EVERY_12_HOURS: { mode: 'interval', value: 12, unit: 'hours' } as IntervalSchedule,
  EVERY_DAY: { mode: 'interval', value: 1, unit: 'days' } as IntervalSchedule,
  EVERY_WEEK: { mode: 'interval', value: 1, unit: 'weeks' } as IntervalSchedule,

  // Cron presets
  DAILY_MIDNIGHT: { mode: 'cron', expression: '0 0 * * *' } as CronSchedule,
  DAILY_9AM: { mode: 'cron', expression: '0 9 * * *' } as CronSchedule,
  DAILY_6PM: { mode: 'cron', expression: '0 18 * * *' } as CronSchedule,
  WEEKDAYS_9AM: { mode: 'cron', expression: '0 9 * * 1-5' } as CronSchedule,
  WEEKDAYS_6PM: { mode: 'cron', expression: '0 18 * * 1-5' } as CronSchedule,
  WEEKENDS_10AM: { mode: 'cron', expression: '0 10 * * 0,6' } as CronSchedule,
  MONDAY_9AM: { mode: 'cron', expression: '0 9 * * 1' } as CronSchedule,
  FRIDAY_5PM: { mode: 'cron', expression: '0 17 * * 5' } as CronSchedule,
  FIRST_OF_MONTH: { mode: 'cron', expression: '0 9 1 * *' } as CronSchedule,
  LAST_DAY_OF_MONTH: { mode: 'cron', expression: '0 9 L * *' } as CronSchedule,
} as const;

/**
 * Type helper to get preset names.
 */
export type SchedulePresetName = keyof typeof SchedulePresets;

/**
 * Human-readable schedule descriptions.
 * Used for UI display.
 */
export const SchedulePresetLabels: Record<SchedulePresetName, string> = {
  EVERY_MINUTE: 'Every minute',
  EVERY_5_MINUTES: 'Every 5 minutes',
  EVERY_15_MINUTES: 'Every 15 minutes',
  EVERY_30_MINUTES: 'Every 30 minutes',
  EVERY_HOUR: 'Every hour',
  EVERY_6_HOURS: 'Every 6 hours',
  EVERY_12_HOURS: 'Every 12 hours',
  EVERY_DAY: 'Every day',
  EVERY_WEEK: 'Every week',
  DAILY_MIDNIGHT: 'Daily at midnight',
  DAILY_9AM: 'Daily at 9:00 AM',
  DAILY_6PM: 'Daily at 6:00 PM',
  WEEKDAYS_9AM: 'Weekdays at 9:00 AM',
  WEEKDAYS_6PM: 'Weekdays at 6:00 PM',
  WEEKENDS_10AM: 'Weekends at 10:00 AM',
  MONDAY_9AM: 'Every Monday at 9:00 AM',
  FRIDAY_5PM: 'Every Friday at 5:00 PM',
  FIRST_OF_MONTH: 'First day of month at 9:00 AM',
  LAST_DAY_OF_MONTH: 'Last day of month at 9:00 AM',
};
