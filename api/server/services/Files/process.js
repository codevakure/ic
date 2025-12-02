const fs = require('fs');
const path = require('path');
const mime = require('mime');
const { v4 } = require('uuid');
const {
  isUUID,
  megabyte,
  FileContext,
  FileSources,
  imageExtRegex,
  EModelEndpoint,
  EToolResources,
  mergeFileConfig,
  AgentCapabilities,
  checkOpenAIStorage,
  removeNullishValues,
  isAssistantsEndpoint,
  getEndpointFileConfig,
} = require('librechat-data-provider');
const { EnvVar } = require('@librechat/agents');
const { logger } = require('@librechat/data-schemas');
const { sanitizeFilename, parseText, processAudioFile } = require('@librechat/api');
const { analyzeUploadIntent, UploadIntent } = require('@librechat/intent-analyzer');
const {
  convertImage,
  resizeAndConvert,
  resizeImageBuffer,
} = require('~/server/services/Files/images');
const { addResourceFileId, deleteResourceFileId } = require('~/server/controllers/assistants/v2');
const { addAgentResourceFile, removeAgentResourceFiles, getAgent } = require('~/models/Agent');
const { getOpenAIClient } = require('~/server/controllers/assistants/helpers');
const { createFile, updateFile, updateFileUsage, deleteFiles } = require('~/models/File');
const { loadAuthValues } = require('~/server/services/Tools/credentials');
const { getFileStrategy } = require('~/server/utils/getFileStrategy');
const { checkCapability } = require('~/server/services/Config');
const { LB_QueueAsyncCall } = require('~/server/utils/queue');
const { getStrategyFunctions } = require('./strategies');
const { deleteVectors } = require('./VectorDB/crud');
const { determineFileType } = require('~/server/utils');
const { STTService } = require('./Audio/STTService');

/**
 * Creates a modular file upload wrapper that ensures filename sanitization
 * across all storage strategies. This prevents storage-specific implementations
 * from having to handle sanitization individually.
 *
 * @param {Function} uploadFunction - The storage strategy's upload function
 * @returns {Function} - Wrapped upload function with sanitization
 */
const createSanitizedUploadWrapper = (uploadFunction) => {
  return async (params) => {
    const { req, file, file_id, ...restParams } = params;

    // Create a modified file object with sanitized original name
    // This ensures consistent filename handling across all storage strategies
    const sanitizedFile = {
      ...file,
      originalname: sanitizeFilename(file.originalname),
    };

    return uploadFunction({ req, file: sanitizedFile, file_id, ...restParams });
  };
};

/**
 *
 * @param {Array<MongoFile>} files
 * @param {Array<string>} [fileIds]
 * @returns
 */
const processFiles = async (files, fileIds) => {
  const promises = [];
  const seen = new Set();

  for (let file of files) {
    const { file_id } = file;
    if (seen.has(file_id)) {
      continue;
    }
    seen.add(file_id);
    promises.push(updateFileUsage({ file_id }));
  }

  if (!fileIds) {
    const results = await Promise.all(promises);
    // Filter out null results from failed updateFileUsage calls
    return results.filter((result) => result != null);
  }

  for (let file_id of fileIds) {
    if (seen.has(file_id)) {
      continue;
    }
    seen.add(file_id);
    promises.push(updateFileUsage({ file_id }));
  }

  // TODO: calculate token cost when image is first uploaded
  const results = await Promise.all(promises);
  // Filter out null results from failed updateFileUsage calls
  return results.filter((result) => result != null);
};

/**
 * Enqueues the delete operation to the leaky bucket queue if necessary, or adds it directly to promises.
 *
 * @param {object} params - The passed parameters.
 * @param {ServerRequest} params.req - The express request object.
 * @param {MongoFile} params.file - The file object to delete.
 * @param {Function} params.deleteFile - The delete file function.
 * @param {Promise[]} params.promises - The array of promises to await.
 * @param {string[]} params.resolvedFileIds - The array of promises to await.
 * @param {OpenAI | undefined} [params.openai] - If an OpenAI file, the initialized OpenAI client.
 */
function enqueueDeleteOperation({ req, file, deleteFile, promises, resolvedFileIds, openai }) {
  if (checkOpenAIStorage(file.source)) {
    // Enqueue to leaky bucket
    promises.push(
      new Promise((resolve, reject) => {
        LB_QueueAsyncCall(
          () => deleteFile(req, file, openai),
          [],
          (err, result) => {
            if (err) {
              logger.error('Error deleting file from OpenAI source', err);
              reject(err);
            } else {
              resolvedFileIds.push(file.file_id);
              resolve(result);
            }
          },
        );
      }),
    );
  } else {
    // Add directly to promises
    promises.push(
      deleteFile(req, file)
        .then(() => resolvedFileIds.push(file.file_id))
        .catch((err) => {
          logger.error('Error deleting file', err);
          return Promise.reject(err);
        }),
    );
  }
}

// TODO: refactor as currently only image files can be deleted this way
// as other filetypes will not reside in public path
/**
 * Deletes a list of files from the server filesystem and the database.
 *
 * @param {Object} params - The params object.
 * @param {MongoFile[]} params.files - The file objects to delete.
 * @param {ServerRequest} params.req - The express request object.
 * @param {DeleteFilesBody} params.req.body - The request body.
 * @param {string} [params.req.body.agent_id] - The agent ID if file uploaded is associated to an agent.
 * @param {string} [params.req.body.assistant_id] - The assistant ID if file uploaded is associated to an assistant.
 * @param {string} [params.req.body.tool_resource] - The tool resource if assistant file uploaded is associated to a tool resource.
 *
 * @returns {Promise<void>}
 */
const processDeleteRequest = async ({ req, files }) => {
  const appConfig = req.config;
  const resolvedFileIds = [];
  const deletionMethods = {};
  const promises = [];

  /** @type {Record<string, OpenAI | undefined>} */
  const client = { [FileSources.openai]: undefined, [FileSources.azure]: undefined };
  const initializeClients = async () => {
    if (appConfig.endpoints?.[EModelEndpoint.assistants]) {
      const openAIClient = await getOpenAIClient({
        req,
        overrideEndpoint: EModelEndpoint.assistants,
      });
      client[FileSources.openai] = openAIClient.openai;
    }

    if (!appConfig.endpoints?.[EModelEndpoint.azureOpenAI]?.assistants) {
      return;
    }

    const azureClient = await getOpenAIClient({
      req,
      overrideEndpoint: EModelEndpoint.azureAssistants,
    });
    client[FileSources.azure] = azureClient.openai;
  };

  if (req.body.assistant_id !== undefined) {
    await initializeClients();
  }

  const agentFiles = [];

  for (const file of files) {
    const source = file.source ?? FileSources.local;
    if (req.body.agent_id && req.body.tool_resource) {
      agentFiles.push({
        tool_resource: req.body.tool_resource,
        file_id: file.file_id,
      });
    }

    // Delete vectors from RAG if file was embedded
    if (file.embedded) {
      promises.push(
        deleteVectors(req, file).catch((err) => {
          logger.error(`[processDeleteRequest] Error deleting vectors for file ${file.file_id}:`, err);
        }),
      );
    }

    if (source === FileSources.text) {
      resolvedFileIds.push(file.file_id);
      continue;
    }

    if (checkOpenAIStorage(source) && !client[source]) {
      await initializeClients();
    }

    const openai = client[source];

    if (req.body.assistant_id && req.body.tool_resource) {
      promises.push(
        deleteResourceFileId({
          req,
          openai,
          file_id: file.file_id,
          assistant_id: req.body.assistant_id,
          tool_resource: req.body.tool_resource,
        }),
      );
    } else if (req.body.assistant_id) {
      promises.push(openai.beta.assistants.files.del(req.body.assistant_id, file.file_id));
    }

    if (deletionMethods[source]) {
      enqueueDeleteOperation({
        req,
        file,
        deleteFile: deletionMethods[source],
        promises,
        resolvedFileIds,
        openai,
      });
      continue;
    }

    const { deleteFile } = getStrategyFunctions(source);
    if (!deleteFile) {
      throw new Error(`Delete function not implemented for ${source}`);
    }

    deletionMethods[source] = deleteFile;
    enqueueDeleteOperation({ req, file, deleteFile, promises, resolvedFileIds, openai });
  }

  if (agentFiles.length > 0) {
    promises.push(
      removeAgentResourceFiles({
        agent_id: req.body.agent_id,
        files: agentFiles,
      }),
    );
  }

  await Promise.allSettled(promises);
  await deleteFiles(resolvedFileIds);
};

/**
 * Processes a file URL using a specified file handling strategy. This function accepts a strategy name,
 * fetches the corresponding file processing functions (for saving and retrieving file URLs), and then
 * executes these functions in sequence. It first saves the file using the provided URL and then retrieves
 * the URL of the saved file. If any error occurs during this process, it logs the error and throws an
 * exception with an appropriate message.
 *
 * @param {Object} params - The parameters object.
 * @param {FileSources} params.fileStrategy - The file handling strategy to use.
 * Must be a value from the `FileSources` enum, which defines different file
 * handling strategies (like saving to Firebase, local storage, etc.).
 * @param {string} params.userId - The user's unique identifier. Used for creating user-specific paths or
 * references in the file handling process.
 * @param {string} params.URL - The URL of the file to be processed.
 * @param {string} params.fileName - The name that will be used to save the file (including extension)
 * @param {string} params.basePath - The base path or directory where the file will be saved or retrieved from.
 * @param {FileContext} params.context - The context of the file (e.g., 'avatar', 'image_generation', etc.)
 * @returns {Promise<MongoFile>} A promise that resolves to the DB representation (MongoFile)
 *  of the processed file. It throws an error if the file processing fails at any stage.
 */
const processFileURL = async ({ fileStrategy, userId, URL, fileName, basePath, context }) => {
  const { saveURL, getFileURL } = getStrategyFunctions(fileStrategy);
  try {
    const {
      bytes = 0,
      type = '',
      dimensions = {},
    } = (await saveURL({ userId, URL, fileName, basePath })) || {};
    const filepath = await getFileURL({ fileName: `${userId}/${fileName}`, basePath });
    return await createFile(
      {
        user: userId,
        file_id: v4(),
        bytes,
        filepath,
        filename: fileName,
        source: fileStrategy,
        type,
        context,
        width: dimensions.width,
        height: dimensions.height,
      },
      true,
    );
  } catch (error) {
    logger.error(`Error while processing the image with ${fileStrategy}:`, error);
    throw new Error(`Failed to process the image with ${fileStrategy}. ${error.message}`);
  }
};

/**
 * Applies the current strategy for image uploads.
 * Saves file metadata to the database with an expiry TTL.
 *
 * @param {Object} params - The parameters object.
 * @param {ServerRequest} params.req - The Express request object.
 * @param {Express.Response} [params.res] - The Express response object.
 * @param {ImageMetadata} params.metadata - Additional metadata for the file.
 * @param {boolean} params.returnFile - Whether to return the file metadata or return response as normal.
 * @returns {Promise<void>}
 */
const processImageFile = async ({ req, res, metadata, returnFile = false }) => {
  const { file } = req;
  const appConfig = req.config;
  const source = getFileStrategy(appConfig, { isImage: true });
  const { handleImageUpload } = getStrategyFunctions(source);
  const { file_id, temp_file_id, endpoint } = metadata;

  const { filepath, bytes, width, height } = await handleImageUpload({
    req,
    file,
    file_id,
    endpoint,
  });

  const result = await createFile(
    {
      user: req.user.id,
      file_id,
      temp_file_id,
      bytes,
      filepath,
      filename: file.originalname,
      context: FileContext.message_attachment,
      source,
      type: `image/${appConfig.imageOutputType}`,
      width,
      height,
    },
    true,
  );

  if (returnFile) {
    return result;
  }
  res.status(200).json({ message: 'File uploaded and processed successfully', ...result });
};

/**
 * Applies the current strategy for image uploads and
 * returns minimal file metadata, without saving to the database.
 *
 * @param {Object} params - The parameters object.
 * @param {ServerRequest} params.req - The Express request object.
 * @param {FileContext} params.context - The context of the file (e.g., 'avatar', 'image_generation', etc.)
 * @param {boolean} [params.resize=true] - Whether to resize and convert the image to target format. Default is `true`.
 * @param {{ buffer: Buffer, width: number, height: number, bytes: number, filename: string, type: string, file_id: string }} [params.metadata] - Required metadata for the file if resize is false.
 * @returns {Promise<{ filepath: string, filename: string, source: string, type: string}>}
 */
const uploadImageBuffer = async ({ req, context, metadata = {}, resize = true }) => {
  const appConfig = req.config;
  const source = getFileStrategy(appConfig, { isImage: true });
  const { saveBuffer } = getStrategyFunctions(source);
  let { buffer, width, height, bytes, filename, file_id, type } = metadata;
  if (resize) {
    file_id = v4();
    type = `image/${appConfig.imageOutputType}`;
    ({ buffer, width, height, bytes } = await resizeAndConvert({
      inputBuffer: buffer,
      desiredFormat: appConfig.imageOutputType,
    }));
    filename = `${path.basename(req.file.originalname, path.extname(req.file.originalname))}.${
      appConfig.imageOutputType
    }`;
  }
  const fileName = `${file_id}-${filename}`;
  const filepath = await saveBuffer({ userId: req.user.id, fileName, buffer });
  return await createFile(
    {
      user: req.user.id,
      file_id,
      bytes,
      filepath,
      filename,
      context,
      source,
      type,
      width,
      height,
    },
    true,
  );
};

/**
 * Applies the current strategy for file uploads.
 * Saves file metadata to the database with an expiry TTL.
 * Files must be deleted from the server filesystem manually.
 *
 * @param {Object} params - The parameters object.
 * @param {ServerRequest} params.req - The Express request object.
 * @param {Express.Response} params.res - The Express response object.
 * @param {FileMetadata} params.metadata - Additional metadata for the file.
 * @returns {Promise<void>}
 */
const processFileUpload = async ({ req, res, metadata }) => {
  const appConfig = req.config;
  const isAssistantUpload = isAssistantsEndpoint(metadata.endpoint);
  const assistantSource =
    metadata.endpoint === EModelEndpoint.azureAssistants ? FileSources.azure : FileSources.openai;
  // Use the configured file strategy for regular file uploads (not vectordb)
  const source = isAssistantUpload ? assistantSource : appConfig.fileStrategy;
  const { handleFileUpload } = getStrategyFunctions(source);
  const { file_id, temp_file_id = null } = metadata;

  /** @type {OpenAI | undefined} */
  let openai;
  if (checkOpenAIStorage(source)) {
    ({ openai } = await getOpenAIClient({ req }));
  }

  const { file } = req;
  const sanitizedUploadFn = createSanitizedUploadWrapper(handleFileUpload);
  const {
    id,
    bytes,
    filename,
    filepath: _filepath,
    embedded,
    height,
    width,
  } = await sanitizedUploadFn({
    req,
    file,
    file_id,
    openai,
  });

  if (isAssistantUpload && !metadata.message_file && !metadata.tool_resource) {
    await openai.beta.assistants.files.create(metadata.assistant_id, {
      file_id: id,
    });
  } else if (isAssistantUpload && !metadata.message_file) {
    await addResourceFileId({
      req,
      openai,
      file_id: id,
      assistant_id: metadata.assistant_id,
      tool_resource: metadata.tool_resource,
    });
  }

  let filepath = isAssistantUpload ? `${openai.baseURL}/files/${id}` : _filepath;
  if (isAssistantUpload && file.mimetype.startsWith('image')) {
    const result = await processImageFile({
      req,
      file,
      metadata: { file_id: v4() },
      returnFile: true,
    });
    filepath = result.filepath;
  }

  const result = await createFile(
    {
      user: req.user.id,
      file_id: id ?? file_id,
      temp_file_id,
      bytes,
      filepath,
      filename: filename ?? sanitizeFilename(file.originalname),
      context: isAssistantUpload ? FileContext.assistants : FileContext.message_attachment,
      model: isAssistantUpload ? req.body.model : undefined,
      type: file.mimetype,
      embedded,
      source,
      height,
      width,
    },
    true,
  );
  res.status(200).json({ message: 'File uploaded and processed successfully', ...result });
};

/**
 * Applies the current strategy for file uploads.
 * Saves file metadata to the database with an expiry TTL.
 * Files must be deleted from the server filesystem manually.
 *
 * @param {Object} params - The parameters object.
 * @param {ServerRequest} params.req - The Express request object.
 * @param {Express.Response} params.res - The Express response object.
 * @param {FileMetadata} params.metadata - Additional metadata for the file.
 * @returns {Promise<void>}
 */
const processAgentFileUpload = async ({ req, res, metadata }) => {
  const { file } = req;
  const appConfig = req.config;
  const { agent_id, file_id, temp_file_id = null } = metadata;
  let { tool_resource } = metadata;

  let messageAttachment = !!metadata.message_file;

  // Auto-detect tool_resource using intent analyzer for message attachments
  // This enables the single "Add Photos & Files" button in the UI
  if (messageAttachment && !tool_resource) {
    const uploadIntent = analyzeUploadIntent({
      filename: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
    });
    
    logger.info(`[processAgentFileUpload] Intent analysis for ${file.originalname}: ${uploadIntent.intent}`);
    
    // Map intent to tool_resource
    if (uploadIntent.intent === UploadIntent.CODE_INTERPRETER) {
      tool_resource = EToolResources.execute_code;
      logger.info(`[processAgentFileUpload] Routing ${file.originalname} to Code Interpreter`);
    } else if (uploadIntent.intent === UploadIntent.FILE_SEARCH) {
      tool_resource = EToolResources.file_search;
      logger.info(`[processAgentFileUpload] Routing ${file.originalname} to File Search`);
    } else {
      logger.info(`[processAgentFileUpload] Routing ${file.originalname} as Image (no tool_resource)`);
    }
  }

  if (agent_id && !tool_resource && !messageAttachment) {
    throw new Error('No tool resource provided for agent file upload');
  }

  if (tool_resource === EToolResources.file_search && file.mimetype.startsWith('image')) {
    throw new Error('Image uploads are not supported for file search tool resources');
  }

  if (!messageAttachment && !agent_id) {
    throw new Error('No agent ID provided for agent file upload');
  }

  const isImage = file.mimetype.startsWith('image');
  let fileInfoMetadata;
  const entity_id = messageAttachment === true ? undefined : agent_id;
  const basePath = mime.getType(file.originalname)?.startsWith('image') ? 'images' : 'uploads';
  if (tool_resource === EToolResources.execute_code) {
    const isCodeEnabled = await checkCapability(req, AgentCapabilities.execute_code);
    if (!isCodeEnabled) {
      throw new Error('Code execution is not enabled for Agents');
    }
    const { handleFileUpload: uploadCodeEnvFile } = getStrategyFunctions(FileSources.execute_code);
    const result = await loadAuthValues({ userId: req.user.id, authFields: [EnvVar.CODE_API_KEY] });
    const stream = fs.createReadStream(file.path);
    const fileIdentifier = await uploadCodeEnvFile({
      req,
      stream,
      filename: file.originalname,
      apiKey: result[EnvVar.CODE_API_KEY],
      entity_id,
    });
    // Store both fileIdentifier AND tool_resource so we can re-upload if session expires
    fileInfoMetadata = { fileIdentifier, tool_resource: EToolResources.execute_code };
    logger.info(`[processAgentFileUpload] Code executor upload successful. fileIdentifier: ${fileIdentifier}`);
    logger.info(`[processAgentFileUpload] Initial metadata set: ${JSON.stringify(fileInfoMetadata)}`);
  } else if (tool_resource === EToolResources.file_search) {
    const isFileSearchEnabled = await checkCapability(req, AgentCapabilities.file_search);
    if (!isFileSearchEnabled) {
      throw new Error('File search is not enabled for Agents');
    }

    // DUAL-UPLOAD LOGIC: If agent has execute_code enabled and file is code-suitable,
    // also upload to code executor so it can be used by code interpreter
    if (agent_id) {
      try {
        const agent = await getAgent({ id: agent_id });
        const hasExecuteCode = agent?.tools?.includes('execute_code') || agent?.tools?.includes(EToolResources.execute_code);
        const isCodeEnabled = await checkCapability(req, AgentCapabilities.execute_code);
        
        if (hasExecuteCode && isCodeEnabled) {
          // Check if file is suitable for code execution using intent analyzer
          const uploadIntent = analyzeUploadIntent({
            filename: file.originalname,
            mimetype: file.mimetype,
            size: file.size,
          });
          
          const isCodeSuitable = uploadIntent.intent === UploadIntent.CODE_INTERPRETER;
          
          if (isCodeSuitable) {
            logger.info(`[processAgentFileUpload] File ${file.originalname} is code-suitable and agent has execute_code. Dual-uploading to code executor.`);
            
            const { handleFileUpload: uploadCodeEnvFile } = getStrategyFunctions(FileSources.execute_code);
            const result = await loadAuthValues({ userId: req.user.id, authFields: [EnvVar.CODE_API_KEY] });
            const stream = fs.createReadStream(file.path);
            const fileIdentifier = await uploadCodeEnvFile({
              req,
              stream,
              filename: file.originalname,
              apiKey: result[EnvVar.CODE_API_KEY],
              entity_id,
            });
            
            // Store fileIdentifier in metadata - this file is now available to BOTH file_search and execute_code
            fileInfoMetadata = { fileIdentifier, tool_resource: EToolResources.file_search };
            logger.info(`[processAgentFileUpload] Dual-upload successful. fileIdentifier: ${fileIdentifier}`);
          } else {
            logger.info(`[processAgentFileUpload] File ${file.originalname} is not code-suitable (intent: ${uploadIntent.intent}). Skipping code executor upload.`);
          }
        }
      } catch (error) {
        logger.warn(`[processAgentFileUpload] Error checking agent for dual-upload: ${error.message}. Continuing with file_search only.`);
      }
    }
    // Note: File search processing continues to dual storage logic below
  } else if (tool_resource === EToolResources.context) {
    const { file_id, temp_file_id = null } = metadata;

    /**
     * @param {object} params
     * @param {string} params.text
     * @param {number} params.bytes
     * @param {string} params.filepath
     * @param {string} params.type
     * @return {Promise<void>}
     */
    const createTextFile = async ({ text, bytes, filepath, type = 'text/plain' }) => {
      const fileInfo = removeNullishValues({
        text,
        bytes,
        file_id,
        temp_file_id,
        user: req.user.id,
        type,
        filepath: filepath ?? file.path,
        source: FileSources.text,
        filename: file.originalname,
        model: messageAttachment ? undefined : req.body.model,
        context: messageAttachment ? FileContext.message_attachment : FileContext.agents,
      });

      if (!messageAttachment && tool_resource) {
        await addAgentResourceFile({
          req,
          file_id,
          agent_id,
          tool_resource,
        });
      }
      const result = await createFile(fileInfo, true);
      return res
        .status(200)
        .json({ message: 'Agent file uploaded and processed successfully', ...result });
    };

    const fileConfig = mergeFileConfig(appConfig.fileConfig);

    const shouldUseOCR =
      appConfig?.ocr != null &&
      fileConfig.checkType(file.mimetype, fileConfig.ocr?.supportedMimeTypes || []);

    if (shouldUseOCR && !(await checkCapability(req, AgentCapabilities.ocr))) {
      throw new Error('OCR capability is not enabled for Agents');
    } else if (shouldUseOCR) {
      try {
        const { handleFileUpload: uploadOCR } = getStrategyFunctions(
          appConfig?.ocr?.strategy ?? FileSources.mistral_ocr,
        );
        const {
          text,
          bytes,
          filepath: ocrFileURL,
        } = await uploadOCR({ req, file, loadAuthValues });
        return await createTextFile({ text, bytes, filepath: ocrFileURL });
      } catch (ocrError) {
        logger.error(
          `[processAgentFileUpload] OCR processing failed for file "${file.originalname}", falling back to text extraction:`,
          ocrError,
        );
      }
    }

    const shouldUseSTT = fileConfig.checkType(
      file.mimetype,
      fileConfig.stt?.supportedMimeTypes || [],
    );

    if (shouldUseSTT) {
      const sttService = await STTService.getInstance();
      const { text, bytes } = await processAudioFile({ req, file, sttService });
      return await createTextFile({ text, bytes });
    }

    const shouldUseText = fileConfig.checkType(
      file.mimetype,
      fileConfig.text?.supportedMimeTypes || [],
    );

    if (!shouldUseText) {
      throw new Error(`File type ${file.mimetype} is not supported for text parsing.`);
    }

    const { text, bytes } = await parseText({ req, file, file_id });
    return await createTextFile({ text, bytes, type: file.mimetype });
  }

  // For file_search OR message attachments (non-image documents): Extract text for context
  // This allows immediate context use while embedding happens in background
  const isImageFile = file.mimetype.startsWith('image');
  const source = getFileStrategy(appConfig, { isImage: isImageFile });
  let extractedText = null;
  let embedded = false;

  // File types routed to execute_code that don't need RAG text extraction
  // These are better analyzed programmatically than with semantic search
  const skipEmbeddingExtensions = [
    // Spreadsheets - pandas/openpyxl handles these better
    '.xlsx', '.xls', '.csv', '.tsv',
    // Structured data - code parsing is more accurate
    '.json', '.xml', '.yaml', '.yml',
    // Archives - need code to extract
    '.zip', '.tar', '.gz', '.tgz', '.7z', '.rar',
    // Code files - code execution/analysis is better than semantic search
    '.py', '.js', '.ts', '.jsx', '.tsx', '.mjs', '.cjs',
    '.java', '.c', '.cpp', '.h', '.hpp', '.cs',
    '.go', '.rs', '.rb', '.php', '.swift', '.kt', '.scala',
    '.sh', '.bash', '.zsh', '.ps1', '.bat', '.cmd',
    '.sql', '.r', '.m', '.jl',
    '.html', '.css', '.scss', '.sass', '.less',
    '.vue', '.svelte', '.astro',
    // Config files
    '.toml', '.ini', '.cfg', '.conf', '.env',
    // Notebooks
    '.ipynb',
  ];
  const isCodeOrDataFile = skipEmbeddingExtensions.some(ext => 
    file.originalname.toLowerCase().endsWith(ext)
  );
  const isExecuteCodeFile = tool_resource === EToolResources.execute_code && isCodeOrDataFile;

  // Extract text for:
  // 1. file_search tool resources (explicit file search uploads)
  // 2. message attachments that are documents (not images) - so LLM can read them
  // SKIP: Code/data files routed to execute_code (code executor reads them directly)
  const shouldExtractText = 
    !isExecuteCodeFile && (
      tool_resource === EToolResources.file_search || 
      (messageAttachment && !isImageFile)
    );

  if (isExecuteCodeFile) {
    logger.info(`[processAgentFileUpload] Skipping text extraction for ${file.originalname} - code/data file routed to execute_code`);
  }

  if (shouldExtractText) {
    // Check if RAG API is available
    if (!process.env.RAG_API_URL) {
      logger.warn(`[processAgentFileUpload] RAG_API_URL not configured, skipping text extraction for file ${file_id}`);
      fileInfoMetadata = {};
    } else {
      const { uploadVectors } = require('./VectorDB/crud');

      try {
        logger.debug(`[processAgentFileUpload] Starting text extraction for file ${file_id} (messageAttachment: ${messageAttachment})`);
        
        // FIRST: Call RAG API to extract text immediately
        // User can start querying once this completes
        // Embedding happens in background on RAG API side
        const embeddingResult = await uploadVectors({
          req,
          file,
          file_id,
          entity_id,
        });

        // Store extracted text in `text` field (same pattern as EToolResources.context)
        // This allows the text to be used as context immediately while embedding runs in background
        extractedText = embeddingResult.text;
        
        // Store metadata (but NOT the text - that goes in `text` field)
        // IMPORTANT: Merge with existing fileInfoMetadata to preserve fileIdentifier for code executor
        fileInfoMetadata = {
          ...fileInfoMetadata,
          char_count: embeddingResult.char_count,
          extraction_time: embeddingResult.extraction_time,
        };

        // embedded=false initially - RAG API is embedding in background
        embedded = embeddingResult.embedded || false;

        logger.info(
          `[processAgentFileUpload] Text extraction complete for file ${file_id}: ` +
          `${embeddingResult.char_count || 0} chars in ${embeddingResult.extraction_time || 0}s. ` +
          `messageAttachment: ${messageAttachment}. User can now query. Embedding in background.`
        );

      } catch (error) {
        logger.error(`[processAgentFileUpload] Text extraction failed for file ${file_id}:`, error);
        // For message attachments, don't throw - just log and continue without text
        // For file_search, throw error since text is essential
        if (tool_resource === EToolResources.file_search) {
          throw new Error(`Failed to extract text from file: ${error.message}`);
        }
        // IMPORTANT: Merge with existing fileInfoMetadata to preserve fileIdentifier for code executor
        fileInfoMetadata = { ...fileInfoMetadata, extraction_error: error.message };
      }
    }
  }

  // SECOND: Upload to Storage (S3/local/etc.) after text is extracted
  let storageResult;
  const { handleFileUpload } = getStrategyFunctions(source);
  const sanitizedUploadFn = createSanitizedUploadWrapper(handleFileUpload);
  storageResult = await sanitizedUploadFn({
    req,
    file,
    file_id,
    basePath,
    entity_id,
  });

  let { bytes, filename, filepath: _filepath, height, width } = storageResult;
  if (storageResult.embedded != null) {
    embedded = storageResult.embedded;
  }
  let filepath = _filepath;

  if (!messageAttachment && tool_resource) {
    await addAgentResourceFile({
      req,
      file_id,
      agent_id,
      tool_resource,
    });
  }

  if (isImage) {
    const result = await processImageFile({
      req,
      file,
      metadata: { file_id: v4() },
      returnFile: true,
    });
    filepath = result.filepath;
  }

  const fileInfo = removeNullishValues({
    user: req.user.id,
    file_id,
    temp_file_id,
    bytes,
    filepath,
    filename: filename ?? sanitizeFilename(file.originalname),
    context: messageAttachment ? FileContext.message_attachment : FileContext.agents,
    model: messageAttachment ? undefined : req.body.model,
    metadata: fileInfoMetadata,
    type: file.mimetype,
    embedded,
    source,
    height,
    width,
    // Store extracted text in `text` field (same pattern as EToolResources.context)
    // This allows file_search files to be used as context immediately
    text: extractedText,
  });

  // Log the final metadata to verify fileIdentifier is preserved
  if (fileInfoMetadata?.fileIdentifier) {
    logger.info(`[processAgentFileUpload] Final metadata includes fileIdentifier: ${fileInfoMetadata.fileIdentifier}`);
  }
  if (fileInfoMetadata?.tool_resource) {
    logger.info(`[processAgentFileUpload] Final metadata includes tool_resource: ${fileInfoMetadata.tool_resource}`);
  }
  logger.debug(`[processAgentFileUpload] Final metadata: ${JSON.stringify(fileInfoMetadata)}`);

  const result = await createFile(fileInfo, true);

  res.status(200).json({ message: 'Agent file uploaded and processed successfully', ...result });
};

/**
 * @param {object} params - The params object.
 * @param {OpenAI} params.openai - The OpenAI client instance.
 * @param {string} params.file_id - The ID of the file to retrieve.
 * @param {string} params.userId - The user ID.
 * @param {string} [params.filename] - The name of the file. `undefined` for `file_citation` annotations.
 * @param {boolean} [params.saveFile=false] - Whether to save the file metadata to the database.
 * @param {boolean} [params.updateUsage=false] - Whether to update file usage in database.
 */
const processOpenAIFile = async ({
  openai,
  file_id,
  userId,
  filename,
  saveFile = false,
  updateUsage = false,
}) => {
  const _file = await openai.files.retrieve(file_id);
  const originalName = filename ?? (_file.filename ? path.basename(_file.filename) : undefined);
  const filepath = `${openai.baseURL}/files/${userId}/${file_id}${
    originalName ? `/${originalName}` : ''
  }`;
  const type = mime.getType(originalName ?? file_id);
  const source =
    openai.req.body.endpoint === EModelEndpoint.azureAssistants
      ? FileSources.azure
      : FileSources.openai;
  const file = {
    ..._file,
    type,
    file_id,
    filepath,
    usage: 1,
    user: userId,
    context: _file.purpose,
    source,
    model: openai.req.body.model,
    filename: originalName ?? file_id,
  };

  if (saveFile) {
    await createFile(file, true);
  } else if (updateUsage) {
    try {
      await updateFileUsage({ file_id });
    } catch (error) {
      logger.error('Error updating file usage', error);
    }
  }

  return file;
};

/**
 * Process OpenAI image files, convert to target format, save and return file metadata.
 * @param {object} params - The params object.
 * @param {ServerRequest} params.req - The Express request object.
 * @param {Buffer} params.buffer - The image buffer.
 * @param {string} params.file_id - The file ID.
 * @param {string} params.filename - The filename.
 * @param {string} params.fileExt - The file extension.
 * @returns {Promise<MongoFile>} The file metadata.
 */
const processOpenAIImageOutput = async ({ req, buffer, file_id, filename, fileExt }) => {
  const currentDate = new Date();
  const formattedDate = currentDate.toISOString();
  const appConfig = req.config;
  const _file = await convertImage(req, buffer, undefined, `${file_id}${fileExt}`);

  // Create only one file record with the correct information
  const file = {
    ..._file,
    usage: 1,
    user: req.user.id,
    type: mime.getType(fileExt),
    createdAt: formattedDate,
    updatedAt: formattedDate,
    source: getFileStrategy(appConfig, { isImage: true }),
    context: FileContext.assistants_output,
    file_id,
    filename,
  };
  createFile(file, true);
  return file;
};

/**
 * Retrieves and processes an OpenAI file based on its type.
 *
 * @param {Object} params - The params passed to the function.
 * @param {OpenAIClient} params.openai - The OpenAI client instance.
 * @param {RunClient} params.client - The LibreChat client instance: either refers to `openai` or `streamRunManager`.
 * @param {string} params.file_id - The ID of the file to retrieve.
 * @param {string} [params.basename] - The basename of the file (if image); e.g., 'image.jpg'. `undefined` for `file_citation` annotations.
 * @param {boolean} [params.unknownType] - Whether the file type is unknown.
 * @returns {Promise<{file_id: string, filepath: string, source: string, bytes?: number, width?: number, height?: number} | null>}
 * - Returns null if `file_id` is not defined; else, the file metadata if successfully retrieved and processed.
 */
async function retrieveAndProcessFile({
  openai,
  client,
  file_id,
  basename: _basename,
  unknownType,
}) {
  if (!file_id) {
    return null;
  }

  let basename = _basename;
  const processArgs = { openai, file_id, filename: basename, userId: client.req.user.id };

  // If no basename provided, return only the file metadata
  if (!basename) {
    return await processOpenAIFile({ ...processArgs, saveFile: true });
  }

  const fileExt = path.extname(basename);
  if (client.attachedFileIds?.has(file_id) || client.processedFileIds?.has(file_id)) {
    return processOpenAIFile({ ...processArgs, updateUsage: true });
  }

  /**
   * @returns {Promise<Buffer>} The file data buffer.
   */
  const getDataBuffer = async () => {
    const response = await openai.files.content(file_id);
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  };

  let dataBuffer;
  if (unknownType || !fileExt || imageExtRegex.test(basename)) {
    try {
      dataBuffer = await getDataBuffer();
    } catch (error) {
      logger.error('Error downloading file from OpenAI:', error);
      dataBuffer = null;
    }
  }

  if (!dataBuffer) {
    return await processOpenAIFile({ ...processArgs, saveFile: true });
  }

  // If the filetype is unknown, inspect the file
  if (dataBuffer && (unknownType || !fileExt)) {
    const detectedExt = await determineFileType(dataBuffer);
    const isImageOutput = detectedExt && imageExtRegex.test('.' + detectedExt);

    if (!isImageOutput) {
      return await processOpenAIFile({ ...processArgs, saveFile: true });
    }

    return await processOpenAIImageOutput({
      file_id,
      req: client.req,
      buffer: dataBuffer,
      filename: basename,
      fileExt: detectedExt,
    });
  } else if (dataBuffer && imageExtRegex.test(basename)) {
    return await processOpenAIImageOutput({
      file_id,
      req: client.req,
      buffer: dataBuffer,
      filename: basename,
      fileExt,
    });
  } else {
    logger.debug(`[retrieveAndProcessFile] Non-image file type detected: ${basename}`);
    return await processOpenAIFile({ ...processArgs, saveFile: true });
  }
}

/**
 * Converts a base64 string to a buffer.
 * @param {string} base64String
 * @returns {Buffer<ArrayBufferLike>}
 */
function base64ToBuffer(base64String) {
  try {
    const typeMatch = base64String.match(/^data:([A-Za-z-+/]+);base64,/);
    const type = typeMatch ? typeMatch[1] : '';

    const base64Data = base64String.replace(/^data:([A-Za-z-+/]+);base64,/, '');

    if (!base64Data) {
      throw new Error('Invalid base64 string');
    }

    return {
      buffer: Buffer.from(base64Data, 'base64'),
      type,
    };
  } catch (error) {
    throw new Error(`Failed to convert base64 to buffer: ${error.message}`);
  }
}

async function saveBase64Image(
  url,
  { req, file_id: _file_id, filename: _filename, endpoint, context, resolution },
) {
  const appConfig = req.config;
  const effectiveResolution = resolution ?? appConfig.fileConfig?.imageGeneration ?? 'high';
  const file_id = _file_id ?? v4();
  let filename = `${file_id}-${_filename}`;
  const { buffer: inputBuffer, type } = base64ToBuffer(url);
  if (!path.extname(_filename)) {
    const extension = mime.getExtension(type);
    if (extension) {
      filename += `.${extension}`;
    } else {
      throw new Error(`Could not determine file extension from MIME type: ${type}`);
    }
  }

  const image = await resizeImageBuffer(inputBuffer, effectiveResolution, endpoint);
  const source = getFileStrategy(appConfig, { isImage: true });
  const { saveBuffer } = getStrategyFunctions(source);
  const filepath = await saveBuffer({
    userId: req.user.id,
    fileName: filename,
    buffer: image.buffer,
  });
  return await createFile(
    {
      type,
      source,
      context,
      file_id,
      filepath,
      filename,
      user: req.user.id,
      bytes: image.bytes,
      width: image.width,
      height: image.height,
    },
    true,
  );
}

/**
 * Filters a file based on its size and the endpoint origin.
 *
 * @param {Object} params - The parameters for the function.
 * @param {ServerRequest} params.req - The request object from Express.
 * @param {string} [params.req.endpoint]
 * @param {string} [params.req.file_id]
 * @param {number} [params.req.width]
 * @param {number} [params.req.height]
 * @param {number} [params.req.version]
 * @param {boolean} [params.image] - Whether the file expected is an image.
 * @param {boolean} [params.isAvatar] - Whether the file expected is a user or entity avatar.
 * @returns {void}
 *
 * @throws {Error} If a file exception is caught (invalid file size or type, lack of metadata).
 */
function filterFile({ req, image, isAvatar }) {
  const { file } = req;
  const { endpoint, endpointType, file_id, width, height } = req.body;

  if (!file_id && !isAvatar) {
    throw new Error('No file_id provided');
  }

  if (file.size === 0) {
    throw new Error('Empty file uploaded');
  }

  /* parse to validate api call, throws error on fail */
  if (!isAvatar) {
    isUUID.parse(file_id);
  }

  if (!endpoint && !isAvatar) {
    throw new Error('No endpoint provided');
  }

  const appConfig = req.config;
  const fileConfig = mergeFileConfig(appConfig.fileConfig);

  const endpointFileConfig = getEndpointFileConfig({
    endpoint,
    fileConfig,
    endpointType,
  });
  const fileSizeLimit =
    isAvatar === true ? fileConfig.avatarSizeLimit : endpointFileConfig.fileSizeLimit;

  if (file.size > fileSizeLimit) {
    throw new Error(
      `File size limit of ${fileSizeLimit / megabyte} MB exceeded for ${
        isAvatar ? 'avatar upload' : `${endpoint} endpoint`
      }`,
    );
  }

  const isSupportedMimeType = fileConfig.checkType(
    file.mimetype,
    endpointFileConfig.supportedMimeTypes,
  );

  if (!isSupportedMimeType) {
    throw new Error('Unsupported file type');
  }

  if (!image || isAvatar === true) {
    return;
  }

  if (!width) {
    throw new Error('No width provided');
  }

  if (!height) {
    throw new Error('No height provided');
  }
}

module.exports = {
  filterFile,
  processFiles,
  processFileURL,
  saveBase64Image,
  processImageFile,
  uploadImageBuffer,
  processFileUpload,
  processDeleteRequest,
  processAgentFileUpload,
  retrieveAndProcessFile,
};
