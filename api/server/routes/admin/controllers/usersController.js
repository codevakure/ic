/**
 * Admin Users Controller
 * 
 * Handles all user management endpoints for administrators.
 */

const { logger } = require('@ranger/data-schemas');
const { SystemRoles } = require('ranger-data-provider');
const adminService = require('../services/adminService');
const userService = require('../services/userService');

/**
 * List all users with pagination and filtering
 */
const listUsers = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = '',
      role = '',
      sortBy = 'createdAt',
      sortOrder = 'desc',
      status = '', // active, banned, all
    } = req.query;

    const result = await userService.listUsers({
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      search,
      role,
      sortBy,
      sortOrder,
      status,
    });

    res.status(200).json(result);
  } catch (error) {
    logger.error('[Admin] Error listing users:', error);
    res.status(500).json({ 
      message: 'Error listing users',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get detailed information about a specific user
 */
const getUserDetails = async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await userService.getUserById(userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json(user);
  } catch (error) {
    logger.error('[Admin] Error fetching user details:', error);
    res.status(500).json({ 
      message: 'Error fetching user details',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Update user information
 */
const updateUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const updates = req.body;

    // Prevent updating sensitive fields directly
    delete updates.password;
    delete updates.totpSecret;
    delete updates.backupCodes;

    const user = await userService.updateUser(userId, updates);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json({ message: 'User updated successfully', user });
  } catch (error) {
    logger.error('[Admin] Error updating user:', error);
    res.status(500).json({ 
      message: 'Error updating user',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Update user role
 */
const updateUserRole = async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;

    // Validate role
    if (!Object.values(SystemRoles).includes(role)) {
      return res.status(400).json({ message: 'Invalid role' });
    }

    // Prevent admin from demoting themselves
    if (userId === req.user.id && role !== SystemRoles.ADMIN) {
      return res.status(400).json({ message: 'Cannot change your own admin role' });
    }

    const user = await userService.updateUserRole(userId, role);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json({ message: 'User role updated successfully', user });
  } catch (error) {
    logger.error('[Admin] Error updating user role:', error);
    res.status(500).json({ 
      message: 'Error updating user role',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Ban or unban a user
 */
const toggleUserBan = async (req, res) => {
  try {
    const { userId } = req.params;
    const { banned, reason = '' } = req.body;

    // Prevent admin from banning themselves
    if (userId === req.user.id) {
      return res.status(400).json({ message: 'Cannot ban yourself' });
    }

    const user = await userService.toggleUserBan(userId, banned, reason);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const action = banned ? 'banned' : 'unbanned';
    res.status(200).json({ message: `User ${action} successfully`, user });
  } catch (error) {
    logger.error('[Admin] Error toggling user ban:', error);
    res.status(500).json({ 
      message: 'Error updating user ban status',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Delete a user and their data
 */
const deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { deleteData = true } = req.query;

    // Prevent admin from deleting themselves
    if (userId === req.user.id) {
      return res.status(400).json({ message: 'Cannot delete yourself' });
    }

    await userService.deleteUser(userId, deleteData === 'true' || deleteData === true);

    res.status(200).json({ message: 'User deleted successfully' });
  } catch (error) {
    logger.error('[Admin] Error deleting user:', error);
    res.status(500).json({ 
      message: 'Error deleting user',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get detailed statistics for a specific user
 */
const getUserStats = async (req, res) => {
  try {
    const { userId } = req.params;
    const stats = await userService.getUserStats(userId);

    if (!stats) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json(stats);
  } catch (error) {
    logger.error('[Admin] Error fetching user stats:', error);
    res.status(500).json({ 
      message: 'Error fetching user statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get users with active sessions (currently online)
 */
const getActiveUsers = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;

    const result = await userService.getActiveUsers({
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
    });

    res.status(200).json(result);
  } catch (error) {
    logger.error('[Admin] Error fetching active users:', error);
    res.status(500).json({ 
      message: 'Error fetching active users',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get active sessions with full session data for live monitoring
 */
const getActiveSessions = async (req, res) => {
  try {
    const result = await userService.getActiveSessions();
    res.status(200).json(result);
  } catch (error) {
    logger.error('[Admin] Error fetching active sessions:', error);
    res.status(500).json({ 
      message: 'Error fetching active sessions',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get user's session history
 */
const getUserSessions = async (req, res) => {
  try {
    const { userId } = req.params;

    const sessions = await userService.getUserSessions(userId);

    res.status(200).json(sessions);
  } catch (error) {
    logger.error('[Admin] Error fetching user sessions:', error);
    res.status(500).json({ 
      message: 'Error fetching user sessions',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get user's transaction history
 */
const getUserTransactions = async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 20, startDate, endDate } = req.query;

    const result = await userService.getUserTransactions(userId, {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      startDate,
      endDate,
    });

    res.status(200).json(result);
  } catch (error) {
    logger.error('[Admin] Error fetching user transactions:', error);
    res.status(500).json({ 
      message: 'Error fetching user transactions',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get user's usage metrics with model breakdown
 */
const getUserUsage = async (req, res) => {
  try {
    const { userId } = req.params;
    const { startDate, endDate } = req.query;

    const result = await adminService.getUserUsageDetails(userId, startDate, endDate);

    res.status(200).json(result);
  } catch (error) {
    logger.error('[Admin] Error fetching user usage:', error);
    res.status(500).json({ 
      message: 'Error fetching user usage',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get user's conversations with messages
 */
const getUserConversations = async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const result = await userService.getUserConversations(userId, {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
    });

    res.status(200).json(result);
  } catch (error) {
    logger.error('[Admin] Error fetching user conversations:', error);
    res.status(500).json({ 
      message: 'Error fetching user conversations',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = {
  listUsers,
  getUserDetails,
  updateUser,
  updateUserRole,
  toggleUserBan,
  deleteUser,
  getUserStats,
  getActiveUsers,
  getActiveSessions,
  getUserSessions,
  getUserTransactions,
  getUserUsage,
  getUserConversations,
};
