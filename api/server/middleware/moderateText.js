const axios = require('axios');
const crypto = require('crypto');
const { isEnabled, sendEvent } = require('@librechat/api');
const { logger } = require('@librechat/data-schemas');
const { ErrorTypes, getResponseSender, EModelEndpoint } = require('librechat-data-provider');
const { getGuardrailsService } = require('@librechat/guardrails');
const { getEndpointsConfig } = require('~/server/services/Config');
const denyRequest = require('./denyRequest');
const { saveMessage } = require('~/models');

// Get guardrails service instance
const guardrailsService = getGuardrailsService();

// Log guardrails status on module load
logger.info('[moderateText] Guardrails service initialized', {
  enabled: guardrailsService.isEnabled(),
  guardrailId: process.env.BEDROCK_GUARDRAILS_ID || 'not set',
  version: process.env.BEDROCK_GUARDRAILS_VERSION || 'not set'
});

/**
 * Sends a guardrail response using the same pattern as sendError but as a success
 * Now includes violation details in the system context so LLM knows what was blocked
 */
async function sendGuardrailResponse(req, res, message, violationDetails = null) {
  const { messageId, conversationId: _convoId, parentMessageId, text } = req.body;
  const conversationId = _convoId ?? crypto.randomUUID();
  const user = req.user.id;

  // Send user message event
  const userMessage = {
    sender: 'User',
    messageId: messageId ?? crypto.randomUUID(),
    parentMessageId,
    conversationId,
    isCreatedByUser: true,
    text,
  };
  sendEvent(res, { message: userMessage, created: true });

  // ALWAYS save blocked user message for context (even for new conversations)
  // This ensures LLM has context about what was blocked in followup messages
  try {
    await saveMessage(
      req,
      { ...userMessage, user, conversationId },
      { context: 'sendGuardrailResponse - user message (BLOCKED by guardrails)' },
    );
  } catch (error) {
    logger.error('[moderateText] Failed to save blocked user message:', error);
  }

  // Keep response message clean - don't show violation details to user initially
  // The LLM will have context via metadata.systemNote and can explain if asked
  const responseText = message;

  // Get endpoint config to use correct sender name and icon
  let sender = 'Assistant';
  let iconURL = '/assets/icon-dark.svg';
  try {
    const endpointsConfig = await getEndpointsConfig(req);
    const bedrockConfig = endpointsConfig?.[EModelEndpoint.bedrock];
    sender = bedrockConfig?.modelDisplayLabel || 'Assistant';
    iconURL = bedrockConfig?.iconURL || '/assets/icon-dark.svg';
  } catch (error) {
    logger.warn('[moderateText] Failed to get endpoints config, using defaults', error);
  }

  // Create response message using config values
  // Include content array to match LLM response format (used for proper rendering)
  const responseMessage = {
    sender,
    messageId: crypto.randomUUID(),
    conversationId,
    parentMessageId: userMessage.messageId,
    endpoint: EModelEndpoint.bedrock,
    iconURL,
    unfinished: false,
    error: false,
    final: true,
    text: responseText,
    content: [{ type: 'text', text: responseText }],
    isCreatedByUser: false,
  };

  // ALWAYS save guardrail response with violation metadata for audit trail
  // violationDetails is now the complete metadata object from @librechat/guardrails
  try {
    await saveMessage(
      req,
      { 
        ...responseMessage, 
        user,
        conversationId,
        // Metadata comes pre-formatted from @librechat/guardrails package
        // Includes: guardrailBlocked, violations, originalUserMessage, blockReason, systemNote
        metadata: violationDetails
      },
      { context: 'sendGuardrailResponse - assistant message (GUARDRAIL BLOCK RESPONSE)' },
    );
  } catch (error) {
    logger.error('[moderateText] Failed to save guardrail response:', error);
  }

  // Send final response event
  return sendEvent(res, {
    final: true,
    requestMessage: userMessage,
    responseMessage: responseMessage,
    conversation: { conversationId, title: null },
  });
}

async function moderateText(req, res, next) {
  const { text } = req.body;
  const userId = req.user?.id;
  const startTime = Date.now();

  // Skip if no text to moderate
  if (!text || typeof text !== 'string') {
    return next();
  }

  // 🛡️ BEDROCK GUARDRAILS: Use high-level handler from @librechat/guardrails package
  // All guardrails logic is centralized in the package for maintainability
  if (guardrailsService.isEnabled()) {
    try {
      const result = await guardrailsService.handleInputModeration(text);
      const processingTime = Date.now() - startTime;
      
      if (result.blocked) {
        // ONLY LOG BLOCKED CONTENT
        logger.warn('[moderateText] 🚫 INPUT BLOCKED', {
          userId,
          time: `${processingTime}ms`,
          violations: result.violations?.map(v => `${v.type}:${v.category}`) || []
        });
        
        // Send response using centralized handler's data
        // metadata includes: guardrailBlocked, violations, systemNote, etc.
        return await sendGuardrailResponse(req, res, result.blockMessage, result.metadata);
      }

      // Content passed - continue (no logging for passed content)
      return next();

    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      logger.error('[moderateText] ❌ Bedrock Guardrails error:', {
        error: error.message,
        errorCode: error.code || error.name,
        userId,
        processingTime: `${processingTime}ms`,
        fallbackEnabled: isEnabled(process.env.OPENAI_MODERATION),
        errorType: error.constructor.name
      });
      
      // Fall through to OpenAI moderation if enabled, otherwise continue
      if (!isEnabled(process.env.OPENAI_MODERATION)) {
        return next();
      }
    }
  }

  // OpenAI moderation (original logic)
  if (!isEnabled(process.env.OPENAI_MODERATION)) {
    return next();
  }

  try {
    const response = await axios.post(
      process.env.OPENAI_MODERATION_REVERSE_PROXY || 'https://api.openai.com/v1/moderations',
      {
        input: text,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.OPENAI_MODERATION_API_KEY}`,
        },
      },
    );

    const results = response.data.results;
    const flagged = results.some((result) => result.flagged);

    if (flagged) {
      logger.warn('[moderateText] Content blocked by OpenAI moderation', { userId });
      const type = ErrorTypes.MODERATION;
      const errorMessage = { type };
      return await denyRequest(req, res, errorMessage);
    }
  } catch (error) {
    logger.error('Error in OpenAI moderation:', error);
    const errorMessage = 'error in moderation check';
    return await denyRequest(req, res, errorMessage);
  }
  
  next();
}

module.exports = moderateText;
