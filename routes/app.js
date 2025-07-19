const express = require('express');
const { body, validationResult } = require('express-validator');
const logger = require('../utils/logger');

const router = express.Router();

// Store app status updates (in production, use a proper database)
let appStatus = {
  lastSeen: null,
  status: 'unknown',
  version: null,
  configVersion: null,
  activeUsers: 0,
  errors: []
};

// Health check endpoint for the main app
router.get('/ping', (req, res) => {
  res.json({
    message: 'Admin panel is running',
    timestamp: new Date().toISOString(),
    status: 'healthy'
  });
});

// Receive status updates from the main app
router.post('/status', [
  body('status').isIn(['running', 'error', 'starting', 'stopping']).withMessage('Invalid status'),
  body('version').optional().isString().withMessage('Version must be a string'),
  body('configVersion').optional().isString().withMessage('Config version must be a string'),
  body('activeUsers').optional().isInt({ min: 0 }).withMessage('Active users must be a non-negative integer'),
  body('errors').optional().isArray().withMessage('Errors must be an array')
], (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { status, version, configVersion, activeUsers, errors: appErrors } = req.body;
    
    // Update app status
    appStatus = {
      lastSeen: new Date().toISOString(),
      status: status || appStatus.status,
      version: version || appStatus.version,
      configVersion: configVersion || appStatus.configVersion,
      activeUsers: activeUsers !== undefined ? activeUsers : appStatus.activeUsers,
      errors: appErrors || appStatus.errors
    };

    logger.info(`App status update received: ${status}`);
    
    // Broadcast status update to connected clients via WebSocket
    if (req.io) {
      req.io.to('config-updates').emit('app-status-update', appStatus);
    }

    res.json({
      message: 'Status update received',
      timestamp: appStatus.lastSeen
    });
  } catch (error) {
    logger.error('App status update error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to process status update'
    });
  }
});

// Get current app status
router.get('/status', (req, res) => {
  res.json({
    appStatus,
    adminPanel: {
      status: 'running',
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    }
  });
});

// Receive error reports from the main app
router.post('/error', [
  body('error').isString().withMessage('Error message is required'),
  body('stack').optional().isString().withMessage('Stack trace must be a string'),
  body('context').optional().isObject().withMessage('Context must be an object')
], (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { error: errorMessage, stack, context } = req.body;
    
    const errorReport = {
      timestamp: new Date().toISOString(),
      message: errorMessage,
      stack: stack || null,
      context: context || {},
      id: Date.now().toString()
    };

    // Add to errors array (keep last 100 errors)
    appStatus.errors.unshift(errorReport);
    if (appStatus.errors.length > 100) {
      appStatus.errors = appStatus.errors.slice(0, 100);
    }

    logger.error(`App error reported: ${errorMessage}`, { stack, context });
    
    // Broadcast error to connected clients
    if (req.io) {
      req.io.to('config-updates').emit('app-error', errorReport);
    }

    res.json({
      message: 'Error report received',
      errorId: errorReport.id
    });
  } catch (error) {
    logger.error('App error report processing failed:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to process error report'
    });
  }
});

// Clear error history
router.delete('/errors', (req, res) => {
  appStatus.errors = [];
  logger.info('App error history cleared');
  
  // Broadcast error clear to connected clients
  if (req.io) {
    req.io.to('config-updates').emit('errors-cleared');
  }

  res.json({
    message: 'Error history cleared'
  });
});

// Send command to the main app (for future use)
router.post('/command', [
  body('command').isIn(['restart', 'reload-config', 'clear-cache']).withMessage('Invalid command'),
  body('parameters').optional().isObject().withMessage('Parameters must be an object')
], (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { command, parameters } = req.body;
    
    logger.info(`Command sent to app: ${command}`, parameters);
    
    // Broadcast command to connected app instances
    if (req.io) {
      req.io.emit('app-command', { command, parameters, timestamp: new Date().toISOString() });
    }

    res.json({
      message: 'Command sent',
      command,
      parameters: parameters || {}
    });
  } catch (error) {
    logger.error('App command error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to send command'
    });
  }
});

module.exports = router;
