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
  console.log('[LLMObservability] DEBUG - traceLLMCall ENTRY with provider:', options.provider);
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
    console.log('[LLMObservability] DEBUG - LLM Observability not available, executing without tracing. Tracer:', !!tracer, 'LLMObs:', !!(tracer && tracer.llmobs));
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
      console.error('Enhanced LLM correlation failed for Bedrock', {
        provider,
        model,
        error: enhancedError.message
      });
      
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

    // Normalize model name for Datadog (e.g., claude-haiku, claude-sonnet, claude-opus)
        // let ddModelName = model;
        // if (typeof model === 'string') {
        //   const lowerModel = model.toLowerCase();
        //   if (lowerModel.includes('sonnet')) {
        //     ddModelName = 'claude-sonnet';
        //   } else if (lowerModel.includes('haiku')) {
        //     ddModelName = 'claude-haiku';
        //   } else if (lowerModel.includes('opus')) {
        //     ddModelName = 'claude-opus';
        //   } else {
        //     // Fallback: remove region prefix and version suffixes
        //     ddModelName = model.replace(/^us[-_.]/i, '').replace(/[-_.]\d{6,}(?:-v\d+)?(:\d+)?$/i, '');
        //   }
        // }

    const llmSpanConfig = {
      kind: 'llm',
      name: spanName,
      modelName: model || 'unknown',
      modelProvider: provider === 'bedrock' ? 'amazon_bedrock' : provider.toUpperCase(),
      sessionId: conversationId,
      userId: userId,
      service: process.env.DD_SERVICE || 'ranger',
      tags: {
        'llm.operation_type': operationType,
        'llm.temperature': temperature,
        'llm.max_tokens': maxTokens,
        'llm.stream': stream,
        'trace.correlation': 'enabled',
        'active.trace.id': currentTraceContext?.traceId,
        'active.span.id': currentTraceContext?.spanId,
        // Agent and functionality tags for Datadog filtering/grouping
        'agent.name': metadata.agent_name,
        'agent.id': metadata.agent_id,
        'agent.type': metadata.agent_type,
        'functionality': metadata.functionality || operationType,
        'operationType': operationType,
        'endpoint': metadata.endpoint || '',
        // Operation metadata for filtering user actions
        'operation': metadata.operation || metadata.endpoint_name || operationType,
        'operation.type': metadata.operation_type || operationType,
        'operation.name': metadata.operation_name || metadata.endpoint_name || '',
        'operation.is_regenerate': metadata.is_regenerate || false,
        'operation.is_continued': metadata.is_continued || false,
        // Add user metadata as tags for searchability
        'user.id': userId || userMetadata.user_id,
        'user.name': userMetadata.user_name || metadata.user_name || metadata['user.name'] || '',
        'user.email': userMetadata.user_email || metadata.user_email || metadata['user.email'] || '',
        'user.role': userMetadata.user_role || metadata.user_role || metadata['user.role'] || '',
        // Normalized model name for Datadog filtering
        'llm.model': model || 'unknown',
        // Tool availability tags for filtering
        ...(metadata.tool_web_search_available !== undefined ? { 'tool.web_search_available': metadata.tool_web_search_available } : {}),
        ...(metadata.tool_file_search_available !== undefined ? { 'tool.file_search_available': metadata.tool_file_search_available } : {}),
        ...(metadata.tool_code_execution_available !== undefined ? { 'tool.code_execution_available': metadata.tool_code_execution_available } : {}),
        ...(metadata.tools_available_count !== undefined ? { 'tools.available_count': metadata.tools_available_count } : {}),
        // MCP server tags for filtering by specific MCP servers
        ...(metadata.mcp_servers !== undefined ? { 'mcp.servers': metadata.mcp_servers } : {}),
        ...(metadata.mcp_servers_count !== undefined ? { 'mcp.servers_count': metadata.mcp_servers_count } : {}),
        ...(metadata.mcp_servers_available !== undefined ? { 'mcp.servers_available': metadata.mcp_servers_available } : {}),
        ...(metadata['mcp.ms365_enabled'] !== undefined ? { 'mcp.ms365_enabled': metadata['mcp.ms365_enabled'] } : {}),
        // Feedback metadata as tags (only if present)
        ...(metadata.feedback_tag != null && metadata.feedback_tag !== '' ? { 'feedback.tag': metadata.feedback_tag } : {}),
        ...(metadata.feedback_rating != null && metadata.feedback_rating !== '' ? { 'feedback.rating': metadata.feedback_rating } : {}),
        ...(metadata.feedback_text != null && metadata.feedback_text !== '' ? { 'feedback.text': metadata.feedback_text } : {}),
        ...(metadata.feedback_source != null && metadata.feedback_source !== '' ? { 'feedback.source': metadata.feedback_source } : {}),
        ...(metadata.feedback_time != null && metadata.feedback_time !== '' ? { 'feedback.time': metadata.feedback_time } : {}),
        ...metadata
      }
    };    return await tracer.llmobs.trace(
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
            llmSpan.setTag('agent.id', metadata.agent_id);
            llmSpan.setTag('agent.type', metadata.agent_type);
            llmSpan.setTag('functionality', metadata.functionality || operationType);
            llmSpan.setTag('operationType', operationType);
            llmSpan.setTag('endpoint', metadata.endpoint || '');
            // Add token tags for Datadog trace UI
            if (metadata.input_tokens !== undefined) llmSpan.setTag('trace.input_tokens', metadata.input_tokens);
            if (metadata.output_tokens !== undefined) llmSpan.setTag('trace.output_tokens', metadata.output_tokens);
            if (metadata.tokens !== undefined) llmSpan.setTag('trace.total_tokens', metadata.tokens);
          } catch (tagError) {
            console.log('[LLMObservability] DEBUG - Failed to set tags directly on LLM span:', (tagError as any)?.message || 'Unknown error');
          }
        } else {
          console.log('[LLMObservability] DEBUG - LLM span does not have setTag method');
        }

        let inputText = '';
        let outputText = '';

        try {

          const result = await callback();
          const duration = Date.now() - startTime;

          // Fallback: If result.usage is missing, but promptTokens/completionTokens are present at the top level, map them into a usage object for tracing.
          // This ensures Datadog always receives input/output token info.
          if (result && !result.usage && (result.promptTokens || result.completionTokens)) {
            result.usage = {
              prompt_tokens: result.promptTokens,
              completion_tokens: result.completionTokens,
              total_tokens: (result.promptTokens || 0) + (result.completionTokens || 0)
            };
          }

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
                  // These fields will now always be present if promptTokens/completionTokens are available
                  tokens: result?.usage?.total_tokens,
                  input_tokens: result?.usage?.prompt_tokens || result?.usage?.input_tokens,
                  output_tokens: result?.usage?.completion_tokens || result?.usage?.output_tokens,
                  duration_ms: duration,
                  temperature,
                  maxTokens,
                  stream,
                  // Operation metadata
                  operation: metadata.operation || metadata.endpoint_name || operationType,
                  operation_type: metadata.operation_type || operationType,
                  operation_name: metadata.operation_name || metadata.endpoint_name || '',
                  is_regenerate: metadata.is_regenerate || false,
                  is_continued: metadata.is_continued || false,
                  // Guardrail metadata
                  ...(result?.guardrails ? {
                    guardrail_input_checked: result.guardrails.input_checked,
                    guardrail_output_checked: result.guardrails.output_checked,
                    guardrail_input_has_context: result.guardrails.input_has_context,
                    guardrail_output_blocked: result.guardrails.output_blocked,
                    guardrail_input_system_note: result.guardrails.input_system_note,
                    guardrail_output_text_length: result.guardrails.output_text_length,
                    guardrail_output_violations: result.guardrails.output_violations?.join(', '),
                    guardrail_output_error: result.guardrails.output_error
                  } : {}),
                  ...metadata
                },
                tags: {
                  'user.id': userId || extractedUserMetadata.user_id,
                  'user.name': extractedUserMetadata.user_name || metadata.user_name || metadata['user.name'] || '',
                  'user.email': extractedUserMetadata.user_email || metadata.user_email || metadata['user.email'] || '',
                  'user.role': extractedUserMetadata.user_role || metadata.user_role || metadata['user.role'] || '',
                  'agent.name': metadata.agent_name,
                  'agent.id': metadata.agent_id,
                  'agent.type': metadata.agent_type,
                  'functionality': metadata.functionality || operationType,
                  'operationType': operationType,
                  'endpoint': metadata.endpoint || '',
                  // Operation metadata for filtering user actions
                  'operation': metadata.operation || metadata.endpoint_name || operationType,
                  'operation.type': metadata.operation_type || operationType,
                  'operation.name': metadata.operation_name || metadata.endpoint_name || '',
                  'operation.is_regenerate': metadata.is_regenerate || false,
                  'operation.is_continued': metadata.is_continued || false,
                  'llm.provider': provider === 'bedrock' ? 'amazon_bedrock' : provider.toUpperCase(),
                  'llm.model': model || 'unknown',
                  // Tool availability tags for filtering
                  ...(metadata.tool_web_search_available !== undefined ? { 'tool.web_search_available': metadata.tool_web_search_available } : {}),
                  ...(metadata.tool_file_search_available !== undefined ? { 'tool.file_search_available': metadata.tool_file_search_available } : {}),
                  ...(metadata.tool_code_execution_available !== undefined ? { 'tool.code_execution_available': metadata.tool_code_execution_available } : {}),
                  ...(metadata.tools_available_count !== undefined ? { 'tools.available_count': metadata.tools_available_count } : {}),
                  // MCP server tags for filtering by specific MCP servers
                  ...(metadata.mcp_servers !== undefined ? { 'mcp.servers': metadata.mcp_servers } : {}),
                  ...(metadata.mcp_servers_count !== undefined ? { 'mcp.servers_count': metadata.mcp_servers_count } : {}),
                  ...(metadata.mcp_servers_available !== undefined ? { 'mcp.servers_available': metadata.mcp_servers_available } : {}),
                  ...(metadata['mcp.ms365_enabled'] !== undefined ? { 'mcp.ms365_enabled': metadata['mcp.ms365_enabled'] } : {}),
                  // Guardrail tags for filtering
                  ...(result?.guardrails?.input_checked !== undefined ? { 'guardrail.input_checked': result.guardrails.input_checked } : {}),
                  ...(result?.guardrails?.output_checked !== undefined ? { 'guardrail.output_checked': result.guardrails.output_checked } : {}),
                  ...(result?.guardrails?.input_has_context !== undefined ? { 'guardrail.input_has_context': result.guardrails.input_has_context } : {}),
                  ...(result?.guardrails?.output_blocked !== undefined ? { 'guardrail.output_blocked': result.guardrails.output_blocked } : {}),
                  // Feedback metadata as tags (only if present)
                  ...(metadata.feedback_tag != null && metadata.feedback_tag !== '' ? { 'feedback.tag': metadata.feedback_tag } : {}),
                  ...(metadata.feedback_rating != null && metadata.feedback_rating !== '' ? { 'feedback.rating': metadata.feedback_rating } : {}),
                  ...(metadata.feedback_text != null && metadata.feedback_text !== '' ? { 'feedback.text': metadata.feedback_text } : {}),
                  ...(metadata.feedback_source != null && metadata.feedback_source !== '' ? { 'feedback.source': metadata.feedback_source } : {}),
                  ...(metadata.feedback_time != null && metadata.feedback_time !== '' ? { 'feedback.time': metadata.feedback_time } : {}),
                  // Add token tags for Datadog trace UI
                  ...(result?.usage?.prompt_tokens !== undefined ? { 'trace.input_tokens': result.usage.prompt_tokens } : {}),
                  ...(result?.usage?.completion_tokens !== undefined ? { 'trace.output_tokens': result.usage.completion_tokens } : {}),
                  ...(result?.usage?.total_tokens !== undefined ? { 'trace.total_tokens': result.usage.total_tokens } : {})
                }
              };

              const annotateResult = tracer.llmobs.annotate(llmSpan, annotationData);
              if (annotateResult && typeof annotateResult.then === 'function') {
                await annotateResult;
              }
            } catch (annotateError: any) {
              console.error('LLM Observability annotation failed', {
                error: annotateError.message
              });
            }
          }

          return result;

        } catch (error: any) {
          const duration = Date.now() - startTime;
          console.error(`LLM call failed: ${spanName}`, {
            provider,
            model,
            error: error.message,
            duration
          });
          throw error;
        }
      }
    );
  } catch (llmObsError: any) {
    console.error('LLM Observability tracing failed', {
      error: llmObsError.message,
      provider,
      model
    });

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
    
    console.log('[LLMObservability] DEBUG - About to call traceLLMCall with provider:', enhancedOptions.provider);
    
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
 * Traces a conversation workflow - basant starts here
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
      service: process.env.DD_SERVICE || 'ranger',
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
    service: process.env.DD_SERVICE || 'ranger',
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
// ...existing code...
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
 * Enhanced trace for Bedrock with better correlation - basant - this is where we need fix
 */
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
      service: process.env.DD_SERVICE || 'ranger',
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
        //Basant this span is responsible for tracing the LLM call
        // Datadog cost estimation requires modelProvider: 'anthropic' and exact model names from Claude docs
        // Map AWS Bedrock model IDs to Datadog-recognized Claude model names
        // let ddModelName = model;
        // if (typeof model === 'string') {
        //   const lowerModel = model.toLowerCase();
        //   // Map to exact Datadog-supported Claude model names for cost estimation
        //   // Reference: https://docs.anthropic.com/en/docs/about-claude/models
        //   if (lowerModel.includes('haiku')) {
        //     // Claude 3.5 Haiku (latest as of Nov 2024)
        //     ddModelName = 'claude-3-5-haiku-20241022';
        //   } else if (lowerModel.includes('sonnet')) {
        //     // Claude 3.5 Sonnet (latest as of Nov 2024)
        //     ddModelName = 'claude-3-5-sonnet-20241022';
        //   } else if (lowerModel.includes('opus')) {
        //     // Claude 3 Opus
        //     ddModelName = 'claude-3-opus-20240229';
        //   } else {
        //     // Fallback: remove region prefix and version suffixes
        //     ddModelName = model.replace(/^us[-_.]/i, '').replace(/[-_.]\d{6,}(?:-v\d+)?(:\d+)?$/i, '');
        //   }
        // }
        
        // console.log('[LLMObservability] DEBUG - Model name transformation:', {
        //   original: model,
        //   transformed: ddModelName,
        //   provider: 'anthropic'
        // });
        
        // Create an LLM span for Datadog cost estimation
        // Must use kind: 'llm' with modelName and modelProvider for cost calculation
        // LangChain spans will also appear but this span has correct model info
        const llmSpanConfig = {
          kind: 'llm',  // MUST be 'llm' for Datadog cost estimation
          name: spanName,
          modelName: model || 'unknown',
          modelProvider: provider === 'bedrock' ? 'amazon_bedrock' : provider.toUpperCase(),
          sessionId: conversationId,
          service: process.env.DD_SERVICE || 'ranger',
          tags: {
            // Model information for reference - use 'anthropic' for cost estimation
            'llm.model_name': model || 'unknown',
            'llm.model_provider': provider === 'bedrock' ? 'amazon_bedrock' : provider.toUpperCase(),
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
            // Operation metadata for filtering user actions
            'operation': metadata.operation || metadata.endpoint_name || operationType,
            'operation.type': metadata.operation_type || operationType,
            'operation.name': metadata.operation_name || metadata.endpoint_name || '',
            'operation.is_regenerate': metadata.is_regenerate || false,
            'operation.is_continued': metadata.is_continued || false,
            // Normalized model name for Datadog filtering
            'llm.model': model || 'unknown',
            // Tool availability tags for filtering
            ...(metadata.tool_web_search_available !== undefined ? { 'tool.web_search_available': metadata.tool_web_search_available } : {}),
            ...(metadata.tool_file_search_available !== undefined ? { 'tool.file_search_available': metadata.tool_file_search_available } : {}),
            ...(metadata.tool_code_execution_available !== undefined ? { 'tool.code_execution_available': metadata.tool_code_execution_available } : {}),
            ...(metadata.tools_available_count !== undefined ? { 'tools.available_count': metadata.tools_available_count } : {}),
            // MCP server tags for filtering by specific MCP servers
            ...(metadata.mcp_servers !== undefined ? { 'mcp.servers': metadata.mcp_servers } : {}),
            ...(metadata.mcp_servers_count !== undefined ? { 'mcp.servers_count': metadata.mcp_servers_count } : {}),
            ...(metadata.mcp_servers_available !== undefined ? { 'mcp.servers_available': metadata.mcp_servers_available } : {}),
            ...(metadata['mcp.ms365_enabled'] !== undefined ? { 'mcp.ms365_enabled': metadata['mcp.ms365_enabled'] } : {}),
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
        
        console.log('[LLMObservability] DEBUG - Creating workflow span with config:', {
          spanName,
          modelName: model || 'unknown',
          modelProvider: provider === 'bedrock' ? 'amazon_bedrock' : provider.toUpperCase(),
          userId: userId,
          tagsCount: Object.keys(llmSpanConfig.tags).length
        });
        
        console.log('[LLMObservability] DEBUG - Creating LLM Observability span...');
        return await tracer.llmobs.trace(llmSpanConfig, async (llmSpan: any) => {
          console.log('[LLMObservability] DEBUG - Inside LLM span callback, llmSpan:', !!llmSpan);
          
          const startTime = Date.now();
          const result = await callback();
          const duration = Date.now() - startTime;
          
          console.log('[LLMObservability] DEBUG - Callback completed, duration:', duration);
          wrapperSpan.setTag('llm.status', 'success');
          wrapperSpan.setTag('llm.duration_ms', duration);
          
          // Extract input/output for LLM annotation if available
          if (llmSpan && tracer.llmobs && tracer.llmobs.annotate) {
            try {
              console.log('[LLMObservability] DEBUG - LLM span available for annotation');
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
              
              console.log('[LLMObservability] DEBUG - Extracted input/output:', {
                inputLength: inputText?.length || 0,
                outputLength: outputText?.length || 0
              });
              
              // Debug: Log the raw result object structure
              console.log('[LLMObservability] DEBUG - Raw result structure:', {
                hasUsage: !!result?.usage,
                hasPromptTokens: !!result?.promptTokens,
                hasCompletionTokens: !!result?.completionTokens,
                promptTokens: result?.promptTokens,
                completionTokens: result?.completionTokens,
                usage: result?.usage
              });

              if (result && !result.usage && (result.promptTokens || result.completionTokens)) {
                result.usage = {
                  prompt_tokens: result.promptTokens,
                  completion_tokens: result.completionTokens,
                  total_tokens: (result.promptTokens || 0) + (result.completionTokens || 0)
                };
              }

              // Extract token counts from result.usage (actual API usage from client)
              const inputTokenVal = result?.usage?.prompt_tokens ?? result?.usage?.input_tokens ?? result?.promptTokens ?? metadata.promptTokens;
              const outputTokenVal = result?.usage?.completion_tokens ?? result?.usage?.output_tokens ?? result?.completionTokens ?? metadata.completionTokens;
              const totalTokenVal = result?.usage?.total_tokens ?? (inputTokenVal && outputTokenVal ? inputTokenVal + outputTokenVal : undefined);
              
              // Calculate cost based on Anthropic pricing if not provided
              // let costVal = typeof result?.usage?.cost === 'string' ? Number(result.usage.cost) : (result?.usage?.cost ?? metadata.cost);
              // if (!costVal && inputTokenVal && outputTokenVal) {
              //   // Anthropic Claude pricing per 1M tokens (as of Nov 2024 - AWS Bedrock pricing)
              //   const modelPricing: Record<string, { input: number; output: number }> = {
              //     'claude-opus': { input: 15.00, output: 75.00 },
              //     'claude-sonnet': { input: 3.00, output: 15.00 },
              //     'claude-haiku': { input: 1.00, output: 5.00 }  // Updated: was 0.25/1.25
              //   };
              //   const pricing = modelPricing[ddModelName] || modelPricing['claude-sonnet'];
              //   costVal = (inputTokenVal / 1000000 * pricing.input) + (outputTokenVal / 1000000 * pricing.output);
              // }
              
              // console.log('[LLMObservability] DEBUG - Token and cost calculation:', {
              //   inputTokenVal,
              //   outputTokenVal,
              //   totalTokenVal,
              //   costVal,
              //   modelName: ddModelName
              // });

              // Debug: Log the entire llmSpan object and add a custom marker
              llmSpan._isLLMSpan = true;
              //console.log('[LLMObservability] DEBUG - LLM span object:', llmSpan);

              // Extract tool USAGE information from result (what tools were ACTUALLY USED)
              const tool_web_search_used = result?.tool_usage?.tool_web_search_used || false;
              const tool_file_search_used = result?.tool_usage?.tool_file_search_used || false;
              const tool_code_execution_used = result?.tool_usage?.tool_code_execution_used || false;
              const mcp_tools_used = result?.tool_usage?.mcp_tools_used || false;
              const mcp_tools_used_count = result?.tool_usage?.mcp_tools_used_count || 0;
              const mcp_tools_used_names = result?.tool_usage?.mcp_tools_used_names || '';
              const tools_used_count = result?.tool_usage?.tools_used_count || 0;
              const tools_used_names = result?.tool_usage?.tools_used_names || '';

              // Build metadata without the 'user' object to keep it clean
              const cleanMetadata: Record<string, any> = {
                duration_ms: duration,
                user_id: userId || userMetadata.user_id,
                user_name: userMetadata.user_name || metadata.user_name || '',
                user_email: userMetadata.user_email || metadata.user_email || '',
                user_role: userMetadata.user_role || metadata.user_role || '',
                agent_name: metadata.agent_name,
                agent_type: metadata.agent_type,
                agent_id: metadata.agent_id,
                operation: metadata.operation || metadata.endpoint_name || operationType,
                operation_type: metadata.operation_type || operationType,
                operation_name: metadata.operation_name || metadata.endpoint_name || '',
                is_regenerate: metadata.is_regenerate || false,
                is_continued: metadata.is_continued || false
              };

              // Add guardrail metadata if available
              if (result?.guardrails) {
                cleanMetadata.guardrail_input_checked = result.guardrails.input_checked;
                cleanMetadata.guardrail_output_checked = result.guardrails.output_checked;
                cleanMetadata.guardrail_input_has_context = result.guardrails.input_has_context;
                cleanMetadata.guardrail_output_blocked = result.guardrails.output_blocked;
                if (result.guardrails.input_system_note) {
                  cleanMetadata.guardrail_input_system_note = result.guardrails.input_system_note;
                }
                if (result.guardrails.output_violations) {
                  cleanMetadata.guardrail_output_violations = result.guardrails.output_violations.join(', ');
                }
              }

              const annotationData: any = {
                inputData: inputText || 'User request',
                outputData: outputText || 'Assistant response',
                metadata: cleanMetadata,  // Keep metadata clean without token counts
                tags: {
                  'user.id': userId || userMetadata.user_id,
                  'user.name': userMetadata.user_name || metadata.user_name || '',
                  'user.email': userMetadata.user_email || metadata.user_email || '',
                  'user.role': userMetadata.user_role || metadata.user_role || '',
                  'agent.name': metadata.agent_name,
                  'agent.type': metadata.agent_type,
                  'agent.id': metadata.agent_id,
                  'operation': metadata.operation || metadata.endpoint_name || operationType,
                  'operation.type': metadata.operation_type || operationType,
                  'operation.name': metadata.operation_name || metadata.endpoint_name || '',
                  'operation.is_regenerate': metadata.is_regenerate || false,
                  'operation.is_continued': metadata.is_continued || false,
                  'llm.provider': provider === 'bedrock' ? 'amazon_bedrock' : provider.toUpperCase(),
                  'llm.model': model || 'unknown',
                  // Tool availability tags for filtering (what tools CAN be used)
                  ...(metadata.tool_web_search_available !== undefined ? { 'tool.web_search_available': metadata.tool_web_search_available } : {}),
                  ...(metadata.tool_file_search_available !== undefined ? { 'tool.file_search_available': metadata.tool_file_search_available } : {}),
                  ...(metadata.tool_code_execution_available !== undefined ? { 'tool.code_execution_available': metadata.tool_code_execution_available } : {}),
                  ...(metadata.tools_available_count !== undefined ? { 'tools.available_count': metadata.tools_available_count } : {}),
                  // Tool USAGE tags for filtering (what tools were ACTUALLY used)
                  ...(tool_web_search_used !== undefined ? { 'tool.web_search_used': tool_web_search_used } : {}),
                  ...(tool_file_search_used !== undefined ? { 'tool.file_search_used': tool_file_search_used } : {}),
                  ...(tool_code_execution_used !== undefined ? { 'tool.code_execution_used': tool_code_execution_used } : {}),
                  ...(tools_used_count !== undefined ? { 'tools.used_count': tools_used_count } : {}),
                  ...(tools_used_names ? { 'tools.used_names': tools_used_names } : {}),
                  // MCP tool USAGE tags for filtering (what MCP tools were ACTUALLY used)
                  ...(mcp_tools_used !== undefined ? { 'mcp.tools_used': mcp_tools_used } : {}),
                  ...(mcp_tools_used_count !== undefined ? { 'mcp.tools_used_count': mcp_tools_used_count } : {}),
                  ...(mcp_tools_used_names ? { 'mcp.tools_used_names': mcp_tools_used_names } : {}),
                  // MCP server tags for filtering by specific MCP servers
                  ...(metadata.mcp_servers !== undefined ? { 'mcp.servers': metadata.mcp_servers } : {}),
                  ...(metadata.mcp_servers_count !== undefined ? { 'mcp.servers_count': metadata.mcp_servers_count } : {}),
                  ...(metadata.mcp_servers_available !== undefined ? { 'mcp.servers_available': metadata.mcp_servers_available } : {}),
                  ...(metadata['mcp.ms365_enabled'] !== undefined ? { 'mcp.ms365_enabled': metadata['mcp.ms365_enabled'] } : {}),
                  // Guardrail tags for filtering
                  ...(result?.guardrails?.input_checked !== undefined ? { 'guardrail.input_checked': result.guardrails.input_checked } : {}),
                  ...(result?.guardrails?.output_checked !== undefined ? { 'guardrail.output_checked': result.guardrails.output_checked } : {}),
                  ...(result?.guardrails?.input_has_context !== undefined ? { 'guardrail.input_has_context': result.guardrails.input_has_context } : {}),
                  ...(result?.guardrails?.output_blocked !== undefined ? { 'guardrail.output_blocked': result.guardrails.output_blocked } : {}),
                  // Feedback metadata as tags (only if present) - IMPORTANT for filtering
                  ...(metadata.feedback_tag != null && metadata.feedback_tag !== '' ? { 'feedback.tag': metadata.feedback_tag } : {}),
                  ...(metadata.feedback_rating != null && metadata.feedback_rating !== '' ? { 'feedback.rating': metadata.feedback_rating } : {}),
                  ...(metadata.feedback_text != null && metadata.feedback_text !== '' ? { 'feedback.text': metadata.feedback_text } : {}),
                  ...(metadata.feedback_source != null && metadata.feedback_source !== '' ? { 'feedback.source': metadata.feedback_source } : {}),
                  ...(metadata.feedback_time != null && metadata.feedback_time !== '' ? { 'feedback.time': metadata.feedback_time } : {})
                }
              };

              // Metrics will be added as separate metrics object for Datadog LLM Observability
              // Only add metrics when tools are available to avoid token doubling
              // EXCLUDE title generation calls (background title generation)
              const modelLower = model?.toLowerCase() || '';
              const isTitleGeneration = modelLower.includes('nova') || 
                                       modelLower.includes('amazon.nova-lite') ||
                                       metadata.operation === 'title_generation' ||
                                       metadata.is_title_generation === true;
              
              console.log('[LLMObservability] DEBUG - Title generation check:', {
                model: model,
                modelLower: modelLower,
                isTitleGeneration: isTitleGeneration,
                operation: metadata.operation,
                is_title_generation: metadata.is_title_generation,
                includesNova: modelLower.includes('nova')
              });
              
              console.log('[LLMObservability] DEBUG - Tool availability and usage check:', {
                // Tool AVAILABILITY (what tools CAN be used)
                tool_web_search_available: metadata.tool_web_search_available,
                tool_file_search_available: metadata.tool_file_search_available,
                tool_code_execution_available: metadata.tool_code_execution_available,
                // Tool USAGE (what tools were ACTUALLY used)
                tool_web_search_used,
                tool_file_search_used,
                tool_code_execution_used,
                mcp_tools_used,
                mcp_tools_used_count,
                mcp_tools_used_names,
                tools_used_count,
                tools_used_names,
                // MCP server info
                mcp_servers: metadata.mcp_servers,
                mcp_servers_count: metadata.mcp_servers_count,
                mcp_servers_available: metadata.mcp_servers_available,
                mcp_ms365_enabled: metadata['mcp.ms365_enabled'],
                isTitleGeneration,
                hasTokens: inputTokenVal !== undefined || outputTokenVal !== undefined || totalTokenVal !== undefined
              });
              
              // IMPORTANT: Only send metrics when tools are ACTUALLY USED (not just available)
              // This prevents token doubling for conversations where tools are enabled but not used
              const anyToolUsed = tool_web_search_used || tool_file_search_used || tool_code_execution_used || mcp_tools_used;
              
              console.log('[LLMObservability] DEBUG - Tool usage determination:', {
                anyToolUsed,
                mcp_tools_used,
                mcp_tools_used_names,
                tool_web_search_used,
                tool_file_search_used,
                tool_code_execution_used,
                tools_used_names,
                tools_used_count,
                isTitleGeneration,
                willSendMetrics: !isTitleGeneration && anyToolUsed && (inputTokenVal !== undefined || outputTokenVal !== undefined || totalTokenVal !== undefined)
              });
              
              // IMPORTANT: Only send metrics when tools are ACTUALLY USED (not just available)
              // This prevents token doubling from LangChain's automatic instrumentation
              // When tools are available but not used, LangChain creates a child span with tokens
              // We only add metrics to OUR span when tools were actually invoked
              // Exclude title generation from metrics completely
              if (!isTitleGeneration && (inputTokenVal !== undefined || outputTokenVal !== undefined || totalTokenVal !== undefined)) {
                annotationData.metrics = {};
                if (inputTokenVal !== undefined) annotationData.metrics.input_tokens = inputTokenVal;
                if (outputTokenVal !== undefined) annotationData.metrics.output_tokens = outputTokenVal;
                if (totalTokenVal !== undefined) annotationData.metrics.total_tokens = totalTokenVal;
                //if (costVal !== undefined) annotationData.metrics.total_cost = costVal;
                
                console.log('[LLMObservability] ✅ Adding metrics to annotation (tools ACTUALLY USED):', {
                  metrics: annotationData.metrics,
                  usedTools: tools_used_names,
                  toolCount: tools_used_count
                });
              } else if (isTitleGeneration) {
                console.log('[LLMObservability] 🚫 Skipping metrics block for title generation (nova-lite)');
              } else if (!anyToolUsed) {
                console.log('[LLMObservability] 🚫 Skipping metrics block (no tools USED - prevents token doubling, LangChain child span has tokens)');
              } else {
                console.log('[LLMObservability] 🚫 Skipping metrics block (no token data available)');
              }

              console.log('[LLMObservability] DEBUG - About to annotate LLM span with data:', {
                hasInputData: !!annotationData.inputData,
                inputDataLength: annotationData.inputData?.length || 0,
                hasOutputData: !!annotationData.outputData,
                outputDataLength: annotationData.outputData?.length || 0,
                hasMetrics: !!annotationData.metrics,
                metricsKeys: annotationData.metrics ? Object.keys(annotationData.metrics) : [],
                metadataKeys: annotationData.metadata ? Object.keys(annotationData.metadata).length : 0,
                tagsCount: annotationData.tags ? Object.keys(annotationData.tags).length : 0,
                hasFeedbackTags: !!(metadata.feedback_tag || metadata.feedback_rating || metadata.feedback_text)
              });

              try {

                tracer.llmobs.annotate(llmSpan, annotationData);
                
                console.log('[LLMObservability] DEBUG - LLM span annotated successfully');
              } catch (innerAnnotateError: any) {
                console.error('[LLMObservability] ERROR - annotate() call threw error:', {
                  error: innerAnnotateError.message,
                  stack: innerAnnotateError.stack
                });
                // Don't re-throw, let the span complete anyway
              }
            } catch (annotateError: any) {
              console.error('[LLMObservability] ERROR - LLM Observability annotation failed in Bedrock correlation', {
                error: annotateError.message,
                stack: annotateError.stack
              });
            }
          }
          
          console.log('[LLMObservability] DEBUG - Returning result from traceLLMCallWithCorrelation');
          return result;
        });
        
      } catch (error: any) {
        console.error('[LLMObservability] ERROR - Error in wrapper span:', {
          error: error.message,
          stack: error.stack
        });
        wrapperSpan.setTag('llm.status', 'error');
        wrapperSpan.setTag('error.message', error.message);
        throw error;
      }
    });
  } catch (wrapperError: any) {
    console.error('[LLMObservability] ERROR - Wrapper span creation failed:', {
      error: wrapperError.message,
      stack: wrapperError.stack
    });
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
  const tracer = getTracer();
  
  // If no tracer, just return empty result (graceful degradation)
  if (!tracer) {
    return {};
  }
  
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
  
  // Use traceLLMCallWithUser to create an LLM span so feedback appears in LLM Observability
  try {
    return await traceLLMCallWithUser({
      provider: 'custom',
      model: 'user_feedback',
      user: userObj,
      metadata: {
        feedback: options.feedback,
        conversation_id: options.conversationId,
        message_id: options.messageId,
        event_type: 'user_feedback',
        ...userMetadata
      }
    }, async () => {
      console.log('[LLMObservability] ✅ User feedback recorded as LLM span:', {
        userId: options.userId,
        conversationId: options.conversationId,
        messageId: options.messageId,
        rating: options.feedback.rating,
        tag: options.feedback.tag
      });
      
      return {};
    });
  } catch (error: any) {
    console.error('[LLMObservability] ❌ Failed to record user feedback:', {
      error: error.message,
      userId: options.userId
    });
    // Graceful degradation - don't throw
    return {};
  }
}

/**
 * Records a guardrail block event with violation details
 * Similar to recordLLMFeedback, this creates a dedicated LLM span for guardrail blocks
 * Uses 'custom' provider to avoid Bedrock-specific processing
 */
export async function recordGuardrailBlock(options: {
  source: 'INPUT' | 'OUTPUT';
  userId?: string;
  conversationId?: string;
  messageId?: string;
  user?: any;
  userInput?: string;
  violations: Array<{
    type: string;
    category: string;
    confidence?: string;
    action?: string;
  }>;
  blockReason?: string;
  contentLength?: number;
  processingTime?: number;
  assessments?: any[];
}): Promise<void> {
  const tracer = getTracer();
  
  // If no tracer, just return (graceful degradation)
  if (!tracer || !tracer.llmobs) {
    return;
  }
  
  // Extract user metadata
  const userMetadata = LLMObservabilityUtils.extractUserMetadata(options.user || {});
  
  // Format violations for metadata
  const violationDetails = options.violations.map(v => ({
    type: v.type,
    category: v.category,
    confidence: v.confidence,
    action: v.action
  }));

  // Create violation summary for tags (comma-separated list)
  const violationSummary = options.violations
    .map(v => `${v.type}:${v.category}`)
    .join(', ');

  // Build metadata for the guardrail block
  const guardrailMetadata: Record<string, any> = {
    guardrail_blocked: true,
    guardrail_source: options.source,
    guardrail_block_reason: options.blockReason || 'policy_violation',
    guardrail_violation_count: options.violations.length,
    guardrail_violations: violationSummary,
    guardrail_content_length: options.contentLength,
    guardrail_processing_time_ms: options.processingTime,
    guardrail_violation_details: JSON.stringify(violationDetails),
    guardrail_time: new Date().toISOString(),
    // User input for span annotation
    user_input: options.userInput || `[${options.source} content blocked by guardrails]`,
    // User metadata
    'user.id': userMetadata.user_id || options.userId || '',
    'user.name': userMetadata.user_name || '',
    'user.email': userMetadata.user_email || '',
    'user.role': userMetadata.user_role || '',
    // Pass full user object for extraction
    user: options.user,
  };

  if (options.assessments) {
    guardrailMetadata.guardrail_assessments = JSON.stringify(options.assessments);
  }

  try {
    // AWS Bedrock Guardrails IS an LLM call - it uses ML models to analyze content
    // So this SHOULD count as an LLM call and appear in LLM Observability
    await traceLLMCallWithUser({
      provider: 'bedrock' as any,  // Use 'bedrock' since it's AWS Bedrock Guardrails
      model: 'bedrock-guardrails',
      operationType: 'completion' as any,
      userId: options.userId,
      conversationId: options.conversationId,
      messageId: options.messageId,
      user: options.user,
      metadata: guardrailMetadata,
    }, async () => {
      // Return metadata as the "result"
      return { blocked: true, violations: violationDetails };
    });

    console.log('[LLMObservability] ✅ Guardrail block recorded as LLM span:', {
      source: options.source,
      violations: violationSummary,
      userId: options.userId,
      conversationId: options.conversationId
    });
  } catch (error: any) {
    console.error('[LLMObservability] ❌ Failed to record guardrail block:', {
      error: error.message,
      source: options.source
    });
    // Don't throw - graceful degradation
  }
}