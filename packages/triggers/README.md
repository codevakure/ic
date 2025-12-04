# @ranger/triggers

Extensible trigger system for Ranger agents. Supports scheduled (cron/interval), webhook, and event-based triggers.

## Features

- 🕐 **Schedule Triggers** - Cron expressions and simple intervals
- 🔌 **Webhook Triggers** (planned) - HTTP endpoint triggers
- 📡 **Event Triggers** (planned) - Internal event-based triggers
- 📊 **Statistics** - Track executions, success rates, durations
- 🔄 **Retry Support** - Configurable retry with exponential backoff
- 🧩 **Extensible** - Easy to add new trigger types

## Installation

```bash
npm install @ranger/triggers
# or
bun add @ranger/triggers
```

## Quick Start

```typescript
import {
  TriggerRegistry,
  SchedulePresets,
} from '@ranger/triggers';

// Create registry
const registry = new TriggerRegistry();

// Create a schedule trigger for an agent
const trigger = registry.createScheduleTrigger({
  id: 'daily-summary',
  type: 'schedule',
  enabled: true,
  targetId: 'agent-123',
  targetType: 'agent',
  schedule: SchedulePresets.WEEKDAYS_9AM,
  prompt: 'Generate daily summary',
});

// Set up execution handler
trigger.onTrigger(async (ctx) => {
  // Execute your agent here
  const result = await executeAgent(ctx.targetId, ctx.payload.prompt);
  
  return {
    success: true,
    executionId: result.id,
    startedAt: ctx.triggeredAt,
  };
});

// Start all triggers
await registry.startAll();
```

## Schedule Modes

### Interval Mode

Simple repeating intervals:

```typescript
// Every 5 minutes
{ mode: 'interval', value: 5, unit: 'minutes' }

// Every 2 hours
{ mode: 'interval', value: 2, unit: 'hours' }

// Every day
{ mode: 'interval', value: 1, unit: 'days' }
```

### Cron Mode

Full cron expression support:

```typescript
// Weekdays at 9am
{ mode: 'cron', expression: '0 9 * * 1-5' }

// Every 6 hours
{ mode: 'cron', expression: '0 */6 * * *' }

// First of month at 9am
{ mode: 'cron', expression: '0 9 1 * *' }

// With timezone
{ mode: 'cron', expression: '0 9 * * 1-5', timezone: 'America/New_York' }
```

### Presets

Common schedules are available as presets:

```typescript
import { SchedulePresets } from '@ranger/triggers';

SchedulePresets.EVERY_5_MINUTES
SchedulePresets.EVERY_HOUR
SchedulePresets.DAILY_9AM
SchedulePresets.WEEKDAYS_9AM
SchedulePresets.MONDAY_9AM
SchedulePresets.FIRST_OF_MONTH
// ... and more
```

## API Reference

### TriggerRegistry

Central registry for managing triggers.

```typescript
const registry = new TriggerRegistry({ autoStart: true });

// Register triggers
registry.register(trigger);
await registry.unregister('trigger-id');

// Query
registry.get('trigger-id');
registry.getAll();
registry.getByType('schedule');
registry.getByTarget('agent-123');

// Lifecycle
await registry.startAll();
await registry.stopAll();
await registry.clear();

// Status
registry.getStatus();
```

### ScheduleTrigger

Schedule-based trigger with cron or interval.

```typescript
const trigger = new ScheduleTrigger({
  id: 'my-trigger',
  type: 'schedule',
  enabled: true,
  schedule: { mode: 'interval', value: 5, unit: 'minutes' },
  
  // Optional
  startDate: new Date(),
  endDate: new Date('2025-12-31'),
  maxRuns: 100,
  timeout: 30000,
  skipIfRunning: true,
  retry: {
    enabled: true,
    maxAttempts: 3,
    delay: 5000,
  },
});

// Handler
trigger.onTrigger(async (ctx) => {
  return { success: true, executionId: 'exec-1', startedAt: ctx.triggeredAt };
});

// Lifecycle
await trigger.start();
await trigger.stop();

// Info
trigger.isRunning();
trigger.getNextRun();
trigger.getLastRun();
trigger.getStats();
trigger.getCronExpression();

// Manual trigger (for testing)
await trigger.trigger({ customPayload: true });
```

### Utilities

```typescript
import {
  intervalToCron,
  isValidCronExpression,
  parseHumanInterval,
  formatSchedule,
} from '@ranger/triggers';

// Convert interval to cron
intervalToCron({ mode: 'interval', value: 5, unit: 'minutes' });
// => '*/5 * * * *'

// Validate cron
isValidCronExpression('0 9 * * 1-5'); // true

// Parse human input
parseHumanInterval('every 5 minutes');
// => { mode: 'interval', value: 5, unit: 'minutes' }

// Format for display
formatSchedule({ mode: 'cron', expression: '0 9 * * 1-5' });
// => 'Weekdays at 9:00 AM'
```

## Production Upgrade Path

Current implementation uses `node-cron` for lightweight, single-process scheduling. For production deployments with multiple instances, migrate to **BullMQ**:

```typescript
import { Queue, Worker } from 'bullmq';

const queue = new Queue('agent-triggers', { connection: redis });

// Add repeatable job (same cron syntax!)
await queue.add('execute-agent', { agentId: 'agent-123' }, {
  repeat: { pattern: '0 9 * * 1-5' }
});

// Worker processes jobs
const worker = new Worker('agent-triggers', async (job) => {
  await executeAgent(job.data.agentId);
}, { connection: redis });
```

**BullMQ benefits:**
- Distributed scheduling across instances
- Redis-backed persistence (survives restarts)
- Built-in retry with exponential backoff
- Job prioritization and rate limiting
- Excellent monitoring (Bull Board, Arena)

## Future Triggers

### Webhook Triggers (Planned)

```typescript
// Coming soon
const webhook = new WebhookTrigger({
  type: 'webhook',
  path: '/agent-trigger',
  methods: ['POST'],
  auth: { type: 'hmac', secret: process.env.WEBHOOK_SECRET },
});
```

### Event Triggers (Planned)

```typescript
// Coming soon
const event = new EventTrigger({
  type: 'event',
  filter: {
    types: ['user.created', 'conversation.completed'],
  },
});
```

## License

MIT
