/**
 * TriggerService - Agent Scheduling Service
 *
 * Manages scheduled triggers for agent automation.
 * Uses @ranger/triggers package for in-memory scheduling
 * and MongoDB for persistence.
 *
 * NOTE FOR PRODUCTION:
 * For distributed deployments with multiple server instances,
 * consider migrating to BullMQ for centralized queue management.
 * See: https://docs.bullmq.io/guide/repeatable-jobs
 */

const mongoose = require('mongoose');
const { logger } = require('@ranger/data-schemas');
const { TriggerRegistry, ScheduleTrigger, presets } = require('@ranger/triggers');
const { AgentSchedule, TriggerExecution } = require('~/db/models');
const { ExecutionTraceCollector } = require('./ExecutionTraceCollector');

/** Singleton registry instance */
let registry = null;

/**
 * Get or create the TriggerRegistry singleton
 * @returns {TriggerRegistry}
 */
function getRegistry() {
  if (!registry) {
    registry = new TriggerRegistry();
    logger.debug('[TriggerService] TriggerRegistry initialized');
  }
  return registry;
}

/**
 * Convert schedule config to cron expression
 * @param {Object} schedule - Schedule configuration
 * @param {string} schedule.mode - 'interval' or 'cron'
 * @param {number} [schedule.value] - Interval value
 * @param {string} [schedule.unit] - Interval unit
 * @param {string} [schedule.expression] - Cron expression
 * @returns {string} Cron expression
 */
function scheduleToCron(schedule) {
  if (schedule.mode === 'cron') {
    return schedule.expression;
  }

  // Convert interval to cron expression using presets
  const { value, unit } = schedule;
  switch (unit) {
    case 'seconds':
      // node-cron supports seconds as first field
      return `*/${value} * * * * *`;
    case 'minutes':
      return presets.everyNMinutes(value);
    case 'hours':
      return presets.everyNHours(value);
    case 'days':
      // Every N days at midnight
      return `0 0 */${value} * *`;
    case 'weeks':
      // Every N weeks on Sunday at midnight
      return `0 0 * * 0/${value}`;
    default:
      throw new Error(`Unknown interval unit: ${unit}`);
  }
}

/**
 * Create a new agent schedule
 * @param {Object} params - Schedule parameters
 * @param {string} params.agentId - Agent ID to schedule
 * @param {Object} params.schedule - Schedule configuration
 * @param {string} params.prompt - Prompt to send to agent
 * @param {string} params.author - User ID creating the schedule
 * @param {boolean} [params.enabled=true] - Whether schedule is active
 * @param {number} [params.maxRuns] - Maximum executions
 * @param {Function} params.executeCallback - Function to execute when triggered
 * @returns {Promise<Object>} Created schedule document
 */
async function createSchedule({
  agentId,
  schedule,
  prompt,
  author,
  enabled = true,
  maxRuns,
  executeCallback,
}) {
  logger.debug('[TriggerService] Creating schedule', { agentId, schedule, enabled });

  // Generate unique trigger ID
  const triggerId = `schedule_${agentId}_${Date.now()}`;

  // Create the schedule document
  const scheduleDoc = await AgentSchedule.create({
    agentId,
    triggerId,
    enabled,
    schedule,
    prompt,
    maxRuns,
    author: typeof author === 'string' ? new mongoose.Types.ObjectId(author) : author,
    runCount: 0,
    successCount: 0,
    failCount: 0,
  });

  logger.info('[TriggerService] Schedule created', {
    scheduleId: scheduleDoc._id,
    triggerId,
    agentId,
    enabled,
  });

  // If enabled, register the trigger
  if (enabled && executeCallback) {
    try {
      await registerTrigger(scheduleDoc, executeCallback);
    } catch (triggerError) {
      // Log the error but don't fail - schedule is saved, trigger can be retried
      logger.error('[TriggerService] Failed to register trigger, schedule saved but inactive', {
        scheduleId: scheduleDoc._id,
        error: triggerError.message,
      });
      // Update schedule to disabled since trigger failed
      await AgentSchedule.findByIdAndUpdate(scheduleDoc._id, { 
        enabled: false,
        lastError: triggerError.message,
      });
      scheduleDoc.enabled = false;
    }
  }

  return scheduleDoc.toObject();
}

/**
 * Register a trigger in the in-memory registry
 * @param {Object} scheduleDoc - Schedule document from database
 * @param {Function} executeCallback - Function to execute when triggered
 */
async function registerTrigger(scheduleDoc, executeCallback) {
  const reg = getRegistry();

  try {
    logger.debug('[TriggerService] Registering trigger', {
      triggerId: scheduleDoc.triggerId,
      schedule: scheduleDoc.schedule,
    });

    // Create wrapped callback that handles execution tracking
    const wrappedCallback = createExecutionWrapper(scheduleDoc, executeCallback);

    // Create the trigger config
    const triggerConfig = {
      id: scheduleDoc.triggerId,
      type: 'schedule',
      enabled: true,
      targetId: scheduleDoc.agentId,
      targetType: 'agent',
      schedule: scheduleDoc.schedule,
      prompt: scheduleDoc.prompt,
      timezone: scheduleDoc.schedule.timezone || 'UTC',
    };

    logger.debug('[TriggerService] Creating ScheduleTrigger with config', triggerConfig);

    // Create the trigger
    const trigger = new ScheduleTrigger(triggerConfig);

    // Set the callback handler
    trigger.onTrigger(wrappedCallback);

    // Register with the registry
    reg.register(trigger);

    // Start the trigger
    await trigger.start();
    logger.debug('[TriggerService] Trigger started', { triggerId: scheduleDoc.triggerId });

    // Calculate next run time
    const nextRun = trigger.getNextRun();
    if (nextRun) {
      await AgentSchedule.findByIdAndUpdate(scheduleDoc._id, { nextRun });
    }

    logger.info('[TriggerService] Trigger registered and started', {
      triggerId: scheduleDoc.triggerId,
      schedule: scheduleDoc.schedule,
      nextRun,
    });
  } catch (error) {
    logger.error('[TriggerService] Failed to register trigger', {
      triggerId: scheduleDoc.triggerId,
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
}

/**
 * Create an execution wrapper that tracks runs in the database
 * @param {Object} scheduleDoc - Schedule document
 * @param {Function} executeCallback - Original callback
 * @returns {Function} Wrapped callback
 */
function createExecutionWrapper(scheduleDoc, executeCallback) {
  return async (context) => {
    const startTime = Date.now();
    let execution = null;
    let traceCollector = null;

    try {
      // Create execution record
      execution = await TriggerExecution.create({
        scheduleId: scheduleDoc._id,
        agentId: scheduleDoc.agentId,
        userId: scheduleDoc.author,
        triggeredAt: new Date(),
        status: 'running',
        input: scheduleDoc.prompt,
        attempt: 1,
      });

      // Create trace collector for this execution
      traceCollector = new ExecutionTraceCollector(execution._id);

      logger.debug('[TriggerService] Execution started', {
        executionId: execution._id,
        scheduleId: scheduleDoc._id,
      });

      // Execute the callback with trace collector
      const result = await executeCallback({
        agentId: scheduleDoc.agentId,
        prompt: scheduleDoc.prompt,
        scheduleId: scheduleDoc._id,
        executionId: execution._id,
        userId: scheduleDoc.author,
        traceCollector, // Pass trace collector for custom handler integration
        traceHandlers: traceCollector.getHandlers(), // Pre-built handlers for createRun
        ...context,
      });

      // Update execution as completed
      const durationMs = Date.now() - startTime;
      await TriggerExecution.findByIdAndUpdate(execution._id, {
        status: 'completed',
        completedAt: new Date(),
        durationMs,
        output: result?.output ? String(result.output).substring(0, 10000) : undefined,
        conversationId: result?.conversationId,
      });

      // Update schedule counters
      const updateData = {
        lastRun: new Date(),
        $inc: { runCount: 1, successCount: 1 },
      };

      // Calculate next run
      const reg = getRegistry();
      const trigger = reg.get(scheduleDoc.triggerId);
      if (trigger && trigger.getNextRun) {
        updateData.nextRun = trigger.getNextRun();
      }

      const updatedSchedule = await AgentSchedule.findByIdAndUpdate(
        scheduleDoc._id,
        updateData,
        { new: true },
      );

      // Check if max runs reached
      if (updatedSchedule.maxRuns && updatedSchedule.runCount >= updatedSchedule.maxRuns) {
        logger.info('[TriggerService] Max runs reached, disabling schedule', {
          scheduleId: scheduleDoc._id,
          runCount: updatedSchedule.runCount,
          maxRuns: updatedSchedule.maxRuns,
        });
        await disableSchedule(scheduleDoc._id);
      }

      logger.info('[TriggerService] Execution completed', {
        executionId: execution._id,
        durationMs,
        stepCount: traceCollector ? traceCollector.getStepCount() : 0,
      });

      return result;
    } catch (error) {
      const durationMs = Date.now() - startTime;

      // Mark any remaining trace steps as failed
      if (traceCollector) {
        await traceCollector.markRemainingStepsFailed(error.message);
      }

      // Update execution as failed
      if (execution) {
        await TriggerExecution.findByIdAndUpdate(execution._id, {
          status: 'failed',
          completedAt: new Date(),
          durationMs,
          error: error.message,
        });
      }

      // Update schedule fail counter
      await AgentSchedule.findByIdAndUpdate(scheduleDoc._id, {
        lastRun: new Date(),
        $inc: { runCount: 1, failCount: 1 },
      });

      logger.error('[TriggerService] Execution failed', {
        executionId: execution?._id,
        scheduleId: scheduleDoc._id,
        error: error.message,
      });

      throw error;
    }
  };
}

/**
 * Get a schedule by ID
 * @param {string} scheduleId - Schedule ID
 * @returns {Promise<Object|null>} Schedule document or null
 */
async function getSchedule(scheduleId) {
  const schedule = await AgentSchedule.findById(scheduleId);
  return schedule ? schedule.toObject() : null;
}

/**
 * Get all schedules for an agent
 * @param {string} agentId - Agent ID
 * @returns {Promise<Object[]>} Array of schedule documents
 */
async function getSchedulesByAgent(agentId) {
  const schedules = await AgentSchedule.find({ agentId }).sort({ createdAt: -1 });
  return schedules.map((s) => s.toObject());
}

/**
 * Get all schedules for a user
 * @param {string} userId - User ID
 * @returns {Promise<Object[]>} Array of schedule documents
 */
async function getSchedulesByUser(userId) {
  const schedules = await AgentSchedule.find({ author: userId }).sort({ createdAt: -1 });
  return schedules.map((s) => s.toObject());
}

/**
 * Update a schedule
 * @param {string} scheduleId - Schedule ID
 * @param {Object} updates - Fields to update
 * @param {Function} [executeCallback] - Callback for re-registration if schedule changes
 * @returns {Promise<Object|null>} Updated schedule or null
 */
async function updateSchedule(scheduleId, updates, executeCallback) {
  logger.debug('[TriggerService] Updating schedule', { scheduleId, updates });

  const schedule = await AgentSchedule.findById(scheduleId);
  if (!schedule) {
    return null;
  }

  const wasEnabled = schedule.enabled;
  const scheduleChanged =
    updates.schedule && JSON.stringify(updates.schedule) !== JSON.stringify(schedule.schedule);

  // Apply updates
  Object.assign(schedule, updates);
  await schedule.save();

  const reg = getRegistry();

  // Handle enable/disable state changes
  if (updates.enabled === true && !wasEnabled && executeCallback) {
    // Re-enable: register the trigger
    await registerTrigger(schedule, executeCallback);
  } else if (updates.enabled === false && wasEnabled) {
    // Disable: unregister the trigger
    reg.unregister(schedule.triggerId);
    logger.info('[TriggerService] Trigger unregistered (disabled)', {
      triggerId: schedule.triggerId,
    });
  } else if (scheduleChanged && schedule.enabled && executeCallback) {
    // Schedule changed while enabled: re-register
    reg.unregister(schedule.triggerId);
    await registerTrigger(schedule, executeCallback);
  }

  logger.info('[TriggerService] Schedule updated', { scheduleId });
  return schedule.toObject();
}

/**
 * Enable a schedule
 * @param {string} scheduleId - Schedule ID
 * @param {Function} executeCallback - Callback for trigger execution
 * @returns {Promise<Object|null>} Updated schedule or null
 */
async function enableSchedule(scheduleId, executeCallback) {
  return updateSchedule(scheduleId, { enabled: true }, executeCallback);
}

/**
 * Disable a schedule
 * @param {string} scheduleId - Schedule ID
 * @returns {Promise<Object|null>} Updated schedule or null
 */
async function disableSchedule(scheduleId) {
  return updateSchedule(scheduleId, { enabled: false });
}

/**
 * Delete a schedule
 * @param {string} scheduleId - Schedule ID
 * @returns {Promise<boolean>} True if deleted
 */
async function deleteSchedule(scheduleId) {
  logger.debug('[TriggerService] Deleting schedule', { scheduleId });

  const schedule = await AgentSchedule.findById(scheduleId);
  if (!schedule) {
    return false;
  }

  // Unregister from registry if active
  const reg = getRegistry();
  if (schedule.enabled) {
    reg.unregister(schedule.triggerId);
  }

  // Delete the schedule
  await AgentSchedule.findByIdAndDelete(scheduleId);

  logger.info('[TriggerService] Schedule deleted', { scheduleId });
  return true;
}

/**
 * Delete all schedules for an agent
 * @param {string} agentId - Agent ID
 * @returns {Promise<number>} Number of deleted schedules
 */
async function deleteSchedulesByAgent(agentId) {
  logger.debug('[TriggerService] Deleting all schedules for agent', { agentId });

  const schedules = await AgentSchedule.find({ agentId });
  const reg = getRegistry();

  // Unregister all active triggers
  for (const schedule of schedules) {
    if (schedule.enabled) {
      reg.unregister(schedule.triggerId);
    }
  }

  // Delete all schedules
  const result = await AgentSchedule.deleteMany({ agentId });

  logger.info('[TriggerService] Deleted schedules for agent', {
    agentId,
    count: result.deletedCount,
  });

  return result.deletedCount;
}

/**
 * Get execution history for a schedule
 * @param {string} scheduleId - Schedule ID
 * @param {Object} [options] - Query options
 * @param {number} [options.limit=50] - Max results
 * @param {number} [options.skip=0] - Skip N results
 * @returns {Promise<Object[]>} Array of execution documents
 */
async function getExecutionHistory(scheduleId, options = {}) {
  const { limit = 50, skip = 0 } = options;

  const executions = await TriggerExecution.find({ scheduleId })
    .sort({ triggeredAt: -1 })
    .skip(skip)
    .limit(limit);

  return executions.map((e) => e.toObject());
}

/**
 * Get all executions for an agent
 * @param {string} agentId - Agent ID
 * @param {Object} [options] - Query options
 * @param {number} [options.limit=50] - Max results
 * @param {number} [options.skip=0] - Skip N results
 * @returns {Promise<Object[]>} Array of execution documents
 */
async function getExecutionsByAgent(agentId, options = {}) {
  const { limit = 50, skip = 0 } = options;

  const executions = await TriggerExecution.find({ agentId })
    .sort({ triggeredAt: -1 })
    .skip(skip)
    .limit(limit);

  return executions.map((e) => e.toObject());
}

/**
 * Initialize schedules on server startup
 * Loads all enabled schedules from database and registers them
 * @param {Function} executeCallback - Callback for trigger execution
 * @returns {Promise<number>} Number of schedules loaded
 */
async function initializeSchedules(executeCallback) {
  logger.info('[TriggerService] Initializing schedules from database');

  const schedules = await AgentSchedule.find({ enabled: true });
  let registered = 0;

  for (const schedule of schedules) {
    try {
      await registerTrigger(schedule, executeCallback);
      registered++;
    } catch (error) {
      logger.error('[TriggerService] Failed to initialize schedule', {
        scheduleId: schedule._id,
        triggerId: schedule.triggerId,
        error: error.message,
      });
    }
  }

  logger.info('[TriggerService] Schedules initialized', {
    total: schedules.length,
    registered,
  });

  return registered;
}

/**
 * Shutdown all schedules
 * Call this on server shutdown to clean up resources
 */
function shutdown() {
  logger.info('[TriggerService] Shutting down trigger service');

  const reg = getRegistry();
  reg.clear();

  logger.info('[TriggerService] All triggers unregistered');
}

/**
 * Get registry stats
 * @returns {Object} Stats object
 */
function getStats() {
  const reg = getRegistry();
  return {
    totalTriggers: reg.size(),
    activeTriggers: reg.getAll().filter((t) => t.isRunning()).length,
  };
}

module.exports = {
  // Schedule CRUD
  createSchedule,
  getSchedule,
  getSchedulesByAgent,
  getSchedulesByUser,
  updateSchedule,
  enableSchedule,
  disableSchedule,
  deleteSchedule,
  deleteSchedulesByAgent,

  // Execution history
  getExecutionHistory,
  getExecutionsByAgent,

  // Lifecycle
  initializeSchedules,
  shutdown,

  // Utils
  getStats,
  getRegistry,
  scheduleToCron,
};
