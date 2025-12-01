/**
 * LLM Tracing Functions
 * 
 * This module provides high-level functions for tracing LLM interactions
 * with Datadog LLM Observability.
 */


import { LLMObservabilityUtils } from './utils';
import { getTracer, getCurrentTraceContext } from './initialization';

import type {
  LLMTraceOptions,
  ConversationWorkflowOptions,
  UserSessionOptions,
  LLM_OPERATION_TYPES
} from './types';



/**
 * Wraps an LLM API call with Datadog observability
 */
export async function traceLLMCall(
  options: LLMTraceOptions,
  callback: () => Promise<any>
): Promise<any> {
  // DEBUG: console.log('[LLMObservability] DEBUG - traceLLMCall ENTRY with provider:', options.provider);
  const tracer = getTracer();
  
  const {
    provider,
    model,
    operationType = 'completion',
    userId,
    conversationId,
    messageId,
    metadata = {},
    temperature,
    maxTokens,
    stream = false
  } = options;

  // If LLM observability is not available, execute callback directly
  if (!tracer || !tracer.llmobs) {
    // DEBUG: console.log('[LLMObservability] DEBUG - LLM Observability not available, executing without tracing. Tracer:', !!tracer, 'LLMObs:', !!(tracer && tracer.llmobs));
    try {
      return await callback();
    } catch (error) {
      throw error;
    }
  }

  // For Bedrock provider, use enhanced correlation
  if (provider === 'bedrock') {
    try {
      const result = await traceLLMCallWithCorrelation(options, callback);
      return result;
    } catch (enhancedError: any) {
      console.error(`[LLMObservability] Enhanced LLM correlation failed for Bedrock - provider: ${provider}, model: ${model}, error: ${enhancedError.message}`);
      
      if (metadata) {
        metadata.correlation_attempted = 'enhanced_failed';
        metadata.fallback_reason = enhancedError.message;
      }
    }
  }

  const spanName = `llm.${provider}.${operationType}`;
  const startTime = Date.now();

  try {
    // Use getCurrentTraceContext for clarity and consistency
    const currentTraceContext = getCurrentTraceContext();

    // getCurrentTraceContext only returns traceId and spanId; cannot set tags on activeSpan here

    // Extract user metadata to add to span tags
    const userMetadata = LLMObservabilityUtils.extractUserMetadata(metadata.user);

    const llmSpanConfig = {
      kind: 'llm',
      name: spanName,
      modelName: model || 'unknown',
      modelProvider: provider === 'bedrock' ? 'amazon_bedrock' : provider.toUpperCase(),
      sessionId: conversationId,
      userId: userId,
      service: process.env.DD_SERVICE || 'librechat',
      tags: {
        'llm.operation_type': operationType,
        'llm.temperature': temperature,
        'llm.max_tokens': maxTokens,
        'llm.stream': stream,
        'trace.correlation': 'enabled',
        'active.trace.id': currentTraceContext?.traceId,
        'active.span.id': currentTraceContext?.spanId,
        // Add user metadata as tags for searchability
        'user.id': userId || userMetadata.user_id,
        'user.name': userMetadata.user_name || metadata.user_name || metadata['user.name'] || '',
        'user.email': userMetadata.user_email || metadata.user_email || metadata['user.email'] || '',
        'user.role': userMetadata.user_role || metadata.user_role || metadata['user.role'] || '',
        'agent.name': metadata.agent_name,
        'agent.type': metadata.agent_type,
        'agent.id': metadata.agent_id,
        // Feedback metadata as tags (only if present)
        ...(metadata.feedback_tag != null && metadata.feedback_tag !== '' ? { 'feedback.tag': metadata.feedback_tag } : {}),
        ...(metadata.feedback_rating != null && metadata.feedback_rating !== '' ? { 'feedback.rating': metadata.feedback_rating } : {}),
        ...(metadata.feedback_text != null && metadata.feedback_text !== '' ? { 'feedback.text': metadata.feedback_text } : {}),
        ...(metadata.feedback_source != null && metadata.feedback_source !== '' ? { 'feedback.source': metadata.feedback_source } : {}),
        ...(metadata.feedback_time != null && metadata.feedback_time !== '' ? { 'feedback.time': metadata.feedback_time } : {}),
        ...metadata
      }
    };

    return await tracer.llmobs.trace(
      llmSpanConfig,
      async (llmSpan: any) => {

        // ADDITIONAL: Try setting tags directly on the LLM span (if it has setTag method)
        if (llmSpan && typeof llmSpan.setTag === 'function') {
          try {
            llmSpan.setTag('user.id', userId || userMetadata.user_id);
            llmSpan.setTag('user.name', userMetadata.user_name);
            llmSpan.setTag('user.email', userMetadata.user_email);
            llmSpan.setTag('user.role', userMetadata.user_role);
            llmSpan.setTag('agent.name', metadata.agent_name);
            llmSpan.setTag('agent.type', metadata.agent_type);
            llmSpan.setTag('agent.id', metadata.agent_id);
          } catch (tagError) {
            // DEBUG: console.log('[LLMObservability] DEBUG - Failed to set tags directly on LLM span:', (tagError as any)?.message || 'Unknown error');
          }
        } else {
          // DEBUG: console.log('[LLMObservability] DEBUG - LLM span does not have setTag method');
        }

        let inputText = '';
        let outputText = '';

        try {
          const result = await callback();
          const duration = Date.now() - startTime;

          // Extract output text
          if (result) {
            outputText = extractOutputText(result);
            inputText = metadata.user_input || metadata.text || metadata.prompt || 
                       extractInputFromMessages(metadata.messages) || 'User message';
          }

          // Annotate the LLM span
          if (llmSpan && tracer.llmobs.annotate) {
            try {
              const extractedUserMetadata = LLMObservabilityUtils.extractUserMetadata(metadata.user);
              const annotationData = {
                inputData: inputText || 'User request',
                outputData: outputText || 'Assistant response',
                metadata: {
                  ...extractedUserMetadata,
                  tokens: result?.usage?.total_tokens,
                  input_tokens: result?.usage?.prompt_tokens || result?.usage?.input_tokens,
                  output_tokens: result?.usage?.completion_tokens || result?.usage?.output_tokens,
                  duration_ms: duration,
                  temperature,
                  maxTokens,
                  stream,
                  ...metadata
                },
                tags: {
                  'user.id': userId || extractedUserMetadata.user_id,
                  'user.name': extractedUserMetadata.user_name || metadata.user_name || metadata['user.name'] || '',
                  'user.email': extractedUserMetadata.user_email || metadata.user_email || metadata['user.email'] || '',
                  'user.role': extractedUserMetadata.user_role || metadata.user_role || metadata['user.role'] || '',
                  'agent.name': metadata.agent_name,
                  'agent.type': metadata.agent_type,
                  'agent.id': metadata.agent_id,
                  'llm.provider': provider,
                  'llm.model': model,
                  // Feedback metadata as tags (only if present)
                  ...(metadata.feedback_tag != null && metadata.feedback_tag !== '' ? { 'feedback.tag': metadata.feedback_tag } : {}),
                  ...(metadata.feedback_rating != null && metadata.feedback_rating !== '' ? { 'feedback.rating': metadata.feedback_rating } : {}),
                  ...(metadata.feedback_text != null && metadata.feedback_text !== '' ? { 'feedback.text': metadata.feedback_text } : {}),
                  ...(metadata.feedback_source != null && metadata.feedback_source !== '' ? { 'feedback.source': metadata.feedback_source } : {}),
                  ...(metadata.feedback_time != null && metadata.feedback_time !== '' ? { 'feedback.time': metadata.feedback_time } : {})
                }
              };

              const annotateResult = tracer.llmobs.annotate(llmSpan, annotationData);
              if (annotateResult && typeof annotateResult.then === 'function') {
                await annotateResult;
              }
            } catch (annotateError: any) {
              console.error(`[LLMObservability] Annotation failed: ${annotateError.message}`);
            }
          }

          return result;

        } catch (error: any) {
          const duration = Date.now() - startTime;
          console.error(`[LLMObservability] LLM call failed: ${spanName} - provider: ${provider}, model: ${model}, error: ${error.message}, duration: ${duration}ms`);
          throw error;
        }
      }
    );
  } catch (llmObsError: any) {
    console.error(`[LLMObservability] Tracing failed - provider: ${provider}, model: ${model}, error: ${llmObsError.message}`);

    try {
      return await callback();
    } catch (callbackError) {
      throw callbackError;
    }
  }
}/**
 * Enhanced wrapper for LLM calls with comprehensive user tracking
 */
export async function traceLLMCallWithUser(
  options: LLMTraceOptions & { user?: any },
  callback: () => Promise<any>
): Promise<any> {
  try {
    const { user, ...rest } = options;
    const userMetadata = LLMObservabilityUtils.extractUserMetadata(user);
    
    const enhancedOptions = {
      ...rest,
      userId: user?.id || user?._id,
      metadata: {
        ...rest.metadata,
        ...userMetadata,
        user
      }
    };
    
    // DEBUG: console.log('[LLMObservability] DEBUG - About to call traceLLMCall with provider:', enhancedOptions.provider);
    
    return await traceLLMCall(enhancedOptions, callback);
  } catch (error) {
    try {
      return await callback();
    } catch (callbackError) {
      throw callbackError;
    }
  }
}

/**
 * Traces a conversation workflow
 */
export async function traceConversationWorkflow(
  options: ConversationWorkflowOptions,
  callback: (span?: any) => Promise<any>
): Promise<any> {
  const tracer = getTracer();
  
  const {
    conversationId,
    userId,
    user,
    workflowType = 'chat',
    metadata = {}
  } = options;

  if (!tracer) {
    try {
      return await callback();
    } catch (error) {
      throw error;
    }
  }

  const spanName = `conversation.${workflowType}`;
  const startTime = Date.now();

  try {
    return await tracer.trace(spanName, {
      service: process.env.DD_SERVICE || 'librechat',
      resource: `conversation.${workflowType}`,
      type: 'workflow'
    }, async (span: any) => {
      try {
        span.setTag('conversation.id', conversationId);
        span.setTag('conversation.workflow_type', workflowType);
        
        if (user) {
          const userMeta = LLMObservabilityUtils.extractUserMetadata(user);
          Object.entries(userMeta).forEach(([key, value]) => {
            span.setTag(key, value);
          });
        } else if (userId) {
          span.setTag('user.id', userId);
        }
        
        // Add metadata as tags
        Object.entries(metadata).forEach(([key, value]) => {
          span.setTag(`workflow.${key}`, value);
        });

        const result = await callback(span);
        const duration = Date.now() - startTime;
        
        span.setTag('conversation.duration_ms', duration);
        span.setTag('conversation.status', 'success');

        return result;

      } catch (error: any) {
        const duration = Date.now() - startTime;
        span.setTag('conversation.duration_ms', duration);
        span.setTag('conversation.status', 'error');
        span.setTag('error.message', error.message);
        throw error;
      }
    });
  } catch (tracingError) {
    try {
      return await callback();
    } catch (callbackError) {
      throw callbackError;
    }
  }
}

/**
 * Traces user session activity
 */
export async function traceUserSession(
  options: UserSessionOptions,
  callback: (span?: any) => Promise<any>
): Promise<any> {
  const tracer = getTracer();
  
  const {
    userId,
    sessionId,
    activity = 'general',
    metadata = {}
  } = options;

  if (!tracer) {
    return await callback();
  }

  const spanName = `session.${activity}`;

  return await tracer.trace(spanName, {
    service: process.env.DD_SERVICE || 'librechat',
    resource: `session.${activity}`,
    type: 'session'
  }, async (span: any) => {
    try {
      span.setTag('user.id', userId);
      span.setTag('session.id', sessionId);
      span.setTag('session.activity', activity);
      
      Object.entries(metadata).forEach(([key, value]) => {
        span.setTag(`session.${key}`, value);
      });

      const result = await callback(span);
      span.setTag('session.status', 'success');
      
      return result;

    } catch (error: any) {
      span.setTag('session.status', 'error');
      span.setTag('error.message', error.message);
      throw error;
    }
  });
}
}

/**
 * Records a custom metric for LLM operations
 */
export function recordLLMMetric(metricName: string, value: number, tags: Record<string, any> = {}): void {
  const tracer = getTracer();
  
  if (!tracer) {
    return;
  }

  try {
    if (tracer.dogstatsd) {
      const tagArray = Object.entries(tags).map(([key, val]) => `${key}:${val}`);
      tracer.dogstatsd.increment(metricName, value, tagArray);
    }
  } catch (error: any) {
    console.debug(`Failed to record metric ${metricName}:`, error.message);
  }
}

// Helper functions

function extractOutputText(result: any): string {
  if (!result) return 'Response content not captured';
  
  if (result.text && typeof result.text === 'string') {
    return result.text;
  }
  
  if (result.content) {
    if (Array.isArray(result.content)) {
      const textParts = result.content
        .filter((part: any) => part && part.type === 'text')
        .map((part: any) => part.text || '');
      return textParts.join('\n') || 'Response content not captured';
    } else if (typeof result.content === 'string') {
      return result.content;
    }
  }
  
  if (result.message?.content) {
    return result.message.content;
  }
  
  if (result.choices?.[0]?.message?.content) {
    return result.choices[0].message.content;
  }
  
  if (result.contentParts && Array.isArray(result.contentParts)) {
    const textParts = result.contentParts
      .filter((part: any) => part && part.type === 'text')
      .map((part: any) => part.text || '');
    return textParts.join('\n') || 'Response content not captured';
  }
  
  return 'Response content not captured';
}

function extractInputFromMessages(messages: any): string | null {
  if (!messages || !Array.isArray(messages)) {
    return null;
  }
  
  const userMessages = messages
    .filter((msg: any) => msg.role === 'user')
    .map((msg: any) => msg.content)
    .filter((content: any) => content && typeof content === 'string' && content.trim().length > 0);
  
  if (userMessages.length > 0) {
    return userMessages[userMessages.length - 1];
  }
  
  return null;
}

/**
 * Enhanced trace for Bedrock with better correlation
 */
async function traceLLMCallWithCorrelation(
  options: LLMTraceOptions,
  callback: () => Promise<any>
): Promise<any> {
  const tracer = getTracer();
  
  if (!tracer || !tracer.llmobs) {
    return await callback();
  }

  const {
    provider,
    model,
    operationType = 'completion',
    userId,
    conversationId,
    metadata = {}
  } = options;

  const spanName = `llm.${provider}.${operationType}`;
  
  try {
    const wrapperSpanName = `${spanName}.wrapper`;
    const wrapperConfig = {
      service: process.env.DD_SERVICE || 'librechat',
      resource: `${provider}.${model}`,
      type: 'llm_operation'
    };
    
    return await tracer.trace(wrapperSpanName, wrapperConfig, async (wrapperSpan: any) => {
      try {
  // Extract user metadata to add as tags
  const userMetadata = LLMObservabilityUtils.extractUserMetadata(metadata.user || metadata);
        
        wrapperSpan.setTag('llm.provider', provider);
        wrapperSpan.setTag('llm.model', model);
        wrapperSpan.setTag('llm.operation_type', operationType);
        wrapperSpan.setTag('user.id', userId);
        wrapperSpan.setTag('conversation.id', conversationId);
        
        // *** ADD USER TAGS - This was missing! ***
        wrapperSpan.setTag('user.name', userMetadata.user_name);
        wrapperSpan.setTag('user.email', userMetadata.user_email);
        wrapperSpan.setTag('user.role', userMetadata.user_role);
        
        if (metadata) {
          if (metadata.agent_name) wrapperSpan.setTag('agent.name', metadata.agent_name);
          if (metadata.agent_type) wrapperSpan.setTag('agent.type', metadata.agent_type);
          if (metadata.agent_id) wrapperSpan.setTag('agent.id', metadata.agent_id);
          
          // Add all user metadata as tags
          Object.entries(userMetadata).forEach(([key, value]) => {
            wrapperSpan.setTag(key, value);
          });
        }
        
        // *** CREATE THE ACTUAL LLM OBSERVABILITY SPAN ***
        const llmSpanConfig = {
          kind: 'llm',
          name: spanName,
          modelName: model || 'unknown',
          modelProvider: provider === 'bedrock' ? 'amazon_bedrock' : provider.toUpperCase(),
          sessionId: conversationId,
          userId: userId,
          service: process.env.DD_SERVICE || 'librechat',
          tags: {
            'llm.operation_type': operationType,
            'trace.correlation': 'enabled',
            // Add user metadata as tags for searchability in LLM view
            'user.id': userId || userMetadata.user_id,
            'user.name': userMetadata.user_name,
            'user.email': userMetadata.user_email,
            'user.role': userMetadata.user_role,
            'agent.name': metadata.agent_name,
            'agent.type': metadata.agent_type,
            'agent.id': metadata.agent_id,
            // Feedback metadata as tags (only if present)
            ...(metadata.feedback_tag != null && metadata.feedback_tag !== '' ? { 'feedback.tag': metadata.feedback_tag } : {}),
            ...(metadata.feedback_rating != null && metadata.feedback_rating !== '' ? { 'feedback.rating': metadata.feedback_rating } : {}),
            ...(metadata.feedback_text != null && metadata.feedback_text !== '' ? { 'feedback.text': metadata.feedback_text } : {}),
            ...(metadata.feedback_source != null && metadata.feedback_source !== '' ? { 'feedback.source': metadata.feedback_source } : {}),
            ...(metadata.feedback_time != null && metadata.feedback_time !== '' ? { 'feedback.time': metadata.feedback_time } : {}),
            ...userMetadata,
            ...metadata
          }
        };
        
        // DEBUG logging removed for cleaner output
        
        return await tracer.llmobs.trace(llmSpanConfig, async (llmSpan: any) => {
          
          const startTime = Date.now();
          const result = await callback();
          const duration = Date.now() - startTime;
          
          wrapperSpan.setTag('llm.status', 'success');
          wrapperSpan.setTag('llm.duration_ms', duration);
          
          // Extract input/output for LLM annotation if available
          if (llmSpan && tracer.llmobs.annotate) {
            try {
              // Use the same feedback detection logic as the main traceLLMCall
              let inputText;
              const isFeedback = (metadata.feedback_rating != null && metadata.feedback_rating !== '') ||
                                (metadata.feedback_tag != null && metadata.feedback_tag !== '');
              if (isFeedback) {
                inputText = 'User feedback';
              } else {
                inputText = metadata.user_input || metadata.text || metadata.prompt || 
                             extractInputFromMessages(metadata.messages) || 'User request';
              }
              const outputText = extractOutputText(result);
              
              const annotationData = {
                inputData: inputText || 'User request',
                outputData: outputText || 'Assistant response',
                metadata: (() => {
                  // Remove 'user' property if present in metadata
                  const { user, ...metaWithoutUser } = { ...userMetadata, ...metadata };
                  return {
                    ...metaWithoutUser,
                    tokens: result?.usage?.total_tokens,
                    input_tokens: result?.usage?.prompt_tokens || result?.usage?.input_tokens,
                    output_tokens: result?.usage?.completion_tokens || result?.usage?.output_tokens,
                    duration_ms: duration
                  };
                })(),
                tags: {
                  'user.id': userId || userMetadata.user_id,
                  'user.name': userMetadata.user_name || metadata.user_name || metadata['user.name'] || '',
                  'user.email': userMetadata.user_email || metadata.user_email || metadata['user.email'] || '',
                  'user.role': userMetadata.user_role || metadata.user_role || metadata['user.role'] || '',
                  'agent.name': metadata.agent_name,
                  'agent.type': metadata.agent_type,
                  'agent.id': metadata.agent_id,
                  'llm.provider': provider,
                  'llm.model': model,
                  // Feedback metadata as tags (only if present)
                  ...(metadata.feedback_tag != null && metadata.feedback_tag !== '' ? { 'feedback.tag': metadata.feedback_tag } : {}),
                  ...(metadata.feedback_rating != null && metadata.feedback_rating !== '' ? { 'feedback.rating': metadata.feedback_rating } : {}),
                  ...(metadata.feedback_text != null && metadata.feedback_text !== '' ? { 'feedback.text': metadata.feedback_text } : {}),
                  ...(metadata.feedback_source != null && metadata.feedback_source !== '' ? { 'feedback.source': metadata.feedback_source } : {}),
                  ...(metadata.feedback_time != null && metadata.feedback_time !== '' ? { 'feedback.time': metadata.feedback_time } : {})
                }
              };
        
              const annotateResult = tracer.llmobs.annotate(llmSpan, annotationData);
              if (annotateResult && typeof annotateResult.then === 'function') {
                await annotateResult;
              }
            } catch (annotateError: any) {
              console.error(`[LLMObservability] Annotation failed in Bedrock correlation: ${annotateError.message}`);
            }
          }
          
          return result;
        });
        
      } catch (error: any) {
        wrapperSpan.setTag('llm.status', 'error');
        wrapperSpan.setTag('error.message', error.message);
        throw error;
      }
    });
  } catch (wrapperError) {
    return await callback();
  }
}

/**
 * Records user feedback for an LLM interaction
 */

// Optional: Provide a user lookup function for enriching user details in feedback traces
// You must set this from your application code
export let getUserById: undefined | ((userId: string) => Promise<any>) = undefined;
export function setGetUserById(fn: (userId: string) => Promise<any>) {
  getUserById = fn;
}


export async function recordLLMFeedback(options: {
  provider?: string;
  model?: string;
  userId?: string;
  conversationId?: string;
  messageId?: string;
  user?: any;
  feedback: {
    tag?: string;
    rating?: number;
    text?: string;
    metadata?: Record<string, any>;
  };
}): Promise<any> {
  // Always build a user object for metadata.user, even if only userId is provided
  let userObj = options.user;
  if (!userObj && options.userId) {
    // Try to enrich user object with name/email/role from feedback.metadata if available
    const meta = options.feedback?.metadata || {};
    userObj = {
      id: options.userId,
      name: meta.user_name || meta.name,
      email: meta.user_email || meta.email,
      role: meta.user_role || meta.role
    };
    // If getUserById is available, fetch user details
    if (getUserById) {
      try {
        const dbUser = await getUserById(options.userId);
        if (dbUser) {
          userObj = { ...userObj, ...dbUser };
        }
      } catch (e) {
        // Ignore user lookup errors, fallback to minimal userObj
      }
    }
  }
  
  const userMetadata = LLMObservabilityUtils.extractUserMetadata(userObj || {});
  // Compose feedback metadata for tags and metadata
  const feedbackMetadata: Record<string, any> = {
    feedback_tag: options.feedback.tag,
    feedback_rating: options.feedback.rating,
    feedback_text: options.feedback.text,
    feedback_source: 'user',
    feedback_time: new Date().toISOString(),
    // Map user fields to Datadog tag format
    'user.id': userMetadata.user_id || '',
    'user.name': userMetadata.user_name || '',
    'user.email': userMetadata.user_email || '',
    'user.role': userMetadata.user_role || '',
    ...(options.feedback.metadata || {}),
    // Do NOT include the full user object in feedbackMetadata; only flat fields are needed for tags
  };
  // Do NOT include the full user object in feedbackMetadata; only flat fields are needed for tags
  return traceLLMCall({
    provider: (options.provider || 'custom') as any,
    model: options.model || 'unknown',
    operationType: 'completion' as any,
    userId: options.userId,
    conversationId: options.conversationId,
    messageId: options.messageId,
    metadata: feedbackMetadata,
  }, async () => ({}));
}
