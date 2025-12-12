/**
 * Admin Conversation Service
 * 
 * Service for conversation management operations.
 */

const { logger } = require('@ranger/data-schemas');
const { Conversation, Message, User } = require('~/db/models');
const { deleteMessages } = require('~/models');

/**
 * List conversations with pagination and filtering
 */
const listConversations = async ({
  page = 1,
  limit = 20,
  userId = '',
  search = '',
  model = '',
  endpoint = '',
  startDate = '',
  endDate = '',
  sortBy = 'updatedAt',
  sortOrder = 'desc',
}) => {
  try {
    const query = {};

    // User filter
    if (userId) {
      query.user = userId;
    }

    // Search filter (title)
    if (search) {
      query.title = { $regex: search, $options: 'i' };
    }

    // Model filter
    if (model) {
      query.model = model;
    }

    // Endpoint filter
    if (endpoint) {
      query.endpoint = endpoint;
    }

    // Date range filter
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        query.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        query.createdAt.$lte = new Date(endDate);
      }
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Get total count
    const total = await Conversation.countDocuments(query);

    // Get paginated conversations with user info
    const conversations = await Conversation.find(query)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('user', 'name email username')
      .lean();

    // Get message counts for each conversation
    const conversationsWithCounts = await Promise.all(
      conversations.map(async (conv) => {
        const messageCount = await Message.countDocuments({ 
          conversationId: conv.conversationId 
        });
        return {
          ...conv,
          messageCount,
        };
      })
    );

    return {
      conversations: conversationsWithCounts,
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
    logger.error('[Admin ConversationService] Error listing conversations:', error);
    throw error;
  }
};

/**
 * Get conversation by ID with optional messages
 */
const getConversationById = async (conversationId, includeMessages = false) => {
  try {
    const conversation = await Conversation.findOne({ conversationId })
      .populate('user', 'name email username')
      .lean();

    if (!conversation) {
      return null;
    }

    // Get message count
    const messageCount = await Message.countDocuments({ conversationId });

    const result = {
      ...conversation,
      messageCount,
    };

    // Include messages if requested
    if (includeMessages) {
      const messages = await Message.find({ conversationId })
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
      
      result.errorCount = errorCount;
      result.hasErrors = errorCount > 0;
      
      // Transform messages with error extraction
      result.messages = messages.map(msg => {
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
      });
    }

    return result;
  } catch (error) {
    logger.error('[Admin ConversationService] Error getting conversation:', error);
    throw error;
  }
};

/**
 * Delete a conversation and its messages
 */
const deleteConversation = async (conversationId) => {
  try {
    // Find the conversation first
    const conversation = await Conversation.findOne({ conversationId });

    if (!conversation) {
      return null;
    }

    // Delete all messages for this conversation
    const messageResult = await deleteMessages({ conversationId });

    // Delete the conversation
    await Conversation.deleteOne({ conversationId });

    return {
      deleted: true,
      deletedMessages: messageResult?.deletedCount || 0,
    };
  } catch (error) {
    logger.error('[Admin ConversationService] Error deleting conversation:', error);
    throw error;
  }
};

/**
 * Get available models from conversations
 */
const getAvailableModels = async () => {
  try {
    const models = await Conversation.distinct('model');
    return models.filter(m => m); // Filter out null/undefined
  } catch (error) {
    logger.error('[Admin ConversationService] Error getting models:', error);
    throw error;
  }
};

/**
 * Get available endpoints from conversations
 */
const getAvailableEndpoints = async () => {
  try {
    const endpoints = await Conversation.distinct('endpoint');
    return endpoints.filter(e => e); // Filter out null/undefined
  } catch (error) {
    logger.error('[Admin ConversationService] Error getting endpoints:', error);
    throw error;
  }
};

module.exports = {
  listConversations,
  getConversationById,
  deleteConversation,
  getAvailableModels,
  getAvailableEndpoints,
};
