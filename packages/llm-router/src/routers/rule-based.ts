/**
 * Rule-Based Router
 * Uses heuristics and pattern matching to determine query complexity.
 * Fast, no external dependencies, good baseline performance.
 */

import { Router } from './base';
import type { RoutingContext, QueryFeatures, RoutingReasonCategory } from '../types';

/**
 * Pattern configuration for feature detection
 */
interface PatternConfig {
  patterns: RegExp[];
  weight: number;
  category: RoutingReasonCategory;
}

/**
 * Rule-based router that uses heuristics to determine query complexity.
 */
export class RuleBasedRouter extends Router {
  public readonly name = 'rule-based';

  // ============================================================================
  // Pattern Definitions
  // ============================================================================

  private readonly codePatterns: PatternConfig = {
    patterns: [
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
      /\b(implement|code|program|script|algorithm|refactor)\b/i, // Action words for coding
      /\b(python|javascript|typescript|java|c\+\+|golang|rust|ruby)\b/i, // Language names
      /\b(write|create|build|develop)\b.*\b(code|function|class|app|application|program|component)\b/i,
      /\b(react|vue|angular|svelte|nextjs|node|express)\b/i, // Frameworks
      /\b(useState|useEffect|useRef|useCallback|useMemo|useContext)\b/, // React hooks
      /\b(component|props|state|render|jsx|tsx)\b/i, // UI component terms
    ],
    weight: 0.35,
    category: 'code',
  };

  private readonly reasoningPatterns: PatternConfig = {
    patterns: [
      /\b(explain|analyze|compare|evaluate|assess|examine|investigate)\b/i,
      /\b(why|how does|what if|suppose|consider|imagine)\b/i,
      /\b(pros and cons|trade-?offs?|advantages?|disadvantages?|benefits?|drawbacks?)\b/i,
      /\b(step by step|break down|walk through|elaborate|detail)\b/i,
      /\b(reasoning|logic|argument|evidence|justify|rationale)\b/i,
      /\b(implications?|consequences?|impact|effect|result)\b/i,
      /\b(difference between|similarities?|contrast|versus|vs\.?)\b/i,
      /\b(complex|complicated|intricate|sophisticated)\b/i, // Complexity indicators
      /\b(architecture|design|system|framework)\b/i, // System design
      /\b(fix|solve|resolve|diagnose|troubleshoot|debug)\b/i, // Problem-solving implies reasoning
      /\b(race condition|deadlock|memory leak|bottleneck)\b/i, // Technical issues need reasoning
    ],
    weight: 0.25,
    category: 'reasoning',
  };

  // EXPERT tier patterns - these need Opus for deep analysis
  private readonly expertPatterns: PatternConfig = {
    patterns: [
      /\b(comprehensive|thorough|in-?depth|exhaustive|detailed)\b.*\b(research|analysis|review|study|report)\b/i,
      /\b(research|investigate|explore)\b.*\b(comprehensive|thorough|all|every)\b/i,
      /\bcomprehensive\b/i,
      /\bthorough(ly)?\b/i,
      /\bin-?depth\b/i,
      /\bexhaustive\b/i,
      /\b(rag|retrieval|knowledge base|document)\b.*\b(search|query|analysis)\b/i,
      /\b(multi-?step|complex)\b.*\b(reasoning|analysis|research)\b/i,
      /\b(critical|deep)\b.*\b(analysis|thinking|review)\b/i,
      /\b(synthesize|integrate|consolidate)\b.*\b(information|sources|data)\b/i,
    ],
    weight: 0.45,
    category: 'reasoning',
  };

  private readonly mathPatterns: PatternConfig = {
    patterns: [
      /\b(calculate|compute|solve|equation|formula|expression)\b/i,
      /[+\-*/^=<>≤≥∑∏∫∂∇]/, // Math operators
      /\b(derivative|integral|probability|statistics|algorithm)\b/i,
      /\$[^$]+\$/, // LaTeX inline math
      /\$\$[\s\S]+?\$\$/, // LaTeX display math
      /\b(matrix|vector|scalar|tensor|eigenvalue)\b/i,
      /\b(proof|theorem|lemma|corollary)\b/i,
      /\b(\d+\.?\d*)\s*[×x*]\s*(\d+\.?\d*)/, // Multiplication expressions
      /\b(percent|percentage|ratio|proportion|fraction)\b/i,
    ],
    weight: 0.15,
    category: 'math',
  };

  private readonly creativePatterns: PatternConfig = {
    patterns: [
      /\b(write|create|generate|compose|draft|craft|build|make|design)\b/i,
      /\b(story|poem|essay|article|blog|script|novel|narrative)\b/i,
      /\b(creative|imaginative|original|unique|innovative)\b/i,
      /\b(tone|style|voice|mood|atmosphere)\b/i,
      /\b(character|plot|setting|dialogue|scene)\b/i,
      /\b(metaphor|simile|imagery|symbolism)\b/i,
    ],
    weight: 0.15, // Increased from 0.1 - creative tasks need capable models
    category: 'creative',
  };

  // UI/Frontend/Artifact generation patterns - Haiku can handle these well
  private readonly uiGenerationPatterns: PatternConfig = {
    patterns: [
      /\b(dashboard|ui|interface|component|widget|page|app|application)\b/i,
      /\b(react|vue|angular|svelte|html|css|frontend|front-?end)\b/i,
      /\b(chart|graph|visualization|table|grid|layout|form)\b/i,
      /\b(button|input|modal|dropdown|menu|navbar|sidebar|card)\b/i,
      /\b(artifact|interactive|render|display|show)\b/i,
    ],
    weight: 0.20, // UI generation - Haiku handles well (MODERATE tier)
    category: 'ui_generation',
  };

  private readonly simplePatterns: RegExp[] = [
    /^(hi|hello|hey|thanks|thank you|ok|okay|yes|no|sure|got it|bye|goodbye)\s*[.!?]?\s*$/i,
    /^(what is|define|meaning of|what's)\s+\w+\s*\??$/i,
    /^(how are you|what's up|how's it going)\s*\??$/i,
    /^(tell me a joke|say something funny)\s*$/i,
    /^(good morning|good evening|good night)\s*[.!]?\s*$/i,
  ];

  private readonly technicalDomainPatterns: RegExp[] = [
    /\b(API|SDK|REST|GraphQL|OAuth|JWT|WebSocket|HTTP)\b/i,
    /\b(Kubernetes|Docker|AWS|Azure|GCP|Terraform|Ansible)\b/i,
    /\b(neural|transformer|embedding|vector|tensor|gradient)\b/i,
    /\b(quantum|molecular|genomic|clinical|pharmaceutical)\b/i,
    /\b(microservices?|serverless|cloud-?native|devops|cicd)\b/i,
    /\b(blockchain|cryptocurrency|smart contract|defi|nft)\b/i,
    /\b(machine learning|deep learning|nlp|computer vision|llm)\b/i,
  ];

  private readonly multiStepPatterns: RegExp[] = [
    /\b(first|then|next|after that|finally|step \d+)\b/i,
    /\b(also|additionally|furthermore|moreover)\b/i,
    /\d+\.\s+.*\n\d+\.\s+/, // Numbered lists
    /[-*]\s+.*\n[-*]\s+/, // Bullet lists
    /\band\b.*\band\b.*\band\b/i, // Multiple "and"s suggesting complexity
  ];

  // LibreChat tool patterns - when these match, model needs to understand tool instructions
  private readonly toolUsePatterns: RegExp[] = [
    // web_search patterns
    /\b(search|lookup|find|google|browse)\b.*\b(web|internet|online|news|latest)\b/i,
    /\b(latest|recent|current|today|news)\b.*\b(about|on|regarding)\b/i,
    /\bwhat('s| is) happening\b/i,
    // execute_code patterns
    /\b(run|execute|eval|compute|calculate)\b.*\b(code|script|python|javascript)\b/i,
    /\b(write|create).*\b(and|then)\b.*\b(run|execute|test)\b/i,
    // file_search patterns
    /\b(search|find|look)\b.*\b(in |through |my )?(files?|documents?|uploads?)\b/i,
    /\b(analyze|read|process)\b.*\b(file|document|pdf|image|upload)\b/i,
    // artifacts patterns
    /\b(create|build|make|generate)\b.*\b(dashboard|ui|interface|component|app|visualization)\b/i,
    /\b(using|with)\s+artifacts?\b/i,
    /\b(interactive|react|html)\b.*\b(component|page|app)\b/i,
  ];

  // ============================================================================
  // Main Implementation
  // ============================================================================

  /**
   * Calculate the complexity score for 5-tier routing.
   * 
   * TIER MAPPING (score ranges):
   * - 0.80-1.00: EXPERT   - Advanced reasoning, complex algorithms, system design
   * - 0.60-0.80: COMPLEX  - Debugging, code review, detailed analysis
   * - 0.35-0.60: MODERATE - Explanations, summaries, standard coding
   * - 0.15-0.35: SIMPLE   - Basic Q&A, definitions, simple questions
   * - 0.00-0.15: TRIVIAL  - Greetings, acknowledgments, one-word responses
   */
  async calculateStrongWinRate(prompt: string, context?: RoutingContext): Promise<number> {
    const features = this.extractFeatures(prompt);
    let score = 0.25; // Base score puts most queries in SIMPLE tier

    // TRIVIAL: Greetings, acknowledgments (0.00-0.15)
    // Note: Context adjustments can still override this
    const isSimple = this.isSimpleQuery(prompt);
    if (isSimple) {
      score = Math.max(0, Math.min(0.12, 0.05 + this.getLengthAdjustment(features.tokenCount)));
      
      // Apply context adjustments even for simple queries
      // This allows userPreference and attachments to override
      if (context) {
        score = this.applyContextAdjustments(score, context, prompt);
      }
      
      return Math.max(0, Math.min(1, score));
    }

    // Pattern detection
    const codeScore = this.applyPatternScore(prompt, this.codePatterns);
    const reasoningScore = this.applyPatternScore(prompt, this.reasoningPatterns);
    const expertScore = this.applyPatternScore(prompt, this.expertPatterns);
    const mathScore = this.applyPatternScore(prompt, this.mathPatterns);
    const creativeScore = this.applyPatternScore(prompt, this.creativePatterns);
    const uiScore = this.applyPatternScore(prompt, this.uiGenerationPatterns);

    // Track if we should skip length penalties (for EXPERT/COMPLEX tiers)
    let skipLengthPenalty = false;

    // EXPERT (0.80+): Comprehensive research, thorough analysis, RAG, deep reasoning
    // → Opus 4.5 - for tasks requiring synthesis and deep understanding
    if (expertScore > 0) {
      score = 0.80 + expertScore * 0.15;
      skipLengthPenalty = true;
    }
    // EXPERT: Multiple complex patterns, system design, algorithms
    else if (this.hasExpertComplexity(prompt, features)) {
      score = 0.85;
      skipLengthPenalty = true;
    }
    // COMPLEX (0.60-0.80): Debugging, code review, detailed technical analysis
    // → Sonnet 4.5 - for code-heavy tasks with reasoning
    else if (codeScore > 0 && (reasoningScore > 0 || features.hasTechnicalTerms)) {
      score = 0.65 + codeScore * 0.10;
      skipLengthPenalty = true;
    }
    // MODERATE (0.35-0.60): UI generation, explanations, standard coding, summaries
    // → Haiku 4.5 - handles dashboards, artifacts, basic code well
    else if (uiScore > 0 || codeScore > 0 || reasoningScore > 0 || mathScore > 0) {
      score = 0.40 + uiScore * 0.1 + codeScore * 0.1 + reasoningScore * 0.05 + mathScore * 0.05;
    }
    // Creative tasks → MODERATE tier
    else if (creativeScore > 0) {
      score = 0.35 + creativeScore * 0.1;
    }
    // SIMPLE (0.15-0.35): Basic Q&A, definitions → Nova Pro/Lite
    else {
      score = 0.20;
    }

    // Length-based adjustments (skip for EXPERT/COMPLEX - short prompts can need smart models)
    if (!skipLengthPenalty) {
      score += this.getLengthAdjustment(features.tokenCount);
    }

    // Additional complexity boosters
    if (features.hasTechnicalTerms && score < 0.60) {
      score += 0.15;
    }
    if (features.hasMultiStep) {
      score += 0.20; // Multi-step tasks need better models
    }
    if (features.languageComplexity > 0.7) {
      score += 0.10;
    }

    // Context-based adjustments
    if (context) {
      score = this.applyContextAdjustments(score, context, prompt);
    }
    
    // ALWAYS check for tool use patterns from the prompt text itself
    // This runs regardless of whether context is passed
    score = this.applyToolUseAdjustments(score, prompt);

    // Clamp to valid range
    return Math.max(0, Math.min(1, score));
  }

  /**
   * Check for expert-level complexity indicators
   */
  private hasExpertComplexity(prompt: string, features: QueryFeatures): boolean {
    const expertPatterns = [
      /\b(architect|design system|scalab|distributed|microservices?)\b/i,
      /\b(algorithm|complexity|big-?o|optimization|performance)\b/i,
      /\b(security|authentication|authorization|encryption|vulnerability)\b/i,
      /\b(machine learning|neural|training|model|inference)\b/i,
      /\b(concurrent|parallel|async|threading|race condition)\b/i,
      /\b(database design|schema|migration|query optimization)\b/i,
      /\b(refactor|redesign|rewrite|overhaul)\b.*\b(entire|whole|complete|full)\b/i,
      /\b(implement|build|create)\b.*\b(from scratch|complete|full)\b/i,
    ];
    
    const matchCount = expertPatterns.filter(p => p.test(prompt)).length;
    
    // Expert if: 2+ expert patterns, or 1 expert + long prompt + technical terms
    return matchCount >= 2 || 
           (matchCount >= 1 && features.tokenCount > 100 && features.hasTechnicalTerms);
  }

  /**
   * Extract features from the prompt
   */
  protected extractFeatures(prompt: string): QueryFeatures {
    const hasCode = this.codePatterns.patterns.some((p) => p.test(prompt));
    const hasMath = this.mathPatterns.patterns.some((p) => p.test(prompt));
    const hasReasoning = this.reasoningPatterns.patterns.some((p) => p.test(prompt));
    const hasCreativeWriting = this.creativePatterns.patterns.some((p) => p.test(prompt));
    const hasTechnicalTerms = this.technicalDomainPatterns.some((p) => p.test(prompt));
    const hasMultiStep = this.multiStepPatterns.some((p) => p.test(prompt));

    return {
      tokenCount: this.estimateTokens(prompt),
      hasCode,
      hasQuestion: /\?/.test(prompt),
      hasMath,
      hasReasoning,
      hasCreativeWriting,
      isSimple: this.isSimpleQuery(prompt),
      languageComplexity: this.assessLanguageComplexity(prompt),
      domainSpecificity: this.assessDomainSpecificity(prompt),
      hasTechnicalTerms,
      hasMultiStep,
    };
  }

  /**
   * Apply pattern-based scoring
   */
  private applyPatternScore(prompt: string, config: PatternConfig): number {
    const matchCount = config.patterns.filter((p) => p.test(prompt)).length;
    if (matchCount === 0) {
      return 0;
    }

    // Diminishing returns for multiple matches
    const normalizedMatches = Math.min(matchCount / config.patterns.length, 1);
    return config.weight * (0.5 + normalizedMatches * 0.5);
  }

  /**
   * Check if query is simple/trivial
   */
  private isSimpleQuery(prompt: string): boolean {
    return this.simplePatterns.some((p) => p.test(prompt.trim()));
  }

  /**
   * Get length-based score adjustment
   */
  private getLengthAdjustment(tokenCount: number): number {
    if (tokenCount > 1000) {
      return 0.15; // Long context needs better model
    }
    if (tokenCount > 500) {
      return 0.1;
    }
    if (tokenCount > 200) {
      return 0.05;
    }
    if (tokenCount < 20) {
      return -0.1; // Very short queries usually simple
    }
    if (tokenCount < 50) {
      return -0.05;
    }
    return 0;
  }

  /**
   * Assess language complexity (0-1)
   */
  private assessLanguageComplexity(prompt: string): number {
    const words = prompt.split(/\s+/).filter((w) => w.length > 0);
    if (words.length === 0) {
      return 0;
    }

    const avgWordLength = words.reduce((sum, w) => sum + w.length, 0) / words.length;
    const sentenceCount = (prompt.match(/[.!?]+/g) || []).length || 1;
    const avgSentenceLength = words.length / sentenceCount;

    // Count unique words (vocabulary richness)
    const uniqueWords = new Set(words.map((w) => w.toLowerCase())).size;
    const vocabularyRichness = uniqueWords / words.length;

    // Normalize components
    const wordLengthScore = Math.min(avgWordLength / 10, 1);
    const sentenceLengthScore = Math.min(avgSentenceLength / 40, 1);
    const vocabularyScore = vocabularyRichness;

    return (wordLengthScore + sentenceLengthScore + vocabularyScore) / 3;
  }

  /**
   * Assess domain specificity (0-1)
   */
  private assessDomainSpecificity(prompt: string): number {
    const matches = this.technicalDomainPatterns.filter((p) => p.test(prompt)).length;
    return Math.min(matches / 4, 1);
  }

  /**
   * Apply context-based adjustments to score
   */
  private applyContextAdjustments(
    score: number,
    context: RoutingContext,
    prompt: string
  ): number {
    let adjustedScore = score;

    // Attachments suggest more complex processing
    if (context.attachments && context.attachments.length > 0) {
      adjustedScore += 0.1;

      // Specific attachment types
      const hasImage = context.attachments.some(
        (a) => a.type?.startsWith('image') || a.mimeType?.startsWith('image')
      );
      const hasDocument = context.attachments.some(
        (a) =>
          a.type?.includes('pdf') ||
          a.type?.includes('document') ||
          a.mimeType?.includes('pdf')
      );

      if (hasImage) {
        adjustedScore += 0.05;
      }
      if (hasDocument) {
        adjustedScore += 0.1;
      }
    }

    // If context.tools is passed explicitly, ensure minimum tier
    if (context.tools && context.tools.length > 0) {
      adjustedScore = Math.max(adjustedScore, 0.35);
    }

    // Long conversations might benefit from consistency
    if (context.messageCount && context.messageCount > 10) {
      // Slight boost to maintain quality in long conversations
      adjustedScore += 0.05;
    }

    // User preference overrides
    if (context.userPreference === 'quality') {
      adjustedScore = Math.max(adjustedScore, 0.7);
    } else if (context.userPreference === 'cost') {
      adjustedScore = Math.min(adjustedScore, 0.3);
    }

    // Continuation of previous response - might need same model
    if (context.isContinuation) {
      // Preserve previous routing decision tendency
      adjustedScore += 0.1;
    }

    return adjustedScore;
  }

  /**
   * Apply tool-use adjustments based on prompt patterns (no context needed)
   * Detects phrases like "using artifacts", "search the web", "run code"
   * Ensures model can understand tool instructions - minimum MODERATE tier (Haiku)
   */
  private applyToolUseAdjustments(score: number, prompt: string): number {
    const needsToolUse = this.toolUsePatterns.some((p) => p.test(prompt));
    
    if (!needsToolUse) {
      return score;
    }
    
    // Tool use needs at least MODERATE tier (Haiku) to understand instructions
    // Haiku handles artifacts, dashboards, code execution well
    return Math.max(score, 0.35);
  }

  /**
   * Get routing reason with enhanced context awareness
   */
  protected getRoutingReason(
    winRate: number,
    threshold: number,
    prompt: string,
    context?: RoutingContext
  ): { reason: string; category: RoutingReasonCategory } {
    // Check context-based reasons first
    if (context?.userPreference === 'quality') {
      return { reason: 'User preference set to quality', category: 'user_preference' };
    }
    if (context?.userPreference === 'cost') {
      return { reason: 'User preference set to cost optimization', category: 'user_preference' };
    }

    // Check for specific feature matches
    if (this.codePatterns.patterns.some((p) => p.test(prompt))) {
      return { reason: 'Code-related query detected', category: 'code' };
    }
    if (this.mathPatterns.patterns.some((p) => p.test(prompt))) {
      return { reason: 'Mathematical content detected', category: 'math' };
    }
    if (this.reasoningPatterns.patterns.some((p) => p.test(prompt))) {
      return { reason: 'Reasoning or analysis required', category: 'reasoning' };
    }
    if (this.creativePatterns.patterns.some((p) => p.test(prompt))) {
      return { reason: 'Creative writing task', category: 'creative' };
    }
    if (context?.tools && context.tools.length > 0) {
      return { reason: 'Tool use may be required', category: 'tools' };
    }
    if (context?.attachments && context.attachments.length > 0) {
      return { reason: 'Processing attachments', category: 'attachments' };
    }

    // Fallback to win rate based reasons
    return super.getRoutingReason(winRate, threshold, prompt, context);
  }
}
