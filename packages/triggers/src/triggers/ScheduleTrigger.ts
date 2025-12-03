/**
 * @librechat/triggers - Schedule Trigger Implementation
 *
 * Cron and interval-based trigger using node-cron.
 * Supports both simple intervals and complex cron expressions.
 *
 * ## Current Implementation:
 * Uses node-cron for lightweight, single-process scheduling.
 * Perfect for demos, development, and small deployments.
 *
 * ## Production Upgrade Path (BullMQ):
 * For production with multiple instances, replace this with BullMQ:
 *
 * ```typescript
 * // Instead of node-cron, use BullMQ repeatable jobs:
 * import { Queue, Worker } from 'bullmq';
 *
 * const queue = new Queue('agent-triggers', { connection: redis });
 *
 * // Add repeatable job
 * await queue.add('execute-agent', { agentId }, {
 *   repeat: { pattern: '0 9 * * 1-5' }  // Cron expression
 * });
 *
 * // Worker processes jobs
 * const worker = new Worker('agent-triggers', async (job) => {
 *   await executeAgent(job.data.agentId);
 * }, { connection: redis });
 * ```
 *
 * Benefits of BullMQ:
 * - Distributed across multiple instances
 * - Redis-backed persistence (survives restarts)
 * - Built-in retry with exponential backoff
 * - Job prioritization and rate limiting
 * - Excellent monitoring (Bull Board, Arena)
 *
 * @packageDocumentation
 */

import cron, { ScheduledTask } from 'node-cron';
import { BaseTrigger } from './BaseTrigger';
import type {
  ScheduleTriggerConfig,
  Schedule,
  IntervalSchedule,
  CronSchedule,
  TriggerContext,
  TriggerOptions,
} from '../types';
import { intervalToCron, isValidCronExpression, getNextCronDate } from '../utils/cron-parser';

/**
 * Schedule trigger implementation using node-cron.
 *
 * Supports two scheduling modes:
 * 1. Interval: "every N minutes/hours/days"
 * 2. Cron: Standard cron expressions
 *
 * @example
 * ```typescript
 * // Interval mode
 * const trigger = new ScheduleTrigger({
 *   id: 'daily-report',
 *   type: 'schedule',
 *   enabled: true,
 *   schedule: { mode: 'interval', value: 1, unit: 'hours' },
 * });
 *
 * // Cron mode
 * const trigger = new ScheduleTrigger({
 *   id: 'weekday-morning',
 *   type: 'schedule',
 *   enabled: true,
 *   schedule: {
 *     mode: 'cron',
 *     expression: '0 9 * * 1-5',
 *     timezone: 'America/New_York',
 *   },
 * });
 *
 * trigger.onTrigger(async (ctx) => {
 *   console.log('Triggered at:', ctx.triggeredAt);
 *   return { success: true, executionId: ctx.triggerId };
 * });
 *
 * await trigger.start();
 * ```
 */
export class ScheduleTrigger extends BaseTrigger<ScheduleTriggerConfig> {
  /** The node-cron scheduled task instance */
  private _task: ScheduledTask | null = null;

  /** Resolved cron expression (from interval or direct) */
  private _cronExpression: string;

  /** Run counter for maxRuns limit */
  private _runCount: number = 0;

  /** Interval timer for interval mode (more accurate than cron for short intervals) */
  private _intervalTimer: NodeJS.Timeout | null = null;

  /**
   * Create a new schedule trigger.
   *
   * @param config - Schedule trigger configuration
   * @param options - Optional settings
   */
  constructor(config: ScheduleTriggerConfig, options: TriggerOptions = {}) {
    super(config, options);

    // Resolve schedule to cron expression
    this._cronExpression = this.resolveCronExpression(config.schedule);

    // Validate cron expression
    if (!isValidCronExpression(this._cronExpression)) {
      throw new Error(`Invalid cron expression: ${this._cronExpression}`);
    }

    this.log('debug', `ScheduleTrigger created: ${this.id}`, {
      schedule: config.schedule,
      cronExpression: this._cronExpression,
    });
  }

  /**
   * Convert schedule config to cron expression.
   *
   * @param schedule - Schedule configuration
   * @returns Cron expression string
   */
  private resolveCronExpression(schedule: Schedule): string {
    if (schedule.mode === 'cron') {
      return schedule.expression;
    }
    return intervalToCron(schedule);
  }

  /**
   * Start the scheduled trigger.
   * Idempotent - safe to call multiple times.
   */
  async start(): Promise<void> {
    // Check if already running
    if (this._state === 'running') {
      this.log('debug', `Trigger ${this.id} already running`);
      return;
    }

    // Check if enabled
    if (!this._config.enabled) {
      this.log('info', `Trigger ${this.id} is disabled, not starting`);
      return;
    }

    // Check start date constraint
    if (this._config.startDate && new Date() < this._config.startDate) {
      this.log('info', `Trigger ${this.id} start date not reached yet`);
      return;
    }

    // Check end date constraint
    if (this._config.endDate && new Date() > this._config.endDate) {
      this.log('info', `Trigger ${this.id} end date has passed`);
      return;
    }

    this.log('info', `Starting trigger ${this.id} with schedule: ${this._cronExpression}`);

    try {
      // For short intervals (< 1 minute), use setInterval instead of cron
      // node-cron minimum resolution is 1 second, but setInterval is more accurate
      const schedule = this._config.schedule;
      if (schedule.mode === 'interval' && schedule.unit === 'seconds') {
        this.startIntervalMode(schedule);
      } else {
        this.startCronMode();
      }

      this._state = 'running';
      this.emitEvent('started');

      // Run immediately if configured
      if (schedule.mode === 'interval' && schedule.runOnStart) {
        setImmediate(() => this.onScheduledRun());
      }
    } catch (error) {
      this._state = 'error';
      this.log('error', `Failed to start trigger ${this.id}`, { error });
      throw error;
    }
  }

  /**
   * Start using node-cron for scheduling.
   */
  private startCronMode(): void {
    const options: cron.ScheduleOptions = {
      scheduled: true,
      timezone: (this._config.schedule as CronSchedule).timezone,
    };

    this._task = cron.schedule(
      this._cronExpression,
      () => this.onScheduledRun(),
      options
    );
  }

  /**
   * Start using setInterval for sub-minute intervals.
   * More accurate for short intervals than cron.
   */
  private startIntervalMode(schedule: IntervalSchedule): void {
    const intervalMs = this.getIntervalMs(schedule);
    this._intervalTimer = setInterval(() => this.onScheduledRun(), intervalMs);
  }

  /**
   * Convert interval config to milliseconds.
   */
  private getIntervalMs(schedule: IntervalSchedule): number {
    const multipliers: Record<string, number> = {
      seconds: 1000,
      minutes: 60 * 1000,
      hours: 60 * 60 * 1000,
      days: 24 * 60 * 60 * 1000,
      weeks: 7 * 24 * 60 * 60 * 1000,
    };
    return schedule.value * (multipliers[schedule.unit] || 60000);
  }

  /**
   * Called when the schedule fires.
   * Handles overlap prevention, max runs, and execution.
   */
  private async onScheduledRun(): Promise<void> {
    // Check if still enabled
    if (!this._config.enabled || this._state !== 'running') {
      return;
    }

    // Check end date
    if (this._config.endDate && new Date() > this._config.endDate) {
      this.log('info', `Trigger ${this.id} end date reached, stopping`);
      await this.stop();
      return;
    }

    // Check max runs
    if (this._config.maxRuns && this._runCount >= this._config.maxRuns) {
      this.log('info', `Trigger ${this.id} max runs (${this._config.maxRuns}) reached, stopping`);
      await this.stop();
      return;
    }

    // Skip if already executing (overlap prevention)
    if (this._config.skipIfRunning !== false && this._isExecuting) {
      this.log('debug', `Trigger ${this.id} skipping - previous run still executing`);
      return;
    }

    // Increment run count
    this._runCount++;

    // Build context
    const context: TriggerContext = {
      triggeredAt: new Date(),
      triggerType: 'schedule',
      triggerId: this.id,
      targetId: this._config.targetId,
      attempt: 1,
      payload: {
        prompt: this._config.prompt,
        schedule: this._config.schedule,
        runNumber: this._runCount,
      },
      metadata: this._config.metadata,
    };

    // Execute with optional retry
    await this.executeWithRetry(context);
  }

  /**
   * Execute with retry logic if configured.
   *
   * @param context - Trigger context
   */
  private async executeWithRetry(context: TriggerContext): Promise<void> {
    const retry = this._config.retry;
    const maxAttempts = retry?.enabled ? retry.maxAttempts : 1;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      context.attempt = attempt;

      const result = await this.execute(context);

      if (result.success) {
        return;
      }

      // Check if we should retry
      if (!retry?.enabled || attempt >= maxAttempts) {
        return;
      }

      // Calculate delay
      const delay = this.getRetryDelay(attempt, retry.delay);
      this.log('info', `Trigger ${this.id} retrying in ${delay}ms (attempt ${attempt + 1}/${maxAttempts})`);

      await this.sleep(delay);
    }
  }

  /**
   * Calculate retry delay based on config.
   */
  private getRetryDelay(attempt: number, delay: number | { type: 'exponential'; initial: number; multiplier: number; maxDelay: number }): number {
    if (typeof delay === 'number') {
      return delay;
    }

    // Exponential backoff
    const calculated = delay.initial * Math.pow(delay.multiplier, attempt - 1);
    return Math.min(calculated, delay.maxDelay);
  }

  /**
   * Sleep for specified milliseconds.
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Stop the trigger and cleanup resources.
   * Idempotent - safe to call multiple times.
   */
  async stop(): Promise<void> {
    if (this._state === 'stopped' || this._state === 'idle') {
      return;
    }

    this.log('info', `Stopping trigger ${this.id}`);

    // Stop cron task
    if (this._task) {
      this._task.stop();
      this._task = null;
    }

    // Clear interval timer
    if (this._intervalTimer) {
      clearInterval(this._intervalTimer);
      this._intervalTimer = null;
    }

    this._state = 'stopped';
    this.emitEvent('stopped');
  }

  /**
   * Get the next scheduled run time.
   *
   * @returns Next run date or null
   */
  getNextRun(): Date | null {
    if (this._state !== 'running') {
      return null;
    }

    // Check if max runs reached
    if (this._config.maxRuns && this._runCount >= this._config.maxRuns) {
      return null;
    }

    // Check end date
    if (this._config.endDate && new Date() > this._config.endDate) {
      return null;
    }

    return getNextCronDate(this._cronExpression, (this._config.schedule as CronSchedule).timezone);
  }

  /**
   * Update configuration and optionally restart.
   *
   * @param config - Partial config to update
   */
  updateConfig(config: Partial<ScheduleTriggerConfig>): void {
    const wasRunning = this._state === 'running';
    const scheduleChanged = config.schedule !== undefined;

    // Stop if schedule changed and was running
    if (scheduleChanged && wasRunning) {
      this.stop();
    }

    // Update config
    super.updateConfig(config);

    // Re-resolve cron expression if schedule changed
    if (scheduleChanged && config.schedule) {
      this._cronExpression = this.resolveCronExpression(config.schedule);
      if (!isValidCronExpression(this._cronExpression)) {
        throw new Error(`Invalid cron expression: ${this._cronExpression}`);
      }
    }

    // Restart if was running
    if (scheduleChanged && wasRunning) {
      this.start();
    }
  }

  /**
   * Get the current cron expression.
   * Useful for debugging and display.
   */
  getCronExpression(): string {
    return this._cronExpression;
  }

  /**
   * Get current run count.
   */
  getRunCount(): number {
    return this._runCount;
  }

  /**
   * Reset run count (for testing or reactivation).
   */
  resetRunCount(): void {
    this._runCount = 0;
  }
}
