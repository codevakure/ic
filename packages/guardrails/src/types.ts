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
  /** Tracking metadata - always populated when guardrails invoked */
  trackingMetadata?: GuardrailTrackingMetadata;
  /** Whether the action was actually applied (based on env flags) */
  actionApplied?: boolean;
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
  /** Tracking metadata - always populated when guardrails invoked */
  trackingMetadata?: GuardrailTrackingMetadata;
  /** Whether the action was actually applied (based on env flags) */
  actionApplied?: boolean;
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
  reason: 'disabled' | 'invalid_content' | 'not_initialized' | 'policy_violation' | 'passed' | 'error' | 'anonymized' | 'intervened_passthrough';
  userMessage?: string | null;
  error?: string;
  violations?: ViolationDetail[];
  /** Tracking metadata for all outcomes (always populated when guardrails invoked) */
  trackingMetadata?: GuardrailTrackingMetadata;
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
  /** Whether to apply block action on UI (if false, still saves to DB but doesn't block) */
  blockEnabled?: boolean;
  /** Whether to apply anonymize action on UI (if false, still saves to DB but doesn't anonymize) */
  anonymizeEnabled?: boolean;
  /** Whether to apply intervene action on UI (if false, still saves to DB but doesn't intervene) */
  interveneEnabled?: boolean;
}

/**
 * Guardrail outcome type for tracking
 */
export type GuardrailOutcome = 'blocked' | 'anonymized' | 'intervened' | 'passed';

/**
 * Extended metadata for all guardrail outcomes (not just blocked)
 */
export interface GuardrailTrackingMetadata {
  guardrailInvoked: boolean;
  outcome: GuardrailOutcome;
  actionApplied: boolean;  // Whether the action was actually applied to UI
  violations: ViolationDetail[];
  assessments?: any[];
  originalContent?: string;
  modifiedContent?: string;
  reason: string;
  systemNote?: string;
  timestamp: string;
}
