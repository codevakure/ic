/**
 * Auto Tools Selection Module
 * 
 * Automatically selects tools based on:
 * - User query intent
 * - Available tools
 * - Context and conversation history
 * - File attachments present
 */

import { AttachmentFile, UploadStrategy, FileCategory } from '../attachments/types';
import { routeAttachment } from '../attachments';

/**
 * Available tool types in the system
 */
export enum ToolType {
  /** Code interpreter / executor */
  CODE_INTERPRETER = 'code_interpreter',
  /** File search / RAG */
  FILE_SEARCH = 'file_search',
  /** Image generation (DALL-E, etc.) */
  IMAGE_GENERATION = 'image_generation',
  /** Web search */
  WEB_SEARCH = 'web_search',
  /** YouTube video transcript fetching */
  YOUTUBE_VIDEO = 'youtube_video',
  /** Calculator */
  CALCULATOR = 'calculator',
  /** Custom MCP tools */
  MCP_TOOL = 'mcp_tool',
}

/**
 * Tool definition
 */
export interface ToolDefinition {
  type: ToolType;
  name: string;
  description?: string;
  /** Whether this tool is enabled */
  enabled: boolean;
  /** Required capabilities for this tool */
  capabilities?: string[];
}

/**
 * Context for tool selection
 */
export interface ToolSelectionContext {
  /** User's query */
  query: string;
  /** Available tools */
  availableTools: ToolDefinition[];
  /** File attachments */
  attachments?: AttachmentFile[];
  /** Conversation history for context */
  conversationHistory?: Array<{ role: string; content: string }>;
  /** Explicit tool preferences from user */
  preferredTools?: ToolType[];
}

/**
 * Result of tool selection
 */
export interface ToolSelectionResult {
  /** Tools to use */
  selectedTools: ToolDefinition[];
  /** Confidence score 0-1 */
  confidence: number;
  /** Reasoning for selection */
  reasoning: string;
  /** Tools to auto-enable based on attachments */
  autoEnabledTools: ToolType[];
}

/**
 * Query intent patterns for tool selection
 */
const INTENT_PATTERNS = {
  [ToolType.CODE_INTERPRETER]: [
    /\b(calculate|compute|run|execute|code|script|analyze data|chart|graph|plot)\b/i,
    /\b(python|javascript|typescript|sql)\b/i,
    /\b(spreadsheet|excel|csv|dataframe)\b/i,
    /\b(math|equation|formula|statistics)\b/i,
    // Document generation patterns - PDF, Word, PowerPoint, Excel
    /\b(generate|create|make|build|produce)\s+(a\s+)?(pdf|word|powerpoint|ppt|pptx|excel|xlsx|document|presentation|slide|report)\b/i,
    /\b(pdf|word|powerpoint|ppt|pptx|excel|xlsx)\s+(document|file|report|presentation)\b/i,
    /\b(export|save|convert)\s+(to|as)\s+(pdf|word|powerpoint|ppt|excel|xlsx)\b/i,
  ],
  [ToolType.FILE_SEARCH]: [
    /\b(search|find|look up|what does .* say|according to|in the (document|file|pdf))\b/i,
    /\b(summarize|extract|quote|reference)\b/i,
    /\b(document|pdf|file|attachment)\b/i,
  ],
  [ToolType.IMAGE_GENERATION]: [
    /\b(generate|create|draw|make|design) .*(image|picture|illustration|art|logo|icon)\b/i,
    /\b(visualize|render|sketch)\b/i,
  ],
  [ToolType.WEB_SEARCH]: [
    /\b(search (the )?(web|internet|online)|google|look up online|current|latest|recent|news)\b/i,
    /\b(what is|who is|where is|when did)\b/i,
  ],
  [ToolType.YOUTUBE_VIDEO]: [
    /\b(youtube\.com|youtu\.be)\b/i,
    /\b(youtube|video)\b.*\b(transcript|summary|summarize)\b/i,
    /\b(transcript|summary|summarize)\b.*\b(youtube|video)\b/i,
  ],
  [ToolType.CALCULATOR]: [
    /\b(\d+\s*[\+\-\*\/\%\^]\s*\d+)\b/,
    /\b(calculate|compute|what is \d+)\b/i,
  ],
};

/**
 * Analyze query intent to suggest tools
 */
function analyzeQueryIntent(query: string): Map<ToolType, number> {
  const scores = new Map<ToolType, number>();

  for (const [toolType, patterns] of Object.entries(INTENT_PATTERNS)) {
    let score = 0;
    for (const pattern of patterns) {
      if (pattern.test(query)) {
        score += 0.3;
      }
    }
    if (score > 0) {
      scores.set(toolType as ToolType, Math.min(score, 1));
    }
  }

  return scores;
}

/**
 * Determine tools needed based on attachments
 */
function getToolsForAttachments(attachments: AttachmentFile[]): Set<ToolType> {
  const tools = new Set<ToolType>();

  for (const attachment of attachments) {
    const route = routeAttachment(attachment);

    switch (route.primaryStrategy) {
      case UploadStrategy.CODE_EXECUTOR:
        tools.add(ToolType.CODE_INTERPRETER);
        break;
      case UploadStrategy.FILE_SEARCH:
        tools.add(ToolType.FILE_SEARCH);
        break;
      case UploadStrategy.IMAGE:
        // Images use vision, not a tool
        break;
    }

    // Background strategies may also need tools
    if (route.shouldEmbed) {
      tools.add(ToolType.FILE_SEARCH);
    }
  }

  return tools;
}

/**
 * Select appropriate tools based on context
 */
export function selectTools(context: ToolSelectionContext): ToolSelectionResult {
  const { query, availableTools, attachments = [], preferredTools = [] } = context;

  const reasons: string[] = [];
  const selectedToolTypes = new Set<ToolType>();
  const autoEnabledTools: ToolType[] = [];

  // 1. Analyze query intent
  const intentScores = analyzeQueryIntent(query);
  for (const [toolType, score] of intentScores) {
    if (score >= 0.3) {
      selectedToolTypes.add(toolType);
      reasons.push(`Query suggests ${toolType} (confidence: ${(score * 100).toFixed(0)}%)`);
    }
  }

  // 2. Analyze attachments
  if (attachments.length > 0) {
    const attachmentTools = getToolsForAttachments(attachments);
    for (const toolType of attachmentTools) {
      if (!selectedToolTypes.has(toolType)) {
        selectedToolTypes.add(toolType);
        autoEnabledTools.push(toolType);
        reasons.push(`Auto-enabled ${toolType} for attached files`);
      }
    }
  }

  // 3. Add user's preferred tools
  for (const toolType of preferredTools) {
    if (!selectedToolTypes.has(toolType)) {
      selectedToolTypes.add(toolType);
      reasons.push(`User preference: ${toolType}`);
    }
  }

  // 4. Filter to available tools
  const selectedTools = availableTools.filter(
    tool => tool.enabled && selectedToolTypes.has(tool.type)
  );

  // Calculate overall confidence
  const confidence = selectedTools.length > 0
    ? Math.min(0.9, 0.5 + (selectedTools.length * 0.1))
    : 0.5;

  return {
    selectedTools,
    confidence,
    reasoning: reasons.length > 0 ? reasons.join('. ') : 'No specific tools detected',
    autoEnabledTools,
  };
}

/**
 * Check if a specific tool should be enabled based on context
 */
export function shouldEnableTool(
  toolType: ToolType,
  context: Pick<ToolSelectionContext, 'query' | 'attachments'>
): boolean {
  const { query, attachments = [] } = context;

  // Check query intent
  const intentScores = analyzeQueryIntent(query);
  if ((intentScores.get(toolType) || 0) >= 0.3) {
    return true;
  }

  // Check attachments
  if (attachments.length > 0) {
    const attachmentTools = getToolsForAttachments(attachments);
    if (attachmentTools.has(toolType)) {
      return true;
    }
  }

  return false;
}

export default {
  selectTools,
  shouldEnableTool,
  analyzeQueryIntent,
  ToolType,
};
