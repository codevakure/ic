/**
 * Admin Service
 * 
 * Core service for admin dashboard metrics and analytics.
 * Provides comprehensive metrics at every level.
 */

const { logger } = require('@librechat/data-schemas');
const {
  User,
  Conversation,
  Message,
  Transaction,
  Balance,
  Agent,
  Session,
  File,
} = require('~/db/models');

/**
 * Model pricing per MILLION tokens (AWS Bedrock pricing)
 * These are the actual models used in the Intent Analyzer
 */
const MODEL_PRICING = {
  'us.amazon.nova-micro-v1:0': { 
    name: 'Amazon Nova Micro',
    input: 0.035, 
    output: 0.14 
  },
  'global.amazon.nova-2-lite-v1:0': { 
    name: 'Amazon Nova Lite',
    input: 0.06, 
    output: 0.24 
  },
  'us.anthropic.claude-haiku-4-5-20251001-v1:0': { 
    name: 'Claude Haiku 4.5',
    input: 1.0, 
    output: 5.0 
  },
  'us.anthropic.claude-sonnet-4-5-20250929-v1:0': { 
    name: 'Claude Sonnet 4.5',
    input: 3.0, 
    output: 15.0 
  },
  'global.anthropic.claude-opus-4-5-20251101-v1:0': { 
    name: 'Claude Opus 4.5',
    input: 5.0, 
    output: 25.0 
  },
};

/**
 * Calculate cost for tokens based on model pricing
 * @param {string} model - Model ID
 * @param {string} tokenType - 'prompt' or 'completion'
 * @param {number} tokens - Number of tokens (absolute value)
 * @returns {number} Cost in dollars
 */
const calculateCost = (model, tokenType, tokens) => {
  const pricing = MODEL_PRICING[model];
  if (!pricing) {
    // For agents or unknown models, use a default pricing
    return (tokens / 1000000) * 1.0; // Default $1 per million
  }
  const rate = tokenType === 'prompt' ? pricing.input : pricing.output;
  return (Math.abs(tokens) / 1000000) * rate;
};

/**
 * Parse period string to date range
 * @param {string} period - Period string (e.g., '7d', '30d', '90d', '1y')
 * @returns {{ startDate: Date, endDate: Date }}
 */
const parsePeriod = (period) => {
  const endDate = new Date();
  const startDate = new Date();
  
  const match = period.match(/^(\d+)([dDwWmMyY])$/);
  if (!match) {
    // Default to 30 days
    startDate.setDate(startDate.getDate() - 30);
    return { startDate, endDate };
  }

  const value = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();

  switch (unit) {
    case 'd':
      startDate.setDate(startDate.getDate() - value);
      break;
    case 'w':
      startDate.setDate(startDate.getDate() - (value * 7));
      break;
    case 'm':
      startDate.setMonth(startDate.getMonth() - value);
      break;
    case 'y':
      startDate.setFullYear(startDate.getFullYear() - value);
      break;
    default:
      startDate.setDate(startDate.getDate() - 30);
  }

  return { startDate, endDate };
};

/**
 * Get high-level overview metrics
 * @param {string} startDateStr - Start date string (ISO format)
 * @param {string} endDateStr - End date string (ISO format)
 */
const getOverviewMetrics = async (startDateStr, endDateStr) => {
  try {
    const now = new Date();
    
    // Parse date range or default to current month
    let startDate, endDate;
    if (startDateStr && endDateStr) {
      startDate = new Date(startDateStr);
      endDate = new Date(endDateStr);
      endDate.setHours(23, 59, 59, 999);
    } else {
      // Default to current month
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = now;
    }
    
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thisWeek = new Date(today);
    thisWeek.setDate(thisWeek.getDate() - 7);
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // User counts
    const [
      totalUsers,
      usersToday,
      usersThisWeek,
      usersThisMonth,
      activeUsersToday,
      activeUsersThisWeek,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ createdAt: { $gte: today } }),
      User.countDocuments({ createdAt: { $gte: thisWeek } }),
      User.countDocuments({ createdAt: { $gte: thisMonth } }),
      User.countDocuments({ updatedAt: { $gte: today } }),
      User.countDocuments({ updatedAt: { $gte: thisWeek } }),
    ]);

    // Conversation counts
    const [
      totalConversations,
      conversationsToday,
      conversationsThisWeek,
      conversationsThisMonth,
    ] = await Promise.all([
      Conversation.countDocuments(),
      Conversation.countDocuments({ createdAt: { $gte: today } }),
      Conversation.countDocuments({ createdAt: { $gte: thisWeek } }),
      Conversation.countDocuments({ createdAt: { $gte: thisMonth } }),
    ]);

    // Message counts
    const [
      totalMessages,
      messagesToday,
      messagesThisWeek,
    ] = await Promise.all([
      Message.countDocuments(),
      Message.countDocuments({ createdAt: { $gte: today } }),
      Message.countDocuments({ createdAt: { $gte: thisWeek } }),
    ]);

    // Token usage from transactions with accurate cost calculation
    let tokenUsageToday = 0;
    let tokenUsageThisWeek = 0;
    let tokenUsageThisMonth = 0;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalCost = 0;

    try {
      const [todayTokens, weekTokens, monthTokens, tokensByType] = await Promise.all([
        Transaction.aggregate([
          { $match: { createdAt: { $gte: today } } },
          { $group: { _id: null, total: { $sum: { $abs: '$rawAmount' } } } },
        ]),
        Transaction.aggregate([
          { $match: { createdAt: { $gte: thisWeek } } },
          { $group: { _id: null, total: { $sum: { $abs: '$rawAmount' } } } },
        ]),
        Transaction.aggregate([
          { $match: { createdAt: { $gte: thisMonth } } },
          { $group: { _id: null, total: { $sum: { $abs: '$rawAmount' } } } },
        ]),
        // Get tokens grouped by model and type for accurate cost calculation
        Transaction.aggregate([
          {
            $group: {
              _id: { model: '$model', tokenType: '$tokenType' },
              tokens: { $sum: { $abs: '$rawAmount' } },
            },
          },
        ]),
      ]);

      tokenUsageToday = todayTokens[0]?.total || 0;
      tokenUsageThisWeek = weekTokens[0]?.total || 0;
      tokenUsageThisMonth = monthTokens[0]?.total || 0;

      // Calculate accurate costs and token totals
      tokensByType.forEach(item => {
        const tokens = item.tokens;
        const modelId = item._id.model;
        const tokenType = item._id.tokenType;
        
        if (tokenType === 'prompt') {
          totalInputTokens += tokens;
        } else if (tokenType === 'completion') {
          totalOutputTokens += tokens;
        }
        totalCost += calculateCost(modelId, tokenType, tokens);
      });
    } catch (error) {
      logger.warn('[Admin] Could not fetch token metrics:', error.message);
    }

    // Agent counts
    let totalAgents = 0;
    try {
      totalAgents = await Agent.countDocuments();
    } catch (error) {
      logger.warn('[Admin] Could not fetch agent count:', error.message);
    }

    // Active sessions count
    let activeSessions = 0;
    try {
      activeSessions = await Session.countDocuments({
        expiration: { $gt: new Date() },
      });
    } catch (error) {
      logger.warn('[Admin] Could not fetch active sessions:', error.message);
    }

    // Total files count
    let totalFiles = 0;
    try {
      totalFiles = await File.countDocuments();
    } catch (error) {
      logger.warn('[Admin] Could not fetch file count:', error.message);
    }

    return {
      users: {
        total: totalUsers,
        today: usersToday,
        thisWeek: usersThisWeek,
        thisMonth: usersThisMonth,
        activeToday: activeUsersToday,
        activeThisWeek: activeUsersThisWeek,
      },
      conversations: {
        total: totalConversations,
        today: conversationsToday,
        thisWeek: conversationsThisWeek,
        thisMonth: conversationsThisMonth,
      },
      messages: {
        total: totalMessages,
        today: messagesToday,
        thisWeek: messagesThisWeek,
      },
      tokens: {
        today: Math.abs(tokenUsageToday),
        thisWeek: Math.abs(tokenUsageThisWeek),
        thisMonth: Math.abs(tokenUsageThisMonth),
        input: Math.abs(totalInputTokens),
        output: Math.abs(totalOutputTokens),
        totalCost: parseFloat(totalCost.toFixed(4)),
      },
      agents: {
        total: totalAgents,
      },
      activeSessions,
      totalFiles,
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    logger.error('[Admin] Error in getOverviewMetrics:', error);
    throw error;
  }
};

/**
 * Get detailed user metrics with trends
 * @param {string} startDateStr - Start date string (ISO format)
 * @param {string} endDateStr - End date string (ISO format)
 */
const getUserMetrics = async (startDateStr, endDateStr) => {
  try {
    // Parse date range or default to current month
    let startDate, endDate;
    const now = new Date();
    if (startDateStr && endDateStr) {
      startDate = new Date(startDateStr);
      endDate = new Date(endDateStr);
      endDate.setHours(23, 59, 59, 999);
    } else {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = now;
    }

    // User growth over time (daily aggregation)
    const userGrowth = await User.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' },
          },
          count: { $sum: 1 },
        },
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 },
      },
      {
        $project: {
          _id: 0,
          date: {
            $dateFromParts: {
              year: '$_id.year',
              month: '$_id.month',
              day: '$_id.day',
            },
          },
          count: 1,
        },
      },
    ]);

    // Users by role
    const usersByRole = await User.aggregate([
      {
        $group: {
          _id: '$role',
          count: { $sum: 1 },
        },
      },
    ]);

    // Users by provider (registration method)
    const usersByProvider = await User.aggregate([
      {
        $group: {
          _id: '$provider',
          count: { $sum: 1 },
        },
      },
    ]);

    // Active users trend
    const activeUsersTrend = await User.aggregate([
      {
        $match: {
          updatedAt: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: '$updatedAt' },
            month: { $month: '$updatedAt' },
            day: { $dayOfMonth: '$updatedAt' },
          },
          count: { $sum: 1 },
        },
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 },
      },
      {
        $project: {
          _id: 0,
          date: {
            $dateFromParts: {
              year: '$_id.year',
              month: '$_id.month',
              day: '$_id.day',
            },
          },
          count: 1,
        },
      },
    ]);

    // Total and period counts
    const totalUsers = await User.countDocuments();
    const periodUsers = await User.countDocuments({
      createdAt: { $gte: startDate, $lte: endDate },
    });

    return {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      summary: {
        total: totalUsers,
        newInPeriod: periodUsers,
      },
      growth: userGrowth,
      byRole: usersByRole.map(r => ({ role: r._id || 'user', count: r.count })),
      byProvider: usersByProvider.map(p => ({ provider: p._id || 'local', count: p.count })),
      activeUsersTrend,
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    logger.error('[Admin] Error in getUserMetrics:', error);
    throw error;
  }
};

/**
 * Get conversation metrics with trends
 * @param {string} startDateStr - Start date string (ISO format)
 * @param {string} endDateStr - End date string (ISO format)
 */
const getConversationMetrics = async (startDateStr, endDateStr) => {
  try {
    // Parse date range or default to current month
    let startDate, endDate;
    const now = new Date();
    if (startDateStr && endDateStr) {
      startDate = new Date(startDateStr);
      endDate = new Date(endDateStr);
      endDate.setHours(23, 59, 59, 999);
    } else {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = now;
    }

    // Conversations over time
    const conversationTrend = await Conversation.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' },
          },
          count: { $sum: 1 },
        },
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 },
      },
      {
        $project: {
          _id: 0,
          date: {
            $dateFromParts: {
              year: '$_id.year',
              month: '$_id.month',
              day: '$_id.day',
            },
          },
          count: 1,
        },
      },
    ]);

    // Conversations by endpoint
    const byEndpoint = await Conversation.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: '$endpoint',
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ]);

    // Conversations by model
    const byModel = await Conversation.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: '$model',
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 20 },
    ]);

    // Average messages per conversation
    const avgMessages = await Message.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: '$conversationId',
          messageCount: { $sum: 1 },
        },
      },
      {
        $group: {
          _id: null,
          avgMessages: { $avg: '$messageCount' },
          maxMessages: { $max: '$messageCount' },
          minMessages: { $min: '$messageCount' },
        },
      },
    ]);

    // Total counts
    const totalConversations = await Conversation.countDocuments();
    const periodConversations = await Conversation.countDocuments({
      createdAt: { $gte: startDate, $lte: endDate },
    });

    return {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      summary: {
        total: totalConversations,
        newInPeriod: periodConversations,
        avgMessagesPerConversation: avgMessages[0]?.avgMessages?.toFixed(2) || 0,
        maxMessagesInConversation: avgMessages[0]?.maxMessages || 0,
      },
      trend: conversationTrend,
      byEndpoint: byEndpoint.map(e => ({ endpoint: e._id || 'unknown', count: e.count })),
      byModel: byModel.map(m => ({ model: m._id || 'unknown', count: m.count })),
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    logger.error('[Admin] Error in getConversationMetrics:', error);
    throw error;
  }
};

/**
 * Get token usage metrics with ACCURATE cost calculation
 * @param {string} startDateStr - Start date string (ISO format)
 * @param {string} endDateStr - End date string (ISO format)
 */
const getTokenMetrics = async (startDateStr, endDateStr) => {
  try {
    // Parse date range or default to current month
    let startDate, endDate;
    const now = new Date();
    if (startDateStr && endDateStr) {
      startDate = new Date(startDateStr);
      endDate = new Date(endDateStr);
      endDate.setHours(23, 59, 59, 999);
    } else {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = now;
    }

    // Get detailed model breakdown with accurate cost calculation
    const modelBreakdown = await Transaction.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: { model: '$model', tokenType: '$tokenType' },
          tokens: { $sum: { $abs: '$rawAmount' } },
          count: { $sum: 1 },
        },
      },
    ]);

    // Process model breakdown and calculate accurate costs
    const modelMap = {};
    modelBreakdown.forEach(item => {
      const modelId = item._id.model || 'unknown';
      const tokenType = item._id.tokenType; // 'prompt' or 'completion'
      
      if (!modelMap[modelId]) {
        const pricing = MODEL_PRICING[modelId] || { name: modelId, input: 1.0, output: 5.0 };
        modelMap[modelId] = {
          model: modelId,
          name: pricing.name,
          inputTokens: 0,
          outputTokens: 0,
          inputCost: 0,
          outputCost: 0,
          totalCost: 0,
          transactions: 0,
        };
      }
      
      const pricing = MODEL_PRICING[modelId] || { input: 1.0, output: 5.0 };
      const tokens = item.tokens;
      
      if (tokenType === 'prompt') {
        modelMap[modelId].inputTokens += tokens;
        modelMap[modelId].inputCost += calculateCost(modelId, 'prompt', tokens);
      } else if (tokenType === 'completion') {
        modelMap[modelId].outputTokens += tokens;
        modelMap[modelId].outputCost += calculateCost(modelId, 'completion', tokens);
      }
      modelMap[modelId].transactions += item.count;
    });

    // Calculate total costs and finalize
    const byModel = Object.values(modelMap).map(m => ({
      ...m,
      totalCost: m.inputCost + m.outputCost,
      totalTokens: m.inputTokens + m.outputTokens,
    })).sort((a, b) => b.totalCost - a.totalCost);

    // Token usage over time with accurate costs
    const tokenTrend = await Transaction.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' },
          },
          inputTokens: { 
            $sum: { 
              $cond: [{ $eq: ['$tokenType', 'prompt'] }, { $abs: '$rawAmount' }, 0] 
            } 
          },
          outputTokens: { 
            $sum: { 
              $cond: [{ $eq: ['$tokenType', 'completion'] }, { $abs: '$rawAmount' }, 0] 
            } 
          },
          count: { $sum: 1 },
        },
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 },
      },
      {
        $project: {
          _id: 0,
          date: {
            $dateFromParts: {
              year: '$_id.year',
              month: '$_id.month',
              day: '$_id.day',
            },
          },
          inputTokens: 1,
          outputTokens: 1,
          transactions: '$count',
        },
      },
    ]);

    // Top token users with accurate costs
    const topUsersRaw = await Transaction.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: { user: '$user', model: '$model', tokenType: '$tokenType' },
          tokens: { $sum: { $abs: '$rawAmount' } },
          count: { $sum: 1 },
        },
      },
    ]);

    // Aggregate by user with accurate cost calculation
    const userMap = {};
    topUsersRaw.forEach(item => {
      const userId = item._id.user?.toString() || 'unknown';
      const modelId = item._id.model || 'unknown';
      const tokenType = item._id.tokenType;
      
      if (!userMap[userId]) {
        userMap[userId] = {
          userId,
          inputTokens: 0,
          outputTokens: 0,
          totalCost: 0,
          transactions: 0,
        };
      }
      
      const tokens = item.tokens;
      if (tokenType === 'prompt') {
        userMap[userId].inputTokens += tokens;
        userMap[userId].totalCost += calculateCost(modelId, 'prompt', tokens);
      } else if (tokenType === 'completion') {
        userMap[userId].outputTokens += tokens;
        userMap[userId].totalCost += calculateCost(modelId, 'completion', tokens);
      }
      userMap[userId].transactions += item.count;
    });

    // Get user details
    const userIds = Object.keys(userMap).filter(id => id !== 'unknown');
    const users = await User.find({ _id: { $in: userIds } }, 'email name').lean();
    const userLookup = {};
    users.forEach(u => { userLookup[u._id.toString()] = u; });

    const topUsers = Object.values(userMap)
      .map(u => ({
        ...u,
        totalTokens: u.inputTokens + u.outputTokens,
        email: userLookup[u.userId]?.email,
        name: userLookup[u.userId]?.name,
      }))
      .sort((a, b) => b.totalCost - a.totalCost)
      .slice(0, 10);

    // Calculate period totals
    const totalInputTokens = byModel.reduce((sum, m) => sum + m.inputTokens, 0);
    const totalOutputTokens = byModel.reduce((sum, m) => sum + m.outputTokens, 0);
    const totalCost = byModel.reduce((sum, m) => sum + m.totalCost, 0);
    const totalTransactions = byModel.reduce((sum, m) => sum + m.transactions, 0);

    return {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      summary: {
        totalInputTokens,
        totalOutputTokens,
        totalTokens: totalInputTokens + totalOutputTokens,
        totalCost: parseFloat(totalCost.toFixed(6)),
        totalTransactions,
      },
      trend: tokenTrend,
      byModel,
      topUsers,
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    logger.error('[Admin] Error in getTokenMetrics:', error);
    throw error;
  }
};

/**
 * Get model usage metrics with accurate cost calculation
 * @param {string} startDateStr - Start date string (ISO format)
 * @param {string} endDateStr - End date string (ISO format)
 */
const getModelMetrics = async (startDateStr, endDateStr) => {
  try {
    // Parse date range or default to current month
    let startDate, endDate;
    const now = new Date();
    if (startDateStr && endDateStr) {
      startDate = new Date(startDateStr);
      endDate = new Date(endDateStr);
      endDate.setHours(23, 59, 59, 999);
    } else {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = now;
    }

    // Get model usage from transactions with accurate cost calculation
    const modelUsageRaw = await Transaction.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: { model: '$model', tokenType: '$tokenType' },
          tokens: { $sum: { $abs: '$rawAmount' } },
          count: { $sum: 1 },
          users: { $addToSet: '$user' },
        },
      },
    ]);

    // Process and calculate accurate costs
    const modelMap = {};
    modelUsageRaw.forEach(item => {
      const modelId = item._id.model || 'unknown';
      const tokenType = item._id.tokenType;
      
      if (!modelMap[modelId]) {
        const pricing = MODEL_PRICING[modelId] || { name: modelId, input: 1.0, output: 5.0 };
        modelMap[modelId] = {
          model: modelId,
          name: pricing.name,
          inputTokens: 0,
          outputTokens: 0,
          inputCost: 0,
          outputCost: 0,
          transactions: 0,
          users: new Set(),
        };
      }
      
      const tokens = item.tokens;
      if (tokenType === 'prompt') {
        modelMap[modelId].inputTokens += tokens;
        modelMap[modelId].inputCost += calculateCost(modelId, 'prompt', tokens);
      } else if (tokenType === 'completion') {
        modelMap[modelId].outputTokens += tokens;
        modelMap[modelId].outputCost += calculateCost(modelId, 'completion', tokens);
      }
      modelMap[modelId].transactions += item.count;
      item.users.forEach(u => modelMap[modelId].users.add(u?.toString()));
    });

    const usage = Object.values(modelMap).map(m => ({
      model: m.model,
      name: m.name,
      inputTokens: m.inputTokens,
      outputTokens: m.outputTokens,
      totalTokens: m.inputTokens + m.outputTokens,
      inputCost: parseFloat(m.inputCost.toFixed(6)),
      outputCost: parseFloat(m.outputCost.toFixed(6)),
      totalCost: parseFloat((m.inputCost + m.outputCost).toFixed(6)),
      transactions: m.transactions,
      userCount: m.users.size,
    })).sort((a, b) => b.totalCost - a.totalCost);

    // Model trend over time (top 5 models by cost)
    const topModelIds = usage.slice(0, 5).map(m => m.model);
    
    const modelTrend = await Transaction.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
          model: { $in: topModelIds },
        },
      },
      {
        $group: {
          _id: {
            model: '$model',
            tokenType: '$tokenType',
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' },
          },
          tokens: { $sum: { $abs: '$rawAmount' } },
        },
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 },
      },
    ]);

    // Process trend data
    const trendMap = {};
    modelTrend.forEach(item => {
      const modelId = item._id.model;
      const dateKey = `${item._id.year}-${String(item._id.month).padStart(2, '0')}-${String(item._id.day).padStart(2, '0')}`;
      
      if (!trendMap[modelId]) {
        trendMap[modelId] = {};
      }
      if (!trendMap[modelId][dateKey]) {
        trendMap[modelId][dateKey] = { inputTokens: 0, outputTokens: 0 };
      }
      
      if (item._id.tokenType === 'prompt') {
        trendMap[modelId][dateKey].inputTokens += item.tokens;
      } else {
        trendMap[modelId][dateKey].outputTokens += item.tokens;
      }
    });

    const trends = Object.entries(trendMap).map(([model, dates]) => ({
      model,
      name: MODEL_PRICING[model]?.name || model,
      data: Object.entries(dates).map(([date, tokens]) => ({
        date,
        inputTokens: tokens.inputTokens,
        outputTokens: tokens.outputTokens,
        totalTokens: tokens.inputTokens + tokens.outputTokens,
      })).sort((a, b) => a.date.localeCompare(b.date)),
    }));

    return {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      usage,
      topModels: usage.slice(0, 5).map(m => ({ 
        model: m.model, 
        name: m.name, 
        totalCost: m.totalCost 
      })),
      trends,
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    logger.error('[Admin] Error in getModelMetrics:', error);
    throw error;
  }
};

/**
 * Get agent usage metrics with accurate cost calculation
 * @param {string} startDateStr - Start date string (ISO format)
 * @param {string} endDateStr - End date string (ISO format)
 */
const getAgentMetrics = async (startDateStr, endDateStr) => {
  try {
    // Parse date range or default to current month
    let startDate, endDate;
    const now = new Date();
    if (startDateStr && endDateStr) {
      startDate = new Date(startDateStr);
      endDate = new Date(endDateStr);
      endDate.setHours(23, 59, 59, 999);
    } else {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = now;
    }

    let totalAgents = 0;
    let publicAgents = 0;
    let privateAgents = 0;
    let agentUsage = [];

    try {
      // Total agents
      totalAgents = await Agent.countDocuments();
      
      // Public vs private agents
      publicAgents = await Agent.countDocuments({ isPublic: true });
      privateAgents = totalAgents - publicAgents;

      // Get agent usage from transactions (agents have model starting with 'agent_')
      const agentTransactions = await Transaction.aggregate([
        {
          $match: {
            createdAt: { $gte: startDate, $lte: endDate },
            model: { $regex: /^agent_/ },
          },
        },
        {
          $group: {
            _id: { model: '$model', tokenType: '$tokenType' },
            tokens: { $sum: { $abs: '$rawAmount' } },
            count: { $sum: 1 },
            users: { $addToSet: '$user' },
          },
        },
      ]);

      // Process agent usage
      const agentMap = {};
      agentTransactions.forEach(item => {
        const agentId = item._id.model;
        const tokenType = item._id.tokenType;
        
        if (!agentMap[agentId]) {
          agentMap[agentId] = {
            agentId,
            inputTokens: 0,
            outputTokens: 0,
            inputCost: 0,
            outputCost: 0,
            transactions: 0,
            users: new Set(),
          };
        }
        
        const tokens = item.tokens;
        // Agents use similar pricing to sonnet by default
        if (tokenType === 'prompt') {
          agentMap[agentId].inputTokens += tokens;
          agentMap[agentId].inputCost += (tokens / 1000000) * 3.0;
        } else if (tokenType === 'completion') {
          agentMap[agentId].outputTokens += tokens;
          agentMap[agentId].outputCost += (tokens / 1000000) * 15.0;
        }
        agentMap[agentId].transactions += item.count;
        item.users.forEach(u => agentMap[agentId].users.add(u?.toString()));
      });

      // Get agent details from database
      const agentIds = Object.keys(agentMap);
      const agents = await Agent.find({ id: { $in: agentIds } }).lean();
      const agentLookup = {};
      agents.forEach(a => { agentLookup[a.id] = a; });

      agentUsage = Object.values(agentMap).map(a => ({
        agentId: a.agentId,
        name: agentLookup[a.agentId]?.name || a.agentId,
        description: agentLookup[a.agentId]?.description,
        inputTokens: a.inputTokens,
        outputTokens: a.outputTokens,
        totalTokens: a.inputTokens + a.outputTokens,
        inputCost: parseFloat(a.inputCost.toFixed(6)),
        outputCost: parseFloat(a.outputCost.toFixed(6)),
        totalCost: parseFloat((a.inputCost + a.outputCost).toFixed(6)),
        transactions: a.transactions,
        userCount: a.users.size,
      })).sort((a, b) => b.totalCost - a.totalCost);

      // Also get agents from conversations
      const conversationAgents = await Conversation.aggregate([
        {
          $match: {
            createdAt: { $gte: startDate, $lte: endDate },
            agentId: { $exists: true, $ne: null },
          },
        },
        {
          $group: {
            _id: '$agentId',
            conversationCount: { $sum: 1 },
            uniqueUsers: { $addToSet: '$user' },
          },
        },
        {
          $lookup: {
            from: 'agents',
            localField: '_id',
            foreignField: 'id',
            as: 'agentInfo',
          },
        },
        {
          $project: {
            _id: 0,
            agentId: '$_id',
            name: { $arrayElemAt: ['$agentInfo.name', 0] },
            conversationCount: 1,
            userCount: { $size: '$uniqueUsers' },
          },
        },
        { $sort: { conversationCount: -1 } },
      ]);

      // Merge conversation data with token data
      conversationAgents.forEach(ca => {
        const existing = agentUsage.find(a => a.agentId === ca.agentId);
        if (existing) {
          existing.conversationCount = ca.conversationCount;
        } else {
          agentUsage.push({
            agentId: ca.agentId,
            name: ca.name || ca.agentId,
            inputTokens: 0,
            outputTokens: 0,
            totalTokens: 0,
            totalCost: 0,
            conversationCount: ca.conversationCount,
            userCount: ca.userCount,
          });
        }
      });

    } catch (error) {
      logger.warn('[Admin] Could not fetch agent metrics:', error.message);
    }

    return {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      summary: {
        total: totalAgents,
        public: publicAgents,
        private: privateAgents,
      },
      agents: agentUsage,
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    logger.error('[Admin] Error in getAgentMetrics:', error);
    throw error;
  }
};

/**
 * Get activity timeline
 */
const getActivityTimeline = async (limit = 50, offset = 0) => {
  try {
    // Get recent conversations as activity
    const recentConversations = await Conversation.find()
      .sort({ updatedAt: -1 })
      .skip(offset)
      .limit(limit)
      .select('conversationId title user endpoint model createdAt updatedAt')
      .populate('user', 'name email username')
      .lean();

    const activities = recentConversations.map(conv => ({
      type: 'conversation',
      id: conv.conversationId,
      title: conv.title || 'Untitled Conversation',
      user: {
        id: conv.user?._id,
        name: conv.user?.name || conv.user?.username || 'Unknown',
        email: conv.user?.email,
      },
      endpoint: conv.endpoint,
      model: conv.model,
      createdAt: conv.createdAt,
      updatedAt: conv.updatedAt,
    }));

    const total = await Conversation.countDocuments();

    return {
      activities,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    logger.error('[Admin] Error in getActivityTimeline:', error);
    throw error;
  }
};

/**
 * Get hourly activity metrics for the last 24 hours
 * Returns session/conversation activity grouped by hour
 * @param {string} timezone - Timezone for hour grouping (default: America/Chicago for CST)
 */
const getHourlyActivity = async (timezone = 'America/Chicago') => {
  try {
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    logger.info(`[Admin] Getting hourly activity from ${twentyFourHoursAgo.toISOString()} to ${now.toISOString()}`);

    // Get conversations created in last 24 hours grouped by hour
    const conversationsByHour = await Conversation.aggregate([
      {
        $match: {
          createdAt: { $gte: twentyFourHoursAgo },
        },
      },
      {
        $group: {
          _id: {
            $hour: { 
              date: '$createdAt',
              timezone: timezone,
            },
          },
          conversations: { $sum: 1 },
          uniqueUsers: { $addToSet: '$user' },
        },
      },
      {
        $project: {
          _id: 1,
          hour: '$_id',
          conversations: 1,
          activeUsers: { $size: '$uniqueUsers' },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    logger.info(`[Admin] Found ${conversationsByHour.length} hours with conversations`);

    // Get messages created in last 24 hours grouped by hour
    const messagesByHour = await Message.aggregate([
      {
        $match: {
          createdAt: { $gte: twentyFourHoursAgo },
        },
      },
      {
        $group: {
          _id: {
            $hour: { 
              date: '$createdAt',
              timezone: timezone,
            },
          },
          messages: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    logger.info(`[Admin] Found ${messagesByHour.length} hours with messages`);

    // Get active sessions count - sessions that were created or updated in last 24 hours
    let sessionsByHour = [];
    try {
      // Try to get sessions that are currently active or were active in last 24 hours
      const sessionCount = await Session.countDocuments({
        expiration: { $gte: now },
      });
      
      // Get sessions grouped by the hour they expire
      sessionsByHour = await Session.aggregate([
        {
          $match: {
            $or: [
              { expiration: { $gte: now } }, // Currently active
              { expiration: { $gte: twentyFourHoursAgo, $lt: now } }, // Expired in last 24h
            ],
          },
        },
        {
          $group: {
            _id: {
              $hour: { 
                date: '$expiration',
                timezone: timezone,
              },
            },
            sessions: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]);
      
      logger.info(`[Admin] Found ${sessionCount} active sessions, ${sessionsByHour.length} hours with session data`);
    } catch (error) {
      logger.warn('[Admin] Could not aggregate session data:', error.message);
    }

    // Create a map for each hour (0-23) starting from 24 hours ago
    const hourlyData = [];
    
    for (let i = 0; i < 24; i++) {
      // Calculate hour label (12AM, 1AM, ... 11PM format)
      const hourLabel = i % 12 || 12;
      const period = i < 12 ? 'AM' : 'PM';
      
      const convData = conversationsByHour.find(c => c._id === i);
      const msgData = messagesByHour.find(m => m._id === i);
      const sessData = sessionsByHour.find(s => s._id === i);
      
      hourlyData.push({
        hour: i,
        label: `${hourLabel}${period}`,
        conversations: convData?.conversations || 0,
        messages: msgData?.messages || 0,
        sessions: sessData?.sessions || 0,
        activeUsers: convData?.activeUsers || 0,
      });
    }

    // Calculate totals
    const totals = hourlyData.reduce((acc, h) => ({
      conversations: acc.conversations + h.conversations,
      messages: acc.messages + h.messages,
      sessions: acc.sessions + h.sessions,
      peakActiveUsers: Math.max(acc.peakActiveUsers, h.activeUsers),
    }), { conversations: 0, messages: 0, sessions: 0, peakActiveUsers: 0 });

    logger.info(`[Admin] Hourly activity totals: ${JSON.stringify(totals)}`);

    return {
      timezone,
      hourlyData,
      totals,
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    logger.error('[Admin] Error in getHourlyActivity:', error);
    throw error;
  }
};

/**
 * Get comprehensive usage metrics with date filtering
 * @param {Date} startDate - Start date for filtering
 * @param {Date} endDate - End date for filtering
 */
const getUsageMetrics = async (startDate, endDate) => {
  try {
    const dateFilter = {};
    if (startDate) dateFilter.$gte = new Date(startDate);
    if (endDate) dateFilter.$lte = new Date(endDate);
    
    const matchStage = Object.keys(dateFilter).length > 0 
      ? { createdAt: dateFilter } 
      : {};

    // Get usage by model with accurate cost calculation
    const modelUsage = await Transaction.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: { model: '$model', tokenType: '$tokenType' },
          totalTokens: { $sum: { $abs: '$rawAmount' } },
          transactionCount: { $sum: 1 },
        },
      },
    ]);

    // Process and calculate costs
    const modelMap = {};
    modelUsage.forEach(item => {
      const modelId = item._id.model;
      const tokenType = item._id.tokenType;
      
      if (!modelMap[modelId]) {
        const pricing = MODEL_PRICING[modelId];
        modelMap[modelId] = {
          model: modelId,
          modelName: pricing?.name || modelId,
          inputTokens: 0,
          outputTokens: 0,
          inputCost: 0,
          outputCost: 0,
          totalCost: 0,
          transactionCount: 0,
        };
      }
      
      const tokens = item.totalTokens;
      const cost = calculateCost(modelId, tokenType, tokens);
      
      if (tokenType === 'prompt') {
        modelMap[modelId].inputTokens += tokens;
        modelMap[modelId].inputCost += cost;
      } else {
        modelMap[modelId].outputTokens += tokens;
        modelMap[modelId].outputCost += cost;
      }
      modelMap[modelId].transactionCount += item.transactionCount;
      modelMap[modelId].totalCost = modelMap[modelId].inputCost + modelMap[modelId].outputCost;
    });

    const byModel = Object.values(modelMap).sort((a, b) => b.totalCost - a.totalCost);

    // Get totals
    const totals = byModel.reduce((acc, m) => ({
      inputTokens: acc.inputTokens + m.inputTokens,
      outputTokens: acc.outputTokens + m.outputTokens,
      inputCost: acc.inputCost + m.inputCost,
      outputCost: acc.outputCost + m.outputCost,
      totalCost: acc.totalCost + m.totalCost,
      transactionCount: acc.transactionCount + m.transactionCount,
    }), { inputTokens: 0, outputTokens: 0, inputCost: 0, outputCost: 0, totalCost: 0, transactionCount: 0 });

    // Get usage by user
    const userUsage = await Transaction.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: { user: '$user', tokenType: '$tokenType' },
          totalTokens: { $sum: { $abs: '$rawAmount' } },
          transactionCount: { $sum: 1 },
        },
      },
    ]);

    // Process user usage
    const userMap = {};
    userUsage.forEach(item => {
      const userId = item._id.user.toString();
      const tokenType = item._id.tokenType;
      
      if (!userMap[userId]) {
        userMap[userId] = {
          userId,
          inputTokens: 0,
          outputTokens: 0,
          totalCost: 0,
          transactionCount: 0,
        };
      }
      
      if (tokenType === 'prompt') {
        userMap[userId].inputTokens += item.totalTokens;
      } else {
        userMap[userId].outputTokens += item.totalTokens;
      }
      userMap[userId].transactionCount += item.transactionCount;
    });

    // Populate user names and calculate costs
    const userIds = Object.keys(userMap);
    const users = await User.find({ _id: { $in: userIds } }).select('name email').lean();
    const userNameMap = {};
    users.forEach(u => { userNameMap[u._id.toString()] = u; });

    const byUser = Object.values(userMap).map(u => {
      const userData = userNameMap[u.userId] || {};
      // Estimate cost based on average model pricing
      const avgInputCost = totals.inputTokens > 0 ? totals.inputCost / totals.inputTokens : 0;
      const avgOutputCost = totals.outputTokens > 0 ? totals.outputCost / totals.outputTokens : 0;
      const estimatedCost = (u.inputTokens * avgInputCost) + (u.outputTokens * avgOutputCost);
      
      return {
        ...u,
        userName: userData.name || 'Unknown',
        userEmail: userData.email || '',
        totalCost: estimatedCost,
      };
    }).sort((a, b) => b.totalCost - a.totalCost);

    // Daily breakdown
    const dailyUsage = await Transaction.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            tokenType: '$tokenType',
          },
          totalTokens: { $sum: { $abs: '$rawAmount' } },
          transactionCount: { $sum: 1 },
        },
      },
      { $sort: { '_id.date': 1 } },
    ]);

    const dailyMap = {};
    dailyUsage.forEach(item => {
      const date = item._id.date;
      if (!dailyMap[date]) {
        dailyMap[date] = { date, inputTokens: 0, outputTokens: 0, transactionCount: 0 };
      }
      if (item._id.tokenType === 'prompt') {
        dailyMap[date].inputTokens += item.totalTokens;
      } else {
        dailyMap[date].outputTokens += item.totalTokens;
      }
      dailyMap[date].transactionCount += item.transactionCount;
    });

    const daily = Object.values(dailyMap).map(d => ({
      ...d,
      // Estimate cost using average rates
      estimatedCost: (d.inputTokens / 1000000 * 1.0) + (d.outputTokens / 1000000 * 5.0),
    }));

    return {
      totals,
      byModel,
      byUser,
      daily,
      dateRange: {
        startDate: startDate || null,
        endDate: endDate || null,
      },
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    logger.error('[Admin] Error in getUsageMetrics:', error);
    throw error;
  }
};

/**
 * Get agent usage metrics with costs
 * @param {Date} startDate - Start date for filtering
 * @param {Date} endDate - End date for filtering
 */
const getAgentUsageMetrics = async (startDate, endDate) => {
  try {
    const dateFilter = {};
    if (startDate) dateFilter.$gte = new Date(startDate);
    if (endDate) dateFilter.$lte = new Date(endDate);

    // Get all agents
    const agents = await Agent.find().select('id name description author model createdAt').lean();
    
    // Get agent transaction data
    const agentModels = agents.map(a => a.id);
    
    const matchStage = {
      model: { $regex: /^agent_/ },
      ...(Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {}),
    };

    const agentUsage = await Transaction.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: { model: '$model', tokenType: '$tokenType' },
          totalTokens: { $sum: { $abs: '$rawAmount' } },
          transactionCount: { $sum: 1 },
        },
      },
    ]);

    // Process agent usage
    const agentMap = {};
    agents.forEach(a => {
      agentMap[a.id] = {
        agentId: a.id,
        name: a.name,
        description: a.description || '',
        author: a.author,
        model: a.model,
        createdAt: a.createdAt,
        inputTokens: 0,
        outputTokens: 0,
        totalCost: 0,
        transactionCount: 0,
      };
    });

    agentUsage.forEach(item => {
      const agentId = item._id.model;
      if (!agentMap[agentId]) {
        agentMap[agentId] = {
          agentId,
          name: 'Unknown Agent',
          inputTokens: 0,
          outputTokens: 0,
          totalCost: 0,
          transactionCount: 0,
        };
      }
      
      if (item._id.tokenType === 'prompt') {
        agentMap[agentId].inputTokens += item.totalTokens;
      } else {
        agentMap[agentId].outputTokens += item.totalTokens;
      }
      agentMap[agentId].transactionCount += item.transactionCount;
    });

    // Calculate costs for agents
    const agentList = Object.values(agentMap).map(a => ({
      ...a,
      totalCost: calculateCost('default', 'prompt', a.inputTokens) + 
                 calculateCost('default', 'completion', a.outputTokens),
    })).filter(a => a.transactionCount > 0 || a.createdAt);

    // Get totals
    const totals = agentList.reduce((acc, a) => ({
      inputTokens: acc.inputTokens + a.inputTokens,
      outputTokens: acc.outputTokens + a.outputTokens,
      totalCost: acc.totalCost + a.totalCost,
      transactionCount: acc.transactionCount + a.transactionCount,
    }), { inputTokens: 0, outputTokens: 0, totalCost: 0, transactionCount: 0 });

    return {
      agents: agentList,
      totals,
      totalAgents: agents.length,
      dateRange: {
        startDate: startDate || null,
        endDate: endDate || null,
      },
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    logger.error('[Admin] Error in getAgentUsageMetrics:', error);
    throw error;
  }
};

/**
 * Get user's detailed usage with model breakdown
 * @param {string} userId - User ID
 * @param {Date} startDate - Start date for filtering
 * @param {Date} endDate - End date for filtering
 */
const getUserUsageDetails = async (userId, startDate, endDate) => {
  try {
    const mongoose = require('mongoose');
    const dateFilter = {};
    if (startDate) dateFilter.$gte = new Date(startDate);
    if (endDate) dateFilter.$lte = new Date(endDate);

    const matchStage = {
      user: new mongoose.Types.ObjectId(userId),
      ...(Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {}),
    };

    // Get user's usage by model
    const modelUsage = await Transaction.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: { model: '$model', tokenType: '$tokenType' },
          totalTokens: { $sum: { $abs: '$rawAmount' } },
          transactionCount: { $sum: 1 },
        },
      },
    ]);

    // Process by model
    const modelMap = {};
    modelUsage.forEach(item => {
      const modelId = item._id.model;
      const tokenType = item._id.tokenType;
      
      if (!modelMap[modelId]) {
        const pricing = MODEL_PRICING[modelId];
        modelMap[modelId] = {
          model: modelId,
          modelName: pricing?.name || modelId,
          inputTokens: 0,
          outputTokens: 0,
          inputCost: 0,
          outputCost: 0,
          totalCost: 0,
          transactionCount: 0,
        };
      }
      
      const tokens = item.totalTokens;
      const cost = calculateCost(modelId, tokenType, tokens);
      
      if (tokenType === 'prompt') {
        modelMap[modelId].inputTokens += tokens;
        modelMap[modelId].inputCost += cost;
      } else {
        modelMap[modelId].outputTokens += tokens;
        modelMap[modelId].outputCost += cost;
      }
      modelMap[modelId].transactionCount += item.transactionCount;
      modelMap[modelId].totalCost = modelMap[modelId].inputCost + modelMap[modelId].outputCost;
    });

    const byModel = Object.values(modelMap).sort((a, b) => b.totalCost - a.totalCost);

    // Get totals
    const totals = byModel.reduce((acc, m) => ({
      inputTokens: acc.inputTokens + m.inputTokens,
      outputTokens: acc.outputTokens + m.outputTokens,
      inputCost: acc.inputCost + m.inputCost,
      outputCost: acc.outputCost + m.outputCost,
      totalCost: acc.totalCost + m.totalCost,
      transactionCount: acc.transactionCount + m.transactionCount,
    }), { inputTokens: 0, outputTokens: 0, inputCost: 0, outputCost: 0, totalCost: 0, transactionCount: 0 });

    return {
      userId,
      totals,
      byModel,
      dateRange: {
        startDate: startDate || null,
        endDate: endDate || null,
      },
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    logger.error('[Admin] Error in getUserUsageDetails:', error);
    throw error;
  }
};

/**
 * Get transaction history with model info
 * @param {object} params - Query parameters
 */
const getTransactionHistory = async ({ userId, startDate, endDate, page = 1, limit = 50 }) => {
  try {
    const mongoose = require('mongoose');
    const matchStage = {};
    if (userId) {
      matchStage.user = new mongoose.Types.ObjectId(userId);
    }
    if (startDate || endDate) {
      matchStage.createdAt = {};
      if (startDate) matchStage.createdAt.$gte = new Date(startDate);
      if (endDate) matchStage.createdAt.$lte = new Date(endDate);
    }

    const total = await Transaction.countDocuments(matchStage);

    const transactions = await Transaction.find(matchStage)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('user', 'name email')
      .lean();

    // Add model names and calculated costs
    const enrichedTransactions = transactions.map(t => {
      const pricing = MODEL_PRICING[t.model];
      const tokens = Math.abs(t.rawAmount);
      const cost = calculateCost(t.model, t.tokenType, tokens);
      
      return {
        ...t,
        modelName: pricing?.name || t.model,
        tokens,
        calculatedCost: cost,
      };
    });

    return {
      transactions: enrichedTransactions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    logger.error('[Admin] Error in getTransactionHistory:', error);
    throw error;
  }
};

/**
 * Get LLM traces for observability - all message pairs with costs and details
 * @param {Object} options - Query options
 * @returns {Object} Traces with pagination
 */
const getLLMTraces = async ({ page = 1, limit = 50, userId = null, conversationId = null, model = null, startDate = null, endDate = null } = {}) => {
  try {
    const mongoose = require('mongoose');
    
    // Build match conditions
    const matchConditions = { isCreatedByUser: false }; // Get AI responses (they link to user messages via parentMessageId)
    
    if (userId) {
      matchConditions.user = new mongoose.Types.ObjectId(userId);
    }
    if (conversationId) {
      matchConditions.conversationId = conversationId;
    }
    if (model) {
      matchConditions.model = model;
    }
    if (startDate || endDate) {
      matchConditions.createdAt = {};
      if (startDate) matchConditions.createdAt.$gte = new Date(startDate);
      if (endDate) matchConditions.createdAt.$lte = new Date(endDate);
    }

    // Get total count
    const total = await Message.countDocuments(matchConditions);

    // Get AI messages with pagination (these contain the model, tokenCount, content)
    const aiMessages = await Message.find(matchConditions)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    // For each AI message, get the corresponding user message (input) via parentMessageId
    const traces = await Promise.all(
      aiMessages.map(async (aiMsg) => {
        // Get user message (input)
        let userMessage = null;
        if (aiMsg.parentMessageId && aiMsg.parentMessageId !== '00000000-0000-0000-0000-000000000000') {
          userMessage = await Message.findOne({ messageId: aiMsg.parentMessageId }).lean();
        }

        // Get user info
        let userInfo = null;
        if (aiMsg.user) {
          userInfo = await User.findById(aiMsg.user).select('name email').lean();
        }

        // Get conversation title
        let conversationTitle = 'Untitled';
        if (aiMsg.conversationId) {
          const conv = await Conversation.findOne({ conversationId: aiMsg.conversationId }).select('title').lean();
          if (conv) conversationTitle = conv.title || 'Untitled';
        }

        // Get transactions for this conversation around this time to calculate cost
        const timeWindow = new Date(aiMsg.createdAt);
        const timeWindowStart = new Date(timeWindow.getTime() - 2000); // 2 seconds before
        const timeWindowEnd = new Date(timeWindow.getTime() + 2000); // 2 seconds after
        
        const transactions = await Transaction.find({
          conversationId: aiMsg.conversationId,
          createdAt: { $gte: timeWindowStart, $lte: timeWindowEnd },
        }).lean();

        // Calculate costs
        let inputTokens = 0;
        let outputTokens = 0;
        let inputCost = 0;
        let outputCost = 0;

        transactions.forEach(tx => {
          const tokens = Math.abs(tx.rawAmount);
          const cost = calculateCost(tx.model, tx.tokenType, tokens);
          if (tx.tokenType === 'prompt') {
            inputTokens += tokens;
            inputCost += cost;
          } else {
            outputTokens += tokens;
            outputCost += cost;
          }
        });

        // Extract text from AI content
        let aiText = aiMsg.text || '';
        let thinkingText = '';
        let toolCalls = [];
        
        if (aiMsg.content && Array.isArray(aiMsg.content)) {
          const textParts = aiMsg.content.filter(c => c.type === 'text' && c.text).map(c => c.text);
          if (textParts.length > 0) aiText = textParts.join('\n');
          
          const thinkParts = aiMsg.content.filter(c => c.type === 'think' && c.think);
          if (thinkParts.length > 0) thinkingText = thinkParts.map(c => c.think).join('\n');
          
          toolCalls = aiMsg.content.filter(c => c.type === 'tool_call').map(c => ({
            id: c.tool_call?.id,
            name: c.tool_call?.name,
            args: c.tool_call?.args,
            output: c.tool_call?.output,
          }));
        }

        return {
          id: aiMsg._id.toString(),
          messageId: aiMsg.messageId,
          conversationId: aiMsg.conversationId,
          conversationTitle,
          user: userInfo,
          // Input (user message)
          input: {
            messageId: userMessage?.messageId,
            text: userMessage?.text || '',
            tokenCount: userMessage?.tokenCount || 0,
            createdAt: userMessage?.createdAt,
          },
          // Output (AI response)
          output: {
            messageId: aiMsg.messageId,
            text: aiText,
            tokenCount: aiMsg.tokenCount || 0,
            createdAt: aiMsg.createdAt,
          },
          // Trace details
          trace: {
            model: aiMsg.model,
            modelName: MODEL_PRICING[aiMsg.model]?.name || aiMsg.model,
            endpoint: aiMsg.endpoint,
            sender: aiMsg.sender,
            // Tokens & Costs
            inputTokens,
            outputTokens,
            totalTokens: inputTokens + outputTokens,
            inputCost: parseFloat(inputCost.toFixed(6)),
            outputCost: parseFloat(outputCost.toFixed(6)),
            totalCost: parseFloat((inputCost + outputCost).toFixed(6)),
            // Extended thinking
            thinking: thinkingText,
            // Tool calls
            toolCalls,
            // Timing
            duration: aiMsg.updatedAt && aiMsg.createdAt 
              ? new Date(aiMsg.updatedAt).getTime() - new Date(userMessage?.createdAt || aiMsg.createdAt).getTime()
              : null,
          },
          createdAt: aiMsg.createdAt,
        };
      })
    );

    // Get unique models for filter
    const models = await Message.distinct('model', { isCreatedByUser: false, model: { $ne: null } });

    return {
      traces,
      filters: {
        models: models.map(m => ({ id: m, name: MODEL_PRICING[m]?.name || m })),
      },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
      summary: {
        totalTraces: total,
      },
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    logger.error('[Admin] Error in getLLMTraces:', error);
    throw error;
  }
};

module.exports = {
  getOverviewMetrics,
  getUserMetrics,
  getConversationMetrics,
  getTokenMetrics,
  getModelMetrics,
  getAgentMetrics,
  getActivityTimeline,
  getHourlyActivity,
  getUsageMetrics,
  getAgentUsageMetrics,
  getUserUsageDetails,
  getTransactionHistory,
  getLLMTraces,
  MODEL_PRICING,
};
