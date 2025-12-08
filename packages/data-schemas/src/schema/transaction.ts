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
  },
  {
    timestamps: true,
  },
);

export default transactionSchema;
