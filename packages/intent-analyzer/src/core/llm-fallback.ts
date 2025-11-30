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
} from './types';

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
 * Model tier information - compact format to minimize tokens
 * Sources: AWS Bedrock + Anthropic docs (2025)
 * 
 * 5-TIER SYSTEM: Nova Lite is the minimum for trivial tasks
 * Nova Micro is only for classifierModel (internal routing) - NOT for user-facing responses
 */
const MODEL_TIER_INFO = `
MODEL TIERS - 4-TIER SYSTEM (pick based on task complexity):
┌──────────┬─────────────────┬──────────────────┬─────────┬──────────┬───────────────────────────────────────────────────────────┐
│ Tier     │ Model           │ Cost (in/out 1M) │ Context │ Target % │ Best For                                                  │
├──────────┼─────────────────┼──────────────────┼─────────┼──────────┼───────────────────────────────────────────────────────────┤
│ SIMPLE   │ Nova Micro      │ $0.035 / $0.14   │ 128K    │ ~1%      │ Greetings, acknowledgments, yes/no, simple text-only      │
│ MODERATE │ Haiku 4.5       │ $1.00 / $5.00    │ 200K    │ ~80%     │ Most tasks, tool usage, standard code, explanations       │
│ COMPLEX  │ Sonnet 4.5      │ $3.00 / $15.00   │ 200K    │ ~15%     │ Debugging, code review, detailed analysis                 │
│ EXPERT   │ Opus 4.5        │ $15.00 / $75.00  │ 200K    │ ~4%      │ Deep analysis, architecture, research, PhD-level          │
└──────────┴─────────────────┴──────────────────┴─────────┴──────────┴───────────────────────────────────────────────────────────┘

CRITICAL ROUTING RULES:
- SIMPLE (~1%): ONLY for text-only greetings ("hi", "hello"), acknowledgments ("cool", "nice", "ok"), yes/no
- MODERATE (~80%): DEFAULT for most tasks. ANY tool usage (web_search, execute_code, file_search, artifacts) → MODERATE minimum
- COMPLEX (~15%): Debugging, detailed code review, complex analysis
- EXPERT (~4%): Deep/comprehensive analysis, system architecture, complex algorithms, research
- Keywords like "deep analysis", "comprehensive review", "dig deep", "detailed view" → EXPERT
`;

/**
 * Build the prompt for LLM classification
 * Now includes regex suggestions so LLM can decide to keep or change them
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
  const toolDescriptions: Record<Tool, string> = {
    [Tool.WEB_SEARCH]: 'web_search - Search the internet for current information, news, real-time data',
    [Tool.CODE_INTERPRETER]: 'execute_code - Run Python/JS code for calculations, data analysis, matplotlib charts (NOT for UI)',
    [Tool.FILE_SEARCH]: 'file_search - Search through uploaded documents using RAG',
    [Tool.ARTIFACTS]: 'artifacts - Create UI: React components, dashboards, visualizations, HTML/CSS (CAN work alone, no code executor needed)',
  };

  const toolList = availableTools.length > 0 
    ? availableTools.map((t) => toolDescriptions[t] || t).join('\n')
    : 'No tools available';

  const historyContext =
    conversationHistory && conversationHistory.length > 0
      ? `\n=== CONVERSATION HISTORY (CRITICAL FOR SELECTIONS) ===\n${conversationHistory
          .slice(-3)
          .map((m) => `[${m.role.toUpperCase()}]: ${m.content.slice(0, 300)}`)
          .join('\n')}\n=== END HISTORY ===\n`
      : '';

  // Detect if this looks like a selection response
  const isSelectionQuery = /^[1-9a-e]\.?$/i.test(query.trim()) || 
    /^(first|second|third|option\s*[1-9a-e]|choice\s*[1-9a-e])$/i.test(query.trim());
  
  const selectionWarning = isSelectionQuery 
    ? `\n⚠️ SELECTION DETECTED: Query "${query}" appears to be a selection from options above.\nYou MUST select the tool that corresponds to this option number from the conversation history.\nDO NOT return tools: [] - map the selection to the appropriate tool!\n`
    : '';

  // Build attached files context
  let attachedFilesContext = '';
  if (attachedFiles && attachedFiles.files.length > 0) {
    const fileDescriptions = attachedFiles.files.map(f => {
      const type = f.mimetype.startsWith('image/') ? 'IMAGE' : 
                   f.mimetype.includes('pdf') ? 'PDF' :
                   f.mimetype.includes('csv') ? 'CSV DATA' :
                   f.mimetype.includes('spreadsheet') || f.mimetype.includes('excel') ? 'SPREADSHEET' :
                   f.mimetype.includes('text') ? 'TEXT FILE' : 'FILE';
      return `  - ${type}: ${f.filename} (${f.mimetype})`;
    }).join('\n');
    
    attachedFilesContext = `
=== ATTACHED FILES (CRITICAL CONTEXT) ===
User has attached ${attachedFiles.files.length} file(s):
${fileDescriptions}
File intents detected: ${attachedFiles.uploadIntents.join(', ')}

IMPORTANT: When user says "summarize this", "describe this", "what is this", "analyze this" with attached files:
- For IMAGES: The model can see and analyze the image directly - tier depends on complexity
- For CSVs/spreadsheets: Consider execute_code for data analysis
- For PDFs/documents: Consider file_search for RAG retrieval
- DO NOT ask for clarification when files provide obvious context!
=== END ATTACHED FILES ===
`;
  }

  // Build regex suggestions context
  let regexContext = '';
  if (regexSuggestions) {
    const suggestedTools = regexSuggestions.tools.length > 0 
      ? regexSuggestions.tools.join(', ') 
      : 'none';
    regexContext = `
Pattern-based analysis (regex) suggests:
- Tools: ${suggestedTools} (confidence: ${(regexSuggestions.toolsConfidence * 100).toFixed(0)}%)
- Model tier: ${regexSuggestions.modelTier.toUpperCase()} (score: ${(regexSuggestions.modelScore * 100).toFixed(0)}%)

Review these suggestions and decide: Keep them OR override if clearly wrong.
`;
  }

  return `You are a query classifier for an AI assistant. Analyze the query and select the appropriate tools and model tier.

${historyContext}${selectionWarning}${attachedFilesContext}
User query: "${query}"
${regexContext}
Available tools:
${toolList}
${MODEL_TIER_INFO}
Respond in JSON only:
{
  "tools": ["tool_name"],
  "modelTier": "trivial|simple|moderate|complex|expert",
  "reasoning": "brief explanation",
  "needsClarification": false,
  "clarificationPrompt": null,
  "clarificationOptions": null
}

CLARIFICATION RULES:
- If the query is VAGUE or AMBIGUOUS about what the user wants, set needsClarification=true
- Provide clarificationPrompt (question to ask) and clarificationOptions (array of choices)
- Examples that NEED clarification:
  * "visualize this" → unclear if React UI, matplotlib chart, or diagram
  * "create something" → unclear what type
  * "show me a chart" → could be React (artifacts) or Python (execute_code)
- Examples that DON'T need clarification:
  * "create a react dashboard" → clear: artifacts
  * "plot with matplotlib" → clear: execute_code
  * "search for news" → clear: web_search

VISUALIZATION AMBIGUITY - CRITICAL:
- "visualize", "chart", "graph", "plot" WITHOUT specifying React/Python → NEEDS CLARIFICATION
- These words are ambiguous: user could want React UI OR Python matplotlib
- If both artifacts AND execute_code are available and query says "visualize"/"chart"/"graph":
  → Set needsClarification=true
  → clarificationPrompt: "I can create visualizations in different ways. Which format would you prefer?"
  → clarificationOptions: ["Interactive dashboard/graph (editable, clickable)", "Static image/chart (PNG, embedded in response)"]
- Use USER-FRIENDLY language, NOT technical terms (no "React", "matplotlib", "Python" etc.)

CRITICAL Rules (4-Tier System):
- SIMPLE (~1%): ONLY for text-only greetings/acknowledgments - NO TOOLS
- MODERATE (~80%): DEFAULT tier. Any tool usage → MODERATE minimum
- COMPLEX (~15%): Debugging, detailed code review, complex analysis
- EXPERT (~4%): ONLY for "deep analysis", "comprehensive review", system architecture, PhD-level research
- If tools are selected → MODERATE minimum (Haiku 4.5 handles tools well)
- Don't over-upgrade: most queries are MODERATE

ARTIFACTS vs EXECUTE_CODE:
- artifacts ALONE handles: dashboards, UI components, React apps, HTML pages, visualizations, charts in React
- execute_code ALONE handles: Python calculations, data analysis, matplotlib/seaborn charts, file processing
- DO NOT combine both unless user explicitly needs BOTH Python analysis AND React UI
- "generate a dashboard" / "create a UI" / "build a component" → artifacts ONLY
- "analyze this CSV" / "calculate statistics" / "plot with matplotlib" → execute_code ONLY

FOLLOW-UP QUERIES:
- If conversation history shows user asked for data (stocks, news, prices), a follow-up asking for "analysis" or "more details" should:
  1. Use web_search if fresh data is needed (likely YES for stocks, news, prices)
  2. Stay at MODERATE tier - just formatting/explaining data

SELECTION RESPONSES - CRITICAL (MUST SELECT TOOLS):
- If user responds with "1", "2", "3" or "a", "b", "c" - THIS IS A SELECTION
- YOU MUST look at the PREVIOUS assistant message and SELECT THE CORRESPONDING TOOL
- If previous message offered: "1. Interactive React component 2. Python chart"
  → User says "1" → tools: ["artifacts"], tier: "moderate"
  → User says "2" → tools: ["execute_code"], tier: "moderate"
- Selection responses REQUIRE you to select tools based on context
- Example conversation:
  Assistant: "Which would you prefer? 1. Interactive React component 2. Python chart"
  User: "1"
  → YOUR RESPONSE MUST BE: {"tools": ["artifacts"], "modelTier": "moderate", "reasoning": "User selected option 1 (React component)"}`;
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
): Promise<{ tools: QueryIntentResult; model: ModelRoutingResult } | null> {
  const prompt = buildClassificationPrompt(query, availableTools, regexSuggestions, conversationHistory, attachedFiles);

  try {
    const response = await llmFunction(prompt);
    const parsed = parseClassificationResponse(response);

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
    };
  } catch (error) {
    // LLM call failed, return null to use pattern-based fallback
    console.warn('LLM classification failed:', error);
    return null;
  }
}
