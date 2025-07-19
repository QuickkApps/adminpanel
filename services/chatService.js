const { models } = require('../database');
const { ChatConversation, ChatMessage, User, Admin } = models;
const logger = require('../utils/logger');
const { Op } = require('sequelize');

class ChatService {
  // Create a new conversation
  static async createConversation(userId, initialMessage, options = {}) {
    try {
      const {
        subject = 'Support Request',
        priority = 'medium'
      } = options;

      // Validate user exists
      const user = await User.findByPk(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Create conversation
      const conversation = await ChatConversation.create({
        user_id: userId,
        subject,
        priority,
        last_message_at: new Date(),
        last_message_by: 'user',
        admin_unread_count: 1
      });

      // Create initial message
      const message = await ChatMessage.create({
        conversation_id: conversation.id,
        sender_type: 'user',
        sender_id: userId,
        message: initialMessage
      });

      logger.info(`New conversation created: ${conversation.id} by user ${userId}`);

      return {
        conversation,
        message
      };

    } catch (error) {
      logger.error('Error creating conversation:', error);
      throw error;
    }
  }

  // Send a message in a conversation
  static async sendMessage(conversationId, senderId, senderType, message, options = {}) {
    try {
      const { replyToId, messageType = 'text' } = options;

      // Validate conversation exists
      const conversation = await ChatConversation.findByPk(conversationId);
      if (!conversation) {
        throw new Error('Conversation not found');
      }

      // Validate sender access
      if (senderType === 'user' && conversation.user_id !== senderId) {
        throw new Error('Access denied to conversation');
      }

      // Validate message content
      if (!message || message.trim().length === 0) {
        throw new Error('Message content is required');
      }

      if (message.length > 5000) {
        throw new Error('Message too long (max 5000 characters)');
      }

      // Create message
      const newMessage = await ChatMessage.create({
        conversation_id: conversationId,
        sender_type: senderType,
        sender_id: senderId,
        message: message.trim(),
        message_type: messageType,
        reply_to_id: replyToId || null
      });

      // Update conversation
      const updateData = {
        last_message_at: new Date(),
        last_message_by: senderType
      };

      if (senderType === 'user') {
        updateData.admin_unread_count = conversation.admin_unread_count + 1;
        // Assign admin if not already assigned and this is a user message
        if (!conversation.admin_id) {
          // Could implement auto-assignment logic here
        }
      } else if (senderType === 'admin') {
        updateData.user_unread_count = conversation.user_unread_count + 1;
        // Assign admin to conversation if not already assigned
        if (!conversation.admin_id) {
          updateData.admin_id = senderId;
        }
      }

      await conversation.update(updateData);

      // Get sender information
      const sender = await newMessage.getSender();

      logger.info(`Message sent: ${senderType} ${senderId} in conversation ${conversationId}`);

      return {
        message: newMessage,
        sender,
        conversation: await ChatConversation.findByPk(conversationId)
      };

    } catch (error) {
      logger.error('Error sending message:', error);
      throw error;
    }
  }

  // Get conversations for a user
  static async getUserConversations(userId, options = {}) {
    try {
      const { status, page = 1, limit = 20 } = options;
      const offset = (page - 1) * limit;

      const whereClause = { user_id: userId };
      if (status) {
        whereClause.status = status;
      }

      const { count, rows: conversations } = await ChatConversation.findAndCountAll({
        where: whereClause,
        include: [
          {
            model: Admin,
            as: 'admin',
            attributes: ['id', 'username'],
            required: false
          },
          {
            model: ChatMessage,
            as: 'messages',
            limit: 1,
            order: [['created_at', 'DESC']],
            attributes: ['id', 'message', 'sender_type', 'created_at']
          }
        ],
        order: [['last_message_at', 'DESC']],
        limit: parseInt(limit),
        offset: offset
      });

      return {
        conversations,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count,
          totalPages: Math.ceil(count / limit)
        }
      };

    } catch (error) {
      logger.error('Error getting user conversations:', error);
      throw error;
    }
  }

  // Get conversations for admin
  static async getAdminConversations(options = {}) {
    try {
      const { status = 'open', adminId, page = 1, limit = 20 } = options;
      const offset = (page - 1) * limit;

      const whereClause = {};
      if (status) {
        whereClause.status = status;
      }
      if (adminId) {
        whereClause.admin_id = adminId;
      }

      const { count, rows: conversations } = await ChatConversation.findAndCountAll({
        where: whereClause,
        include: [
          {
            model: User,
            as: 'user',
            attributes: ['id', 'username', 'subscription_type', 'subscription_status']
          },
          {
            model: Admin,
            as: 'admin',
            attributes: ['id', 'username'],
            required: false
          },
          {
            model: ChatMessage,
            as: 'messages',
            limit: 1,
            order: [['created_at', 'DESC']],
            attributes: ['id', 'message', 'sender_type', 'created_at']
          }
        ],
        order: [['last_message_at', 'DESC']],
        limit: parseInt(limit),
        offset: offset
      });

      return {
        conversations,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count,
          totalPages: Math.ceil(count / limit)
        }
      };

    } catch (error) {
      logger.error('Error getting admin conversations:', error);
      throw error;
    }
  }

  // Get messages for a conversation
  static async getConversationMessages(conversationId, options = {}) {
    try {
      const { page = 1, limit = 50 } = options;
      const offset = (page - 1) * limit;

      // Validate conversation exists
      const conversation = await ChatConversation.findByPk(conversationId);
      if (!conversation) {
        throw new Error('Conversation not found');
      }

      const { count, rows: messages } = await ChatMessage.findAndCountAll({
        where: { conversation_id: conversationId },
        order: [['created_at', 'ASC']],
        limit: parseInt(limit),
        offset: offset,
        include: [
          {
            model: ChatMessage,
            as: 'replyTo',
            attributes: ['id', 'message', 'sender_type'],
            required: false
          }
        ]
      });

      // Get sender information for each message
      const messagesWithSenders = await Promise.all(
        messages.map(async (message) => {
          const sender = await message.getSender();
          return {
            ...message.toJSON(),
            sender: sender ? {
              id: sender.id,
              username: sender.username
            } : null
          };
        })
      );

      return {
        messages: messagesWithSenders,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count,
          totalPages: Math.ceil(count / limit)
        }
      };

    } catch (error) {
      logger.error('Error getting conversation messages:', error);
      throw error;
    }
  }

  // Mark messages as read
  static async markMessagesAsRead(conversationId, readerId, readerType) {
    try {
      // Validate conversation exists
      const conversation = await ChatConversation.findByPk(conversationId);
      if (!conversation) {
        throw new Error('Conversation not found');
      }

      // Find unread messages from the other party
      const unreadMessages = await ChatMessage.findAll({
        where: {
          conversation_id: conversationId,
          status: { [Op.ne]: 'read' },
          sender_type: { [Op.ne]: readerType } // Don't mark own messages as read
        }
      });

      // Mark messages as read
      await Promise.all(
        unreadMessages.map(message => message.markAsRead(readerId))
      );

      // Update conversation unread counts
      const updateData = {};
      if (readerType === 'user') {
        updateData.user_unread_count = 0;
      } else if (readerType === 'admin') {
        updateData.admin_unread_count = 0;
      }

      await conversation.update(updateData);

      logger.info(`Messages marked as read: ${unreadMessages.length} in conversation ${conversationId} by ${readerType} ${readerId}`);

      return {
        markedCount: unreadMessages.length,
        messageIds: unreadMessages.map(m => m.id)
      };

    } catch (error) {
      logger.error('Error marking messages as read:', error);
      throw error;
    }
  }
}

  // Update conversation status
  static async updateConversationStatus(conversationId, status, adminId) {
    try {
      const conversation = await ChatConversation.findByPk(conversationId);
      if (!conversation) {
        throw new Error('Conversation not found');
      }

      const updateData = { status };
      if (status === 'closed') {
        updateData.closed_at = new Date();
        updateData.closed_by = adminId;
      }

      await conversation.update(updateData);

      logger.info(`Conversation status updated: ${conversationId} to ${status} by admin ${adminId}`);

      return conversation;

    } catch (error) {
      logger.error('Error updating conversation status:', error);
      throw error;
    }
  }

  // Assign admin to conversation
  static async assignAdminToConversation(conversationId, adminId) {
    try {
      const conversation = await ChatConversation.findByPk(conversationId);
      if (!conversation) {
        throw new Error('Conversation not found');
      }

      const admin = await Admin.findByPk(adminId);
      if (!admin) {
        throw new Error('Admin not found');
      }

      await conversation.update({ admin_id: adminId });

      logger.info(`Admin ${adminId} assigned to conversation ${conversationId}`);

      return conversation;

    } catch (error) {
      logger.error('Error assigning admin to conversation:', error);
      throw error;
    }
  }

  // Get conversation statistics
  static async getConversationStats() {
    try {
      const stats = await ChatConversation.findAll({
        attributes: [
          'status',
          [models.sequelize.fn('COUNT', models.sequelize.col('id')), 'count']
        ],
        group: ['status']
      });

      const totalMessages = await ChatMessage.count();
      const totalConversations = await ChatConversation.count();

      const unassignedConversations = await ChatConversation.count({
        where: {
          admin_id: null,
          status: 'open'
        }
      });

      return {
        conversationsByStatus: stats.reduce((acc, stat) => {
          acc[stat.status] = parseInt(stat.dataValues.count);
          return acc;
        }, {}),
        totalConversations,
        totalMessages,
        unassignedConversations
      };

    } catch (error) {
      logger.error('Error getting conversation stats:', error);
      throw error;
    }
  }

  // Search conversations
  static async searchConversations(query, options = {}) {
    try {
      const { userType, userId, page = 1, limit = 20 } = options;
      const offset = (page - 1) * limit;

      const whereClause = {};
      if (userType === 'user') {
        whereClause.user_id = userId;
      }

      const { count, rows: conversations } = await ChatConversation.findAndCountAll({
        where: whereClause,
        include: [
          {
            model: User,
            as: 'user',
            attributes: ['id', 'username'],
            where: userType === 'admin' ? {
              username: { [Op.like]: `%${query}%` }
            } : undefined
          },
          {
            model: Admin,
            as: 'admin',
            attributes: ['id', 'username'],
            required: false
          },
          {
            model: ChatMessage,
            as: 'messages',
            where: {
              message: { [Op.like]: `%${query}%` }
            },
            limit: 1,
            order: [['created_at', 'DESC']],
            attributes: ['id', 'message', 'sender_type', 'created_at'],
            required: false
          }
        ],
        order: [['last_message_at', 'DESC']],
        limit: parseInt(limit),
        offset: offset
      });

      return {
        conversations,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count,
          totalPages: Math.ceil(count / limit)
        }
      };

    } catch (error) {
      logger.error('Error searching conversations:', error);
      throw error;
    }
  }

  // Validate message content
  static validateMessage(message) {
    if (!message || typeof message !== 'string') {
      return { valid: false, error: 'Message must be a string' };
    }

    const trimmed = message.trim();
    if (trimmed.length === 0) {
      return { valid: false, error: 'Message cannot be empty' };
    }

    if (trimmed.length > 5000) {
      return { valid: false, error: 'Message too long (max 5000 characters)' };
    }

    // Basic HTML/script tag detection for security
    if (/<script|<iframe|javascript:/i.test(trimmed)) {
      return { valid: false, error: 'Message contains prohibited content' };
    }

    return { valid: true, message: trimmed };
  }

  // Get unread message count for user
  static async getUnreadCount(userId, userType) {
    try {
      if (userType === 'user') {
        const conversations = await ChatConversation.findAll({
          where: { user_id: userId },
          attributes: ['user_unread_count']
        });

        return conversations.reduce((total, conv) => total + conv.user_unread_count, 0);
      } else if (userType === 'admin') {
        const conversations = await ChatConversation.findAll({
          where: { admin_id: userId },
          attributes: ['admin_unread_count']
        });

        return conversations.reduce((total, conv) => total + conv.admin_unread_count, 0);
      }

      return 0;

    } catch (error) {
      logger.error('Error getting unread count:', error);
      throw error;
    }
  }
}

module.exports = ChatService;
