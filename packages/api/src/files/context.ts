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
    `[extractFileContext] Processing ${attachments.length} attachments: ${attachments.map(f => `${f.filename}(text:${!!f.text},embedded:${f.embedded})`).join(', ')}`,
  );

  const fileConfig = mergeFileConfig(req?.config?.fileConfig);
  // Use a conservative default of 30K tokens to avoid context overflow with Haiku 4.5
  // The model has ~200K context but we need room for system prompt, tools, and conversation history
  const fileTokenLimit = req?.body?.fileTokenLimit ?? fileConfig.fileTokenLimit ?? 30000;

  let resultText = '';
  const pendingEmbeddingFiles: string[] = [];
  const embeddedFiles: string[] = [];
  const truncatedFiles: string[] = [];

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

    // Track files that are fully embedded (RAG ready)
    if (file.embedded === true) {
      embeddedFiles.push(file.filename);
      logger.debug(
        `[extractFileContext] File ${file.filename} is embedded - will use file_search tool`,
      );
      continue;
    }

    // Track files pending embedding - we'll add a note for the model
    // At this point, file.embedded is false/undefined (we already continued above if true)
    if (toolResource === 'file_search') {
      pendingEmbeddingFiles.push(file.filename);
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
        truncatedFiles.push(file.filename);
        logger.debug(
          `[extractFileContext] Text content truncated for file: ${file.filename} due to token limits`,
        );
      }

      resultText += `${!resultText ? 'Attached document(s):\n```md' : '\n\n---\n\n'}# "${file.filename}"${wasTruncated ? ' (truncated)' : ''}\n${limitedText}\n`;
    }
  }

  if (resultText) {
    resultText += '\n```';
    
    // Add clear instruction based on whether content was truncated
    // This prevents the model from unnecessarily calling file_search when it already has the full content
    if (truncatedFiles.length > 0) {
      resultText += `\n\n**Note**: Some document(s) were truncated due to size limits: ${truncatedFiles.join(', ')}. ` +
        `You can answer based on the visible content. For questions about sections not shown, use the file_search tool to find specific information.`;
    } else {
      resultText += `\n\n**IMPORTANT**: The complete document content is provided above. ` +
        `Answer questions directly using this text - do NOT use the file_search tool for this query.`;
    }
  }

  // Add note about pending embedding files - model should respond with available info
  // and let user know full search will be available shortly
  if (pendingEmbeddingFiles.length > 0 && truncatedFiles.length === 0) {
    const pendingNote = `\n\n**Note**: The file(s) are being indexed in the background for future semantic searches. ` +
      `For this query, use the full document text provided above.`;
    resultText = (resultText || '') + pendingNote;
  }

  // Add note about embedded files that should use file_search
  if (embeddedFiles.length > 0 && !resultText) {
    // Only add this if there's no other content - otherwise model already knows to use file_search
    resultText = `**Note**: The following file(s) are indexed and ready for search: ${embeddedFiles.join(', ')}. ` +
      `Use the file_search tool to find relevant information from these documents.`;
  }

  return resultText || undefined;
}
