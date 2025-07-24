const express = require('express');
const { body, validationResult, param } = require('express-validator');
const { models } = require('../database');
const authMiddleware = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();
const { VpnServer, Admin, AdminSetting } = models;

// Get all VPN servers (admin only)
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { page = 1, limit = 50, country, active } = req.query;
    const offset = (page - 1) * limit;

    const whereClause = {};
    if (country) whereClause.country_short = country;
    if (active !== undefined) whereClause.is_active = active === 'true';

    const servers = await VpnServer.findAndCountAll({
      where: whereClause,
      include: [{
        model: Admin,
        as: 'creator',
        attributes: ['id', 'username'],
      }],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['created_at', 'DESC']],
    });

    res.json({
      success: true,
      data: servers.rows,
      pagination: {
        total: servers.count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(servers.count / limit),
      },
    });
  } catch (error) {
    logger.error('Error fetching VPN servers:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch VPN servers',
      message: error.message,
    });
  }
});

// Get active VPN servers (public endpoint for Flutter app)
router.get('/active', async (req, res) => {
  try {
    // Get the filtering setting from admin settings
    const showOnlyCustom = await AdminSetting.getShowOnlyCustomServers();

    // Use the new filtered method instead of getActiveServers
    const servers = await VpnServer.getFilteredServers(showOnlyCustom);
    const flutterFormatServers = servers.map(server => server.toFlutterFormat());

    logger.info(`Serving ${flutterFormatServers.length} VPN servers (showOnlyCustom: ${showOnlyCustom})`);

    res.json({
      success: true,
      data: flutterFormatServers,
      count: flutterFormatServers.length,
      _metadata: {
        showOnlyCustomServers: showOnlyCustom,
        totalServers: flutterFormatServers.length,
      },
    });
  } catch (error) {
    logger.error('Error fetching active VPN servers:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch active VPN servers',
      message: error.message,
    });
  }
});

// Get VPN server by ID
router.get('/:id', [
  authMiddleware,
  param('id').isInt().withMessage('Server ID must be an integer'),
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

    const server = await VpnServer.findByPk(req.params.id, {
      include: [{
        model: Admin,
        as: 'creator',
        attributes: ['id', 'username'],
      }],
    });

    if (!server) {
      return res.status(404).json({
        success: false,
        error: 'VPN server not found',
      });
    }

    res.json({
      success: true,
      data: server,
    });
  } catch (error) {
    logger.error('Error fetching VPN server:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch VPN server',
      message: error.message,
    });
  }
});

// Create new VPN server
router.post('/', [
  authMiddleware,
  // Required fields
  body('name').trim().isLength({ min: 1, max: 100 }).withMessage('Server name is required (1-100 characters)'),
  body('country_short').trim().isLength({ min: 2, max: 10 }).withMessage('Country code is required (2-10 characters)'),
  body('openvpn_config_base64').notEmpty().withMessage('OpenVPN configuration file is required'),

  // Optional fields
  body('hostname').optional().trim().isLength({ min: 1, max: 255 }).withMessage('Hostname must be 1-255 characters'),
  body('ip').optional().isIP().withMessage('Must be a valid IP address'),
  body('port').optional().isInt({ min: 1, max: 65535 }).withMessage('Port must be between 1-65535'),
  body('protocol').optional().isIn(['udp', 'tcp']).withMessage('Protocol must be udp or tcp'),
  body('country_long').optional().trim().isLength({ min: 1, max: 100 }).withMessage('Country name must be 1-100 characters'),
  body('username').optional().trim().isLength({ max: 100 }).withMessage('Username too long (max 100 characters)'),
  body('password').optional().trim().isLength({ max: 255 }).withMessage('Password too long (max 255 characters)'),
  body('speed').optional().isInt({ min: 0 }).withMessage('Speed must be non-negative'),
  body('ping').optional().trim().isLength({ max: 20 }).withMessage('Ping value too long (max 20 characters)'),
  body('max_connections').optional().isInt({ min: 1 }).withMessage('Max connections must be positive'),
  body('location').optional().trim().isLength({ max: 100 }).withMessage('Location too long (max 100 characters)'),
  body('description').optional().trim().isLength({ max: 1000 }).withMessage('Description too long (max 1000 characters)'),
  body('is_featured').optional().isBoolean().withMessage('Featured status must be true or false'),
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

    const serverData = {
      ...req.body,
      created_by: req.user.id,
      is_custom: true, // All servers created via admin panel are custom
    };

    const server = await VpnServer.create(serverData);

    logger.info(`VPN server created: ${server.name} by admin ${req.user.username}`);

    res.status(201).json({
      success: true,
      data: server,
      message: 'VPN server created successfully',
    });
  } catch (error) {
    logger.error('Error creating VPN server:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create VPN server',
      message: error.message,
    });
  }
});

// Update VPN server
router.put('/:id', [
  authMiddleware,
  param('id').isInt().withMessage('Server ID must be an integer'),
  body('name').optional().trim().isLength({ min: 1, max: 100 }).withMessage('Name must be 1-100 characters'),
  body('hostname').optional().trim().isLength({ min: 1, max: 255 }).withMessage('Hostname is required'),
  body('ip').optional().isIP().withMessage('Valid IP address is required'),
  body('port').optional().isInt({ min: 1, max: 65535 }).withMessage('Port must be between 1-65535'),
  body('protocol').optional().isIn(['udp', 'tcp']).withMessage('Protocol must be udp or tcp'),
  body('country_long').optional().trim().isLength({ min: 1, max: 100 }).withMessage('Country name is required'),
  body('country_short').optional().trim().isLength({ min: 2, max: 10 }).withMessage('Country code is required'),
  body('username').optional().trim().isLength({ max: 100 }).withMessage('Username too long'),
  body('password').optional().trim().isLength({ max: 255 }).withMessage('Password too long'),
  body('openvpn_config_base64').optional().notEmpty().withMessage('OpenVPN config cannot be empty'),
  body('speed').optional().isInt({ min: 0 }).withMessage('Speed must be non-negative'),
  body('ping').optional().trim().isLength({ max: 20 }).withMessage('Ping value too long'),
  body('max_connections').optional().isInt({ min: 1 }).withMessage('Max connections must be positive'),
  body('location').optional().trim().isLength({ max: 100 }).withMessage('Location too long'),
  body('description').optional().trim().isLength({ max: 1000 }).withMessage('Description too long'),
  body('is_active').optional().isBoolean().withMessage('Active status must be boolean'),
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

    const server = await VpnServer.findByPk(req.params.id);
    if (!server) {
      return res.status(404).json({
        success: false,
        error: 'VPN server not found',
      });
    }

    await server.update(req.body);

    logger.info(`VPN server updated: ${server.name} by admin ${req.user.username}`);

    res.json({
      success: true,
      data: server,
      message: 'VPN server updated successfully',
    });
  } catch (error) {
    logger.error('Error updating VPN server:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update VPN server',
      message: error.message,
    });
  }
});

// Delete VPN server
router.delete('/:id', [
  authMiddleware,
  param('id').isInt().withMessage('Server ID must be an integer'),
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

    const server = await VpnServer.findByPk(req.params.id);
    if (!server) {
      return res.status(404).json({
        success: false,
        error: 'VPN server not found',
      });
    }

    const serverName = server.name;
    await server.destroy();

    logger.info(`VPN server deleted: ${serverName} by admin ${req.user.username}`);

    res.json({
      success: true,
      message: 'VPN server deleted successfully',
    });
  } catch (error) {
    logger.error('Error deleting VPN server:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete VPN server',
      message: error.message,
    });
  }
});

// Toggle server active status
router.patch('/:id/toggle', [
  authMiddleware,
  param('id').isInt().withMessage('Server ID must be an integer'),
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

    const server = await VpnServer.findByPk(req.params.id);
    if (!server) {
      return res.status(404).json({
        success: false,
        error: 'VPN server not found',
      });
    }

    await server.update({ is_active: !server.is_active });

    logger.info(`VPN server ${server.is_active ? 'activated' : 'deactivated'}: ${server.name} by admin ${req.user.username}`);

    res.json({
      success: true,
      data: server,
      message: `VPN server ${server.is_active ? 'activated' : 'deactivated'} successfully`,
    });
  } catch (error) {
    logger.error('Error toggling VPN server status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to toggle VPN server status',
      message: error.message,
    });
  }
});

// Get VPN server filtering setting
router.get('/settings/filter', authMiddleware, async (req, res) => {
  try {
    const showOnlyCustom = await AdminSetting.getShowOnlyCustomServers();

    res.json({
      success: true,
      data: {
        showOnlyCustomServers: showOnlyCustom,
      },
    });
  } catch (error) {
    logger.error('Error fetching VPN server filter setting:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch filter setting',
      message: error.message,
    });
  }
});

// Update VPN server filtering setting
router.put('/settings/filter', [
  authMiddleware,
  body('showOnlyCustomServers').isBoolean().withMessage('showOnlyCustomServers must be a boolean'),
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

    const { showOnlyCustomServers } = req.body;
    await AdminSetting.setShowOnlyCustomServers(showOnlyCustomServers);

    logger.info(`VPN server filter setting updated: showOnlyCustomServers=${showOnlyCustomServers} by admin ${req.user.username}`);

    res.json({
      success: true,
      data: {
        showOnlyCustomServers,
      },
      message: 'Filter setting updated successfully',
    });
  } catch (error) {
    logger.error('Error updating VPN server filter setting:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update filter setting',
      message: error.message,
    });
  }
});

module.exports = router;
