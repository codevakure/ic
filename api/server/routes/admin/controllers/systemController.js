/**
 * Admin System Controller
 * 
 * Handles system-related endpoints for administrators.
 */

const { logger } = require('@librechat/data-schemas');
const { SystemRoles, roleDefaults } = require('librechat-data-provider');
const systemService = require('../services/systemService');
const { Role } = require('~/db/models');
const { getRoleByName, updateRoleByName } = require('~/models/Role');

/**
 * Get system health status
 */
const getSystemHealth = async (req, res) => {
  try {
    const health = await systemService.getHealthStatus();
    res.status(200).json(health);
  } catch (error) {
    logger.error('[Admin] Error fetching system health:', error);
    res.status(500).json({ 
      message: 'Error fetching system health',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get system configuration (non-sensitive values only)
 */
const getSystemConfig = async (req, res) => {
  try {
    const config = await systemService.getSystemConfig();
    res.status(200).json(config);
  } catch (error) {
    logger.error('[Admin] Error fetching system config:', error);
    res.status(500).json({ 
      message: 'Error fetching system configuration',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get recent application logs
 */
const getRecentLogs = async (req, res) => {
  try {
    const { 
      level = 'all',
      limit = 100,
      offset = 0 
    } = req.query;

    const logs = await systemService.getRecentLogs({
      level,
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10),
    });

    res.status(200).json(logs);
  } catch (error) {
    logger.error('[Admin] Error fetching logs:', error);
    res.status(500).json({ 
      message: 'Error fetching logs',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get system settings
 */
const getSystemSettings = async (req, res) => {
  try {
    const settings = await systemService.getSystemSettings();
    res.status(200).json(settings);
  } catch (error) {
    logger.error('[Admin] Error fetching system settings:', error);
    res.status(500).json({ 
      message: 'Error fetching system settings',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Update system settings
 */
const updateSystemSettings = async (req, res) => {
  try {
    const settings = req.body;
    await systemService.updateSystemSettings(settings);
    res.status(200).json({ message: 'Settings updated successfully' });
  } catch (error) {
    logger.error('[Admin] Error updating system settings:', error);
    res.status(500).json({ 
      message: 'Error updating system settings',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get cache statistics
 */
const getCacheStats = async (req, res) => {
  try {
    const stats = await systemService.getCacheStats();
    res.status(200).json(stats);
  } catch (error) {
    logger.error('[Admin] Error fetching cache stats:', error);
    res.status(500).json({ 
      message: 'Error fetching cache statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Flush all cache
 */
const flushCache = async (req, res) => {
  try {
    await systemService.flushCache();
    res.status(200).json({ message: 'Cache flushed successfully' });
  } catch (error) {
    logger.error('[Admin] Error flushing cache:', error);
    res.status(500).json({ 
      message: 'Error flushing cache',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * List all roles
 */
const listRoles = async (req, res) => {
  try {
    // Get all roles from database
    const roles = await Role.find({}).select('-__v').lean();
    
    // Also ensure system roles exist
    const systemRoleNames = Object.values(SystemRoles);
    const existingRoleNames = roles.map(r => r.name);
    
    // Create any missing system roles
    for (const roleName of systemRoleNames) {
      if (!existingRoleNames.includes(roleName) && roleDefaults[roleName]) {
        const newRole = await new Role(roleDefaults[roleName]).save();
        roles.push(newRole.toObject());
      }
    }
    
    res.status(200).json({
      roles,
      systemRoles: systemRoleNames,
    });
  } catch (error) {
    logger.error('[Admin] Error listing roles:', error);
    res.status(500).json({ 
      message: 'Error listing roles',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get specific role details
 */
const getRoleDetails = async (req, res) => {
  try {
    const { roleName } = req.params;
    const role = await getRoleByName(roleName.toUpperCase());
    
    if (!role) {
      return res.status(404).json({ message: 'Role not found' });
    }
    
    res.status(200).json(role);
  } catch (error) {
    logger.error('[Admin] Error fetching role details:', error);
    res.status(500).json({ 
      message: 'Error fetching role details',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Update role permissions
 */
const updateRole = async (req, res) => {
  try {
    const { roleName } = req.params;
    const updates = req.body;
    
    // Prevent modifying certain fields
    delete updates._id;
    delete updates.name;
    
    const role = await updateRoleByName(roleName.toUpperCase(), updates);
    
    if (!role) {
      return res.status(404).json({ message: 'Role not found' });
    }
    
    res.status(200).json({ message: 'Role updated successfully', role });
  } catch (error) {
    logger.error('[Admin] Error updating role:', error);
    res.status(500).json({ 
      message: 'Error updating role',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Create new custom role
 */
const createRole = async (req, res) => {
  try {
    const { name, permissions } = req.body;
    
    if (!name) {
      return res.status(400).json({ message: 'Role name is required' });
    }
    
    // Check if role already exists
    const existingRole = await Role.findOne({ name: name.toUpperCase() });
    if (existingRole) {
      return res.status(400).json({ message: 'Role already exists' });
    }
    
    // Create new role
    const newRole = await new Role({
      name: name.toUpperCase(),
      permissions: permissions || {},
    }).save();
    
    res.status(201).json({ message: 'Role created successfully', role: newRole.toObject() });
  } catch (error) {
    logger.error('[Admin] Error creating role:', error);
    res.status(500).json({ 
      message: 'Error creating role',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Delete custom role
 */
const deleteRole = async (req, res) => {
  try {
    const { roleName } = req.params;
    const upperRoleName = roleName.toUpperCase();
    
    // Prevent deleting system roles
    if (Object.values(SystemRoles).includes(upperRoleName)) {
      return res.status(400).json({ message: 'Cannot delete system roles' });
    }
    
    const result = await Role.findOneAndDelete({ name: upperRoleName });
    
    if (!result) {
      return res.status(404).json({ message: 'Role not found' });
    }
    
    res.status(200).json({ message: 'Role deleted successfully' });
  } catch (error) {
    logger.error('[Admin] Error deleting role:', error);
    res.status(500).json({ 
      message: 'Error deleting role',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = {
  getSystemHealth,
  getSystemConfig,
  getRecentLogs,
  getSystemSettings,
  updateSystemSettings,
  getCacheStats,
  flushCache,
  listRoles,
  getRoleDetails,
  updateRole,
  createRole,
  deleteRole,
};
