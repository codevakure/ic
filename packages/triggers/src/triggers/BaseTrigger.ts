/**
 * @ranger/triggers - Base Trigger Implementation
 *
 * Abstract base class that provides common functionality for all triggers.
 * Extend this class to create new trigger types.
 *
 * ## What this handles:
 * - Handler registration and invocation
 * - Event listener management
 * - Statistics tracking
 * - State management
 * - Logging
 *
 * ## What subclasses must implement:
 * - start(): Begin listening/scheduling
 * - stop(): Stop and cleanup
 * - getNextRun(): Next scheduled time (or null)
 *
 * ## Production Notes:
 * For production deployments with multiple instances:
 * - Override state management to use Redis
 * - Override stats tracking to use centralized metrics
 * - Consider distributed locking for single-execution guarantees
 *
 * @packageDocumentation
 */


import type {
  ITrigger,
  TriggerConfig,
  TriggerState,
  TriggerType,
  TriggerHandler,
  TriggerContext,
  TriggerResult,
  TriggerEvent,
  TriggerEventListener,
  TriggerStats,
  TriggerOptions,
  TriggerLogger,
} from '../types';

/**
 * Generate a UUID v4.
 * Using crypto.randomUUID when available, fallback to manual generation.
 */
function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for older Node versions
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Default console logger implementation.
 */
const defaultLogger: TriggerLogger = {
  debug: (msg, data) => console.debug(`[Trigger] ${msg}`, data ?? ''),
  info: (msg, data) => console.info(`[Trigger] ${msg}`, data ?? ''),
  warn: (msg, data) => console.warn(`[Trigger] ${msg}`, data ?? ''),
  error: (msg, data) => console.error(`[Trigger] ${msg}`, data ?? ''),
};

/**
 * Abstract base class for all trigger implementations.
 * Provides common functionality and enforces the ITrigger interface.
 *
 * @template TConfig - Specific trigger config type
 */
export abstract class BaseTrigger<TConfig extends TriggerConfig = TriggerConfig>
  implements ITrigger<TConfig>
{
  /** Unique trigger ID */
  public readonly id: string;

  /** Trigger type discriminator */
  public readonly type: TriggerType;

  /** Current configuration */
  protected _config: TConfig;

  /** Current execution state */
  protected _state: TriggerState = 'idle';

  /** Registered execution handler */
  protected _handler: TriggerHandler | null = null;

  /** Event listeners */
  protected _listeners: Set<TriggerEventListener> = new Set();

  /** Last run timestamp */
  protected _lastRun: Date | null = null;

  /** Statistics tracking */
  protected _stats: TriggerStats = {
    totalRuns: 0,
    successfulRuns: 0,
    failedRuns: 0,
    avgDurationMs: 0,
  };

  /** Duration history for average calculation */
  protected _durations: number[] = [];

  /** Max durations to keep for average */
  protected readonly MAX_DURATION_HISTORY = 100;

  /** Logger instance */
  protected _logger: TriggerLogger;

  /** Debug mode flag */
  protected _debug: boolean;

  /** Whether currently executing (for overlap prevention) */
  protected _isExecuting: boolean = false;

  /**
   * Create a new trigger instance.
   *
   * @param config - Trigger configuration
   * @param options - Optional settings
   */
  constructor(config: TConfig, options: TriggerOptions = {}) {
    this.id = config.id;
    this.type = config.type;
    this._config = { ...config };
    this._logger = options.logger ?? defaultLogger;
    this._debug = options.debug ?? false;

    if (options.autoStart) {
      // Defer auto-start to allow handler registration
      setImmediate(() => this.start());
    }
  }

  /**
   * Get current configuration (readonly copy).
   */
  get config(): TConfig {
    return { ...this._config };
  }

  /**
   * Get current state.
   */
  get state(): TriggerState {
    return this._state;
  }

  /**
   * Check if trigger is running.
   */
  isRunning(): boolean {
    return this._state === 'running';
  }

  /**
   * Get last run timestamp.
   */
  getLastRun(): Date | null {
    return this._lastRun;
  }

  /**
   * Get execution statistics.
   */
  getStats(): TriggerStats {
    return { ...this._stats };
  }

  /**
   * Register the handler to execute when triggered.
   * Only one handler allowed - last registration wins.
   *
   * @param handler - Function to execute when triggered
   */
  onTrigger(handler: TriggerHandler): void {
    this._handler = handler;
    this.log('debug', `Handler registered for trigger ${this.id}`);
  }

  /**
   * Add event listener for lifecycle events.
   *
   * @param listener - Event listener function
   */
  addEventListener(listener: TriggerEventListener): void {
    this._listeners.add(listener);
  }

  /**
   * Remove event listener.
   *
   * @param listener - Event listener to remove
   */
  removeEventListener(listener: TriggerEventListener): void {
    this._listeners.delete(listener);
  }

  /**
   * Update trigger configuration.
   * Emits 'updated' event. May require restart to take effect.
   *
   * @param config - Partial config to merge
   */
  updateConfig(config: Partial<TConfig>): void {
    this._config = { ...this._config, ...config, updatedAt: new Date() };
    this.log('info', `Config updated for trigger ${this.id}`, config);
  }

  /**
   * Manually trigger execution.
   * Useful for testing and one-off runs.
   *
   * @param payload - Optional payload to pass to handler
   * @returns Execution result
   */
  async trigger(payload?: unknown): Promise<TriggerResult> {
    const context: TriggerContext = {
      triggeredAt: new Date(),
      triggerType: this.type,
      triggerId: this.id,
      targetId: this._config.targetId,
      attempt: 1,
      payload,
      metadata: this._config.metadata,
    };

    return this.execute(context);
  }

  /**
   * Execute the trigger handler with context.
   * Handles error catching, stats tracking, and event emission.
   *
   * @param context - Trigger context
   * @returns Execution result
   */
  protected async execute(context: TriggerContext): Promise<TriggerResult> {
    const executionId = generateId();
    const startedAt = new Date();

    this.log('debug', `Executing trigger ${this.id}`, { executionId });
    this.emitEvent('triggered', { executionId, context });

    // Check for handler
    if (!this._handler) {
      const result: TriggerResult = {
        success: false,
        executionId,
        startedAt,
        completedAt: new Date(),
        error: 'No handler registered',
      };
      this.updateStats(result);
      return result;
    }

    // Mark as executing
    this._isExecuting = true;

    try {
      // Execute handler
      const result = await this._handler(context);

      // Enhance result
      const finalResult: TriggerResult = {
        ...result,
        executionId,
        startedAt,
        completedAt: new Date(),
        durationMs: Date.now() - startedAt.getTime(),
      };

      // Update tracking
      this._lastRun = startedAt;
      this.updateStats(finalResult);
      this.emitEvent('completed', { executionId, result: finalResult });

      this.log('info', `Trigger ${this.id} completed`, {
        success: finalResult.success,
        durationMs: finalResult.durationMs,
      });

      return finalResult;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;

      const result: TriggerResult = {
        success: false,
        executionId,
        startedAt,
        completedAt: new Date(),
        durationMs: Date.now() - startedAt.getTime(),
        error: errorMessage,
        errorStack,
        shouldRetry: true,
      };

      this._lastRun = startedAt;
      this.updateStats(result);
      this.emitEvent('error', { executionId, error: errorMessage });

      this.log('error', `Trigger ${this.id} failed`, { error: errorMessage });

      return result;
    } finally {
      this._isExecuting = false;
    }
  }

  /**
   * Update statistics after execution.
   *
   * @param result - Execution result
   */
  protected updateStats(result: TriggerResult): void {
    this._stats.totalRuns++;

    if (result.success) {
      this._stats.successfulRuns++;
      this._stats.lastSuccessAt = result.completedAt;
    } else {
      this._stats.failedRuns++;
      this._stats.lastFailureAt = result.completedAt;
      this._stats.lastError = result.error;
    }

    // Update average duration
    if (result.durationMs !== undefined) {
      this._durations.push(result.durationMs);
      if (this._durations.length > this.MAX_DURATION_HISTORY) {
        this._durations.shift();
      }
      this._stats.avgDurationMs =
        this._durations.reduce((a, b) => a + b, 0) / this._durations.length;
    }
  }

  /**
   * Emit an event to all listeners.
   *
   * @param type - Event type
   * @param data - Event data
   */
  protected emitEvent(type: TriggerEvent['type'], data?: unknown): void {
    const event: TriggerEvent = {
      type,
      triggerId: this.id,
      timestamp: new Date(),
      data,
    };

    for (const listener of this._listeners) {
      try {
        listener(event);
      } catch (error) {
        this.log('error', 'Event listener error', { error });
      }
    }
  }

  /**
   * Log a message using the configured logger.
   *
   * @param level - Log level
   * @param message - Log message
   * @param data - Optional data
   */
  protected log(
    level: 'debug' | 'info' | 'warn' | 'error',
    message: string,
    data?: unknown
  ): void {
    // Skip debug logs unless debug mode is enabled
    if (level === 'debug' && !this._debug) {
      return;
    }
    this._logger[level](message, data);
  }

  // ============================================
  // Abstract methods - must be implemented by subclasses
  // ============================================

  /**
   * Start the trigger (begin listening/scheduling).
   * Must be implemented by subclasses.
   */
  abstract start(): Promise<void>;

  /**
   * Stop the trigger (cleanup resources).
   * Must be implemented by subclasses.
   */
  abstract stop(): Promise<void>;

  /**
   * Get next scheduled run time.
   * Returns null for event-based triggers or if not scheduled.
   * Must be implemented by subclasses.
   */
  abstract getNextRun(): Date | null;
}
