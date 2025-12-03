/**
 * TriggerService Tests
 *
 * Unit tests for the TriggerService module.
 * Tests schedule CRUD, trigger registration, and execution tracking.
 */

const mongoose = require('mongoose');

// Mock the database models
jest.mock('~/db/models', () => ({
  AgentSchedule: {
    create: jest.fn(),
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    findByIdAndDelete: jest.fn(),
    find: jest.fn(),
    deleteMany: jest.fn(),
  },
  TriggerExecution: {
    create: jest.fn(),
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    find: jest.fn(),
  },
}));

// Mock the logger
jest.mock('@librechat/data-schemas', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock the triggers package
jest.mock('@librechat/triggers', () => {
  const mockTrigger = {
    start: jest.fn(),
    stop: jest.fn(),
    isRunning: jest.fn().mockReturnValue(true),
    getNextRun: jest.fn().mockReturnValue(new Date()),
    getId: jest.fn().mockReturnValue('test-trigger-id'),
  };

  return {
    TriggerRegistry: jest.fn().mockImplementation(() => ({
      register: jest.fn(),
      unregister: jest.fn(),
      get: jest.fn().mockReturnValue(mockTrigger),
      getAll: jest.fn().mockReturnValue([mockTrigger]),
      size: jest.fn().mockReturnValue(1),
      clear: jest.fn(),
    })),
    ScheduleTrigger: jest.fn().mockImplementation(() => mockTrigger),
    presets: {
      everyNMinutes: jest.fn().mockReturnValue('*/5 * * * *'),
      everyNHours: jest.fn().mockReturnValue('0 */2 * * *'),
    },
  };
});

const TriggerService = require('./TriggerService');
const { AgentSchedule, TriggerExecution } = require('~/db/models');

describe('TriggerService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('scheduleToCron', () => {
    it('should return cron expression for cron mode', () => {
      const schedule = { mode: 'cron', expression: '0 0 * * *' };
      const result = TriggerService.scheduleToCron(schedule);
      expect(result).toBe('0 0 * * *');
    });

    it('should convert minutes interval to cron', () => {
      const schedule = { mode: 'interval', value: 5, unit: 'minutes' };
      const result = TriggerService.scheduleToCron(schedule);
      expect(result).toBe('*/5 * * * *');
    });

    it('should convert hours interval to cron', () => {
      const schedule = { mode: 'interval', value: 2, unit: 'hours' };
      const result = TriggerService.scheduleToCron(schedule);
      expect(result).toBe('0 */2 * * *');
    });

    it('should convert days interval to cron', () => {
      const schedule = { mode: 'interval', value: 3, unit: 'days' };
      const result = TriggerService.scheduleToCron(schedule);
      expect(result).toBe('0 0 */3 * *');
    });

    it('should convert seconds interval to cron', () => {
      const schedule = { mode: 'interval', value: 30, unit: 'seconds' };
      const result = TriggerService.scheduleToCron(schedule);
      expect(result).toBe('*/30 * * * * *');
    });

    it('should throw for unknown interval unit', () => {
      const schedule = { mode: 'interval', value: 1, unit: 'unknown' };
      expect(() => TriggerService.scheduleToCron(schedule)).toThrow('Unknown interval unit');
    });
  });

  describe('createSchedule', () => {
    const mockScheduleDoc = {
      _id: new mongoose.Types.ObjectId(),
      agentId: 'agent-123',
      triggerId: 'schedule_agent-123_123456',
      enabled: true,
      schedule: { mode: 'interval', value: 5, unit: 'minutes' },
      prompt: 'Test prompt',
      author: new mongoose.Types.ObjectId(),
      runCount: 0,
      toObject: function () {
        return { ...this };
      },
    };

    beforeEach(() => {
      AgentSchedule.create.mockResolvedValue(mockScheduleDoc);
      AgentSchedule.findByIdAndUpdate.mockResolvedValue(mockScheduleDoc);
    });

    it('should create a schedule document', async () => {
      const userId = new mongoose.Types.ObjectId();
      const result = await TriggerService.createSchedule({
        agentId: 'agent-123',
        schedule: { mode: 'interval', value: 5, unit: 'minutes' },
        prompt: 'Test prompt',
        author: userId,
        enabled: true,
        executeCallback: jest.fn(),
      });

      expect(AgentSchedule.create).toHaveBeenCalledWith(
        expect.objectContaining({
          agentId: 'agent-123',
          enabled: true,
          prompt: 'Test prompt',
        }),
      );
      expect(result).toBeDefined();
    });

    it('should not register trigger if disabled', async () => {
      const disabledDoc = { ...mockScheduleDoc, enabled: false };
      AgentSchedule.create.mockResolvedValue({
        ...disabledDoc,
        toObject: () => disabledDoc,
      });

      const userId = new mongoose.Types.ObjectId();
      await TriggerService.createSchedule({
        agentId: 'agent-123',
        schedule: { mode: 'interval', value: 5, unit: 'minutes' },
        prompt: 'Test prompt',
        author: userId,
        enabled: false,
        executeCallback: jest.fn(),
      });

      const registry = TriggerService.getRegistry();
      // Registry.register should not be called for disabled schedules
      // (since we check enabled before calling registerTrigger)
      expect(registry.register).not.toHaveBeenCalled();
    });
  });

  describe('getSchedule', () => {
    it('should return schedule if found', async () => {
      const mockSchedule = {
        _id: new mongoose.Types.ObjectId(),
        agentId: 'agent-123',
        toObject: function () {
          return { ...this };
        },
      };
      AgentSchedule.findById.mockResolvedValue(mockSchedule);

      const result = await TriggerService.getSchedule('schedule-id');

      expect(AgentSchedule.findById).toHaveBeenCalledWith('schedule-id');
      expect(result).toBeDefined();
    });

    it('should return null if not found', async () => {
      AgentSchedule.findById.mockResolvedValue(null);

      const result = await TriggerService.getSchedule('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('getSchedulesByAgent', () => {
    it('should return schedules for agent', async () => {
      const mockSchedules = [
        { _id: '1', agentId: 'agent-123', toObject: () => ({ _id: '1' }) },
        { _id: '2', agentId: 'agent-123', toObject: () => ({ _id: '2' }) },
      ];
      AgentSchedule.find.mockReturnValue({
        sort: jest.fn().mockResolvedValue(mockSchedules),
      });

      const result = await TriggerService.getSchedulesByAgent('agent-123');

      expect(AgentSchedule.find).toHaveBeenCalledWith({ agentId: 'agent-123' });
      expect(result).toHaveLength(2);
    });
  });

  describe('updateSchedule', () => {
    const mockSchedule = {
      _id: new mongoose.Types.ObjectId(),
      agentId: 'agent-123',
      triggerId: 'trigger-123',
      enabled: true,
      schedule: { mode: 'interval', value: 5, unit: 'minutes' },
      save: jest.fn().mockResolvedValue(true),
      toObject: function () {
        return { ...this };
      },
    };

    beforeEach(() => {
      AgentSchedule.findById.mockResolvedValue(mockSchedule);
    });

    it('should update schedule fields', async () => {
      const result = await TriggerService.updateSchedule('schedule-id', {
        prompt: 'Updated prompt',
      });

      expect(mockSchedule.save).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should return null if schedule not found', async () => {
      AgentSchedule.findById.mockResolvedValue(null);

      const result = await TriggerService.updateSchedule('nonexistent', { enabled: false });

      expect(result).toBeNull();
    });
  });

  describe('deleteSchedule', () => {
    it('should delete schedule and unregister trigger', async () => {
      const mockSchedule = {
        _id: new mongoose.Types.ObjectId(),
        triggerId: 'trigger-123',
        enabled: true,
      };
      AgentSchedule.findById.mockResolvedValue(mockSchedule);
      AgentSchedule.findByIdAndDelete.mockResolvedValue(true);

      const result = await TriggerService.deleteSchedule('schedule-id');

      const registry = TriggerService.getRegistry();
      expect(registry.unregister).toHaveBeenCalledWith('trigger-123');
      expect(AgentSchedule.findByIdAndDelete).toHaveBeenCalledWith('schedule-id');
      expect(result).toBe(true);
    });

    it('should return false if schedule not found', async () => {
      AgentSchedule.findById.mockResolvedValue(null);

      const result = await TriggerService.deleteSchedule('nonexistent');

      expect(result).toBe(false);
    });
  });

  describe('deleteSchedulesByAgent', () => {
    it('should delete all schedules for agent', async () => {
      const mockSchedules = [
        { triggerId: 'trigger-1', enabled: true },
        { triggerId: 'trigger-2', enabled: false },
      ];
      AgentSchedule.find.mockResolvedValue(mockSchedules);
      AgentSchedule.deleteMany.mockResolvedValue({ deletedCount: 2 });

      const result = await TriggerService.deleteSchedulesByAgent('agent-123');

      const registry = TriggerService.getRegistry();
      expect(registry.unregister).toHaveBeenCalledWith('trigger-1');
      expect(registry.unregister).not.toHaveBeenCalledWith('trigger-2'); // Disabled
      expect(AgentSchedule.deleteMany).toHaveBeenCalledWith({ agentId: 'agent-123' });
      expect(result).toBe(2);
    });
  });

  describe('getExecutionHistory', () => {
    it('should return execution history for schedule', async () => {
      const mockExecutions = [
        { _id: '1', status: 'completed', toObject: () => ({ _id: '1' }) },
        { _id: '2', status: 'failed', toObject: () => ({ _id: '2' }) },
      ];
      TriggerExecution.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          skip: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue(mockExecutions),
          }),
        }),
      });

      const result = await TriggerService.getExecutionHistory('schedule-id', {
        limit: 10,
        skip: 0,
      });

      expect(TriggerExecution.find).toHaveBeenCalledWith({ scheduleId: 'schedule-id' });
      expect(result).toHaveLength(2);
    });
  });

  describe('initializeSchedules', () => {
    it('should load and register all enabled schedules', async () => {
      const mockSchedules = [
        {
          _id: '1',
          triggerId: 'trigger-1',
          enabled: true,
          schedule: { mode: 'cron', expression: '0 0 * * *' },
        },
        {
          _id: '2',
          triggerId: 'trigger-2',
          enabled: true,
          schedule: { mode: 'interval', value: 5, unit: 'minutes' },
        },
      ];
      AgentSchedule.find.mockResolvedValue(mockSchedules);
      AgentSchedule.findByIdAndUpdate.mockResolvedValue({});

      const executeCallback = jest.fn();
      const result = await TriggerService.initializeSchedules(executeCallback);

      expect(AgentSchedule.find).toHaveBeenCalledWith({ enabled: true });
      expect(result).toBe(2);
    });
  });

  describe('shutdown', () => {
    it('should clear all triggers', () => {
      TriggerService.shutdown();

      const registry = TriggerService.getRegistry();
      expect(registry.clear).toHaveBeenCalled();
    });
  });

  describe('getStats', () => {
    it('should return registry stats', () => {
      const stats = TriggerService.getStats();

      expect(stats).toHaveProperty('totalTriggers');
      expect(stats).toHaveProperty('activeTriggers');
    });
  });
});
