/**
 * Admin System Service
 * 
 * Service for system health and configuration information.
 */

const os = require('os');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { logger } = require('@ranger/data-schemas');

/**
 * Get system health status
 */
const getHealthStatus = async () => {
  try {
    // MongoDB connection status
    const mongoStatus = mongoose.connection.readyState;
    const mongoStatusMap = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting',
    };

    // System metrics
    const uptime = process.uptime();
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    // OS metrics
    const osMetrics = {
      platform: os.platform(),
      arch: os.arch(),
      hostname: os.hostname(),
      totalMemory: os.totalmem(),
      freeMemory: os.freemem(),
      cpuCount: os.cpus().length,
      loadAverage: os.loadavg(),
      uptime: os.uptime(),
    };

    // Node.js info
    const nodeInfo = {
      version: process.version,
      env: process.env.NODE_ENV || 'development',
    };

    return {
      status: mongoStatus === 1 ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      services: {
        mongodb: {
          status: mongoStatusMap[mongoStatus] || 'unknown',
          connected: mongoStatus === 1,
        },
        api: {
          status: 'running',
          uptime: Math.floor(uptime),
          uptimeFormatted: formatUptime(uptime),
        },
      },
      process: {
        memory: {
          heapUsed: memoryUsage.heapUsed,
          heapTotal: memoryUsage.heapTotal,
          rss: memoryUsage.rss,
          external: memoryUsage.external,
          heapUsedMB: Math.round(memoryUsage.heapUsed / 1024 / 1024),
          heapTotalMB: Math.round(memoryUsage.heapTotal / 1024 / 1024),
          rssMB: Math.round(memoryUsage.rss / 1024 / 1024),
        },
        cpu: {
          user: cpuUsage.user,
          system: cpuUsage.system,
        },
        pid: process.pid,
      },
      system: {
        platform: osMetrics.platform,
        arch: osMetrics.arch,
        hostname: osMetrics.hostname,
        cpuCount: osMetrics.cpuCount,
        loadAverage: osMetrics.loadAverage,
        memory: {
          total: osMetrics.totalMemory,
          free: osMetrics.freeMemory,
          used: osMetrics.totalMemory - osMetrics.freeMemory,
          usedPercent: ((osMetrics.totalMemory - osMetrics.freeMemory) / osMetrics.totalMemory * 100).toFixed(2),
          totalGB: (osMetrics.totalMemory / 1024 / 1024 / 1024).toFixed(2),
          freeGB: (osMetrics.freeMemory / 1024 / 1024 / 1024).toFixed(2),
        },
        uptime: osMetrics.uptime,
        uptimeFormatted: formatUptime(osMetrics.uptime),
      },
      node: nodeInfo,
    };
  } catch (error) {
    logger.error('[Admin SystemService] Error getting health status:', error);
    throw error;
  }
};

/**
 * Format uptime in human-readable format
 */
const formatUptime = (seconds) => {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);

  return parts.join(' ');
};

/**
 * Get system configuration (non-sensitive values only)
 */
const getSystemConfig = async () => {
  try {
    // Only expose non-sensitive configuration
    const config = {
      environment: process.env.NODE_ENV || 'development',
      port: process.env.PORT || 3080,
      host: process.env.HOST || 'localhost',
      features: {
        socialLogin: process.env.ALLOW_SOCIAL_LOGIN === 'true',
        registration: process.env.ALLOW_REGISTRATION !== 'false',
        emailVerification: process.env.EMAIL_VERIFICATION === 'true',
        compression: process.env.DISABLE_COMPRESSION !== 'true',
        balance: process.env.CHECK_BALANCE === 'true',
      },
      limits: {
        importSizeLimit: process.env.IMPORT_SIZE_LIMIT || '3mb',
        maxJsonSize: '3mb',
      },
      version: {
        node: process.version,
        api: getPackageVersion(),
      },
    };

    return config;
  } catch (error) {
    logger.error('[Admin SystemService] Error getting system config:', error);
    throw error;
  }
};

/**
 * Get package version from package.json
 */
const getPackageVersion = () => {
  try {
    const packagePath = path.resolve(__dirname, '../../../../../package.json');
    if (fs.existsSync(packagePath)) {
      const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
      return packageJson.version || 'unknown';
    }
    return 'unknown';
  } catch (error) {
    return 'unknown';
  }
};

/**
 * Get recent logs (placeholder - would need log file access or logging service integration)
 */
const getRecentLogs = async ({ level = 'all', limit = 100, offset = 0 }) => {
  try {
    // This is a placeholder implementation
    // In a real implementation, you would:
    // 1. Read from log files
    // 2. Query a logging service (e.g., Datadog, CloudWatch)
    // 3. Use a database-backed logging system

    const logsPath = path.resolve(__dirname, '../../../../../logs');
    const logs = [];

    // Check if logs directory exists
    if (fs.existsSync(logsPath)) {
      const logFiles = fs.readdirSync(logsPath)
        .filter(f => f.endsWith('.log'))
        .sort()
        .reverse();

      if (logFiles.length > 0) {
        // Read the most recent log file
        const recentLogFile = path.join(logsPath, logFiles[0]);
        const content = fs.readFileSync(recentLogFile, 'utf8');
        const lines = content.split('\n').filter(l => l.trim());
        
        // Parse and return recent entries
        const startIndex = Math.max(0, lines.length - offset - limit);
        const endIndex = lines.length - offset;
        
        for (let i = startIndex; i < endIndex; i++) {
          try {
            const parsed = JSON.parse(lines[i]);
            if (level === 'all' || parsed.level === level) {
              logs.push(parsed);
            }
          } catch {
            // If not JSON, include as raw message
            logs.push({
              message: lines[i],
              timestamp: new Date().toISOString(),
              level: 'info',
            });
          }
        }
      }
    }

    return {
      logs: logs.reverse(), // Most recent first
      pagination: {
        limit,
        offset,
        hasMore: logs.length === limit,
      },
      note: 'Log retrieval is limited. Consider using a dedicated logging service for production.',
    };
  } catch (error) {
    logger.error('[Admin SystemService] Error getting logs:', error);
    return {
      logs: [],
      error: 'Unable to retrieve logs',
      note: 'Log retrieval is not fully configured. Consider using a dedicated logging service.',
    };
  }
};

/**
 * Get system settings
 */
const getSystemSettings = async () => {
  try {
    // Return current settings from environment/config
    return {
      maintenance: {
        enabled: process.env.MAINTENANCE_MODE === 'true',
        message: process.env.MAINTENANCE_MESSAGE || '',
      },
      rateLimit: {
        enabled: true,
        maxRequests: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
        windowMs: parseInt(process.env.RATE_LIMIT_WINDOW || '60000', 10),
      },
      session: {
        maxConcurrent: parseInt(process.env.MAX_CONCURRENT_SESSIONS || '5', 10),
        timeoutMinutes: parseInt(process.env.SESSION_TIMEOUT || '30', 10),
      },
      features: {
        registration: process.env.ALLOW_REGISTRATION !== 'false',
        emailVerification: process.env.EMAIL_VERIFICATION === 'true',
        socialLogin: process.env.ALLOW_SOCIAL_LOGIN === 'true',
        fileUploads: process.env.ALLOW_FILE_UPLOADS !== 'false',
      },
      cache: {
        redisEnabled: !!process.env.REDIS_URI,
        ttlSeconds: parseInt(process.env.CACHE_TTL || '3600', 10),
      },
    };
  } catch (error) {
    logger.error('[Admin SystemService] Error getting system settings:', error);
    throw error;
  }
};

/**
 * Update system settings (note: some settings may require restart)
 */
const updateSystemSettings = async (settings) => {
  try {
    // In a real implementation, you would save these to a database
    // or update environment variables through a config service
    
    // For now, we just log the request
    // A full implementation would persist these settings
    return { success: true, message: 'Settings update logged (requires implementation)' };
  } catch (error) {
    logger.error('[Admin SystemService] Error updating system settings:', error);
    throw error;
  }
};

/**
 * Get cache statistics
 */
const getCacheStats = async () => {
  try {
    // Try to get Redis stats if available
    const redisUri = process.env.REDIS_URI;
    
    if (redisUri) {
      try {
        // Use @ranger/api which properly exports ioredisClient
        const { ioredisClient } = require('@ranger/api');
        
        if (ioredisClient) {
          const status = ioredisClient.status || 'unknown';
          
          if (status === 'ready' || status === 'connect') {
            const info = await ioredisClient.info('memory');
            const keyCount = await ioredisClient.dbsize();
            
            // Parse memory info
            const usedMemory = parseInt(info.match(/used_memory:(\d+)/)?.[1] || '0', 10);
            const usedMemoryMB = (usedMemory / 1024 / 1024).toFixed(2);
            
            // Get hit/miss stats
            const stats = await ioredisClient.info('stats');
            const keyspaceHits = parseInt(stats.match(/keyspace_hits:(\d+)/)?.[1] || '0', 10);
            const keyspaceMisses = parseInt(stats.match(/keyspace_misses:(\d+)/)?.[1] || '0', 10);
            
            return {
              hits: keyspaceHits,
              misses: keyspaceMisses,
              keys: keyCount,
              memoryUsed: usedMemory,
              memoryUsedMB: parseFloat(usedMemoryMB),
              connected: true,
            };
          }
        }
      } catch (redisError) {
        logger.warn('[Admin SystemService] Could not get Redis stats:', redisError.message);
      }
    }
    
    // Return default stats if Redis not available
    return {
      hits: 0,
      misses: 0,
      keys: 0,
      memoryUsed: 0,
      memoryUsedMB: 0,
      connected: false,
      note: 'Redis not configured or not available',
    };
  } catch (error) {
    logger.error('[Admin SystemService] Error getting cache stats:', error);
    throw error;
  }
};

/**
 * Flush all cache
 */
const flushCache = async () => {
  try {
    const redisUri = process.env.REDIS_URI;
    
    if (redisUri) {
      try {
        // Use @ranger/api which properly exports ioredisClient
        const { ioredisClient } = require('@ranger/api');
        
        if (ioredisClient) {
          const status = ioredisClient.status || 'unknown';
          
          if (status === 'ready' || status === 'connect') {
            await ioredisClient.flushdb();
            return { success: true, message: 'Cache flushed successfully' };
          } else {
            logger.warn('[Admin SystemService] Redis client not ready, status:', status);
            throw new Error(`Redis client not ready, status: ${status}`);
          }
        } else {
          throw new Error('ioredisClient not available from @ranger/api');
        }
      } catch (redisError) {
        logger.error('[Admin SystemService] Could not flush Redis:', redisError.message);
        throw new Error(`Failed to flush Redis cache: ${redisError.message}`);
      }
    }
    
    // If no Redis, return success
    return { success: true, message: 'No cache to flush (Redis not configured)' };
  } catch (error) {
    logger.error('[Admin SystemService] Error flushing cache:', error.message);
    throw error;
  }
};

module.exports = {
  getHealthStatus,
  getSystemConfig,
  getRecentLogs,
  getSystemSettings,
  updateSystemSettings,
  getCacheStats,
  flushCache,
};