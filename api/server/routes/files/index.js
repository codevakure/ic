const express = require('express');
const jwt = require('jsonwebtoken');
const { logger } = require('@ranger/data-schemas');
const {
  createFileLimiters,
  configMiddleware,
  requireJwtAuth,
  uaParser,
  checkBan,
} = require('~/server/middleware');
const { avatar: asstAvatarRouter } = require('~/server/routes/assistants/v1');
const { avatar: agentAvatarRouter } = require('~/server/routes/agents/v1');
const { createMulterInstance } = require('./multer');
const { updateFile } = require('~/models/File');

const files = require('./files');
const images = require('./images');
const avatar = require('./avatar');
const speech = require('./speech');

const initialize = async () => {
  const router = express.Router();

  /**
   * Webhook endpoint for RAG API to notify when embedding completes
   * This endpoint is BEFORE auth middleware to allow service-to-service calls
   * It uses JWT verification with the shared secret for security
   * @route POST /files/embedding-complete
   */
  router.post('/embedding-complete', async (req, res) => {
    try {
      // Verify JWT token from Authorization header using shared secret
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        logger.warn('[embedding-complete] Missing or invalid Authorization header');
        return res.status(401).json({ error: 'Missing or invalid Authorization header' });
      }

      const token = authHeader.split(' ')[1];
      const jwtSecret = process.env.JWT_SECRET;

      if (!jwtSecret) {
        logger.error('[embedding-complete] JWT_SECRET not configured');
        return res.status(500).json({ error: 'Server configuration error' });
      }

      try {
        // Verify token - we don't need user info, just verify it's valid
        jwt.verify(token, jwtSecret);
      } catch (jwtError) {
        logger.warn(`[embedding-complete] Invalid JWT token: ${jwtError.message}`);
        return res.status(401).json({ error: 'Invalid token' });
      }

      const { file_id, embedded, error } = req.body;

      if (!file_id) {
        return res.status(400).json({ error: 'file_id is required' });
      }

      // Update file in MongoDB
      const result = await updateFile({
        file_id,
        embedded: embedded ?? true,
        ...(error && { 'metadata.embedding_error': error }),
      });

      if (!result) {
        logger.warn(`[embedding-complete] File not found: ${file_id}`);
        return res.status(404).json({ error: 'File not found' });
      }

      logger.info(
        `[embedding-complete] File ${file_id} embedding status updated: embedded=${embedded ?? true}`,
      );
      res.status(200).json({ success: true, file_id });
    } catch (error) {
      logger.error('[embedding-complete] Error updating embedding status:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Apply auth middleware for all other routes
  router.use(requireJwtAuth);
  router.use(configMiddleware);
  router.use(checkBan);
  router.use(uaParser);

  const upload = await createMulterInstance();
  router.post('/speech/stt', upload.single('audio'));

  /* Important: speech route must be added before the upload limiters */
  router.use('/speech', speech);

  const { fileUploadIpLimiter, fileUploadUserLimiter } = createFileLimiters();
  router.post('*', fileUploadIpLimiter, fileUploadUserLimiter);
  router.post('/', upload.single('file'));
  router.post('/images', upload.single('file'));
  router.post('/images/avatar', upload.single('file'));
  router.post('/images/agents/:agent_id/avatar', upload.single('file'));
  router.post('/images/assistants/:assistant_id/avatar', upload.single('file'));

  router.use('/', files);
  router.use('/images', images);
  router.use('/images/avatar', avatar);
  router.use('/images/agents', agentAvatarRouter);
  router.use('/images/assistants', asstAvatarRouter);
  return router;
};

module.exports = { initialize };
