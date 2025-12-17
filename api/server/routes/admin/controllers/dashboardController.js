/**
 * Admin Dashboard Controller
 * 
 * Handles all dashboard-related metrics and analytics endpoints.
 */

const { logger } = require('@ranger/data-schemas');
const adminService = require('../services/adminService');

/**
 * Get overview metrics for the admin dashboard
 * Returns high-level counts and statistics
 */
const getOverview = async (req, res) => {
  try {
    let { startDate, endDate } = req.query;
    // Type coercion and validation: accept string, else pick first from array, else undefined
    startDate = typeof startDate === 'string' ? startDate
               : Array.isArray(startDate) && typeof startDate[0] === 'string' ? startDate[0]
               : undefined;
    endDate = typeof endDate === 'string' ? endDate
               : Array.isArray(endDate) && typeof endDate[0] === 'string' ? endDate[0]
               : undefined;
    const overview = await adminService.getOverviewMetrics(startDate, endDate);
    res.status(200).json(overview);
  } catch (error) {
    logger.error('[Admin] Error fetching overview metrics:', error);
    res.status(500).json({ 
      message: 'Error fetching overview metrics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get detailed user metrics
 * Returns user growth, registrations, active users, etc.
 */
const getUserMetrics = async (req, res) => {
  try {
    let { startDate, endDate } = req.query;
    startDate = typeof startDate === 'string' ? startDate
               : Array.isArray(startDate) && typeof startDate[0] === 'string' ? startDate[0]
               : undefined;
    endDate = typeof endDate === 'string' ? endDate
               : Array.isArray(endDate) && typeof endDate[0] === 'string' ? endDate[0]
               : undefined;
    const metrics = await adminService.getUserMetrics(startDate, endDate);
    res.status(200).json(metrics);
  } catch (error) {
    logger.error('[Admin] Error fetching user metrics:', error);
    res.status(500).json({ 
      message: 'Error fetching user metrics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get conversation metrics
 * Returns conversation counts, trends, and distribution
 */
const getConversationMetrics = async (req, res) => {
  try {
    let { startDate, endDate } = req.query;
    startDate = typeof startDate === 'string' ? startDate
               : Array.isArray(startDate) && typeof startDate[0] === 'string' ? startDate[0]
               : undefined;
    endDate = typeof endDate === 'string' ? endDate
               : Array.isArray(endDate) && typeof endDate[0] === 'string' ? endDate[0]
               : undefined;
    const metrics = await adminService.getConversationMetrics(startDate, endDate);
    res.status(200).json(metrics);
  } catch (error) {
    logger.error('[Admin] Error fetching conversation metrics:', error);
    res.status(500).json({ 
      message: 'Error fetching conversation metrics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get token usage metrics
 * Returns token consumption, costs, and trends
 */
const getTokenMetrics = async (req, res) => {
  try {
    let { startDate, endDate } = req.query;
    startDate = typeof startDate === 'string' ? startDate
               : Array.isArray(startDate) && typeof startDate[0] === 'string' ? startDate[0]
               : undefined;
    endDate = typeof endDate === 'string' ? endDate
               : Array.isArray(endDate) && typeof endDate[0] === 'string' ? endDate[0]
               : undefined;
    const metrics = await adminService.getTokenMetrics(startDate, endDate);
    res.status(200).json(metrics);
  } catch (error) {
    logger.error('[Admin] Error fetching token metrics:', error);
    res.status(500).json({ 
      message: 'Error fetching token metrics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get model usage metrics
 * Returns usage breakdown by model
 */
const getModelMetrics = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const metrics = await adminService.getModelMetrics(startDate, endDate);
    res.status(200).json(metrics);
  } catch (error) {
    logger.error('[Admin] Error fetching model metrics:', error);
    res.status(500).json({ 
      message: 'Error fetching model metrics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get agent usage metrics
 * Returns agent usage statistics
 */
const getAgentMetrics = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const metrics = await adminService.getAgentMetrics(startDate, endDate);
    res.status(200).json(metrics);
  } catch (error) {
    logger.error('[Admin] Error fetching agent metrics:', error);
    res.status(500).json({ 
      message: 'Error fetching agent metrics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get activity timeline
 * Returns recent activity and events
 */
const getActivityTimeline = async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;
    const activity = await adminService.getActivityTimeline(
      parseInt(limit, 10),
      parseInt(offset, 10)
    );
    res.status(200).json(activity);
  } catch (error) {
    logger.error('[Admin] Error fetching activity timeline:', error);
    res.status(500).json({ 
      message: 'Error fetching activity timeline',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get hourly activity for the last 24 hours
 * Returns session/conversation activity grouped by hour (CST by default)
 */
const getHourlyActivity = async (req, res) => {
  try {
    const { timezone = 'America/Chicago' } = req.query;
    const activity = await adminService.getHourlyActivity(timezone);
    res.status(200).json(activity);
  } catch (error) {
    logger.error('[Admin] Error fetching hourly activity:', error);
    res.status(500).json({ 
      message: 'Error fetching hourly activity',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get comprehensive usage metrics
 * Returns detailed usage data with date filtering
 */
const getUsageMetrics = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const usage = await adminService.getUsageMetrics(startDate, endDate);
    res.status(200).json(usage);
  } catch (error) {
    logger.error('[Admin] Error fetching usage metrics:', error);
    res.status(500).json({ 
      message: 'Error fetching usage metrics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get cost breakdown metrics
 * Returns detailed cost data with date filtering
 */
const getCostsMetrics = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    // Use token metrics which has cost breakdown by model
    const costs = await adminService.getTokenMetrics(startDate, endDate);
    res.status(200).json(costs);
  } catch (error) {
    logger.error('[Admin] Error fetching cost metrics:', error);
    res.status(500).json({ 
      message: 'Error fetching cost metrics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get LLM traces for observability dashboard
 * Shows all message input/output pairs with detailed trace information
 */
const getLLMTraces = async (req, res) => {
  try {
    const { page = 1, limit = 25, userId, conversationId, model, startDate, endDate, toolName, errorOnly, agent, guardrails, search } = req.query;
    
    // Enforce maximum limit of 50 to prevent performance issues (default 25)
    const parsedLimit = Math.min(parseInt(limit, 10) || 25, 50);
    
    logger.debug(`[Admin Dashboard] getLLMTraces - page: ${page}, requestedLimit: ${limit}, parsedLimit: ${parsedLimit}`);
    
    const traces = await adminService.getLLMTraces({
      page: parseInt(page, 10),
      limit: parsedLimit,
      userId,
      conversationId,
      model,
      startDate,
      endDate,
      toolName,
      errorOnly: errorOnly === 'true' || errorOnly === true,
      agent,
      guardrails,
      search,
    });
    
    res.json(traces);
  } catch (error) {
    logger.error('[Admin Dashboard] Error fetching LLM traces:', error);
    res.status(500).json({
      message: 'Error fetching LLM traces',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get tool usage metrics
 * Returns tool invocation statistics
 */
const getToolMetrics = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const metrics = await adminService.getToolMetrics(startDate, endDate);
    res.status(200).json(metrics);
  } catch (error) {
    logger.error('[Admin] Error fetching tool metrics:', error);
    res.status(500).json({ 
      message: 'Error fetching tool metrics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get guardrails usage metrics
 * Returns guardrail tracking statistics
 */
const getGuardrailsMetrics = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const metrics = await adminService.getGuardrailsMetrics(startDate, endDate);
    res.status(200).json(metrics);
  } catch (error) {
    logger.error('[Admin] Error fetching guardrails metrics:', error);
    res.status(500).json({ 
      message: 'Error fetching guardrails metrics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get agent summary only (fast endpoint for stats cards)
 * Returns only counts, no detailed agent list
 */
const getAgentSummary = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const summary = await adminService.getAgentSummary(startDate, endDate);
    res.status(200).json(summary);
  } catch (error) {
    logger.error('[Admin] Error fetching agent summary:', error);
    res.status(500).json({ 
      message: 'Error fetching agent summary',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get all agents list (no date filtering)
 * Returns all agents in the database for display
 */
const getAllAgents = async (req, res) => {
  try {
    const allAgents = await adminService.getAllAgents();
    res.status(200).json(allAgents);
  } catch (error) {
    logger.error('[Admin] Error fetching all agents:', error);
    res.status(500).json({ 
      message: 'Error fetching all agents',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get tools summary only (fast endpoint for stats cards)
 * Returns only summary metrics, no detailed tool list
 */
const getToolSummary = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const summary = await adminService.getToolSummary(startDate, endDate);
    res.status(200).json(summary);
  } catch (error) {
    logger.error('[Admin] Error fetching tool summary:', error);
    res.status(500).json({ 
      message: 'Error fetching tool summary',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get guardrails summary only (fast endpoint for stats cards)
 * Returns only summary metrics, no detailed breakdown
 */
const getGuardrailsSummary = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const summary = await adminService.getGuardrailsSummary(startDate, endDate);
    res.status(200).json(summary);
  } catch (error) {
    logger.error('[Admin] Error fetching guardrails summary:', error);
    res.status(500).json({ 
      message: 'Error fetching guardrails summary',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get all groups from the database
 */
const getGroups = async (req, res) => {
  try {
    const groups = await adminService.getGroups();
    res.json(groups);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to fetch groups',
      message: error.message,
    });
  }
};

/**
 * Create a new group
 */
const createGroup = async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Group name is required' });
    }
    const group = await adminService.createGroup({ name, description });
    res.status(201).json(group);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to create group',
      message: error.message,
    });
  }
};

/**
 * Update a group
 */
const updateGroup = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { name, description } = req.body;
    const group = await adminService.updateGroup(groupId, { name, description });
    res.json(group);
  } catch (error) {
    if (error.message === 'Group not found') {
      return res.status(404).json({ error: 'Group not found' });
    }
    res.status(500).json({
      error: 'Failed to update group',
      message: error.message,
    });
  }
};

/**
 * Delete a group
 */
const deleteGroup = async (req, res) => {
  try {
    const { groupId } = req.params;
    const result = await adminService.deleteGroup(groupId);
    res.json(result);
  } catch (error) {
    if (error.message === 'Group not found') {
      return res.status(404).json({ error: 'Group not found' });
    }
    res.status(500).json({
      error: 'Failed to delete group',
      message: error.message,
    });
  }
};

/**
 * Get agent-group associations
 */
const getAgentGroupAssociations = async (req, res) => {
  try {
    const associations = await adminService.getAgentGroupAssociations();
    res.json(associations);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to fetch agent group associations',
      message: error.message,
    });
  }
};

/**
 * Get detailed information about a specific agent
 * Returns all-time stats (no date filtering for totals)
 */
const getAgentDetail = async (req, res) => {
  try {
    const { agentId } = req.params;
    
    const detail = await adminService.getAgentDetail(agentId);
    
    if (!detail) {
      return res.status(404).json({
        error: 'Agent not found',
        message: `No agent found with ID: ${agentId}`,
      });
    }
    
    res.json(detail);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to fetch agent details',
      message: error.message,
    });
  }
};

/**
 * Update agent access (groups and users)
 */
const updateAgentAccess = async (req, res) => {
  try {
    const { agentId } = req.params;
    const { groups, users } = req.body;
    
    const result = await adminService.updateAgentAccess(agentId, { groups, users });
    
    if (!result) {
      return res.status(404).json({
        error: 'Agent not found',
        message: `No agent found with ID: ${agentId}`,
      });
    }
    
    res.json(result);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to update agent access',
      message: error.message,
    });
  }
};

/**
 * Get conversations for a specific agent
 */
const getAgentConversations = async (req, res) => {
  try {
    const { agentId } = req.params;
    const { page = 1, limit = 20 } = req.query;
    
    const result = await adminService.getAgentConversations(
      agentId,
      parseInt(page, 10),
      parseInt(limit, 10)
    );
    
    res.json(result);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to fetch agent conversations',
      message: error.message,
    });
  }
};

/**
 * Get messages for a specific conversation
 */
const getConversationMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;
    
    const messages = await adminService.getConversationMessages(conversationId);
    
    res.json({ messages });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to fetch conversation messages',
      message: error.message,
    });
  }
};

module.exports = {
  getOverview,
  getUserMetrics,
  getConversationMetrics,
  getTokenMetrics,
  getModelMetrics,
  getAgentMetrics,
  getAgentSummary,
  getAllAgents,
  getActivityTimeline,
  getHourlyActivity,
  getUsageMetrics,
  getCostsMetrics,
  getLLMTraces,
  getToolMetrics,
  getToolSummary,
  getGuardrailsMetrics,
  getGuardrailsSummary,
  getGroups,
  createGroup,
  updateGroup,
  deleteGroup,
  getAgentGroupAssociations,
  getAgentDetail,
  updateAgentAccess,
  getAgentConversations,
  getConversationMessages,
};
