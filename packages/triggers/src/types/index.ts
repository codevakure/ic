/**
 * @librechat/triggers - Type Exports
 *
 * Central export point for all trigger types.
 *
 * @packageDocumentation
 */

// Base types - core interfaces for all triggers
export type {
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
} from './base';

// Schedule types - cron and interval scheduling
export type {
  ScheduleMode,
  IntervalUnit,
  IntervalSchedule,
  CronSchedule,
  Schedule,
  ScheduleTriggerConfig,
  RetryConfig,
  ExponentialBackoff,
  SchedulePresetName,
} from './schedule';

export { SchedulePresets, SchedulePresetLabels } from './schedule';

// Webhook types - HTTP endpoint triggers (future)
export type {
  WebhookMethod,
  WebhookAuthType,
  WebhookAuth,
  WebhookTriggerConfig,
  WebhookResponse,
  WebhookRateLimit,
  WebhookTriggerContext,
  WebhookEvent,
} from './webhook';

// Event types - internal event triggers (future)
export type {
  EventType,
  EventFilter,
  EventTriggerConfig,
  EventTriggerContext,
} from './event';
