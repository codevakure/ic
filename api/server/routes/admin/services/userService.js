/**
 * Admin User Service
 * 
 * Service for user management operations.
 */

const { Keyv } = require('keyv');
const { logger } = require('@ranger/data-schemas');
const { isEnabled, keyvMongo } = require('@ranger/api');
const { ViolationTypes } = require('ranger-data-provider');
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
    const user = await User.findById(userId)
      .select('-password -totpSecret -backupCodes')
      .lean();

    if (!user) {
      return null;
    }

    // Get user's balance
    let balance = null;
    try {
      balance = await Balance.findOne({ user: userId }).lean();
    } catch (error) {
      logger.warn('[Admin UserService] Could not fetch user balance:', error.message);
    }

    // Get conversation count
    const conversationCount = await Conversation.countDocuments({ user: userId });

    // Get message count
    const messageCount = await Message.countDocuments({ user: userId });

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
 * Ban or unban a user
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

    // If banning, also invalidate all sessions
    if (banned && user) {
      try {
        await deleteAllUserSessions(userId);
      } catch (error) {
        logger.warn('[Admin UserService] Could not delete user sessions:', error.message);
      }
    }

    // If unbanning, clear the ban cache and ban logs
    if (!banned && user) {
      try {
        // Clear ban cache (both Redis key format and direct key format)
        const userKey = isEnabled(process.env.USE_REDIS) ? `ban_cache:user:${userId}` : userId;
        await banCache.delete(userKey);
        
        // Also try to delete the raw userId key in case it was stored that way
        if (isEnabled(process.env.USE_REDIS)) {
          await banCache.delete(userId);
        }
        
        // Clear ban logs
        const banLogs = getLogStores(ViolationTypes.BAN);
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
 */
const getUserStats = async (userId) => {
  try {
    const user = await User.findById(userId)
      .select('-password -totpSecret -backupCodes')
      .lean();

    if (!user) {
      return null;
    }

    // Get conversation stats
    const conversationCount = await Conversation.countDocuments({ user: userId });
    const messageCount = await Message.countDocuments({ user: userId });

    // Get conversations by endpoint
    const conversationsByEndpoint = await Conversation.aggregate([
      { $match: { user: user._id } },
      { $group: { _id: '$endpoint', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    // Get conversations by model
    const conversationsByModel = await Conversation.aggregate([
      { $match: { user: user._id } },
      { $group: { _id: '$model', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]);

    // Get token usage
    let tokenStats = {
      totalTokens: 0,
      totalCost: 0,
      transactionCount: 0,
    };

    try {
      const tokenAgg = await Transaction.aggregate([
        { $match: { user: user._id } },
        {
          $group: {
            _id: null,
            totalTokens: { $sum: { $abs: '$rawAmount' } },
            totalCost: { $sum: { $abs: '$tokenValue' } },
            count: { $sum: 1 },
          },
        },
      ]);

      if (tokenAgg.length > 0) {
        tokenStats = {
          totalTokens: tokenAgg[0].totalTokens || 0,
          totalCost: tokenAgg[0].totalCost || 0,
          transactionCount: tokenAgg[0].count || 0,
        };
      }
    } catch (error) {
      logger.warn('[Admin UserService] Could not fetch token stats:', error.message);
    }

    // Get balance
    let balance = 0;
    try {
      const balanceDoc = await Balance.findOne({ user: userId }).lean();
      balance = balanceDoc?.tokenCredits || 0;
    } catch (error) {
      logger.warn('[Admin UserService] Could not fetch balance:', error.message);
    }

    // Get activity timeline (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const activityTimeline = await Conversation.aggregate([
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
    ]);

    // Recent conversations
    const recentConversations = await Conversation.find({ user: userId })
      .sort({ updatedAt: -1 })
      .limit(10)
      .select('conversationId title endpoint model createdAt updatedAt')
      .lean();

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
 * Tracks sessions by created date, not expiry
 */
const getActiveSessions = async () => {
  try {
    const now = new Date();
    // Create start of today date - use ISO string for DocumentDB compatibility
    const startOfToday = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      0, 0, 0, 0
    ));

    // Get all active sessions grouped by user
    const groupedUsers = await Session.aggregate([
      // Only non-expired sessions
      { $match: { expiration: { $gt: now } } },
      // Group by user to aggregate session data
      {
        $group: {
          _id: '$user',
          sessionCount: { $sum: 1 },
          latestActivity: { $max: '$expiration' },
          earliestSession: { $min: '$createdAt' },
          // Count sessions created today - ONLY count if createdAt exists and is today
          // Sessions without createdAt are legacy and not counted in "today"
          sessionsCreatedToday: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $ne: ['$createdAt', null] },
                    { $gte: ['$createdAt', startOfToday] }
                  ]
                },
                1,
                0
              ]
            }
          },
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
          sessionsCreatedToday: 1,
          isOnline: { $literal: true },
        },
      },
      // Sort by last activity (most recent first)
      { $sort: { lastActivity: -1 } },
    ]);

    // Total number of individual sessions (for stats)
    const totalSessions = groupedUsers.reduce((sum, user) => sum + (user.sessionCount || 0), 0);
    // Total sessions created today - only count sessions that have createdAt field set
    const sessionsToday = groupedUsers.reduce((sum, user) => sum + (user.sessionsCreatedToday || 0), 0);

    return {
      sessions: groupedUsers,
      summary: {
        totalActiveSessions: totalSessions,
        uniqueActiveUsers: groupedUsers.length,
        averageSessionDuration: 0, // Can calculate if needed
        sessionsToday: sessionsToday,
      },
    };
  } catch (error) {
    logger.error('[Admin UserService] Error getting active sessions:', error);
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
 */
const getMicrosoftSessions = async () => {
  try {
    const now = new Date();

    // Find all active MCP OAuth tokens for Microsoft 365
    const m365Tokens = await Token.aggregate([
      {
        $match: {
          type: 'mcp_oauth',
          expiresAt: { $gt: now },
          // Match MS365/Microsoft MCP server identifiers
          identifier: { $regex: /mcp:(ms365|microsoft|m365)/i }
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
      // Sort by most recent first
      { $sort: { createdAt: -1 } },
    ]);

    // Get count of tokens created today - use UTC for DocumentDB compatibility
    const startOfToday = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      0, 0, 0, 0
    ));
    
    const tokensCreatedToday = m365Tokens.filter(t => {
      if (!t.createdAt) return false;
      const tokenDate = new Date(t.createdAt);
      return !isNaN(tokenDate.getTime()) && tokenDate >= startOfToday;
    }).length;

    // Group by user for unique user count
    const uniqueUsers = new Set(m365Tokens.map(t => t.userId?.toString()).filter(Boolean));

    return {
      sessions: m365Tokens || [],
      summary: {
        totalActiveSessions: m365Tokens?.length || 0,
        uniqueConnectedUsers: uniqueUsers.size || 0,
        sessionsToday: tokensCreatedToday || 0,
      },
    };
  } catch (error) {
    logger.error('[Admin UserService] Error getting Microsoft 365 sessions:', error);
    throw error;
  }
};

module.exports = {
  listUsers,
  getUserById,
  updateUser,
  updateUserRole,
  toggleUserBan,
  deleteUser,
  getUserStats,
  getActiveUsers,
  getActiveSessions,
  getUserSessions,
  terminateUserSession,
  getUserTransactions,
  getUserConversations,
  getMicrosoftSessions,
};
