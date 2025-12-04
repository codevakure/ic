const path = require('path');
const { v4 } = require('uuid');
const axios = require('axios');
const { logger } = require('@ranger/data-schemas');
const { getCodeBaseURL } = require('illuma-agents');
const { logAxiosError, getBasePath } = require('@ranger/api');
const {
  Tools,
  FileContext,
  FileSources,
  imageExtRegex,
  EToolResources,
} = require('ranger-data-provider');
const { filterFilesByAgentAccess } = require('~/server/services/Files/permissions');
const { getStrategyFunctions } = require('~/server/services/Files/strategies');
const { convertImage } = require('~/server/services/Files/images/convert');
const { createFile, getFiles, updateFile } = require('~/models/File');

/**
 * Process OpenAI image files, convert to target format, save and return file metadata.
 * @param {ServerRequest} params.req - The Express request object.
 * @param {string} params.id - The file ID.
 * @param {string} params.name - The filename.
 * @param {string} params.apiKey - The code execution API key.
 * @param {string} params.toolCallId - The tool call ID that generated the file.
 * @param {string} params.session_id - The code execution session ID.
 * @param {string} params.conversationId - The current conversation ID.
 * @param {string} params.messageId - The current message ID.
 * @returns {Promise<MongoFile & { messageId: string, toolCallId: string } | { filename: string; filepath: string; expiresAt: number; conversationId: string; toolCallId: string; messageId: string } | undefined>} The file metadata or undefined if an error occurs.
 */
const processCodeOutput = async ({
  req,
  id,
  name,
  apiKey,
  toolCallId,
  conversationId,
  messageId,
  session_id,
}) => {
  const appConfig = req.config;
  const currentDate = new Date();
  const baseURL = getCodeBaseURL();
  const basePath = getBasePath();
  const fileExt = path.extname(name);
  if (!fileExt || !imageExtRegex.test(name)) {
    return {
      filename: name,
      filepath: `${basePath}/api/files/code/download/${session_id}/${id}`,
      /** Note: expires 24 hours after creation */
      expiresAt: currentDate.getTime() + 86400000,
      conversationId,
      toolCallId,
      messageId,
    };
  }

  try {
    const formattedDate = currentDate.toISOString();
    const response = await axios({
      method: 'get',
      url: `${baseURL}/download/${session_id}/${id}`,
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': 'Ranger/1.0',
        'X-API-Key': apiKey,
      },
      timeout: 15000,
    });

    const buffer = Buffer.from(response.data, 'binary');

    const file_id = v4();
    const _file = await convertImage(req, buffer, 'high', `${file_id}${fileExt}`);
    const file = {
      ..._file,
      file_id,
      usage: 1,
      filename: name,
      conversationId,
      user: req.user.id,
      type: `image/${appConfig.imageOutputType}`,
      createdAt: formattedDate,
      updatedAt: formattedDate,
      source: appConfig.fileStrategy,
      context: FileContext.execute_code,
    };
    createFile(file, true);
    /** Note: `messageId` & `toolCallId` are not part of file DB schema; message object records associated file ID */
    return Object.assign(file, { messageId, toolCallId });
  } catch (error) {
    logAxiosError({
      message: 'Error downloading code environment file',
      error,
    });
  }
};

function checkIfActive(dateString) {
  const givenDate = new Date(dateString);
  const currentDate = new Date();
  const timeDifference = currentDate - givenDate;
  const hoursPassed = timeDifference / (1000 * 60 * 60);
  return hoursPassed < 23;
}

/**
 * Parse a fileIdentifier string into its components.
 * Format: "session_id/file_id" or "session_id/file_id?entity_id=xxx"
 * 
 * @param {string} fileIdentifier - The file identifier string
 * @returns {{ session_id: string, file_id: string, entity_id?: string } | null}
 */
function parseFileIdentifier(fileIdentifier) {
  if (!fileIdentifier || typeof fileIdentifier !== 'string') {
    return null;
  }
  
  try {
    // Split off query parameters first
    const [pathPart, queryString] = fileIdentifier.split('?');
    const [session_id, file_id] = pathPart.split('/');
    
    if (!session_id || !file_id) {
      logger.warn(`[parseFileIdentifier] Invalid fileIdentifier format: ${fileIdentifier}`);
      return null;
    }
    
    // Parse query parameters if present
    let entity_id;
    if (queryString) {
      const params = new URLSearchParams(queryString);
      entity_id = params.get('entity_id') || undefined;
    }
    
    return { session_id, file_id, entity_id };
  } catch (error) {
    logger.error(`[parseFileIdentifier] Error parsing fileIdentifier: ${fileIdentifier}`, error);
    return null;
  }
}

/**
 * Retrieves the `lastModified` time string for a specified file from Code Execution Server.
 *
 * @param {string} fileIdentifier - The identifier for the file (e.g., "session_id/fileId").
 * @param {string} apiKey - The API key for authentication.
 *
 * @returns {Promise<string|null>}
 *          A promise that resolves to the `lastModified` time string of the file if successful, or null if there is an
 *          error in initialization or fetching the info.
 */
async function getSessionInfo(fileIdentifier, apiKey) {
  const parsed = parseFileIdentifier(fileIdentifier);
  if (!parsed) {
    logger.warn(`[getSessionInfo] Could not parse fileIdentifier: ${fileIdentifier}`);
    return null;
  }
  
  const { session_id, file_id, entity_id } = parsed;
  
  try {
    const baseURL = getCodeBaseURL();
    const queryParams = entity_id ? { detail: 'summary', entity_id } : { detail: 'summary' };

    const response = await axios({
      method: 'get',
      url: `${baseURL}/files/${session_id}`,
      params: queryParams,
      headers: {
        'User-Agent': 'Ranger/1.0',
        'X-API-Key': apiKey,
      },
      timeout: 5000,
    });

    // Find the file in the session by matching the session_id/file_id pattern
    const filePattern = `${session_id}/${file_id}`;
    return response.data.find((file) => file.name.startsWith(filePattern))?.lastModified;
  } catch (error) {
    logAxiosError({
      message: `[getSessionInfo] Error fetching session info for ${session_id}: ${error.message}`,
      error,
    });
    return null;
  }
}

/**
 *
 * @param {Object} options
 * @param {ServerRequest} options.req
 * @param {Agent['tool_resources']} options.tool_resources
 * @param {string} [options.agentId] - The agent ID for file access control
 * @param {string} apiKey
 * @returns {Promise<{
 * files: Array<{ id: string; session_id: string; name: string }>,
 * toolContext: string,
 * }>}
 */
const primeFiles = async (options, apiKey) => {
  const { tool_resources, req, agentId } = options;
  const file_ids = tool_resources?.[EToolResources.execute_code]?.file_ids ?? [];
  const agentResourceIds = new Set(file_ids);
  const resourceFiles = tool_resources?.[EToolResources.execute_code]?.files ?? [];

  // DUAL-UPLOAD SUPPORT: Also check file_search files that have fileIdentifier metadata
  // These are files uploaded to file_search that were also uploaded to code executor
  const fileSearchFileIds = tool_resources?.[EToolResources.file_search]?.file_ids ?? [];
  
  logger.info(`[primeFiles] Starting. execute_code file_ids: ${file_ids.length}, file_search file_ids: ${fileSearchFileIds.length}, resourceFiles: ${resourceFiles.length}`);
  if (resourceFiles.length > 0) {
    logger.info(`[primeFiles] Resource files: ${resourceFiles.map(f => `${f.filename} (fileIdentifier: ${f.metadata?.fileIdentifier || 'none'}, tool_resource: ${f.metadata?.tool_resource || 'none'})`).join(', ')}`);
  }

  // Get execute_code files
  const allFiles = (await getFiles({ file_id: { $in: file_ids } }, null, { text: 0 })) ?? [];
  
  // Get file_search files that might have fileIdentifier (dual-uploaded)
  let fileSearchFiles = [];
  if (fileSearchFileIds.length > 0) {
    const allFileSearchFiles = (await getFiles({ file_id: { $in: fileSearchFileIds } }, null, { text: 0 })) ?? [];
    // Only include file_search files that have fileIdentifier (were dual-uploaded to code executor)
    fileSearchFiles = allFileSearchFiles.filter(f => f.metadata?.fileIdentifier);
    if (fileSearchFiles.length > 0) {
      logger.info(`[primeFiles] Found ${fileSearchFiles.length} file_search files with fileIdentifier (dual-uploaded): ${fileSearchFiles.map(f => f.filename).join(', ')}`);
    }
  }

  // Filter by access if user and agent are provided
  let dbFiles;
  if (req?.user?.id && agentId) {
    dbFiles = await filterFilesByAgentAccess({
      files: allFiles,
      userId: req.user.id,
      role: req.user.role,
      agentId,
    });
    // Also filter file_search files
    if (fileSearchFiles.length > 0) {
      const filteredFileSearchFiles = await filterFilesByAgentAccess({
        files: fileSearchFiles,
        userId: req.user.id,
        role: req.user.role,
        agentId,
      });
      dbFiles = dbFiles.concat(filteredFileSearchFiles);
    }
  } else {
    dbFiles = allFiles.concat(fileSearchFiles);
  }

  dbFiles = dbFiles.concat(resourceFiles);

  const files = [];
  const sessions = new Map();
  let toolContext = '';

  for (let i = 0; i < dbFiles.length; i++) {
    const file = dbFiles[i];
    if (!file) {
      continue;
    }

    /**
     * Helper function to upload file to code executor and update metadata.
     * This is the single source of truth for uploading files to code executor.
     * @param {Object} file - The file object from database
     * @returns {Promise<{ session_id: string, id: string } | null>}
     */
    const uploadFileToCodeExecutor = async (file) => {
      try {
        const { getDownloadStream } = getStrategyFunctions(file.source);
        const { handleFileUpload: uploadCodeEnvFile } = getStrategyFunctions(
          FileSources.execute_code,
        );
        const stream = await getDownloadStream(options.req, file.filepath);
        const fileIdentifier = await uploadCodeEnvFile({
          req: options.req,
          stream,
          filename: file.filename,
          entity_id: agentId,
          apiKey,
        });

        // Preserve existing metadata when adding fileIdentifier
        const updatedMetadata = {
          ...file.metadata,
          fileIdentifier,
          tool_resource: EToolResources.execute_code,
        };

        await updateFile({
          file_id: file.file_id,
          metadata: updatedMetadata,
        });

        // Use centralized parser to extract session_id and file_id
        const parsed = parseFileIdentifier(fileIdentifier);
        if (!parsed) {
          logger.error(`[primeFiles] Failed to parse newly created fileIdentifier: ${fileIdentifier}`);
          return null;
        }
        
        logger.info(`[primeFiles] Uploaded file ${file.filename} to code executor. Session: ${parsed.session_id}, FileId: ${parsed.file_id}`);
        
        return { session_id: parsed.session_id, id: parsed.file_id };
      } catch (error) {
        logger.error(
          `[primeFiles] Error uploading file ${file.filename} to code executor: ${error.message}`,
          error,
        );
        return null;
      }
    };

    // Handle files that have tool_resource=execute_code but no fileIdentifier
    // This happens when fileIdentifier was deleted or file was categorized by tool_resource metadata
    if (!file.metadata?.fileIdentifier && file.metadata?.tool_resource === EToolResources.execute_code) {
      logger.info(`[primeFiles] File ${file.filename} has tool_resource=execute_code but no fileIdentifier, uploading to code executor`);
      const uploadResult = await uploadFileToCodeExecutor(file);
      if (uploadResult) {
        if (!toolContext) {
          toolContext = `- Note: The following files are available in the "${Tools.execute_code}" tool environment:`;
        }
        toolContext += `\n\t- /mnt/data/${file.filename}${
          agentResourceIds.has(file.file_id) ? '' : ' (just attached by user)'
        }`;
        files.push({
          id: uploadResult.id,
          session_id: uploadResult.session_id,
          name: file.filename,
        });
        sessions.set(uploadResult.session_id, true);
      }
      continue;
    }

    // Handle files with existing fileIdentifier - check if session is still valid
    if (file.metadata?.fileIdentifier) {
      const parsed = parseFileIdentifier(file.metadata.fileIdentifier);
      if (!parsed) {
        logger.warn(`[primeFiles] Could not parse fileIdentifier for ${file.filename}, re-uploading`);
        const uploadResult = await uploadFileToCodeExecutor(file);
        if (uploadResult) {
          if (!toolContext) {
            toolContext = `- Note: The following files are available in the "${Tools.execute_code}" tool environment:`;
          }
          toolContext += `\n\t- /mnt/data/${file.filename}${
            agentResourceIds.has(file.file_id) ? '' : ' (just attached by user)'
          }`;
          files.push({
            id: uploadResult.id,
            session_id: uploadResult.session_id,
            name: file.filename,
          });
          sessions.set(uploadResult.session_id, true);
        }
        continue;
      }

      const { session_id, file_id } = parsed;

      const pushFile = () => {
        if (!toolContext) {
          toolContext = `- Note: The following files are available in the "${Tools.execute_code}" tool environment:`;
        }
        toolContext += `\n\t- /mnt/data/${file.filename}${
          agentResourceIds.has(file.file_id) ? '' : ' (just attached by user)'
        }`;
        files.push({
          id: file_id,  // Use parsed file_id (without query params)
          session_id,
          name: file.filename,
        });
      };

      if (sessions.has(session_id)) {
        pushFile();
        continue;
      }

      const reuploadFile = async () => {
        logger.info(`[primeFiles] Re-uploading file ${file.filename} to code executor (session expired or not found)`);
        const uploadResult = await uploadFileToCodeExecutor(file);
        if (uploadResult) {
          logger.info(`[primeFiles] Re-upload successful. New session: ${uploadResult.session_id}, fileId: ${uploadResult.id}`);
          // Update local variables to use new session/file IDs
          if (!toolContext) {
            toolContext = `- Note: The following files are available in the "${Tools.execute_code}" tool environment:`;
          }
          toolContext += `\n\t- /mnt/data/${file.filename}${
            agentResourceIds.has(file.file_id) ? '' : ' (just attached by user)'
          }`;
          files.push({
            id: uploadResult.id,
            session_id: uploadResult.session_id,
            name: file.filename,
          });
          sessions.set(uploadResult.session_id, true);
        } else {
          logger.error(`[primeFiles] Re-upload failed for file ${file.filename}`);
        }
      };
      
      logger.info(`[primeFiles] Checking session for file ${file.filename} with fileIdentifier: ${file.metadata.fileIdentifier}`);
      const uploadTime = await getSessionInfo(file.metadata.fileIdentifier, apiKey);
      if (!uploadTime) {
        logger.warn(`[primeFiles] Session not found or expired for file ${file.filename} (session: ${session_id}). Re-uploading...`);
        await reuploadFile();
        continue;
      }
      if (!checkIfActive(uploadTime)) {
        logger.warn(`[primeFiles] Session ${session_id} is inactive (uploadTime: ${uploadTime}). Re-uploading...`);
        await reuploadFile();
        continue;
      }
      logger.info(`[primeFiles] Session ${session_id} is active. File ${file.filename} is available.`);
      sessions.set(session_id, true);
      pushFile();
    }
  }

  // Add instruction to USE the code executor for these files
  if (toolContext && files.length > 0) {
    toolContext += `\n\n**IMPORTANT**: To read, analyze, or process these files (SQL, Excel, CSV, JSON, Python, etc.), you MUST use the "${Tools.execute_code}" tool. These files are NOT available through file_search - they can only be accessed by executing code. Write Python code to load and analyze them.`;
  }

  logger.info(`[primeFiles] Completed. Files ready: ${files.length}, toolContext: ${toolContext ? 'yes' : 'no'}`);
  return { files, toolContext };
};

module.exports = {
  primeFiles,
  processCodeOutput,
  parseFileIdentifier,
};
