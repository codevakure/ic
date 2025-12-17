/**
 * Model Routing Module
 * 
 * Determines which model tier to use based on query complexity.
 * Ported from @librechat/llm-router for unified interface.
 * 
 * 3-TIER MAPPING (score ranges):
 * - 0.70-1.00: complex/expert - ONLY explicit deep analysis requests (Sonnet 4.5)
 * - 0.10-0.70: moderate - DEFAULT for 90%+ of tasks (Haiku 4.5)
 * - 0.00-0.10: simple   - Basic Q&A, greetings (Nova Micro)
 * 
 * CONSERVATIVE ROUTING: Sonnet 4.5 is ONLY used when user explicitly requests
 * comprehensive/detailed/in-depth analysis, research, or debugging.
 * Everything else stays on Haiku 4.5.
 * 
 * Note: Nova Micro is only for titleModel/classifierModel, NOT for routing
 */

import type { ModelTier, ModelRoutingResult } from './types';

// ============================================================================
// Pattern Definitions (from llm-router)
// ============================================================================

const CODE_PATTERNS: RegExp[] = [
  /```[\s\S]*?```/, // Code blocks
  /`[^`]+`/, // Inline code
  /\b(function|class|const|let|var|def|import|export|return|if|else|for|while)\b/,
  /\b(async|await|promise|callback|try|catch|throw)\b/i,
  /[{}\[\]();].*[{}\[\]();]/, // Multiple code-like punctuation
  /\b(error|exception|bug|debug|fix|issue|crash|undefined|null)\b/i,
  /\b(npm|pip|yarn|git|docker|kubernetes|api|sdk|rest|graphql)\b/i,
  /\.(js|ts|py|java|cpp|go|rs|rb|php|swift|kt)\b/i,
  /\b(console\.log|print|printf|console\.error)\b/,
  /=>|->|\|\||&&|===|!==/, // Arrow functions, operators
  /\b(implement|code|program|script|algorithm|refactor)\b/i,
  /\b(python|javascript|typescript|java|c\+\+|golang|rust|ruby)\b/i,
  /\b(write|create|build|develop)\b.*\b(code|function|class|app|application|program|component)\b/i,
  /\b(react|vue|angular|svelte|nextjs|node|express)\b/i,
  /\b(useState|useEffect|useRef|useCallback|useMemo|useContext)\b/,
  /\b(component|props|state|render|jsx|tsx)\b/i,
];

// REASONING_PATTERNS - These boost score but DON'T trigger Sonnet alone
// They're used for moderate tier, not to escalate to complex/expert
const REASONING_PATTERNS: RegExp[] = [
  /\b(explain|compare|evaluate)\b/i,
  /\b(why|how does)\b/i,
  /\b(pros and cons|trade-?offs?)\b/i,
  /\b(step by step)\b/i,
  /\b(difference between)\b/i,
];

const EXPERT_PATTERNS: RegExp[] = [
  // ONLY explicit requests for comprehensive/detailed/in-depth work
  // Must have both the qualifier AND the task type together
  
  // Explicit comprehensive/thorough research or analysis requests
  /\b(comprehensive|thorough|exhaustive|in-?depth)\s+(research|analysis|review|study|report|investigation)\b/i,
  /\b(research|analyze|review|investigate)\s+(comprehensively|thoroughly|exhaustively|in-?depth)\b/i,
  
  // Explicit deep dive requests
  /\bdeep\s*(dive|analysis|research|investigation)\b/i,
  /\bdig\s*(deep|deeper)\s*(into)?\b/i,
  
  // Explicit detailed analysis (not just "detailed" alone)
  /\b(detailed|complete|full)\s+(analysis|breakdown|examination|assessment|investigation)\b/i,
  
  // Explicit debugging requests with context
  /\b(debug|troubleshoot|diagnose)\s+(this|the|my)\s+(code|error|issue|problem|bug)\b/i,
  /\b(fix|solve|resolve)\s+(this|the|my)\s+(bug|error|issue|crash)\b/i,
  
  // Explicit architecture/design work
  /\b(design|architect)\s+(a|the|an)\s+(system|architecture|solution)\b/i,
  /\bsystem\s+architecture\b/i,
];

const MATH_PATTERNS: RegExp[] = [
  /\b(calculate|compute|solve|equation|formula|expression)\b/i,
  /[+\-*/^=<>≤≥∑∏∫∂∇]/,
  /\b(derivative|integral|probability|statistics|algorithm)\b/i,
  /\$[^$]+\$/,
  /\$\$[\s\S]+?\$\$/,
  /\b(matrix|vector|scalar|tensor|eigenvalue)\b/i,
  /\b(proof|theorem|lemma|corollary)\b/i,
  /\b(\d+\.?\d*)\s*[×x*]\s*(\d+\.?\d*)/,
  /\b(percent|percentage|ratio|proportion|fraction)\b/i,
];

const CREATIVE_PATTERNS: RegExp[] = [
  /\b(write|create|generate|compose|draft|craft|build|make|design)\b/i,
  /\b(story|poem|essay|article|blog|script|novel|narrative)\b/i,
  /\b(creative|imaginative|original|unique|innovative)\b/i,
  /\b(tone|style|voice|mood|atmosphere)\b/i,
  /\b(character|plot|setting|dialogue|scene)\b/i,
  /\b(metaphor|simile|imagery|symbolism)\b/i,
];

const UI_GENERATION_PATTERNS: RegExp[] = [
  /\b(dashboard|ui|interface|component|widget|page|app|application)\b/i,
  /\b(react|vue|angular|svelte|html|css|frontend|front-?end)\b/i,
  /\b(chart|graph|visualization|table|grid|layout|form)\b/i,
  /\b(button|input|modal|dropdown|menu|navbar|sidebar|card)\b/i,
  /\b(artifact|interactive|render|display|show)\b/i,
];

const SIMPLE_PATTERNS: RegExp[] = [
  /^(hi|hello|hey|thanks|thank you|ok|okay|yes|no|sure|got it|bye|goodbye)\s*[.!?]?\s*$/i,
  /^(what is|define|meaning of|what's)\s+\w+\s*\??$/i,
  /^(how are you|what's up|how's it going)\s*\??$/i,
  /^(tell me a joke|say something funny)\s*$/i,
  /^(good morning|good evening|good night)\s*[.!]?\s*$/i,
];

const TECHNICAL_DOMAIN_PATTERNS: RegExp[] = [
  /\b(API|SDK|REST|GraphQL|OAuth|JWT|WebSocket|HTTP)\b/i,
  /\b(Kubernetes|Docker|AWS|Azure|GCP|Terraform|Ansible)\b/i,
  /\b(neural|transformer|embedding|vector|tensor|gradient)\b/i,
  /\b(quantum|molecular|genomic|clinical|pharmaceutical)\b/i,
  /\b(microservices?|serverless|cloud-?native|devops|cicd)\b/i,
  /\b(blockchain|cryptocurrency|smart contract|defi|nft)\b/i,
  /\b(machine learning|deep learning|nlp|computer vision|llm)\b/i,
];

// LOW COMPLEXITY PATTERNS - Simple tool-based tasks that should stay on Haiku 4.5
// These tasks are straightforward tool calls, NOT complex analysis
const LOW_COMPLEXITY_TOOL_PATTERNS: RegExp[] = [
  // Email/Calendar - Simple tool calls
  /\b(email|emails|mail|mails|inbox)\b.*\b(summary|summaries|summarize|unread|recent|latest|new)\b/i,
  /\b(summarize|summary|summaries)\b.*\b(email|emails|mail|mails|inbox)\b/i,
  /\b(check|get|show|list|read|fetch)\b.*\b(email|emails|mail|mails|inbox|messages?)\b/i,
  /\b(calendar|schedule|meeting|meetings|appointment|appointments)\b/i,
  /\b(send|reply|forward)\b.*\b(email|mail|message)\b/i,
  
  // Weather - Simple API call
  /\b(weather|forecast|temperature|rain|sunny|cloudy)\b/i,
  
  // News/Information lookup - Simple retrieval
  /\b(news|headlines|latest)\b.*\b(about|on|for|today)\b/i,
  /\b(what('s| is) happening|what's new)\b/i,
  
  // File operations - Simple tool calls
  /\b(list|show|get|find)\b.*\b(files?|documents?|folders?)\b/i,
  /\b(search|look for|find)\b.*\b(in|on)\b.*\b(sharepoint|onedrive|drive|teams)\b/i,
  
  // Simple lookups and queries
  /\b(look up|lookup|search for|find)\b.*\b(information|info|details?)\b/i,
  /\b(what|when|where|who)\b.*\b(is|are|was|were)\b/i,
  
  // Time/Date queries
  /\b(what time|current time|date today|today's date)\b/i,
  
  // Simple data retrieval
  /\b(get|fetch|retrieve|pull)\b.*\b(data|info|information|details?|status)\b/i,
];

const MULTI_STEP_PATTERNS: RegExp[] = [
  /\b(first|then|next|after that|finally|step \d+)\b/i,
  /\b(also|additionally|furthermore|moreover)\b/i,
  /\d+\.\s+.*\n\d+\.\s+/,
  /[-*]\s+.*\n[-*]\s+/,
  /\band\b.*\band\b.*\band\b/i,
];

const EXPERT_COMPLEXITY_PATTERNS: RegExp[] = [
  /\b(architect|design system|scalab|distributed|microservices?)\b/i,
  /\b(algorithm|complexity|big-?o|optimization|performance)\b/i,
  /\b(security|authentication|authorization|encryption|vulnerability)\b/i,
  /\b(machine learning|neural|training|model|inference)\b/i,
  /\b(concurrent|parallel|async|threading|race condition)\b/i,
  /\b(database design|schema|migration|query optimization)\b/i,
  /\b(refactor|redesign|rewrite|overhaul)\b.*\b(entire|whole|complete|full)\b/i,
  /\b(implement|build|create)\b.*\b(from scratch|complete|full)\b/i,
];

// ============================================================================
// Helper Functions
// ============================================================================

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function countPatternMatches(text: string, patterns: RegExp[]): number {
  return patterns.filter(p => p.test(text)).length;
}

function getPatternScore(text: string, patterns: RegExp[], weight: number): number {
  const matchCount = countPatternMatches(text, patterns);
  if (matchCount === 0) return 0;
  const normalizedMatches = Math.min(matchCount / patterns.length, 1);
  return weight * (0.5 + normalizedMatches * 0.5);
}

function isSimpleQuery(text: string): boolean {
  return SIMPLE_PATTERNS.some(p => p.test(text.trim()));
}

function getLengthAdjustment(tokenCount: number): number {
  if (tokenCount > 1000) return 0.15;
  if (tokenCount > 500) return 0.1;
  if (tokenCount > 200) return 0.05;
  if (tokenCount < 20) return -0.1;
  if (tokenCount < 50) return -0.05;
  return 0;
}

function hasTechnicalTerms(text: string): boolean {
  return TECHNICAL_DOMAIN_PATTERNS.some(p => p.test(text));
}

function hasMultiStep(text: string): boolean {
  return MULTI_STEP_PATTERNS.some(p => p.test(text));
}

function hasExpertComplexity(text: string, tokenCount: number): boolean {
  const matchCount = EXPERT_COMPLEXITY_PATTERNS.filter(p => p.test(text)).length;
  return matchCount >= 2 || (matchCount >= 1 && tokenCount > 100 && hasTechnicalTerms(text));
}

/**
 * Check if query is a simple tool-based task that should stay on Haiku 4.5
 * These are straightforward tool calls like email summaries, calendar checks, etc.
 */
function isLowComplexityToolTask(text: string): boolean {
  return LOW_COMPLEXITY_TOOL_PATTERNS.some(p => p.test(text));
}

/**
 * Check if query EXPLICITLY requests deep/comprehensive analysis (Sonnet 4.5 trigger)
 * This is the ONLY way to get to Sonnet 4.5 - user must explicitly ask
 */
function isExplicitExpertRequest(text: string): boolean {
  return EXPERT_PATTERNS.some(p => p.test(text));
}

/**
 * Convert score to tier - 3-tier system (CONSERVATIVE)
 * 
 * Target distribution: Simple ~1%, Moderate ~90%, Complex/Expert ~9%
 * 
 * CONSERVATIVE: Sonnet 4.5 ONLY for explicit expert requests
 * - 0.70+ → Complex/Expert (Sonnet 4.5) - ONLY explicit deep analysis/debugging
 * - 0.10+ → Moderate (Haiku 4.5) - DEFAULT for 90%+ of tasks
 * - 0.00+ → Simple (Nova Micro) - Greetings only
 */
function scoreToTier(score: number): ModelTier {
  if (score >= 0.70) return 'complex';  // ~9% - ONLY explicit expert requests
  if (score >= 0.10) return 'moderate'; // ~90% - DEFAULT for most tasks
  return 'simple';                       // ~1% - greetings only
}

/**
 * Convert score to tier (exported alias)
 */
export function getTierFromScore(score: number): ModelTier {
  return scoreToTier(score);
}

function getRoutingReason(score: number, query: string): string {
  // Check explicit expert request first
  if (isExplicitExpertRequest(query)) {
    return 'Explicit request for comprehensive/detailed analysis';
  }
  if (isSimpleQuery(query)) {
    return 'Simple greeting or acknowledgment';
  }
  // Everything else is moderate tier
  if (countPatternMatches(query, CODE_PATTERNS) > 0) {
    return 'Code-related query (Haiku 4.5)';
  }
  if (isLowComplexityToolTask(query)) {
    return 'Tool-based task (Haiku 4.5)';
  }
  return 'Standard query (Haiku 4.5 default)';
}

// ============================================================================
// Main Scoring Function
// ============================================================================

/**
 * Calculate complexity score for model routing.
 * Returns a score from 0-1 that maps to model tiers.
 * 
 * CONSERVATIVE APPROACH:
 * - Default to moderate tier (Haiku 4.5) for 90%+ of queries
 * - Only reach complex tier (Sonnet 4.5) for EXPLICIT expert requests
 * - Simple tier (Nova Micro) only for greetings
 */
function calculateComplexityScore(query: string): number {
  const tokenCount = estimateTokens(query);

  // TRIVIAL: Simple greetings → Nova Micro (simple tier)
  if (isSimpleQuery(query)) {
    return Math.max(0, Math.min(0.09, 0.05)); // Always simple tier
  }

  // EXPLICIT EXPERT REQUEST: User explicitly asks for comprehensive/detailed analysis
  // This is the ONLY way to get to Sonnet 4.5
  if (isExplicitExpertRequest(query)) {
    return 0.75; // Complex tier → Sonnet 4.5
  }

  // EVERYTHING ELSE: Default to moderate tier (Haiku 4.5)
  // This includes:
  // - Code questions (write code, explain code, etc.)
  // - Tool tasks (email, calendar, weather, search)
  // - Creative tasks (write an email, draft a message)
  // - General Q&A
  // - Reasoning/explanation tasks
  // - Math questions
  // - UI generation
  
  let score = 0.35; // Base moderate score

  // Small adjustments based on complexity indicators (but NEVER exceed 0.65)
  const codeScore = getPatternScore(query, CODE_PATTERNS, 0.10);
  const reasoningScore = getPatternScore(query, REASONING_PATTERNS, 0.05);
  const mathScore = getPatternScore(query, MATH_PATTERNS, 0.05);
  
  score += codeScore + reasoningScore + mathScore;
  
  // Length adjustment (longer queries slightly higher, but still moderate)
  score += getLengthAdjustment(tokenCount) * 0.5; // Reduce length impact

  // CAP at 0.65 - NEVER reach complex tier without explicit expert request
  return Math.max(0.15, Math.min(0.65, score));
}

/**
 * Analyze query and return model routing result
 * This is the MAIN entry point for model routing
 */
export function scoreQueryComplexity(query: string): ModelRoutingResult {
  const complexityScore = calculateComplexityScore(query);
  const tier = scoreToTier(complexityScore);
  const reasoning = getRoutingReason(complexityScore, query);
  
  // Detect categories based on patterns
  const categories: string[] = [];
  if (countPatternMatches(query, CODE_PATTERNS) > 0) categories.push('code');
  if (countPatternMatches(query, REASONING_PATTERNS) > 0) categories.push('reasoning');
  if (countPatternMatches(query, MATH_PATTERNS) > 0) categories.push('math');
  if (countPatternMatches(query, CREATIVE_PATTERNS) > 0) categories.push('creative');
  if (countPatternMatches(query, UI_GENERATION_PATTERNS) > 0) categories.push('ui_generation');
  if (countPatternMatches(query, EXPERT_PATTERNS) > 0) categories.push('expert');
  if (categories.length === 0) categories.push('general');

  return {
    tier,
    score: complexityScore,
    categories,
    reasoning,
  };
}

// Re-export for convenience
export { scoreToTier as getTierFromScoreInternal, getRoutingReason };
