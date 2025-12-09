/**
 * Admin Service
 * 
 * Core service for admin dashboard metrics and analytics.
 * Provides comprehensive metrics at every level.
 */

const { logger } = require('@ranger/data-schemas');
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
 * 
 * Cache pricing:
 * - cacheWrite: Cost to write tokens to cache (typically 1.25x input rate)
 * - cacheRead: Cost to read cached tokens (typically 10% of input rate = 90% discount)
 */
const MODEL_PRICING = {
  'us.amazon.nova-micro-v1:0': { 
    name: 'Amazon Nova Micro',
    input: 0.035, 
    output: 0.14,
    cacheWrite: 0.04375,  // 1.25x input
    cacheRead: 0.0035     // 10% of input
  },
  'global.amazon.nova-2-lite-v1:0': { 
    name: 'Amazon Nova Lite',
    input: 0.06, 
    output: 0.24,
    cacheWrite: 0.075,    // 1.25x input
    cacheRead: 0.006      // 10% of input
  },
  'us.anthropic.claude-haiku-4-5-20251001-v1:0': { 
    name: 'Claude Haiku 4.5',
    input: 1.0, 
    output: 5.0,
    cacheWrite: 1.25,     // 1.25x input
    cacheRead: 0.1        // 10% of input (90% discount)
  },
  'us.anthropic.claude-sonnet-4-5-20250929-v1:0': { 
    name: 'Claude Sonnet 4.5',
    input: 3.0, 
    output: 15.0,
    cacheWrite: 3.75,     // 1.25x input
    cacheRead: 0.3        // 10% of input (90% discount)
  },
  'global.anthropic.claude-opus-4-5-20251101-v1:0': { 
    name: 'Claude Opus 4.5',
    input: 5.0, 
    output: 25.0,
    cacheWrite: 6.25,     // 1.25x input
    cacheRead: 0.5        // 10% of input (90% discount)
  },
  // Additional models with standard cache rates
  'us.anthropic.claude-3-5-sonnet-20241022-v2:0': {
    name: 'Claude 3.5 Sonnet',
    input: 3.0,
    output: 15.0,
    cacheWrite: 3.75,
    cacheRead: 0.3
  },
  'us.anthropic.claude-3-7-sonnet-20250219-v1:0': {
    name: 'Claude 3.7 Sonnet',
    input: 3.0,
    output: 15.0,
    cacheWrite: 3.75,
    cacheRead: 0.3
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
  const pricing = MODEL_PRICING[model] || findMatchingPricing(model);
  if (!pricing) {
    // For agents or unknown models, use a default pricing
    return (tokens / 1000000) * 1.0; // Default $1 per million
  }
  const rate = tokenType === 'prompt' ? pricing.input : pricing.output;
  return (Math.abs(tokens) / 1000000) * rate;
};

/**
 * Calculate cost for structured tokens including cache tokens
 * @param {string} model - Model ID
 * @param {Object} tokenBreakdown - Token breakdown with input, write, read, output
 * @returns {Object} Cost breakdown in dollars
 */
const calculateStructuredCost = (model, tokenBreakdown) => {
  const pricing = MODEL_PRICING[model] || findMatchingPricing(model);
  const defaultPricing = { input: 1.0, output: 1.0, cacheWrite: 1.25, cacheRead: 0.1 };
  const rates = pricing || defaultPricing;
  
  const inputCost = (Math.abs(tokenBreakdown.input || 0) / 1000000) * rates.input;
  const writeCost = (Math.abs(tokenBreakdown.write || 0) / 1000000) * (rates.cacheWrite || rates.input * 1.25);
  const readCost = (Math.abs(tokenBreakdown.read || 0) / 1000000) * (rates.cacheRead || rates.input * 0.1);
  const outputCost = (Math.abs(tokenBreakdown.output || 0) / 1000000) * rates.output;
  
  return {
    inputCost,
    writeCost,
    readCost,
    outputCost,
    totalInputCost: inputCost + writeCost + readCost,
    totalCost: inputCost + writeCost + readCost + outputCost,
  };
};

/**
 * Find matching pricing by partial model name match
 * @param {string} model - Model ID to match
 * @returns {Object|null} Pricing object or null
 */
const findMatchingPricing = (model) => {
  if (!model) return null;
  const modelLower = model.toLowerCase();
  
  // Check for partial matches
  for (const [key, pricing] of Object.entries(MODEL_PRICING)) {
    // Match by model family
    if (modelLower.includes('opus-4-5') && key.includes('opus-4-5')) return pricing;
    if (modelLower.includes('sonnet-4-5') && key.includes('sonnet-4-5')) return pricing;
    if (modelLower.includes('haiku-4-5') && key.includes('haiku-4-5')) return pricing;
    if (modelLower.includes('claude-3-7-sonnet') && key.includes('claude-3-7-sonnet')) return pricing;
    if (modelLower.includes('claude-3-5-sonnet') && key.includes('claude-3-5-sonnet')) return pricing;
    if (modelLower.includes('nova-micro') && key.includes('nova-micro')) return pricing;
    if (modelLower.includes('nova-lite') && key.includes('nova-lite')) return pricing;
  }
  return null;
};

/**
 * Check if a string looks like a valid model ID (not an agent ID)
 * Agent IDs are typically UUIDs or MongoDB ObjectIds, while model IDs contain
 * provider and model name patterns like 'anthropic', 'claude', 'nova', 'amazon', etc.
 * @param {string} modelOrId - The string to check
 * @returns {boolean} True if it looks like a model ID
 */
const isValidModelId = (modelOrId) => {
  if (!modelOrId) return false;
  const lower = modelOrId.toLowerCase();
  
  // Check for common model patterns
  const modelPatterns = [
    'anthropic', 'claude', 'sonnet', 'haiku', 'opus',
    'amazon', 'nova', 'gpt', 'openai', 'bedrock',
    'mistral', 'llama', 'titan', 'cohere', 'ai21'
  ];
  
  return modelPatterns.some(pattern => lower.includes(pattern));
};

/**
 * Resolve the actual model ID for a message, handling the case where
 * agent messages may have agent_id stored in the model field (legacy behavior).
 * Falls back to transaction model if the message model doesn't look like a real model.
 * @param {Object} aiMsg - The AI message document
 * @param {Array} transactions - Associated transactions for this message
 * @returns {string} The resolved model ID
 */
const resolveModelId = (aiMsg, transactions = []) => {
  // If the message model looks like a valid model, use it
  if (isValidModelId(aiMsg.model)) {
    return aiMsg.model;
  }
  
  // Fall back to transaction model (transactions always have the correct model)
  if (transactions.length > 0) {
    // Prefer the first transaction with a valid model
    for (const tx of transactions) {
      if (isValidModelId(tx.model)) {
        return tx.model;
      }
    }
  }
  
  // If all else fails, return whatever we have (could be agent_id or null)
  return aiMsg.model || 'unknown';
};

/**
 * Extract guardrails data from user and AI messages
 * Checks both messages for tracking metadata
 * @param {Object} userMessage - User message object
 * @param {Object} aiMessage - AI response message object
 * @returns {Object|null} Guardrails data if present
 */
const extractGuardrailsData = (userMessage, aiMessage) => {
  // Check user message for input guardrails (blocked/passed)
  const userTracking = userMessage?.metadata?.guardrailTracking;
  // Check AI message for output guardrails (blocked/anonymized/passed)
  const aiTracking = aiMessage?.metadata?.guardrailTracking;
  // Check for legacy guardrailBlocked field
  const legacyBlocked = aiMessage?.metadata?.guardrailBlocked;

  // If no guardrail data found, return null
  if (!userTracking && !aiTracking && !legacyBlocked) {
    return null;
  }

  const result = {
    invoked: false,
    input: null,
    output: null,
  };

  // Input guardrails (from user message)
  if (userTracking) {
    result.invoked = true;
    result.input = {
      outcome: userTracking.outcome,
      actionApplied: userTracking.actionApplied,
      violations: userTracking.violations || [],
      assessments: userTracking.assessments,  // Raw AWS response
      originalContent: userTracking.originalContent,
      reason: userTracking.reason,
      systemNote: userTracking.systemNote,
      timestamp: userTracking.timestamp,
    };
  }

  // Output guardrails (from AI message)
  if (aiTracking) {
    result.invoked = true;
    result.output = {
      outcome: aiTracking.outcome,
      actionApplied: aiTracking.actionApplied,
      violations: aiTracking.violations || [],
      assessments: aiTracking.assessments,  // Raw AWS response
      originalContent: aiTracking.originalContent,
      modifiedContent: aiTracking.modifiedContent,
      reason: aiTracking.reason,
      systemNote: aiTracking.systemNote,
      timestamp: aiTracking.timestamp,
    };
  }

  // Handle legacy format (guardrailBlocked without tracking metadata)
  if (legacyBlocked && !aiTracking) {
    result.invoked = true;
    result.output = {
      outcome: 'blocked',
      actionApplied: true,
      violations: aiMessage?.metadata?.violations || [],
      reason: aiMessage?.metadata?.blockReason || 'policy_violation',
      timestamp: aiMessage?.createdAt?.toISOString(),
    };
  }

  return result;
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
    if (typeof startDateStr === 'string' && typeof endDateStr === 'string') {
      // Handle both YYYY-MM-DD and full ISO strings
      const startStr = startDateStr.includes('T') ? startDateStr.split('T')[0] : startDateStr;
      const endStr = endDateStr.includes('T') ? endDateStr.split('T')[0] : endDateStr;
      startDate = new Date(startStr + 'T00:00:00.000Z');
      endDate = new Date(endStr + 'T23:59:59.999Z');
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

    // Token usage from transactions with accurate cost calculation (including cache tokens)
    let tokenUsageToday = 0;
    let tokenUsageThisWeek = 0;
    let tokenUsageThisMonth = 0;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalCacheWriteTokens = 0;
    let totalCacheReadTokens = 0;
    let totalCost = 0;
    let cacheSavings = 0;

    try {
      const [todayTokens, weekTokens, monthTokens, simplePromptTokens, structuredPromptTokens, completionTokens] = await Promise.all([
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
        // Simple prompt transactions (no cache breakdown) - use rawAmount as input
        Transaction.aggregate([
          {
            $match: {
              tokenType: 'prompt',
              inputTokens: { $exists: false },
              writeTokens: { $exists: false },
              readTokens: { $exists: false },
            },
          },
          {
            $group: {
              _id: '$model',
              tokens: { $sum: { $abs: '$rawAmount' } },
            },
          },
        ]),
        // Structured prompt transactions (with cache breakdown)
        Transaction.aggregate([
          {
            $match: {
              tokenType: 'prompt',
              $or: [
                { inputTokens: { $exists: true } },
                { writeTokens: { $exists: true } },
                { readTokens: { $exists: true } },
              ],
            },
          },
          {
            $group: {
              _id: '$model',
              inputTokens: { $sum: { $abs: { $ifNull: ['$inputTokens', 0] } } },
              writeTokens: { $sum: { $abs: { $ifNull: ['$writeTokens', 0] } } },
              readTokens: { $sum: { $abs: { $ifNull: ['$readTokens', 0] } } },
            },
          },
        ]),
        // Completion transactions - always use rawAmount
        Transaction.aggregate([
          {
            $match: { tokenType: 'completion' },
          },
          {
            $group: {
              _id: '$model',
              tokens: { $sum: { $abs: '$rawAmount' } },
            },
          },
        ]),
      ]);

      tokenUsageToday = todayTokens[0]?.total || 0;
      tokenUsageThisWeek = weekTokens[0]?.total || 0;
      tokenUsageThisMonth = monthTokens[0]?.total || 0;

      // Process simple prompt transactions (no cache)
      simplePromptTokens.forEach(item => {
        const tokens = item.tokens;
        const modelId = item._id;
        totalInputTokens += tokens;
        totalCost += calculateCost(modelId, 'prompt', tokens);
      });

      // Process structured prompt transactions (with cache breakdown)
      structuredPromptTokens.forEach(item => {
        const modelId = item._id;
        const inputTokens = item.inputTokens || 0;
        const writeTokens = item.writeTokens || 0;
        const readTokens = item.readTokens || 0;
        
        totalInputTokens += inputTokens;
        totalCacheWriteTokens += writeTokens;
        totalCacheReadTokens += readTokens;
        
        const pricing = MODEL_PRICING[modelId] || findMatchingPricing(modelId) || MODEL_PRICING.default;
        totalCost += (inputTokens / 1000000) * pricing.input;
        totalCost += (writeTokens / 1000000) * (pricing.cacheWrite || pricing.input * 1.25);
        totalCost += (readTokens / 1000000) * (pricing.cacheRead || pricing.input * 0.1);
        
        // Calculate savings: what we would have paid at input rate vs cache read rate
        const fullInputCost = (readTokens / 1000000) * pricing.input;
        const cacheReadCost = (readTokens / 1000000) * (pricing.cacheRead || pricing.input * 0.1);
        cacheSavings += fullInputCost - cacheReadCost;
      });

      // Process completion transactions
      completionTokens.forEach(item => {
        const tokens = item.tokens;
        const modelId = item._id;
        totalOutputTokens += tokens;
        totalCost += calculateCost(modelId, 'completion', tokens);
      });
    } catch (error) {
      logger.debug('[Admin] Could not fetch token metrics:', error.message);
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
        cacheWrite: Math.abs(totalCacheWriteTokens),
        cacheRead: Math.abs(totalCacheReadTokens),
        totalCost: parseFloat(totalCost.toFixed(4)),
        cacheSavings: parseFloat(cacheSavings.toFixed(4)),
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
    if (typeof startDateStr === 'string' && typeof endDateStr === 'string') {
      // Handle both YYYY-MM-DD and full ISO strings
      const startStr = startDateStr.includes('T') ? startDateStr.split('T')[0] : startDateStr;
      const endStr = endDateStr.includes('T') ? endDateStr.split('T')[0] : endDateStr;
      startDate = new Date(startStr + 'T00:00:00.000Z');
      endDate = new Date(endStr + 'T23:59:59.999Z');
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
        $addFields: {
          dateStr: { $dateToString: { format: '%Y-%m-%d', date: '$updatedAt', timezone: 'UTC' } },
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
    if (typeof startDateStr === 'string' && typeof endDateStr === 'string') {
      // Handle both YYYY-MM-DD and full ISO strings
      const startStr = startDateStr.includes('T') ? startDateStr.split('T')[0] : startDateStr;
      const endStr = endDateStr.includes('T') ? endDateStr.split('T')[0] : endDateStr;
      startDate = new Date(startStr + 'T00:00:00.000Z');
      endDate = new Date(endStr + 'T23:59:59.999Z');
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
    if (typeof startDateStr === 'string' && typeof endDateStr === 'string') {
      // Handle both YYYY-MM-DD and full ISO strings
      const startStr = startDateStr.includes('T') ? startDateStr.split('T')[0] : startDateStr;
      const endStr = endDateStr.includes('T') ? endDateStr.split('T')[0] : endDateStr;
      startDate = new Date(startStr + 'T00:00:00.000Z');
      endDate = new Date(endStr + 'T23:59:59.999Z');
    } else {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = now;
    }

    // Get detailed model breakdown with accurate cost calculation including cache tokens
    // Some transactions have structured tokens (inputTokens, writeTokens, readTokens)
    // Others have simple tokens (rawAmount with tokenType: prompt/completion)
    const allTransactions = await Transaction.find({
      createdAt: { $gte: startDate, $lte: endDate },
    }).lean();

    // Process all transactions and calculate accurate costs
    const modelMap = {};
    
    allTransactions.forEach(tx => {
      const modelId = tx.model || 'unknown';
      const tokenType = tx.tokenType;
      
      if (!modelMap[modelId]) {
        const pricing = MODEL_PRICING[modelId] || findMatchingPricing(modelId) || { 
          name: modelId, 
          input: 1.0, 
          output: 5.0,
          cacheWrite: 1.25,
          cacheRead: 0.1 
        };
        modelMap[modelId] = {
          model: modelId,
          name: pricing.name,
          inputTokens: 0,
          outputTokens: 0,
          cacheWriteTokens: 0,
          cacheReadTokens: 0,
          inputCost: 0,
          outputCost: 0,
          cacheWriteCost: 0,
          cacheReadCost: 0,
          totalCost: 0,
          transactions: 0,
        };
      }
      
      const pricing = MODEL_PRICING[modelId] || findMatchingPricing(modelId) || { 
        input: 1.0, 
        output: 5.0,
        cacheWrite: 1.25,
        cacheRead: 0.1 
      };
      
      if (tokenType === 'prompt') {
        // Check if this is a structured transaction with cache tokens
        if (tx.inputTokens !== undefined || tx.writeTokens !== undefined || tx.readTokens !== undefined) {
          // Structured transaction with cache breakdown
          const inputTokens = Math.abs(tx.inputTokens || 0);
          const writeTokens = Math.abs(tx.writeTokens || 0);
          const readTokens = Math.abs(tx.readTokens || 0);
          
          modelMap[modelId].inputTokens += inputTokens;
          modelMap[modelId].cacheWriteTokens += writeTokens;
          modelMap[modelId].cacheReadTokens += readTokens;
          
          modelMap[modelId].inputCost += (inputTokens / 1000000) * pricing.input;
          modelMap[modelId].cacheWriteCost += (writeTokens / 1000000) * (pricing.cacheWrite || pricing.input * 1.25);
          modelMap[modelId].cacheReadCost += (readTokens / 1000000) * (pricing.cacheRead || pricing.input * 0.1);
        } else {
          // Simple prompt transaction (all tokens counted as input)
          const tokens = Math.abs(tx.rawAmount || 0);
          modelMap[modelId].inputTokens += tokens;
          modelMap[modelId].inputCost += calculateCost(modelId, 'prompt', tokens);
        }
      } else if (tokenType === 'completion') {
        const tokens = Math.abs(tx.rawAmount || 0);
        modelMap[modelId].outputTokens += tokens;
        modelMap[modelId].outputCost += calculateCost(modelId, 'completion', tokens);
      }
      modelMap[modelId].transactions += 1;
    });

    // Get duration data by model from Message collection
    const durationByModel = await Message.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
          isCreatedByUser: false, // AI messages
          model: { $exists: true, $ne: null },
        },
      },
      {
        $group: {
          _id: '$model',
          count: { $sum: 1 },
          // Calculate duration as time between createdAt and updatedAt (ms)
          totalDuration: {
            $sum: {
              $subtract: ['$updatedAt', '$createdAt']
            }
          },
        },
      },
    ]);

    // Create a map of model -> duration
    const durationMap = {};
    durationByModel.forEach(item => {
      durationMap[item._id] = {
        totalDuration: item.totalDuration || 0,
        messageCount: item.count || 0,
      };
    });

    // Calculate total costs and finalize
    const byModel = Object.values(modelMap).map(m => ({
      ...m,
      totalInputCost: m.inputCost + m.cacheWriteCost + m.cacheReadCost,
      totalCost: m.inputCost + m.outputCost + m.cacheWriteCost + m.cacheReadCost,
      totalTokens: m.inputTokens + m.outputTokens + m.cacheWriteTokens + m.cacheReadTokens,
      // Cache savings estimation (90% discount on cache reads vs normal input)
      cacheSavings: m.cacheReadTokens > 0 
        ? parseFloat(((m.cacheReadTokens / 1000000) * (MODEL_PRICING[m.model]?.input || 1) * 0.9).toFixed(6))
        : 0,
      // Duration data
      totalDuration: durationMap[m.model]?.totalDuration || 0,
      avgDuration: durationMap[m.model]?.messageCount > 0 
        ? Math.round((durationMap[m.model].totalDuration || 0) / durationMap[m.model].messageCount)
        : 0,
    })).sort((a, b) => b.totalCost - a.totalCost);

    // Token usage over time with accurate costs
    const tokenTrend = await Transaction.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
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
        $sort: { '_id': 1 },
      },
      {
        $project: {
          _id: 0,
          date: { $toDate: '$_id' },
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

    // Calculate period totals including cache tokens
    const totalInputTokens = byModel.reduce((sum, m) => sum + m.inputTokens, 0);
    const totalOutputTokens = byModel.reduce((sum, m) => sum + m.outputTokens, 0);
    const totalCacheWriteTokens = byModel.reduce((sum, m) => sum + m.cacheWriteTokens, 0);
    const totalCacheReadTokens = byModel.reduce((sum, m) => sum + m.cacheReadTokens, 0);
    const totalInputCost = byModel.reduce((sum, m) => sum + m.inputCost, 0);
    const totalOutputCost = byModel.reduce((sum, m) => sum + m.outputCost, 0);
    const totalCacheWriteCost = byModel.reduce((sum, m) => sum + m.cacheWriteCost, 0);
    const totalCacheReadCost = byModel.reduce((sum, m) => sum + m.cacheReadCost, 0);
    const totalCost = byModel.reduce((sum, m) => sum + m.totalCost, 0);
    const totalCacheSavings = byModel.reduce((sum, m) => sum + (m.cacheSavings || 0), 0);
    const totalTransactions = byModel.reduce((sum, m) => sum + m.transactions, 0);
    const totalDuration = byModel.reduce((sum, m) => sum + (m.totalDuration || 0), 0);

    return {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      summary: {
        totalInputTokens,
        totalOutputTokens,
        totalCacheWriteTokens,
        totalCacheReadTokens,
        totalTokens: totalInputTokens + totalOutputTokens + totalCacheWriteTokens + totalCacheReadTokens,
        totalInputCost: parseFloat(totalInputCost.toFixed(6)),
        totalOutputCost: parseFloat(totalOutputCost.toFixed(6)),
        totalCacheWriteCost: parseFloat(totalCacheWriteCost.toFixed(6)),
        totalCacheReadCost: parseFloat(totalCacheReadCost.toFixed(6)),
        totalCost: parseFloat(totalCost.toFixed(6)),
        totalCacheSavings: parseFloat(totalCacheSavings.toFixed(6)),
        totalTransactions,
        totalDuration,
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
    if (typeof startDateStr === 'string' && typeof endDateStr === 'string') {
      // Handle both YYYY-MM-DD and full ISO strings
      const startStr = startDateStr.includes('T') ? startDateStr.split('T')[0] : startDateStr;
      const endStr = endDateStr.includes('T') ? endDateStr.split('T')[0] : endDateStr;
      startDate = new Date(startStr + 'T00:00:00.000Z');
      endDate = new Date(endStr + 'T23:59:59.999Z');
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
    // Validate that the date strings are actual strings (not arrays or other types)
    if ((startDateStr && typeof startDateStr !== 'string') || (endDateStr && typeof endDateStr !== 'string')) {
      throw new Error('Invalid date parameters: must be strings');
    }
    // Parse date range or default to current month
    let startDate, endDate;
    const now = new Date();
    if (typeof startDateStr === 'string' && typeof endDateStr === 'string') {
      // Handle both YYYY-MM-DD and full ISO strings
      const startStr = startDateStr.includes('T') ? startDateStr.split('T')[0] : startDateStr;
      const endStr = endDateStr.includes('T') ? endDateStr.split('T')[0] : endDateStr;
      startDate = new Date(startStr + 'T00:00:00.000Z');
      endDate = new Date(endStr + 'T23:59:59.999Z');
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
        // Use calculateCost for consistent pricing across the application
        if (tokenType === 'prompt') {
          agentMap[agentId].inputTokens += tokens;
          agentMap[agentId].inputCost += calculateCost(agentId, tokenType, tokens);
        } else if (tokenType === 'completion') {
          agentMap[agentId].outputTokens += tokens;
          agentMap[agentId].outputCost += calculateCost(agentId, tokenType, tokens);
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
const getLLMTraces = async ({ page = 1, limit = 50, userId = null, conversationId = null, model = null, startDate = null, endDate = null, toolName = null } = {}) => {
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
    // Filter by tool name - look for messages with tool calls containing this tool
    if (toolName) {
      matchConditions['content'] = {
        $elemMatch: {
          type: 'tool_call',
          'tool_call.name': { $regex: toolName, $options: 'i' }
        }
      };
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

        // Calculate costs with full cache token breakdown
        // Transaction stores: inputTokens, writeTokens, readTokens, rawAmount, tokenValue
        // tokenValue already has correct rates applied from spendStructuredTokens
        let inputTokens = 0;
        let outputTokens = 0;
        let cacheWriteTokens = 0;
        let cacheReadTokens = 0;
        let totalCostFromTx = 0;  // Use actual tokenValue from transactions
        let inputCost = 0;
        let outputCost = 0;
        let cacheWriteCost = 0;
        let cacheReadCost = 0;
        let contextBreakdown = null;  // Will hold the breakdown of what's in the cached context

        transactions.forEach(tx => {
          // Use tokenValue if available (already has correct rates applied)
          // Otherwise fall back to manual calculation
          if (tx.tokenValue !== undefined && tx.tokenValue !== null) {
            totalCostFromTx += Math.abs(tx.tokenValue) / 1000000; // tokenValue is in micro-dollars
          }
          
          if (tx.tokenType === 'prompt') {
            // Prompt transactions may have structured tokens
            const txInputTokens = Math.abs(tx.inputTokens || tx.rawAmount || 0);
            const txWriteTokens = Math.abs(tx.writeTokens || 0);
            const txReadTokens = Math.abs(tx.readTokens || 0);
            
            inputTokens += txInputTokens;
            cacheWriteTokens += txWriteTokens;
            cacheReadTokens += txReadTokens;
            
            // Extract context breakdown if available (what's in the cached tokens)
            if (tx.contextBreakdown && !contextBreakdown) {
              contextBreakdown = tx.contextBreakdown;
            }
            
            // Calculate costs using model-specific rates
            const costs = calculateStructuredCost(tx.model || aiMsg.model, {
              input: txInputTokens,
              write: txWriteTokens,
              read: txReadTokens,
              output: 0,
            });
            inputCost += costs.inputCost;
            cacheWriteCost += costs.writeCost;
            cacheReadCost += costs.readCost;
          } else {
            // Completion tokens
            const tokens = Math.abs(tx.rawAmount || 0);
            outputTokens += tokens;
            outputCost += calculateCost(tx.model || aiMsg.model, 'completion', tokens);
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

        // Resolve the actual model ID (handles legacy case where agent_id was stored in model field)
        const resolvedModel = resolveModelId(aiMsg, transactions);

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
            model: resolvedModel,
            modelName: MODEL_PRICING[resolvedModel]?.name || findMatchingPricing(resolvedModel)?.name || resolvedModel,
            endpoint: aiMsg.endpoint,
            sender: aiMsg.sender,
            // Tokens - full breakdown including cache
            inputTokens,
            outputTokens,
            cacheWriteTokens,
            cacheReadTokens,
            totalTokens: inputTokens + outputTokens + cacheWriteTokens + cacheReadTokens,
            // Cache info
            caching: {
              enabled: cacheWriteTokens > 0 || cacheReadTokens > 0,
              writeTokens: cacheWriteTokens,
              readTokens: cacheReadTokens,
              writeCost: parseFloat(cacheWriteCost.toFixed(6)),
              readCost: parseFloat(cacheReadCost.toFixed(6)),
              // Cache hit ratio (if reading from cache)
              hitRatio: (cacheReadTokens > 0 && inputTokens > 0) 
                ? parseFloat((cacheReadTokens / (inputTokens + cacheReadTokens) * 100).toFixed(1))
                : 0,
              // Estimated savings from cache reads (90% discount on cached tokens)
              estimatedSavings: parseFloat((cacheReadTokens > 0 
                ? (cacheReadTokens / 1000000) * ((MODEL_PRICING[resolvedModel]?.input || findMatchingPricing(resolvedModel)?.input || 1) * 0.9)
                : 0).toFixed(6)),
            },
            // Context breakdown - what's in those tokens (system prompt, artifacts, tools, etc.)
            tokenBreakdown: contextBreakdown ? {
              // High-level totals
              instructions: contextBreakdown.instructions || 0,
              artifacts: contextBreakdown.artifacts || 0,
              tools: contextBreakdown.tools || 0,
              toolCount: contextBreakdown.toolCount || 0,
              toolContext: contextBreakdown.toolContext || 0,
              total: contextBreakdown.total || 0,
              // Detailed per-tool breakdown
              toolsDetail: contextBreakdown.toolsDetail || [],
              toolContextDetail: contextBreakdown.toolContextDetail || [],
              // Per-prompt token breakdown (branding, tool routing, etc.)
              prompts: contextBreakdown.prompts || null,
            } : null,
            // Costs - accurate with cache token rates
            inputCost: parseFloat(inputCost.toFixed(6)),
            outputCost: parseFloat(outputCost.toFixed(6)),
            cacheWriteCost: parseFloat(cacheWriteCost.toFixed(6)),
            cacheReadCost: parseFloat(cacheReadCost.toFixed(6)),
            totalInputCost: parseFloat((inputCost + cacheWriteCost + cacheReadCost).toFixed(6)),
            totalCost: parseFloat((inputCost + outputCost + cacheWriteCost + cacheReadCost).toFixed(6)),
            // Extended thinking
            thinking: thinkingText,
            // Tool calls
            toolCalls,
            // Timing
            duration: aiMsg.updatedAt && aiMsg.createdAt 
              ? new Date(aiMsg.updatedAt).getTime() - new Date(userMessage?.createdAt || aiMsg.createdAt).getTime()
              : null,
          },
          // Guardrails tracking data
          guardrails: extractGuardrailsData(userMessage, aiMsg),
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

/**
 * Get tool usage metrics from message content
 * Aggregates tool call data from AI messages
 * @param {string} startDate - Optional start date filter
 * @param {string} endDate - Optional end date filter
 * @returns {Promise<Object>} Tool usage metrics
 */
const getToolMetrics = async (startDate, endDate) => {
  try {
    const dateFilter = {};
    if (startDate) dateFilter.$gte = new Date(startDate);
    if (endDate) dateFilter.$lte = new Date(endDate);

    const matchStage = {
      'content.type': 'tool_call',
      isCreatedByUser: false,
    };
    if (Object.keys(dateFilter).length > 0) {
      matchStage.createdAt = dateFilter;
    }

    // Aggregate tool calls from messages
    const toolAggregation = await Message.aggregate([
      { $match: matchStage },
      { $unwind: '$content' },
      { $match: { 'content.type': 'tool_call' } },
      {
        $group: {
          _id: '$content.tool_call.name',
          invocations: { $sum: 1 },
          conversationIds: { $addToSet: '$conversationId' },
          userIds: { $addToSet: '$user' },
        },
      },
      { $sort: { invocations: -1 } },
    ]);

    // Get daily trend
    const trendAggregation = await Message.aggregate([
      { $match: matchStage },
      { $unwind: '$content' },
      { $match: { 'content.type': 'tool_call' } },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.date': 1 } },
    ]);

    const tools = toolAggregation.map(t => ({
      toolName: t._id || 'unknown',
      displayName: t._id?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Unknown',
      category: categorizeToolName(t._id),
      invocations: t.invocations,
      successCount: t.invocations, // Assume success if output exists
      errorCount: 0,
      avgDuration: 0, // Not tracked in current schema
      userCount: t.userIds?.length || 0,
      conversationCount: t.conversationIds?.length || 0,
    }));

    const totalInvocations = tools.reduce((sum, t) => sum + t.invocations, 0);

    return {
      startDate: startDate || null,
      endDate: endDate || null,
      tools,
      trend: trendAggregation.map(t => ({
        date: t._id.date,
        count: t.count,
      })),
      summary: {
        totalInvocations,
        totalTools: tools.length,
        avgSuccessRate: 100, // Assume 100% if no error tracking
        mostUsedTool: tools[0]?.toolName || 'N/A',
      },
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    logger.error('[Admin] Error in getToolMetrics:', error);
    throw error;
  }
};

/**
 * Categorize tool by name pattern
 */
const categorizeToolName = (toolName) => {
  if (!toolName) return 'other';
  const name = toolName.toLowerCase();
  if (name.includes('sharepoint') || name.includes('onedrive') || name.includes('outlook') || name.includes('teams') || name.includes('excel')) {
    return 'mcp';
  }
  if (name.includes('web_search') || name.includes('code') || name.includes('execute')) {
    return 'builtin';
  }
  if (name.includes('rag') || name.includes('retrieve') || name.includes('search')) {
    return 'agent';
  }
  return 'other';
};

/**
 * Get guardrails usage metrics from message metadata
 * Aggregates guardrail tracking data from messages
 * @param {string} startDate - Optional start date filter
 * @param {string} endDate - Optional end date filter
 * @returns {Promise<Object>} Guardrails metrics
 */
const getGuardrailsMetrics = async (startDate, endDate) => {
  try {
    const dateFilter = {};
    if (startDate) dateFilter.$gte = new Date(startDate);
    if (endDate) dateFilter.$lte = new Date(endDate);

    const matchStage = {
      $or: [
        { 'metadata.guardrailTracking': { $exists: true } },
        { 'metadata.guardrailBlocked': { $exists: true } },
      ],
    };
    if (Object.keys(dateFilter).length > 0) {
      matchStage.createdAt = dateFilter;
    }

    // Get all guardrail events
    const guardrailMessages = await Message.find(matchStage)
      .select('messageId conversationId user metadata createdAt')
      .lean();

    // Categorize by outcome
    const outcomes = {
      blocked: 0,
      intervened: 0,
      anonymized: 0,
      passed: 0,
    };

    const violations = {};
    const userIds = new Set();
    const conversationIds = new Set();

    for (const msg of guardrailMessages) {
      userIds.add(msg.user?.toString());
      conversationIds.add(msg.conversationId);

      const tracking = msg.metadata?.guardrailTracking;
      const legacyBlocked = msg.metadata?.guardrailBlocked;

      if (legacyBlocked) {
        outcomes.blocked++;
        // Track violations
        if (msg.metadata?.violations) {
          for (const v of msg.metadata.violations) {
            const key = `${v.type}:${v.category}`;
            violations[key] = (violations[key] || 0) + 1;
          }
        }
      } else if (tracking) {
        const outcome = tracking.outcome?.toLowerCase() || 'passed';
        if (outcomes[outcome] !== undefined) {
          outcomes[outcome]++;
        }
        // Track violations
        if (tracking.violations) {
          for (const v of tracking.violations) {
            const key = `${v.type}:${v.category}`;
            violations[key] = (violations[key] || 0) + 1;
          }
        }
      }
    }

    // Get daily trend with all outcome types
    const trendAggregation = await Message.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 },
          blocked: {
            $sum: {
              $cond: [
                {
                  $or: [
                    { $eq: ['$metadata.guardrailBlocked', true] },
                    { $eq: ['$metadata.guardrailTracking.outcome', 'blocked'] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          intervened: {
            $sum: {
              $cond: [
                { $eq: ['$metadata.guardrailTracking.outcome', 'intervened'] },
                1,
                0,
              ],
            },
          },
          anonymized: {
            $sum: {
              $cond: [
                { $eq: ['$metadata.guardrailTracking.outcome', 'anonymized'] },
                1,
                0,
              ],
            },
          },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Get violation breakdown by type
    const violationsByType = {};
    for (const msg of guardrailMessages) {
      const tracking = msg.metadata?.guardrailTracking;
      const violations_list = tracking?.violations || msg.metadata?.violations || [];
      const outcome = msg.metadata?.guardrailBlocked ? 'blocked' : (tracking?.outcome?.toLowerCase() || 'passed');
      
      for (const v of violations_list) {
        const vType = v.type || 'unknown';
        if (!violationsByType[vType]) {
          violationsByType[vType] = { blocked: 0, intervened: 0, anonymized: 0 };
        }
        if (violationsByType[vType][outcome] !== undefined) {
          violationsByType[vType][outcome]++;
        }
      }
    }

    const violationBreakdown = Object.entries(violationsByType)
      .map(([type, counts]) => ({
        type,
        ...counts,
        total: counts.blocked + counts.intervened + counts.anonymized,
      }))
      .sort((a, b) => b.total - a.total);

    const totalEvents = guardrailMessages.length;
    const violationsList = Object.entries(violations)
      .map(([key, count]) => {
        const [type, category] = key.split(':');
        return { type, category, count };
      })
      .sort((a, b) => b.count - a.count);

    return {
      startDate: startDate || null,
      endDate: endDate || null,
      summary: {
        totalEvents,
        blocked: outcomes.blocked,
        intervened: outcomes.intervened,
        anonymized: outcomes.anonymized,
        passed: outcomes.passed,
        userCount: userIds.size,
        conversationCount: conversationIds.size,
        blockRate: totalEvents > 0 ? ((outcomes.blocked / totalEvents) * 100).toFixed(1) : 0,
      },
      outcomes,
      violations: violationsList,
      violationBreakdown,
      trend: trendAggregation.map(t => ({
        date: t._id,
        total: t.count,
        blocked: t.blocked,
        intervened: t.intervened,
        anonymized: t.anonymized,
      })),
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    logger.error('[Admin] Error in getGuardrailsMetrics:', error);
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
  getToolMetrics,
  getGuardrailsMetrics,
  MODEL_PRICING,
};
