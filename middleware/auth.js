const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');
const AdminService = require('../services/adminService');

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        error: 'Access denied',
        message: 'No token provided'
      });
    }

    const token = authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        error: 'Access denied',
        message: 'Invalid token format'
      });
    }

    // Verify token using AdminService
    const result = await AdminService.verifyAdminToken(token);

    if (!result.success) {
      logger.warn(`Authentication failed: ${result.message}`);
      return res.status(401).json({
        error: 'Authentication failed',
        message: result.message
      });
    }

    // Set user info in request
    req.user = result.admin;
    req.session = result.session;

    logger.debug(`Authenticated request from user: ${result.admin.username}`);
    next();
  } catch (error) {
    logger.warn(`Authentication middleware error: ${error.message}`);

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Token expired',
        message: 'Please login again'
      });
    }

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        error: 'Invalid token',
        message: 'Please login again'
      });
    }

    return res.status(401).json({
      error: 'Authentication failed',
      message: 'Invalid token'
    });
  }
};

module.exports = authMiddleware;
