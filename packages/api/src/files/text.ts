import { logger } from '@ranger/data-schemas';
import { FileSources } from 'ranger-data-provider';
import { readFileAsString } from '~/utils';

/**
 * NOTE: parseText function has been removed as part of unified upload flow.
 * All text extraction now goes through the /embed endpoint via uploadVectors.
 * This provides a unified flow where:
 * 1. Text is extracted immediately and returned in response
 * 2. Embeddings are created in background
 * 
 * Only parseTextNative remains as a fallback for simple text files when RAG API is unavailable.
 */

/**
 * Native JavaScript text parsing fallback
 * Simple text file reading - complex formats handled by RAG API
 * @param file - The uploaded file
 * @returns
 */
export async function parseTextNative(file: Express.Multer.File): Promise<{
  text: string;
  bytes: number;
  source: string;
}> {
  const { content: text, bytes } = await readFileAsString(file.path, {
    fileSize: file.size,
  });

  return {
    text,
    bytes,
    source: FileSources.text,
  };
}
