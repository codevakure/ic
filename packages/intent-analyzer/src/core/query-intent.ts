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
      // Build UI patterns - includes generate for dashboard creation
      /\b(build|create|design|generate|make)\b.*\b(ui|user\s*interface|dashboard|layout|mockup)\b/i,
      // Web component patterns
      /\b(web\s*component|custom\s*element|html\s*element)\b/i,
      // SVG/Canvas patterns
      /\b(svg|canvas)\b.*\b(draw|render|create|generate)\b/i,
      // Form/input patterns
      /\b(create|build|make)\b.*\b(form|input|button|modal|dialog|dropdown|menu|nav)\b/i,
      // Mermaid/diagram patterns - artifacts renders these
      /\b(mermaid|flowchart|sequence\s*diagram|class\s*diagram|er\s*diagram|gantt)\b/i,
      // Create diagram/chart patterns
      /\b(create|build|make|generate|draw)\b.*\b(diagram|flowchart|chart|graph|visualization)\b/i,
      // HTML page creation
      /\b(create|build|make|generate)\b.*\b(html|webpage|web\s*page)\b/i,
    ],
    medium: [
      // Generic component/UI creation - includes dashboard
      /\b(create|build|make|generate)\b.*\b(component|ui|interface|widget|element|view|dashboard)\b/i,
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
      // Visualize patterns
      /\b(visualize|visualise)\b.*\b(this|it|data|the)\b/i,
      /\bhow\b.*\b(look|visuali[zs]e)\b/i,
    ],
    low: [
      // Generic interactive/dashboard mentions
      /\b(interactive|dashboard|widget)\b/i,
      // Single framework mentions
      /\b(react|vue|angular|html|component)\b/i,
      // Visual/display keywords
      /\b(visual|display|render|show|present)\b/i,
      // Diagram keywords alone
      /\b(diagram|flowchart|visualization)\b/i,
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
 * Patterns that suggest visual/UI intent - passed to LLM for context
 */
const VISUAL_INTENT_PATTERNS = [
  /\b(visuali[zs]e|visual|show|display)\b/i,
  /\b(create|make|build|generate)\b.*\b(view|visual)\b/i,
  /\bhow\b.*\b(look|appear)\b/i,
  /\b(diagram|chart|graph)\b/i,
];

/**
 * Patterns that suggest both artifacts and code_interpreter could work
 */
const MULTI_TOOL_AMBIGUOUS_PATTERNS = [
  /\b(chart|graph|plot|visuali[zs]ation)\b/i, // Could be React chart or matplotlib
  /\b(data|analyze|analysis)\b.*\b(visual|display|show)\b/i, // Could need code analysis + UI
];

/**
 * Generate clarification prompt when REGEX selects multiple tools
 * This is for HIGH confidence cases where regex is certain but tools conflict
 * LOW confidence cases fall back to LLM which handles its own clarification
 */
function generateMultiToolClarification(
  query: string,
  selectedTools: Tool[],
  confidence: number,
): { prompt: string; options: string[] } | null {
  // Only generate clarification if:
  // 1. Multiple tools selected by regex
  // 2. Confidence is reasonably high (>= 0.4) - otherwise LLM will handle it
  if (selectedTools.length < 2 || confidence < 0.4) {
    return null;
  }

  const lowerQuery = query.toLowerCase();
  const hasArtifacts = selectedTools.some(t => t === Tool.ARTIFACTS);
  const hasCodeInterpreter = selectedTools.some(t => t === Tool.CODE_INTERPRETER);
  
  // Case: Both artifacts and execute_code selected - ambiguous visualization
  if (hasArtifacts && hasCodeInterpreter) {
    const isChartRelated = MULTI_TOOL_AMBIGUOUS_PATTERNS.some(p => p.test(lowerQuery));
    if (isChartRelated) {
      return {
        prompt: "I can create this visualization in different ways. Which would you prefer?",
        options: [
          "Interactive React component (web-based, shareable)",
          "Python chart (matplotlib/seaborn, for data analysis)",
          "Both: Analyze with Python, then create interactive UI",
        ],
      };
    }
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
  // Check if query references documents (affects web search scoring when files are attached)
  const hasAttachments = attachmentTools.length > 0;
  const referencesDocuments = queryReferencesDocuments(query);
  
  if (hasAttachments && referencesDocuments) {
    console.log(`[IntentAnalyzer:Query] Query references documents with files attached - suppressing web search`);
  }
  
  console.log(`[IntentAnalyzer:Query] --- Keyword Pattern Matching ---`);
  const queryScores = new Map<Tool, number>();
  for (const tool of availableTools) {
    const score = scoreQueryIntent(query, tool, hasAttachments, referencesDocuments);
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

  // Calculate overall confidence based on the best signal
  const userSelectedConfidence = userSelectedTools.length > 0 ? 1.0 : 0;
  const attachmentConfidence = attachmentTools.length > 0 ? 0.9 : 0;
  // Get the highest query score from any SELECTED tool (not just the sortedByScore filtered list)
  const selectedToolScores = selectedTools.map(t => queryScores.get(t) ?? 0);
  const bestSelectedScore = selectedToolScores.length > 0 ? Math.max(...selectedToolScores) : 0;
  const confidence = Math.max(userSelectedConfidence, attachmentConfidence, bestSelectedScore, 0.3);

  console.log(`[IntentAnalyzer:Query] --- FINAL RESULT ---`);
  console.log(`[IntentAnalyzer:Query] Selected tools: [${selectedTools.map(t => toolToCapability(t)).join(', ')}]`);
  console.log(`[IntentAnalyzer:Query] Confidence: ${confidence.toFixed(2)}`);
  console.log(`[IntentAnalyzer:Query] Context prompts added: ${contextPrompts.length}`);
  if (contextPrompts.length > 0) {
    contextPrompts.forEach((p, i) => console.log(`[IntentAnalyzer:Query] Prompt ${i + 1}: "${p.substring(0, 80)}..."`));
  }
  console.log(`[IntentAnalyzer:Query] Reasoning: ${reasoning.join('; ') || 'No specific tool intent detected'}`);

  // Step 7: Check if regex selected multiple tools - ask for clarification
  // This is for HIGH confidence cases. LOW confidence will fall back to LLM.
  const multiToolClarification = generateMultiToolClarification(query, selectedTools, confidence);
  if (multiToolClarification) {
    console.log(`[IntentAnalyzer:Query] Multi-tool clarification: "${multiToolClarification.prompt}"`);
  }

  console.log(`[IntentAnalyzer:Query] ========== TOOL SELECTION END ==========`);

  // Return result with optional clarification
  // - If confidence >= 0.4 and multiple tools: regex handles clarification
  // - If confidence < 0.4: LLM fallback will be triggered and LLM handles clarification
  return {
    tools: selectedTools,
    confidence,
    contextPrompts,
    reasoning: reasoning.join('; ') || 'No specific tool intent detected',
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
