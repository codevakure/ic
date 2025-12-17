/**
 * Admin User Service
 * 
 * Service for user management operations.
 */

const { Keyv } = require('keyv');
const { logger } = require('@librechat/data-schemas');
const { isEnabled, keyvMongo } = require('@librechat/api');
const { ViolationTypes } = require('librechat-data-provider');
const {
  User,
  Conversation,
  Message,
  Transaction,
  Balance,
  Session,
  Token,
} = require('~/db/models');
const {
  deleteAllUserSessions,
  deleteMessages,
  deleteConvos,
  deleteFiles,
} = require('~/models');
const { getLogStores } = require('~/cache');

// Ban cache for clearing on unban
const banCache = new Keyv({ store: keyvMongo, namespace: ViolationTypes.BAN, ttl: 0 });

/**
 * Model pricing per MILLION tokens (AWS Bedrock pricing)
 */
const MODEL_PRICING = {
  'us.amazon.nova-micro-v1:0': { name: 'Amazon Nova Micro', input: 0.035, output: 0.14 },
  'global.amazon.nova-2-lite-v1:0': { name: 'Amazon Nova Lite', input: 0.06, output: 0.24 },
  'us.anthropic.claude-haiku-4-5-20251001-v1:0': { name: 'Claude Haiku 4.5', input: 1.0, output: 5.0 },
  'us.anthropic.claude-sonnet-4-5-20250929-v1:0': { name: 'Claude Sonnet 4.5', input: 3.0, output: 15.0 },
  'global.anthropic.claude-opus-4-5-20251101-v1:0': { name: 'Claude Opus 4.5', input: 5.0, output: 25.0 },
};

/**
 * Calculate cost for tokens
 */
const calculateCost = (model, tokenType, tokens) => {
  const pricing = MODEL_PRICING[model];
  if (!pricing) return (tokens / 1000000) * (tokenType === 'prompt' ? 1.0 : 5.0);
  const rate = tokenType === 'prompt' ? pricing.input : pricing.output;
  return (tokens / 1000000) * rate;
};

/**
 * List users with pagination and filtering
 */
const listUsers = async ({
  page = 1,
  limit = 20,
  search = '',
  role = '',
  sortBy = 'createdAt',
  sortOrder = 'desc',
  status = '',
  group = '',
}) => {
  try {
    const query = {};

    // Search filter
    if (search) {
      query.$or = [
        { email: { $regex: search, $options: 'i' } },
        { name: { $regex: search, $options: 'i' } },
        { username: { $regex: search, $options: 'i' } },
      ];
    }

    // Role filter
    if (role) {
      query.role = role;
    }

    // Status filter
    if (status === 'banned') {
      query.banned = true;
    } else if (status === 'active') {
      query.banned = { $ne: true };
    }

    // OIDC Group filter - server-side for performance
    if (group) {
      query.oidcGroups = group;
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Get total count
    const total = await User.countDocuments(query);

    // Get paginated users
    const users = await User.find(query)
      .select('-password -totpSecret -backupCodes')
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    // Get token usage for all listed users
    const userIds = users.map(u => u._id);
    const usageData = await Transaction.aggregate([
      { $match: { user: { $in: userIds } } },
      {
        $group: {
          _id: { user: '$user', model: '$model', tokenType: '$tokenType' },
          tokens: { $sum: { $abs: '$rawAmount' } },
        },
      },
    ]);

    // Process usage data per user
    const userUsageMap = {};
    usageData.forEach(item => {
      const usrId = item._id.user.toString();
      if (!userUsageMap[usrId]) {
        userUsageMap[usrId] = { inputTokens: 0, outputTokens: 0, totalCost: 0 };
      }
      const tokens = item.tokens;
      const model = item._id.model;
      const tokenType = item._id.tokenType;
      
      if (tokenType === 'prompt') {
        userUsageMap[usrId].inputTokens += tokens;
        userUsageMap[usrId].totalCost += calculateCost(model, 'prompt', tokens);
      } else {
        userUsageMap[usrId].outputTokens += tokens;
        userUsageMap[usrId].totalCost += calculateCost(model, 'completion', tokens);
      }
    });

    // Merge usage data with users
    const usersWithUsage = users.map(user => {
      const usage = userUsageMap[user._id.toString()] || { inputTokens: 0, outputTokens: 0, totalCost: 0 };
      return {
        ...user,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        totalTokens: usage.inputTokens + usage.outputTokens,
        totalCost: parseFloat(usage.totalCost.toFixed(6)),
      };
    });

    return {
      users: usersWithUsage,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    };
  } catch (error) {
    logger.error('[Admin UserService] Error listing users:', error);
    throw error;
  }
};

/**
 * Get user by ID with additional details
 */
const getUserById = async (userId) => {
  try {
    // Run all queries in parallel for better performance
    const [user, balance, conversationCount, messageCount] = await Promise.all([
      User.findById(userId)
        .select('-password -totpSecret -backupCodes')
        .lean(),
      Balance.findOne({ user: userId }).lean().catch(err => {
        logger.warn('[Admin UserService] Could not fetch user balance:', err.message);
        return null;
      }),
      Conversation.countDocuments({ user: userId }),
      Message.countDocuments({ user: userId }),
    ]);

    if (!user) {
      return null;
    }

    return {
      ...user,
      balance: balance?.tokenCredits || 0,
      conversationCount,
      messageCount,
    };
  } catch (error) {
    logger.error('[Admin UserService] Error getting user by ID:', error);
    throw error;
  }
};

/**
 * Update user information
 */
const updateUser = async (userId, updates) => {
  try {
    const user = await User.findByIdAndUpdate(
      userId,
      { $set: updates },
      { new: true, runValidators: true }
    )
      .select('-password -totpSecret -backupCodes')
      .lean();

    return user;
  } catch (error) {
    logger.error('[Admin UserService] Error updating user:', error);
    throw error;
  }
};

/**
 * Update user role
 */
const updateUserRole = async (userId, role) => {
  try {
    const user = await User.findByIdAndUpdate(
      userId,
      { $set: { role } },
      { new: true }
    )
      .select('-password -totpSecret -backupCodes')
      .lean();

    return user;
  } catch (error) {
    logger.error('[Admin UserService] Error updating user role:', error);
    throw error;
  }
};

/**
 * Update user OIDC groups
 */
const updateUserOidcGroups = async (userId, oidcGroups) => {
  try {
    const user = await User.findByIdAndUpdate(
      userId,
      { $set: { oidcGroups } },
      { new: true }
    )
      .select('-password -totpSecret -backupCodes')
      .lean();

    return user;
  } catch (error) {
    logger.error('[Admin UserService] Error updating user OIDC groups:', error);
    throw error;
  }
};

/**
 * Ban or unban a user
 * When banning: adds entry to logs collection (ban logs)
 * When unbanning: removes entry from logs collection
 */
const toggleUserBan = async (userId, banned, reason = '') => {
  try {
    const updateData = {
      banned,
      banReason: banned ? reason : '',
      bannedAt: banned ? new Date() : null,
    };

    const user = await User.findByIdAndUpdate(
      userId,
      { $set: updateData },
      { new: true }
    )
      .select('-password -totpSecret -backupCodes')
      .lean();

    if (!user) {
      return null;
    }

    // Get ban logs store
    const banLogs = getLogStores(ViolationTypes.BAN);

    // If banning, add to ban logs and invalidate sessions
    if (banned) {
      try {
        // Add ban entry to logs collection
        const banEntry = {
          odified: Date.now(),
          count: 1,
          type: ViolationTypes.BAN,
          user: userId,
          reason: reason || 'Banned by admin',
          bannedAt: new Date().toISOString(),
          expiresAt: Date.now() + (banLogs.opts?.ttl || 0),
        };
        await banLogs.set(userId, banEntry);
        
        // Also set in ban cache for immediate effect
        const userKey = isEnabled(process.env.USE_REDIS) ? `ban_cache:user:${userId}` : userId;
        await banCache.set(userKey, banEntry, banLogs.opts?.ttl || 0);
        
        logger.info(`[Admin UserService] Added ban entry to logs for user ${userId}`);
        
        // Invalidate all user sessions
        await deleteAllUserSessions(userId);
      } catch (error) {
        logger.warn('[Admin UserService] Could not add ban to logs:', error.message);
      }
    }

    // If unbanning, clear ban cache AND remove from logs collection
    if (!banned) {
      try {
        // Clear ban cache (both Redis key format and direct key format)
        const userKey = isEnabled(process.env.USE_REDIS) ? `ban_cache:user:${userId}` : userId;
        await banCache.delete(userKey);
        
        // Also try to delete the raw userId key in case it was stored that way
        if (isEnabled(process.env.USE_REDIS)) {
          await banCache.delete(userId);
        }
        
        // IMPORTANT: Remove from ban logs collection
        await banLogs.delete(userId);
        
        logger.info(`[Admin UserService] Cleared ban cache and logs for user ${userId}`);
      } catch (error) {
        logger.warn('[Admin UserService] Could not clear ban cache/logs:', error.message);
      }
    }

    return user;
  } catch (error) {
    logger.error('[Admin UserService] Error toggling user ban:', error);
    throw error;
  }
};

/**
 * Delete user and optionally their data
 */
const deleteUser = async (userId, deleteData = true) => {
  try {
    if (deleteData) {
      // Delete user's conversations and messages
      await deleteConvos(userId, {});
      
      // Delete user's files
      try {
        await deleteFiles({ user: userId });
      } catch (error) {
        logger.warn('[Admin UserService] Could not delete user files:', error.message);
      }

      // Delete user's transactions
      try {
        await Transaction.deleteMany({ user: userId });
      } catch (error) {
        logger.warn('[Admin UserService] Could not delete user transactions:', error.message);
      }

      // Delete user's balance
      try {
        await Balance.deleteOne({ user: userId });
      } catch (error) {
        logger.warn('[Admin UserService] Could not delete user balance:', error.message);
      }

      // Delete user's sessions
      try {
        await deleteAllUserSessions(userId);
      } catch (error) {
        logger.warn('[Admin UserService] Could not delete user sessions:', error.message);
      }
    }

    // Delete the user
    await User.findByIdAndDelete(userId);

    return true;
  } catch (error) {
    logger.error('[Admin UserService] Error deleting user:', error);
    throw error;
  }
};

/**
 * Get users with active sessions (currently online)
 */
const getActiveUsers = async ({ page = 1, limit = 20 }) => {
  try {
    const now = new Date();

    // Get all active sessions with user details
    const activeSessions = await Session.aggregate([
      // Only non-expired sessions
      { $match: { expiration: { $gt: now } } },
      // Group by user to get session count per user
      {
        $group: {
          _id: '$user',
          sessionCount: { $sum: 1 },
          latestSession: { $max: '$expiration' },
          earliestSession: { $min: '$expiration' },
        },
      },
      // Sort by session count (most active first)
      { $sort: { sessionCount: -1 } },
      // Pagination
      { $skip: (page - 1) * limit },
      { $limit: limit },
      // Lookup user details
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user',
        },
      },
      { $unwind: '$user' },
      // Project fields
      {
        $project: {
          _id: '$user._id',
          name: '$user.name',
          username: '$user.username',
          email: '$user.email',
          avatar: '$user.avatar',
          role: '$user.role',
          createdAt: '$user.createdAt',
          provider: '$user.provider',
          sessionCount: 1,
          latestSession: 1,
          earliestSession: 1,
        },
      },
    ]);

    // Get total count of users with active sessions
    const totalActiveUsers = await Session.aggregate([
      { $match: { expiration: { $gt: now } } },
      { $group: { _id: '$user' } },
      { $count: 'total' },
    ]);

    const total = totalActiveUsers[0]?.total || 0;

    return {
      users: activeSessions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    };
  } catch (error) {
    logger.error('[Admin UserService] Error getting active users:', error);
    throw error;
  }
};

/**
 * Get user's session history
 */
const getUserSessions = async (userId) => {
  try {
    const now = new Date();
    
    // Get active sessions
    const activeSessions = await Session.find({
      user: userId,
      expiration: { $gt: now },
    })
      .sort({ expiration: -1 })
      .lean();

    return {
      activeSessions: activeSessions.map(s => ({
        id: s._id.toString(),
        createdAt: s.createdAt || null,
        expiration: s.expiration,
        isActive: true,
      })),
      activeCount: activeSessions.length,
    };
  } catch (error) {
    logger.error('[Admin UserService] Error getting user sessions:', error);
    throw error;
  }
};

/**
 * Terminate a specific user session
 */
const terminateUserSession = async (userId, sessionId) => {
  try {
    const mongoose = require('mongoose');
    
    // Validate ObjectId formats
    if (!mongoose.Types.ObjectId.isValid(sessionId)) {
      logger.warn(`[Admin UserService] Invalid session ID format: ${sessionId}`);
      return { success: false, message: 'Invalid session ID format' };
    }
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      logger.warn(`[Admin UserService] Invalid user ID format: ${userId}`);
      return { success: false, message: 'Invalid user ID format' };
    }

    // Verify the session belongs to the user
    const session = await Session.findOne({
      _id: new mongoose.Types.ObjectId(sessionId),
      user: new mongoose.Types.ObjectId(userId),
    }).lean();

    if (!session) {
      logger.warn(`[Admin UserService] Session ${sessionId} not found for user ${userId}`);
      return { success: false, message: 'Session not found or does not belong to this user' };
    }

    // Delete the session directly using the Session model for reliability
    const result = await Session.deleteOne({ _id: new mongoose.Types.ObjectId(sessionId) });

    if (result.deletedCount === 0) {
      return { success: false, message: 'Failed to delete session' };
    }

    logger.info(`[Admin UserService] Session ${sessionId} terminated for user ${userId}`);
    return { success: true };
  } catch (error) {
    logger.error('[Admin UserService] Error terminating user session:', error);
    throw error;
  }
};

/**
 * Get user's transaction history with pagination and model info
 */
const getUserTransactions = async (userId, { page = 1, limit = 20, startDate, endDate }) => {
  try {
    const query = { user: userId };
    
    // Add date filter if provided
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.createdAt.$lte = end;
      }
    }
    
    const total = await Transaction.countDocuments(query);
    
    const transactions = await Transaction.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    // Model pricing for cost calculation
    const MODEL_PRICING = {
      'us.amazon.nova-micro-v1:0': { name: 'Amazon Nova Micro', input: 0.035, output: 0.14 },
      'global.amazon.nova-2-lite-v1:0': { name: 'Amazon Nova Lite', input: 0.06, output: 0.24 },
      'us.anthropic.claude-haiku-4-5-20251001-v1:0': { name: 'Claude Haiku 4.5', input: 1.0, output: 5.0 },
      'us.anthropic.claude-sonnet-4-5-20250929-v1:0': { name: 'Claude Sonnet 4.5', input: 3.0, output: 15.0 },
      'global.anthropic.claude-opus-4-5-20251101-v1:0': { name: 'Claude Opus 4.5', input: 15.0, output: 75.0 },
    };

    // Enrich transactions with model name and calculated cost
    const enrichedTransactions = transactions.map(t => {
      const pricing = MODEL_PRICING[t.model] || { name: t.model, input: 1.0, output: 5.0 };
      const tokens = Math.abs(t.rawAmount || 0);
      const rate = t.tokenType === 'prompt' ? pricing.input : pricing.output;
      const calculatedCost = (tokens / 1000000) * rate;
      
      return {
        ...t,
        modelName: pricing.name,
        tokens,
        calculatedCost: parseFloat(calculatedCost.toFixed(6)),
      };
    });

    // Summarize transactions
    const summary = await Transaction.aggregate([
      { $match: { user: require('mongoose').Types.ObjectId.createFromHexString(userId) } },
      {
        $group: {
          _id: '$tokenType',
          totalAmount: { $sum: { $abs: '$rawAmount' } },
          count: { $sum: 1 },
        },
      },
    ]);

    return {
      transactions: enrichedTransactions,
      summary: summary.reduce((acc, item) => {
        acc[item._id || 'unknown'] = {
          totalAmount: item.totalAmount,
          count: item.count,
        };
        return acc;
      }, {}),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
      dateRange: {
        startDate: startDate || null,
        endDate: endDate || null,
      },
    };
  } catch (error) {
    logger.error('[Admin UserService] Error getting user transactions:', error);
    throw error;
  }
};

/**
 * Get detailed statistics for a user
 * Optimized with parallel queries for better performance
 */
const getUserStats = async (userId) => {
  try {
    const user = await User.findById(userId)
      .select('-password -totpSecret -backupCodes')
      .lean();

    if (!user) {
      return null;
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Run all queries in parallel for better performance
    const [
      conversationCount,
      messageCount,
      conversationsByEndpoint,
      conversationsByModel,
      tokenAggResult,
      balanceDoc,
      activityTimeline,
      recentConversations,
    ] = await Promise.all([
      // Get conversation count
      Conversation.countDocuments({ user: userId }),
      // Get message count
      Message.countDocuments({ user: userId }),
      // Get conversations by endpoint
      Conversation.aggregate([
        { $match: { user: user._id } },
        { $group: { _id: '$endpoint', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      // Get conversations by model
      Conversation.aggregate([
        { $match: { user: user._id } },
        { $group: { _id: '$model', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]),
      // Get token usage
      Transaction.aggregate([
        { $match: { user: user._id } },
        {
          $group: {
            _id: null,
            totalTokens: { $sum: { $abs: '$rawAmount' } },
            totalCost: { $sum: { $abs: '$tokenValue' } },
            count: { $sum: 1 },
          },
        },
      ]).catch(err => {
        logger.warn('[Admin UserService] Could not fetch token stats:', err.message);
        return [];
      }),
      // Get balance
      Balance.findOne({ user: userId }).lean().catch(err => {
        logger.warn('[Admin UserService] Could not fetch balance:', err.message);
        return null;
      }),
      // Get activity timeline (last 30 days)
      Conversation.aggregate([
        {
          $match: {
            user: user._id,
            createdAt: { $gte: thirtyDaysAgo },
          },
        },
        {
          $addFields: {
            dateStr: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'UTC' } },
          },
        },
        {
          $group: {
            _id: '$dateStr',
            count: { $sum: 1 },
          },
        },
        {
          $sort: { '_id': 1 },
        },
        {
          $project: {
            _id: 0,
            date: { $toDate: '$_id' },
            count: 1,
          },
        },
      ]),
      // Recent conversations
      Conversation.find({ user: userId })
        .sort({ updatedAt: -1 })
        .limit(10)
        .select('conversationId title endpoint model createdAt updatedAt')
        .lean(),
    ]);

    // Process token stats
    const tokenStats = tokenAggResult.length > 0
      ? {
          totalTokens: tokenAggResult[0].totalTokens || 0,
          totalCost: tokenAggResult[0].totalCost || 0,
          transactionCount: tokenAggResult[0].count || 0,
        }
      : { totalTokens: 0, totalCost: 0, transactionCount: 0 };

    const balance = balanceDoc?.tokenCredits || 0;

    return {
      user,
      stats: {
        conversations: conversationCount,
        messages: messageCount,
        balance,
        tokens: tokenStats,
      },
      breakdowns: {
        byEndpoint: conversationsByEndpoint.map(e => ({ 
          endpoint: e._id || 'unknown', 
          count: e.count 
        })),
        byModel: conversationsByModel.map(m => ({ 
          model: m._id || 'unknown', 
          count: m.count 
        })),
      },
      activityTimeline,
      recentConversations,
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    logger.error('[Admin UserService] Error getting user stats:', error);
    throw error;
  }
};

/**
 * Get active sessions with full session data for live monitoring
 * Groups sessions by user - each user appears once with aggregated session data
 * Uses createdAt date to determine logins in the date range
 * @param {string} startDateStr - Start date string (YYYY-MM-DD)
 * @param {string} endDateStr - End date string (YYYY-MM-DD)
 */
const getActiveSessions = async (startDateStr, endDateStr) => {
  try {
    const now = new Date();
    
    // Parse date range - use CST timezone (UTC-6)
    // When user selects "Today" in CST, we need to query from CST midnight to CST end of day
    // CST midnight = 06:00 UTC, CST end of day = 05:59:59 UTC next day
    let startDate, endDate;
    if (typeof startDateStr === 'string' && typeof endDateStr === 'string') {
      // CST is UTC-6, so CST midnight = UTC 06:00
      startDate = new Date(startDateStr + 'T06:00:00.000Z');
      // CST end of day (23:59:59) = next day UTC 05:59:59
      const endDateObj = new Date(endDateStr + 'T00:00:00.000Z');
      endDateObj.setDate(endDateObj.getDate() + 1);
      endDate = new Date(endDateObj.getTime() + (6 * 60 * 60 * 1000) - 1); // 05:59:59.999 UTC next day
    } else {
      // Default to today in CST
      const cstOffset = -6 * 60 * 60 * 1000; // CST offset in ms
      const cstNow = new Date(now.getTime() + cstOffset);
      const todayStr = cstNow.toISOString().split('T')[0];
      startDate = new Date(todayStr + 'T06:00:00.000Z');
      const endDateObj = new Date(todayStr + 'T00:00:00.000Z');
      endDateObj.setDate(endDateObj.getDate() + 1);
      endDate = new Date(endDateObj.getTime() + (6 * 60 * 60 * 1000) - 1);
    }

    // Get sessions created in date range (based on createdAt)
    const groupedUsers = await Session.aggregate([
      // Match sessions created in date range
      { $match: { createdAt: { $gte: startDate, $lte: endDate } } },
      // Group by user to aggregate session data
      {
        $group: {
          _id: '$user',
          sessionCount: { $sum: 1 },
          latestActivity: { $max: '$createdAt' },
          earliestSession: { $min: '$createdAt' },
          // Collect session details for reference
          sessions: {
            $push: {
              sessionId: '$_id',
              createdAt: '$createdAt',
              expiration: '$expiration',
              ipAddress: '$payload.ip',
              userAgent: '$payload.userAgent',
            },
          },
        },
      },
      // Lookup user details
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'userDetails',
        },
      },
      { $unwind: '$userDetails' },
      // Project fields - one entry per user with aggregated data
      {
        $project: {
          sessionId: { $arrayElemAt: ['$sessions.sessionId', 0] }, // Use first session ID for compatibility
          userId: '$_id',
          user: {
            id: '$userDetails._id',
            name: '$userDetails.name',
            email: '$userDetails.email',
            username: '$userDetails.username',
            avatar: '$userDetails.avatar',
            role: '$userDetails.role',
          },
          startTime: '$earliestSession',
          lastActivity: '$latestActivity',
          ipAddress: { $arrayElemAt: ['$sessions.ipAddress', 0] },
          userAgent: { $arrayElemAt: ['$sessions.userAgent', 0] },
          sessionCount: 1,
          isOnline: { $literal: true },
        },
      },
      // Sort by last activity (most recent first)
      { $sort: { lastActivity: -1 } },
    ]);

    // Total number of individual sessions created today
    const totalSessions = groupedUsers.reduce((sum, user) => sum + (user.sessionCount || 0), 0);

    return {
      sessions: groupedUsers,
      summary: {
        totalActiveSessions: totalSessions,
        uniqueActiveUsers: groupedUsers.length,
        averageSessionDuration: 0, // Can calculate if needed
        sessionsToday: totalSessions,
      },
    };
  } catch (error) {
    logger.error('[Admin UserService] Error getting active sessions:', error);
    throw error;
  }
};

/**
 * Clear all sessions from the database
 * Used for admin maintenance
 */
const clearAllSessions = async () => {
  try {
    const result = await Session.deleteMany({});
    logger.info(`[Admin UserService] Cleared ${result.deletedCount} sessions from database`);
    return {
      success: true,
      deletedCount: result.deletedCount,
    };
  } catch (error) {
    logger.error('[Admin UserService] Error clearing all sessions:', error);
    throw error;
  }
};

/**
 * Terminate all sessions for a specific user
 */
const terminateAllUserSessions = async (userId) => {
  try {
    const mongoose = require('mongoose');
    const userObjectId = new mongoose.Types.ObjectId(userId);
    
    const result = await Session.deleteMany({ user: userObjectId });
    logger.info(`[Admin UserService] Terminated ${result.deletedCount} sessions for user ${userId}`);
    
    return {
      success: true,
      deletedCount: result.deletedCount,
    };
  } catch (error) {
    logger.error('[Admin UserService] Error terminating all user sessions:', error);
    throw error;
  }
};

/**
 * Get user's conversations with messages
 */
const getUserConversations = async (userId, { page = 1, limit = 20 } = {}) => {
  try {
    const mongoose = require('mongoose');
    const userObjectId = new mongoose.Types.ObjectId(userId);
    
    // Get total count
    const total = await Conversation.countDocuments({ user: userObjectId });
    
    // Get conversations with pagination
    const conversations = await Conversation.find({ user: userObjectId })
      .sort({ updatedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    // Get messages for each conversation
    const conversationsWithMessages = await Promise.all(
      conversations.map(async (conv) => {
        const messages = await Message.find({ conversationId: conv.conversationId })
          .sort({ createdAt: 1 })
      .select('messageId text content sender isCreatedByUser model createdAt tokenCount error finish_reason')
      .lean();

        // Count errors in this conversation (including content array errors)
        const errorCount = messages.filter(m => {
          if (m.error === true) return true;
          // Also check for error type in content array
          if (m.content && Array.isArray(m.content)) {
            return m.content.some(c => c.type === 'error');
          }
          return false;
        }).length;

        return {
          _id: conv._id,
          conversationId: conv.conversationId,
          title: conv.title || 'Untitled',
          endpoint: conv.endpoint,
          model: conv.model,
          createdAt: conv.createdAt,
          updatedAt: conv.updatedAt,
          messageCount: messages.length,
          errorCount,
          hasErrors: errorCount > 0,
          messages: messages.map(msg => {
            // For AI messages, text may be empty and content stored in 'content' array
            let displayText = msg.text;
            let hasContentError = false;
            let errorMessage = null;
            
            if (msg.content && Array.isArray(msg.content)) {
              // Check for error in content array
              const errorPart = msg.content.find(c => c.type === 'error');
              if (errorPart) {
                hasContentError = true;
                errorMessage = errorPart.error || errorPart[errorPart.type] || 'Unknown error';
              }
              
              // Extract text from content array (structured content format)
              if (!displayText) {
                const textParts = msg.content
                  .filter(c => c.type === 'text' && c.text)
                  .map(c => c.text);
                displayText = textParts.join('\n') || '';
              }

              // Check for tool_use blocks - if message only has tool calls, indicate that
              if (!displayText) {
                const toolUseParts = msg.content.filter(c => c.type === 'tool_use');
                if (toolUseParts.length > 0) {
                  const toolNames = toolUseParts.map(t => t.name || 'tool').join(', ');
                  displayText = `[Using tools: ${toolNames}]`;
                }
              }

              // Check for thinking blocks
              if (!displayText) {
                const thinkingPart = msg.content.find(c => c.type === 'thinking' && c.thinking);
                if (thinkingPart) {
                  displayText = `[Thinking...]\n${thinkingPart.thinking.substring(0, 200)}${thinkingPart.thinking.length > 200 ? '...' : ''}`;
                }
              }
            }
            
            // If there's an error but no display text, show the error message
            if ((msg.error || hasContentError) && !displayText && errorMessage) {
              displayText = errorMessage;
            }
            
            return {
              messageId: msg.messageId,
              text: displayText,
              sender: msg.sender,
              isCreatedByUser: msg.isCreatedByUser,
              model: msg.model,
              createdAt: msg.createdAt,
              tokenCount: msg.tokenCount,
              error: msg.error || hasContentError,
              isError: msg.error === true || hasContentError,
              errorMessage: errorMessage,
            };
          }),
        };
      })
    );

    return {
      conversations: conversationsWithMessages,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    };
  } catch (error) {
    logger.error('[Admin UserService] Error getting user conversations:', error);
    throw error;
  }
};

/**
 * Get Microsoft 365 OAuth sessions
 * Returns users with active MCP OAuth tokens (type: 'mcp_oauth' with identifier containing 'ms365' or 'microsoft')
 * @param {string} startDateStr - Start date string (YYYY-MM-DD)
 * @param {string} endDateStr - End date string (YYYY-MM-DD)
 */
const getMicrosoftSessions = async (startDateStr, endDateStr) => {
  try {
    const now = new Date();

    // Parse date range - use CST timezone (UTC-6)
    let startDate, endDate;
    if (typeof startDateStr === 'string' && typeof endDateStr === 'string') {
      // CST is UTC-6, so CST midnight = UTC 06:00
      startDate = new Date(startDateStr + 'T06:00:00.000Z');
      // CST end of day (23:59:59) = next day UTC 05:59:59
      const endDateObj = new Date(endDateStr + 'T00:00:00.000Z');
      endDateObj.setDate(endDateObj.getDate() + 1);
      endDate = new Date(endDateObj.getTime() + (6 * 60 * 60 * 1000) - 1);
    } else {
      // Default to today in CST
      const cstOffset = -6 * 60 * 60 * 1000;
      const cstNow = new Date(now.getTime() + cstOffset);
      const todayStr = cstNow.toISOString().split('T')[0];
      startDate = new Date(todayStr + 'T06:00:00.000Z');
      const endDateObj = new Date(todayStr + 'T00:00:00.000Z');
      endDateObj.setDate(endDateObj.getDate() + 1);
      endDate = new Date(endDateObj.getTime() + (6 * 60 * 60 * 1000) - 1);
    }

    // Find MCP OAuth tokens for Microsoft 365 in the date range
    const m365Tokens = await Token.aggregate([
      {
        $match: {
          type: 'mcp_oauth',
          // Match MS365/Microsoft MCP server identifiers
          identifier: { $regex: /mcp:(ms365|microsoft|m365)/i },
          // Tokens that expire in date range
          expiresAt: {
            $gte: startDate,
            $lte: endDate
          }
        }
      },
      // Lookup user details
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'userDetails',
        },
      },
      { $unwind: '$userDetails' },
      // Project fields
      {
        $project: {
          tokenId: '$_id',
          userId: '$userId',
          user: {
            id: '$userDetails._id',
            name: '$userDetails.name',
            email: '$userDetails.email',
            username: '$userDetails.username',
            avatar: '$userDetails.avatar',
          },
          serverName: { $arrayElemAt: [{ $split: ['$identifier', ':'] }, 1] },
          createdAt: '$createdAt',
          expiresAt: '$expiresAt',
          isActive: { $literal: true },
        },
      },
      // Sort by most recent expiration (most recently active first)
      { $sort: { expiresAt: -1 } },
    ]);

    // Count unique users
    const uniqueUsers = new Set(m365Tokens.map(t => t.userId?.toString()).filter(Boolean));

    return {
      sessions: m365Tokens || [],
      summary: {
        totalActiveSessions: m365Tokens?.length || 0,
        uniqueConnectedUsers: uniqueUsers.size || 0,
        sessionsToday: uniqueUsers.size || 0,
      },
    };
  } catch (error) {
    logger.error('[Admin UserService] Error getting Microsoft 365 sessions:', error);
    throw error;
  }
};

/**
 * Clear all bans from the system:
 * 1. Remove all entries from ban logs collection
 * 2. Clear ban cache
 * 3. Unban all users in the User collection
 */
const clearAllBans = async () => {
  try {
    // Get all banned users first
    const bannedUsers = await User.find({ banned: true }).select('_id').lean();
    const bannedUserIds = bannedUsers.map(u => u._id.toString());
    
    logger.info(`[Admin UserService] Clearing bans for ${bannedUserIds.length} users`);

    // Get ban logs store
    const banLogs = getLogStores(ViolationTypes.BAN);
    
    // Clear each user's ban from logs
    let clearedCount = 0;
    for (const userId of bannedUserIds) {
      try {
        // Clear from ban logs
        await banLogs.delete(userId);
        
        // Clear from ban cache
        const userKey = isEnabled(process.env.USE_REDIS) ? `ban_cache:user:${userId}` : userId;
        await banCache.delete(userKey);
        
        // Also try direct key
        if (isEnabled(process.env.USE_REDIS)) {
          await banCache.delete(userId);
        }
        
        clearedCount++;
      } catch (error) {
        logger.warn(`[Admin UserService] Could not clear ban for user ${userId}:`, error.message);
      }
    }

    // Also try to clear the entire ban logs store if it has a clear method
    try {
      if (typeof banLogs.clear === 'function') {
        await banLogs.clear();
        logger.info('[Admin UserService] Cleared entire ban logs store');
      }
    } catch (error) {
      logger.warn('[Admin UserService] Could not clear entire ban logs store:', error.message);
    }

    // Also try to clear the entire ban cache if it has a clear method
    try {
      if (typeof banCache.clear === 'function') {
        await banCache.clear();
        logger.info('[Admin UserService] Cleared entire ban cache');
      }
    } catch (error) {
      logger.warn('[Admin UserService] Could not clear entire ban cache:', error.message);
    }

    // Unban all users in the database
    const updateResult = await User.updateMany(
      { banned: true },
      { 
        $set: { 
          banned: false, 
          banReason: '', 
          bannedAt: null 
        } 
      }
    );

    logger.info(`[Admin UserService] Unbanned ${updateResult.modifiedCount} users from database`);

    return {
      success: true,
      clearedFromLogs: clearedCount,
      unbannedUsers: updateResult.modifiedCount,
    };
  } catch (error) {
    logger.error('[Admin UserService] Error clearing all bans:', error);
    throw error;
  }
};

module.exports = {
  listUsers,
  getUserById,
  updateUser,
  updateUserRole,
  updateUserOidcGroups,
  toggleUserBan,
  deleteUser,
  getUserStats,
  getActiveUsers,
  getActiveSessions,
  clearAllSessions,
  terminateAllUserSessions,
  clearAllBans,
  getUserSessions,
  terminateUserSession,
  getUserTransactions,
  getUserConversations,
  getMicrosoftSessions,
};
