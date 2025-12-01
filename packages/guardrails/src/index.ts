/**
 * AWS Bedrock Guardrails Package
 * 
 * Standalone package for AWS Bedrock Guardrails integration.
 * 
 * @packageDocumentation
 */

// Export types
export * from './types';

// Export GuardrailsService
export { GuardrailsService, getGuardrailsService } from './guardrails';

// Default export
export { getGuardrailsService as default } from './guardrails';
