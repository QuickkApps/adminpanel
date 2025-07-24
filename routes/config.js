const express = require('express');
const { body, validationResult } = require('express-validator');
const configService = require('../services/configService');
const logger = require('../utils/logger');
const https = require('https');
const http = require('http');
const { URL } = require('url');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Get current configuration for app (no authentication required)
router.get('/app', async (req, res) => {
  try {
    const config = await configService.readConfig();

    // Return only the fields needed by the app (no sensitive data)
    const appConfig = {
      apiUrl: config.apiUrl,
      activationApiUrl: config.activationApiUrl,
      lastUpdated: config.lastUpdated,
      isActive: config.isActive,
      additionalSettings: config.additionalSettings || {}
    };

    res.json({
      config: appConfig,
      message: 'Configuration retrieved successfully'
    });
  } catch (error) {
    logger.error('Failed to get app configuration:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to retrieve configuration'
    });
  }
});

// Get current configuration (requires authentication)
router.get('/', authMiddleware, async (req, res) => {
  try {
    const config = await configService.readConfig();

    // Don't send password in response for security
    const safeConfig = { ...config };
    if (safeConfig.password) {
      safeConfig.password = '***';
    }

    res.json({
      config: safeConfig,
      message: 'Configuration retrieved successfully'
    });
  } catch (error) {
    logger.error('Failed to get configuration:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to retrieve configuration'
    });
  }
});

// Update configuration
router.put('/', authMiddleware, [
  body('apiUrl').isURL().withMessage('Valid API URL is required'),
  body('activationApiUrl').isURL().withMessage('Valid Activation API URL is required'),
  body('isActive').optional().isBoolean().withMessage('isActive must be a boolean'),
  body('additionalSettings').optional().isObject().withMessage('additionalSettings must be an object')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { apiUrl, activationApiUrl, isActive, additionalSettings } = req.body;

    // Get current config to preserve other fields
    const currentConfig = await configService.readConfig();

    // Update with new values, preserving existing username and password
    const updatedConfig = {
      ...currentConfig,
      apiUrl,
      activationApiUrl,
      // Keep existing username and password
      username: currentConfig.username,
      password: currentConfig.password,
      isActive: isActive !== undefined ? isActive : currentConfig.isActive,
      additionalSettings: additionalSettings || currentConfig.additionalSettings,
      lastUpdated: new Date().toISOString()
    };

    // Write updated configuration
    const savedConfig = await configService.writeConfig(updatedConfig);
    
    logger.info(`Configuration updated by user: ${req.user.username}`, {
      apiUrl: savedConfig.apiUrl,
      activationApiUrl: savedConfig.activationApiUrl,
      isActive: savedConfig.isActive
    });

    // Broadcast configuration update to connected clients
    if (req.io) {
      const safeConfig = { ...savedConfig };
      safeConfig.password = '***';
      req.io.to('config-updates').emit('config-updated', safeConfig);
    }

    // Don't send password in response
    const safeConfig = { ...savedConfig };
    safeConfig.password = '***';

    res.json({
      config: safeConfig,
      message: 'Configuration updated successfully'
    });
  } catch (error) {
    logger.error('Failed to update configuration:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message || 'Failed to update configuration'
    });
  }
});

// Get configuration status
router.get('/status', authMiddleware, async (req, res) => {
  try {
    const status = await configService.getConfigStatus();
    res.json({
      status,
      message: 'Configuration status retrieved successfully'
    });
  } catch (error) {
    logger.error('Failed to get configuration status:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to retrieve configuration status'
    });
  }
});

// Test connection endpoint
router.post('/test-connection', authMiddleware, async (req, res) => {
  try {
    // Load current config
    const config = await configService.readConfig();

    if (!config) {
      return res.status(404).json({
        error: 'No configuration found',
        message: 'Please configure the system first'
      });
    }

    // Test results object
    const testResults = {
      apiUrl: { status: 'unknown', message: '', responseTime: 0 },
      activationApiUrl: { status: 'unknown', message: '', responseTime: 0 }
    };

    // Test main API URL
    if (config.apiUrl) {
      try {
        const startTime = Date.now();
        // Simple connectivity test - try to reach the URL
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const response = await fetch(config.apiUrl, {
          method: 'HEAD',
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        const responseTime = Date.now() - startTime;

        testResults.apiUrl = {
          status: response.ok ? 'success' : 'warning',
          message: response.ok ? `Connected successfully (${response.status}) - ${responseTime}ms` : `HTTP ${response.status} - ${responseTime}ms`,
          responseTime
        };
      } catch (error) {
        testResults.apiUrl = {
          status: 'error',
          message: error.name === 'AbortError' ? 'Connection timeout (5s)' : error.message,
          responseTime: 0
        };
      }
    }

    // Test activation API URL
    if (config.activationApiUrl) {
      try {
        const startTime = Date.now();
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const response = await fetch(config.activationApiUrl, {
          method: 'HEAD',
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        const responseTime = Date.now() - startTime;

        testResults.activationApiUrl = {
          status: response.ok ? 'success' : 'warning',
          message: response.ok ? `Connected successfully (${response.status}) - ${responseTime}ms` : `HTTP ${response.status} - ${responseTime}ms`,
          responseTime
        };
      } catch (error) {
        testResults.activationApiUrl = {
          status: 'error',
          message: error.name === 'AbortError' ? 'Connection timeout (5s)' : error.message,
          responseTime: 0
        };
      }
    }

    const successCount = Object.values(testResults).filter(r => r.status === 'success').length;
    const totalTests = Object.keys(testResults).length;
    const overallSuccess = successCount === totalTests;

    logger.info(`Connection test performed by admin: ${req.user.username} - Success: ${successCount}/${totalTests}`);

    res.json({
      success: overallSuccess,
      message: overallSuccess ? 'All connections successful' :
               successCount > 0 ? 'Some connections successful' : 'All connections failed',
      results: testResults,
      summary: {
        total: totalTests,
        successful: successCount,
        failed: totalTests - successCount
      }
    });
  } catch (error) {
    logger.error('Error testing connection:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to test connection'
    });
  }
});

// Create backup
router.post('/backup', authMiddleware, async (req, res) => {
  try {
    const backupFileName = await configService.createBackup();
    
    if (!backupFileName) {
      return res.status(404).json({
        error: 'No configuration found',
        message: 'No configuration file exists to backup'
      });
    }

    logger.info(`Configuration backup created by user: ${req.user.username} - ${backupFileName}`);

    res.json({
      backupFileName,
      message: 'Backup created successfully'
    });
  } catch (error) {
    logger.error('Failed to create backup:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to create backup'
    });
  }
});

// Create config-only backup
router.post('/backup-config-only', authMiddleware, async (req, res) => {
  try {
    // Create a config-only backup by reading current config and saving it
    const currentConfig = await configService.readConfig();

    // Generate backup filename
    const now = new Date();
    const timeStr = `${now.getHours()}am-${now.getMinutes()}min-${now.getSeconds()}sec_${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}-${String(now.getFullYear()).slice(-2)}`;
    const backupFileName = `config_backup_${timeStr}.json`;

    // Create backup content (config only)
    const backupContent = {
      ...currentConfig,
      backupType: 'config-only',
      backupDate: now.toISOString(),
      backupVersion: '1.0'
    };

    // Save backup file
    const fs = require('fs').promises;
    const path = require('path');
    const backupDir = path.join(__dirname, '../backups');

    // Ensure backup directory exists
    await fs.mkdir(backupDir, { recursive: true });

    const backupPath = path.join(backupDir, backupFileName);
    await fs.writeFile(backupPath, JSON.stringify(backupContent, null, 2));

    logger.info(`Config-only backup created: ${backupFileName} by user: ${req.user.username}`);

    res.json({
      success: true,
      backupFileName,
      message: 'Configuration backup created successfully'
    });
  } catch (error) {
    logger.error('Failed to create config-only backup:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to create configuration backup'
    });
  }
});

// List backups
router.get('/backups', authMiddleware, async (req, res) => {
  try {
    const backups = await configService.listBackups();
    res.json({
      backups,
      count: backups.length,
      message: 'Backups retrieved successfully'
    });
  } catch (error) {
    logger.error('Failed to list backups:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to retrieve backups'
    });
  }
});

// Delete backup
router.delete('/backups/:backupFileName', authMiddleware, async (req, res) => {
  try {
    const { backupFileName } = req.params;

    if (!backupFileName) {
      return res.status(400).json({
        error: 'Bad request',
        message: 'Backup filename is required'
      });
    }

    const success = await configService.deleteBackup(backupFileName);

    if (success) {
      logger.info(`Backup deleted by user: ${req.user.username} - ${backupFileName}`);
      res.json({
        success: true,
        message: `Backup ${backupFileName} deleted successfully`
      });
    } else {
      res.status(404).json({
        error: 'Not found',
        message: 'Backup file not found'
      });
    }
  } catch (error) {
    logger.error('Failed to delete backup:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message || 'Failed to delete backup'
    });
  }
});

// Restore from backup (supports both config-only and full database restore)
router.post('/restore/:backupFileName', authMiddleware, async (req, res) => {
  try {
    const { backupFileName } = req.params;
    const { restoreDatabase = true, restoreConfiguration = true } = req.body;

    if (!backupFileName) {
      return res.status(400).json({
        error: 'Bad request',
        message: 'Backup filename is required'
      });
    }

    const restoreResult = await configService.restoreFromBackup(backupFileName, {
      restoreDatabase,
      restoreConfiguration,
      currentUserId: req.user.id
    });

    logger.info(`Backup restored by user: ${req.user.username} - ${backupFileName}`);
    logger.info(`Restored items: ${restoreResult.restoredItems.join(', ')}`);

    // Broadcast restore notification to connected clients
    if (req.io) {
      req.io.to('config-updates').emit('backup-restored', {
        backupFileName,
        backupType: restoreResult.backupType,
        restoredItems: restoreResult.restoredItems,
        message: restoreResult.message,
        restoredBy: req.user.username,
        timestamp: new Date().toISOString()
      });

      // If configuration was restored, also broadcast config update
      if (restoreResult.restoredItems.includes('configuration')) {
        try {
          const currentConfig = await configService.readConfig();
          if (currentConfig) {
            const safeConfig = { ...currentConfig };
            safeConfig.password = '***';
            req.io.to('config-updates').emit('config-updated', safeConfig);
          }
        } catch (configError) {
          logger.warn('Failed to broadcast config update after restore:', configError);
        }
      }
    }

    // For full restore (both database and configuration), force logout all admin sessions
    const isFullRestore = restoreResult.restoredItems.includes('database') && restoreResult.restoredItems.includes('configuration');
    if (isFullRestore) {
      try {
        // Clear all admin sessions from database
        await models.AdminSession.destroy({ where: {} });
        logger.info('🔄 All admin sessions cleared after full restore - users will need to re-login');

        // Emit logout event to all connected admin sockets
        if (req.io) {
          req.io.emit('force-logout', {
            reason: 'Full restore completed - please login again',
            timestamp: new Date().toISOString()
          });
          logger.info('📡 Force logout event sent to all connected admin clients');
        }
      } catch (sessionError) {
        logger.warn('⚠️ Failed to clear admin sessions after restore:', sessionError.message);
      }
    }

    res.json({
      success: true,
      backupFileName,
      backupType: restoreResult.backupType,
      restoredItems: restoreResult.restoredItems,
      message: restoreResult.message,
      forceLogout: isFullRestore // Indicate if client should logout
    });
  } catch (error) {
    logger.error('Failed to restore from backup:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message || 'Failed to restore from backup'
    });
  }
});

// Reset to default configuration
router.post('/reset', authMiddleware, async (req, res) => {
  try {
    // Create backup before reset
    await configService.createBackup();

    // Get default configuration
    const defaultConfig = configService.getDefaultConfig();

    // Write default configuration
    const savedConfig = await configService.writeConfig(defaultConfig);

    logger.info(`Configuration reset to default by user: ${req.user.username}`);

    // Broadcast configuration update to connected clients
    if (req.io) {
      const safeConfig = { ...savedConfig };
      safeConfig.password = '***';
      req.io.to('config-updates').emit('config-reset', safeConfig);
    }

    // Don't send password in response
    const safeConfig = { ...savedConfig };
    safeConfig.password = '***';

    res.json({
      config: safeConfig,
      message: 'Configuration reset to default successfully'
    });
  } catch (error) {
    logger.error('Failed to reset configuration:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to reset configuration'
    });
  }
});

// Reload configuration from file
router.post('/reload', authMiddleware, async (req, res) => {
  try {
    const config = await configService.readConfig();

    logger.info(`Configuration reloaded by user: ${req.user.username}`);

    // Broadcast configuration update to connected clients
    if (req.io) {
      const safeConfig = { ...config };
      safeConfig.password = '***';
      req.io.to('config-updates').emit('config-reloaded', safeConfig);
    }

    // Don't send password in response
    const safeConfig = { ...config };
    safeConfig.password = '***';

    res.json({
      config: safeConfig,
      message: 'Configuration reloaded successfully'
    });
  } catch (error) {
    logger.error('Failed to reload configuration:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to reload configuration'
    });
  }
});

// Test connection to API URLs
router.post('/test-connection', authMiddleware, async (req, res) => {
  try {
    const config = await configService.readConfig();

    const results = {
      apiUrl: { status: 'unknown', message: '', responseTime: 0 },
      activationApiUrl: { status: 'unknown', message: '', responseTime: 0 }
    };

    // Helper function to test a URL
    const testUrl = (url) => {
      return new Promise((resolve) => {
        const startTime = Date.now();
        try {
          const urlObj = new URL(url);
          const isHttps = urlObj.protocol === 'https:';
          const client = isHttps ? https : http;

          const options = {
            hostname: urlObj.hostname,
            port: urlObj.port || (isHttps ? 443 : 80),
            path: urlObj.pathname + urlObj.search,
            method: 'GET',
            timeout: 10000,
            headers: {
              'User-Agent': 'Anume-Admin-Panel/1.0'
            }
          };

          const req = client.request(options, (response) => {
            const responseTime = Date.now() - startTime;
            resolve({
              status: response.statusCode < 400 ? 'success' : 'warning',
              message: `HTTP ${response.statusCode} - ${responseTime}ms`,
              responseTime
            });
            response.destroy(); // Close the response to free resources
          });

          req.on('error', (error) => {
            const responseTime = Date.now() - startTime;
            resolve({
              status: 'error',
              message: error.code === 'ECONNREFUSED' ? 'Connection refused' : error.message,
              responseTime
            });
          });

          req.on('timeout', () => {
            const responseTime = Date.now() - startTime;
            req.destroy();
            resolve({
              status: 'error',
              message: 'Request timeout',
              responseTime
            });
          });

          req.end();
        } catch (error) {
          const responseTime = Date.now() - startTime;
          resolve({
            status: 'error',
            message: error.message,
            responseTime
          });
        }
      });
    };

    // Test API URL
    if (config.apiUrl) {
      results.apiUrl = await testUrl(config.apiUrl);
    }

    // Test Activation API URL
    if (config.activationApiUrl) {
      results.activationApiUrl = await testUrl(config.activationApiUrl);
    }

    logger.info(`Connection test performed by user: ${req.user.username}`, results);

    res.json({
      results,
      message: 'Connection test completed'
    });
  } catch (error) {
    logger.error('Failed to test connection:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to test connection'
    });
  }
});

module.exports = router;
