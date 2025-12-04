/**
 * @ranger/triggers - Trigger Registry Tests
 *
 * Tests for TriggerRegistry implementation.
 */

import { TriggerRegistry } from '../../registry/TriggerRegistry';
import { ScheduleTrigger } from '../../triggers/ScheduleTrigger';
import type { ScheduleTriggerConfig, ITrigger } from '../../types';

// Mock node-cron
jest.mock('node-cron', () => ({
  schedule: jest.fn((expression, callback, options) => {
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
    if (!expression || typeof expression !== 'string') return false;
    const parts = expression.split(' ');
    return parts.length >= 5 && parts.length <= 6;
  }),
}));

describe('TriggerRegistry', () => {
  let registry: TriggerRegistry;

  beforeEach(() => {
    jest.clearAllMocks();
    registry = new TriggerRegistry();
  });

  const createScheduleConfig = (
    id: string,
    overrides: Partial<ScheduleTriggerConfig> = {}
  ): ScheduleTriggerConfig => ({
    id,
    type: 'schedule',
    enabled: true,
    schedule: { mode: 'interval', value: 5, unit: 'minutes' },
    ...overrides,
  });

  describe('register/unregister', () => {
    it('should register a trigger', () => {
      const trigger = new ScheduleTrigger(createScheduleConfig('trigger-1'));
      registry.register(trigger);

      expect(registry.has('trigger-1')).toBe(true);
      expect(registry.get('trigger-1')).toBe(trigger);
    });

    it('should throw when registering duplicate ID', () => {
      const trigger1 = new ScheduleTrigger(createScheduleConfig('trigger-1'));
      const trigger2 = new ScheduleTrigger(createScheduleConfig('trigger-1'));

      registry.register(trigger1);
      expect(() => registry.register(trigger2)).toThrow('already registered');
    });

    it('should unregister a trigger', async () => {
      const trigger = new ScheduleTrigger(createScheduleConfig('trigger-1'));
      registry.register(trigger);

      const result = await registry.unregister('trigger-1');

      expect(result).toBe(true);
      expect(registry.has('trigger-1')).toBe(false);
    });

    it('should return false when unregistering non-existent trigger', async () => {
      const result = await registry.unregister('non-existent');
      expect(result).toBe(false);
    });

    it('should stop trigger when unregistering', async () => {
      const trigger = new ScheduleTrigger(createScheduleConfig('trigger-1'));
      registry.register(trigger);
      await trigger.start();

      expect(trigger.isRunning()).toBe(true);

      await registry.unregister('trigger-1');

      expect(trigger.isRunning()).toBe(false);
    });
  });

  describe('getAll/getByType/getByTarget', () => {
    beforeEach(() => {
      registry.register(
        new ScheduleTrigger(createScheduleConfig('agent-1-daily', { targetId: 'agent-1', targetType: 'agent' }))
      );
      registry.register(
        new ScheduleTrigger(createScheduleConfig('agent-1-weekly', { targetId: 'agent-1', targetType: 'agent' }))
      );
      registry.register(
        new ScheduleTrigger(createScheduleConfig('agent-2-daily', { targetId: 'agent-2', targetType: 'agent' }))
      );
    });

    it('should return all triggers', () => {
      const all = registry.getAll();
      expect(all).toHaveLength(3);
    });

    it('should filter by type', () => {
      const schedules = registry.getByType('schedule');
      expect(schedules).toHaveLength(3);

      const webhooks = registry.getByType('webhook');
      expect(webhooks).toHaveLength(0);
    });

    it('should filter by target', () => {
      const agent1Triggers = registry.getByTarget('agent-1');
      expect(agent1Triggers).toHaveLength(2);

      const agent2Triggers = registry.getByTarget('agent-2');
      expect(agent2Triggers).toHaveLength(1);

      const agent3Triggers = registry.getByTarget('agent-3');
      expect(agent3Triggers).toHaveLength(0);
    });

    it('should filter by target type', () => {
      const agentTriggers = registry.getByTargetType('agent');
      expect(agentTriggers).toHaveLength(3);

      const workflowTriggers = registry.getByTargetType('workflow');
      expect(workflowTriggers).toHaveLength(0);
    });

    it('should filter by target type and ID', () => {
      const triggers = registry.getByTargetType('agent', 'agent-1');
      expect(triggers).toHaveLength(2);
    });
  });

  describe('startAll/stopAll', () => {
    it('should start all triggers', async () => {
      const trigger1 = new ScheduleTrigger(createScheduleConfig('trigger-1'));
      const trigger2 = new ScheduleTrigger(createScheduleConfig('trigger-2'));

      registry.register(trigger1);
      registry.register(trigger2);

      const started = await registry.startAll();

      expect(started).toBe(2);
      expect(trigger1.isRunning()).toBe(true);
      expect(trigger2.isRunning()).toBe(true);
    });

    it('should stop all triggers', async () => {
      const trigger1 = new ScheduleTrigger(createScheduleConfig('trigger-1'));
      const trigger2 = new ScheduleTrigger(createScheduleConfig('trigger-2'));

      registry.register(trigger1);
      registry.register(trigger2);
      await registry.startAll();

      const stopped = await registry.stopAll();

      expect(stopped).toBe(2);
      expect(trigger1.isRunning()).toBe(false);
      expect(trigger2.isRunning()).toBe(false);
    });

    it('should handle start errors gracefully', async () => {
      // Create a trigger that will fail to start
      const trigger = new ScheduleTrigger(createScheduleConfig('trigger-1', { enabled: false }));
      registry.register(trigger);

      // Should not throw - disabled triggers count as started (no error)
      // but they don't actually run
      const started = await registry.startAll();
      expect(started).toBe(1); // Count includes triggers that didn't throw
      expect(trigger.isRunning()).toBe(false); // But it's not actually running
    });
  });

  describe('startByType/stopByType', () => {
    it('should start triggers by type', async () => {
      const trigger1 = new ScheduleTrigger(createScheduleConfig('trigger-1'));
      const trigger2 = new ScheduleTrigger(createScheduleConfig('trigger-2'));

      registry.register(trigger1);
      registry.register(trigger2);

      const started = await registry.startByType('schedule');
      expect(started).toBe(2);
    });

    it('should stop triggers by type', async () => {
      const trigger1 = new ScheduleTrigger(createScheduleConfig('trigger-1'));
      registry.register(trigger1);
      await trigger1.start();

      const stopped = await registry.stopByType('schedule');
      expect(stopped).toBe(1);
    });
  });

  describe('createScheduleTrigger', () => {
    it('should create and register a schedule trigger', () => {
      const trigger = registry.createScheduleTrigger(createScheduleConfig('new-trigger'));

      expect(trigger).toBeInstanceOf(ScheduleTrigger);
      expect(registry.has('new-trigger')).toBe(true);
      expect(registry.get('new-trigger')).toBe(trigger);
    });
  });

  describe('event forwarding', () => {
    it('should forward trigger events to global listeners', async () => {
      const listener = jest.fn();
      registry.addEventListener(listener);

      const trigger = registry.createScheduleTrigger(createScheduleConfig('trigger-1'));
      await trigger.start();

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'started',
          triggerId: 'trigger-1',
        })
      );
    });

    it('should allow removing global listeners', async () => {
      const listener = jest.fn();
      registry.addEventListener(listener);
      registry.removeEventListener(listener);

      const trigger = registry.createScheduleTrigger(createScheduleConfig('trigger-1'));
      await trigger.start();

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('getStatus', () => {
    it('should return correct status', async () => {
      const trigger1 = new ScheduleTrigger(createScheduleConfig('trigger-1'));
      const trigger2 = new ScheduleTrigger(createScheduleConfig('trigger-2'));

      registry.register(trigger1);
      registry.register(trigger2);
      await trigger1.start();

      const status = registry.getStatus();

      expect(status.totalTriggers).toBe(2);
      expect(status.runningTriggers).toBe(1);
      expect(status.stoppedTriggers).toBe(1);
      expect(status.byType.schedule).toBe(2);
      expect(status.byType.webhook).toBe(0);
      expect(status.timestamp).toBeInstanceOf(Date);
    });
  });

  describe('clear', () => {
    it('should stop and remove all triggers', async () => {
      const trigger1 = new ScheduleTrigger(createScheduleConfig('trigger-1'));
      const trigger2 = new ScheduleTrigger(createScheduleConfig('trigger-2'));

      registry.register(trigger1);
      registry.register(trigger2);
      await registry.startAll();

      await registry.clear();

      expect(registry.getAll()).toHaveLength(0);
      expect(trigger1.isRunning()).toBe(false);
      expect(trigger2.isRunning()).toBe(false);
    });
  });

  describe('autoStart option', () => {
    it('should auto-start triggers when autoStart is true', async () => {
      const autoStartRegistry = new TriggerRegistry({ autoStart: true });
      const trigger = new ScheduleTrigger(createScheduleConfig('trigger-1'));

      autoStartRegistry.register(trigger);

      // Wait for setImmediate in auto-start
      await new Promise((resolve) => setImmediate(resolve));

      expect(trigger.isRunning()).toBe(true);
    });
  });
});
