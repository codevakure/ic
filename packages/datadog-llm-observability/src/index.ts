/**
 * Datadog LLM Observability Package
 * 
 * Standalone package for Datadog LLM Observability integration in Ranger.
 * 
 * @packageDocumentation
 */

// Export types
export * from './types';

// Export utilities
export { LLMObservabilityUtils } from './utils';

// Export initialization functions
export {
  initializeDatadog,
  getTracer,
  isLLMObservabilityEnabled,
  traceOperation,
  getCurrentTraceContext
} from './initialization';


// Export LLM tracing functions and user enrichment setter
export {
  traceLLMCall,
  traceLLMCallWithUser,
  traceConversationWorkflow,
  traceUserSession,
  recordLLMMetric,
  recordLLMFeedback,
  setGetUserById,
  recordGuardrailBlock
} from './llm-tracing';

// Re-export specific utility functions for convenience
import { LLMObservabilityUtils } from './utils';
export const extractUserMetadata = LLMObservabilityUtils.extractUserMetadata;

// Default export for convenience
export { initializeDatadog as default } from './initialization';