/**
 * @ranger/triggers - Schedule Trigger Tests
 *
 * Tests for ScheduleTrigger implementation.
 *
 * ## Test Strategy:
 * - Use Jest fake timers to control time
 * - Test both interval and cron modes
 * - Verify lifecycle (start/stop)
 * - Test execution and retries
 * - Test configuration updates
 */

import { ScheduleTrigger } from '../../triggers/ScheduleTrigger';
import type { ScheduleTriggerConfig, TriggerResult, TriggerContext } from '../../types';

// Mock node-cron
jest.mock('node-cron', () => ({
  schedule: jest.fn((expression, callback, options) => {
    // Store callback for manual triggering in tests
    const task = {
      _callback: callback,
      _running: true,
      start: jest.fn(),
      stop: jest.fn(function (this: { _running: boolean }) {
        this._running = false;
      }),
    };
    return task;
  }),
  validate: jest.fn((expression) => {
    // Basic validation - real cron expressions
    if (!expression || typeof expression !== 'string') return false;
    const parts = expression.split(' ');
    return parts.length >= 5 && parts.length <= 6;
  }),
}));

describe('ScheduleTrigger', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const createConfig = (overrides: Partial<ScheduleTriggerConfig> = {}): ScheduleTriggerConfig => ({
    id: 'test-trigger-1',
    type: 'schedule',
    enabled: true,
    schedule: { mode: 'interval', value: 5, unit: 'minutes' },
    ...overrides,
  });

  describe('constructor', () => {
    it('should create a trigger with interval schedule', () => {
      const config = createConfig({
        schedule: { mode: 'interval', value: 10, unit: 'minutes' },
      });
      const trigger = new ScheduleTrigger(config);

      expect(trigger.id).toBe('test-trigger-1');
      expect(trigger.type).toBe('schedule');
      expect(trigger.config.schedule).toEqual({ mode: 'interval', value: 10, unit: 'minutes' });
      expect(trigger.getCronExpression()).toBe('*/10 * * * *');
    });

    it('should create a trigger with cron schedule', () => {
      const config = createConfig({
        schedule: { mode: 'cron', expression: '0 9 * * 1-5' },
      });
      const trigger = new ScheduleTrigger(config);

      expect(trigger.getCronExpression()).toBe('0 9 * * 1-5');
    });

    it('should throw for invalid cron expression', () => {
      const config = createConfig({
        schedule: { mode: 'cron', expression: 'invalid' },
      });

      expect(() => new ScheduleTrigger(config)).toThrow('Invalid cron expression');
    });
  });

  describe('start/stop lifecycle', () => {
    it('should start in idle state', () => {
      const trigger = new ScheduleTrigger(createConfig());
      expect(trigger.state).toBe('idle');
      expect(trigger.isRunning()).toBe(false);
    });

    it('should transition to running on start', async () => {
      const trigger = new ScheduleTrigger(createConfig());
      await trigger.start();

      expect(trigger.state).toBe('running');
      expect(trigger.isRunning()).toBe(true);
    });

    it('should transition to stopped on stop', async () => {
      const trigger = new ScheduleTrigger(createConfig());
      await trigger.start();
      await trigger.stop();

      expect(trigger.state).toBe('stopped');
      expect(trigger.isRunning()).toBe(false);
    });

    it('should be idempotent - multiple starts are safe', async () => {
      const trigger = new ScheduleTrigger(createConfig());
      await trigger.start();
      await trigger.start();
      await trigger.start();

      expect(trigger.isRunning()).toBe(true);
    });

    it('should not start if disabled', async () => {
      const trigger = new ScheduleTrigger(createConfig({ enabled: false }));
      await trigger.start();

      expect(trigger.state).toBe('idle');
    });

    it('should not start if before startDate', async () => {
      const futureDate = new Date(Date.now() + 86400000); // Tomorrow
      const trigger = new ScheduleTrigger(createConfig({ startDate: futureDate }));
      await trigger.start();

      expect(trigger.state).toBe('idle');
    });

    it('should not start if after endDate', async () => {
      const pastDate = new Date(Date.now() - 86400000); // Yesterday
      const trigger = new ScheduleTrigger(createConfig({ endDate: pastDate }));
      await trigger.start();

      expect(trigger.state).toBe('idle');
    });
  });

  describe('trigger execution', () => {
    it('should call handler on manual trigger', async () => {
      const trigger = new ScheduleTrigger(createConfig());
      const handler = jest.fn().mockResolvedValue({
        success: true,
        executionId: 'exec-1',
        startedAt: new Date(),
      });

      trigger.onTrigger(handler);
      const result = await trigger.trigger({ testData: 'value' });

      expect(handler).toHaveBeenCalledTimes(1);
      expect(result.success).toBe(true);

      const ctx = handler.mock.calls[0][0] as TriggerContext;
      expect(ctx.triggerType).toBe('schedule');
      expect(ctx.triggerId).toBe('test-trigger-1');
      expect(ctx.payload).toEqual({ testData: 'value' });
    });

    it('should return error result if no handler registered', async () => {
      const trigger = new ScheduleTrigger(createConfig());
      const result = await trigger.trigger();

      expect(result.success).toBe(false);
      expect(result.error).toBe('No handler registered');
    });

    it('should catch and report handler errors', async () => {
      const trigger = new ScheduleTrigger(createConfig());
      const handler = jest.fn().mockRejectedValue(new Error('Handler failed'));

      trigger.onTrigger(handler);
      const result = await trigger.trigger();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Handler failed');
      expect(result.shouldRetry).toBe(true);
    });

    it('should track execution statistics', async () => {
      const trigger = new ScheduleTrigger(createConfig());
      trigger.onTrigger(async () => ({
        success: true,
        executionId: 'exec-1',
        startedAt: new Date(),
      }));

      await trigger.trigger();
      await trigger.trigger();

      const stats = trigger.getStats();
      expect(stats.totalRuns).toBe(2);
      expect(stats.successfulRuns).toBe(2);
      expect(stats.failedRuns).toBe(0);
    });

    it('should track failed executions', async () => {
      const trigger = new ScheduleTrigger(createConfig());
      trigger.onTrigger(async () => ({
        success: false,
        executionId: 'exec-1',
        startedAt: new Date(),
        error: 'Something went wrong',
      }));

      await trigger.trigger();

      const stats = trigger.getStats();
      expect(stats.totalRuns).toBe(1);
      expect(stats.successfulRuns).toBe(0);
      expect(stats.failedRuns).toBe(1);
      expect(stats.lastError).toBe('Something went wrong');
    });
  });

  describe('configuration updates', () => {
    it('should update config without schedule change', () => {
      const trigger = new ScheduleTrigger(createConfig());
      trigger.updateConfig({ prompt: 'New prompt' });

      expect(trigger.config.prompt).toBe('New prompt');
    });

    it('should update schedule and re-resolve cron expression', () => {
      const trigger = new ScheduleTrigger(createConfig({
        schedule: { mode: 'interval', value: 5, unit: 'minutes' },
      }));

      expect(trigger.getCronExpression()).toBe('*/5 * * * *');

      trigger.updateConfig({
        schedule: { mode: 'interval', value: 15, unit: 'minutes' },
      });

      expect(trigger.getCronExpression()).toBe('*/15 * * * *');
    });
  });

  describe('run count and limits', () => {
    it('should track run count', async () => {
      const trigger = new ScheduleTrigger(createConfig());
      trigger.onTrigger(async () => ({
        success: true,
        executionId: 'exec-1',
        startedAt: new Date(),
      }));

      expect(trigger.getRunCount()).toBe(0);

      await trigger.trigger();
      expect(trigger.getRunCount()).toBe(0); // Manual trigger doesn't increment

      // Note: Run count is incremented in onScheduledRun, not manual trigger
    });

    it('should reset run count', async () => {
      const trigger = new ScheduleTrigger(createConfig());
      // Manually set run count for testing
      (trigger as any)._runCount = 5;

      trigger.resetRunCount();
      expect(trigger.getRunCount()).toBe(0);
    });
  });

  describe('event emission', () => {
    it('should emit started event on start', async () => {
      const trigger = new ScheduleTrigger(createConfig());
      const listener = jest.fn();

      trigger.addEventListener(listener);
      await trigger.start();

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'started',
          triggerId: 'test-trigger-1',
        })
      );
    });

    it('should emit stopped event on stop', async () => {
      const trigger = new ScheduleTrigger(createConfig());
      const listener = jest.fn();

      trigger.addEventListener(listener);
      await trigger.start();
      await trigger.stop();

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'stopped',
          triggerId: 'test-trigger-1',
        })
      );
    });

    it('should emit triggered and completed events on execution', async () => {
      const trigger = new ScheduleTrigger(createConfig());
      const listener = jest.fn();

      trigger.addEventListener(listener);
      trigger.onTrigger(async () => ({
        success: true,
        executionId: 'exec-1',
        startedAt: new Date(),
      }));

      await trigger.trigger();

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'triggered' })
      );
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'completed' })
      );
    });

    it('should emit error event on handler failure', async () => {
      const trigger = new ScheduleTrigger(createConfig());
      const listener = jest.fn();

      trigger.addEventListener(listener);
      trigger.onTrigger(async () => {
        throw new Error('Handler error');
      });

      await trigger.trigger();

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error',
          data: expect.objectContaining({ error: 'Handler error' }),
        })
      );
    });

    it('should allow removing event listeners', async () => {
      const trigger = new ScheduleTrigger(createConfig());
      const listener = jest.fn();

      trigger.addEventListener(listener);
      trigger.removeEventListener(listener);

      await trigger.start();

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('getLastRun', () => {
    it('should return null before any execution', () => {
      const trigger = new ScheduleTrigger(createConfig());
      expect(trigger.getLastRun()).toBeNull();
    });

    it('should return last run time after execution', async () => {
      const trigger = new ScheduleTrigger(createConfig());
      trigger.onTrigger(async () => ({
        success: true,
        executionId: 'exec-1',
        startedAt: new Date(),
      }));

      const before = new Date();
      await trigger.trigger();
      const after = new Date();

      const lastRun = trigger.getLastRun();
      expect(lastRun).not.toBeNull();
      expect(lastRun!.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(lastRun!.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });
});
