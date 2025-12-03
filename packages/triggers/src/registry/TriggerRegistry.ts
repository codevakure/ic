/**
 * @librechat/triggers - Trigger Registry
 *
 * Central registry for managing all trigger instances.
 * Provides lifecycle management, lookup, and batch operations.
 *
 * ## Features:
 * - Register/unregister triggers
 * - Start/stop all or by type
 * - Lookup by ID, type, or target
 * - Event aggregation
 *
 * ## Production Considerations:
 * For distributed systems with multiple instances:
 * - Use Redis for trigger state synchronization
 * - Implement leader election for scheduler duties
 * - Consider using BullMQ's built-in repeat functionality
 *
 * ## Usage:
 * ```typescript
 * const registry = new TriggerRegistry();
 *
 * // Register triggers
 * registry.register(scheduleTrigger);
 * registry.register(webhookTrigger);
 *
 * // Start all
 * await registry.startAll();
 *
 * // Query
 * const agentTriggers = registry.getByTarget('agent-123');
 * const scheduleTriggers = registry.getByType('schedule');
 *
 * // Cleanup
 * await registry.stopAll();
 * ```
 *
 * @packageDocumentation
 */

import type {
  ITrigger,
  TriggerConfig,
  TriggerType,
  TriggerEventListener,
  TriggerEvent,
  TriggerLogger,
  ScheduleTriggerConfig,
} from '../types';
import { ScheduleTrigger } from '../triggers/ScheduleTrigger';

/**
 * Options for TriggerRegistry.
 */
export interface TriggerRegistryOptions {
  /** Logger for registry events */
  logger?: TriggerLogger;

  /** Auto-start triggers on registration */
  autoStart?: boolean;

  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Registry status for monitoring.
 */
export interface RegistryStatus {
  /** Total registered triggers */
  totalTriggers: number;

  /** Running triggers */
  runningTriggers: number;

  /** Stopped triggers */
  stoppedTriggers: number;

  /** Triggers by type */
  byType: Record<TriggerType, number>;

  /** Last update timestamp */
  timestamp: Date;
}

/**
 * Default console logger.
 */
const defaultLogger: TriggerLogger = {
  debug: (msg, data) => console.debug(`[TriggerRegistry] ${msg}`, data ?? ''),
  info: (msg, data) => console.info(`[TriggerRegistry] ${msg}`, data ?? ''),
  warn: (msg, data) => console.warn(`[TriggerRegistry] ${msg}`, data ?? ''),
  error: (msg, data) => console.error(`[TriggerRegistry] ${msg}`, data ?? ''),
};

/**
 * Central registry for managing trigger instances.
 *
 * Provides:
 * - Registration and lifecycle management
 * - Lookup by ID, type, or target entity
 * - Batch start/stop operations
 * - Event aggregation from all triggers
 *
 * @example
 * ```typescript
 * const registry = new TriggerRegistry({ autoStart: true });
 *
 * // Register a schedule trigger for an agent
 * const trigger = registry.createScheduleTrigger({
 *   id: 'agent-123-daily',
 *   type: 'schedule',
 *   enabled: true,
 *   targetId: 'agent-123',
 *   targetType: 'agent',
 *   schedule: { mode: 'cron', expression: '0 9 * * *' },
 *   prompt: 'Generate daily summary',
 * });
 *
 * trigger.onTrigger(async (ctx) => {
 *   // Execute agent with ctx.payload.prompt
 *   return { success: true, executionId: 'exec-1' };
 * });
 * ```
 */
export class TriggerRegistry {
  /** Map of trigger ID to trigger instance */
  private _triggers: Map<string, ITrigger> = new Map();

  /** Global event listeners */
  private _listeners: Set<TriggerEventListener> = new Set();

  /** Registry options */
  private _options: TriggerRegistryOptions;

  /** Logger instance */
  private _logger: TriggerLogger;

  /**
   * Create a new trigger registry.
   *
   * @param options - Registry options
   */
  constructor(options: TriggerRegistryOptions = {}) {
    this._options = options;
    this._logger = options.logger ?? defaultLogger;
  }

  /**
   * Register a trigger with the registry.
   * Optionally auto-starts if configured.
   *
   * @param trigger - Trigger to register
   * @throws Error if trigger ID already exists
   */
  register(trigger: ITrigger): void {
    if (this._triggers.has(trigger.id)) {
      throw new Error(`Trigger with ID ${trigger.id} already registered`);
    }

    this._triggers.set(trigger.id, trigger);

    // Forward trigger events to registry listeners
    trigger.addEventListener((event) => this.onTriggerEvent(event));

    this.log('info', `Registered trigger: ${trigger.id} (${trigger.type})`);

    // Auto-start if configured
    if (this._options.autoStart) {
      trigger.start().catch((error) => {
        this.log('error', `Failed to auto-start trigger ${trigger.id}`, { error });
      });
    }
  }

  /**
   * Unregister a trigger by ID.
   * Stops the trigger if running.
   *
   * @param triggerId - ID of trigger to remove
   * @returns true if trigger was found and removed
   */
  async unregister(triggerId: string): Promise<boolean> {
    const trigger = this._triggers.get(triggerId);
    if (!trigger) {
      return false;
    }

    // Stop if running
    if (trigger.isRunning()) {
      await trigger.stop();
    }

    this._triggers.delete(triggerId);
    this.log('info', `Unregistered trigger: ${triggerId}`);

    return true;
  }

  /**
   * Get a trigger by ID.
   *
   * @param triggerId - Trigger ID
   * @returns Trigger instance or undefined
   */
  get(triggerId: string): ITrigger | undefined {
    return this._triggers.get(triggerId);
  }

  /**
   * Check if a trigger exists.
   *
   * @param triggerId - Trigger ID
   * @returns true if trigger exists
   */
  has(triggerId: string): boolean {
    return this._triggers.has(triggerId);
  }

  /**
   * Get all registered triggers.
   *
   * @returns Array of all triggers
   */
  getAll(): ITrigger[] {
    return Array.from(this._triggers.values());
  }

  /**
   * Get triggers by type.
   *
   * @param type - Trigger type to filter by
   * @returns Array of matching triggers
   */
  getByType(type: TriggerType): ITrigger[] {
    return this.getAll().filter((t) => t.type === type);
  }

  /**
   * Get triggers by target entity.
   *
   * @param targetId - Target entity ID (e.g., agentId)
   * @returns Array of triggers for that target
   */
  getByTarget(targetId: string): ITrigger[] {
    return this.getAll().filter((t) => t.config.targetId === targetId);
  }

  /**
   * Get triggers by target type and ID.
   *
   * @param targetType - Target type (agent, workflow, etc.)
   * @param targetId - Optional target ID
   * @returns Array of matching triggers
   */
  getByTargetType(targetType: string, targetId?: string): ITrigger[] {
    return this.getAll().filter((t) => {
      if (t.config.targetType !== targetType) return false;
      if (targetId && t.config.targetId !== targetId) return false;
      return true;
    });
  }

  /**
   * Start all registered triggers.
   *
   * @returns Number of triggers started
   */
  async startAll(): Promise<number> {
    const triggers = this.getAll();
    let started = 0;

    await Promise.all(
      triggers.map(async (trigger) => {
        try {
          await trigger.start();
          started++;
        } catch (error) {
          this.log('error', `Failed to start trigger ${trigger.id}`, { error });
        }
      })
    );

    this.log('info', `Started ${started}/${triggers.length} triggers`);
    return started;
  }

  /**
   * Stop all registered triggers.
   *
   * @returns Number of triggers stopped
   */
  async stopAll(): Promise<number> {
    const triggers = this.getAll();
    let stopped = 0;

    await Promise.all(
      triggers.map(async (trigger) => {
        try {
          await trigger.stop();
          stopped++;
        } catch (error) {
          this.log('error', `Failed to stop trigger ${trigger.id}`, { error });
        }
      })
    );

    this.log('info', `Stopped ${stopped}/${triggers.length} triggers`);
    return stopped;
  }

  /**
   * Start triggers by type.
   *
   * @param type - Trigger type to start
   * @returns Number of triggers started
   */
  async startByType(type: TriggerType): Promise<number> {
    const triggers = this.getByType(type);
    let started = 0;

    for (const trigger of triggers) {
      try {
        await trigger.start();
        started++;
      } catch (error) {
        this.log('error', `Failed to start trigger ${trigger.id}`, { error });
      }
    }

    return started;
  }

  /**
   * Stop triggers by type.
   *
   * @param type - Trigger type to stop
   * @returns Number of triggers stopped
   */
  async stopByType(type: TriggerType): Promise<number> {
    const triggers = this.getByType(type);
    let stopped = 0;

    for (const trigger of triggers) {
      try {
        await trigger.stop();
        stopped++;
      } catch (error) {
        this.log('error', `Failed to stop trigger ${trigger.id}`, { error });
      }
    }

    return stopped;
  }

  /**
   * Create and register a schedule trigger.
   * Convenience method for the most common use case.
   *
   * @param config - Schedule trigger configuration
   * @returns The created trigger
   */
  createScheduleTrigger(config: ScheduleTriggerConfig): ScheduleTrigger {
    const trigger = new ScheduleTrigger(config, {
      logger: this._logger,
      debug: this._options.debug,
    });

    this.register(trigger);
    return trigger;
  }

  /**
   * Add a global event listener for all trigger events.
   *
   * @param listener - Event listener function
   */
  addEventListener(listener: TriggerEventListener): void {
    this._listeners.add(listener);
  }

  /**
   * Remove a global event listener.
   *
   * @param listener - Event listener to remove
   */
  removeEventListener(listener: TriggerEventListener): void {
    this._listeners.delete(listener);
  }

  /**
   * Get registry status for monitoring.
   *
   * @returns Registry status object
   */
  getStatus(): RegistryStatus {
    const triggers = this.getAll();

    const byType: Record<TriggerType, number> = {
      schedule: 0,
      webhook: 0,
      event: 0,
      manual: 0,
    };

    let running = 0;
    let stopped = 0;

    for (const trigger of triggers) {
      byType[trigger.type]++;
      if (trigger.isRunning()) {
        running++;
      } else {
        stopped++;
      }
    }

    return {
      totalTriggers: triggers.length,
      runningTriggers: running,
      stoppedTriggers: stopped,
      byType,
      timestamp: new Date(),
    };
  }

  /**
   * Clear all triggers (stops and removes all).
   */
  async clear(): Promise<void> {
    await this.stopAll();
    this._triggers.clear();
    this.log('info', 'Registry cleared');
  }

  /**
   * Handle events from individual triggers.
   * Forwards to global listeners.
   */
  private onTriggerEvent(event: TriggerEvent): void {
    for (const listener of this._listeners) {
      try {
        listener(event);
      } catch (error) {
        this.log('error', 'Global event listener error', { error });
      }
    }
  }

  /**
   * Log a message.
   */
  private log(
    level: 'debug' | 'info' | 'warn' | 'error',
    message: string,
    data?: unknown
  ): void {
    if (level === 'debug' && !this._options.debug) {
      return;
    }
    this._logger[level](message, data);
  }
}
