const { z } = require('zod');
const axios = require('axios');
const { tool } = require('@langchain/core/tools');
const { logger } = require('@ranger/data-schemas');
const { generateShortLivedToken } = require('@ranger/api');
const { Tools, EToolResources } = require('ranger-data-provider');
const { filterFilesByAgentAccess } = require('~/server/services/Files/permissions');
const { getFiles } = require('~/models/File');

/**
 *
 * @param {Object} options
 * @param {ServerRequest} options.req
 * @param {Agent['tool_resources']} options.tool_resources
 * @param {string} [options.agentId] - The agent ID for file access control
 * @returns {Promise<{
 *   files: Array<{ file_id: string; filename: string }>,
 *   toolContext: string
 * }>}
 */
const primeFiles = async (options) => {
  const { tool_resources, req, agentId } = options;
  const file_ids = tool_resources?.[EToolResources.file_search]?.file_ids ?? [];
  // resourceFiles are from the CURRENT message attachments
  const resourceFiles = tool_resources?.[EToolResources.file_search]?.files ?? [];
  const currentMessageFileIds = new Set(resourceFiles.map(f => f.file_id));

  // Get all files first (include embedded status but not full text)
  const allFiles = (await getFiles({ file_id: { $in: file_ids } }, null, { text: 0 })) ?? [];

  // Filter by access if user and agent are provided
  let dbFiles;
  if (req?.user?.id && agentId) {
    dbFiles = await filterFilesByAgentAccess({
      files: allFiles,
      userId: req.user.id,
      role: req.user.role,
      agentId,
    });
  } else {
    dbFiles = allFiles;
  }

  // Combine but track which files are from current message vs history
  const combinedFiles = [...resourceFiles, ...dbFiles];

  let toolContext = `- Note: Semantic search is available through the ${Tools.file_search} tool but no files are currently loaded. Request the user to upload documents to search through.`;

  const files = [];
  const currentMessageFiles = {
    embedded: [],
    pending: [],
  };
  const historyFiles = {
    embedded: [],
    pending: [],
  };
  
  for (let i = 0; i < combinedFiles.length; i++) {
    const file = combinedFiles[i];
    if (!file) {
      continue;
    }
    
    const isCurrentMessage = currentMessageFileIds.has(file.file_id);
    
    // Track file status
    const targetGroup = isCurrentMessage ? currentMessageFiles : historyFiles;
    if (file.embedded === true) {
      targetGroup.embedded.push(file.filename);
    } else {
      targetGroup.pending.push(file.filename);
    }
    
    files.push({
      file_id: file.file_id,
      filename: file.filename,
      isCurrentMessage, // Track this for search prioritization
    });
  }

  // Build context message - prioritize current message files in instructions
  const hasCurrentFiles = currentMessageFiles.embedded.length > 0 || currentMessageFiles.pending.length > 0;
  const hasHistoryFiles = historyFiles.embedded.length > 0 || historyFiles.pending.length > 0;

  if (files.length > 0) {
    if (hasCurrentFiles && !hasHistoryFiles) {
      // Only current message files
      if (currentMessageFiles.pending.length > 0) {
        // Current files with text in context - don't recommend file_search for initial query
        toolContext = `- Note: The ${Tools.file_search} tool can search the attached document(s): ${[...currentMessageFiles.pending, ...currentMessageFiles.embedded].join(', ')}.\n` +
          `  However, the full document text is already in the conversation above. For this query, answer directly from that text. ` +
          `Use file_search only for targeted follow-up searches.`;
      } else {
        // Current files fully embedded (no pending) - recommend file_search
        toolContext = `- Note: Use the ${Tools.file_search} tool to find information in the attached document(s):\n\t- ` +
          currentMessageFiles.embedded.join('\n\t- ');
      }
    } else if (hasCurrentFiles && hasHistoryFiles) {
      // Both current and history files - PRIORITIZE CURRENT
      toolContext = `- **CURRENT ATTACHMENT(S)** (prioritize these):\n`;
      if (currentMessageFiles.pending.length > 0) {
        toolContext += `  Full text is in the conversation: ${currentMessageFiles.pending.join(', ')}. Answer directly from that content.\n`;
      }
      if (currentMessageFiles.embedded.length > 0) {
        toolContext += `  Use file_search for: ${currentMessageFiles.embedded.join(', ')}\n`;
      }
      toolContext += `- Previous conversation files (only if user asks about them):\n`;
      toolContext += `  ${[...historyFiles.embedded, ...historyFiles.pending].join(', ')}`;
    } else if (!hasCurrentFiles && hasHistoryFiles) {
      // Only history files - user is asking about previous files
      if (historyFiles.embedded.length > 0) {
        toolContext = `- Note: Use the ${Tools.file_search} tool to find information in previous conversation files:\n\t- ` +
          historyFiles.embedded.join('\n\t- ');
      }
      if (historyFiles.pending.length > 0) {
        toolContext += (historyFiles.embedded.length > 0 ? '\n' : '- Note: ') +
          `Files with text in conversation history: ${historyFiles.pending.join(', ')}`;
      }
    }
  }

  return { files, toolContext };
};

/**
 *
 * @param {Object} options
 * @param {string} options.userId
 * @param {Array<{ file_id: string; filename: string; isCurrentMessage?: boolean }>} options.files
 * @param {string} [options.entity_id]
 * @param {boolean} [options.fileCitations=false] - Whether to include citation instructions
 * @returns
 */
const createFileSearchTool = async ({ userId, files, entity_id, fileCitations = false }) => {
  // Create a map for quick lookup of current message files
  const currentMessageFileIds = new Set(
    files.filter(f => f.isCurrentMessage).map(f => f.file_id)
  );
  
  return tool(
    async ({ query }) => {
      if (files.length === 0) {
        return ['No files to search. Instruct the user to add files for the search.', undefined];
      }
      const jwtToken = generateShortLivedToken(userId);
      if (!jwtToken) {
        return ['There was an error authenticating the file search request.', undefined];
      }

      /**
       *
       * @param {import('ranger-data-provider').TFile} file
       * @returns {{ file_id: string, query: string, k: number, entity_id?: string }}
       */
      const createQueryBody = (file) => {
        const body = {
          file_id: file.file_id,
          query,
          k: 5,
        };
        if (!entity_id) {
          return body;
        }
        body.entity_id = entity_id;
        logger.debug(`[${Tools.file_search}] RAG API /query body`, body);
        return body;
      };

      // Log all files being queried
      logger.info(
        `[${Tools.file_search}] Querying RAG API for ${files.length} file(s): ` +
        files.map(f => f.filename).join(', ')
      );

      const queryPromises = files.map((file) => {
        logger.debug(
          `[${Tools.file_search}] Sending query to RAG API | file: ${file.filename} | ` +
          `file_id: ${file.file_id} | query: "${query.substring(0, 100)}..."`
        );
        return axios
          .post(`${process.env.RAG_API_URL}/query`, createQueryBody(file), {
            headers: {
              Authorization: `Bearer ${jwtToken}`,
              'Content-Type': 'application/json',
            },
          })
          .then((response) => {
            logger.info(
              `[${Tools.file_search}] RAG API response for ${file.filename}: ` +
              `${response.data?.length || 0} chunks returned`
            );
            return response;
          })
          .catch((error) => {
            logger.error(
              `[${Tools.file_search}] RAG API query failed for ${file.filename}:`,
              error.response?.data || error.message
            );
            return null;
          });
      });

      const results = await Promise.all(queryPromises);
      const validResults = results.filter((result) => result !== null);

      if (validResults.length === 0) {
        return ['No results found or errors occurred while searching the files.', undefined];
      }

      const formattedResults = validResults
        .flatMap((result, fileIndex) =>
          result.data.map(([docInfo, distance]) => ({
            filename: docInfo.metadata.source.split('/').pop(),
            content: docInfo.page_content,
            distance,
            file_id: files[fileIndex]?.file_id,
            page: docInfo.metadata.page || null,
            isCurrentMessage: currentMessageFileIds.has(files[fileIndex]?.file_id),
          })),
        )
        // Sort by: 1) current message files first, 2) then by relevance (distance)
        .sort((a, b) => {
          // Current message files get priority
          if (a.isCurrentMessage && !b.isCurrentMessage) return -1;
          if (!a.isCurrentMessage && b.isCurrentMessage) return 1;
          // Within same category, sort by relevance
          return a.distance - b.distance;
        })
        .slice(0, 10);

      if (formattedResults.length === 0) {
        return [
          'No content found in the files. The files may not have been processed correctly or you may need to refine your query.',
          undefined,
        ];
      }

      const formattedString = formattedResults
        .map(
          (result, index) =>
            `File: ${result.filename}${
              fileCitations ? `\nAnchor: \\ue202turn0file${index} (${result.filename})` : ''
            }\nRelevance: ${(1.0 - result.distance).toFixed(4)}\nContent: ${result.content}\n`,
        )
        .join('\n---\n');

      const sources = formattedResults.map((result) => ({
        type: 'file',
        fileId: result.file_id,
        content: result.content,
        fileName: result.filename,
        relevance: 1.0 - result.distance,
        pages: result.page ? [result.page] : [],
        pageRelevance: result.page ? { [result.page]: 1.0 - result.distance } : {},
      }));

      return [formattedString, { [Tools.file_search]: { sources, fileCitations } }];
    },
    {
      name: Tools.file_search,
      responseFormat: 'content_and_artifact',
      description: `Performs semantic search across attached "${Tools.file_search}" documents using natural language queries. This tool analyzes the content of uploaded files to find relevant information, quotes, and passages that best match your query. Use this to extract specific information or find relevant sections within the available documents.${
        fileCitations
          ? `

**CITE FILE SEARCH RESULTS:**
Use the EXACT anchor markers shown below (copy them verbatim) immediately after statements derived from file content. Reference the filename in your text:
- File citation: "The document.pdf states that... \\ue202turn0file0"  
- Page reference: "According to report.docx... \\ue202turn0file1"
- Multi-file: "Multiple sources confirm... \\ue200\\ue202turn0file0\\ue202turn0file1\\ue201"

**CRITICAL:** Output these escape sequences EXACTLY as shown (e.g., \\ue202turn0file0). Do NOT substitute with other characters like † or similar symbols.
**ALWAYS mention the filename in your text before the citation marker. NEVER use markdown links or footnotes.**`
          : ''
      }`,
      schema: z.object({
        query: z
          .string()
          .describe(
            "A natural language query to search for relevant information in the files. Be specific and use keywords related to the information you're looking for. The query will be used for semantic similarity matching against the file contents.",
          ),
      }),
    },
  );
};

module.exports = { createFileSearchTool, primeFiles };
