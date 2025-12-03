/**
 * @librechat/triggers - Base Types
 *
 * Core interfaces that all trigger implementations must follow.
 * Designed for extensibility - add new trigger types by extending these interfaces.
 *
 * ## Architecture Notes:
 * - ITrigger: Core interface all triggers implement
 * - TriggerConfig: Base configuration extended by each trigger type
 * - TriggerContext: Runtime context passed to handlers when triggered
 * - TriggerResult: Standardized result from trigger execution
 *
 * ## Production Considerations:
 * - For distributed systems, consider using BullMQ for job scheduling
 * - Current node-cron implementation is single-process only
 * - Add Redis-backed state for multi-instance deployments
 *
 * @packageDocumentation
 */

/**
 * Supported trigger types.
 * Extend this union type when adding new trigger implementations.
 *
 * @example
 * // Future additions:
 * // 'webhook' - HTTP endpoint triggers
 * // 'event' - Internal event bus triggers
 * // 'email' - IMAP email triggers
 * // 'queue' - Message queue triggers (RabbitMQ, SQS, etc.)
 */
export type TriggerType = 'schedule' | 'webhook' | 'event' | 'manual';

/**
 * Trigger execution state for tracking
 */
export type TriggerState = 'idle' | 'running' | 'stopped' | 'error';

/**
 * Base configuration for all triggers.
 * Extend this interface for specific trigger types.
 */
export interface TriggerConfig {
  /** Unique identifier for this trigger instance */
  id: string;

  /** Type discriminator for the trigger */
  type: TriggerType;

  /** Whether the trigger is active */
  enabled: boolean;

  /** Human-readable name for the trigger */
  name?: string;

  /** Description of what this trigger does */
  description?: string;

  /** Associated entity ID (e.g., agentId, workflowId) */
  targetId?: string;

  /** Target entity type */
  targetType?: 'agent' | 'workflow' | 'action';

  /** Custom metadata for extensibility */
  metadata?: Record<string, unknown>;

  /** Created timestamp */
  createdAt?: Date;

  /** Last updated timestamp */
  updatedAt?: Date;
}

/**
 * Context provided to trigger handlers when executed.
 * Contains runtime information about the trigger event.
 */
export interface TriggerContext {
  /** When the trigger fired */
  triggeredAt: Date;

  /** Type of trigger that fired */
  triggerType: TriggerType;

  /** ID of the trigger that fired */
  triggerId: string;

  /** Target entity ID (agentId, etc.) */
  targetId?: string;

  /** Execution attempt number (for retries) */
  attempt: number;

  /** Payload data (varies by trigger type) */
  payload?: unknown;

  /** Additional context metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Result from trigger execution.
 * Used for logging, monitoring, and retry decisions.
 */
export interface TriggerResult {
  /** Whether execution succeeded */
  success: boolean;

  /** Unique execution ID for tracking */
  executionId: string;

  /** When execution started */
  startedAt: Date;

  /** When execution completed (if finished) */
  completedAt?: Date;

  /** Duration in milliseconds */
  durationMs?: number;

  /** Error message if failed */
  error?: string;

  /** Error stack trace (dev only) */
  errorStack?: string;

  /** Output data from execution */
  output?: unknown;

  /** Whether a retry should be attempted */
  shouldRetry?: boolean;
}

/**
 * Handler function called when a trigger fires.
 * Implement this to define what happens when triggered.
 */
export type TriggerHandler = (context: TriggerContext) => Promise<TriggerResult>;

/**
 * Event emitted by triggers for lifecycle tracking.
 */
export interface TriggerEvent {
  type: 'started' | 'stopped' | 'triggered' | 'completed' | 'error';
  triggerId: string;
  timestamp: Date;
  data?: unknown;
}

/**
 * Event listener for trigger lifecycle events.
 */
export type TriggerEventListener = (event: TriggerEvent) => void;

/**
 * Core trigger interface that all trigger implementations must follow.
 * Designed to be framework-agnostic and easily testable.
 *
 * ## Implementation Guide:
 * 1. Extend BaseTrigger abstract class (handles common logic)
 * 2. Implement start() and stop() for your trigger mechanism
 * 3. Call this.emit() when trigger should fire
 *
 * ## Production Notes:
 * - For production, swap node-cron with BullMQ for:
 *   - Distributed job scheduling across instances
 *   - Redis-backed persistence and retry
 *   - Job prioritization and rate limiting
 *   - Better monitoring and observability
 */
export interface ITrigger<TConfig extends TriggerConfig = TriggerConfig> {
  /** Unique trigger ID */
  readonly id: string;

  /** Trigger type */
  readonly type: TriggerType;

  /** Current trigger configuration */
  readonly config: TConfig;

  /** Current execution state */
  readonly state: TriggerState;

  /**
   * Start the trigger (begin listening/scheduling).
   * Should be idempotent - calling multiple times is safe.
   */
  start(): Promise<void>;

  /**
   * Stop the trigger (stop listening/scheduling).
   * Should cleanup all resources and be idempotent.
   */
  stop(): Promise<void>;

  /**
   * Check if trigger is currently active/running.
   */
  isRunning(): boolean;

  /**
   * Get the next scheduled run time (if applicable).
   * Returns null for event-based triggers or if not scheduled.
   */
  getNextRun(): Date | null;

  /**
   * Get the last time this trigger fired.
   * Returns null if never fired.
   */
  getLastRun(): Date | null;

  /**
   * Get execution statistics.
   */
  getStats(): TriggerStats;

  /**
   * Register the handler to execute when triggered.
   * Only one handler per trigger - last registration wins.
   */
  onTrigger(handler: TriggerHandler): void;

  /**
   * Add event listener for lifecycle events.
   */
  addEventListener(listener: TriggerEventListener): void;

  /**
   * Remove event listener.
   */
  removeEventListener(listener: TriggerEventListener): void;

  /**
   * Update trigger configuration.
   * May require restart to take effect.
   */
  updateConfig(config: Partial<TConfig>): void;

  /**
   * Manually trigger execution (for testing/manual runs).
   */
  trigger(payload?: unknown): Promise<TriggerResult>;
}

/**
 * Statistics for trigger monitoring.
 */
export interface TriggerStats {
  /** Total number of executions */
  totalRuns: number;

  /** Successful executions */
  successfulRuns: number;

  /** Failed executions */
  failedRuns: number;

  /** Last successful run */
  lastSuccessAt?: Date;

  /** Last failed run */
  lastFailureAt?: Date;

  /** Average execution duration in ms */
  avgDurationMs: number;

  /** Last error message */
  lastError?: string;
}

/**
 * Options for creating trigger instances.
 */
export interface TriggerOptions {
  /**
   * Whether to auto-start the trigger after creation.
   * Default: false
   */
  autoStart?: boolean;

  /**
   * Custom logger for trigger events.
   * Default: console
   */
  logger?: TriggerLogger;

  /**
   * Enable debug mode for verbose logging.
   * Default: false
   */
  debug?: boolean;
}

/**
 * Logger interface for trigger events.
 * Implement this to integrate with your logging system.
 */
export interface TriggerLogger {
  debug(message: string, data?: unknown): void;
  info(message: string, data?: unknown): void;
  warn(message: string, data?: unknown): void;
  error(message: string, data?: unknown): void;
}
