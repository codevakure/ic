/**
 * @librechat/triggers
 *
 * Extensible trigger system for LibreChat agents.
 * Supports scheduled (cron/interval), webhook, and event-based triggers.
 *
 * See README.md for full documentation and examples.
 *
 * Production Note: Current implementation uses node-cron.
 * For production, migrate to BullMQ for distributed scheduling.
 *
 * @packageDocumentation
 */

// ============================================================================
// Types - Core interfaces and configurations
// ============================================================================
export type {
  // Base types
  TriggerType,
  TriggerState,
  TriggerConfig,
  TriggerContext,
  TriggerResult,
  TriggerHandler,
  TriggerEvent,
  TriggerEventListener,
  ITrigger,
  TriggerStats,
  TriggerOptions,
  TriggerLogger,
  // Schedule types
  ScheduleMode,
  IntervalUnit,
  IntervalSchedule,
  CronSchedule,
  Schedule,
  ScheduleTriggerConfig,
  RetryConfig,
  ExponentialBackoff,
  SchedulePresetName,
  // Webhook types (future)
  WebhookMethod,
  WebhookAuthType,
  WebhookAuth,
  WebhookTriggerConfig,
  WebhookResponse,
  WebhookRateLimit,
  WebhookTriggerContext,
  WebhookEvent,
  // Event types (future)
  EventType,
  EventFilter,
  EventTriggerConfig,
  EventTriggerContext,
} from './types';

export { SchedulePresets, SchedulePresetLabels } from './types';

// ============================================================================
// Triggers - Trigger implementations
// ============================================================================
export { BaseTrigger } from './triggers/BaseTrigger';
export { ScheduleTrigger } from './triggers/ScheduleTrigger';

// Future exports:
// export { WebhookTrigger } from './triggers/WebhookTrigger';
// export { EventTrigger } from './triggers/EventTrigger';

// ============================================================================
// Registry - Central trigger management
// ============================================================================
export { TriggerRegistry } from './registry/TriggerRegistry';
export type { TriggerRegistryOptions, RegistryStatus } from './registry/TriggerRegistry';

// ============================================================================
// Utilities - Helper functions
// ============================================================================
export {
  intervalToCron,
  isValidCronExpression,
  getNextCronDate,
  parseHumanInterval,
  formatSchedule,
  getIntervalMs,
} from './utils';
