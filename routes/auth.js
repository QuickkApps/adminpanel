const express = require('express');
const { body, validationResult } = require('express-validator');
const logger = require('../utils/logger');
const authMiddleware = require('../middleware/auth');
const AdminService = require('../services/adminService');

const router = express.Router();

// Login endpoint
router.post('/login', [
  body('username').trim().isLength({ min: 1 }).withMessage('Username is required'),
  body('password').isLength({ min: 1 }).withMessage('Password is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { username, password } = req.body;

    logger.info(`Login attempt for username: ${username}`);

    // Get session info
    const sessionInfo = {
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent'),
      browserInfo: {
        ip: req.ip,
        headers: {
          'user-agent': req.get('User-Agent'),
          'accept-language': req.get('Accept-Language'),
          'accept-encoding': req.get('Accept-Encoding')
        }
      }
    };

    // Authenticate admin
    const result = await AdminService.authenticateAdmin(username, password, sessionInfo);

    if (!result.success) {
      logger.warn(`Login failed for username: ${username} - ${result.message}`);
      return res.status(401).json({
        error: 'Authentication failed',
        message: result.message
      });
    }

    logger.info(`Login successful for user: ${username}`);

    res.json({
      success: true,
      message: 'Login successful',
      token: result.token,
      sessionToken: result.sessionToken,
      user: result.admin
    });
  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Login failed'
    });
  }
});

// Verify token endpoint
router.get('/verify', authMiddleware, async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        error: 'No token provided',
        message: 'Authorization token is required'
      });
    }

    const result = await AdminService.verifyAdminToken(token);

    if (!result.success) {
      return res.status(401).json({
        error: 'Token verification failed',
        message: result.message
      });
    }

    res.json({
      success: true,
      message: 'Token is valid',
      user: result.admin,
      session: result.session
    });
  } catch (error) {
    logger.error('Token verification error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Token verification failed'
    });
  }
});

// Logout endpoint
router.post('/logout', authMiddleware, async (req, res) => {
  try {
    const sessionToken = req.headers['x-session-token'];

    if (sessionToken) {
      const result = await AdminService.logoutAdmin(sessionToken);
      if (!result.success) {
        logger.warn(`Logout failed for user: ${req.user.username}`);
      }
    }

    logger.info(`User logged out: ${req.user.username}`);

    res.json({
      success: true,
      message: 'Logout successful'
    });
  } catch (error) {
    logger.error('Logout error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Logout failed'
    });
  }
});

// Change password endpoint
router.post('/change-password', [
  authMiddleware,
  body('currentPassword').isLength({ min: 1 }).withMessage('Current password is required'),
  body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    // Find user
    const userIndex = users.findIndex(u => u.id === userId);
    if (userIndex === -1) {
      return res.status(404).json({
        error: 'User not found'
      });
    }

    const user = users[userIndex];

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, user.password);
    if (!isValidPassword) {
      logger.warn(`Password change failed: Invalid current password for user - ${user.username}`);
      return res.status(401).json({
        error: 'Authentication failed',
        message: 'Invalid current password'
      });
    }

    // Hash new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    users[userIndex].password = hashedNewPassword;

    logger.info(`Password changed successfully for user: ${user.username}`);

    res.json({
      message: 'Password changed successfully'
    });
  } catch (error) {
    logger.error('Change password error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Password change failed'
    });
  }
});

module.exports = router;
