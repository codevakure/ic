/**
 * LLM Fallback for Query Analysis
 *
 * When regex patterns have low confidence, use an LLM to classify:
 * 1. Which tools to use
 * 2. Which model tier is appropriate
 *
 * The LLM function is INJECTED - this keeps the package pure and reusable.
 * The caller provides the actual LLM call (e.g., using Nova Micro).
 */

import {
  Tool,
  type ModelTier,
  type QueryIntentResult,
  type ModelRoutingResult,
  type LlmFallbackFunction,
  type LlmFallbackResponse,
} from './types';

// Nova Micro pricing per 1K tokens (matches AWS official pricing)
const CLASSIFIER_PRICING = {
  input: 0.000035,  // $0.000035 per 1K input tokens
  output: 0.00014,  // $0.00014 per 1K output tokens
};

/**
 * Response structure from LLM classification
 */
interface LlmClassificationResponse {
  tools: string[];
  modelTier: string;
  reasoning: string;
  /** When intent is ambiguous, provide clarification options */
  needsClarification?: boolean;
  clarificationPrompt?: string;
  clarificationOptions?: string[];
}

/**
 * Build the prompt for LLM classification
 * SIMPLIFIED for Nova Micro - clear, concise, direct
 */
function buildClassificationPrompt(
  query: string,
  availableTools: Tool[],
  regexSuggestions?: {
    tools: Tool[];
    toolsConfidence: number;
    modelTier: string;
    modelScore: number;
  },
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>,
  attachedFiles?: {
    files: Array<{ filename: string; mimetype: string; size?: number }>;
    uploadIntents: string[];
  },
): string {
  // Simple tool list
  const toolList = availableTools.map(t => {
    switch(t) {
      case Tool.WEB_SEARCH: return 'web_search: look up current info from the internet (news, prices, weather, facts)';
      case Tool.CODE_INTERPRETER: return 'execute_code: do math, work with numbers/data, create downloadable files (presentations, reports, spreadsheets)';
      case Tool.FILE_SEARCH: return 'file_search: read and answer questions about uploaded files';
      case Tool.ARTIFACTS: return 'artifacts: build interactive visuals like charts, dashboards, or mini-apps';
      default: return t;
    }
  }).join('\n');

  // Conversation history - last 2 messages only, shorter
  let historyContext = '';
  if (conversationHistory && conversationHistory.length > 0) {
    const recent = conversationHistory.slice(-2);
    historyContext = `CONVERSATION CONTEXT:\n${recent.map(m => 
      `${m.role}: ${m.content.slice(0, 150)}${m.content.length > 150 ? '...' : ''}`
    ).join('\n')}\n\n`;
  }

  // Attached files - simple
  let filesContext = '';
  if (attachedFiles && attachedFiles.files.length > 0) {
    filesContext = `ATTACHED FILES: ${attachedFiles.files.map(f => f.filename).join(', ')}\n\n`;
  }

  // Build simple prompt
  return `Classify this query. Pick tools and complexity tier.

${historyContext}${filesContext}QUERY: "${query}"

TOOLS (pick 0 or more):
${toolList}

TIERS:
- simple: greetings only ("hi", "thanks")
- moderate: most queries, any tool usage
- complex: debugging, detailed analysis
- expert: deep research, architecture

RULES:
1. Looking up something online, news, weather, prices → web_search
2. Math, calculations, working with data, making a file to download (presentation, report, spreadsheet) → execute_code
3. Questions about an uploaded file ("what does it say", "summarize this") → file_search
4. Building something visual or interactive → artifacts
5. If user asks to "check the web" or "search online" → web_search
6. If any tool is used → tier must be "moderate" or higher
7. CRITICAL: Short replies like numbers, "yes", "more" are FOLLOW-UPS
   - Look at CONVERSATION CONTEXT to understand what they really want
   - Example: previous question was about weather, user says "75247" → they want weather for that zip → web_search
   - Example: previous used web_search, user says "more details" → continue with web_search

JSON response only:
{"tools":[],"modelTier":"moderate","reasoning":"brief"}`;
}

/**
 * Parse LLM response to classification result
 */
function parseClassificationResponse(response: string): LlmClassificationResponse | null {
  try {
    // Try to extract JSON from the response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return null;
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Validate structure
    if (!Array.isArray(parsed.tools) || typeof parsed.modelTier !== 'string') {
      return null;
    }

    return {
      tools: parsed.tools,
      modelTier: parsed.modelTier.toLowerCase(),
      reasoning: parsed.reasoning || 'LLM classification',
      needsClarification: parsed.needsClarification === true,
      clarificationPrompt: parsed.clarificationPrompt || undefined,
      clarificationOptions: Array.isArray(parsed.clarificationOptions) ? parsed.clarificationOptions : undefined,
    };
  } catch {
    return null;
  }
}

/**
 * Map tool string to Tool enum
 */
function mapToToolEnum(toolStr: string, availableTools: Tool[]): Tool | null {
  const normalized = toolStr.toLowerCase().replace(/[^a-z_]/g, '');

  // Map common variations
  const toolMap: Record<string, Tool> = {
    web_search: Tool.WEB_SEARCH,
    websearch: Tool.WEB_SEARCH,
    search: Tool.WEB_SEARCH,
    execute_code: Tool.CODE_INTERPRETER,
    code_interpreter: Tool.CODE_INTERPRETER,
    code: Tool.CODE_INTERPRETER,
    file_search: Tool.FILE_SEARCH,
    filesearch: Tool.FILE_SEARCH,
    rag: Tool.FILE_SEARCH,
    artifacts: Tool.ARTIFACTS,
    artifact: Tool.ARTIFACTS,
    ui: Tool.ARTIFACTS,
  };

  const tool = toolMap[normalized];
  if (tool && availableTools.includes(tool)) {
    return tool;
  }

  return null;
}

/**
 * Validate and normalize model tier (4-tier system)
 */
function normalizeModelTier(tier: string): ModelTier {
  const normalized = tier.toLowerCase().trim();
  const validTiers: ModelTier[] = ['simple', 'moderate', 'complex', 'expert'];

  if (validTiers.includes(normalized as ModelTier)) {
    return normalized as ModelTier;
  }

  // Default to moderate (Haiku 4.5) for unknown - safer default
  return 'moderate';
}

/**
 * Use LLM to classify query when pattern confidence is low
 * Now receives regex suggestions so LLM can decide to keep or override
 *
 * @param query - The user's query
 * @param availableTools - Tools available for selection
 * @param llmFunction - Injectable LLM function (e.g., Nova Micro call)
 * @param regexSuggestions - What regex patterns suggested (tools + model tier)
 * @param conversationHistory - Optional conversation context
 * @param attachedFiles - Optional attached files info (images, documents, etc.)
 * @returns Classification result with tools and model tier
 */
export async function classifyWithLlm(
  query: string,
  availableTools: Tool[],
  llmFunction: LlmFallbackFunction,
  regexSuggestions?: {
    tools: Tool[];
    toolsConfidence: number;
    modelTier: string;
    modelScore: number;
  },
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>,
  attachedFiles?: {
    files: Array<{ filename: string; mimetype: string; size?: number }>;
    uploadIntents: string[];
  },
): Promise<{ 
  tools: QueryIntentResult; 
  model: ModelRoutingResult;
  usage?: { inputTokens: number; outputTokens: number; cost: number };
} | null> {
  const prompt = buildClassificationPrompt(query, availableTools, regexSuggestions, conversationHistory, attachedFiles);

  try {
    const rawResponse = await llmFunction(prompt);
    
    // Handle both string response (legacy) and object response (with usage)
    let responseText: string;
    let usage: { inputTokens: number; outputTokens: number; cost: number } | undefined;
    
    if (typeof rawResponse === 'string') {
      responseText = rawResponse;
    } else {
      const llmResponse = rawResponse as LlmFallbackResponse;
      responseText = llmResponse.text;
      if (llmResponse.usage) {
        const inputCost = (llmResponse.usage.inputTokens / 1_000_000) * CLASSIFIER_PRICING.input;
        const outputCost = (llmResponse.usage.outputTokens / 1_000_000) * CLASSIFIER_PRICING.output;
        usage = {
          inputTokens: llmResponse.usage.inputTokens,
          outputTokens: llmResponse.usage.outputTokens,
          cost: inputCost + outputCost,
        };
      }
    }
    
    const parsed = parseClassificationResponse(responseText);

    if (!parsed) {
      return null;
    }

    // Map tools to enums and filter to available
    const mappedTools = parsed.tools
      .map((t) => mapToToolEnum(t, availableTools))
      .filter((t): t is Tool => t !== null);

    let tier = normalizeModelTier(parsed.modelTier);

    // CRITICAL: Elevate tier based on task requirements
    const hasArtifacts = mappedTools.includes(Tool.ARTIFACTS);
    const hasTools = mappedTools.length > 0;
    
    // Tool usage requires Claude models (Haiku 4.5 minimum)
    if (hasTools && tier === 'simple') {
      tier = 'moderate'; // Haiku 4.5 for tool usage
    }
    
    // Artifacts: 80% Haiku, 20% Sonnet for cost optimization
    if (hasArtifacts && tier === 'moderate') {
      tier = Math.random() < 0.8 ? 'moderate' : 'complex';
    }

    // Map tier to score for consistency (4-tier system)
    const tierScores: Record<ModelTier, number> = {
      simple: 0.05,
      moderate: 0.4,
      complex: 0.7,
      expert: 0.9,
    };

    // Build the tools result with optional clarification
    const toolsResult: QueryIntentResult = {
      tools: mappedTools,
      confidence: parsed.needsClarification ? 0.5 : 0.8, // Lower confidence if clarification needed
      reasoning: `LLM: ${parsed.reasoning}`,
    };

    // Add clarification if LLM detected ambiguity
    if (parsed.needsClarification && parsed.clarificationPrompt) {
      toolsResult.clarificationPrompt = parsed.clarificationPrompt;
      toolsResult.clarificationOptions = parsed.clarificationOptions;
    }

    return {
      tools: toolsResult,
      model: {
        tier,
        score: tierScores[tier],
        categories: ['llm-classified'],
        reasoning: `LLM: ${parsed.reasoning}`,
      },
      usage,
    };
  } catch (error) {
    // LLM call failed, return null to use pattern-based fallback
    console.warn('LLM classification failed:', error);
    return null;
  }
}
