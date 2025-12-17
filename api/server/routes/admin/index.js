/**
 * Admin API Routes
 * 
 * Comprehensive admin endpoints for dashboard metrics and management.
 * All routes require admin authentication.
 * 
 * This folder can be safely deleted if admin functionality is not needed.
 */

const express = require('express');
const { requireJwtAuth, checkAdmin } = require('~/server/middleware');

// Import controllers
const dashboardController = require('./controllers/dashboardController');
const usersController = require('./controllers/usersController');
const conversationsController = require('./controllers/conversationsController');
const systemController = require('./controllers/systemController');

const router = express.Router();

// Apply authentication and admin check to all routes
router.use(requireJwtAuth);
router.use(checkAdmin);

/**
 * Dashboard Metrics
 */
// GET /api/admin/dashboard/overview - Get overview metrics
router.get('/dashboard/overview', dashboardController.getOverview);

// GET /api/admin/dashboard/users - Get user metrics
router.get('/dashboard/users', dashboardController.getUserMetrics);

// GET /api/admin/dashboard/conversations - Get conversation metrics
router.get('/dashboard/conversations', dashboardController.getConversationMetrics);

// GET /api/admin/dashboard/tokens - Get token usage metrics
router.get('/dashboard/tokens', dashboardController.getTokenMetrics);

// GET /api/admin/dashboard/models - Get model usage metrics
router.get('/dashboard/models', dashboardController.getModelMetrics);

// GET /api/admin/dashboard/agents - Get agent usage metrics (full)
router.get('/dashboard/agents', dashboardController.getAgentMetrics);

// GET /api/admin/dashboard/agents/all - Get all agents list (no date filter)
router.get('/dashboard/agents/all', dashboardController.getAllAgents);

// GET /api/admin/dashboard/agents/summary - Get agent summary only (fast)
router.get('/dashboard/agents/summary', dashboardController.getAgentSummary);

// GET /api/admin/dashboard/activity - Get activity timeline
router.get('/dashboard/activity', dashboardController.getActivityTimeline);

// GET /api/admin/dashboard/hourly - Get hourly activity for last 24 hours
router.get('/dashboard/hourly', dashboardController.getHourlyActivity);

// GET /api/admin/dashboard/usage - Get comprehensive usage metrics
router.get('/dashboard/usage', dashboardController.getUsageMetrics);

// GET /api/admin/dashboard/costs - Get cost breakdown
router.get('/dashboard/costs', dashboardController.getCostsMetrics);

// GET /api/admin/dashboard/traces - Get LLM traces for observability
router.get('/dashboard/traces', dashboardController.getLLMTraces);

// GET /api/admin/dashboard/tools - Get tool usage metrics (full)
router.get('/dashboard/tools', dashboardController.getToolMetrics);

// GET /api/admin/dashboard/tools/summary - Get tools summary only (fast)
router.get('/dashboard/tools/summary', dashboardController.getToolSummary);

// GET /api/admin/dashboard/guardrails - Get guardrails metrics (full)
router.get('/dashboard/guardrails', dashboardController.getGuardrailsMetrics);

// GET /api/admin/dashboard/guardrails/summary - Get guardrails summary only (fast)
router.get('/dashboard/guardrails/summary', dashboardController.getGuardrailsSummary);

/**
 * Groups Management
 */
// GET /api/admin/groups - Get all groups
router.get('/groups', dashboardController.getGroups);

// POST /api/admin/groups - Create a new group
router.post('/groups', dashboardController.createGroup);

// PUT /api/admin/groups/:groupId - Update a group
router.put('/groups/:groupId', dashboardController.updateGroup);

// DELETE /api/admin/groups/:groupId - Delete a group
router.delete('/groups/:groupId', dashboardController.deleteGroup);

// GET /api/admin/agents/groups - Get agent-group associations
router.get('/agents/groups', dashboardController.getAgentGroupAssociations);

// GET /api/admin/agents/:agentId - Get agent details
router.get('/agents/:agentId', dashboardController.getAgentDetail);

// PUT /api/admin/agents/:agentId/access - Update agent access (groups and users)
router.put('/agents/:agentId/access', dashboardController.updateAgentAccess);

// GET /api/admin/agents/:agentId/conversations - Get agent conversations
router.get('/agents/:agentId/conversations', dashboardController.getAgentConversations);

// GET /api/admin/conversations/:conversationId/messages - Get conversation messages
router.get('/conversations/:conversationId/messages', dashboardController.getConversationMessages);

/**
 * User Management
 */
// GET /api/admin/users/active/sessions - Get live session data for active users page
router.get('/users/active/sessions', usersController.getActiveSessions);

// DELETE /api/admin/users/active/sessions - Clear all sessions (logout all users)
router.delete('/users/active/sessions', usersController.clearAllSessions);

// GET /api/admin/users/active/microsoft - Get Microsoft 365 OAuth sessions
router.get('/users/active/microsoft', usersController.getMicrosoftSessions);

// GET /api/admin/users/active - Get users with active sessions
router.get('/users/active', usersController.getActiveUsers);

// DELETE /api/admin/bans - Clear all bans (unban all users and clear ban logs)
router.delete('/bans', usersController.clearAllBans);

// GET /api/admin/users - List all users with pagination
router.get('/users', usersController.listUsers);

// GET /api/admin/users/:userId - Get specific user details
router.get('/users/:userId', usersController.getUserDetails);

// PUT /api/admin/users/:userId - Update user
router.put('/users/:userId', usersController.updateUser);

// PUT /api/admin/users/:userId/role - Update user role
router.put('/users/:userId/role', usersController.updateUserRole);

// PUT /api/admin/users/:userId/ban - Ban/Unban user
router.put('/users/:userId/ban', usersController.toggleUserBan);

// PUT /api/admin/users/:userId/oidc-groups - Update user OIDC groups
router.put('/users/:userId/oidc-groups', usersController.updateUserOidcGroups);

// DELETE /api/admin/users/:userId - Delete user
router.delete('/users/:userId', usersController.deleteUser);

// GET /api/admin/users/:userId/stats - Get user statistics
router.get('/users/:userId/stats', usersController.getUserStats);

// GET /api/admin/users/:userId/sessions - Get user sessions
router.get('/users/:userId/sessions', usersController.getUserSessions);

// DELETE /api/admin/users/:userId/sessions - Terminate all sessions for a user
router.delete('/users/:userId/sessions', usersController.terminateAllUserSessions);

// DELETE /api/admin/users/:userId/sessions/:sessionId - Terminate a specific session
router.delete('/users/:userId/sessions/:sessionId', usersController.terminateSession);

// GET /api/admin/users/:userId/transactions - Get user transactions
router.get('/users/:userId/transactions', usersController.getUserTransactions);

// GET /api/admin/users/:userId/usage - Get user usage with model breakdown
router.get('/users/:userId/usage', usersController.getUserUsage);

// GET /api/admin/users/:userId/conversations - Get user conversations with messages
router.get('/users/:userId/conversations', usersController.getUserConversations);

/**
 * Conversation Management
 */
// GET /api/admin/conversations - List conversations with filters
router.get('/conversations', conversationsController.listConversations);

// GET /api/admin/conversations/:conversationId - Get conversation details
router.get('/conversations/:conversationId', conversationsController.getConversationDetails);

// DELETE /api/admin/conversations/:conversationId - Delete conversation
router.delete('/conversations/:conversationId', conversationsController.deleteConversation);

/**
 * Role Management
 */
// GET /api/admin/roles - List all roles
router.get('/roles', systemController.listRoles);

// GET /api/admin/roles/:roleName - Get specific role details
router.get('/roles/:roleName', systemController.getRoleDetails);

// PUT /api/admin/roles/:roleName - Update role permissions
router.put('/roles/:roleName', systemController.updateRole);

// POST /api/admin/roles - Create new custom role
router.post('/roles', systemController.createRole);

// DELETE /api/admin/roles/:roleName - Delete custom role
router.delete('/roles/:roleName', systemController.deleteRole);

/**
 * System Information
 */
// GET /api/admin/system/health - Get system health status
router.get('/system/health', systemController.getSystemHealth);

// GET /api/admin/system/config - Get system configuration (non-sensitive)
router.get('/system/config', systemController.getSystemConfig);

// GET /api/admin/system/logs - Get recent logs
router.get('/system/logs', systemController.getRecentLogs);

// GET /api/admin/system/settings - Get system settings
router.get('/system/settings', systemController.getSystemSettings);

// PUT /api/admin/system/settings - Update system settings
router.put('/system/settings', systemController.updateSystemSettings);

// GET /api/admin/system/cache/stats - Get cache statistics
router.get('/system/cache/stats', systemController.getCacheStats);

// POST /api/admin/system/cache/flush - Flush cache
router.post('/system/cache/flush', systemController.flushCache);

module.exports = router;
