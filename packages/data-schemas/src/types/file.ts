import { Document, Types } from 'mongoose';

export interface IMongoFile extends Omit<Document, 'model'> {
  user: Types.ObjectId;
  conversationId?: string;
  file_id: string;
  temp_file_id?: string;
  bytes: number;
  text?: string;
  filename: string;
  filepath: string;
  object: 'file';
  embedded?: boolean;
  type: string;
  context?: string;
  usage: number;
  source: string;
  model?: string;
  width?: number;
  height?: number;
  metadata?: {
    fileIdentifier?: string;
    /** Upload strategies from intent analyzer: IMAGE, CODE_EXECUTOR, FILE_SEARCH */
    strategies?: string[];
    /** RAG embedding status: pending, processing, completed, failed */
    ragStatus?: 'pending' | 'processing' | 'completed' | 'failed';
    /** Tool resource assignment: execute_code, file_search */
    tool_resource?: 'execute_code' | 'file_search';
  };
  expiresAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}
