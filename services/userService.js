const { models } = require('../database');
const { User, UserSession } = models;
const logger = require('../utils/logger');
const { Op } = require('sequelize');

class UserService {
  // Create or update user from authentication data
  static async createOrUpdateUser(userData) {
    try {
      const {
        username,
        serverUrl,
        subscriptionType = 'basic',
        subscriptionStatus = 'active',
        expiryDate,
        maxConnections = 1,
        ipAddress,
        userAgent,
        appVersion,
        deviceInfo
      } = userData;

      const [user, created] = await User.findOrCreate({
        where: { username, server_url: serverUrl },
        defaults: {
          username,
          server_url: serverUrl,
          subscription_type: subscriptionType,
          subscription_status: subscriptionStatus,
          expiry_date: expiryDate,
          max_connections: maxConnections,
          last_login: new Date(),
          last_ip: ipAddress,
          user_agent: userAgent,
          app_version: appVersion,
          device_info: deviceInfo,
          is_active: true,
          is_online: false,
        }
      });

      if (!created) {
        // Update existing user
        await user.update({
          subscription_type: subscriptionType,
          subscription_status: subscriptionStatus,
          expiry_date: expiryDate,
          max_connections: maxConnections,
          last_login: new Date(),
          last_ip: ipAddress,
          user_agent: userAgent,
          app_version: appVersion,
          device_info: deviceInfo,
          is_active: true,
        });
      }

      logger.info(`User ${created ? 'created' : 'updated'}: ${username}`);
      return user;
    } catch (error) {
      logger.error('Error creating/updating user:', error);
      throw error;
    }
  }

  // Get all users with pagination
  static async getAllUsers(page = 1, limit = 50, filters = {}) {
    try {
      const offset = (page - 1) * limit;
      const where = {};

      // Apply filters
      if (filters.status) {
        where.subscription_status = filters.status;
      }
      if (filters.isActive !== undefined) {
        where.is_active = filters.isActive;
      }
      if (filters.isOnline !== undefined) {
        where.is_online = filters.isOnline;
      }
      if (filters.search) {
        where.username = {
          [Op.like]: `%${filters.search}%`
        };
      }

      const { count, rows } = await User.findAndCountAll({
        where,
        limit,
        offset,
        order: [['last_activity', 'DESC']],
        include: [{
          model: UserSession,
          as: 'sessions',
          where: { status: 'active' },
          required: false,
        }]
      });

      return {
        users: rows,
        total: count,
        page,
        totalPages: Math.ceil(count / limit),
        hasNext: page < Math.ceil(count / limit),
        hasPrev: page > 1,
      };
    } catch (error) {
      logger.error('Error getting users:', error);
      throw error;
    }
  }

  // Get online users
  static async getOnlineUsers() {
    try {
      const users = await User.findAll({
        where: {
          is_online: true,
          is_active: true
        },
        order: [['last_activity', 'DESC']],
      });

      logger.info(`Found ${users.length} online users`);
      return users;
    } catch (error) {
      logger.error('Error getting online users:', error);
      throw error;
    }
  }

  // Update user online status
  static async updateUserOnlineStatus(userId, isOnline) {
    try {
      const user = await User.findByPk(userId);
      if (!user) {
        throw new Error('User not found');
      }

      await user.update({
        is_online: isOnline,
        last_activity: new Date(),
        ...(isOnline && { current_connections: user.current_connections + 1 }),
        ...(!isOnline && { current_connections: Math.max(0, user.current_connections - 1) })
      });

      logger.info(`User ${user.username} online status updated: ${isOnline}`);
      return user;
    } catch (error) {
      logger.error('Error updating user online status:', error);
      throw error;
    }
  }

  // Update user activity (for heartbeat)
  static async updateUserActivity(userId) {
    try {
      const user = await User.findByPk(userId);
      if (!user) {
        throw new Error('User not found');
      }

      await user.update({
        last_activity: new Date()
      });

      return user;
    } catch (error) {
      logger.error('Error updating user activity:', error);
      throw error;
    }
  }

  // Clear all online statuses (called on server startup)
  static async clearAllOnlineStatuses() {
    try {
      const result = await User.update(
        {
          is_online: false,
          current_connections: 0
        },
        {
          where: { is_online: true }
        }
      );

      logger.info(`Cleared online status for ${result[0]} users on server startup`);
      return result[0];
    } catch (error) {
      logger.error('Error clearing online statuses:', error);
      throw error;
    }
  }

  // Create user session
  static async createUserSession(userId, sessionData) {
    try {
      const {
        sessionToken,
        socketId,
        ipAddress,
        userAgent,
        deviceInfo,
        appVersion,
        connectionType = 'mobile'
      } = sessionData;

      const session = await UserSession.create({
        user_id: userId,
        session_token: sessionToken,
        socket_id: socketId,
        ip_address: ipAddress,
        user_agent: userAgent,
        device_info: deviceInfo,
        app_version: appVersion,
        connection_type: connectionType,
        status: 'active',
      });

      // Update user online status
      await User.update(
        { 
          is_online: true,
          last_activity: new Date(),
        },
        { where: { id: userId } }
      );

      logger.info(`User session created for user ID: ${userId}`);
      return session;
    } catch (error) {
      logger.error('Error creating user session:', error);
      throw error;
    }
  }

  // End user session
  static async endUserSession(sessionToken, reason = 'normal') {
    try {
      const session = await UserSession.findOne({
        where: { session_token: sessionToken, status: 'active' }
      });

      if (session) {
        await session.endSession(reason);

        // Check if user has any other active sessions
        const activeSessions = await UserSession.count({
          where: { 
            user_id: session.user_id, 
            status: 'active' 
          }
        });

        // If no active sessions, mark user as offline
        if (activeSessions === 0) {
          await User.update(
            { is_online: false },
            { where: { id: session.user_id } }
          );
        }

        logger.info(`User session ended: ${sessionToken}`);
        return session;
      }

      return null;
    } catch (error) {
      logger.error('Error ending user session:', error);
      throw error;
    }
  }

  // End all active sessions for a user (without affecting online status)
  static async endActiveUserSessions(userId, reason = 'new_connection') {
    try {
      const activeSessions = await UserSession.findAll({
        where: {
          user_id: userId,
          status: 'active'
        }
      });

      if (activeSessions.length > 0) {
        // End all active sessions (just update the session records, don't affect user online status)
        for (const session of activeSessions) {
          // Directly update session without triggering user offline logic
          session.ended_at = new Date();
          session.status = 'inactive';
          session.disconnect_reason = reason;
          session.duration_seconds = Math.floor((session.ended_at - session.started_at) / 1000);
          await session.save();
        }

        logger.info(`Ended ${activeSessions.length} active sessions for user ID: ${userId}`);
        return activeSessions.length;
      }

      return 0;
    } catch (error) {
      logger.error('Error ending active user sessions:', error);
      throw error;
    }
  }

  // Get user statistics
  static async getUserStats() {
    try {
      const totalUsers = await User.count();
      const activeUsers = await User.count({ where: { is_active: true } });
      const onlineUsers = await User.count({ where: { is_online: true } });
      const premiumUsers = await User.count({ 
        where: { subscription_type: 'premium' } 
      });

      return {
        total: totalUsers,
        active: activeUsers,
        online: onlineUsers,
        premium: premiumUsers,
      };
    } catch (error) {
      logger.error('Error getting user stats:', error);
      throw error;
    }
  }

  // Update user activity
  static async updateUserActivity(userId, sessionToken = null) {
    try {
      await User.update(
        { last_activity: new Date() },
        { where: { id: userId } }
      );

      if (sessionToken) {
        const session = await UserSession.findOne({
          where: { session_token: sessionToken, status: 'active' }
        });
        if (session) {
          await session.updateActivity();
        }
      }
    } catch (error) {
      logger.error('Error updating user activity:', error);
      throw error;
    }
  }

  // Disconnect user (admin action)
  static async disconnectUser(userId, reason = 'admin_disconnect') {
    try {
      // End all active sessions for the user
      const activeSessions = await UserSession.findAll({
        where: { user_id: userId, status: 'active' }
      });

      for (const session of activeSessions) {
        await session.endSession(reason);
      }

      // Mark user as offline
      await User.update(
        { is_online: false },
        { where: { id: userId } }
      );

      logger.info(`User disconnected by admin: ${userId}`);
      return activeSessions.length;
    } catch (error) {
      logger.error('Error disconnecting user:', error);
      throw error;
    }
  }
}

module.exports = UserService;
