/**
 * Agent Schedule Routes
 *
 * REST API endpoints for managing agent schedules.
 * All routes require authentication and appropriate permissions.
 */

const express = require('express');
const { generateCheckAccess } = require('@librechat/api');
const { PermissionTypes, Permissions, PermissionBits } = require('librechat-data-provider');
const { requireJwtAuth, canAccessAgentResource } = require('~/server/middleware');
const { getRoleByName } = require('~/models/Role');
const TriggerService = require('~/server/services/TriggerService');
const { executeAgent } = require('~/server/services/ScheduledAgentRunner');
const { logger } = require('@librechat/data-schemas');

const router = express.Router({ mergeParams: true });

const checkAgentAccess = generateCheckAccess({
  permissionType: PermissionTypes.AGENTS,
  permissions: [Permissions.USE],
  getRoleByName,
});

const checkAgentEdit = generateCheckAccess({
  permissionType: PermissionTypes.AGENTS,
  permissions: [Permissions.USE, Permissions.CREATE],
  getRoleByName,
});

// All routes require authentication
router.use(requireJwtAuth);

/**
 * Create execute callback that runs the actual agent
 * @param {Object} req - Express request with user and config
 */
const createExecuteCallback = (req) => {
  // Capture user and config at schedule creation time
  const user = req.user;
  const appConfig = req.config;

  return async (context) => {
    const { agentId, prompt } = context;
    
    logger.info('[ScheduleRoutes] Executing scheduled agent', {
      agentId,
      userId: user?.id,
      promptPreview: prompt?.substring(0, 100),
    });

    try {
      // Execute the agent with the captured context
      const result = await executeAgent({
        agentId,
        prompt,
        user,
        appConfig,
      });

      logger.info('[ScheduleRoutes] Scheduled execution completed', {
        agentId,
        success: result.success,
        outputLength: result.output?.length,
        error: result.error,
      });

      return {
        success: result.success,
        output: result.output || result.error || 'No output',
        conversationId: null,
      };
    } catch (error) {
      logger.error('[ScheduleRoutes] Scheduled execution failed', {
        agentId,
        error: error.message,
      });

      return {
        success: false,
        output: `Execution error: ${error.message}`,
        conversationId: null,
      };
    }
  };
};

/**
 * Get all schedules for an agent
 * @route GET /agents/:agentId/schedules
 * @returns {Object[]} 200 - Array of schedule objects
 */
router.get(
  '/',
  checkAgentAccess,
  canAccessAgentResource({
    requiredPermission: PermissionBits.VIEW,
    resourceIdParam: 'agentId',
  }),
  async (req, res) => {
    try {
      const { agentId } = req.params;
      logger.info('[ScheduleRoutes] GET /schedules - Fetching schedules', { agentId });
      
      const schedules = await TriggerService.getSchedulesByAgent(agentId);
      
      logger.info('[ScheduleRoutes] GET /schedules - Found schedules', { 
        agentId, 
        count: schedules.length,
        scheduleIds: schedules.map(s => s._id?.toString()),
      });

      res.json({ schedules });
    } catch (error) {
      logger.error('[ScheduleRoutes] Failed to get schedules', {
        agentId: req.params.agentId,
        error: error.message,
      });
      res.status(500).json({ error: 'Failed to get schedules' });
    }
  },
);

/**
 * Get a specific schedule
 * @route GET /agents/:agentId/schedules/:scheduleId
 * @returns {Object} 200 - Schedule object
 */
router.get(
  '/:scheduleId',
  checkAgentAccess,
  canAccessAgentResource({
    requiredPermission: PermissionBits.VIEW,
    resourceIdParam: 'agentId',
  }),
  async (req, res) => {
    try {
      const { scheduleId } = req.params;
      const schedule = await TriggerService.getSchedule(scheduleId);

      if (!schedule) {
        return res.status(404).json({ error: 'Schedule not found' });
      }

      res.json(schedule);
    } catch (error) {
      logger.error('[ScheduleRoutes] Failed to get schedule', {
        scheduleId: req.params.scheduleId,
        error: error.message,
      });
      res.status(500).json({ error: 'Failed to get schedule' });
    }
  },
);

/**
 * Create a new schedule for an agent
 * @route POST /agents/:agentId/schedules
 * @param {Object} req.body.schedule - Schedule configuration
 * @param {string} req.body.prompt - Prompt to send to agent
 * @param {boolean} [req.body.enabled=true] - Whether schedule is active
 * @param {number} [req.body.maxRuns] - Maximum number of executions
 * @returns {Object} 201 - Created schedule object
 */
router.post(
  '/',
  checkAgentEdit,
  canAccessAgentResource({
    requiredPermission: PermissionBits.EDIT,
    resourceIdParam: 'agentId',
  }),
  async (req, res) => {
    try {
      const { agentId } = req.params;
      const { schedule, prompt, enabled = true, maxRuns } = req.body;

      logger.info('[ScheduleRoutes] POST /schedules - Incoming request', {
        agentId,
        schedule,
        prompt: prompt ? prompt.substring(0, 50) + '...' : null,
        enabled,
        userId: req.user?.id,
      });

      if (!schedule || !schedule.mode) {
        logger.warn('[ScheduleRoutes] Invalid request - missing schedule config');
        return res.status(400).json({ error: 'Schedule configuration is required' });
      }

      if (!prompt) {
        logger.warn('[ScheduleRoutes] Invalid request - missing prompt');
        return res.status(400).json({ error: 'Prompt is required' });
      }

      // Validate schedule configuration
      if (schedule.mode === 'interval') {
        if (!schedule.value || !schedule.unit) {
          return res.status(400).json({ error: 'Interval mode requires value and unit' });
        }
      } else if (schedule.mode === 'cron') {
        if (!schedule.expression) {
          return res.status(400).json({ error: 'Cron mode requires expression' });
        }
      } else {
        return res.status(400).json({ error: 'Invalid schedule mode' });
      }

      const createdSchedule = await TriggerService.createSchedule({
        agentId,
        schedule,
        prompt,
        enabled,
        maxRuns,
        author: req.user.id,
        executeCallback: createExecuteCallback(req),
      });

      logger.info('[ScheduleRoutes] Schedule created', {
        scheduleId: createdSchedule._id,
        agentId,
        userId: req.user.id,
      });

      res.status(201).json(createdSchedule);
    } catch (error) {
      logger.error('[ScheduleRoutes] Failed to create schedule', {
        agentId: req.params.agentId,
        error: error.message,
        stack: error.stack,
      });
      res.status(500).json({ error: 'Failed to create schedule', details: error.message });
    }
  },
);

/**
 * Update a schedule
 * @route PATCH /agents/:agentId/schedules/:scheduleId
 * @param {Object} [req.body.schedule] - Schedule configuration
 * @param {string} [req.body.prompt] - Prompt to send to agent
 * @param {boolean} [req.body.enabled] - Whether schedule is active
 * @param {number} [req.body.maxRuns] - Maximum number of executions
 * @returns {Object} 200 - Updated schedule object
 */
router.patch(
  '/:scheduleId',
  checkAgentEdit,
  canAccessAgentResource({
    requiredPermission: PermissionBits.EDIT,
    resourceIdParam: 'agentId',
  }),
  async (req, res) => {
    try {
      const { scheduleId } = req.params;
      const { schedule, prompt, enabled, maxRuns } = req.body;

      // Build update object
      const updates = {};
      if (schedule !== undefined) {
        updates.schedule = schedule;
      }
      if (prompt !== undefined) {
        updates.prompt = prompt;
      }
      if (enabled !== undefined) {
        updates.enabled = enabled;
      }
      if (maxRuns !== undefined) {
        updates.maxRuns = maxRuns;
      }

      const updatedSchedule = await TriggerService.updateSchedule(
        scheduleId,
        updates,
        createExecuteCallback(req),
      );

      if (!updatedSchedule) {
        return res.status(404).json({ error: 'Schedule not found' });
      }

      logger.info('[ScheduleRoutes] Schedule updated', {
        scheduleId,
        userId: req.user.id,
      });

      res.json(updatedSchedule);
    } catch (error) {
      logger.error('[ScheduleRoutes] Failed to update schedule', {
        scheduleId: req.params.scheduleId,
        error: error.message,
      });
      res.status(500).json({ error: 'Failed to update schedule' });
    }
  },
);

/**
 * Delete a schedule
 * @route DELETE /agents/:agentId/schedules/:scheduleId
 * @returns {Object} 200 - Success response
 */
router.delete(
  '/:scheduleId',
  checkAgentEdit,
  canAccessAgentResource({
    requiredPermission: PermissionBits.DELETE,
    resourceIdParam: 'agentId',
  }),
  async (req, res) => {
    try {
      const { scheduleId } = req.params;
      const deleted = await TriggerService.deleteSchedule(scheduleId);

      if (!deleted) {
        return res.status(404).json({ error: 'Schedule not found' });
      }

      logger.info('[ScheduleRoutes] Schedule deleted', {
        scheduleId,
        userId: req.user.id,
      });

      res.json({ success: true });
    } catch (error) {
      logger.error('[ScheduleRoutes] Failed to delete schedule', {
        scheduleId: req.params.scheduleId,
        error: error.message,
      });
      res.status(500).json({ error: 'Failed to delete schedule' });
    }
  },
);

/**
 * Get execution history for a schedule
 * @route GET /agents/:agentId/schedules/:scheduleId/executions
 * @param {number} [req.query.limit=50] - Max results
 * @param {number} [req.query.skip=0] - Skip N results
 * @returns {Object[]} 200 - Array of execution objects
 */
router.get(
  '/:scheduleId/executions',
  checkAgentAccess,
  canAccessAgentResource({
    requiredPermission: PermissionBits.VIEW,
    resourceIdParam: 'agentId',
  }),
  async (req, res) => {
    try {
      const { scheduleId } = req.params;
      const { limit = 50, skip = 0 } = req.query;

      const executions = await TriggerService.getExecutionHistory(scheduleId, {
        limit: parseInt(limit, 10),
        skip: parseInt(skip, 10),
      });

      res.json({ executions });
    } catch (error) {
      logger.error('[ScheduleRoutes] Failed to get executions', {
        scheduleId: req.params.scheduleId,
        error: error.message,
      });
      res.status(500).json({ error: 'Failed to get executions' });
    }
  },
);

/**
 * Get trigger service stats
 * @route GET /agents/schedules/stats
 * @returns {Object} 200 - Stats object
 */
router.get(
  '/stats',
  checkAgentAccess,
  async (req, res) => {
    try {
      const stats = TriggerService.getStats();
      res.json(stats);
    } catch (error) {
      logger.error('[ScheduleRoutes] Failed to get stats', { error: error.message });
      res.status(500).json({ error: 'Failed to get stats' });
    }
  },
);

module.exports = router;
