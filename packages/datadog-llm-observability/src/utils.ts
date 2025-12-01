/**
 * Utility functions for LLM Observability
 */

import {
  LLMProvider,
  LLMOperationType,
  LLMUsageStats,
  LLMTraceOptions,
  LLM_PROVIDERS,
  LLM_OPERATION_TYPES
} from './types';

export class LLMObservabilityUtils {
  
  /**
   * Normalizes provider names to standard format
   */
  static normalizeProvider(provider: string): LLMProvider {
    const normalized = provider.toLowerCase().replace(/[-_\s]/g, '');
    
    switch (normalized) {
      case 'openai':
      case 'gpt':
        return LLM_PROVIDERS.OPENAI;
      case 'anthropic':
      case 'claude':
        return LLM_PROVIDERS.ANTHROPIC;
      case 'google':
      case 'gemini':
      case 'vertex':
        return LLM_PROVIDERS.GOOGLE;
      case 'bedrock':
      case 'aws':
        return LLM_PROVIDERS.BEDROCK;
      case 'azureopenai':
      case 'azure':
        return LLM_PROVIDERS.AZURE_OPENAI;
      default:
        return LLM_PROVIDERS.CUSTOM;
    }
  }

  /**
   * Extracts provider from model name
   */
  static getProviderFromModel(model: string): LLMProvider {
    const modelLower = model.toLowerCase();
    
    if (modelLower.includes('gpt') || modelLower.includes('o1') || modelLower.includes('o3')) {
      return LLM_PROVIDERS.OPENAI;
    }
    if (modelLower.includes('claude')) {
      return LLM_PROVIDERS.ANTHROPIC;
    }
    if (modelLower.includes('gemini') || modelLower.includes('bison')) {
      return LLM_PROVIDERS.GOOGLE;
    }
    if (modelLower.includes('bedrock') || modelLower.includes('amazon') || modelLower.includes('aws')) {
      return LLM_PROVIDERS.BEDROCK;
    }
    
    return LLM_PROVIDERS.CUSTOM;
  }

  /**
   * Determines operation type from request parameters
   */
  static getOperationType(params: any): LLMOperationType {
    if (params.messages || params.prompt) {
      return LLM_OPERATION_TYPES.COMPLETION;
    }
    if (params.input && typeof params.input === 'string') {
      return LLM_OPERATION_TYPES.EMBEDDING;
    }
    if (params.image || params.images) {
      return LLM_OPERATION_TYPES.VISION;
    }
    if (params.functions || params.tools) {
      return LLM_OPERATION_TYPES.FUNCTION_CALLING;
    }
    
    return LLM_OPERATION_TYPES.COMPLETION;
  }

  /**
   * Calculates estimated cost based on token usage
   */
  static estimateCost(provider: LLMProvider, model: string, usage: LLMUsageStats): number {
    const inputTokens = usage.promptTokens || usage.inputTokens || 0;
    const outputTokens = usage.completionTokens || usage.outputTokens || 0;
    
    // Example pricing (per 1K tokens) - these are not real current prices
    const pricingTable: Record<string, { input: number; output: number }> = {
      'gpt-4o': { input: 0.005, output: 0.015 },
      'gpt-4': { input: 0.03, output: 0.06 },
      'gpt-3.5-turbo': { input: 0.0015, output: 0.002 },
      'claude-3-opus': { input: 0.015, output: 0.075 },
      'claude-3-sonnet': { input: 0.003, output: 0.015 },
      'claude-3-haiku': { input: 0.00025, output: 0.00125 },
    };

    const pricing = pricingTable[model] || { input: 0.001, output: 0.002 };
    
    return (inputTokens / 1000) * pricing.input + (outputTokens / 1000) * pricing.output;
  }

  /**
   * Formats duration in milliseconds to human readable format
   */
  static formatDuration(durationMs: number): string {
    if (durationMs < 1000) {
      return `${durationMs}ms`;
    }
    if (durationMs < 60000) {
      return `${(durationMs / 1000).toFixed(1)}s`;
    }
    return `${(durationMs / 60000).toFixed(1)}m`;
  }

  /**
   * Creates a standardized trace context object
   */
  static createTraceContext(options: LLMTraceOptions): Record<string, any> {
    return {
      provider: options.provider,
      model: options.model,
      operation_type: options.operationType || LLM_OPERATION_TYPES.COMPLETION,
      user_id: options.userId,
      conversation_id: options.conversationId,
      message_id: options.messageId,
      temperature: options.temperature,
      max_tokens: options.maxTokens,
      stream: options.stream || false,
      timestamp: new Date().toISOString(),
      ...options.metadata
    };
  }

  /**
   * Sanitizes sensitive data from trace context
   */
  static sanitizeTraceData(data: any): any {
    if (!data || typeof data !== 'object') {
      return data;
    }

    const sensitiveKeys = ['api_key', 'apikey', 'authorization', 'password', 'secret', 'token'];
    const sanitized = { ...data };

    for (const key of Object.keys(sanitized)) {
      const keyLower = key.toLowerCase();
      if (sensitiveKeys.some(sensitiveKey => keyLower.includes(sensitiveKey))) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof sanitized[key] === 'object') {
        sanitized[key] = this.sanitizeTraceData(sanitized[key]);
      }
    }

    return sanitized;
  }

  /**
   * Extracts user information for better LLM observability tracking
   */
  static extractUserMetadata(user: any): Record<string, any> {
    if (!user) return {};
    
    const userMeta: Record<string, any> = {};
    
    if (user.id) userMeta.user_id = user.id;
    if (user.name) userMeta.user_name = user.name;
    if (user.email) userMeta.user_email = user.email;
    if (user.username) userMeta.username = user.username;
    if (user.role) userMeta.user_role = user.role;
    if (user.provider) userMeta.auth_provider = user.provider;
    
    return userMeta;
  }
}
