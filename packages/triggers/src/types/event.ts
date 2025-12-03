/**
 * @librechat/triggers - Event Trigger Types
 *
 * Types for internal event-based triggers.
 * Allows triggers to fire based on application events.
 *
 * ## Future Implementation Notes:
 * - Integrate with application event bus
 * - Support event filtering and pattern matching
 * - Enable event aggregation (e.g., "after 5 errors")
 *
 * ## Use Cases:
 * - User signup → Welcome agent
 * - Error threshold → Alert agent
 * - Document upload → Processing agent
 * - Conversation end → Summary agent
 *
 * @packageDocumentation
 */

import type { TriggerConfig, TriggerContext } from './base';

/**
 * Built-in event types that can trigger agents.
 * Extend this for custom application events.
 */
export type EventType =
  // User events
  | 'user.created'
  | 'user.updated'
  | 'user.deleted'
  | 'user.login'
  | 'user.logout'
  // Conversation events
  | 'conversation.created'
  | 'conversation.completed'
  | 'conversation.archived'
  // Message events
  | 'message.created'
  | 'message.error'
  // Agent events
  | 'agent.created'
  | 'agent.updated'
  | 'agent.executed'
  | 'agent.error'
  // File events
  | 'file.uploaded'
  | 'file.processed'
  | 'file.deleted'
  // System events
  | 'system.startup'
  | 'system.shutdown'
  | 'system.error'
  // Custom events
  | `custom.${string}`;

/**
 * Event filter for matching specific events.
 */
export interface EventFilter {
  /**
   * Event types to listen for.
   * Supports wildcards: 'user.*', '*.error'
   */
  types: string[];

  /**
   * Optional condition to match event data.
   * Uses simple key-value matching.
   */
  conditions?: Record<string, unknown>;

  /**
   * Optional JSONPath expressions for complex matching.
   */
  jsonPath?: string;
}

/**
 * Configuration for event-based triggers.
 * NOT YET IMPLEMENTED - Interface defined for future use.
 */
export interface EventTriggerConfig extends TriggerConfig {
  type: 'event';

  /**
   * Event filter configuration.
   */
  filter: EventFilter;

  /**
   * Debounce configuration - wait before firing.
   * Useful for aggregating rapid events.
   */
  debounce?: {
    /** Wait time in milliseconds */
    wait: number;
    /** Maximum wait time before forcing fire */
    maxWait?: number;
  };

  /**
   * Throttle configuration - limit firing rate.
   */
  throttle?: {
    /** Minimum time between fires in milliseconds */
    interval: number;
  };

  /**
   * Aggregation - fire after N matching events.
   */
  aggregate?: {
    /** Number of events to aggregate */
    count: number;
    /** Time window for aggregation in milliseconds */
    window: number;
  };
}

/**
 * Context for event trigger execution.
 * Extends base context with event-specific data.
 */
export interface EventTriggerContext extends TriggerContext {
  triggerType: 'event';

  /** The event that triggered this execution */
  event: {
    type: EventType;
    source: string;
    timestamp: Date;
    data: unknown;
  };

  /** Aggregated events if using aggregation */
  aggregatedEvents?: Array<{
    type: EventType;
    timestamp: Date;
    data: unknown;
  }>;
}
