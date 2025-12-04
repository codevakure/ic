import { logger } from '@ranger/data-schemas';
import { FileSources, mergeFileConfig } from 'ranger-data-provider';
import type { IMongoFile } from '@ranger/data-schemas';
import type { ServerRequest } from '~/types';
import { processTextWithTokenLimit } from '~/utils/text';

/**
 * Extracts text context from attachments and returns formatted text.
 * This handles text that was already extracted from files (OCR, transcriptions, document text, etc.)
 * 
 * IMPORTANT: Files routed to execute_code are NOT included in text context.
 * The code executor will read these files directly, so adding them to context
 * would be redundant and waste tokens.
 * 
 * @param params - The parameters object
 * @param params.attachments - Array of file attachments
 * @param params.req - Express request object for config access
 * @param params.tokenCountFn - Function to count tokens in text
 * @returns The formatted file context text, or undefined if no text found
 */
export async function extractFileContext({
  attachments,
  req,
  tokenCountFn,
}: {
  attachments: IMongoFile[];
  req?: ServerRequest;
  tokenCountFn: (text: string) => number;
}): Promise<string | undefined> {
  if (!attachments || attachments.length === 0) {
    logger.debug('[extractFileContext] No attachments provided');
    return undefined;
  }

  logger.debug(
    `[extractFileContext] Processing ${attachments.length} attachments: ${attachments.map(f => `${f.filename}(text:${!!f.text})`).join(', ')}`,
  );

  const fileConfig = mergeFileConfig(req?.config?.fileConfig);
  const fileTokenLimit = req?.body?.fileTokenLimit ?? fileConfig.fileTokenLimit ?? 50000; // Default to 50k tokens if not set

  let resultText = '';

  for (const file of attachments) {
    const source = file.source ?? FileSources.local;
    
    // Skip files routed to execute_code - the code executor will read them directly
    // Adding them to context would be redundant and waste tokens
    const toolResource = file.metadata?.tool_resource;
    if (toolResource === 'execute_code') {
      logger.debug(
        `[extractFileContext] Skipping file ${file.filename} - routed to execute_code tool`,
      );
      continue;
    }

    // Skip embedded files - they should use file_search tool for RAG-based retrieval
    // This allows proper citation tracking with page numbers
    if (file.embedded === true) {
      logger.debug(
        `[extractFileContext] Skipping embedded file ${file.filename} - should use file_search tool for citations`,
      );
      continue;
    }
    
    // Process files with text content - either from FileSources.text OR from file_search extraction
    // This allows file_search files to provide immediate context while embedding happens in background
    if (file.text && file.text.length > 0) {
      logger.debug(
        `[extractFileContext] Processing file with text: ${file.filename} | source: ${source} | embedded: ${file.embedded} | textLength: ${file.text.length}`,
      );

      const { text: limitedText, wasTruncated } = await processTextWithTokenLimit({
        text: file.text,
        tokenLimit: fileTokenLimit,
        tokenCountFn,
      });

      if (wasTruncated) {
        logger.debug(
          `[extractFileContext] Text content truncated for file: ${file.filename} due to token limits`,
        );
      }

      resultText += `${!resultText ? 'Attached document(s):\n```md' : '\n\n---\n\n'}# "${file.filename}"\n${limitedText}\n`;
    }
  }

  if (resultText) {
    resultText += '\n```';
    return resultText;
  }

  return undefined;
}
