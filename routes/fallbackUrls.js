const express = require('express');
const { body, validationResult, param } = require('express-validator');
const authMiddleware = require('../middleware/auth');
const { models } = require('../database');
const logger = require('../utils/logger');
const axios = require('axios');

const router = express.Router();
const { FallbackUrl } = models;

// Get all fallback URLs
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { type } = req.query;
    
    const whereClause = {};
    if (type && ['api', 'activation', 'both'].includes(type)) {
      whereClause.url_type = ['both', type];
    }

    const urls = await FallbackUrl.findAll({
      where: whereClause,
      order: [['priority', 'ASC']],
      include: [{
        model: models.Admin,
        as: 'creator',
        attributes: ['id', 'username'],
      }],
    });

    res.json({
      success: true,
      data: urls,
      count: urls.length,
    });
  } catch (error) {
    logger.error('Failed to get fallback URLs:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to retrieve fallback URLs',
    });
  }
});

// Get active fallback URLs (for client consumption)
router.get('/active', async (req, res) => {
  try {
    const { type = 'api' } = req.query;
    
    const urls = await FallbackUrl.getActiveUrls(type);
    
    // Return simplified format for client
    const clientUrls = urls.map(url => ({
      id: url.id,
      url: url.url,
      priority: url.priority,
      type: url.url_type,
      description: url.description,
      lastTested: url.last_tested,
      lastTestStatus: url.last_test_status,
      responseTime: url.last_test_response_time,
    }));

    res.json({
      success: true,
      data: clientUrls,
      count: clientUrls.length,
    });
  } catch (error) {
    logger.error('Failed to get active fallback URLs:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to retrieve active fallback URLs',
    });
  }
});

// Create new fallback URL
router.post('/', authMiddleware, [
  body('url').isURL().withMessage('Valid URL is required'),
  body('url_type').isIn(['api', 'activation', 'both']).withMessage('Invalid URL type'),
  body('description').optional().isLength({ max: 255 }).withMessage('Description too long'),
  body('priority').optional().isInt({ min: 0 }).withMessage('Priority must be a non-negative integer'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array(),
      });
    }

    const { url, url_type, description, priority } = req.body;

    // Check if URL already exists
    const existingUrl = await FallbackUrl.findOne({ where: { url } });
    if (existingUrl) {
      return res.status(409).json({
        success: false,
        error: 'URL already exists',
        message: 'This URL is already configured as a fallback URL',
      });
    }

    // If no priority specified, set it to the next available priority
    let finalPriority = priority;
    if (finalPriority === undefined) {
      const maxPriority = await FallbackUrl.max('priority') || 0;
      finalPriority = maxPriority + 1;
    }

    const newUrl = await FallbackUrl.create({
      url,
      url_type,
      description,
      priority: finalPriority,
      created_by: req.user.id,
    });

    const createdUrl = await FallbackUrl.findByPk(newUrl.id, {
      include: [{
        model: models.Admin,
        as: 'creator',
        attributes: ['id', 'username'],
      }],
    });

    logger.info(`Fallback URL created by ${req.user.username}:`, {
      id: newUrl.id,
      url: newUrl.url,
      type: newUrl.url_type,
    });

    res.status(201).json({
      success: true,
      data: createdUrl,
      message: 'Fallback URL created successfully',
    });
  } catch (error) {
    logger.error('Failed to create fallback URL:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to create fallback URL',
    });
  }
});

// Update fallback URL
router.put('/:id', authMiddleware, [
  param('id').isInt().withMessage('Invalid URL ID'),
  body('url').optional().isURL().withMessage('Valid URL is required'),
  body('url_type').optional().isIn(['api', 'activation', 'both']).withMessage('Invalid URL type'),
  body('description').optional().isLength({ max: 255 }).withMessage('Description too long'),
  body('is_active').optional().isBoolean().withMessage('is_active must be a boolean'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array(),
      });
    }

    const { id } = req.params;
    const { url, url_type, description, is_active } = req.body;

    const fallbackUrl = await FallbackUrl.findByPk(id);
    if (!fallbackUrl) {
      return res.status(404).json({
        success: false,
        error: 'URL not found',
        message: 'Fallback URL not found',
      });
    }

    // Check if URL already exists (excluding current URL)
    if (url && url !== fallbackUrl.url) {
      const existingUrl = await FallbackUrl.findOne({ 
        where: { 
          url,
          id: { [require('sequelize').Op.ne]: id }
        } 
      });
      if (existingUrl) {
        return res.status(409).json({
          success: false,
          error: 'URL already exists',
          message: 'This URL is already configured as a fallback URL',
        });
      }
    }

    const updateData = {};
    if (url !== undefined) updateData.url = url;
    if (url_type !== undefined) updateData.url_type = url_type;
    if (description !== undefined) updateData.description = description;
    if (is_active !== undefined) updateData.is_active = is_active;

    await fallbackUrl.update(updateData);

    const updatedUrl = await FallbackUrl.findByPk(id, {
      include: [{
        model: models.Admin,
        as: 'creator',
        attributes: ['id', 'username'],
      }],
    });

    logger.info(`Fallback URL updated by ${req.user.username}:`, {
      id: updatedUrl.id,
      url: updatedUrl.url,
      changes: updateData,
    });

    res.json({
      success: true,
      data: updatedUrl,
      message: 'Fallback URL updated successfully',
    });
  } catch (error) {
    logger.error('Failed to update fallback URL:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to update fallback URL',
    });
  }
});

// Delete fallback URL
router.delete('/:id', authMiddleware, [
  param('id').isInt().withMessage('Invalid URL ID'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array(),
      });
    }

    const { id } = req.params;

    const fallbackUrl = await FallbackUrl.findByPk(id);
    if (!fallbackUrl) {
      return res.status(404).json({
        success: false,
        error: 'URL not found',
        message: 'Fallback URL not found',
      });
    }

    await fallbackUrl.destroy();

    logger.info(`Fallback URL deleted by ${req.user.username}:`, {
      id: fallbackUrl.id,
      url: fallbackUrl.url,
    });

    res.json({
      success: true,
      message: 'Fallback URL deleted successfully',
    });
  } catch (error) {
    logger.error('Failed to delete fallback URL:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to delete fallback URL',
    });
  }
});

// Reorder fallback URLs
router.put('/reorder', authMiddleware, [
  body('urlIds').isArray().withMessage('urlIds must be an array'),
  body('urlIds.*').isInt().withMessage('All URL IDs must be integers'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array(),
      });
    }

    const { urlIds } = req.body;

    const success = await FallbackUrl.reorderPriorities(urlIds);
    if (!success) {
      return res.status(500).json({
        success: false,
        error: 'Failed to reorder URLs',
        message: 'Could not update URL priorities',
      });
    }

    logger.info(`Fallback URLs reordered by ${req.user.username}:`, { urlIds });

    res.json({
      success: true,
      message: 'Fallback URLs reordered successfully',
    });
  } catch (error) {
    logger.error('Failed to reorder fallback URLs:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to reorder fallback URLs',
    });
  }
});

// Test a specific fallback URL
router.post('/:id/test', authMiddleware, [
  param('id').isInt().withMessage('Invalid URL ID'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array(),
      });
    }

    const { id } = req.params;

    const fallbackUrl = await FallbackUrl.findByPk(id);
    if (!fallbackUrl) {
      return res.status(404).json({
        success: false,
        error: 'URL not found',
        message: 'Fallback URL not found',
      });
    }

    // Test the URL
    const startTime = Date.now();
    let testResult = {
      status: 'unknown',
      responseTime: null,
      error: null,
    };

    try {
      const response = await axios.get(fallbackUrl.url, {
        timeout: 10000, // 10 second timeout
        validateStatus: (status) => status < 500, // Accept 4xx as success for testing
      });

      testResult.status = 'success';
      testResult.responseTime = Date.now() - startTime;
    } catch (error) {
      testResult.responseTime = Date.now() - startTime;

      if (error.code === 'ECONNABORTED') {
        testResult.status = 'timeout';
        testResult.error = 'Connection timeout';
      } else {
        testResult.status = 'failed';
        testResult.error = error.message;
      }
    }

    // Update the test result in database
    await FallbackUrl.updateTestResult(
      id,
      testResult.status,
      testResult.responseTime,
      testResult.error
    );

    logger.info(`Fallback URL tested by ${req.user.username}:`, {
      id: fallbackUrl.id,
      url: fallbackUrl.url,
      result: testResult,
    });

    res.json({
      success: true,
      data: {
        id: fallbackUrl.id,
        url: fallbackUrl.url,
        testResult,
      },
      message: 'URL test completed',
    });
  } catch (error) {
    logger.error('Failed to test fallback URL:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to test fallback URL',
    });
  }
});

// Test all active fallback URLs
router.post('/test-all', authMiddleware, async (req, res) => {
  try {
    const { type = 'api' } = req.body;

    const urls = await FallbackUrl.getActiveUrls(type);
    const testResults = [];

    for (const url of urls) {
      const startTime = Date.now();
      let testResult = {
        id: url.id,
        url: url.url,
        status: 'unknown',
        responseTime: null,
        error: null,
      };

      try {
        const response = await axios.get(url.url, {
          timeout: 10000,
          validateStatus: (status) => status < 500,
        });

        testResult.status = 'success';
        testResult.responseTime = Date.now() - startTime;
      } catch (error) {
        testResult.responseTime = Date.now() - startTime;

        if (error.code === 'ECONNABORTED') {
          testResult.status = 'timeout';
          testResult.error = 'Connection timeout';
        } else {
          testResult.status = 'failed';
          testResult.error = error.message;
        }
      }

      // Update the test result in database
      await FallbackUrl.updateTestResult(
        url.id,
        testResult.status,
        testResult.responseTime,
        testResult.error
      );

      testResults.push(testResult);
    }

    logger.info(`All fallback URLs tested by ${req.user.username}:`, {
      type,
      count: testResults.length,
      results: testResults.map(r => ({ id: r.id, status: r.status })),
    });

    res.json({
      success: true,
      data: testResults,
      message: `Tested ${testResults.length} fallback URLs`,
    });
  } catch (error) {
    logger.error('Failed to test all fallback URLs:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to test fallback URLs',
    });
  }
});

module.exports = router;
