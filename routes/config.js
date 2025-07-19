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

// Restore from backup
router.post('/restore/:backupFileName', authMiddleware, async (req, res) => {
  try {
    const { backupFileName } = req.params;
    
    if (!backupFileName) {
      return res.status(400).json({
        error: 'Bad request',
        message: 'Backup filename is required'
      });
    }

    const restoredConfig = await configService.restoreFromBackup(backupFileName);
    
    logger.info(`Configuration restored from backup by user: ${req.user.username} - ${backupFileName}`);

    // Broadcast configuration update to connected clients
    if (req.io) {
      const safeConfig = { ...restoredConfig };
      safeConfig.password = '***';
      req.io.to('config-updates').emit('config-restored', { config: safeConfig, backupFileName });
    }

    // Don't send password in response
    const safeConfig = { ...restoredConfig };
    safeConfig.password = '***';

    res.json({
      config: safeConfig,
      backupFileName,
      message: 'Configuration restored successfully'
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
