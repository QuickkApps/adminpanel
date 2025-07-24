const express = require('express');
const { body, param, validationResult } = require('express-validator');
const { models } = require('../database');
const logger = require('../utils/logger');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Get all content (public endpoint for Flutter app)
router.get('/', async (req, res) => {
  try {
    const contents = await models.AppContent.getAllActiveContent();
    
    // Transform to a more convenient format for the app
    const contentMap = {};
    contents.forEach(content => {
      contentMap[content.content_key] = {
        title: content.title,
        content: content.content,
        content_type: content.content_type,
        version: content.version,
        updated_at: content.updatedAt,
      };
    });

    res.json({
      success: true,
      data: contentMap,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Error fetching content:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch content',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Get specific content by key (public endpoint for Flutter app)
router.get('/:key', [
  param('key').isIn(['about_anume', 'privacy_policy']).withMessage('Invalid content key')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { key } = req.params;
    const content = await models.AppContent.getContent(key);
    
    if (!content) {
      return res.status(404).json({
        success: false,
        message: 'Content not found'
      });
    }

    res.json({
      success: true,
      data: {
        title: content.title,
        content: content.content,
        content_type: content.content_type,
        version: content.version,
        updated_at: content.updatedAt,
      }
    });
  } catch (error) {
    logger.error(`Error fetching content ${req.params.key}:`, error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch content',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Get all content for admin panel (with full details)
router.get('/admin/all', authMiddleware, async (req, res) => {
  try {
    const contents = await models.AppContent.findAll({
      include: [{
        model: models.Admin,
        as: 'updatedBy',
        attributes: ['id', 'username'],
        required: false,
      }],
      order: [['content_key', 'ASC']],
    });

    res.json({
      success: true,
      data: contents,
      count: contents.length,
    });
  } catch (error) {
    logger.error('Error fetching admin content:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch content',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Update content (admin only)
router.put('/:key', [
  authMiddleware,
  param('key').isIn(['about_anume', 'privacy_policy']).withMessage('Invalid content key'),
  body('title').trim().isLength({ min: 1, max: 255 }).withMessage('Title must be between 1 and 255 characters'),
  body('content').trim().isLength({ min: 1, max: 50000 }).withMessage('Content must be between 1 and 50000 characters'),
  body('content_type').optional().isIn(['plain_text', 'html', 'markdown']).withMessage('Invalid content type'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { key } = req.params;
    const { title, content, content_type = 'plain_text' } = req.body;
    const adminId = req.user.id;

    // Update content
    const updatedContent = await models.AppContent.updateContent(
      key,
      title,
      content,
      content_type,
      adminId
    );

    // Broadcast update to connected clients via WebSocket
    if (req.io) {
      req.io.emit('content-updated', {
        key,
        title,
        content,
        content_type,
        version: updatedContent.version,
        updated_at: updatedContent.updatedAt,
        timestamp: new Date().toISOString(),
      });
    }

    logger.info(`Content updated: ${key} by admin ${req.user.username}`);

    res.json({
      success: true,
      message: 'Content updated successfully',
      data: {
        content_key: updatedContent.content_key,
        title: updatedContent.title,
        content: updatedContent.content,
        content_type: updatedContent.content_type,
        version: updatedContent.version,
        updated_at: updatedContent.updatedAt,
      }
    });
  } catch (error) {
    logger.error(`Error updating content ${req.params.key}:`, error);
    res.status(500).json({
      success: false,
      message: 'Failed to update content',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Get content history/versions (admin only) - for future enhancement
router.get('/:key/history', [
  authMiddleware,
  param('key').isIn(['about_anume', 'privacy_policy']).withMessage('Invalid content key')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    // For now, just return current content
    // In future, could implement versioning system
    const { key } = req.params;
    const content = await models.AppContent.getContent(key);
    
    if (!content) {
      return res.status(404).json({
        success: false,
        message: 'Content not found'
      });
    }

    res.json({
      success: true,
      data: [content], // Array for future version support
      message: 'Content history retrieved (current version only)'
    });
  } catch (error) {
    logger.error(`Error fetching content history ${req.params.key}:`, error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch content history',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

module.exports = router;
