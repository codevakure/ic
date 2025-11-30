/**
 * Unified Query Analyzer
 *
 * Single entry point for analyzing user queries that determines:
 * 1. Which TOOLS to use (web_search, execute_code, file_search, artifacts)
 * 2. Which MODEL TIER to use (simple, moderate, complex, expert)
 *
 * 4-TIER SYSTEM:
 * - simple:   Nova Pro     ($0.80/$3.20)   - Basic Q&A, greetings, simple tools
 * - moderate: Haiku 4.5    ($1.00/$5.00)   - Explanations, standard code
 * - complex:  Sonnet 4.5   ($3.00/$15.00)  - Debugging, analysis
 * - expert:   Opus 4.5     ($15.00/$75.00) - Architecture, research
 *
 * Process:
 * 1. Run regex patterns (fast, free) for both tools and model tier
 * 2. If confidence < threshold and LLM fallback provided, use LLM
 * 3. Return unified result
 */

import type {
  Tool,
  UnifiedQueryResult,
  UnifiedAnalysisOptions,
  QueryIntentResult,
  ModelRoutingResult,
} from './types';
import { analyzeQueryIntent } from './query-intent';
import { scoreQueryComplexity, getTierFromScore } from './model-routing';
import { classifyWithLlm } from './llm-fallback';

/**
 * Default confidence threshold below which LLM fallback is triggered
 */
const DEFAULT_FALLBACK_THRESHOLD = 0.4;

/**
 * Analyze a user query to determine tools and model tier
 *
 * This is the MAIN ENTRY POINT for query analysis.
 *
 * @example
 * ```typescript
 * const result = await analyzeQuery({
 *   query: "What are the latest stock prices?",
 *   availableTools: [Tool.WEB_SEARCH, Tool.CODE_INTERPRETER],
 *   llmFallback: async (prompt) => {
 *     // Call your cheap model (e.g., Nova Micro)
 *     return await callNovaMicro(prompt);
 *   }
 * });
 *
 * console.log(result.tools.tools); // [Tool.WEB_SEARCH]
 * console.log(result.model.tier);  // 'simple'
 * ```
 */
export async function analyzeQuery(options: UnifiedAnalysisOptions): Promise<UnifiedQueryResult> {
  const {
    query,
    availableTools,
    attachedFiles,
    conversationHistory,
    llmFallback,
    fallbackThreshold = DEFAULT_FALLBACK_THRESHOLD,
    autoEnabledTools,
    userSelectedTools,
  } = options;

  // Step 1: Run regex-based analysis (fast, free)
  const toolsResult = analyzeQueryIntent({
    query,
    availableTools,
    attachedFiles,
    conversationHistory,
    autoEnabledTools,
    userSelectedTools,
  });

  const modelResult = scoreQueryComplexity(query);

  // Step 2: Check confidence and decide if LLM fallback is needed
  // LLM fallback is triggered when EITHER tools OR model needs help
  const toolsLowConfidence = toolsResult.confidence < fallbackThreshold && toolsResult.tools.length === 0;
  const modelLowConfidence = modelResult.categories.includes('general'); // 'general' means no specific pattern matched

  // Use LLM fallback if:
  // 1. Either tool OR model confidence is low (patterns didn't match well)
  // 2. LLM fallback function is provided
  // 3. Query isn't a simple greeting/acknowledgment (don't waste LLM on these trivial responses)
  // 4. Special case: Short queries (<=5 chars) with conversation history need LLM for context
  const isSimpleGreeting = /^(hi|hello|hey|thanks|thank you|ok|okay|bye|goodbye|yes|no|sure|yep|nope|cool|nice|great|awesome|perfect|got it|alright|sounds good|understood|noted|right|exactly|indeed|absolutely|definitely|certainly|of course|for sure|makes sense|i see|ah|oh|wow|interesting|good|fine|neat)[\s!?.]*$/i.test(query.trim());
  
  // Detect short selection responses (1, 2, 3, A, B, first, second, etc.)
  const isSelectionResponse = /^[1-9a-e]\.?$/i.test(query.trim()) || 
    /^(first|second|third|option\s*[1-9a-e]|choice\s*[1-9a-e])$/i.test(query.trim());
  
  // Short queries with conversation history likely need context understanding
  const needsContextFromHistory = query.length <= 5 && conversationHistory && conversationHistory.length > 0;
  
  const shouldUseLlm =
    (toolsLowConfidence || modelLowConfidence || isSelectionResponse || needsContextFromHistory) &&
    llmFallback &&
    !isSimpleGreeting;

  if (shouldUseLlm) {
    // Pass regex suggestions to LLM so it can decide to keep or override
    const regexSuggestions = {
      tools: toolsResult.tools,
      toolsConfidence: toolsResult.confidence,
      modelTier: modelResult.tier,
      modelScore: modelResult.score,
    };

    const llmResult = await classifyWithLlm(
      query,
      availableTools,
      llmFallback,
      regexSuggestions,
      conversationHistory,
      attachedFiles, // Pass attached files so LLM knows about images/documents
    );

    if (llmResult) {
      return {
        tools: llmResult.tools,
        model: llmResult.model,
        usedLlmFallback: true,
      };
    }
    // LLM failed, fall through to pattern-based result
  }

  // Step 3: Return pattern-based result
  return {
    tools: toolsResult,
    model: modelResult,
    usedLlmFallback: false,
  };
}

/**
 * Quick tool analysis without model routing
 * Use this if you only need tool selection
 */
export function analyzeTools(
  query: string,
  availableTools: Tool[],
  attachedFiles?: UnifiedAnalysisOptions['attachedFiles'],
): QueryIntentResult {
  return analyzeQueryIntent({
    query,
    availableTools,
    attachedFiles,
  });
}

/**
 * Quick model tier analysis without tool selection
 * Use this if you only need model routing
 */
export function analyzeModelTier(query: string): ModelRoutingResult {
  return scoreQueryComplexity(query);
}

/**
 * Get the score threshold for a given tier
 */
export function getTierThreshold(tier: string): { min: number; max: number } {
  const thresholds: Record<string, { min: number; max: number }> = {
    expert: { min: 0.8, max: 1.0 },
    complex: { min: 0.6, max: 0.8 },
    moderate: { min: 0.35, max: 0.6 },
    simple: { min: 0.0, max: 0.35 },
  };

  return thresholds[tier] || thresholds.simple;
}

// Re-export for convenience
export { getTierFromScore };
