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
  PreviousToolContext,
} from './types';
import { analyzeQueryIntent } from './query-intent';
import { scoreQueryComplexity, getTierFromScore } from './model-routing';
import { classifyWithLlm } from './llm-fallback';
import { Tool as ToolEnum } from './types';

/**
 * Default confidence threshold below which LLM fallback is triggered
 */
const DEFAULT_FALLBACK_THRESHOLD = 0.4;

/**
 * Patterns to detect tools mentioned in assistant responses
 */
const TOOL_DETECTION_PATTERNS: Record<Tool, RegExp[]> = {
  [ToolEnum.WEB_SEARCH]: [
    /searching the web/i,
    /search results?/i,
    /found (these|the following) results/i,
    /according to.*search/i,
    /from.*web.*search/i,
  ],
  [ToolEnum.CODE_INTERPRETER]: [
    /running code/i,
    /executing.*code/i,
    /code.*output/i,
    /analyzed the data/i,
    /created.*chart/i,
    /generated.*plot/i,
    /\bpython\s+output\b/i,
    /analysis.*results?/i,
  ],
  [ToolEnum.FILE_SEARCH]: [
    /searching.*document/i,
    /from the (document|file|pdf)/i,
    /according to the (document|file|pdf)/i,
    /the document (says|mentions|states)/i,
    /found in the (document|file)/i,
  ],
  [ToolEnum.ARTIFACTS]: [
    /created.*component/i,
    /here's the (dashboard|component|ui|form|interface)/i,
    /generated.*artifact/i,
    /built.*interface/i,
    /created.*mermaid/i,
  ],
};

/**
 * Patterns to detect output types
 */
const OUTPUT_DETECTION_PATTERNS: Record<string, RegExp[]> = {
  chart: [/chart|graph|plot|visualization|figure/i],
  code: [/code|function|script|program/i, /```\w+/],
  document: [/document|file|pdf|report/i],
  ui_component: [/component|dashboard|interface|form/i],
  search_result: [/search result|found|according to/i],
};

/**
 * Extract previous tool context from conversation history
 * Analyzes the last assistant message to determine what tools were used
 * 
 * NOTE: This relies on the assistant's response containing patterns like
 * "search results", "executing code", etc. If the response text is empty
 * or doesn't contain these patterns, we fall back to LLM for context.
 */
function extractPreviousToolContext(
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>
): PreviousToolContext | undefined {
  if (!conversationHistory || conversationHistory.length === 0) {
    return undefined;
  }
  
  // Find the last assistant message
  const lastAssistantMsg = [...conversationHistory]
    .reverse()
    .find(msg => msg.role === 'assistant');
  
  if (!lastAssistantMsg || !lastAssistantMsg.content) {
    return undefined;
  }
  
  const content = lastAssistantMsg.content;
  const lastUsedTools: Tool[] = [];
  
  // Detect tools from patterns in assistant response
  for (const [tool, patterns] of Object.entries(TOOL_DETECTION_PATTERNS) as [Tool, RegExp[]][]) {
    for (const pattern of patterns) {
      if (pattern.test(content)) {
        lastUsedTools.push(tool);
        break; // One match per tool is enough
      }
    }
  }
  
  // Detect output type
  let lastOutputType: PreviousToolContext['lastOutputType'] = undefined;
  for (const [outputType, patterns] of Object.entries(OUTPUT_DETECTION_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(content)) {
        lastOutputType = outputType as PreviousToolContext['lastOutputType'];
        break;
      }
    }
    if (lastOutputType) break;
  }
  
  if (lastUsedTools.length === 0 && !lastOutputType) {
    return undefined;
  }
  
  return {
    lastUsedTools,
    lastOutputType,
    lastToolSuccess: true, // Assume success if we got a response
  };
}

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

  // Extract previous tool context from conversation history
  const previousToolContext = extractPreviousToolContext(conversationHistory);

  // Step 1: Run regex-based analysis (fast, free)
  const toolsResult = analyzeQueryIntent({
    query,
    availableTools,
    attachedFiles,
    conversationHistory,
    autoEnabledTools,
    userSelectedTools,
    previousToolContext, // Pass extracted context for follow-up detection
  });

  const modelResult = scoreQueryComplexity(query);

  // Step 2: Check confidence and decide if LLM fallback is needed
  // LLM fallback provides a safety net when regex patterns aren't confident
  // 
  // The LLM classifier will:
  // 1. Verify if tools are actually needed (even if regex found none)
  // 2. Select the right tool when regex is uncertain
  // 3. Handle context-dependent queries (follow-ups, pronouns)
  
  // Low confidence = regex isn't sure, let LLM verify
  const toolsLowConfidence = toolsResult.confidence < fallbackThreshold && toolsResult.tools.length === 0;

  // Simple greetings never need LLM - these are obviously no-tool queries
  const isSimpleGreeting = /^(hi|hello|hey|thanks|thank you|ok|okay|bye|goodbye|yes|no|sure|yep|nope|cool|nice|great|awesome|perfect|got it|alright|sounds good|understood|noted|right|exactly|indeed|absolutely|definitely|certainly|of course|for sure|makes sense|i see|ah|oh|wow|interesting|good|fine|neat)[\s!?.]*$/i.test(query.trim());
  
  // SMART FOLLOW-UP DETECTION (no LLM needed)
  // If previous assistant used a tool AND current query doesn't indicate a clear NEW topic, inherit the tool
  // This is more robust than requiring specific patterns
  const hasPreviousToolContext = previousToolContext?.lastUsedTools && previousToolContext.lastUsedTools.length > 0;
  const noToolsDetected = toolsResult.tools.length === 0;
  
  // Patterns that indicate user is starting a NEW topic (don't inherit)
  const isNewTopicIndicator = /^(now|next|let'?s|can you|could you|please|i want|i need|i'?d like|how (do|can|to)|what (is|are|about)|tell me about|explain|show me|help me with|switch to|change to|forget|never ?mind|start|begin)/i.test(query.trim());
  
  // Patterns that strongly indicate follow-up (definitely inherit)
  const isFollowUpIndicator = /^(and|also|what about|how about|same for|do the same|continue|more|another|again|else|other|too|as well|plus|additionally|furthermore|give me|show me more|tell me more|any more|anything else)/i.test(query.trim()) ||
    // Short queries are usually follow-ups (zipcodes, names, numbers, short answers)
    (query.trim().length <= 30 && !isNewTopicIndicator) ||
    // Queries with pronouns referring to previous context
    /^(it|this|that|these|those|the same|for this|for that|about this|about that)\b/i.test(query.trim());
  
  // Inherit tools if: previous used tools + (follow-up indicator OR (no new topic + no tools detected))
  const shouldInheritTools = hasPreviousToolContext && 
    !isSimpleGreeting && 
    noToolsDetected &&
    (isFollowUpIndicator || !isNewTopicIndicator);
  
  if (shouldInheritTools && previousToolContext?.lastUsedTools) {
    // Inherit tools from previous context
    const inheritedTools = previousToolContext.lastUsedTools.filter(
      tool => availableTools.includes(tool)
    );
    
    if (inheritedTools.length > 0) {
      if (process.env.DEBUG_INTENT_ANALYZER) {
        console.log('[IntentAnalyzer] Follow-up detected, inheriting tools:', inheritedTools);
        console.log('[IntentAnalyzer] Reason:', isFollowUpIndicator ? 'explicit follow-up' : 'no new topic detected');
      }
      
      // Return immediately with inherited tools - no LLM needed
      return {
        tools: {
          tools: inheritedTools,
          confidence: 0.7, // Moderate confidence for inherited tools
          reasoning: `Follow-up to previous query, inheriting ${inheritedTools.join(', ')}`,
        },
        model: {
          ...modelResult,
          tier: 'moderate' as const, // At least moderate when using tools
        },
        usedLlmFallback: false,
      };
    }
  }

  // Detect short selection responses (1, 2, 3, A, B, first, second, etc.)
  // These need LLM because we can't know what the options were
  const isSelectionResponse = /^[1-9a-e]\.?$/i.test(query.trim()) || 
    /^(first|second|third|option\s*[1-9a-e]|choice\s*[1-9a-e])$/i.test(query.trim());
  
  // Very short queries with conversation history
  // Need LLM to understand context
  const needsContextFromHistory = query.length <= 5 && 
    conversationHistory && conversationHistory.length > 0 &&
    toolsResult.tools.length === 0;
  
  // Contextual references like "it", "this" etc.
  // Need LLM to understand what they refer to
  const hasContextualReference = conversationHistory && conversationHistory.length > 0 && 
    toolsResult.tools.length === 0 && // Only if no tools already selected
    /\b(it|this|that|these|those|them)\b/i.test(query) &&
    // Exclude cases where we already detected follow-up patterns
    !/\b(same|again|continue|another|more|change|modify|update|fix)\b/i.test(query);
  
  // Use LLM when:
  // 1. Regex confidence is low (safety net verification)
  // 2. Selection responses (need context)
  // 3. Short queries with history (need context)
  // 4. Contextual references (need context)
  const shouldUseLlm =
    (toolsLowConfidence || isSelectionResponse || needsContextFromHistory || hasContextualReference) &&
    llmFallback &&
    !isSimpleGreeting;

  // Debug logging to understand LLM fallback triggers
  if (process.env.DEBUG_INTENT_ANALYZER) {
    console.log('[IntentAnalyzer] Query:', query.slice(0, 50));
    console.log('[IntentAnalyzer] Regex result:', { 
      tools: toolsResult.tools, 
      confidence: toolsResult.confidence 
    });
    console.log('[IntentAnalyzer] Conversation history:', {
      length: conversationHistory?.length || 0,
      queryLength: query.length,
      previousToolContext: previousToolContext ? {
        tools: previousToolContext.lastUsedTools,
        outputType: previousToolContext.lastOutputType,
      } : 'none',
    });
    console.log('[IntentAnalyzer] LLM triggers:', {
      toolsLowConfidence,
      isSelectionResponse,
      needsContextFromHistory,
      hasContextualReference,
      shouldUseLlm,
    });
  }

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
        classifierUsage: llmResult.usage,
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