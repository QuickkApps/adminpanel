const express = require('express');
const { body, query, validationResult } = require('express-validator');
const logger = require('../utils/logger');
const authMiddleware = require('../middleware/auth');
const UserService = require('../services/userService');

const router = express.Router();

// Get all users with pagination and filters
router.get('/', authMiddleware, [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('status').optional().isIn(['active', 'inactive', 'expired', 'suspended']).withMessage('Invalid status'),
  query('isActive').optional().isBoolean().withMessage('isActive must be a boolean'),
  query('isOnline').optional().isBoolean().withMessage('isOnline must be a boolean'),
  query('search').optional().isLength({ min: 1, max: 50 }).withMessage('Search term must be 1-50 characters'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const {
      page = 1,
      limit = 50,
      status,
      isActive,
      isOnline,
      search
    } = req.query;

    const filters = {};
    if (status) filters.status = status;
    if (isActive !== undefined) filters.isActive = isActive === 'true';
    if (isOnline !== undefined) filters.isOnline = isOnline === 'true';
    if (search) filters.search = search;

    const result = await UserService.getAllUsers(
      parseInt(page),
      parseInt(limit),
      filters
    );

    logger.info(`Users retrieved by admin: ${req.user.username} - Page ${page}, ${result.users.length} users`);

    res.json({
      success: true,
      data: result,
      message: 'Users retrieved successfully'
    });
  } catch (error) {
    logger.error('Error retrieving users:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to retrieve users'
    });
  }
});

// Get online users
router.get('/online', authMiddleware, async (req, res) => {
  try {
    const onlineUsers = await UserService.getOnlineUsers();

    logger.info(`Online users retrieved by admin: ${req.user.username} - ${onlineUsers.length} users online`);

    res.json({
      success: true,
      data: onlineUsers,
      count: onlineUsers.length,
      message: 'Online users retrieved successfully'
    });
  } catch (error) {
    logger.error('Error retrieving online users:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to retrieve online users'
    });
  }
});

// Get user statistics
router.get('/stats', authMiddleware, async (req, res) => {
  try {
    const stats = await UserService.getUserStats();

    logger.info(`User stats retrieved by admin: ${req.user.username}`);

    res.json({
      success: true,
      data: stats,
      message: 'User statistics retrieved successfully'
    });
  } catch (error) {
    logger.error('Error retrieving user stats:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to retrieve user statistics'
    });
  }
});

// Get specific user details
router.get('/:userId', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId || isNaN(userId)) {
      return res.status(400).json({
        error: 'Invalid user ID',
        message: 'User ID must be a valid number'
      });
    }

    const { models } = require('../database');
    const { User, UserSession } = models;

    const user = await User.findByPk(userId, {
      include: [{
        model: UserSession,
        as: 'sessions',
        limit: 10,
        order: [['started_at', 'DESC']],
      }]
    });

    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        message: 'The specified user does not exist'
      });
    }

    logger.info(`User details retrieved by admin: ${req.user.username} - User ID: ${userId}`);

    res.json({
      success: true,
      data: user,
      message: 'User details retrieved successfully'
    });
  } catch (error) {
    logger.error('Error retrieving user details:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to retrieve user details'
    });
  }
});

// Disconnect user (admin action)
router.post('/:userId/disconnect', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason = 'admin_disconnect' } = req.body;

    if (!userId || isNaN(userId)) {
      return res.status(400).json({
        error: 'Invalid user ID',
        message: 'User ID must be a valid number'
      });
    }

    const disconnectedSessions = await UserService.disconnectUser(userId, reason);

    // Emit disconnect event to WebSocket clients
    if (req.io) {
      req.io.emit('user-disconnected', {
        userId: parseInt(userId),
        reason,
        disconnectedBy: req.user.username,
        timestamp: new Date().toISOString()
      });
    }

    logger.info(`User disconnected by admin: ${req.user.username} - User ID: ${userId}, Sessions: ${disconnectedSessions}`);

    res.json({
      success: true,
      data: {
        userId: parseInt(userId),
        disconnectedSessions,
        reason
      },
      message: `User disconnected successfully. ${disconnectedSessions} sessions ended.`
    });
  } catch (error) {
    logger.error('Error disconnecting user:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to disconnect user'
    });
  }
});

// Update user status (activate/deactivate)
router.patch('/:userId/status', authMiddleware, [
  body('isActive').isBoolean().withMessage('isActive must be a boolean'),
  body('reason').optional().isLength({ min: 1, max: 200 }).withMessage('Reason must be 1-200 characters'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { userId } = req.params;
    const { isActive, reason } = req.body;

    if (!userId || isNaN(userId)) {
      return res.status(400).json({
        error: 'Invalid user ID',
        message: 'User ID must be a valid number'
      });
    }

    const { models } = require('../database');
    const { User } = models;

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        message: 'The specified user does not exist'
      });
    }

    await user.update({ is_active: isActive });

    // If deactivating, disconnect all sessions
    if (!isActive) {
      await UserService.disconnectUser(userId, 'account_deactivated');
    }

    logger.info(`User status updated by admin: ${req.user.username} - User ID: ${userId}, Active: ${isActive}`);

    res.json({
      success: true,
      data: {
        userId: parseInt(userId),
        isActive,
        reason
      },
      message: `User ${isActive ? 'activated' : 'deactivated'} successfully`
    });
  } catch (error) {
    logger.error('Error updating user status:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to update user status'
    });
  }
});

module.exports = router;
