/**
 * Admin Dashboard Controller
 * 
 * Handles all dashboard-related metrics and analytics endpoints.
 */

const { logger } = require('@librechat/data-schemas');
const adminService = require('../services/adminService');

/**
 * Get overview metrics for the admin dashboard
 * Returns high-level counts and statistics
 */
const getOverview = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
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
    const { startDate, endDate } = req.query;
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
    const { startDate, endDate } = req.query;
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
    const { startDate, endDate } = req.query;
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
    const { page = 1, limit = 50, userId, conversationId, model, startDate, endDate } = req.query;
    
    const traces = await adminService.getLLMTraces({
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      userId,
      conversationId,
      model,
      startDate,
      endDate,
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

module.exports = {
  getOverview,
  getUserMetrics,
  getConversationMetrics,
  getTokenMetrics,
  getModelMetrics,
  getAgentMetrics,
  getActivityTimeline,
  getHourlyActivity,
  getUsageMetrics,
  getCostsMetrics,
  getLLMTraces,
};
