/**
 * Query Intent Analyzer
 * 
 * Determines which tools to use based on:
 * 1. User explicitly selected tools (highest priority)
 * 2. Attached files (file type determines tool)
 * 3. Conversation context (follow-ups, references to previous output)
 * 4. N-gram phrase matching (common multi-word patterns)
 * 5. Auto-enabled tools + query intent
 * 6. Query pattern matching (regex with tiered confidence)
 * 
 * Uses weighted multi-signal scoring to combine all signals
 * Returns tools in priority order with dynamic context prompts
 */

import { 
  Tool, 
  QueryContext, 
  QueryIntentResult, 
  UploadIntent,
  AttachedFileContext,
  PreviousToolContext,
  IntentSignal,
  SignalSource,
} from './types';

// ============================================================================
// SIGNAL WEIGHTS - Tune these to adjust tool selection sensitivity
// ============================================================================

/**
 * Weights for different signal sources
 * Higher weight = more influence on final tool selection
 */
const SIGNAL_WEIGHTS: Record<SignalSource, number> = {
  user_selected: 1.0,      // User explicitly selected = always use
  explicit_request: 0.95,  // User asked for tool in query
  file_type: 0.9,          // File type is very strong signal
  context_followup: 0.85,  // Follow-up patterns are reliable
  context_reference: 0.75, // References to previous output
  ngram_match: 0.6,        // N-gram phrases are good signals
  regex_high: 0.5,         // High-confidence regex
  regex_medium: 0.35,      // Medium-confidence regex
  regex_low: 0.15,         // Low-confidence regex (keywords only)
};

/**
 * Confidence thresholds for tool selection
 */
const CONFIDENCE_THRESHOLDS = {
  HIGH: 0.7,      // Very confident - use tool without question
  MEDIUM: 0.5,    // Reasonably confident - use tool
  LOW: 0.3,       // Low confidence - may need LLM fallback
  MINIMUM: 0.2,   // Below this, don't select the tool
};

// ============================================================================
// N-GRAM PHRASE PATTERNS - Common multi-word phrases for each tool
// ============================================================================

/**
 * N-gram phrases that strongly suggest specific tools
 * These are 2-4 word phrases that capture natural language patterns
 * that single-word regex might miss
 */
const NGRAM_PHRASES: Record<Tool, string[]> = {
  [Tool.WEB_SEARCH]: [
    // Current/real-time information
    'what is the current',
    'what is the latest',
    'who is the current',
    'latest news on',
    'latest news about',
    'current price of',
    'stock price of',
    'weather in',
    'weather for',
    'search the web',
    'search online for',
    'look up online',
    'find online',
    'google search for',
    // Follow-up requests to use web search
    'check in web',
    'check the web',
    'check on web',
    'check online',
    'look on web',
    'look on the web',
    'look in web',
    'search on web',
    'search on internet',
    'did you check',
    'did you search',
    'can you search',
    'can you check online',
    'use web search',
    'use the web',
    'try the web',
    'try web search',
    // Sports/events
    'who won the',
    'score of the',
    'when is the next',
    'results of the',
    // Time-sensitive
    'happening right now',
    'happening today',
    'news today',
    'today\'s news',
  ],
  [Tool.CODE_INTERPRETER]: [
    // Data analysis
    'analyze this data',
    'analyze the data',
    'analyze this csv',
    'analyze this file',
    'parse this json',
    'parse the json',
    'process this data',
    'run this code',
    'execute this code',
    'run python code',
    'write python code',
    // Visualization
    'create a chart',
    'create a graph',
    'make a chart',
    'plot the data',
    'visualize this data',
    'generate a report',
    // Calculations
    'calculate the',
    'compute the',
    'sum of the',
    'average of the',
    // File operations
    'convert to csv',
    'convert to json',
    'export to excel',
    'create a spreadsheet',
    // Document generation - PDF, Word, PowerPoint, Excel
    'generate a pdf',
    'create a pdf',
    'make a pdf',
    'generate pdf document',
    'create pdf document',
    'generate a word',
    'create a word',
    'make a word',
    'generate word document',
    'create word document',
    'generate a powerpoint',
    'create a powerpoint',
    'make a powerpoint',
    'generate powerpoint presentation',
    'create powerpoint presentation',
    'generate a ppt',
    'create a ppt',
    'make a ppt',
    'generate a presentation',
    'create a presentation',
    'make a presentation',
    'generate an excel',
    'create an excel',
    'make an excel',
    'generate excel file',
    'create excel file',
    'generate xlsx',
    'create xlsx',
    'generate a csv',
    'create a csv',
    'make a csv',
    'generate csv file',
    'create csv file',
    'sample csv',
    'sample spreadsheet',
    'sample excel',
    'example csv',
    'example spreadsheet',
    'generate a slide',
    'create a slide',
    'make slides',
    'export as pdf',
    'save as pdf',
    'export to pdf',
    'export as word',
    'save as word',
    'export to word',
    'convert to pdf',
    'convert to word',
    'convert to powerpoint',
  ],
  [Tool.FILE_SEARCH]: [
    // Document queries
    'in the document',
    'in the file',
    'in the pdf',
    'from the document',
    'from the file',
    'according to the document',
    'based on the document',
    'what does the document',
    'what does the file',
    'search the document',
    'search the documents',
    'find in the document',
    'look in the document',
    // Summarization
    'summarize the document',
    'summarize this document',
    'summary of the document',
    'key points from',
    'extract from the',
  ],
  [Tool.ARTIFACTS]: [
    // UI/Component creation - all verbs
    'create a dashboard',
    'build a dashboard',
    'generate a dashboard',
    'make a dashboard',
    'design a dashboard',
    'create an interactive',
    'build an interactive',
    'generate an interactive',
    'make an interactive',
    'create a component',
    'build a component',
    'generate a component',
    'make a component',
    'react component for',
    'create a form',
    'build a form',
    'generate a form',
    'create a ui',
    'build a ui',
    'generate a ui',
    'make a ui',
    // Diagrams
    'create a diagram',
    'draw a diagram',
    'generate a diagram',
    'create a flowchart',
    'draw a flowchart',
    'generate a flowchart',
    'mermaid diagram',
    // Charts (interactive/React)
    'generate a chart',
    'build a chart',
    'make a chart',
    'generate a graph',
  ],
  [Tool.YOUTUBE_VIDEO]: [
    // Direct video references
    'this youtube video',
    'this video',
    'the youtube video',
    'the video',
    'that video',
    'that youtube video',
    // Transcript requests
    'get the transcript',
    'fetch the transcript',
    'transcript of the video',
    'transcript from youtube',
    'video transcript',
    'youtube transcript',
    // Summarize video
    'summarize the video',
    'summarize this video',
    'summary of the video',
    'what is this video about',
    'what does the video say',
    'what does this video',
    // YouTube specific
    'from youtube',
    'on youtube',
    'youtube.com',
    'youtu.be',
    // Video content extraction
    'what did they say',
    'what was said in',
    'key points from the video',
    'main points from the video',
  ],
};

// ============================================================================
// CONVERSATION CONTEXT PATTERNS - Detect follow-ups and references
// ============================================================================

/**
 * Patterns that indicate the query is a follow-up to previous output
 * When matched, we should likely use the same tool as before
 */
const FOLLOWUP_PATTERNS: RegExp[] = [
  // Direct continuation
  /^(now|next|then|also|and)\b/i,
  /\b(now|also|too)\s+(do|make|create|run|show|add)\b/i,
  
  // Same/similar/again patterns
  /\b(do\s+)?(the\s+)?same\s+(thing|for|with|but|again)\b/i,
  /\b(same\s+)?(thing\s+)?(again|one\s+more\s+time)\b/i,
  /\b(another|one\s+more)\b/i,
  /\bsimilar(ly)?\s+(to|for|but)\b/i,
  /\blike\s+(before|that|the\s+last)\b/i,
  
  // Continuation/modification
  /\bcontinue\s+(with|from|the)\b/i,
  /\bkeep\s+(going|the|it)\b/i,
  /\bgo\s+(on|ahead|further)\b/i,
];

/**
 * Patterns that indicate modification of previous output
 * Strong signal to use the same tool that created the output
 */
const MODIFICATION_PATTERNS: RegExp[] = [
  // Change/modify patterns
  /\b(change|modify|update|edit|fix|correct|adjust|tweak)\s+(it|this|that|the)\b/i,
  /\b(make|can\s+you\s+make)\s+(it|this|that|the)\s+(more|less|bigger|smaller|different|better)\b/i,
  /\b(change|modify|update)\s+(the|this|that)\s+(color|size|style|format|layout|text|title|label)\b/i,
  
  // Add/remove patterns
  /\b(add|include|insert|put)\s+(a|an|the|some|more)\b.*\b(to|into|in)\s+(it|this|that|the)\b/i,
  /\b(remove|delete|take\s+out|get\s+rid\s+of)\b.*\b(from|in)\s+(it|this|that|the)\b/i,
  
  // Improve/enhance patterns
  /\b(improve|enhance|polish|refine|clean\s+up)\s+(it|this|that|the)\b/i,
  /\b(make\s+it|can\s+you\s+make\s+it)\s+(look|work|perform)\s+(better|nicer|faster|prettier)\b/i,
];

/**
 * Patterns that reference previous output without being a direct follow-up
 */
const REFERENCE_PATTERNS: Record<string, RegExp[]> = {
  chart: [
    /\b(the|that|this)\s+(chart|graph|plot|visualization|figure)\b/i,
    /\b(in|on|from)\s+(the|that|this)\s+(chart|graph|plot)\b/i,
  ],
  code: [
    /\b(the|that|this)\s+(code|script|function|program)\b/i,
    /\b(in|from)\s+(the|that|this)\s+(code|output|result)\b/i,
  ],
  document: [
    /\b(the|that|this)\s+(document|file|pdf|report)\b/i,
    /\b(in|from)\s+(the|that|this)\s+(document|file|pdf)\b/i,
  ],
  ui_component: [
    /\b(the|that|this)\s+(component|dashboard|ui|interface|form)\b/i,
    /\b(in|on)\s+(the|that|this)\s+(dashboard|component|form)\b/i,
  ],
  search_result: [
    /\b(the|that|those)\s+(search\s+)?results?\b/i,
    /\b(from|in)\s+(the|that)\s+(search|web)\b/i,
  ],
};

/**
 * Map output types to likely tools
 */
const OUTPUT_TYPE_TO_TOOL: Record<string, Tool> = {
  chart: Tool.CODE_INTERPRETER,
  code: Tool.CODE_INTERPRETER,
  document: Tool.FILE_SEARCH,
  ui_component: Tool.ARTIFACTS,
  search_result: Tool.WEB_SEARCH,
};

// ============================================================================
// CONTEXT ANALYSIS FUNCTIONS
// ============================================================================

/**
 * Detect if query is a follow-up that should use the same tool
 */
function detectFollowupIntent(
  query: string,
  previousContext?: PreviousToolContext
): IntentSignal[] {
  const signals: IntentSignal[] = [];
  
  if (!previousContext?.lastUsedTools?.length) {
    return signals;
  }
  
  // Check for direct follow-up patterns
  for (const pattern of FOLLOWUP_PATTERNS) {
    if (pattern.test(query)) {
      for (const tool of previousContext.lastUsedTools) {
        signals.push({
          tool,
          source: 'context_followup',
          score: 0.8,
          reason: `Follow-up pattern detected: "${query.slice(0, 30)}..."`,
        });
      }
      break; // Only need one match
    }
  }
  
  // Check for modification patterns (even stronger signal)
  for (const pattern of MODIFICATION_PATTERNS) {
    if (pattern.test(query)) {
      for (const tool of previousContext.lastUsedTools) {
        signals.push({
          tool,
          source: 'context_followup',
          score: 0.9,
          reason: `Modification pattern detected: "${query.slice(0, 30)}..."`,
        });
      }
      break;
    }
  }
  
  return signals;
}

/**
 * Detect references to previous output
 */
function detectReferenceIntent(
  query: string,
  previousContext?: PreviousToolContext
): IntentSignal[] {
  const signals: IntentSignal[] = [];
  
  // Check for output type references
  for (const [outputType, patterns] of Object.entries(REFERENCE_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(query)) {
        const tool = OUTPUT_TYPE_TO_TOOL[outputType];
        if (tool) {
          // If previous context matches this output type, boost confidence
          const isFromPreviousContext = previousContext?.lastOutputType === outputType;
          signals.push({
            tool,
            source: 'context_reference',
            score: isFromPreviousContext ? 0.8 : 0.5,
            reason: `References ${outputType}: "${query.slice(0, 30)}..."`,
          });
        }
        break;
      }
    }
  }
  
  return signals;
}

// ============================================================================
// N-GRAM MATCHING FUNCTIONS
// ============================================================================

/**
 * Normalize text for n-gram matching
 */
function normalizeForNgram(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s']/g, ' ')  // Keep apostrophes for contractions
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Match query against n-gram phrases for each tool
 */
function matchNgramPhrases(query: string): IntentSignal[] {
  const signals: IntentSignal[] = [];
  const normalizedQuery = normalizeForNgram(query);
  
  for (const [tool, phrases] of Object.entries(NGRAM_PHRASES) as [Tool, string[]][]) {
    for (const phrase of phrases) {
      const normalizedPhrase = normalizeForNgram(phrase);
      if (normalizedQuery.includes(normalizedPhrase)) {
        signals.push({
          tool,
          source: 'ngram_match',
          score: 0.7, // N-gram matches are reliable
          reason: `Matched phrase: "${phrase}"`,
        });
        // Only count one match per tool to avoid over-weighting
        break;
      }
    }
  }
  
  return signals;
}

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
      // Image/static chart requests - these go to code executor (Python/matplotlib)
      /\b(image|static|inline|downloadable|save)\s*(chart|charts|graph|graphs|plot|plots|visualization|visualizations)\b/i,
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
      /\b(create|make|generate|build|produce|export)\b.*\b(excel|xlsx?|spreadsheet|csv|tsv)\b/i,
      // Sample/example data file patterns - always use code executor
      /\b(sample|example|dummy|test|mock)\b.*\b(csv|excel|xlsx?|spreadsheet|data\s*file)\b/i,
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
      // Dashboard requests - dashboards are always React/UI components
      /\bdashboard\b/i,
      // Interactive chart/visualization requests - these go to artifacts (React components)
      /\b(interactive|clickable|zoomable|dynamic)\s*(chart|charts|graph|graphs|visualization|visualizations)\b/i,
      // Explicit framework component creation
      /\b(create|build|make|generate|develop)\b.*\b(react|vue|angular|svelte)\b.*\b(component|app|application|page)\b/i,
      // Interactive element patterns (not charts - those need clarification)
      /\b(interactive|dynamic)\b.*\b(component|widget|dashboard|ui|interface|element)\b/i,
      // Render/display UI patterns
      /\b(render|display|show|present)\b.*\b(html|component|react|ui|interface|page|widget)\b/i,
      // Build UI patterns
      /\b(build|create|design|generate|make)\b.*\b(ui|user\s*interface|layout|mockup)\b/i,
      // Web component patterns
      /\b(web\s*component|custom\s*element|html\s*element)\b/i,
      // SVG/Canvas patterns
      /\b(svg|canvas)\b.*\b(draw|render|create|generate)\b/i,
      // Form/input patterns
      /\b(create|build|make)\b.*\b(form|input|button|modal|dialog|dropdown|menu|nav)\b/i,
      // Mermaid/diagram patterns - artifacts renders these (NOT charts)
      /\b(mermaid|flowchart|sequence\s*diagram|class\s*diagram|er\s*diagram|gantt)\b/i,
      // Create diagram patterns (flowcharts, architecture diagrams - not data charts)
      /\b(create|build|make|generate|draw)\b.*\b(diagram|flowchart)\b/i,
      // HTML page creation
      /\b(create|build|make|generate)\b.*\b(html|webpage|web\s*page)\b/i,
      // Explicit React chart library mentions - user wants React
      /\b(recharts|chart\.js|d3|nivo)\b.*\b(chart|graph|component)\b/i,
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
      // Generic interactive/widget mentions
      /\b(interactive|widget)\b/i,
      // Single framework mentions
      /\b(react|vue|angular|html|component)\b/i,
      // Visual/display keywords
      /\b(visual|display|render|show|present)\b/i,
      // Diagram keywords alone (not charts)
      /\b(diagram|flowchart)\b/i,
    ],
  },
  [Tool.WEB_SEARCH]: {
    high: [
      // Explicit web search requests
      /\b(search|look\s*up|find|google|bing)\b.*\b(on\s+the\s+)?(web|internet|online)\b/i,
      /\b(web|internet|online)\b.*\b(search|look\s*up|find|query)\b/i,
      
      // Current/live information patterns
      /\b(current|latest|recent|today|now|live|real.?time)\b.*\b(news|price|weather|events?|updates?|information|data|stock|market|score|results?)\b/i,
      
      // "Current" questions about people, positions, states - inherently time-sensitive
      /\b(who\s+is|who'?s)\b.*\b(current|the)\b.*\b(president|prime\s*minister|ceo|cfo|chairman|leader|mayor|governor|secretary|director)\b/i,
      /\b(current|acting|incumbent)\b.*\b(president|prime\s*minister|ceo|cfo|chairman|leader|mayor|governor|secretary|director)\b/i,
      /\b(who\s+(is|are)|what\s+is)\b.*\b(running|leading|winning|in\s+charge)\b/i,
      
      // Weather queries - inherently require real-time data
      /\b(weather|forecast|temperature|humidity|rain|snow|sunny|cloudy|storm)\b.*\b(in|at|for|near|around)?\s*[A-Z][a-z]+/i,
      /\b(what|how|check|get)\b.*\b(weather|forecast|temperature)\b/i,
      /\b(is\s+it|will\s+it)\b.*\b(rain|raining|snow|snowing|sunny|hot|cold|warm|cool|humid|windy)\b/i,
      /\b(how\s+)(hot|cold|warm|cool|humid|windy)\s+(is|are)\s+it\b/i,  // "How hot is it in Phoenix"
      /\b(weather|forecast)\s+(for|in|at|near)\b/i,  // "Weather forecast for New York"
      
      // Stock/crypto price queries - inherently real-time
      /\b(stock|share|crypto|bitcoin|ethereum|btc|eth|doge|solana|xrp)\s*(price|value|quote|ticker)?\b/i,
      /\b(price|value|quote)\s*(of|for)\b.*\b(stock|share|crypto|bitcoin|ethereum|btc|eth)\b/i,
      /\b(how\s+much\s+is|what\s+is\s+the\s+price)\b.*\b(stock|share|bitcoin|ethereum|crypto)\b/i,
      
      // Sports scores, results, standings - inherently real-time
      /\b(score|scores|result|results|standing|standings|fixture|fixtures)\b.*\b(of|for|from)?\b/i,
      /\b(latest|recent|current|live|final)\b.*\b(score|scores|result|results|game|match|standing)\b/i,
      /\b(get|show|tell|what)\b.*\b(score|scores|result|results)\b/i,
      /\b(who\s+won|who\s+is\s+winning|did\s+.+\s+win|final\s+score)\b/i,
      /\b(how\s+did|how\s+is|how\s+are)\b.*\b(play|playing|do|doing)\b.*\b(game|match|today|yesterday|last\s+night)\b/i,
      /\b(nfl|nba|mlb|nhl|premier\s*league|champions\s*league|world\s*cup|la\s*liga|bundesliga|serie\s*a|mls|ufc|f1|formula\s*1)\b/i,
      
      // Elections, politics, current events
      /\b(election|elections|poll|polls|vote|voting|ballot)\b.*\b(results?|winner|leading|update)\b/i,
      /\b(who\s+(is|are)\s+)?(winning|leading|ahead)\b.*\b(election|poll|race|primary)\b/i,
      
      // Time-sensitive queries
      /\b(what\s+is|who\s+is|when\s+is|where\s+is|how\s+is)\b.*\b(happening|going\s+on|today|now|currently)\b/i,
      
      // Real-time data patterns
      /\b(real.?time|live|up.?to.?the.?minute)\b.*\b(data|information|updates?|feed|stream)\b/i,
      
      // Explicit year/date patterns (current events)
      /\b(in\s+)?202[4-9]\b/i,  // Years 2024-2029 suggest current/recent events
      /\b(this\s+)?(week|month|year)\b.*\b(news|events?|release|launch|announce)\b/i,
      
      // Breaking news patterns
      /\b(breaking|latest|trending|viral|just\s+happened|just\s+announced)\b/i,
      
      // Current price/stock patterns
      /\b(current|today'?s?|live)\b.*\b(price|value|rate|stock|forex|crypto|bitcoin|ethereum)\b/i,
      
      // Product releases, updates, availability
      /\b(release\s*date|launch\s*date|available|availability|coming\s+out|released)\b.*\b(when|new|latest)\b/i,
      /\b(when\s+(is|does|will)|is\s+.+\s+out|has\s+.+\s+released)\b/i,
      
      // Company/business current info
      /\b(stock|share|market\s*cap|revenue|earnings|quarterly|annual\s*report)\b.*\b(today|current|latest|recent)\b/i,
      
      // Travel and logistics - often need current info
      /\b(flight|flights|train|bus)\b.*\b(status|delay|schedule|time|price|cost|book)\b/i,
      /\b(traffic|road\s*conditions?|highway|route)\b.*\b(now|current|today)\b/i,
      
      // Events and schedules
      /\b(when\s+is|schedule|scheduled|timing|time\s+of)\b.*\b(game|match|show|concert|event|meeting|conference|super\s*bowl|world\s*cup|olympics|finals?|playoff)\b/i,
      /\b(what\s*(?:is|'s)\s+(?:on|happening|playing))\b.*\b(tonight|today|this\s+weekend|now)\b/i,
      /\b(what\s+is)\b.*\b(happening|playing|on)\b.*\b(tonight|today|this\s+weekend|now)\b/i,
      /\b(when\s+is)\b.*\b(the\s+)?(super\s*bowl|world\s*cup|olympics|world\s*series|nba\s*finals?|stanley\s*cup|championship)\b/i,
      
      // Currency and exchange rates - inherently real-time
      /\b(exchange\s*rate|currency|forex)\b.*\b(current|today|now|live)\b/i,
      /\b(current|today'?s?|live)\b.*\b(exchange\s*rate|currency|forex)\b/i,
      /\b(convert|conversion)\b.*\b(usd|eur|gbp|jpy|dollars?|euros?|pounds?|yen|currency)\b/i,
      /\b(usd|eur|gbp|jpy|dollars?|euros?|pounds?|yen)\b.*\b(to|into|in)\b.*\b(usd|eur|gbp|jpy|dollars?|euros?|pounds?|yen)\b/i,
      /\b(how\s+much\s+is)\b.*\b(in|to)\b.*\b(usd|eur|gbp|jpy|dollars?|euros?|pounds?|yen)\b/i,
      /\b(exchange\s*rate)\b.*\b(usd|eur|gbp|jpy|dollars?|euros?|pounds?|yen)\b/i,
      
      // Temporal indicators - "yesterday", "last week", etc. suggest recent events
      /\b(yesterday|last\s+(week|month|night)|this\s+(morning|week|month))\b.*\b(announce|happen(ed)?|release|news|update)\b/i,
      /\b(announce|happen(ed)?|release|news|update)\b.*\b(yesterday|last\s+(week|month|night)|this\s+(morning|week|month))\b/i,
      /\b(what|who)\b.*\b(happen(ed)?|announce[d]?|release[d]?)\b.*\b(yesterday|last\s+(week|month)|this\s+(week|month))\b/i,
      /\b(recent|latest)\b.*\b(developments?|updates?|news|changes?)\b/i,
    ],
    medium: [
      // Generic search patterns
      /\b(search|look\s*up|find|query)\b.*\b(information|details|about|for)\b/i,
      // News/article mentions
      /\b(news|article|blog|website|post|publication)\b/i,
      // Market/price with time context
      /\b(stock|price|market|weather|forex|crypto)\b.*\b(today|current|now|latest)\b/i,
      // Weather-related terms without explicit location
      /\b(weather|forecast|temperature|humidity)\b/i,
      // Recent updates patterns
      /\b(what\s*'?s|what\s+is)\b.*\b(new|latest|happening)\b/i,
      // External source patterns
      /\b(find|get|fetch)\b.*\b(from|on)\b.*\b(the\s+)?(web|internet|online)\b/i,
      // URL/link patterns
      /\b(visit|check|open|go\s+to)\b.*\b(website|site|url|link|page)\b/i,
      // Social media patterns
      /\b(twitter|x\.com|facebook|reddit|linkedin|instagram|tiktok|youtube)\b/i,
      // Generic "latest" or "current" questions
      /\b(what|who|where|when|how)\b.*\b(current|latest|recent|now|today)\b/i,
      /\b(current|latest|recent)\b.*\b(what|who|where|when|how)\b/i,
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
  [Tool.YOUTUBE_VIDEO]: {
    high: [
      // YouTube URLs - very strong signal
      /\b(youtube\.com|youtu\.be)\/[\w\-]+/i,
      /\bhttps?:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)[\w\-]+/i,
      
      // Direct transcript requests
      /\b(get|fetch|extract|show)\b.*\b(transcript|subtitles?|captions?)\b.*\b(from|of)\b.*\b(youtube|video)\b/i,
      /\b(youtube|video)\b.*\b(transcript|subtitles?|captions?)\b/i,
      
      // Summarize video requests
      /\b(summarize|summary|overview)\b.*\b(this|the|that)\b.*\b(youtube|video)\b/i,
      /\b(youtube|video)\b.*\b(summary|summarize|overview)\b/i,
      
      // What does video say/cover
      /\bwhat\b.*\b(does|did)\b.*\b(video|youtube)\b.*\b(say|cover|discuss|explain|mention)\b/i,
    ],
    medium: [
      // Video content requests
      /\b(content|key\s*points?|main\s*points?|highlights?)\b.*\b(of|from|in)\b.*\b(video|youtube)\b/i,
      /\b(video|youtube)\b.*\b(content|key\s*points?|main\s*points?|highlights?)\b/i,
      
      // "this video" or "the video" with action
      /\b(explain|describe|tell\s*me\s*about)\b.*\b(this|the|that)\b.*\bvideo\b/i,
    ],
    low: [
      // Generic video/youtube keywords
      /\b(youtube|video|watch)\b/i,
      // Transcript keywords alone
      /\b(transcript|subtitles?|captions?)\b/i,
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
  [Tool.YOUTUBE_VIDEO]: [
    // Explicit YouTube tool requests
    /\b(use|enable|activate|with|using)\b.*\b(youtube\s*video|youtube\s*tool|video\s*transcript)\b/i,
    /\b(get|fetch|extract)\b.*\b(youtube|video)\b.*\b(transcript|content|info)\b/i,
    // YouTube URL patterns
    /\bhttps?:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)[\w\-]+/i,
    /\byoutube\.com\/watch\?v=/i,
    /\byoutu\.be\//i,
    // Video summarization requests
    /\b(summarize|analyze|explain)\b.*\b(this|the|that)\b.*\b(youtube|video)\b/i,
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
 * Patterns that indicate the query is referencing uploaded/attached documents
 * When these match AND files are attached, we should prefer FILE_SEARCH over WEB_SEARCH
 */
const DOCUMENT_REFERENCE_PATTERNS: RegExp[] = [
  /\b(in\s+the\s+)?(document|file|pdf|attachment|upload|paper|report|contract|agreement)\b/i,
  /\b(the|this|that|these|those|my|our)\s+(document|file|pdf|attachment|upload|paper|report)\b/i,
  /\b(uploaded|attached|provided|given|shared)\s+(document|file|pdf|data|information)\b/i,
  /\b(according\s+to|based\s+on|from|per)\s+(the\s+)?(document|file|pdf|attachment|report)\b/i,
  /\b(in\s+)?(this|that|the)\s+(pdf|doc|file|attachment)\b/i,
  /\bthe\s+(attached|uploaded|provided)\b/i,
];

/**
 * Check if query references uploaded/attached documents
 */
function queryReferencesDocuments(query: string): boolean {
  return DOCUMENT_REFERENCE_PATTERNS.some(pattern => pattern.test(query));
}

/**
 * Calculate intent score from query patterns
 * Uses tiered confidence: high (0.4), medium (0.25), low (0.1)
 * 
 * @param query - The user's query
 * @param tool - The tool to score for
 * @param hasAttachments - Whether the user has attached files
 * @param referencesDocuments - Whether the query references documents
 */
function scoreQueryIntent(query: string, tool: Tool, hasAttachments: boolean = false, referencesDocuments: boolean = false): number {
  const patterns = QUERY_PATTERNS[tool];
  if (!patterns) return 0;
  
  let score = 0;
  
  // If user has attachments AND references documents in query,
  // suppress web search scoring (they're likely asking about their files)
  if (tool === Tool.WEB_SEARCH && hasAttachments && referencesDocuments) {
    return 0;
  }
  
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
 * Convert regex scores to IntentSignals
 */
function getRegexSignals(query: string, tool: Tool, hasAttachments: boolean, referencesDocuments: boolean): IntentSignal[] {
  const patterns = QUERY_PATTERNS[tool];
  if (!patterns) return [];
  
  const signals: IntentSignal[] = [];
  
  // If user has attachments AND references documents in query,
  // suppress web search scoring (they're likely asking about their files)
  if (tool === Tool.WEB_SEARCH && hasAttachments && referencesDocuments) {
    return signals;
  }
  
  // High confidence patterns
  for (const pattern of patterns.high) {
    if (pattern.test(query)) {
      signals.push({
        tool,
        source: 'regex_high',
        score: 0.7,
        reason: `High-confidence pattern match`,
      });
      break; // One high match is enough
    }
  }
  
  // Medium confidence patterns
  for (const pattern of patterns.medium) {
    if (pattern.test(query)) {
      signals.push({
        tool,
        source: 'regex_medium',
        score: 0.5,
        reason: `Medium-confidence pattern match`,
      });
      break;
    }
  }
  
  // Low confidence patterns (fallback keywords)
  for (const pattern of patterns.low) {
    if (pattern.test(query)) {
      signals.push({
        tool,
        source: 'regex_low',
        score: 0.3,
        reason: `Low-confidence pattern match`,
      });
      break;
    }
  }
  
  return signals;
}

// ============================================================================
// WEIGHTED MULTI-SIGNAL SCORING
// ============================================================================

/**
 * Collect all signals from different sources
 */
function collectAllSignals(
  query: string,
  context: QueryContext,
  hasAttachments: boolean,
  referencesDocuments: boolean,
  attachmentTools: Tool[],
): IntentSignal[] {
  const signals: IntentSignal[] = [];
  const { 
    availableTools, 
    userSelectedTools = [],
    previousToolContext,
  } = context;
  
  // 1. User selected tools (highest priority)
  for (const tool of userSelectedTools) {
    if (availableTools.includes(tool)) {
      signals.push({
        tool,
        source: 'user_selected',
        score: 1.0,
        reason: 'Explicitly selected by user',
      });
    }
  }
  
  // 2. Explicit tool requests in query
  const explicitTools = detectExplicitToolRequests(query);
  for (const tool of explicitTools) {
    if (availableTools.includes(tool)) {
      signals.push({
        tool,
        source: 'explicit_request',
        score: 0.95,
        reason: 'Explicitly requested in query',
      });
    }
  }
  
  // 3. File type signals
  for (const tool of attachmentTools) {
    signals.push({
      tool,
      source: 'file_type',
      score: 0.9,
      reason: 'Required for attached file type',
    });
  }
  
  // 4. Conversation context - follow-ups
  const followupSignals = detectFollowupIntent(query, previousToolContext);
  for (const signal of followupSignals) {
    if (availableTools.includes(signal.tool)) {
      signals.push(signal);
    }
  }
  
  // 5. Conversation context - references
  const referenceSignals = detectReferenceIntent(query, previousToolContext);
  for (const signal of referenceSignals) {
    if (availableTools.includes(signal.tool)) {
      signals.push(signal);
    }
  }
  
  // 6. N-gram phrase matching
  const ngramSignals = matchNgramPhrases(query);
  for (const signal of ngramSignals) {
    if (availableTools.includes(signal.tool)) {
      signals.push(signal);
    }
  }
  
  // 7. Regex patterns for each available tool
  for (const tool of availableTools) {
    const regexSignals = getRegexSignals(query, tool, hasAttachments, referencesDocuments);
    signals.push(...regexSignals);
  }
  
  return signals;
}

/**
 * Calculate weighted score for each tool from all signals
 */
function calculateWeightedScores(signals: IntentSignal[]): Map<Tool, { score: number; reasons: string[] }> {
  const toolScores = new Map<Tool, { score: number; reasons: string[] }>();
  
  for (const signal of signals) {
    const current = toolScores.get(signal.tool) || { score: 0, reasons: [] };
    const weight = SIGNAL_WEIGHTS[signal.source];
    const weightedScore = signal.score * weight;
    
    // Add weighted score (with diminishing returns for multiple signals)
    // First signal of each type gets full weight, subsequent ones get reduced
    const existingCount = current.reasons.filter(r => r.startsWith(signal.source)).length;
    const diminishingFactor = 1 / (existingCount + 1);
    
    current.score += weightedScore * diminishingFactor;
    current.reasons.push(`${signal.source}: ${signal.reason || 'matched'} (+${(weightedScore * diminishingFactor).toFixed(2)})`);
    
    toolScores.set(signal.tool, current);
  }
  
  // Normalize scores to 0-1 range
  for (const [tool, data] of toolScores) {
    data.score = Math.min(data.score, 1);
    toolScores.set(tool, data);
  }
  
  return toolScores;
}

/**
 * Determine tools from attached files
 */
function getToolsFromAttachments(attachedFiles?: AttachedFileContext): Tool[] {
  if (!attachedFiles || !attachedFiles.uploadIntents?.length) {
    return [];
  }

  const tools: Tool[] = [];
  
  for (const intent of attachedFiles.uploadIntents) {
    switch (intent) {
      case UploadIntent.FILE_SEARCH:
        if (!tools.includes(Tool.FILE_SEARCH)) {
          tools.push(Tool.FILE_SEARCH);
        }
        break;
      case UploadIntent.CODE_INTERPRETER:
        if (!tools.includes(Tool.CODE_INTERPRETER)) {
          tools.push(Tool.CODE_INTERPRETER);
        }
        break;
      // Images don't map to a tool - they use vision built into the model
    }
  }

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
    'youtube_video': Tool.YOUTUBE_VIDEO,
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
    [Tool.YOUTUBE_VIDEO]: 'youtube_video',
  };
  return mapping[tool];
}

/**
 * Patterns that suggest visual/UI intent - passed to LLM for context
 */
const VISUAL_INTENT_PATTERNS = [
  /\b(visuali[zs]e|visual|show|display)\b/i,
  /\b(create|make|build|generate)\b.*\b(view|visual)\b/i,
  /\bhow\b.*\b(look|appear)\b/i,
  /\b(diagram|chart|graph)\b/i,
];

/**
 * Patterns that suggest charts/visualization - could use either artifacts OR code_interpreter
 */
const CHART_VISUALIZATION_PATTERNS = [
  /\b(chart|graph|plot|histogram|heatmap|scatter)\b/i,
  /\b(bar\s*chart|pie\s*chart|line\s*chart|line\s*graph|area\s*chart)\b/i,
  /\b(visuali[zs]e|visuali[zs]ation)\b/i,
  /\b(data|analyze|analysis)\b.*\b(visual|display|show|chart|graph)\b/i,
];

/**
 * Generate clarification prompt when REGEX selects multiple tools
 * This is for HIGH confidence cases where regex is certain but tools conflict
 * LOW confidence cases fall back to LLM which handles its own clarification
 * 
 * NOTE: We do NOT generate clarifications when tools are selected based on attached files.
 * File-based tool selection should be automatic - the system knows SQL/Excel needs code executor
 * and Word docs need file search, so it should just use all appropriate tools.
 */
function generateMultiToolClarification(
  query: string,
  selectedTools: Tool[],
  confidence: number,
  availableTools: Tool[],
  attachmentToolsCount: number = 0,
): { prompt: string; options: string[] } | null {
  // IMPORTANT: Never ask for clarification when tools were selected based on file attachments
  // The system should automatically use the right tools for the file types
  if (attachmentToolsCount > 0) {
    return null;
  }
  
  const hasCodeInterpreter = selectedTools.some(t => t === Tool.CODE_INTERPRETER);
  const hasArtifacts = selectedTools.some(t => t === Tool.ARTIFACTS);
  const artifactsAvailable = availableTools.includes(Tool.ARTIFACTS);
  
  // Check if query is about charts/visualization
  const isChartRelated = CHART_VISUALIZATION_PATTERNS.some(p => p.test(query));
  
  // Case 1: execute_code selected + chart/visualization requested + artifacts available
  // Ask user which approach they prefer for charts
  if (hasCodeInterpreter && isChartRelated && artifactsAvailable && !hasArtifacts) {
    return {
      prompt: "How would you like me to visualize this?",
      options: [
        "Interactive chart (clickable, zoomable, opens in side panel)",
        "Dashboard view (multiple charts and insights together)",
        "Image chart (appears inline, downloadable)",
      ],
    };
  }
  
  // Case 2: Both artifacts and execute_code already selected - ambiguous visualization
  if (hasArtifacts && hasCodeInterpreter && isChartRelated) {
    return {
      prompt: "How would you like me to visualize this?",
      options: [
        "Interactive chart (clickable, zoomable, opens in side panel)",
        "Dashboard view (multiple charts and insights together)",
        "Image chart (appears inline, downloadable)",
      ],
    };
  }

  // Only generate generic clarification for multiple tools with high confidence
  if (selectedTools.length < 2 || confidence < 0.4) {
    return null;
  }

  // Generic multi-tool clarification
  const toolNames = selectedTools.map(t => {
    switch (t) {
      case Tool.ARTIFACTS: return 'UI component';
      case Tool.CODE_INTERPRETER: return 'Python code';
      case Tool.WEB_SEARCH: return 'web search';
      case Tool.FILE_SEARCH: return 'document search';
      default: return t;
    }
  });

  return {
    prompt: `I can help with this using multiple approaches. Which would you prefer?`,
    options: toolNames.map(name => `Use ${name}`).concat(['Use all of them']),
  };
}

/**
 * Analyze query to determine which tools to use
 * 
 * Uses weighted multi-signal scoring combining:
 * 1. User explicitly selected tools (weight: 1.0)
 * 2. Explicit tool requests in query (weight: 0.95)
 * 3. File type requirements (weight: 0.9)
 * 4. Conversation context - follow-ups (weight: 0.85)
 * 5. Conversation context - references (weight: 0.75)
 * 6. N-gram phrase matching (weight: 0.6)
 * 7. Regex patterns - high/medium/low confidence
 * 
 * Tools are selected if their weighted score exceeds the threshold
 */
export function analyzeQueryIntent(context: QueryContext): QueryIntentResult {
  const { 
    query, 
    attachedFiles, 
    availableTools,
    autoEnabledTools = [],
    userSelectedTools = [],
  } = context;
  
  const selectedTools: Tool[] = [];
  const reasoning: string[] = [];
  const debugMode = typeof process !== 'undefined' && process.env?.DEBUG_INTENT_ANALYZER === 'true';

  // Get attachment tools first (needed for signal collection)
  const attachmentTools = getToolsFromAttachments(attachedFiles);
  const hasAttachments = attachmentTools.length > 0;
  const referencesDocuments = queryReferencesDocuments(query);

  // Collect all signals from different sources
  const allSignals = collectAllSignals(
    query,
    context,
    hasAttachments,
    referencesDocuments,
    attachmentTools,
  );

  // Debug: Log all collected signals
  if (debugMode) {
    console.log(`[IntentAnalyzer] Query: "${query.slice(0, 80)}${query.length > 80 ? '...' : ''}"`);
    console.log(`[IntentAnalyzer] Signals collected: ${allSignals.length}`);
    for (const signal of allSignals) {
      console.log(`  - ${signal.tool}: ${signal.source} (score: ${signal.score.toFixed(2)}) - ${signal.reason || 'matched'}`);
    }
  }

  // Calculate weighted scores for each tool
  const weightedScores = calculateWeightedScores(allSignals);

  // Debug: Log weighted scores
  if (debugMode) {
    console.log(`[IntentAnalyzer] Weighted scores:`);
    for (const [tool, data] of weightedScores) {
      console.log(`  - ${tool}: ${data.score.toFixed(2)}`);
    }
  }

  // Step 1: Add user explicitly selected tools (always included regardless of score)
  for (const tool of userSelectedTools) {
    if (availableTools.includes(tool) && !selectedTools.includes(tool)) {
      selectedTools.push(tool);
      reasoning.push(`${toolToCapability(tool)} explicitly selected by user`);
    }
  }

  // Step 2: Add tools from attachments (always included regardless of score)
  for (const tool of attachmentTools) {
    if (availableTools.includes(tool) && !selectedTools.includes(tool)) {
      selectedTools.push(tool);
      reasoning.push(`${toolToCapability(tool)} needed for attached files`);
    }
  }

  // Step 3: Process auto-enabled tools with weighted scoring
  // Lower threshold for auto-enabled tools
  for (const tool of autoEnabledTools) {
    if (!selectedTools.includes(tool) && availableTools.includes(tool)) {
      const toolData = weightedScores.get(tool);
      const score = toolData?.score ?? 0;
      
      // Auto-enabled tools need lower threshold (0.3 instead of 0.5)
      if (score >= CONFIDENCE_THRESHOLDS.LOW) {
        selectedTools.push(tool);
        reasoning.push(`${toolToCapability(tool)} auto-enabled (score: ${score.toFixed(2)})`);
      }
    }
  }

  // Step 4: Add non-auto-enabled tools that exceed threshold
  const sortedTools = [...weightedScores.entries()]
    .sort((a, b) => b[1].score - a[1].score)
    .filter(([tool]) => 
      !selectedTools.includes(tool) && 
      !autoEnabledTools.includes(tool) &&
      availableTools.includes(tool)
    );

  for (const [tool, data] of sortedTools) {
    // Non-auto-enabled tools need higher threshold
    if (data.score >= CONFIDENCE_THRESHOLDS.MEDIUM) {
      selectedTools.push(tool);
      reasoning.push(`${toolToCapability(tool)} matched (score: ${data.score.toFixed(2)})`);
    }
  }

  // Calculate overall confidence from the best signal
  const userSelectedConfidence = userSelectedTools.length > 0 ? 1.0 : 0;
  const attachmentConfidence = attachmentTools.length > 0 ? 0.9 : 0;
  const bestWeightedScore = selectedTools.length > 0 
    ? Math.max(...selectedTools.map(t => weightedScores.get(t)?.score ?? 0))
    : 0;
  const confidence = Math.max(userSelectedConfidence, attachmentConfidence, bestWeightedScore, 0.3);

  // Step 5: Check if clarification is needed
  const multiToolClarification = generateMultiToolClarification(
    query, 
    selectedTools, 
    confidence, 
    availableTools,
    attachmentTools.length
  );

  // Build detailed reasoning with signal breakdown
  const detailedReasoning = reasoning.length > 0 
    ? reasoning.join('; ') 
    : 'No specific tool intent detected';

  // Debug: Log final decision
  if (debugMode) {
    console.log(`[IntentAnalyzer] Final decision:`);
    console.log(`  - Selected tools: [${selectedTools.join(', ') || 'none'}]`);
    console.log(`  - Confidence: ${confidence.toFixed(2)}`);
    console.log(`  - Reasoning: ${detailedReasoning}`);
  }

  return {
    tools: selectedTools,
    confidence,
    reasoning: detailedReasoning,
    ...(multiToolClarification && {
      clarificationPrompt: multiToolClarification.prompt,
      clarificationOptions: multiToolClarification.options,
    }),
  };
}

/**
 * Quick check if a specific tool should be enabled
 */
export function shouldUseTool(tool: Tool, context: QueryContext): boolean {
  const result = analyzeQueryIntent(context);
  return result.tools.includes(tool);
}
