/**
 * Query Intent Analyzer
 * 
 * Determines which tools to use based on:
 * 1. User explicitly selected tools (highest priority)
 * 2. Attached files (file type determines tool)
 * 3. Auto-enabled tools + query intent
 * 4. Query pattern matching (LLM-style with keyword fallback)
 * 
 * Returns tools in priority order with dynamic context prompts
 */

import { 
  Tool, 
  QueryContext, 
  QueryIntentResult, 
  UploadIntent,
  AttachedFileContext 
} from './types';

/**
 * Query patterns that suggest specific tools
 * Organized by confidence level (high, medium, low)
 * 
 * Pattern design inspired by:
 * - LlamaIndex keyword extraction (simple regex + stopword filtering)
 * - RAKE algorithm patterns (phrase extraction)
 * - Common NLP intent patterns from production systems
 * 
 * Each pattern is designed to capture:
 * - Explicit tool requests ("run code", "search documents")
 * - Implicit intent through action verbs ("analyze", "calculate")
 * - Domain-specific keywords (file types, tool names)
 * - Contextual phrases (questions about documents, data, etc.)
 */
const QUERY_PATTERNS: Record<Tool, { high: RegExp[]; medium: RegExp[]; low: RegExp[] }> = {
  [Tool.FILE_SEARCH]: {
    high: [
      // Explicit document search requests
      /\b(search|find|look\s*up|locate|retrieve)\b.*\b(in\s+)?(the\s+)?(documents?|files?|pdfs?|attachments?|uploads?)\b/i,
      /\b(in\s+the\s+)?(documents?|files?|pdfs?|attachments?|uploads?)\b.*\b(search|find|look\s*up|locate)\b/i,
      // "What does X say" patterns
      /\b(what\s+does|according\s+to|based\s+on|as\s+stated\s+in|as\s+mentioned\s+in)\b.*\b(document|file|pdf|attachment|contract|report|article|paper|manual|guide|specification)\b/i,
      /\b(document|file|pdf|attachment|contract|report)\b.*\b(say|mention|state|indicate|describe|explain|specify)\b/i,
      // Uploaded/attached file references
      /\b(from\s+the\s+)?(uploaded|attached|provided|given)\b.*\b(pdf|document|file|attachment)\b/i,
      // Direct RAG reference
      /\bRAG\b/i,
      // Citation and quotation patterns
      /\b(cite|quote|reference|excerpt)\b.*\b(from|in)\b.*\b(document|file|pdf|text|passage|section)\b/i,
      // "In the document" patterns
      /\bwhat\s+(is|are|does|do|did|was|were)\b.*\b(in\s+the\s+)?(contract|document|report|agreement|policy|terms|guidelines)\b/i,
      // "According to" patterns
      /\baccording\s+to\s+(the\s+)?(document|file|pdf|report|contract|agreement|policy)\b/i,
    ],
    medium: [
      // Summarization with document context
      /\b(summarize|summary\s+of|overview\s+of|recap)\b.*\b(document|file|pdf|attachment|report|article)\b/i,
      // Extract information patterns
      /\b(extract|pull\s+out|get)\b.*\b(from|information|data|details|key\s+points)\b/i,
      // "In the documents" without explicit search action
      /\b(in\s+the\s+(documents?|files?|pdfs?|attachments?|uploads?))\b/i,
      // Questions about document content
      /\b(what\s+is|tell\s+me|explain)\b.*\b(in|about|from)\b.*\b(the\s+)?(document|file|pdf|report)\b/i,
      // Legal/business document types
      /\b(in\s+the\s+)?(contract|agreement|terms|policy|specification|sla|nda|proposal|invoice|receipt)\b/i,
      // "Find in" patterns
      /\bfind\s+(the\s+)?(section|paragraph|clause|page|part|chapter)\b/i,
      // Reference patterns
      /\b(look\s+at|refer\s+to|check|review)\b.*\b(the\s+)?(document|file|pdf|attachment)\b/i,
      // "Mentioned in" patterns
      /\bmentioned\s+(in\s+)?(the\s+)?(document|file|pdf|report)\b/i,
    ],
    low: [
      // Generic summarization (might not need file search)
      /\b(summarize|summary|extract|overview)\b/i,
      // Reference keywords
      /\b(reference|cite|citation|source|footnote)\b/i,
      // Document types mentioned without action
      /\b(manual|handbook|whitepaper|thesis|dissertation|memo|brief)\b/i,
      // Reading/comprehension verbs
      /\b(read|reading|peruse|scan|skim)\b/i,
    ],
  },
  [Tool.CODE_INTERPRETER]: {
    high: [
      // Explicit data analysis with file types
      /\b(analyze|analysis)\b.*\b(data|dataset|spreadsheet|excel|csv|xlsx?|tsv|parquet)\b/i,
      /\b(data|dataset|spreadsheet|excel|csv|xlsx?)\b.*\b(analyze|analysis|process|parse)\b/i,
      // Run/execute code patterns
      /\b(run|execute|eval|evaluate)\b.*\b(code|script|python|javascript|sql)\b/i,
      // Visualization creation
      /\b(create|make|generate|build|draw|render)\b.*\b(chart|graph|plot|visualization|histogram|heatmap|scatter|bar\s*chart|pie\s*chart|line\s*graph)\b/i,
      // Calculation with code context
      /\b(calculate|compute|determine)\b.*\b(using|with)\b.*\b(code|python|script|program)\b/i,
      // File parsing patterns - more flexible to match "parse JSON data", "load CSV file", etc.
      /\b(parse|process|load|import|read|convert|transform)\b.*\b(the\s+)?(csv|json|xml|excel|xlsx?|yaml|parquet|sql|sqlite)\b/i,
      /\b(csv|json|xml|excel|xlsx?|yaml|parquet|sql|sqlite)\b.*\b(file|data)\b.*\b(parse|process|load|read|analyze|convert)\b/i,
      /\b(csv|json|xml|excel|xlsx?|yaml|parquet|sql|sqlite)\b.*\b(to|from)\b.*\b(csv|json|xml|excel|xlsx?|yaml|parquet|sql|sqlite)\b/i,
      // Python library references
      /\b(pandas|numpy|matplotlib|seaborn|scipy|sklearn|scikit|plotly|bokeh|altair)\b/i,
      // Machine learning patterns
      /\b(train|fit|predict|classify|cluster|regression)\b.*\b(model|algorithm|data)\b/i,
      // Data transformation patterns
      /\b(transform|convert|reshape|pivot|merge|join|concatenate)\b.*\b(data|dataframe|table|dataset)\b/i,
      // Document/file generation patterns - PowerPoint, Word, PDF, etc.
      /\b(create|make|generate|build|produce|export)\b.*\b(powerpoint|pptx?|presentation|slides?)\b/i,
      /\b(create|make|generate|build|produce|export)\b.*\b(word|docx?|document)\b/i,
      /\b(create|make|generate|build|produce|export)\b.*\b(pdf|report)\b/i,
      /\b(create|make|generate|build|produce|export)\b.*\b(excel|xlsx?|spreadsheet)\b/i,
      /\b(create|make|generate|build|produce|export)\b.*\b(zip|archive|tar)\b/i,
      /\b(create|make|generate|build|produce|export)\b.*\b(image|png|jpg|jpeg|gif|svg)\b.*\b(file)?\b/i,
      // File conversion patterns
      /\b(convert|transform|export)\b.*\b(to|as|into)\b.*\b(pdf|docx?|pptx?|xlsx?|csv|json|html)\b/i,
    ],
    medium: [
      // Mathematical operations - require code/data context
      /\b(calculate|compute|solve|evaluate)\b.*\b(using|with|in)\b.*\b(code|python|script)\b/i,
      // Visualization keywords - require creation action
      /\b(create|make|generate|build|plot|draw)\b.*\b(chart|graph|plot|visualization|diagram|figure)\b/i,
      // Statistical analysis - require data/file context (not just asking for stats)
      /\b(statistics|statistical|regression|correlation|variance|distribution)\b.*\b(on|of|for|from)\b.*\b(data|file|dataset|csv|excel)\b/i,
      /\b(run|perform|do|compute)\b.*\b(statistics|statistical|regression|correlation)\b/i,
      // Aggregation functions - require data context
      /\b(calculate|compute|find)\b.*\b(average|mean|median|mode|sum|std|standard\s*deviation|percentile)\b.*\b(of|for|from|in)\b/i,
      // Data operations - require explicit data mention
      /\b(sort|filter|group\s*by|pivot|aggregate)\b.*\b(the\s+)?(data|dataset|table|rows|columns)\b/i,
      // Data transformation with context
      /\b(transform|process|clean|normalize|standardize)\b.*\b(the\s+)?(data|dataset|file)\b/i,
      // Programming language with code context
      /\b(python|javascript|js|typescript)\b.*\b(code|script|program|function)\b/i,
      // File format with processing intent
      /\b(csv|json|xml|xlsx?|parquet|sql)\b.*\b(file|data)\b.*\b(process|analyze|parse|read)\b/i,
      // Mathematical expressions with solve intent
      /\b(equation|formula|expression)\b.*\b(solve|calculate|evaluate|compute)\b/i,
      // Time series with analysis intent
      /\b(time\s*series|trend|forecast)\b.*\b(analysis|analyze|predict|model)\b/i,
      // Follow-up modification patterns for documents/files (implies continuing code execution)
      /\b(update|modify|change|edit|improve|enhance|refine|fix)\b.*\b(it|this|the|that)\b.*\b(file|document|presentation|slides?|report|chart|graph|code)\b/i,
      /\b(make|add)\b.*\b(it|this|the|that)\b.*\b(more|better|nicer|modern|professional|presentable)\b/i,
      /\b(add|include|insert)\b.*\b(to|into|in)\b.*\b(it|this|the|that)\b.*\b(file|document|presentation|slides?|report)\b/i,
    ],
    low: [
      // Generic programming references
      /\b(python|javascript|code|script|program|algorithm)\b/i,
      // Data cleaning mention
      /\b(clean|cleaning|preprocess|preprocessing)\b.*\bdata\b/i,
      // Basic math terms
      /\b(math|mathematical|arithmetic|numeric|numerical)\b/i,
      // Output format keywords
      /\b(table|dataframe|array|matrix|vector|list)\b/i,
      // Debug/test patterns
      /\b(debug|test|verify|validate|check)\b.*\b(code|function|script)\b/i,
    ],
  },
  [Tool.ARTIFACTS]: {
    high: [
      // Explicit framework component creation
      /\b(create|build|make|generate|develop)\b.*\b(react|vue|angular|svelte)\b.*\b(component|app|application|page)\b/i,
      // Interactive element patterns
      /\b(interactive|dynamic)\b.*\b(component|widget|dashboard|ui|interface|element|visualization)\b/i,
      // Render/display UI patterns
      /\b(render|display|show|present)\b.*\b(html|component|react|ui|interface|page|widget)\b/i,
      // Build UI patterns
      /\b(build|create|design)\b.*\b(ui|user\s*interface|dashboard|layout|mockup)\b/i,
      // Web component patterns
      /\b(web\s*component|custom\s*element|html\s*element)\b/i,
      // SVG/Canvas patterns
      /\b(svg|canvas)\b.*\b(draw|render|create|generate)\b/i,
      // Form/input patterns
      /\b(create|build|make)\b.*\b(form|input|button|modal|dialog|dropdown|menu|nav)\b/i,
    ],
    medium: [
      // Generic component/UI creation
      /\b(create|build|make|generate)\b.*\b(component|ui|interface|widget|element|view)\b/i,
      // Framework-specific keywords
      /\b(react|vue|angular|svelte|html|css)\b.*\b(component|element|page|view|template)\b/i,
      // Design patterns
      /\b(design|layout|mockup|prototype|wireframe)\b/i,
      // Styling mentions
      /\b(style|styled|css|tailwind|bootstrap|material)\b.*\b(component|element|ui)\b/i,
      // Animation patterns
      /\b(animate|animation|transition|motion|framer)\b/i,
      // Card/list patterns
      /\b(card|cards|list|grid|table)\b.*\b(component|layout|view)\b/i,
    ],
    low: [
      // Generic interactive/dashboard mentions
      /\b(interactive|dashboard|widget)\b/i,
      // Single framework mentions
      /\b(react|vue|angular|html|component)\b/i,
      // Visual/display keywords
      /\b(visual|display|render|show|present)\b/i,
    ],
  },
  [Tool.WEB_SEARCH]: {
    high: [
      // Explicit web search requests
      /\b(search|look\s*up|find|google|bing)\b.*\b(on\s+the\s+)?(web|internet|online)\b/i,
      /\b(web|internet|online)\b.*\b(search|look\s*up|find|query)\b/i,
      // Current/live information patterns
      /\b(current|latest|recent|today|now|live|real.?time)\b.*\b(news|price|weather|events?|updates?|information|data|stock|market)\b/i,
      // Time-sensitive queries
      /\b(what\s+is|who\s+is|when\s+is|where\s+is|how\s+is)\b.*\b(happening|going\s+on|today|now|currently)\b/i,
      // Real-time data patterns
      /\b(real.?time|live|up.?to.?the.?minute)\b.*\b(data|information|updates?|feed|stream)\b/i,
      // Explicit year/date patterns (current events)
      /\b(in\s+)?20\d{2}\b.*\b(news|events?|updates?|release|announcement)\b/i,
      // Breaking news patterns
      /\b(breaking|latest|trending|viral)\b.*\b(news|story|stories|headline)\b/i,
      // Current price/stock patterns
      /\b(current|today'?s?|live)\b.*\b(price|value|rate|stock|forex|crypto|bitcoin|ethereum)\b/i,
    ],
    medium: [
      // Generic search patterns
      /\b(search|look\s*up|find|query)\b.*\b(information|details|about|for)\b/i,
      // News/article mentions
      /\b(news|article|blog|website|post|publication)\b/i,
      // Market/price with time context
      /\b(stock|price|market|weather|forex|crypto)\b.*\b(today|current|now|latest)\b/i,
      // Recent updates patterns
      /\b(what\s*'?s|what\s+is)\b.*\b(new|latest|happening)\b/i,
      // External source patterns
      /\b(find|get|fetch)\b.*\b(from|on)\b.*\b(the\s+)?(web|internet|online)\b/i,
      // URL/link patterns
      /\b(visit|check|open|go\s+to)\b.*\b(website|site|url|link|page)\b/i,
      // Social media patterns
      /\b(twitter|x\.com|facebook|reddit|linkedin|instagram|tiktok)\b/i,
    ],
    low: [
      // Time-related keywords (might indicate need for current info)
      /\b(current|latest|recent|new|up.?to.?date|fresh)\b/i,
      // Generic search terms
      /\b(search|google|bing|look\s*up|query|browse)\b/i,
      // External reference patterns
      /\b(external|outside|online|web)\b.*\b(source|reference|link)\b/i,
      // News/media keywords alone
      /\b(news|media|press|report|article)\b/i,
    ],
  },
};

/**
 * Explicit tool request patterns
 * These patterns detect when users directly request a specific tool capability
 * e.g., "use code interpreter", "with file search", "enable web search"
 */
const EXPLICIT_TOOL_REQUESTS: Record<Tool, RegExp[]> = {
  [Tool.FILE_SEARCH]: [
    /\b(use|enable|activate|with|using)\b.*\b(file\s*search|document\s*search|rag|retrieval)\b/i,
    /\b(file\s*search|document\s*search|rag)\b.*\b(to|for|and)\b/i,
    /\bsearch\s+(my|the|these|those)\s+(documents?|files?|pdfs?)\b/i,
  ],
  [Tool.CODE_INTERPRETER]: [
    /\b(use|enable|activate|with|using)\b.*\b(code\s*interpreter|python|execute\s*code|code\s*execution)\b/i,
    /\b(code\s*interpreter|python\s*interpreter)\b.*\b(to|for|and)\b/i,
    /\b(run|execute)\s+(this|some|the)\s+(code|script|python)\b/i,
    /\bwrite\s+(and\s+)?(run|execute)\b.*\b(code|script|python)\b/i,
  ],
  [Tool.ARTIFACTS]: [
    /\b(use|enable|activate|with|using)\b.*\b(artifacts?|components?|react)\b/i,
    /\b(create|build|make)\b.*\b(artifact|interactive\s*component)\b/i,
    /\b(render|display)\b.*\b(as\s+)?(an?\s+)?(artifact|component)\b/i,
  ],
  [Tool.WEB_SEARCH]: [
    /\b(use|enable|activate|with|using)\b.*\b(web\s*search|internet\s*search|google|bing)\b/i,
    /\b(web\s*search|internet\s*search)\b.*\b(to|for|and)\b/i,
    /\bsearch\s+(the\s+)?(web|internet|online)\s+(for|about)\b/i,
  ],
};

/**
 * Detect explicit tool requests in query
 * Returns tools that the user explicitly asked to use
 */
function detectExplicitToolRequests(query: string): Tool[] {
  const explicitTools: Tool[] = [];
  
  for (const [tool, patterns] of Object.entries(EXPLICIT_TOOL_REQUESTS)) {
    for (const pattern of patterns) {
      if (pattern.test(query)) {
        explicitTools.push(tool as Tool);
        break;
      }
    }
  }
  
  return explicitTools;
}

/**
 * Context prompts to inject based on tool selection
 * 
 * IMPORTANT: These prompts emphasize that tools are OPTIONAL.
 * The LLM should use its own knowledge first and only invoke tools when truly needed.
 */
const CONTEXT_PROMPTS: Record<Tool, string> = {
  [Tool.FILE_SEARCH]: `You have access to file search capability. Only use it when the user's question specifically requires information from their uploaded documents. If you can answer from your own knowledge or the question is general, respond directly without using file search. When you do use it, cite your sources.`,
  [Tool.CODE_INTERPRETER]: `You have access to a code interpreter. Only use it when the task genuinely requires code execution, data analysis, calculations, or visualizations that cannot be done mentally. For simple questions or explanations, respond directly from your knowledge. Files are available at /mnt/data/ when needed.`,
  [Tool.ARTIFACTS]: `You can create interactive artifacts (React components, HTML pages, visualizations). Only use this when the user explicitly wants a visual/interactive output. For explanations, code examples in text, or general questions, respond normally without creating artifacts.`,
  [Tool.WEB_SEARCH]: `You have access to web search. Only use it when you need current/real-time information that you don't have, or when the user explicitly asks you to search online. For questions you can answer from your training knowledge, respond directly without searching.`,
};

/**
 * File-based context prompts
 * 
 * These are added when files are attached - but still emphasize that tool use is optional.
 */
const FILE_CONTEXT_PROMPTS: Record<UploadIntent, string> = {
  [UploadIntent.IMAGE]: `The user has attached images. Analyze them using your vision capabilities if the question relates to the images.`,
  [UploadIntent.FILE_SEARCH]: `The user has attached documents (PDF, text, etc.). If their question requires information from these documents, use file search. For general questions unrelated to the documents, respond from your knowledge.`,
  [UploadIntent.CODE_INTERPRETER]: `The user has attached data files (spreadsheet, CSV, code files). If they ask you to analyze or process this data, the files are available at /mnt/data/. For questions about the data that don't require processing, you can respond directly.`,
};

/**
 * Calculate intent score from query patterns
 * Uses tiered confidence: high (0.4), medium (0.25), low (0.1)
 */
function scoreQueryIntent(query: string, tool: Tool): number {
  const patterns = QUERY_PATTERNS[tool];
  if (!patterns) return 0;
  
  let score = 0;
  
  // High confidence patterns
  for (const pattern of patterns.high) {
    if (pattern.test(query)) {
      score += 0.4;
    }
  }
  
  // Medium confidence patterns
  for (const pattern of patterns.medium) {
    if (pattern.test(query)) {
      score += 0.25;
    }
  }
  
  // Low confidence patterns (fallback keywords)
  for (const pattern of patterns.low) {
    if (pattern.test(query)) {
      score += 0.1;
    }
  }
  
  return Math.min(score, 1);
}

/**
 * Determine tools from attached files
 */
function getToolsFromAttachments(attachedFiles?: AttachedFileContext): Tool[] {
  if (!attachedFiles) {
    console.log(`[IntentAnalyzer:Query] No attachedFiles provided`);
    return [];
  }
  
  if (!attachedFiles.uploadIntents?.length) {
    console.log(`[IntentAnalyzer:Query] attachedFiles provided but no uploadIntents: ${JSON.stringify(attachedFiles)}`);
    return [];
  }

  console.log(`[IntentAnalyzer:Query] Processing ${attachedFiles.uploadIntents.length} upload intents: [${attachedFiles.uploadIntents.join(', ')}]`);

  const tools: Tool[] = [];
  
  for (const intent of attachedFiles.uploadIntents) {
    console.log(`[IntentAnalyzer:Query] Mapping intent "${intent}" to tool...`);
    switch (intent) {
      case UploadIntent.FILE_SEARCH:
        if (!tools.includes(Tool.FILE_SEARCH)) {
          tools.push(Tool.FILE_SEARCH);
          console.log(`[IntentAnalyzer:Query] → Added FILE_SEARCH tool`);
        }
        break;
      case UploadIntent.CODE_INTERPRETER:
        if (!tools.includes(Tool.CODE_INTERPRETER)) {
          tools.push(Tool.CODE_INTERPRETER);
          console.log(`[IntentAnalyzer:Query] → Added CODE_INTERPRETER tool`);
        }
        break;
      // Images don't map to a tool - they use vision built into the model
      default:
        console.log(`[IntentAnalyzer:Query] → No tool mapping for intent "${intent}"`);
    }
  }

  console.log(`[IntentAnalyzer:Query] Tools from attachments: [${tools.join(', ')}]`);
  return tools;
}

/**
 * Map AgentCapabilities string to Tool enum
 */
export function capabilityToTool(capability: string): Tool | null {
  const mapping: Record<string, Tool> = {
    'file_search': Tool.FILE_SEARCH,
    'execute_code': Tool.CODE_INTERPRETER,
    'artifacts': Tool.ARTIFACTS,
    'web_search': Tool.WEB_SEARCH,
  };
  return mapping[capability] ?? null;
}

/**
 * Map Tool enum to AgentCapabilities string
 */
export function toolToCapability(tool: Tool): string {
  const mapping: Record<Tool, string> = {
    [Tool.FILE_SEARCH]: 'file_search',
    [Tool.CODE_INTERPRETER]: 'execute_code',
    [Tool.ARTIFACTS]: 'artifacts',
    [Tool.WEB_SEARCH]: 'web_search',
  };
  return mapping[tool];
}

/**
 * Analyze query to determine which tools to use
 * 
 * Priority order:
 * 1. User explicitly selected tools (always included)
 * 2. Tools needed for attached files (always included if files present)
 * 3. Auto-enabled tools that match query intent (lower threshold)
 * 4. Non-auto-enabled tools with high query match (higher threshold)
 */
export function analyzeQueryIntent(context: QueryContext): QueryIntentResult {
  const { 
    query, 
    attachedFiles, 
    availableTools,
    autoEnabledTools = [],
    userSelectedTools = [],
  } = context;
  
  console.log(`[IntentAnalyzer:Query] ========== TOOL SELECTION START ==========`);
  console.log(`[IntentAnalyzer:Query] Query: "${query.substring(0, 100)}${query.length > 100 ? '...' : ''}"`);
  console.log(`[IntentAnalyzer:Query] Available tools: [${availableTools.join(', ')}]`);
  console.log(`[IntentAnalyzer:Query] Auto-enabled tools: [${autoEnabledTools.join(', ')}]`);
  console.log(`[IntentAnalyzer:Query] User-selected tools: [${userSelectedTools.join(', ')}]`);
  if (attachedFiles?.files?.length) {
    console.log(`[IntentAnalyzer:Query] Attached files: ${attachedFiles.files.map(f => f.filename).join(', ')}`);
    console.log(`[IntentAnalyzer:Query] File upload intents: [${attachedFiles.uploadIntents?.join(', ')}]`);
  }
  
  const selectedTools: Tool[] = [];
  const contextPrompts: string[] = [];
  const reasoning: string[] = [];

  // Step 1: Add user explicitly selected tools (highest priority)
  for (const tool of userSelectedTools) {
    if (availableTools.includes(tool) && !selectedTools.includes(tool)) {
      selectedTools.push(tool);
      reasoning.push(`${toolToCapability(tool)} explicitly selected by user`);
    }
  }

  // Step 1.5: Detect explicit tool requests in query (e.g., "use code interpreter", "with file search")
  const explicitlyRequestedTools = detectExplicitToolRequests(query);
  if (explicitlyRequestedTools.length > 0) {
    console.log(`[IntentAnalyzer:Query] Explicit tool requests detected: [${explicitlyRequestedTools.join(', ')}]`);
    for (const tool of explicitlyRequestedTools) {
      if (availableTools.includes(tool) && !selectedTools.includes(tool)) {
        selectedTools.push(tool);
        reasoning.push(`${toolToCapability(tool)} explicitly requested in query`);
      }
    }
  }

  // Step 2: Get tools from attachments (file type determines tool)
  const attachmentTools = getToolsFromAttachments(attachedFiles);
  for (const tool of attachmentTools) {
    if (availableTools.includes(tool) && !selectedTools.includes(tool)) {
      selectedTools.push(tool);
      reasoning.push(`${toolToCapability(tool)} needed for attached files`);
    }
  }

  // Add file context prompts
  if (attachedFiles?.uploadIntents) {
    for (const intent of attachedFiles.uploadIntents) {
      const prompt = FILE_CONTEXT_PROMPTS[intent];
      if (prompt && !contextPrompts.includes(prompt)) {
        contextPrompts.push(prompt);
      }
    }
  }

  // Step 3: Analyze query intent for all available tools
  console.log(`[IntentAnalyzer:Query] --- Keyword Pattern Matching ---`);
  const queryScores = new Map<Tool, number>();
  for (const tool of availableTools) {
    const score = scoreQueryIntent(query, tool);
    if (score > 0) {
      queryScores.set(tool, score);
      console.log(`[IntentAnalyzer:Query] Pattern score for ${tool}: ${score.toFixed(2)}`);
    }
  }
  if (queryScores.size === 0) {
    console.log(`[IntentAnalyzer:Query] No keyword patterns matched`);
  }

  // Step 4: CONSERVATIVE tool selection for auto-enabled tools
  // Only add auto-enabled tools if there's a meaningful signal (not just because they're auto-enabled)
  // This ensures ephemeral agents don't get tools by default - LLM can respond from memory
  for (const tool of autoEnabledTools) {
    if (!selectedTools.includes(tool) && availableTools.includes(tool)) {
      const score = queryScores.get(tool) ?? 0;
      // Require at least a medium confidence pattern match (0.25) for auto-enabled tools
      // OR the tool is needed for attached files
      if (score >= 0.25 || attachmentTools.includes(tool)) {
        selectedTools.push(tool);
        reasoning.push(`${toolToCapability(tool)} auto-enabled with signal (query score: ${score.toFixed(2)})`);
      }
    }
  }

  // Step 5: Add non-auto-enabled tools with HIGH query match only
  const sortedByScore = [...queryScores.entries()]
    .sort((a, b) => b[1] - a[1])
    .filter(([tool]) => !selectedTools.includes(tool) && !autoEnabledTools.includes(tool));

  for (const [tool, score] of sortedByScore) {
    // High threshold for non-auto-enabled tools - need strong signal
    if (score >= 0.4) {
      selectedTools.push(tool);
      reasoning.push(`${toolToCapability(tool)} matches query intent (score: ${score.toFixed(2)})`);
    }
  }

  // Step 6: Add context prompts for all selected tools
  for (const tool of selectedTools) {
    const prompt = CONTEXT_PROMPTS[tool];
    if (prompt && !contextPrompts.includes(prompt)) {
      contextPrompts.push(prompt);
    }
  }

  // Calculate overall confidence
  const userSelectedConfidence = userSelectedTools.length > 0 ? 1.0 : 0;
  const attachmentConfidence = attachmentTools.length > 0 ? 0.9 : 0;
  const queryConfidence = sortedByScore.length > 0 ? sortedByScore[0]?.[1] ?? 0 : 0;
  const confidence = Math.max(userSelectedConfidence, attachmentConfidence, queryConfidence, 0.3);

  console.log(`[IntentAnalyzer:Query] --- FINAL RESULT ---`);
  console.log(`[IntentAnalyzer:Query] Selected tools: [${selectedTools.map(t => toolToCapability(t)).join(', ')}]`);
  console.log(`[IntentAnalyzer:Query] Confidence: ${confidence.toFixed(2)}`);
  console.log(`[IntentAnalyzer:Query] Context prompts added: ${contextPrompts.length}`);
  if (contextPrompts.length > 0) {
    contextPrompts.forEach((p, i) => console.log(`[IntentAnalyzer:Query] Prompt ${i + 1}: "${p.substring(0, 80)}..."`));
  }
  console.log(`[IntentAnalyzer:Query] Reasoning: ${reasoning.join('; ') || 'No specific tool intent detected'}`);
  console.log(`[IntentAnalyzer:Query] ========== TOOL SELECTION END ==========`);

  return {
    tools: selectedTools,
    confidence,
    contextPrompts,
    reasoning: reasoning.join('; ') || 'No specific tool intent detected',
  };
}

/**
 * Quick check if a specific tool should be enabled
 */
export function shouldUseTool(tool: Tool, context: QueryContext): boolean {
  const result = analyzeQueryIntent(context);
  return result.tools.includes(tool);
}

/**
 * Get all context prompts for selected tools
 * Used to inject into the system prompt before execution
 */
export function getToolContextPrompts(tools: Tool[]): string[] {
  const prompts: string[] = [];
  for (const tool of tools) {
    const prompt = CONTEXT_PROMPTS[tool];
    if (prompt) {
      prompts.push(prompt);
    }
  }
  return prompts;
}
