/**
 * Model Routing Module
 * 
 * Determines which model tier to use based on query complexity.
 * Ported from @ranger/llm-router for unified interface.
 * 
 * 4-TIER MAPPING (score ranges):
 * - 0.80-1.00: expert   - System architecture, PhD-level research (Opus 4.5)
 * - 0.60-0.80: complex  - Debugging, code review, detailed analysis (Sonnet 4.5)
 * - 0.35-0.60: moderate - Explanations, standard code generation (Haiku 4.5)
 * - 0.00-0.35: simple   - Basic Q&A, greetings, simple tools (Nova Pro)
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

const REASONING_PATTERNS: RegExp[] = [
  /\b(explain|analyze|compare|evaluate|assess|examine|investigate)\b/i,
  /\b(why|how does|what if|suppose|consider|imagine)\b/i,
  /\b(pros and cons|trade-?offs?|advantages?|disadvantages?|benefits?|drawbacks?)\b/i,
  /\b(step by step|break down|walk through|elaborate|detail)\b/i,
  /\b(reasoning|logic|argument|evidence|justify|rationale)\b/i,
  /\b(implications?|consequences?|impact|effect|result)\b/i,
  /\b(difference between|similarities?|contrast|versus|vs\.?)\b/i,
  /\b(complex|complicated|intricate|sophisticated)\b/i,
  /\b(architecture|design|system|framework)\b/i,
  /\b(fix|solve|resolve|diagnose|troubleshoot|debug)\b/i,
  /\b(race condition|deadlock|memory leak|bottleneck)\b/i,
];

const EXPERT_PATTERNS: RegExp[] = [
  /\b(comprehensive|thorough|in-?depth|exhaustive|detailed)\b.*\b(research|analysis|review|study|report)\b/i,
  /\b(research|investigate|explore)\b.*\b(comprehensive|thorough|all|every)\b/i,
  /\bcomprehensive\b/i,
  /\bthorough(ly)?\b/i,
  /\bin-?depth\b/i,
  /\bexhaustive\b/i,
  /\b(rag|retrieval|knowledge base|document)\b.*\b(search|query|analysis)\b/i,
  /\b(multi-?step|complex)\b.*\b(reasoning|analysis|research)\b/i,
  /\b(critical|deep)\b.*\b(analysis|thinking|review|dive|look)\b/i,
  /\b(synthesize|integrate|consolidate)\b.*\b(information|sources|data)\b/i,
  // Deep analysis patterns - route to Opus 4.5
  /\bdeep\s*(analysis|dive|look|exploration|investigation|review|research)\b/i,
  /\b(detailed|complete|full)\s*(analysis|view|breakdown|examination|assessment)\b/i,
  /\bdig\s*(deep|deeper|into)\b/i,
  /\b(analyze|examine|review)\s*(in\s*detail|thoroughly|comprehensively|deeply)\b/i,
  /\b(comprehensive|thorough|exhaustive|complete)\s*(analysis|overview|review|assessment|evaluation)\b/i,
  /\bdetailed\s*view\b/i,
  /\b(full|complete)\s*(picture|understanding|breakdown)\b/i,
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
 * Convert score to tier - 4-tier system
 * 
 * Target distribution: Simple ~1%, Moderate ~80%, Complex ~15%, Expert ~4%
 * 
 * Score thresholds adjusted to achieve target distribution:
 * - 0.85+ → Expert (Opus 4.5) - Deep analysis, architecture, research
 * - 0.55+ → Complex (Sonnet 4.5) - Debugging, detailed analysis
 * - 0.10+ → Moderate (Haiku 4.5) - Most tasks, tool usage, standard code
 * - 0.00+ → Simple (Nova Micro) - Greetings, text-only simple responses
 */
function scoreToTier(score: number): ModelTier {
  if (score >= 0.85) return 'expert';   // ~4% - deep analysis, architecture
  if (score >= 0.55) return 'complex';  // ~15% - debugging, detailed analysis  
  if (score >= 0.10) return 'moderate'; // ~80% - most tasks, tools, standard code
  return 'simple';                       // ~1% - greetings, simple text-only
}

/**
 * Convert score to tier (exported alias)
 */
export function getTierFromScore(score: number): ModelTier {
  return scoreToTier(score);
}

function getRoutingReason(score: number, query: string): string {
  if (countPatternMatches(query, CODE_PATTERNS) > 0) {
    return 'Code-related query detected';
  }
  if (countPatternMatches(query, MATH_PATTERNS) > 0) {
    return 'Mathematical content detected';
  }
  if (countPatternMatches(query, REASONING_PATTERNS) > 0) {
    return 'Reasoning or analysis required';
  }
  if (countPatternMatches(query, CREATIVE_PATTERNS) > 0) {
    return 'Creative writing task';
  }
  if (countPatternMatches(query, EXPERT_PATTERNS) > 0) {
    return 'Comprehensive research or analysis';
  }
  if (countPatternMatches(query, UI_GENERATION_PATTERNS) > 0) {
    return 'UI/dashboard generation';
  }
  if (isSimpleQuery(query)) {
    return 'Simple greeting or acknowledgment';
  }
  return 'General query complexity assessment';
}

// ============================================================================
// Main Scoring Function
// ============================================================================

/**
 * Calculate complexity score for model routing.
 * Returns a score from 0-1 that maps to model tiers.
 */
function calculateComplexityScore(query: string): number {
  const tokenCount = estimateTokens(query);
  let score = 0.25; // Base score - SIMPLE tier

  // TRIVIAL: Simple greetings
  if (isSimpleQuery(query)) {
    score = Math.max(0, Math.min(0.12, 0.05 + getLengthAdjustment(tokenCount)));
    return Math.max(0, Math.min(1, score));
  }

  // Pattern scores
  const codeScore = getPatternScore(query, CODE_PATTERNS, 0.35);
  const reasoningScore = getPatternScore(query, REASONING_PATTERNS, 0.25);
  const expertScore = getPatternScore(query, EXPERT_PATTERNS, 0.45);
  const mathScore = getPatternScore(query, MATH_PATTERNS, 0.15);
  const creativeScore = getPatternScore(query, CREATIVE_PATTERNS, 0.15);
  const uiScore = getPatternScore(query, UI_GENERATION_PATTERNS, 0.20);

  let skipLengthPenalty = false;

  // EXPERT (0.80+)
  if (expertScore > 0) {
    score = 0.80 + expertScore * 0.15;
    skipLengthPenalty = true;
  }
  else if (hasExpertComplexity(query, tokenCount)) {
    score = 0.85;
    skipLengthPenalty = true;
  }
  // COMPLEX (0.60-0.80)
  else if (codeScore > 0 && (reasoningScore > 0 || hasTechnicalTerms(query))) {
    score = 0.65 + codeScore * 0.10;
    skipLengthPenalty = true;
  }
  // MODERATE (0.35-0.60)
  else if (uiScore > 0 || codeScore > 0 || reasoningScore > 0 || mathScore > 0) {
    score = 0.40 + uiScore * 0.1 + codeScore * 0.1 + reasoningScore * 0.05 + mathScore * 0.05;
  }
  else if (creativeScore > 0) {
    score = 0.35 + creativeScore * 0.1;
  }
  // SIMPLE (0.15-0.35)
  else {
    score = 0.20;
  }

  // Length adjustments
  if (!skipLengthPenalty) {
    score += getLengthAdjustment(tokenCount);
  }

  // Complexity boosters
  if (hasTechnicalTerms(query) && score < 0.60) {
    score += 0.15;
  }
  if (hasMultiStep(query)) {
    score += 0.20;
  }

  return Math.max(0, Math.min(1, score));
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
