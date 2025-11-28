/**
 * Unified File Upload Service
 * 
 * This service handles the unified file upload flow:
 * 1. Immediately upload to S3/local storage based on file strategy
 * 2. Route through Intent Analyzer to determine processing strategies
 * 3. Kick off RAG embedding in background for eligible files
 * 4. Maintain a file matrix table tracking processing status
 * 
 * Flow:
 * Upload → Storage → Intent Analysis → Background Processing → Matrix Update
 */

const { v4: uuidv4 } = require('uuid');
const { logger } = require('@librechat/data-schemas');
const { FileSources, FileContext, EToolResources } = require('librechat-data-provider');
const { getStrategyFunctions } = require('./strategies');
const { createFile, updateFile } = require('~/models/File');

/**
 * Upload strategies enum (mirrors intent-analyzer)
 */
const UploadStrategy = {
  IMAGE: 'image',
  CODE_EXECUTOR: 'code_executor',
  FILE_SEARCH: 'file_search',
  TEXT_CONTEXT: 'text_context',
  PROVIDER: 'provider',
};

/**
 * File categories enum (mirrors intent-analyzer)
 */
const FileCategory = {
  IMAGE: 'image',
  DOCUMENT: 'document',
  SPREADSHEET: 'spreadsheet',
  CODE: 'code',
  AUDIO: 'audio',
  VIDEO: 'video',
  ARCHIVE: 'archive',
  UNKNOWN: 'unknown',
};

/**
 * File processing status
 */
const ProcessingStatus = {
  PENDING: 'pending',
  UPLOADING: 'uploading',
  EXTRACTING: 'extracting',
  EMBEDDING: 'embedding',
  COMPLETED: 'completed',
  FAILED: 'failed',
};

/**
 * MIME type patterns for file categorization
 */
const MIME_PATTERNS = {
  images: ['image/'],
  spreadsheets: [
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv',
    'application/csv',
  ],
  code: [
    'text/x-python',
    'application/javascript',
    'text/javascript',
    'application/json',
    'text/x-yaml',
    'application/xml',
  ],
  documents: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'text/markdown',
  ],
  audio: ['audio/'],
};

/**
 * Extension patterns for categorization fallback
 */
const EXTENSION_PATTERNS = {
  images: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp'],
  spreadsheets: ['.xlsx', '.xls', '.csv', '.tsv', '.ods'],
  code: ['.py', '.js', '.ts', '.json', '.yaml', '.yml', '.xml', '.sql', '.sh'],
  documents: ['.pdf', '.doc', '.docx', '.txt', '.md', '.html'],
  audio: ['.mp3', '.wav', '.ogg', '.flac', '.m4a'],
};

/**
 * Categorize file by MIME type and extension
 * @param {Object} file - File object with mimetype and originalname
 * @returns {string} File category
 */
function categorizeFile(file) {
  const mimetype = (file.mimetype || '').toLowerCase();
  const filename = file.originalname || file.filename || '';
  const extension = filename.includes('.') 
    ? '.' + filename.split('.').pop().toLowerCase() 
    : '';

  // Check by MIME type
  if (MIME_PATTERNS.images.some(m => mimetype.startsWith(m))) {
    return FileCategory.IMAGE;
  }
  if (MIME_PATTERNS.spreadsheets.some(m => mimetype.includes(m))) {
    return FileCategory.SPREADSHEET;
  }
  if (MIME_PATTERNS.code.some(m => mimetype.includes(m))) {
    return FileCategory.CODE;
  }
  if (MIME_PATTERNS.documents.some(m => mimetype.includes(m))) {
    return FileCategory.DOCUMENT;
  }
  if (MIME_PATTERNS.audio.some(m => mimetype.startsWith(m))) {
    return FileCategory.AUDIO;
  }

  // Fallback to extension
  if (EXTENSION_PATTERNS.images.includes(extension)) {
    return FileCategory.IMAGE;
  }
  if (EXTENSION_PATTERNS.spreadsheets.includes(extension)) {
    return FileCategory.SPREADSHEET;
  }
  if (EXTENSION_PATTERNS.code.includes(extension)) {
    return FileCategory.CODE;
  }
  if (EXTENSION_PATTERNS.documents.includes(extension)) {
    return FileCategory.DOCUMENT;
  }
  if (EXTENSION_PATTERNS.audio.includes(extension)) {
    return FileCategory.AUDIO;
  }

  // Default: try as document
  if (mimetype.startsWith('text/')) {
    return FileCategory.DOCUMENT;
  }

  return FileCategory.UNKNOWN;
}

/**
 * Determine upload strategy based on file category
 * @param {string} category - File category
 * @returns {Object} Strategy configuration
 */
function getStrategyForCategory(category) {
  const strategies = {
    [FileCategory.IMAGE]: {
      primary: UploadStrategy.IMAGE,
      background: [],
      shouldEmbed: false,
      toolResource: undefined, // Images go to provider
    },
    [FileCategory.SPREADSHEET]: {
      primary: UploadStrategy.CODE_EXECUTOR,
      background: [UploadStrategy.FILE_SEARCH],
      shouldEmbed: true,
      toolResource: EToolResources.execute_code,
    },
    [FileCategory.CODE]: {
      primary: UploadStrategy.CODE_EXECUTOR,
      background: [UploadStrategy.FILE_SEARCH],
      shouldEmbed: true,
      toolResource: EToolResources.execute_code,
    },
    [FileCategory.DOCUMENT]: {
      primary: UploadStrategy.FILE_SEARCH,
      background: [],
      shouldEmbed: true,
      toolResource: EToolResources.file_search,
    },
    [FileCategory.AUDIO]: {
      primary: UploadStrategy.TEXT_CONTEXT,
      background: [UploadStrategy.FILE_SEARCH],
      shouldEmbed: true,
      toolResource: EToolResources.context,
    },
    [FileCategory.VIDEO]: {
      primary: UploadStrategy.PROVIDER,
      background: [],
      shouldEmbed: false,
      toolResource: undefined,
    },
    [FileCategory.ARCHIVE]: {
      primary: UploadStrategy.PROVIDER,
      background: [],
      shouldEmbed: false,
      toolResource: undefined,
    },
    [FileCategory.UNKNOWN]: {
      primary: UploadStrategy.FILE_SEARCH,
      background: [],
      shouldEmbed: true,
      toolResource: EToolResources.file_search,
    },
  };

  return strategies[category] || strategies[FileCategory.UNKNOWN];
}

/**
 * Analyze file attachment and determine routing
 * @param {Object} file - Uploaded file object
 * @param {Object} options - Additional options
 * @returns {Object} Routing result
 */
function analyzeAttachment(file, options = {}) {
  const category = categorizeFile(file);
  const strategy = getStrategyForCategory(category);
  
  // Check for overrides from user selection
  if (options.toolResource) {
    // User explicitly selected a tool resource
    return {
      category,
      ...strategy,
      toolResource: options.toolResource,
      userOverride: true,
    };
  }

  return {
    category,
    ...strategy,
    userOverride: false,
  };
}

/**
 * Create initial file matrix entry
 * @param {Object} params - File parameters
 * @returns {Object} Matrix entry
 */
function createFileMatrixEntry(params) {
  const { file_id, file, category, storageStrategy, storagePath } = params;
  
  return {
    file_id,
    filename: file.originalname || file.filename,
    mimetype: file.mimetype,
    size: file.size,
    category,
    storageStrategy,
    storagePath,
    strategies: {},
    text: null,
    embedded: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

/**
 * Update file matrix entry status
 * @param {string} file_id - File ID
 * @param {string} strategy - Strategy being updated
 * @param {string} status - New status
 * @param {Object} metadata - Additional metadata
 */
async function updateFileMatrixStatus(file_id, strategy, status, metadata = {}) {
  try {
    const updateData = {
      [`metadata.strategies.${strategy}.status`]: status,
      [`metadata.strategies.${strategy}.updatedAt`]: new Date(),
      updatedAt: new Date(),
    };

    if (status === ProcessingStatus.COMPLETED) {
      updateData[`metadata.strategies.${strategy}.completedAt`] = new Date();
    }
    if (metadata.error) {
      updateData[`metadata.strategies.${strategy}.error`] = metadata.error;
    }
    if (metadata.text) {
      updateData.text = metadata.text;
    }
    if (metadata.embedded !== undefined) {
      updateData.embedded = metadata.embedded;
    }

    await updateFile({ file_id, ...updateData });
    logger.debug(`[FileMatrix] Updated ${file_id} strategy ${strategy} to ${status}`);
  } catch (error) {
    logger.error(`[FileMatrix] Failed to update status for ${file_id}:`, error);
  }
}

/**
 * Kick off background RAG processing
 * @param {Object} params - Processing parameters
 */
async function kickOffBackgroundRAG(params) {
  const { req, file, file_id, entity_id } = params;
  
  if (!process.env.RAG_API_URL) {
    logger.warn('[UnifiedUpload] RAG_API_URL not configured, skipping background embedding');
    return;
  }

  try {
    // Update status to extracting
    await updateFileMatrixStatus(file_id, UploadStrategy.FILE_SEARCH, ProcessingStatus.EXTRACTING);

    const { uploadVectors } = require('./VectorDB/crud');
    const result = await uploadVectors({
      req,
      file,
      file_id,
      entity_id,
    });

    // Update with extracted text
    await updateFileMatrixStatus(file_id, UploadStrategy.FILE_SEARCH, ProcessingStatus.EMBEDDING, {
      text: result.text,
    });

    logger.info(`[UnifiedUpload] Background RAG kicked off for ${file_id}`);
    return result;
  } catch (error) {
    await updateFileMatrixStatus(file_id, UploadStrategy.FILE_SEARCH, ProcessingStatus.FAILED, {
      error: error.message,
    });
    logger.error(`[UnifiedUpload] Background RAG failed for ${file_id}:`, error);
    throw error;
  }
}

/**
 * Process unified file upload
 * 
 * Flow:
 * 1. Upload to storage immediately (S3/local)
 * 2. Analyze file and determine strategies
 * 3. Create file record with matrix entry
 * 4. Kick off background processing based on strategies
 * 
 * @param {Object} params - Upload parameters
 * @returns {Promise<Object>} Upload result
 */
async function processUnifiedUpload(params) {
  const { req, file, file_id, metadata = {} } = params;
  const appConfig = req.config;

  // Step 1: Analyze attachment to determine routing
  const analysis = analyzeAttachment(file, {
    toolResource: metadata.tool_resource,
  });
  
  logger.info(`[UnifiedUpload] File ${file_id} categorized as ${analysis.category}, ` +
    `primary strategy: ${analysis.primary}, shouldEmbed: ${analysis.shouldEmbed}`);

  // Step 2: Determine storage strategy
  const isImage = analysis.category === FileCategory.IMAGE;
  const storageStrategy = isImage 
    ? (appConfig.imageStrategy || FileSources.local)
    : (appConfig.fileStrategy || FileSources.local);

  // Step 3: Upload to storage immediately
  const { handleFileUpload } = getStrategyFunctions(storageStrategy);
  
  let storageResult;
  try {
    storageResult = await handleFileUpload({
      req,
      file,
      file_id,
    });
    logger.debug(`[UnifiedUpload] File ${file_id} uploaded to ${storageStrategy}`);
  } catch (error) {
    logger.error(`[UnifiedUpload] Storage upload failed for ${file_id}:`, error);
    throw error;
  }

  // Step 4: Create file record with matrix metadata
  const fileContext = metadata.message_file 
    ? FileContext.message_attachment 
    : FileContext.agents;

  const matrixEntry = createFileMatrixEntry({
    file_id,
    file,
    category: analysis.category,
    storageStrategy,
    storagePath: storageResult.filepath,
  });

  // Initialize strategy statuses
  matrixEntry.strategies[analysis.primary] = {
    status: ProcessingStatus.PENDING,
    startedAt: new Date(),
  };
  
  for (const bgStrategy of analysis.background) {
    matrixEntry.strategies[bgStrategy] = {
      status: ProcessingStatus.PENDING,
    };
  }

  // Step 5: Create file in database
  const fileRecord = await createFile({
    user: req.user.id,
    file_id,
    bytes: storageResult.bytes || file.size,
    filepath: storageResult.filepath,
    filename: file.originalname,
    type: file.mimetype,
    source: storageStrategy,
    context: fileContext,
    embedded: false,
    metadata: {
      category: analysis.category,
      primaryStrategy: analysis.primary,
      backgroundStrategies: analysis.background,
      strategies: matrixEntry.strategies,
    },
  }, true);

  // Step 6: Kick off background processing if eligible
  let extractedText = null;
  if (analysis.shouldEmbed && process.env.RAG_API_URL) {
    // Don't await - let it run in background
    kickOffBackgroundRAG({
      req,
      file,
      file_id,
      entity_id: metadata.agent_id,
    }).then(result => {
      if (result?.text) {
        // Update file with extracted text
        updateFile({
          file_id,
          text: result.text,
          'metadata.strategies.file_search.status': ProcessingStatus.EMBEDDING,
        }).catch(err => logger.error(`[UnifiedUpload] Failed to update text for ${file_id}:`, err));
      }
    }).catch(err => {
      logger.error(`[UnifiedUpload] Background processing failed for ${file_id}:`, err);
    });
  }

  return {
    ...fileRecord,
    analysis: {
      category: analysis.category,
      primaryStrategy: analysis.primary,
      backgroundStrategies: analysis.background,
      shouldEmbed: analysis.shouldEmbed,
    },
  };
}

module.exports = {
  // Main functions
  processUnifiedUpload,
  analyzeAttachment,
  categorizeFile,
  getStrategyForCategory,
  kickOffBackgroundRAG,
  
  // Matrix functions
  createFileMatrixEntry,
  updateFileMatrixStatus,
  
  // Enums
  UploadStrategy,
  FileCategory,
  ProcessingStatus,
  
  // Patterns (for testing/extension)
  MIME_PATTERNS,
  EXTENSION_PATTERNS,
};
