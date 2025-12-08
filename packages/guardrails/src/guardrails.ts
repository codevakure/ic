/**
 * AWS Bedrock Guardrails Service
 * 
 * Provides content moderation using AWS Bedrock Guardrails.
 * This is a standalone service that can be called from anywhere.
 */

import { BedrockRuntimeClient, ApplyGuardrailCommand } from '@aws-sdk/client-bedrock-runtime';
import type {
  GuardrailResult,
  GuardrailModerateOptions,
  GuardrailsConfig,
  ViolationDetail,
  GuardrailSource,
  GuardrailTrackingMetadata,
  GuardrailOutcome
} from './types';

/**
 * AWS Bedrock Guardrails Service Class
 */
export class GuardrailsService {
  private client: BedrockRuntimeClient | null = null;
  private initialized = false;
  private config: GuardrailsConfig;

  constructor(config: GuardrailsConfig = {}) {
    this.config = {
      enabled: config.enabled ?? process.env.BEDROCK_GUARDRAILS_ENABLED === 'true',
      guardrailId: config.guardrailId ?? process.env.BEDROCK_GUARDRAILS_ID,
      guardrailVersion: config.guardrailVersion ?? process.env.BEDROCK_GUARDRAILS_VERSION ?? 'DRAFT',
      region: config.region ?? process.env.BEDROCK_AWS_DEFAULT_REGION ?? 'us-east-1',
      accessKeyId: config.accessKeyId ?? process.env.BEDROCK_AWS_ACCESS_KEY_ID,
      secretAccessKey: config.secretAccessKey ?? process.env.BEDROCK_AWS_SECRET_ACCESS_KEY,
      sessionToken: config.sessionToken ?? process.env.BEDROCK_AWS_SESSION_TOKEN,
      blockMessage: config.blockMessage ?? process.env.BEDROCK_GUARDRAILS_BLOCK_MESSAGE ??
        'Your message violates our content policies. Please revise your request and try again.',
      // Action flags - default to true (apply actions)
      blockEnabled: config.blockEnabled ?? process.env.GUARDRAILS_BLOCK_ENABLED !== 'false',
      anonymizeEnabled: config.anonymizeEnabled ?? process.env.GUARDRAILS_ANONYMIZE_ENABLED !== 'false',
      interveneEnabled: config.interveneEnabled ?? process.env.GUARDRAILS_INTERVENE_ENABLED !== 'false',
    };
  }

  /**
   * Initialize the Bedrock client if not already initialized
   */
  private async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    if (!this.config.enabled) {
      return;
    }

    try {
      const credentials: any = {
        accessKeyId: this.config.accessKeyId,
        secretAccessKey: this.config.secretAccessKey
      };

      if (this.config.sessionToken) {
        credentials.sessionToken = this.config.sessionToken;
      }

      this.client = new BedrockRuntimeClient({
        region: this.config.region,
        credentials
      });

      this.initialized = true;
    } catch (error) {
      console.error('[GuardrailsService] Failed to initialize:', error);
      throw error;
    }
  }

  /**
   * Check if guardrails are enabled
   */
  public isEnabled(): boolean {
    const enabled = this.config.enabled === true && !!this.config.guardrailId;
    return enabled;
  }

  /**
   * Moderate content using AWS Bedrock Guardrails
   */
  public async moderate(content: string, options: GuardrailModerateOptions = {}): Promise<GuardrailResult> {
    const startTime = Date.now();

    // Return early if not enabled
    if (!this.isEnabled()) {
      return { blocked: false, content, reason: 'disabled' };
    }

    // Validate input
    if (!content || typeof content !== 'string') {
      return { blocked: false, content, reason: 'invalid_content' };
    }

    try {
      await this.initialize();

      if (!this.client) {
        console.error('[GuardrailsService] Client not initialized');
        return { blocked: false, content, reason: 'not_initialized' };
      }

      const source: GuardrailSource = options.source ?? 'INPUT';
      const guardrailId = options.guardrailId ?? this.config.guardrailId!;
      const guardrailVersion = options.guardrailVersion ?? this.config.guardrailVersion!;

      const command = new ApplyGuardrailCommand({
        guardrailIdentifier: guardrailId,
        guardrailVersion: guardrailVersion,
        source: source,
        content: [{ text: { text: content } }]
      });

      const response = await this.client.send(command);
      const processingTime = Date.now() - startTime;

      const intervened = response.action === 'GUARDRAIL_INTERVENED';

      if (intervened) {
        const violations = this.extractViolationDetails(response.assessments);
        
        // Check if any violation has BLOCKED action (true block)
        // ANONYMIZED means content was modified but allowed through
        // BLOCKED means content was rejected entirely
        const hasBlockedViolation = violations.some(v => v.action === 'BLOCKED');
        const hasAnonymizedViolation = violations.some(v => v.action === 'ANONYMIZED');
        
        // Get the output from guardrails (may contain anonymized content)
        const outputContent = response.outputs?.[0]?.text || content;
        
        if (hasBlockedViolation) {
          // True block - at least one policy blocked the content
          console.warn('[GuardrailsService] 🚫 BLOCKED', {
            source,
            time: `${processingTime}ms`,
            violations
          });

          return {
            blocked: true,
            content: this.config.blockMessage!,
            action: response.action,
            assessments: response.assessments || [],
            usage: response.usage,
            reason: 'policy_violation',
            userMessage: this.config.blockMessage,
            violations
          };
        }
        
        if (hasAnonymizedViolation) {
          // Content was anonymized but not blocked - return the anonymized content
          return {
            blocked: false,
            content: outputContent, // Return anonymized content
            action: response.action,
            assessments: response.assessments || [],
            usage: response.usage,
            reason: 'anonymized',
            violations
          };
        }

        // Fallback: intervened but no clear BLOCKED action - log and let through
        // This handles cases where guardrails modified content without explicit violation details
        console.info('[GuardrailsService] ℹ️ INTERVENED (no block action)', {
          source,
          time: `${processingTime}ms`,
          violations,
          hasOutput: !!response.outputs?.[0]?.text
        });

        return {
          blocked: false,
          content: outputContent,
          action: response.action,
          assessments: response.assessments || [],
          usage: response.usage,
          reason: 'intervened_passthrough',
          violations
        };
      } else {
        // Don't log PASSED content - too verbose
        return {
          blocked: false,
          content,
          action: response.action,
          assessments: response.assessments || [],
          usage: response.usage,
          reason: 'passed'
        };
      }
    } catch (error: any) {
      const processingTime = Date.now() - startTime;

      console.error('[GuardrailsService] ❌ Error during moderation:', {
        error: error.message,
        errorCode: error.code || error.name,
        processingTime: `${processingTime}ms`,
        source: options.source || 'INPUT',
        contentLength: content?.length || 0
      });

      // Return unblocked on error to avoid breaking the flow
      return {
        blocked: false,
        content,
        error: error.message,
        reason: 'error'
      };
    }
  }

  /**
   * Moderate input content (convenience method)
   */
  public async moderateInput(content: string, options: Omit<GuardrailModerateOptions, 'source'> = {}): Promise<GuardrailResult> {
    return this.moderate(content, { ...options, source: 'INPUT' });
  }

  /**
   * Moderate output content (convenience method)
   */
  public async moderateOutput(content: string, options: Omit<GuardrailModerateOptions, 'source'> = {}): Promise<GuardrailResult> {
    return this.moderate(content, { ...options, source: 'OUTPUT' });
  }

  /**
   * Extract violation details from assessments for logging
   */
  private extractViolationDetails(assessments: any[] | undefined): ViolationDetail[] {
    if (!assessments || !Array.isArray(assessments)) {
      return [];
    }

    const violations: ViolationDetail[] = [];

    assessments.forEach((assessment) => {
      // Content Policy violations
      if (assessment.contentPolicy && assessment.contentPolicy.filters) {
        assessment.contentPolicy.filters.forEach((filter: any) => {
          if (filter.detected) {
            violations.push({
              type: 'CONTENT_POLICY',
              category: filter.type,
              confidence: filter.confidence,
              action: filter.action
            });
          }
        });
      }

      // Topic Policy violations
      if (assessment.topicPolicy && assessment.topicPolicy.topics) {
        assessment.topicPolicy.topics.forEach((topic: any) => {
          if (topic.detected) {
            violations.push({
              type: 'TOPIC_POLICY',
              category: topic.name,
              action: topic.action
            });
          }
        });
      }

      // Word Policy violations
      if (assessment.wordPolicy) {
        if (assessment.wordPolicy.customWords) {
          assessment.wordPolicy.customWords.forEach((word: any) => {
            if (word.detected) {
              violations.push({
                type: 'WORD_POLICY',
                category: 'CUSTOM_WORD',
                action: word.action
              });
            }
          });
        }
        if (assessment.wordPolicy.managedWordLists) {
          assessment.wordPolicy.managedWordLists.forEach((list: any) => {
            if (list.detected) {
              violations.push({
                type: 'WORD_POLICY',
                category: list.type,
                action: list.action
              });
            }
          });
        }
      }

      // PII violations
      if (assessment.sensitiveInformationPolicy && assessment.sensitiveInformationPolicy.piiEntities) {
        assessment.sensitiveInformationPolicy.piiEntities.forEach((entity: any) => {
          if (entity.detected) {
            violations.push({
              type: 'PII_POLICY',
              category: entity.type,
              action: entity.action
            });
          }
        });
      }
    });

    return violations;
  }

  /**
   * Format violations into a human-readable string
   * Used for creating systemNote content for LLM context
   */
  public formatViolations(violations: ViolationDetail[]): string {
    if (!violations || violations.length === 0) {
      return 'content policy violations';
    }

    return violations.map(v => {
      if (v.type === 'TOPIC_POLICY') {
        return `${v.category} Topic`;
      } else if (v.type === 'CONTENT_POLICY') {
        return `${v.category} Content (${v.confidence} confidence)`;
      } else if (v.type === 'PII_POLICY') {
        return `Sensitive Information: ${v.category}`;
      } else if (v.type === 'WORD_POLICY') {
        return `Prohibited Word`;
      }
      return v.type;
    }).join(', ');
  }

  /**
   * Create systemNote for INPUT moderation blocks
   * This provides LLM with context about what was blocked and how to respond
   */
  public createInputSystemNote(violations: ViolationDetail[]): string {
    const violationSummary = this.formatViolations(violations);
    
    return `GUARDRAILS CONTEXT: The user's previous message was flagged for containing content related to ${violationSummary}. CRITICAL INSTRUCTIONS FOR ANY GUARDRAIL-RELATED QUESTIONS: ONLY discuss what was actually blocked in THIS conversation: "${violationSummary}". When user asks "what is blocked", "what else is flagged", "what policies", etc., respond ONLY about THIS specific block: "Your previous message was flagged for containing content related to ${violationSummary}." DO NOT list other possible policies, general content guidelines, or theoretical violations. DO NOT add: support resources, hotlines, explanations, apologies, or extra context. ONLY state what was actually blocked in this conversation.`;
  }

  /**
   * Create systemNote for OUTPUT moderation blocks
   * This provides LLM with context about what it tried to generate and why it was blocked
   */
  public createOutputSystemNote(violations: ViolationDetail[]): string {
    const violationSummary = this.formatViolations(violations);
    
    return `GUARDRAILS CONTEXT: The AI's previous response was flagged for containing content related to ${violationSummary}. CRITICAL INSTRUCTIONS FOR ANY GUARDRAIL-RELATED QUESTIONS: ONLY discuss what was actually blocked in THIS conversation: "${violationSummary}". When user asks "what is blocked", "what else is flagged", "what policies", etc., respond ONLY about THIS specific block: "Your previous response was flagged for containing content related to ${violationSummary}." DO NOT list other possible policies, general content guidelines, or theoretical violations. DO NOT add: support resources, hotlines, explanations, apologies, or extra context. ONLY state what was actually blocked in this conversation.`;
  }

  /**
   * Get a safe replacement message for blocked content
   */
  public getBlockedMessage(assessments: any[] = []): string {
    return this.config.blockMessage || 'I cannot provide that response due to content policy violations.';
  }

  /**
   * HIGH-LEVEL HANDLER: Process INPUT moderation request
   * 
   * This is the main entry point for INPUT moderation from middleware.
   * Handles all logic including moderation, metadata creation, and response formatting.
   * 
   * @param text - User input text to moderate
   * @returns InputModerationResult with block status and metadata
   * 
   * @example
   * ```typescript
   * const result = await guardrailsService.handleInputModeration(userText);
   * if (result.blocked && result.actionApplied) {
   *   // Save messages with result.metadata
   *   // Send result.blockMessage to user
   *   return;
   * }
   * // Continue to LLM (but still save trackingMetadata for audit)
   * ```
   */
  public async handleInputModeration(text: string): Promise<import('./types').InputModerationResult> {
    // Return early if not enabled
    if (!this.isEnabled()) {
      return {
        blocked: false,
        shouldContinue: true
      };
    }

    // Moderate the input
    const moderationResult = await this.moderateInput(text);

    // Determine outcome
    let outcome: GuardrailOutcome = 'passed';
    if (moderationResult.blocked) {
      outcome = 'blocked';
    } else if (moderationResult.reason === 'anonymized') {
      outcome = 'anonymized';
    } else if (moderationResult.reason === 'intervened_passthrough') {
      outcome = 'intervened';
    }

    // Create tracking metadata for ALL outcomes (for audit/traces)
    const trackingMetadata: import('./types').GuardrailTrackingMetadata = {
      guardrailInvoked: true,
      outcome,
      actionApplied: false, // Will be set based on flags below
      violations: moderationResult.violations || [],
      assessments: moderationResult.assessments || [],
      originalContent: text,
      reason: moderationResult.reason,
      timestamp: new Date().toISOString()
    };

    // If content passed, continue without action
    if (!moderationResult.blocked && outcome === 'passed') {
      return {
        blocked: false,
        shouldContinue: true,
        trackingMetadata
      };
    }

    // Check if block action should be applied based on env flag
    const shouldApplyBlock = moderationResult.blocked && (this.config.blockEnabled ?? true);
    trackingMetadata.actionApplied = shouldApplyBlock;

    if (shouldApplyBlock) {
      // Input was blocked AND block action is enabled
      const metadata: import('./types').GuardrailMetadata = {
        guardrailBlocked: true,
        violations: moderationResult.violations || [],
        assessments: moderationResult.assessments || [],
        originalUserMessage: text,
        blockReason: moderationResult.reason,
        systemNote: this.createInputSystemNote(moderationResult.violations || [])
      };
      trackingMetadata.systemNote = metadata.systemNote;

      return {
        blocked: true,
        shouldContinue: false,
        metadata,
        blockMessage: this.config.blockMessage!,
        violations: moderationResult.violations,
        trackingMetadata,
        actionApplied: true
      };
    }

    // Block detected but action disabled - log but continue
    console.info('[GuardrailsService] ⚠️ BLOCK DETECTED but action disabled (GUARDRAILS_BLOCK_ENABLED=false)', {
      outcome,
      violations: moderationResult.violations?.map(v => `${v.type}:${v.category}`) || []
    });

    return {
      blocked: false, // Not blocking on UI
      shouldContinue: true, // Continue to LLM
      trackingMetadata, // But save for audit
      actionApplied: false
    };
  }

  /**
   * HIGH-LEVEL HANDLER: Process OUTPUT moderation request
   * 
   * This is the main entry point for OUTPUT moderation from request handlers.
   * Handles all logic including moderation, response replacement, and metadata creation.
   * 
   * @param responseText - LLM response text to moderate
   * @returns OutputModerationResult with modified response if blocked
   * 
   * @example
   * ```typescript
   * const result = await guardrailsService.handleOutputModeration(llmResponse.text);
   * if (result.blocked && result.actionApplied && result.modifiedResponse) {
   *   response.text = result.modifiedResponse.text;
   *   response.metadata = result.modifiedResponse.metadata;
   * }
   * // Always save result.trackingMetadata for audit
   * ```
   */
  public async handleOutputModeration(responseText: string): Promise<import('./types').OutputModerationResult> {
    // Return early if not enabled or no text
    if (!this.isEnabled() || !responseText) {
      return {
        blocked: false
      };
    }

    // Moderate the output
    const moderationResult = await this.moderateOutput(responseText);

    // Determine outcome
    let outcome: GuardrailOutcome = 'passed';
    if (moderationResult.blocked) {
      outcome = 'blocked';
    } else if (moderationResult.reason === 'anonymized') {
      outcome = 'anonymized';
    } else if (moderationResult.reason === 'intervened_passthrough') {
      outcome = 'intervened';
    }

    // Create tracking metadata for ALL outcomes (for audit/traces)
    const trackingMetadata: import('./types').GuardrailTrackingMetadata = {
      guardrailInvoked: true,
      outcome,
      actionApplied: false, // Will be set based on flags below
      violations: moderationResult.violations || [],
      assessments: moderationResult.assessments || [],
      originalContent: responseText,
      reason: moderationResult.reason,
      timestamp: new Date().toISOString()
    };

    // If content passed without any modification
    if (!moderationResult.blocked && outcome === 'passed') {
      return {
        blocked: false,
        trackingMetadata
      };
    }

    // Handle ANONYMIZED outcome
    if (!moderationResult.blocked && outcome === 'anonymized' && moderationResult.content) {
      const shouldApplyAnonymize = this.config.anonymizeEnabled ?? true;
      trackingMetadata.actionApplied = shouldApplyAnonymize;
      trackingMetadata.modifiedContent = moderationResult.content;

      if (shouldApplyAnonymize) {
        return {
          blocked: false,
          content: moderationResult.content,
          violations: moderationResult.violations,
          trackingMetadata,
          actionApplied: true
        };
      }

      // Anonymize detected but action disabled
      console.info('[GuardrailsService] ⚠️ ANONYMIZE DETECTED but action disabled (GUARDRAILS_ANONYMIZE_ENABLED=false)', {
        violations: moderationResult.violations?.map(v => `${v.type}:${v.category}`) || []
      });

      return {
        blocked: false,
        content: responseText, // Return original content
        trackingMetadata,
        actionApplied: false
      };
    }

    // Handle INTERVENED outcome
    if (!moderationResult.blocked && outcome === 'intervened') {
      const shouldApplyIntervene = this.config.interveneEnabled ?? true;
      trackingMetadata.actionApplied = shouldApplyIntervene;
      trackingMetadata.modifiedContent = moderationResult.content;

      if (shouldApplyIntervene) {
        return {
          blocked: false,
          content: moderationResult.content,
          violations: moderationResult.violations,
          trackingMetadata,
          actionApplied: true
        };
      }

      // Intervene detected but action disabled
      console.info('[GuardrailsService] ⚠️ INTERVENE DETECTED but action disabled (GUARDRAILS_INTERVENE_ENABLED=false)', {
        violations: moderationResult.violations?.map(v => `${v.type}:${v.category}`) || []
      });

      return {
        blocked: false,
        content: responseText, // Return original content
        trackingMetadata,
        actionApplied: false
      };
    }

    // Handle BLOCKED outcome
    if (moderationResult.blocked) {
      const shouldApplyBlock = this.config.blockEnabled ?? true;
      trackingMetadata.actionApplied = shouldApplyBlock;

      const metadata: import('./types').GuardrailMetadata = {
        guardrailBlocked: true,
        violations: moderationResult.violations || [],
        assessments: moderationResult.assessments || [],
        blockReason: 'policy_violation_output',
        systemNote: this.createOutputSystemNote(moderationResult.violations || [])
      };
      trackingMetadata.systemNote = metadata.systemNote;

      if (shouldApplyBlock) {
        return {
          blocked: true,
          modifiedResponse: {
            text: this.config.blockMessage!,
            metadata
          },
          violations: moderationResult.violations,
          trackingMetadata,
          actionApplied: true
        };
      }

      // Block detected but action disabled
      console.info('[GuardrailsService] ⚠️ OUTPUT BLOCK DETECTED but action disabled (GUARDRAILS_BLOCK_ENABLED=false)', {
        violations: moderationResult.violations?.map(v => `${v.type}:${v.category}`) || []
      });

      return {
        blocked: false, // Not blocking on UI
        trackingMetadata, // But save for audit
        actionApplied: false
      };
    }

    // Fallback - shouldn't reach here
    return {
      blocked: false,
      trackingMetadata
    };
  }

  /**
   * HIGH-LEVEL HANDLER: Extract guardrail context from message history
   * 
   * This is the main entry point for system prompt injection.
   * Scans message history for blocked messages and extracts systemNote for LLM context.
   * 
   * @param messages - Array of messages from conversation history
   * @returns SystemPromptInjection with systemNote to append to agent instructions
   * 
   * @example
   * ```typescript
   * const injection = guardrailsService.extractGuardrailContext(conversationMessages);
   * if (injection.hasGuardrailContext && injection.systemNote) {
   *   systemPrompt = [systemPrompt, injection.systemNote].join('\n\n');
   * }
   * ```
   */
  public extractGuardrailContext(messages: any[]): import('./types').SystemPromptInjection {
    // Return early if not enabled
    if (!this.isEnabled()) {
      return {
        hasGuardrailContext: false
      };
    }

    // Filter messages that have guardrail metadata
    const blockedMessages = messages.filter(
      msg => msg.metadata && msg.metadata.guardrailBlocked === true
    );

    if (blockedMessages.length === 0) {
      return {
        hasGuardrailContext: false
      };
    }

    // Extract system notes from all blocked messages
    const systemNotes = blockedMessages
      .map(msg => msg.metadata?.systemNote)
      .filter(Boolean);

    if (systemNotes.length === 0) {
      return {
        hasGuardrailContext: false
      };
    }

    // Collect all violations for reference
    const allViolations = blockedMessages
      .flatMap(msg => msg.metadata?.violations || []);

    // Only log when injecting context (important action)
    console.info('[GuardrailsService] 💉 Injecting guardrail context:', {
      blockedMessages: blockedMessages.length,
      violations: allViolations.length
    });

    return {
      hasGuardrailContext: true,
      systemNote: systemNotes.join('\n\n'),
      violations: allViolations
    };
  }
}

// Export singleton instance factory
let defaultInstance: GuardrailsService | null = null;

export function getGuardrailsService(config?: GuardrailsConfig): GuardrailsService {
  if (!defaultInstance) {
    defaultInstance = new GuardrailsService(config);
  }
  return defaultInstance;
}
