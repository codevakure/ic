/**
 * Admin Conversations Controller
 * 
 * Handles conversation management endpoints for administrators.
 */

const { logger } = require('@librechat/data-schemas');
const conversationService = require('../services/conversationService');

/**
 * List conversations with pagination and filtering
 */
const listConversations = async (req, res) => {
  try {
    const {
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
    } = req.query;

    const result = await conversationService.listConversations({
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      userId,
      search,
      model,
      endpoint,
      startDate,
      endDate,
      sortBy,
      sortOrder,
    });

    res.status(200).json(result);
  } catch (error) {
    logger.error('[Admin] Error listing conversations:', error);
    res.status(500).json({ 
      message: 'Error listing conversations',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get detailed information about a specific conversation
 */
const getConversationDetails = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { includeMessages = false } = req.query;

    const conversation = await conversationService.getConversationById(
      conversationId,
      includeMessages === 'true' || includeMessages === true
    );

    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    res.status(200).json(conversation);
  } catch (error) {
    logger.error('[Admin] Error fetching conversation details:', error);
    res.status(500).json({ 
      message: 'Error fetching conversation details',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Delete a conversation and its messages
 */
const deleteConversation = async (req, res) => {
  try {
    const { conversationId } = req.params;

    const result = await conversationService.deleteConversation(conversationId);

    if (!result) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    res.status(200).json({ 
      message: 'Conversation deleted successfully',
      deletedMessages: result.deletedMessages
    });
  } catch (error) {
    logger.error('[Admin] Error deleting conversation:', error);
    res.status(500).json({ 
      message: 'Error deleting conversation',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = {
  listConversations,
  getConversationDetails,
  deleteConversation,
};
