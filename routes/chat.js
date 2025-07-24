const express = require('express');
const { body, query, param, validationResult } = require('express-validator');
const logger = require('../utils/logger');
const authMiddleware = require('../middleware/auth');
const rateLimitMiddleware = require('../middleware/rateLimit');
const { chatMessageRateLimit, conversationCreationRateLimit } = require('../middleware/chatRateLimit');
const MessageValidator = require('../utils/messageValidator');

const router = express.Router();

// Import models
const { models } = require('../database');
const { ChatConversation, ChatMessage, User, Admin } = models;

// Enhanced validation middleware for message content
const validateMessage = [
  body('message')
    .custom((value) => {
      const validation = MessageValidator.validateMessage(value);
      if (!validation.isValid) {
        throw new Error(validation.errors.join(', '));
      }
      return true;
    }),
];

// Validation for conversation creation
const validateConversation = [
  body('username')
    .custom((value) => {
      const validation = MessageValidator.validateUsername(value);
      if (!validation.isValid) {
        throw new Error(validation.errors.join(', '));
      }
      return true;
    }),
  body('subject')
    .optional()
    .custom((value) => {
      const validation = MessageValidator.validateSubject(value);
      if (!validation.isValid) {
        throw new Error(validation.errors.join(', '));
      }
      return true;
    }),
  body('priority')
    .optional()
    .custom((value) => {
      const validation = MessageValidator.validatePriority(value);
      return validation.isValid;
    }),
];

// Helper function to find or create a user for chat purposes
async function findOrCreateChatUser(username) {
  try {
    // First try to find existing user
    let user = await User.findOne({ where: { username } });

    if (!user) {
      // Create a basic user record for chat purposes
      user = await User.create({
        username: username,
        server_url: 'chat-only', // Placeholder server URL for chat-only users
        subscription_type: 'basic',
        subscription_status: 'active',
        max_connections: 1,
        current_connections: 0,
        total_connections: 0,
        last_login: new Date(),
        last_activity: new Date(),
        is_active: true,
        is_online: false,
        // Set expiry date to 1 year from now for chat-only users
        expiry_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
      });

      logger.info(`✅ Created new chat user: ${username} (ID: ${user.id})`);
    }

    return user;
  } catch (error) {
    logger.error(`❌ Error finding or creating chat user ${username}:`, error);
    throw error;
  }
}

// Get conversations for a user (user endpoint)
router.get('/conversations', async (req, res) => {
  try {
    // For user requests, we need to identify the user from the request
    // This will be handled differently based on how user authentication is implemented
    const { username } = req.query;

    if (!username) {
      return res.status(400).json({
        error: 'Username is required'
      });
    }

    // Find or create user (auto-create for chat purposes)
    const user = await findOrCreateChatUser(username);

    const conversations = await ChatConversation.findAll({
      where: { user_id: user.id },
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'username']
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
      order: [['last_message_at', 'DESC']]
    });

    res.json({
      success: true,
      conversations: conversations.map(conv => ({
        id: conv.id,
        status: conv.status,
        subject: conv.subject,
        priority: conv.priority,
        lastMessageAt: conv.last_message_at,
        lastMessageBy: conv.last_message_by,
        unreadCount: conv.user_unread_count,
        admin: conv.admin ? {
          id: conv.admin.id,
          username: conv.admin.username
        } : null,
        lastMessage: conv.messages[0] || null
      }))
    });

  } catch (error) {
    logger.error('Error getting user conversations:', error);
    res.status(500).json({
      error: 'Failed to get conversations',
      message: error.message
    });
  }
});

// Get chat statistics for admin (admin endpoint)
router.get('/admin/stats', authMiddleware, async (req, res) => {
  try {
    const { models } = require('../database');
    const { ChatConversation, ChatMessage } = models;

    // Get conversation counts by status
    const totalConversations = await ChatConversation.count();
    const openConversations = await ChatConversation.count({ where: { status: 'open' } });
    const closedConversations = await ChatConversation.count({ where: { status: 'closed' } });
    const pendingConversations = await ChatConversation.count({ where: { status: 'pending' } });

    // Get unread message counts
    const totalUnreadMessages = await ChatConversation.sum('admin_unread_count') || 0;

    res.json({
      success: true,
      stats: {
        totalConversations,
        openConversations,
        closedConversations,
        pendingConversations,
        unreadMessages: totalUnreadMessages
      }
    });

  } catch (error) {
    logger.error('Error getting chat stats:', error);
    res.status(500).json({
      error: 'Failed to get chat statistics',
      message: error.message
    });
  }
});

// Get conversations for admin (admin endpoint)
router.get('/admin/conversations', authMiddleware, [
  query('status').optional().custom(value => {
    if (!value || value === '') return true; // Allow empty status
    return ['open', 'closed', 'pending'].includes(value);
  }).withMessage('Invalid status'),
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
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
      status,
      page = 1,
      limit = 20
    } = req.query;

    const offset = (page - 1) * limit;

    // If status is empty or not provided, show all conversations
    const whereClause = {};
    if (status && status !== '') {
      whereClause.status = status;
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

    res.json({
      success: true,
      conversations: conversations.map(conv => ({
        id: conv.id,
        status: conv.status,
        subject: conv.subject,
        priority: conv.priority,
        lastMessageAt: conv.last_message_at,
        lastMessageBy: conv.last_message_by,
        unreadCount: conv.admin_unread_count,
        user: {
          id: conv.user.id,
          username: conv.user.username,
          subscriptionType: conv.user.subscription_type,
          subscriptionStatus: conv.user.subscription_status
        },
        admin: conv.admin ? {
          id: conv.admin.id,
          username: conv.admin.username
        } : null,
        lastMessage: conv.messages[0] || null,
        createdAt: conv.created_at
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        totalPages: Math.ceil(count / limit)
      }
    });

  } catch (error) {
    logger.error('Error getting admin conversations:', error);
    res.status(500).json({
      error: 'Failed to get conversations',
      message: error.message
    });
  }
});

// Get messages for a conversation
router.get('/conversations/:conversationId/messages', [
  param('conversationId').isInt().withMessage('Conversation ID must be an integer'),
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { conversationId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

    // Check if conversation exists
    const conversation = await ChatConversation.findByPk(conversationId);
    if (!conversation) {
      return res.status(404).json({
        error: 'Conversation not found'
      });
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
          id: message.id,
          message: message.message,
          senderType: message.sender_type,
          senderId: message.sender_id,
          sender: sender ? {
            id: sender.id,
            username: sender.username
          } : null,
          messageType: message.message_type,
          status: message.status,
          readAt: message.read_at,
          isEdited: message.is_edited,
          editedAt: message.edited_at,
          replyTo: message.replyTo,
          metadata: message.metadata,
          createdAt: message.created_at,
          updatedAt: message.updated_at
        };
      })
    );

    res.json({
      success: true,
      messages: messagesWithSenders,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        totalPages: Math.ceil(count / limit)
      }
    });

  } catch (error) {
    logger.error('Error getting conversation messages:', error);
    res.status(500).json({
      error: 'Failed to get messages',
      message: error.message
    });
  }
});

// Send a message (user endpoint)
router.post('/conversations/:conversationId/messages', chatMessageRateLimit, [
  param('conversationId').isInt().withMessage('Conversation ID must be an integer'),
  ...validateMessage,
  body('username')
    .custom((value) => {
      const validation = MessageValidator.validateUsername(value);
      if (!validation.isValid) {
        throw new Error(validation.errors.join(', '));
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

    const { conversationId } = req.params;
    const { message, username, replyToId } = req.body;

    // Validate and sanitize message
    const messageValidation = MessageValidator.validateMessage(message);
    if (!messageValidation.isValid) {
      return res.status(400).json({
        error: 'Invalid message',
        details: messageValidation.errors
      });
    }

    // Check for spam
    if (MessageValidator.isSpam(messageValidation.sanitizedMessage)) {
      logger.warn(`Spam message detected from user: ${username}`);
      return res.status(400).json({
        error: 'Message rejected',
        message: 'Your message was flagged as spam'
      });
    }

    // Validate username
    const usernameValidation = MessageValidator.validateUsername(username);
    if (!usernameValidation.isValid) {
      return res.status(400).json({
        error: 'Invalid username',
        details: usernameValidation.errors
      });
    }

    // Find user
    const user = await User.findOne({ where: { username: usernameValidation.sanitizedUsername } });
    if (!user) {
      return res.status(404).json({
        error: 'User not found'
      });
    }

    // Check if conversation exists and belongs to user
    const conversation = await ChatConversation.findOne({
      where: {
        id: conversationId,
        user_id: user.id
      }
    });

    if (!conversation) {
      return res.status(404).json({
        error: 'Conversation not found or access denied'
      });
    }

    // Check message frequency for this user
    const recentMessages = await ChatMessage.findAll({
      where: {
        conversation_id: conversationId,
        sender_type: 'user',
        sender_id: user.id
      },
      order: [['created_at', 'DESC']],
      limit: 10
    });

    const frequencyCheck = MessageValidator.checkUserMessageFrequency(user.id, recentMessages);
    if (!frequencyCheck.isWithinLimit) {
      return res.status(429).json({
        error: 'Rate limit exceeded',
        message: `Too many messages. Please wait before sending another message.`,
        retryAfter: 60
      });
    }

    // Create message with sanitized content
    const newMessage = await ChatMessage.create({
      conversation_id: conversationId,
      sender_type: 'user',
      sender_id: user.id,
      message: messageValidation.sanitizedMessage,
      reply_to_id: replyToId || null
    });

    // Update conversation
    await conversation.update({
      last_message_at: new Date(),
      last_message_by: 'user',
      admin_unread_count: conversation.admin_unread_count + 1
    });

    // Get the created message with sender info
    const messageWithSender = await ChatMessage.findByPk(newMessage.id, {
      include: [
        {
          model: ChatMessage,
          as: 'replyTo',
          attributes: ['id', 'message', 'sender_type'],
          required: false
        }
      ]
    });

    const sender = await messageWithSender.getSender();

    // Prepare message data for real-time emission
    const messageData = {
      id: messageWithSender.id,
      conversationId: parseInt(conversationId),
      message: messageWithSender.message,
      senderType: messageWithSender.sender_type,
      senderId: messageWithSender.sender_id,
      sender: sender ? {
        id: sender.id,
        username: sender.username
      } : null,
      messageType: messageWithSender.message_type,
      status: messageWithSender.status,
      replyTo: messageWithSender.replyTo,
      createdAt: messageWithSender.created_at
    };

    // Emit real-time message to connected clients
    if (req.io) {
      // Broadcast to conversation room (use same naming as WebSocket)
      req.io.to(`chat-${conversationId}`).emit('new-chat-message', messageData);

      // Only notify admins NOT currently in the chat room to prevent duplicates
      const adminSocketsNotInRoom = [];
      req.io.sockets.sockets.forEach((socket) => {
        if (socket.userRole === 'admin' && !socket.rooms.has(`chat-${conversationId}`)) {
          adminSocketsNotInRoom.push(socket);
        }
      });

      adminSocketsNotInRoom.forEach(adminSocket => {
        adminSocket.emit('new-user-message', {
          conversationId: parseInt(conversationId),
          message: messageData,
          conversation: {
            id: conversation.id,
            subject: conversation.subject,
            priority: conversation.priority,
            user: {
              id: user.id,
              username: user.username
            }
          }
        });
      });

      logger.info(`📢 REST API: Notified ${adminSocketsNotInRoom.length} admins not in chat room about new user message`);
    }

    res.status(201).json({
      success: true,
      message: messageData
    });

    logger.info(`User message sent: ${username} in conversation ${conversationId}`);

  } catch (error) {
    logger.error('Error sending user message:', error);
    res.status(500).json({
      error: 'Failed to send message',
      message: error.message
    });
  }
});

// Send a message (admin endpoint)
router.post('/admin/conversations/:conversationId/messages', authMiddleware, rateLimitMiddleware, [
  param('conversationId').isInt().withMessage('Conversation ID must be an integer'),
  ...validateMessage,
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { conversationId } = req.params;
    const { message, replyToId } = req.body;
    const adminId = req.user.id;

    // Check if conversation exists
    const conversation = await ChatConversation.findByPk(conversationId);
    if (!conversation) {
      return res.status(404).json({
        error: 'Conversation not found'
      });
    }

    // Assign admin to conversation if not already assigned
    if (!conversation.admin_id) {
      await conversation.update({ admin_id: adminId });
    }

    // Create message
    const newMessage = await ChatMessage.create({
      conversation_id: conversationId,
      sender_type: 'admin',
      sender_id: adminId,
      message: message,
      reply_to_id: replyToId || null
    });

    // Update conversation
    await conversation.update({
      last_message_at: new Date(),
      last_message_by: 'admin',
      user_unread_count: conversation.user_unread_count + 1
    });

    // Get the created message with sender info
    const messageWithSender = await ChatMessage.findByPk(newMessage.id, {
      include: [
        {
          model: ChatMessage,
          as: 'replyTo',
          attributes: ['id', 'message', 'sender_type'],
          required: false
        }
      ]
    });

    const sender = await messageWithSender.getSender();

    // Prepare message data for real-time emission
    const messageData = {
      id: messageWithSender.id,
      conversationId: parseInt(conversationId),
      message: messageWithSender.message,
      senderType: messageWithSender.sender_type,
      senderId: messageWithSender.sender_id,
      sender: sender ? {
        id: sender.id,
        username: sender.username
      } : null,
      messageType: messageWithSender.message_type,
      status: messageWithSender.status,
      replyTo: messageWithSender.replyTo,
      createdAt: messageWithSender.created_at
    };

    // Emit real-time message to connected clients
    if (req.io) {
      // Broadcast to conversation room (use same naming as WebSocket)
      req.io.to(`chat-${conversationId}`).emit('new-chat-message', messageData);
    }

    res.status(201).json({
      success: true,
      message: messageData
    });

    logger.info(`Admin message sent: ${req.user.username} in conversation ${conversationId}`);

  } catch (error) {
    logger.error('Error sending admin message:', error);
    res.status(500).json({
      error: 'Failed to send message',
      message: error.message
    });
  }
});

// Create a new conversation (user endpoint)
router.post('/conversations', conversationCreationRateLimit, [
  ...validateConversation,
  ...validateMessage,
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { username, subject, priority, message } = req.body;

    // Validate and sanitize inputs
    const usernameValidation = MessageValidator.validateUsername(username);
    const subjectValidation = MessageValidator.validateSubject(subject);
    const priorityValidation = MessageValidator.validatePriority(priority);
    const messageValidation = MessageValidator.validateMessage(message);

    if (!usernameValidation.isValid) {
      return res.status(400).json({
        error: 'Invalid username',
        details: usernameValidation.errors
      });
    }

    if (!messageValidation.isValid) {
      return res.status(400).json({
        error: 'Invalid message',
        details: messageValidation.errors
      });
    }

    // Check for spam
    if (MessageValidator.isSpam(messageValidation.sanitizedMessage)) {
      logger.warn(`Spam conversation creation attempt from user: ${username}`);
      return res.status(400).json({
        error: 'Message rejected',
        message: 'Your message was flagged as spam'
      });
    }

    // Find or create user (auto-create for chat purposes)
    const user = await findOrCreateChatUser(usernameValidation.sanitizedUsername);

    // Check if user has too many open conversations
    const openConversationsCount = await ChatConversation.count({
      where: {
        user_id: user.id,
        status: 'open'
      }
    });

    if (openConversationsCount >= 5) {
      return res.status(400).json({
        error: 'Too many open conversations',
        message: 'Please close some existing conversations before creating a new one'
      });
    }

    // Create conversation with sanitized data
    const conversation = await ChatConversation.create({
      user_id: user.id,
      subject: subjectValidation.sanitizedSubject,
      priority: priorityValidation.sanitizedPriority,
      last_message_at: new Date(),
      last_message_by: 'user',
      admin_unread_count: 1
    });

    // Create initial message with sanitized content
    const initialMessage = await ChatMessage.create({
      conversation_id: conversation.id,
      sender_type: 'user',
      sender_id: user.id,
      message: messageValidation.sanitizedMessage
    });

    res.status(201).json({
      success: true,
      conversation: {
        id: conversation.id,
        status: conversation.status,
        subject: conversation.subject,
        priority: conversation.priority,
        createdAt: conversation.created_at
      },
      message: {
        id: initialMessage.id,
        message: initialMessage.message,
        createdAt: initialMessage.created_at
      }
    });

    logger.info(`New conversation created by user: ${username} - ID: ${conversation.id}`);

  } catch (error) {
    logger.error('Error creating conversation:', error);
    res.status(500).json({
      error: 'Failed to create conversation',
      message: error.message
    });
  }
});

// Mark messages as read
router.patch('/conversations/:conversationId/messages/read', [
  param('conversationId').isInt().withMessage('Conversation ID must be an integer'),
  body('readerType').isIn(['user', 'admin']).withMessage('Reader type must be user or admin'),
  body('readerId').isInt().withMessage('Reader ID must be an integer'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { conversationId } = req.params;
    const { readerType, readerId } = req.body;

    // Check if conversation exists
    const conversation = await ChatConversation.findByPk(conversationId);
    if (!conversation) {
      return res.status(404).json({
        error: 'Conversation not found'
      });
    }

    // Mark unread messages as read
    const unreadMessages = await ChatMessage.findAll({
      where: {
        conversation_id: conversationId,
        status: { [require('sequelize').Op.ne]: 'read' },
        sender_type: { [require('sequelize').Op.ne]: readerType } // Don't mark own messages as read
      }
    });

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

    res.json({
      success: true,
      markedAsRead: unreadMessages.length
    });

    logger.info(`Messages marked as read: ${unreadMessages.length} in conversation ${conversationId} by ${readerType} ${readerId}`);

  } catch (error) {
    logger.error('Error marking messages as read:', error);
    res.status(500).json({
      error: 'Failed to mark messages as read',
      message: error.message
    });
  }
});

// Update conversation status (admin only)
router.patch('/admin/conversations/:conversationId/status', authMiddleware, [
  param('conversationId').isInt().withMessage('Conversation ID must be an integer'),
  body('status').isIn(['open', 'closed', 'pending']).withMessage('Invalid status'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { conversationId } = req.params;
    const { status } = req.body;
    const adminId = req.user.id;

    const conversation = await ChatConversation.findByPk(conversationId);
    if (!conversation) {
      return res.status(404).json({
        error: 'Conversation not found'
      });
    }

    const updateData = { status };
    if (status === 'closed') {
      updateData.closed_at = new Date();
      updateData.closed_by = adminId;
    }

    await conversation.update(updateData);

    res.json({
      success: true,
      conversation: {
        id: conversation.id,
        status: conversation.status,
        closedAt: conversation.closed_at,
        closedBy: conversation.closed_by
      }
    });

    logger.info(`Conversation status updated: ${conversationId} to ${status} by admin ${req.user.username}`);

  } catch (error) {
    logger.error('Error updating conversation status:', error);
    res.status(500).json({
      error: 'Failed to update conversation status',
      message: error.message
    });
  }
});

module.exports = router;
