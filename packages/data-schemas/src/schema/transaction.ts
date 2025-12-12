import mongoose, { Schema, Document, Types } from 'mongoose';

// Per-tool token breakdown
export interface IToolBreakdown {
  name: string;
  tokens: number;
}

// Per-tool context breakdown  
export interface IToolContextBreakdown {
  name: string;
  tokens: number;
}

// Context breakdown for detailed token tracking
export interface IContextBreakdown {
  // High-level totals
  instructions?: number;      // System prompt tokens
  artifacts?: number;         // Artifacts prompt tokens
  tools?: number;             // Tool definitions tokens (total)
  toolCount?: number;         // Number of tools
  toolContext?: number;       // Tool usage instructions (total)
  total?: number;             // Total context tokens
  
  // Detailed per-tool breakdown
  toolsDetail?: IToolBreakdown[];         // Individual tool token counts
  toolContextDetail?: IToolContextBreakdown[];  // Individual tool context token counts
}

// Context analytics for observability
export interface IContextAnalytics {
  messageCount?: number;           // Total messages in context
  totalTokens?: number;            // Total tokens in context
  maxContextTokens?: number;       // Maximum allowed context tokens
  instructionTokens?: number;      // Instruction/system tokens
  utilizationPercent?: number;     // Context utilization (0-100)
  breakdown?: Record<string, { tokens: number; percent: number }>;  // By message type
  toonStats?: {
    compressedCount?: number;      // Number of outputs TOON compressed
    charactersSaved?: number;      // Characters saved
    tokensSaved?: number;          // Estimated tokens saved
    avgReductionPercent?: number;  // Average reduction %
  };
  cacheStats?: {
    cacheReadTokens?: number;      // Cache read tokens
    cacheCreationTokens?: number;  // Cache creation tokens
  };
  pruningApplied?: boolean;        // Whether pruning was applied
  messagesPruned?: number;         // Messages pruned count
}

// @ts-ignore
export interface ITransaction extends Document {
  user: Types.ObjectId;
  conversationId?: string;
  tokenType: 'prompt' | 'completion' | 'credits';
  model?: string;
  context?: string;
  valueKey?: string;
  rate?: number;
  rawAmount?: number;
  tokenValue?: number;
  inputTokens?: number;
  writeTokens?: number;
  readTokens?: number;
  contextBreakdown?: IContextBreakdown;  // Detailed breakdown of what's in the context
  contextAnalytics?: IContextAnalytics;  // Context analytics for observability
  createdAt?: Date;
  updatedAt?: Date;
}

const transactionSchema: Schema<ITransaction> = new Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
      required: true,
    },
    conversationId: {
      type: String,
      ref: 'Conversation',
      index: true,
    },
    tokenType: {
      type: String,
      enum: ['prompt', 'completion', 'credits'],
      required: true,
    },
    model: {
      type: String,
    },
    context: {
      type: String,
    },
    valueKey: {
      type: String,
    },
    rate: Number,
    rawAmount: Number,
    tokenValue: Number,
    inputTokens: { type: Number },
    writeTokens: { type: Number },
    readTokens: { type: Number },
    contextBreakdown: {
      type: {
        // High-level totals
        instructions: Number,
        artifacts: Number,
        tools: Number,
        toolCount: Number,
        toolContext: Number,
        total: Number,
        // Detailed per-tool breakdown
        toolsDetail: [{
          name: String,
          tokens: Number,
        }],
        toolContextDetail: [{
          name: String,
          tokens: Number,
        }],
      },
      default: undefined,
    },
    contextAnalytics: {
      type: {
        messageCount: Number,
        totalTokens: Number,
        maxContextTokens: Number,
        instructionTokens: Number,
        utilizationPercent: Number,
        breakdown: Schema.Types.Mixed,  // { human: { tokens, percent }, ai: {...}, tool: {...} }
        toonStats: {
          compressedCount: Number,
          charactersSaved: Number,
          tokensSaved: Number,
          avgReductionPercent: Number,
        },
        cacheStats: {
          cacheReadTokens: Number,
          cacheCreationTokens: Number,
        },
        pruningApplied: Boolean,
        messagesPruned: Number,
      },
      default: undefined,
    },
  },
  {
    timestamps: true,
  },
);

export default transactionSchema;
