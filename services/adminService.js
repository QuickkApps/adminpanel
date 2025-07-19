const { models } = require('../database');
const { Admin, AdminSession } = models;
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const logger = require('../utils/logger');
const { Op } = require('sequelize');

class AdminService {
  // Authenticate admin
  static async authenticateAdmin(username, password, sessionInfo = {}) {
    try {
      const admin = await Admin.findOne({
        where: { username, is_active: true }
      });

      if (!admin) {
        logger.warn(`Admin login attempt failed: User not found - ${username}`);
        return { success: false, message: 'Invalid credentials' };
      }

      // Check if account is locked
      if (admin.isLocked()) {
        logger.warn(`Admin login attempt failed: Account locked - ${username}`);
        return { success: false, message: 'Account is temporarily locked' };
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(password, admin.password);
      if (!isValidPassword) {
        await admin.incrementLoginAttempts();
        logger.warn(`Admin login attempt failed: Invalid password - ${username}`);
        return { success: false, message: 'Invalid credentials' };
      }

      // Reset login attempts on successful login
      await admin.resetLoginAttempts();

      // Generate JWT token
      const token = jwt.sign(
        { 
          id: admin.id, 
          username: admin.username, 
          role: admin.role 
        },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );

      // Create admin session
      const sessionToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      const session = await AdminSession.create({
        admin_id: admin.id,
        session_token: sessionToken,
        jwt_token: token,
        ip_address: sessionInfo.ipAddress,
        user_agent: sessionInfo.userAgent,
        browser_info: sessionInfo.browserInfo,
        expires_at: expiresAt,
      });

      logger.info(`Admin login successful: ${username}`);

      return {
        success: true,
        token,
        sessionToken,
        admin: admin.toSafeJSON(),
        session: session.toJSON(),
      };
    } catch (error) {
      logger.error('Admin authentication error:', error);
      return { success: false, message: 'Authentication failed' };
    }
  }

  // Verify admin token
  static async verifyAdminToken(token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      const admin = await Admin.findByPk(decoded.id, {
        where: { is_active: true }
      });

      if (!admin) {
        return { success: false, message: 'Admin not found' };
      }

      // Find active session
      const session = await AdminSession.findOne({
        where: { 
          admin_id: admin.id,
          jwt_token: token,
          status: 'active'
        }
      });

      if (!session || !session.isActive()) {
        return { success: false, message: 'Session expired' };
      }

      // Update session activity
      await session.updateActivity();

      return {
        success: true,
        admin: admin.toSafeJSON(),
        session: session.toJSON(),
      };
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return { success: false, message: 'Token expired' };
      }
      logger.error('Token verification error:', error);
      return { success: false, message: 'Invalid token' };
    }
  }

  // Create new admin
  static async createAdmin(adminData, createdBy) {
    try {
      const {
        username,
        password,
        role = 'admin',
        email,
        fullName
      } = adminData;

      // Check if username already exists
      const existingAdmin = await Admin.findOne({
        where: { username }
      });

      if (existingAdmin) {
        return { success: false, message: 'Username already exists' };
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create admin
      const admin = await Admin.create({
        username,
        password: hashedPassword,
        role,
        email,
        full_name: fullName,
        is_active: true,
        created_by: createdBy,
      });

      logger.info(`New admin created: ${username} by ${createdBy}`);

      return {
        success: true,
        admin: admin.toSafeJSON(),
      };
    } catch (error) {
      logger.error('Error creating admin:', error);
      return { success: false, message: 'Failed to create admin' };
    }
  }

  // Get all admins
  static async getAllAdmins() {
    try {
      const admins = await Admin.findAll({
        include: [{
          model: AdminSession,
          as: 'sessions',
          where: { status: 'active' },
          required: false,
        }],
        order: [['created_at', 'DESC']],
      });

      return admins.map(admin => ({
        ...admin.toSafeJSON(),
        activeSessions: admin.sessions ? admin.sessions.length : 0,
        isOnline: admin.sessions && admin.sessions.length > 0,
      }));
    } catch (error) {
      logger.error('Error getting admins:', error);
      throw error;
    }
  }

  // Update admin password
  static async updateAdminPassword(adminId, currentPassword, newPassword) {
    try {
      const admin = await Admin.findByPk(adminId);
      if (!admin) {
        return { success: false, message: 'Admin not found' };
      }

      // Verify current password
      const isValidPassword = await bcrypt.compare(currentPassword, admin.password);
      if (!isValidPassword) {
        return { success: false, message: 'Current password is incorrect' };
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // Update password
      await admin.update({ password: hashedPassword });

      // Revoke all existing sessions except current one
      await AdminSession.update(
        { status: 'revoked', ended_at: new Date() },
        { where: { admin_id: adminId, status: 'active' } }
      );

      logger.info(`Password updated for admin: ${admin.username}`);

      return { success: true, message: 'Password updated successfully' };
    } catch (error) {
      logger.error('Error updating admin password:', error);
      return { success: false, message: 'Failed to update password' };
    }
  }

  // Logout admin
  static async logoutAdmin(sessionToken) {
    try {
      const session = await AdminSession.findOne({
        where: { session_token: sessionToken, status: 'active' }
      });

      if (session) {
        await session.revoke();
        logger.info(`Admin session revoked: ${sessionToken}`);
      }

      return { success: true };
    } catch (error) {
      logger.error('Error logging out admin:', error);
      return { success: false, message: 'Logout failed' };
    }
  }

  // Deactivate admin
  static async deactivateAdmin(adminId, deactivatedBy) {
    try {
      const admin = await Admin.findByPk(adminId);
      if (!admin) {
        return { success: false, message: 'Admin not found' };
      }

      // Don't allow deactivating the last super admin
      if (admin.role === 'super_admin') {
        const superAdminCount = await Admin.count({
          where: { role: 'super_admin', is_active: true }
        });
        if (superAdminCount <= 1) {
          return { success: false, message: 'Cannot deactivate the last super admin' };
        }
      }

      await admin.update({
        is_active: false,
        updated_by: deactivatedBy
      });

      // Revoke all active sessions
      await AdminSession.update(
        { status: 'revoked', ended_at: new Date() },
        { where: { admin_id: adminId, status: 'active' } }
      );

      logger.info(`Admin deactivated: ${admin.username} by ${deactivatedBy}`);

      return { success: true, message: 'Admin deactivated successfully' };
    } catch (error) {
      logger.error('Error deactivating admin:', error);
      return { success: false, message: 'Failed to deactivate admin' };
    }
  }

  // Delete admin
  static async deleteAdmin(adminId, deletedBy) {
    try {
      const admin = await Admin.findByPk(adminId);
      if (!admin) {
        return { success: false, message: 'Admin not found' };
      }

      // Don't allow deleting the last super admin
      if (admin.role === 'super_admin') {
        const superAdminCount = await Admin.count({
          where: { role: 'super_admin', is_active: true }
        });
        if (superAdminCount <= 1) {
          return { success: false, message: 'Cannot delete the last super admin' };
        }
      }

      const adminUsername = admin.username;

      // Delete all admin sessions first (due to foreign key constraints)
      await AdminSession.destroy({
        where: { admin_id: adminId }
      });

      // Delete the admin
      await admin.destroy();

      logger.info(`Admin deleted: ${adminUsername} by ${deletedBy}`);

      return { success: true, message: 'Admin deleted successfully' };
    } catch (error) {
      logger.error('Error deleting admin:', error);
      return { success: false, message: 'Failed to delete admin' };
    }
  }

  // Get admin statistics
  static async getAdminStats() {
    try {
      const totalAdmins = await Admin.count();
      const activeAdmins = await Admin.count({ where: { is_active: true } });
      const onlineAdmins = await AdminSession.count({
        where: { status: 'active' },
        distinct: true,
        col: 'admin_id'
      });

      return {
        total: totalAdmins,
        active: activeAdmins,
        online: onlineAdmins,
      };
    } catch (error) {
      logger.error('Error getting admin stats:', error);
      throw error;
    }
  }

  // Clean up expired sessions
  static async cleanupExpiredSessions() {
    try {
      const expiredCount = await AdminSession.update(
        { status: 'expired', ended_at: new Date() },
        { 
          where: { 
            status: 'active',
            expires_at: { [Op.lt]: new Date() }
          } 
        }
      );

      if (expiredCount[0] > 0) {
        logger.info(`Cleaned up ${expiredCount[0]} expired admin sessions`);
      }

      return expiredCount[0];
    } catch (error) {
      logger.error('Error cleaning up expired sessions:', error);
      throw error;
    }
  }
}

module.exports = AdminService;
