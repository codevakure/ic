/**
 * Agent Execution Routes
 *
 * REST API endpoints for viewing agent execution history and traces.
 * Provides endpoints for listing executions and retrieving execution traces
 * for the Camunda-style tree view visualization.
 */

const express = require('express');
const { generateCheckAccess } = require('@librechat/api');
const { PermissionTypes, Permissions, PermissionBits } = require('librechat-data-provider');
const { requireJwtAuth, canAccessAgentResource } = require('~/server/middleware');
const { getRoleByName } = require('~/models/Role');
const { TriggerExecution, ExecutionTrace } = require('~/db/models');
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
 * GET /agents/:agentId/executions
 * List execution history for an agent
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
    const { limit = 20, offset = 0, status, scheduleId } = req.query;

    // Build query
    const query = { agentId };
    if (status) {
      query.status = status;
    }
    if (scheduleId) {
      query.scheduleId = scheduleId;
    }

    // Get total count
    const total = await TriggerExecution.countDocuments(query);

    // Get executions with pagination
    const executions = await TriggerExecution.find(query)
      .sort({ triggeredAt: -1 })
      .skip(parseInt(offset, 10))
      .limit(parseInt(limit, 10))
      .lean();

    // For each execution, get the step count from ExecutionTrace
    const executionsWithCounts = await Promise.all(
      executions.map(async (exec) => {
        const stepCount = await ExecutionTrace.countDocuments({ executionId: exec._id });
        return {
          id: exec._id.toString(),
          scheduleId: exec.scheduleId?.toString(),
          agentId: exec.agentId,
          status: exec.status,
          triggeredAt: exec.triggeredAt?.toISOString(),
          completedAt: exec.completedAt?.toISOString(),
          durationMs: exec.durationMs,
          input: exec.input,
          output: exec.output,
          error: exec.error,
          attempt: exec.attempt,
          stepCount,
        };
      }),
    );

    res.json({
      executions: executionsWithCounts,
      total,
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10),
    });
  } catch (error) {
    logger.error('[ExecutionRoutes] Error listing executions:', error);
    res.status(500).json({ error: 'Failed to list executions' });
  }
});

/**
 * GET /agents/:agentId/executions/:executionId
 * Get a specific execution summary
 */
router.get(
  '/:executionId',
  checkAgentAccess,
  canAccessAgentResource({
    requiredPermission: PermissionBits.VIEW,
    resourceIdParam: 'agentId',
  }),
  async (req, res) => {
  try {
    const { agentId, executionId } = req.params;

    const execution = await TriggerExecution.findOne({
      _id: executionId,
      agentId,
    }).lean();

    if (!execution) {
      return res.status(404).json({ error: 'Execution not found' });
    }

    // Get step count
    const stepCount = await ExecutionTrace.countDocuments({ executionId });

    res.json({
      id: execution._id.toString(),
      scheduleId: execution.scheduleId?.toString(),
      agentId: execution.agentId,
      status: execution.status,
      triggeredAt: execution.triggeredAt?.toISOString(),
      completedAt: execution.completedAt?.toISOString(),
      durationMs: execution.durationMs,
      input: execution.input,
      output: execution.output,
      error: execution.error,
      attempt: execution.attempt,
      stepCount,
    });
  } catch (error) {
    logger.error('[ExecutionRoutes] Error getting execution:', error);
    res.status(500).json({ error: 'Failed to get execution' });
  }
});

/**
 * GET /agents/:agentId/executions/:executionId/trace
 * Get the execution trace tree for visualization
 */
router.get(
  '/:executionId/trace',
  checkAgentAccess,
  canAccessAgentResource({
    requiredPermission: PermissionBits.VIEW,
    resourceIdParam: 'agentId',
  }),
  async (req, res) => {
  try {
    const { agentId, executionId } = req.params;

    // Verify execution belongs to this agent
    const execution = await TriggerExecution.findOne({
      _id: executionId,
      agentId,
    }).lean();

    if (!execution) {
      return res.status(404).json({ error: 'Execution not found' });
    }

    // Get all trace steps ordered by sequence
    const traces = await ExecutionTrace.find({ executionId })
      .sort({ sequence: 1 })
      .lean();

    // Calculate total duration
    let totalDurationMs = execution.durationMs || 0;
    if (!totalDurationMs && traces.length > 0) {
      totalDurationMs = traces.reduce((sum, t) => sum + (t.durationMs || 0), 0);
    }

    // Determine overall status
    let status = execution.status;
    if (!status && traces.length > 0) {
      const hasRunning = traces.some((t) => t.status === 'running');
      const hasFailed = traces.some((t) => t.status === 'failed');
      if (hasRunning) {
        status = 'running';
      } else if (hasFailed) {
        status = 'failed';
      } else {
        status = 'completed';
      }
    }

    // Format steps for response
    const steps = traces.map((trace) => ({
      id: trace._id.toString(),
      parentId: trace.parentId?.toString() || null,
      sequence: trace.sequence,
      stepType: trace.stepType,
      stepName: trace.stepName,
      status: trace.status,
      startedAt: trace.startedAt?.toISOString(),
      completedAt: trace.completedAt?.toISOString(),
      durationMs: trace.durationMs,
      input: trace.input,
      output: trace.output,
      tokenUsage: trace.tokenUsage,
      error: trace.error,
    }));

    res.json({
      executionId: execution._id.toString(),
      agentId: execution.agentId,
      status,
      triggeredAt: execution.triggeredAt?.toISOString(),
      completedAt: execution.completedAt?.toISOString(),
      totalDurationMs,
      stepCount: steps.length,
      // Include execution input/output so they show even without trace steps
      input: execution.input,
      output: execution.output,
      error: execution.error,
      steps,
    });
  } catch (error) {
    logger.error('[ExecutionRoutes] Error getting execution trace:', error);
    res.status(500).json({ error: 'Failed to get execution trace' });
  }
});

/**
 * DELETE /agents/:agentId/executions/:executionId
 * Delete an execution and its trace data
 */
router.delete(
  '/:executionId',
  checkAgentEdit,
  canAccessAgentResource({
    requiredPermission: PermissionBits.EDIT,
    resourceIdParam: 'agentId',
  }),
  async (req, res) => {
  try {
    const { agentId, executionId } = req.params;

    // Verify execution belongs to this agent
    const execution = await TriggerExecution.findOne({
      _id: executionId,
      agentId,
    });

    if (!execution) {
      return res.status(404).json({ error: 'Execution not found' });
    }

    // Delete trace data first
    await ExecutionTrace.deleteMany({ executionId });

    // Delete execution
    await TriggerExecution.deleteOne({ _id: executionId });

    res.json({ success: true, deleted: executionId });
  } catch (error) {
    logger.error('[ExecutionRoutes] Error deleting execution:', error);
    res.status(500).json({ error: 'Failed to delete execution' });
  }
});

/**
 * DELETE /agents/:agentId/executions
 * Delete all executions for an agent (with optional filters)
 */
router.delete(
  '/',
  checkAgentEdit,
  canAccessAgentResource({
    requiredPermission: PermissionBits.EDIT,
    resourceIdParam: 'agentId',
  }),
  async (req, res) => {
  try {
    const { agentId } = req.params;
    const { status, scheduleId, olderThan } = req.query;

    // Build query
    const query = { agentId };
    if (status) {
      query.status = status;
    }
    if (scheduleId) {
      query.scheduleId = scheduleId;
    }
    if (olderThan) {
      query.triggeredAt = { $lt: new Date(olderThan) };
    }

    // Get execution IDs to delete their traces
    const executions = await TriggerExecution.find(query).select('_id').lean();
    const executionIds = executions.map((e) => e._id);

    // Delete traces
    const traceResult = await ExecutionTrace.deleteMany({ executionId: { $in: executionIds } });

    // Delete executions
    const execResult = await TriggerExecution.deleteMany(query);

    res.json({
      success: true,
      deletedExecutions: execResult.deletedCount,
      deletedTraces: traceResult.deletedCount,
    });
  } catch (error) {
    logger.error('[ExecutionRoutes] Error deleting executions:', error);
    res.status(500).json({ error: 'Failed to delete executions' });
  }
});

module.exports = router;
