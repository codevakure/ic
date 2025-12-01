/**
 * Type definitions for AWS Bedrock Guardrails
 */

/**
 * Source of content being moderated
 */
export type GuardrailSource = 'INPUT' | 'OUTPUT';

/**
 * Guardrail action result
 */
export type GuardrailAction = 'GUARDRAIL_INTERVENED' | 'NONE';

/**
 * Violation type
 */
export type ViolationType = 'CONTENT_POLICY' | 'TOPIC_POLICY' | 'WORD_POLICY' | 'PII_POLICY';

/**
 * Violation details
 */
export interface ViolationDetail {
  type: ViolationType;
  category: string;
  confidence?: string;
  action?: string;
}

/**
 * Metadata stored with blocked messages
 */
export interface GuardrailMetadata {
  guardrailBlocked: boolean;
  violations: ViolationDetail[];
  assessments?: any[];
  originalUserMessage?: string;
  blockReason: string;
  systemNote: string;
}

/**
 * Handler result for INPUT moderation
 */
export interface InputModerationResult {
  blocked: boolean;
  shouldContinue: boolean;
  metadata?: GuardrailMetadata;
  blockMessage?: string;
  violations?: ViolationDetail[];
}

/**
 * Handler result for OUTPUT moderation
 */
export interface OutputModerationResult {
  blocked: boolean;
  content?: string;  // Anonymized content when not blocked but modified
  modifiedResponse?: {
    text: string;
    metadata: GuardrailMetadata;
  };
  violations?: ViolationDetail[];
}

/**
 * System prompt injection result
 */
export interface SystemPromptInjection {
  hasGuardrailContext: boolean;
  systemNote?: string;
  violations?: ViolationDetail[];
}

/**
 * Guardrail moderation result
 */
export interface GuardrailResult {
  blocked: boolean;
  content: string;
  action?: GuardrailAction;
  assessments?: any[];
  usage?: {
    topicPolicyUnits?: number;
    contentPolicyUnits?: number;
    wordPolicyUnits?: number;
    sensitiveInformationPolicyUnits?: number;
    sensitiveInformationPolicyFreeUnits?: number;
    contextualGroundingPolicyUnits?: number;
  };
  reason: 'disabled' | 'invalid_content' | 'not_initialized' | 'policy_violation' | 'passed' | 'error';
  userMessage?: string | null;
  error?: string;
  violations?: ViolationDetail[];
}

/**
 * Options for moderation
 */
export interface GuardrailModerateOptions {
  source?: GuardrailSource;
  guardrailId?: string;
  guardrailVersion?: string;
}

/**
 * Configuration options for GuardrailsService
 */
export interface GuardrailsConfig {
  enabled?: boolean;
  guardrailId?: string;
  guardrailVersion?: string;
  region?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  sessionToken?: string;
  blockMessage?: string;
}
