const express = require('express');
const { body, validationResult } = require('express-validator');
const logger = require('../utils/logger');
const authMiddleware = require('../middleware/auth');
const AdminService = require('../services/adminService');

const router = express.Router();

// Middleware to check super admin role
const requireSuperAdmin = (req, res, next) => {
  if (req.user.role !== 'super_admin') {
    return res.status(403).json({
      error: 'Access denied',
      message: 'Super admin role required'
    });
  }
  next();
};

// Get all admins
router.get('/', authMiddleware, async (req, res) => {
  try {
    const admins = await AdminService.getAllAdmins();

    logger.info(`Admin list retrieved by: ${req.user.username}`);

    res.json({
      success: true,
      data: admins,
      message: 'Admins retrieved successfully'
    });
  } catch (error) {
    logger.error('Error retrieving admins:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to retrieve admins'
    });
  }
});

// Create new admin (super admin only)
router.post('/', authMiddleware, requireSuperAdmin, [
  body('username')
    .isLength({ min: 3, max: 50 })
    .withMessage('Username must be 3-50 characters')
    .isAlphanumeric()
    .withMessage('Username must contain only letters and numbers'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one lowercase letter, one uppercase letter, and one number'),
  body('role')
    .isIn(['admin', 'super_admin'])
    .withMessage('Role must be either admin or super_admin'),
  body('email')
    .optional()
    .isEmail()
    .withMessage('Must be a valid email address'),
  body('fullName')
    .optional()
    .isLength({ min: 1, max: 100 })
    .withMessage('Full name must be 1-100 characters'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { username, password, role, email, fullName } = req.body;

    const result = await AdminService.createAdmin({
      username,
      password,
      role,
      email,
      fullName
    }, req.user.username);

    if (!result.success) {
      return res.status(400).json({
        error: 'Admin creation failed',
        message: result.message
      });
    }

    logger.info(`New admin created: ${username} by ${req.user.username}`);

    res.status(201).json({
      success: true,
      data: result.admin,
      message: 'Admin created successfully'
    });
  } catch (error) {
    logger.error('Error creating admin:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to create admin'
    });
  }
});

// Update admin password
router.patch('/password', authMiddleware, [
  body('currentPassword')
    .isLength({ min: 1 })
    .withMessage('Current password is required'),
  body('newPassword')
    .isLength({ min: 8 })
    .withMessage('New password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('New password must contain at least one lowercase letter, one uppercase letter, and one number'),
  body('confirmPassword')
    .custom((value, { req }) => {
      if (value !== req.body.newPassword) {
        throw new Error('Password confirmation does not match');
      }
      return true;
    }),
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

    const result = await AdminService.updateAdminPassword(
      req.user.id,
      currentPassword,
      newPassword
    );

    if (!result.success) {
      return res.status(400).json({
        error: 'Password update failed',
        message: result.message
      });
    }

    logger.info(`Password updated for admin: ${req.user.username}`);

    res.json({
      success: true,
      message: result.message
    });
  } catch (error) {
    logger.error('Error updating password:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to update password'
    });
  }
});

// Deactivate admin (super admin only)
router.patch('/:adminId/deactivate', authMiddleware, requireSuperAdmin, async (req, res) => {
  try {
    const { adminId } = req.params;

    if (!adminId || isNaN(adminId)) {
      return res.status(400).json({
        error: 'Invalid admin ID',
        message: 'Admin ID must be a valid number'
      });
    }

    // Prevent self-deactivation
    if (parseInt(adminId) === req.user.id) {
      return res.status(400).json({
        error: 'Invalid operation',
        message: 'Cannot deactivate your own account'
      });
    }

    const result = await AdminService.deactivateAdmin(
      parseInt(adminId),
      req.user.username
    );

    if (!result.success) {
      return res.status(400).json({
        error: 'Admin deactivation failed',
        message: result.message
      });
    }

    logger.info(`Admin deactivated: ID ${adminId} by ${req.user.username}`);

    res.json({
      success: true,
      message: result.message
    });
  } catch (error) {
    logger.error('Error deactivating admin:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to deactivate admin'
    });
  }
});

// Delete admin (super admin only)
router.delete('/:adminId', authMiddleware, requireSuperAdmin, async (req, res) => {
  try {
    const { adminId } = req.params;

    if (!adminId || isNaN(adminId)) {
      return res.status(400).json({
        error: 'Invalid admin ID',
        message: 'Admin ID must be a valid number'
      });
    }

    // Prevent self-deletion
    if (parseInt(adminId) === req.user.id) {
      return res.status(400).json({
        error: 'Invalid operation',
        message: 'Cannot delete your own account'
      });
    }

    const result = await AdminService.deleteAdmin(
      parseInt(adminId),
      req.user.username
    );

    if (!result.success) {
      return res.status(400).json({
        error: 'Admin deletion failed',
        message: result.message
      });
    }

    logger.info(`Admin deleted: ID ${adminId} by ${req.user.username}`);

    res.json({
      success: true,
      message: result.message
    });
  } catch (error) {
    logger.error('Error deleting admin:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to delete admin'
    });
  }
});

// Get admin statistics
router.get('/stats', authMiddleware, async (req, res) => {
  try {
    const stats = await AdminService.getAdminStats();

    logger.info(`Admin stats retrieved by: ${req.user.username}`);

    res.json({
      success: true,
      data: stats,
      message: 'Admin statistics retrieved successfully'
    });
  } catch (error) {
    logger.error('Error retrieving admin stats:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to retrieve admin statistics'
    });
  }
});

// Get current admin profile
router.get('/profile', authMiddleware, async (req, res) => {
  try {
    const { models } = require('../database');
    const { Admin, AdminSession } = models;

    const admin = await Admin.findByPk(req.user.id, {
      include: [{
        model: AdminSession,
        as: 'sessions',
        where: { status: 'active' },
        required: false,
        limit: 5,
        order: [['started_at', 'DESC']],
      }]
    });

    if (!admin) {
      return res.status(404).json({
        error: 'Admin not found',
        message: 'Admin profile not found'
      });
    }

    const profile = {
      ...admin.toSafeJSON(),
      activeSessions: admin.sessions ? admin.sessions.length : 0,
      recentSessions: admin.sessions || []
    };

    res.json({
      success: true,
      data: profile,
      message: 'Admin profile retrieved successfully'
    });
  } catch (error) {
    logger.error('Error retrieving admin profile:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to retrieve admin profile'
    });
  }
});

// Logout (revoke current session)
router.post('/logout', authMiddleware, async (req, res) => {
  try {
    const sessionToken = req.headers['x-session-token'];
    
    if (sessionToken) {
      await AdminService.logoutAdmin(sessionToken);
    }

    logger.info(`Admin logged out: ${req.user.username}`);

    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    logger.error('Error during logout:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Logout failed'
    });
  }
});

module.exports = router;
