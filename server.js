const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');
require('dotenv').config();

const logger = require('./utils/logger');
const { initializeDatabase } = require('./database');
const authRoutes = require('./routes/auth');
const configRoutes = require('./routes/config');
const appRoutes = require('./routes/app');
const usersRoutes = require('./routes/users');
const adminsRoutes = require('./routes/admins');
const authMiddleware = require('./middleware/auth');
const rateLimitMiddleware = require('./middleware/rateLimit');
const UserService = require('./services/userService');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.ALLOWED_ORIGINS?.split(',') || [
      "http://localhost:3000",
      "http://localhost:3001",
      "http://127.0.0.1:3001",
      "http://10.0.2.2:3001", // Android emulator
      "*" // Allow all origins for development
    ],
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true
  }
});

const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      scriptSrcAttr: ["'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// CORS configuration - Allow Flutter app connections
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3001",
    "http://10.0.2.2:3001", // Android emulator
    "*" // Allow all origins for development (remove in production)
  ],
  credentials: true
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging middleware
app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } }));

// Rate limiting - disabled for development
// app.use('/api/', rateLimitMiddleware);

// Make io available to routes
app.use((req, res, next) => {
  req.io = io;
  next();
});

// API Routes
const logsRoutes = require('./routes/logs');
const chatRoutes = require('./routes/chat');
app.use('/api/auth', authRoutes);

// Config routes - some need auth, some don't
app.use('/api/config', configRoutes);

// User and admin management routes
app.use('/api/users', usersRoutes);
app.use('/api/admins', adminsRoutes);

// Chat routes
app.use('/api/chat', chatRoutes);

app.use('/api/logs', authMiddleware, logsRoutes);
app.use('/api/app', appRoutes);

// Debug route for manual cleanup (development only)
if (process.env.NODE_ENV === 'development') {
  app.get('/api/debug/cleanup', authMiddleware, async (req, res) => {
    try {
      // Get all users marked as online in database
      const onlineUsers = await UserService.getOnlineUsers();

      // Check which ones are actually connected via WebSocket
      const actuallyOnlineUserIds = Array.from(connectedUsers.keys());

      logger.info(`Manual cleanup: DB shows ${onlineUsers.length} online users, WebSocket has ${actuallyOnlineUserIds.length} connections`);
      logger.info(`DB online user IDs: [${onlineUsers.map(u => u.id).join(', ')}]`);
      logger.info(`WebSocket connected user IDs: [${actuallyOnlineUserIds.join(', ')}]`);

        // Debug: Show detailed connection info
        logger.info(`Connected users Map size: ${connectedUsers.size}`);
        for (const [userId, connection] of connectedUsers.entries()) {
          logger.info(`  User ${userId}: socket ${connection.socket.id}, connected: ${connection.socket.connected}`);
        }

      // Find users marked online but not actually connected OR have disconnected sockets
      const staleUsers = onlineUsers.filter(user => {
        const connection = connectedUsers.get(user.id);
        return !connection || !connection.socket.connected;
      });

      // Clean up disconnected sockets from connectedUsers map
      for (const [userId, connection] of connectedUsers.entries()) {
        if (!connection.socket.connected) {
          logger.info(`Removing disconnected socket for user ${userId}`);
          connectedUsers.delete(userId);
        }
      }

      if (staleUsers.length > 0) {
        logger.info(`Found ${staleUsers.length} stale online users, cleaning up: [${staleUsers.map(u => u.username).join(', ')}]`);

        // Mark them as offline
        for (const user of staleUsers) {
          await UserService.updateUserOnlineStatus(user.id, false);
          logger.info(`Marked user ${user.username} (ID: ${user.id}) as offline`);
        }

        res.json({
          success: true,
          message: `Cleaned up ${staleUsers.length} stale users`,
          cleanedUsers: staleUsers.map(u => ({ id: u.id, username: u.username }))
        });
      } else {
        res.json({
          success: true,
          message: 'No stale users found',
          dbOnlineCount: onlineUsers.length,
          wsConnectedCount: connectedUsers.size
        });
      }
    } catch (error) {
      logger.error('Error during manual cleanup:', error);
      res.status(500).json({ success: false, message: 'Cleanup failed', error: error.message });
    }
  });
}

// Serve static files from client with cache control for development
if (process.env.NODE_ENV === 'development') {
  app.use(express.static(path.join(__dirname, 'client'), {
    etag: false,
    lastModified: false,
    setHeaders: (res, path) => {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
  }));
} else {
  app.use(express.static(path.join(__dirname, 'client')));
}

// Serve backup files for download (protected route)
app.use('/backups', authMiddleware, express.static(path.join(__dirname, 'backups')));

// Serve the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'client', 'index.html'));
});

// API info endpoint
app.get('/api', (req, res) => {
  res.json({
    message: 'Anume Admin Panel API',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      auth: '/api/auth',
      config: '/api/config',
      app: '/api/app'
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    message: 'The requested resource was not found'
  });
});

// Store for tracking connections
const connectedUsers = new Map(); // userId -> { socket, userInfo, connectedAt }
const adminSockets = new Map(); // socketId -> { socket, adminInfo }

// WebSocket connection handling
io.on('connection', (socket) => {
  logger.info(`Client connected: ${socket.id} from ${socket.handshake.address}`);

  // Set up heartbeat for this connection
  socket.isAlive = true;
  socket.missedPings = 0;
  socket.connectedAt = new Date();

  // Set up authentication timeout for unauthenticated connections
  const authTimeout = setTimeout(() => {
    if (!socket.isAuthenticated) {
      logger.info(`Disconnecting unauthenticated socket after timeout: ${socket.id}`);
      socket.disconnect(true);
    }
  }, 60000); // 60 seconds to authenticate

  // Clear timeout when socket authenticates
  socket.on('authenticate', () => {
    clearTimeout(authTimeout);
  });
  socket.on('pong', (data) => {
    socket.isAlive = true;
    socket.missedPings = 0;
    socket.lastPong = new Date();

    // Update last activity for user connections
    if (socket.userId && socket.userType === 'user') {
      socket.lastActivity = new Date();
    }

    // Log pong responses for debugging
    const connectionType = (socket.userRole === 'admin' || socket.userRole === 'super_admin') ? 'admin' :
                          socket.userType === 'user' ? 'user' : 'unauthenticated';
    const identifier = socket.username || socket.userId || socket.id;
    logger.info(`🏓 Received pong from ${connectionType}: ${identifier}`, data?.client_type ? `(${data.client_type})` : '');
  });

  // Debug: Log all events received from this socket
  socket.onAny((eventName, ...args) => {
    logger.info(`🔄 Socket ${socket.id} received event: ${eventName} with data: ${JSON.stringify(args)}`);
  });

  socket.on('disconnect', async () => {
    const connectionType = (socket.userRole === 'admin' || socket.userRole === 'super_admin') ? 'admin' :
                          socket.userType === 'user' ? 'user' : 'unauthenticated';
    const identifier = socket.username || socket.userId || socket.id;
    logger.info(`Client disconnected: ${identifier} (${connectionType})`);

    // Handle user disconnection - but don't immediately mark as offline
    // Give them a grace period for reconnection
    if (socket.userId && socket.userType === 'user') {
      try {
        // Set a delayed offline marking (30 seconds grace period)
        setTimeout(async () => {
          // Check if user has reconnected with a new socket
          const currentConnection = connectedUsers.get(socket.userId);
          if (!currentConnection || currentConnection.socket.id === socket.id) {
            // User hasn't reconnected, mark as offline
            await UserService.endUserSession(socket.sessionToken, 'disconnect');
            await UserService.updateUserOnlineStatus(socket.userId, false);
            connectedUsers.delete(socket.userId);

            // Notify admins of user disconnection
            socket.to('admin-room').emit('user-disconnected', {
              userId: socket.userId,
              username: socket.username,
              disconnectedAt: new Date().toISOString()
            });

            logger.info(`User session ended after grace period: ${socket.username}`);
          } else {
            logger.info(`User ${socket.username} reconnected, keeping online status`);
          }
        }, 120000); // 2 minute grace period for better stability

      } catch (error) {
        logger.error('Error handling user disconnection:', error);
      }
    }

    // Handle admin disconnection
    if (socket.userRole === 'admin') {
      adminSockets.delete(socket.id);
    }

    // Reset authentication flag
    socket.isAuthenticated = false;
  });

  // Handle admin authentication for WebSocket
  socket.on('authenticate', async (data) => {
    try {
      // Prevent multiple authentication attempts from the same socket
      if (socket.isAuthenticated) {
        logger.warn(`Socket ${socket.id} already authenticated, ignoring duplicate authentication attempt`);
        return;
      }

      const { token, userType = 'admin' } = data;
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      socket.userId = decoded.id;
      socket.username = decoded.username;
      socket.userRole = decoded.role;
      socket.userType = userType;
      socket.isAuthenticated = true;

      if (userType === 'admin') {
        // Check for existing admin sockets from the same user
        const existingAdminSockets = Array.from(adminSockets.values())
          .filter(adminSocket =>
            adminSocket.adminInfo.id === decoded.id &&
            adminSocket.socket.id !== socket.id
          );

        // Disconnect existing admin sockets from the same user
        existingAdminSockets.forEach(adminSocket => {
          logger.info(`Disconnecting duplicate admin socket: ${adminSocket.socket.id} for user ${decoded.username}`);
          adminSocket.socket.disconnect(true);
          adminSockets.delete(adminSocket.socket.id);
        });

        socket.join('admin-room');
        adminSockets.set(socket.id, {
          socket,
          adminInfo: decoded,
          connectedAt: new Date()
        });
        logger.info(`Admin socket authenticated: ${decoded.username}`);
      }

      socket.emit('authenticated', { success: true });
    } catch (error) {
      logger.warn(`Socket authentication failed: ${error.message}`);
      socket.emit('authenticated', { success: false, message: 'Invalid token' });
    }
  });

  // Handle user connection (from Flutter app)
  socket.on('user-connect', async (data) => {
    logger.info(`🔄 Received user-connect event: ${JSON.stringify(data)}`);
    try {
      const {
        username,
        serverUrl,
        sessionToken,
        deviceInfo,
        appVersion,
        isManualLogin = false  // New flag to distinguish manual login from auto-connect
      } = data;

      // Create or update user
      const user = await UserService.createOrUpdateUser({
        username,
        serverUrl,
        ipAddress: socket.handshake.address,
        userAgent: socket.handshake.headers['user-agent'],
        appVersion,
        deviceInfo
      });

      let session = null;

      if (isManualLogin) {
        // This is a manual login - create session and mark as online
        logger.info(`Manual user login: ${username}`);

        // Set socket properties first
        socket.userId = user.id;
        socket.username = username;
        socket.sessionToken = sessionToken;
        socket.userType = 'user';
        socket.lastActivity = new Date();

        // Check for existing connection and handle gracefully
        const existingConnection = connectedUsers.get(user.id);
        if (existingConnection && existingConnection.socket.id !== socket.id) {
          // Gracefully disconnect old socket without triggering offline status
          if (existingConnection.socket.connected) {
            existingConnection.socket.removeAllListeners('disconnect');
            existingConnection.socket.disconnect(true);
            logger.info(`Gracefully replaced previous socket for user: ${user.username}`);
          }
        }

        // Store connection info FIRST (before ending sessions)
        connectedUsers.set(user.id, {
          socket,
          userInfo: user,
          sessionInfo: null, // Will be set after session creation
          connectedAt: new Date(),
          lastActivity: new Date()
        });

        // Mark user as online FIRST (before ending old sessions)
        await UserService.updateUserOnlineStatus(user.id, true);

        // End any existing active sessions for this user (but keep online status)
        await UserService.endActiveUserSessions(user.id, 'new_connection');

        // Create new user session
        session = await UserService.createUserSession(user.id, {
          sessionToken,
          socketId: socket.id,
          ipAddress: socket.handshake.address,
          userAgent: socket.handshake.headers['user-agent'],
          deviceInfo,
          appVersion
        });

        // Update connection info with session
        const connection = connectedUsers.get(user.id);
        if (connection) {
          connection.sessionInfo = session;
        }

        // Notify admins of new user connection
        socket.to('admin-room').emit('user-connected', {
          userId: user.id,
          username,
          serverUrl,
          connectedAt: new Date().toISOString(),
          deviceInfo,
          appVersion
        });

        socket.emit('user-connected', { success: true, userId: user.id });
        logger.info(`User connected: ${username} from ${serverUrl}`);
      } else {
        // This is an automatic app connection - just register for config updates
        logger.info(`App connection (auto): ${username} - not marking as online user`);
        socket.appUsername = username;
        socket.userType = 'app';

        // For app connections, just confirm connection without creating session
        socket.emit('user-connected', { success: true, userId: user.id, type: 'app-connection' });
        logger.info(`App connected: ${username} from ${serverUrl} (not counted as online user)`);
      }

    } catch (error) {
      logger.error('Error handling user connection:', error);
      socket.emit('user-connected', { success: false, message: error.message });
    }
  });

  // Handle user logout (when user logs out but app stays connected)
  socket.on('user-logout', async (data) => {
    try {
      if (socket.userId && socket.userType === 'user') {
        logger.info(`User logout received: ${socket.username}`);

        // End user session but keep socket connected for app functionality
        await UserService.endUserSession(socket.sessionToken, 'logout');
        await UserService.updateUserOnlineStatus(socket.userId, false);
        connectedUsers.delete(socket.userId);

        // Notify admins of user logout
        socket.to('admin-room').emit('user-disconnected', {
          userId: socket.userId,
          username: socket.username,
          disconnectedAt: new Date().toISOString(),
          reason: 'logout'
        });

        // Clear user info from socket but keep socket connected
        const username = socket.username;
        delete socket.userId;
        delete socket.username;
        delete socket.sessionToken;
        delete socket.userType;

        socket.emit('user-logout-success', { success: true });
        logger.info(`User session ended for logout: ${username}`);
      } else {
        socket.emit('user-logout-error', { success: false, message: 'No active user session' });
      }
    } catch (error) {
      logger.error('Error handling user logout:', error);
      socket.emit('user-logout-error', { success: false, message: error.message });
    }
  });

  // Handle user activity updates (heartbeat)
  socket.on('user-activity', async (data) => {
    try {
      if (socket.userId && socket.userType === 'user') {
        // Update user's last activity
        await UserService.updateUserActivity(socket.userId);
        socket.lastActivity = new Date();

        // Reset ping counter since user is actively sending updates
        socket.isAlive = true;
        socket.missedPings = 0;

        // Update connection info
        const connection = connectedUsers.get(socket.userId);
        if (connection) {
          connection.lastActivity = new Date();
        }

        // Ensure user is still marked as online
        await UserService.updateUserOnlineStatus(socket.userId, true);

        // Send acknowledgment back to client
        socket.emit('activity-acknowledged', {
          timestamp: new Date().toISOString(),
          status: 'received'
        });

        logger.info(`💓 Activity heartbeat received from user: ${socket.username}`);
      }
    } catch (error) {
      logger.error('Error handling user activity:', error);
    }
  });



  // Subscribe to configuration updates
  socket.on('subscribe-config-updates', () => {
    if (socket.userRole === 'admin') {
      socket.join('config-updates');
      logger.info(`Admin subscribed to config updates: ${socket.id}`);
    } else {
      socket.join('config-updates');
      logger.info(`Client ${socket.id} subscribed to config updates`);
    }
  });

  // Handle admin activity updates to keep session alive
  socket.on('admin-activity', async (data) => {
    try {
      if (socket.userRole === 'admin' && socket.userId) {
        // Update admin session activity
        const AdminService = require('./services/adminService');
        await AdminService.updateAdminActivity(socket.userId, data.action || 'activity');

        // Update socket activity
        socket.lastActivity = new Date();
        socket.isAlive = true;
        socket.missedPings = 0;

        logger.debug(`💓 Admin activity update received from: ${socket.username || socket.id}`);

        // Send acknowledgment
        socket.emit('admin-activity-acknowledged', {
          timestamp: new Date().toISOString(),
          status: 'received'
        });
      }
    } catch (error) {
      logger.error('Error handling admin activity:', error);
    }
  });

  // Get online users (admin only)
  socket.on('get-online-users', async (callback) => {
    logger.info(`📡 WebSocket get-online-users request from ${socket.id}, role: ${socket.userRole}`);
    if (socket.userRole === 'admin' || socket.userRole === 'super_admin') {
      try {
        // Use the same data source as the REST API
        const onlineUsers = await UserService.getOnlineUsers();
        logger.info(`📡 WebSocket returning ${onlineUsers.length} online users to admin`);

        // Ensure callback is a function before calling it
        if (typeof callback === 'function') {
          callback({ success: true, users: onlineUsers, count: onlineUsers.length });
        } else {
          logger.warn('📡 get-online-users callback is not a function');
        }
      } catch (error) {
        logger.error('❌ Error getting online users via WebSocket:', error);
        if (typeof callback === 'function') {
          callback({ success: false, message: 'Failed to get online users' });
        }
      }
    } else {
      logger.warn(`🚫 Unauthorized get-online-users request from ${socket.id}, role: ${socket.userRole}`);
      if (typeof callback === 'function') {
        callback({ success: false, message: 'Access denied' });
      }
    }
  });

  // Disconnect user (admin action)
  socket.on('admin-disconnect-user', async (data) => {
    if (socket.userRole === 'admin') {
      try {
        const { userId, reason = 'admin_disconnect' } = data;
        const userConnection = connectedUsers.get(userId);

        if (userConnection) {
          // End user session
          await UserService.endUserSession(userConnection.sessionInfo.session_token, reason);
          await UserService.updateUserOnlineStatus(userId, false);

          // Disconnect user socket
          userConnection.socket.emit('force-disconnect', { reason });
          userConnection.socket.disconnect(true);

          // Remove from tracking
          connectedUsers.delete(userId);

          socket.emit('user-disconnect-success', { userId, reason });
          logger.info(`User ${userId} disconnected by admin: ${socket.username}`);
        } else {
          socket.emit('user-disconnect-error', { message: 'User not found or not connected' });
        }
      } catch (error) {
        logger.error('Error disconnecting user:', error);
        socket.emit('user-disconnect-error', { message: error.message });
      }
    }
  });

  // ===== CHAT WEBSOCKET EVENTS =====

  // Join chat room for real-time messaging
  socket.on('join-chat', async (data) => {
    try {
      const { conversationId, userType, userId } = data;

      // Validate conversation access
      const { models } = require('./database');
      const conversation = await models.ChatConversation.findByPk(conversationId);

      if (!conversation) {
        socket.emit('chat-error', { message: 'Conversation not found' });
        return;
      }

      // Check access permissions
      if (userType === 'user' && conversation.user_id !== userId) {
        socket.emit('chat-error', { message: 'Access denied to conversation' });
        return;
      }

      if (userType === 'admin' && socket.userRole !== 'admin' && socket.userRole !== 'super_admin') {
        socket.emit('chat-error', { message: 'Admin access required' });
        return;
      }

      // Join conversation room
      const roomName = `chat-${conversationId}`;

      // For admin users, check if there's already a socket from the same admin in this room
      if (userType === 'admin') {
        const socketsInRoom = Array.from(io.sockets.adapter.rooms.get(roomName) || []);

        // Find existing admin sockets from the same user in this room
        const existingAdminSockets = socketsInRoom
          .map(socketId => io.sockets.sockets.get(socketId))
          .filter(s => s &&
            s.userId === socket.userId &&
            s.id !== socket.id &&
            (s.userRole === 'admin' || s.userRole === 'super_admin')
          );

        // Remove existing admin sockets from the same user from this room
        existingAdminSockets.forEach(existingSocket => {
          existingSocket.leave(roomName);
          existingSocket.currentChatRoom = null;
          existingSocket.conversationId = null;
          logger.info(`Removed duplicate admin socket ${existingSocket.id} from room ${roomName}`);
        });
      }

      socket.join(roomName);
      socket.currentChatRoom = roomName;
      socket.conversationId = conversationId;

      socket.emit('chat-joined', { conversationId, room: roomName });
      logger.info(`${userType} ${userId} joined chat room: ${roomName}`);

    } catch (error) {
      logger.error('Error joining chat room:', error);
      socket.emit('chat-error', { message: 'Failed to join chat' });
    }
  });

  // Leave chat room
  socket.on('leave-chat', () => {
    if (socket.currentChatRoom) {
      socket.leave(socket.currentChatRoom);
      logger.info(`User left chat room: ${socket.currentChatRoom}`);
      socket.currentChatRoom = null;
      socket.conversationId = null;
    }
  });

  // Send chat message via WebSocket
  socket.on('send-chat-message', async (data) => {
    try {
      const { conversationId, message, senderType, senderId, replyToId } = data;

      if (!socket.currentChatRoom || socket.conversationId !== conversationId) {
        logger.error(`❌ Chat message blocked: socket.currentChatRoom=${socket.currentChatRoom}, socket.conversationId=${socket.conversationId}, requested conversationId=${conversationId}`);
        socket.emit('chat-error', { message: 'Not joined to conversation' });
        return;
      }

      logger.info(`✅ Chat message validation passed: room=${socket.currentChatRoom}, conversationId=${conversationId}`);

      // Validate message
      if (!message || message.trim().length === 0 || message.length > 5000) {
        socket.emit('chat-error', { message: 'Invalid message content' });
        return;
      }

      const { models } = require('./database');

      // Create message in database
      const newMessage = await models.ChatMessage.create({
        conversation_id: conversationId,
        sender_type: senderType,
        sender_id: senderId,
        message: message.trim(),
        reply_to_id: replyToId || null
      });

      // Update conversation
      const conversation = await models.ChatConversation.findByPk(conversationId);
      const updateData = {
        last_message_at: new Date(),
        last_message_by: senderType
      };

      if (senderType === 'user') {
        updateData.admin_unread_count = conversation.admin_unread_count + 1;
      } else {
        updateData.user_unread_count = conversation.user_unread_count + 1;
      }

      await conversation.update(updateData);

      // Get sender information
      const sender = await newMessage.getSender();

      // Prepare message data for broadcast
      const messageData = {
        id: newMessage.id,
        conversationId: conversationId,
        message: newMessage.message,
        senderType: newMessage.sender_type,
        senderId: newMessage.sender_id,
        sender: sender ? {
          id: sender.id,
          username: sender.username
        } : null,
        messageType: newMessage.message_type,
        status: newMessage.status,
        replyToId: newMessage.reply_to_id,
        createdAt: newMessage.created_at
      };

      // Broadcast to all users in the conversation room
      logger.info(`📡 Broadcasting message to room ${socket.currentChatRoom}: ${JSON.stringify(messageData)}`);
      io.to(socket.currentChatRoom).emit('new-chat-message', messageData);
      logger.info(`📡 Message broadcasted to room ${socket.currentChatRoom}`);

      // IMPORTANT: Also emit to the sender's socket to confirm message delivery
      socket.emit('message-delivered', {
        messageId: newMessage.id,
        conversationId: conversationId,
        status: 'delivered'
      });

      // Notify admins if message is from user (but NOT to admin-room to prevent duplicates)
      // The admin panel will receive the message via 'new-chat-message' if they're in the chat room
      if (senderType === 'user') {
        // Only send notification to admins NOT currently in the chat room
        const adminSocketsNotInRoom = Array.from(adminSockets.values()).filter(adminSocket => {
          return !adminSocket.socket.rooms.has(socket.currentChatRoom);
        });

        // Group admin sockets by user ID to avoid duplicate notifications to the same admin
        const uniqueAdminSockets = new Map();
        adminSocketsNotInRoom.forEach(adminSocket => {
          const adminUserId = adminSocket.userId || adminSocket.username || adminSocket.socket.id;
          if (!uniqueAdminSockets.has(adminUserId)) {
            uniqueAdminSockets.set(adminUserId, adminSocket);
          }
        });

        // Notify each unique admin about the new message
        uniqueAdminSockets.forEach(adminSocket => {
          adminSocket.socket.emit('new-user-message', {
            conversationId,
            message: messageData,
            conversation: {
              id: conversation.id,
              subject: conversation.subject,
              priority: conversation.priority,
              user: {
                id: conversation.user_id,
                username: sender?.username
              }
            }
          });
        });

        logger.info(`📢 Notified ${uniqueAdminSockets.size} unique admins not in chat room about new user message`);
      }

      logger.info(`Chat message sent: ${senderType} ${senderId} in conversation ${conversationId}`);

    } catch (error) {
      logger.error('Error sending chat message:', error);
      socket.emit('chat-error', { message: 'Failed to send message' });
    }
  });

  // Typing indicator
  socket.on('typing-start', (data) => {
    const { conversationId, senderType, senderId, senderName } = data;

    if (socket.currentChatRoom && socket.conversationId === conversationId) {
      socket.to(socket.currentChatRoom).emit('user-typing', {
        conversationId,
        senderType,
        senderId,
        senderName,
        isTyping: true
      });
    }
  });

  socket.on('typing-stop', (data) => {
    const { conversationId, senderType, senderId } = data;

    if (socket.currentChatRoom && socket.conversationId === conversationId) {
      socket.to(socket.currentChatRoom).emit('user-typing', {
        conversationId,
        senderType,
        senderId,
        isTyping: false
      });
    }
  });

  // Mark messages as read via WebSocket
  socket.on('mark-messages-read', async (data) => {
    try {
      const { conversationId, readerType, readerId } = data;

      if (!socket.currentChatRoom || socket.conversationId !== conversationId) {
        socket.emit('chat-error', { message: 'Not joined to conversation' });
        return;
      }

      const { models } = require('./database');
      const { Op } = require('sequelize');

      // Mark unread messages as read
      const unreadMessages = await models.ChatMessage.findAll({
        where: {
          conversation_id: conversationId,
          status: { [Op.ne]: 'read' },
          sender_type: { [Op.ne]: readerType } // Don't mark own messages as read
        }
      });

      await Promise.all(
        unreadMessages.map(message => message.markAsRead(readerId))
      );

      // Update conversation unread counts
      const conversation = await models.ChatConversation.findByPk(conversationId);
      const updateData = {};
      if (readerType === 'user') {
        updateData.user_unread_count = 0;
      } else if (readerType === 'admin') {
        updateData.admin_unread_count = 0;
      }

      await conversation.update(updateData);

      // Notify other participants that messages were read
      socket.to(socket.currentChatRoom).emit('messages-read', {
        conversationId,
        readerType,
        readerId,
        messageIds: unreadMessages.map(m => m.id)
      });

      socket.emit('messages-marked-read', {
        conversationId,
        markedCount: unreadMessages.length
      });

      logger.info(`Messages marked as read: ${unreadMessages.length} in conversation ${conversationId} by ${readerType} ${readerId}`);

    } catch (error) {
      logger.error('Error marking messages as read:', error);
      socket.emit('chat-error', { message: 'Failed to mark messages as read' });
    }
  });

  // Get conversation list via WebSocket
  socket.on('get-conversations', async (data, callback) => {
    try {
      const { userType, userId, status } = data;
      const { models } = require('./database');

      let conversations;

      if (userType === 'user') {
        // Get conversations for specific user
        conversations = await models.ChatConversation.findAll({
          where: { user_id: userId },
          include: [
            {
              model: models.Admin,
              as: 'admin',
              attributes: ['id', 'username'],
              required: false
            },
            {
              model: models.ChatMessage,
              as: 'messages',
              limit: 1,
              order: [['created_at', 'DESC']],
              attributes: ['id', 'message', 'sender_type', 'created_at']
            }
          ],
          order: [['last_message_at', 'DESC']]
        });
      } else if (userType === 'admin' && (socket.userRole === 'admin' || socket.userRole === 'super_admin')) {
        // Get conversations for admin
        const whereClause = {};
        if (status && status !== '') {
          whereClause.status = status;
        }
        conversations = await models.ChatConversation.findAll({
          where: whereClause,
          include: [
            {
              model: models.User,
              as: 'user',
              attributes: ['id', 'username', 'subscription_type', 'subscription_status']
            },
            {
              model: models.Admin,
              as: 'admin',
              attributes: ['id', 'username'],
              required: false
            },
            {
              model: models.ChatMessage,
              as: 'messages',
              limit: 1,
              order: [['created_at', 'DESC']],
              attributes: ['id', 'message', 'sender_type', 'created_at']
            }
          ],
          order: [['last_message_at', 'DESC']]
        });
      } else {
        callback({ success: false, message: 'Access denied' });
        return;
      }

      callback({
        success: true,
        conversations: conversations.map(conv => ({
          id: conv.id,
          status: conv.status,
          subject: conv.subject,
          priority: conv.priority,
          lastMessageAt: conv.last_message_at,
          lastMessageBy: conv.last_message_by,
          unreadCount: userType === 'user' ? conv.user_unread_count : conv.admin_unread_count,
          user: conv.user ? {
            id: conv.user.id,
            username: conv.user.username,
            subscriptionType: conv.user.subscription_type,
            subscriptionStatus: conv.user.subscription_status
          } : null,
          admin: conv.admin ? {
            id: conv.admin.id,
            username: conv.admin.username
          } : null,
          lastMessage: conv.messages[0] || null,
          createdAt: conv.created_at
        }))
      });

    } catch (error) {
      logger.error('Error getting conversations via WebSocket:', error);
      callback({ success: false, message: 'Failed to get conversations' });
    }
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Process terminated');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  server.close(() => {
    logger.info('Process terminated');
    process.exit(0);
  });
});

// Initialize database and start server
const startServer = async () => {
  try {
    // Initialize database
    const dbInitialized = await initializeDatabase();
    if (!dbInitialized) {
      logger.error('Failed to initialize database. Server will not start.');
      process.exit(1);
    }

    // Clear all online statuses from previous sessions
    await UserService.clearAllOnlineStatuses();

    // Start server
    server.listen(PORT, () => {
      logger.info(`Anume Admin Panel server running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`WebSocket enabled: ${process.env.WEBSOCKET_ENABLED !== 'false'}`);
      logger.info('Database initialized successfully');
    });

    // Start heartbeat mechanism to detect broken connections
    setInterval(() => {
      io.sockets.sockets.forEach((socket) => {
        if (socket.isAlive === false) {
          // Give more chances before disconnecting - increase tolerance
          if (socket.missedPings === undefined) {
            socket.missedPings = 0;
          }
          socket.missedPings++;

          // Different thresholds for different connection types
          let maxMissedPings = 8; // Default for user connections (4 minutes)

          // Be more lenient with admin connections to prevent unwanted disconnections
          if (socket.userRole === 'admin' || socket.userType === 'admin') {
            maxMissedPings = 20; // 10 minutes for admin connections
          } else if (!socket.isAuthenticated) {
            maxMissedPings = 3; // Be aggressive with unauthenticated connections (1.5 minutes)
          }

          if (socket.missedPings >= maxMissedPings) {
            const connectionType = (socket.userRole === 'admin' || socket.userRole === 'super_admin') ? 'admin' :
                                  socket.userType === 'user' ? 'user' : 'unauthenticated';
            const identifier = socket.username || socket.userId || socket.id;
            logger.info(`Terminating unresponsive ${connectionType} socket: ${identifier} (missed ${socket.missedPings} pings)`);
            return socket.disconnect(true);
          } else {
            const connectionType = (socket.userRole === 'admin' || socket.userRole === 'super_admin') ? 'admin' :
                                  socket.userType === 'user' ? 'user' : 'unauthenticated';
            const identifier = socket.username || socket.userId || socket.id;
            logger.info(`${connectionType} socket ${identifier} missed ping ${socket.missedPings}/${maxMissedPings}`);
          }
        } else {
          // Reset missed pings counter when socket responds
          socket.missedPings = 0;
        }

        socket.isAlive = false;
        // Send a ping event to the client
        socket.emit('ping', { timestamp: new Date().toISOString() });
      });
    }, 30000); // 30 seconds

    // Start periodic cleanup of stale online users (every 10 minutes - less aggressive)
    setInterval(async () => {
      try {
        // Get all users marked as online in database
        const onlineUsers = await UserService.getOnlineUsers();

        // Check which ones are actually connected via WebSocket
        const actuallyOnlineUserIds = Array.from(connectedUsers.keys());

        logger.info(`Periodic cleanup: DB shows ${onlineUsers.length} online users, WebSocket has ${actuallyOnlineUserIds.length} connections`);
        logger.info(`DB online user IDs: [${onlineUsers.map(u => u.id).join(', ')}]`);
        logger.info(`WebSocket connected user IDs: [${actuallyOnlineUserIds.join(', ')}]`);

        // Debug: Show detailed connection info
        logger.info(`Connected users Map size: ${connectedUsers.size}`);
        for (const [userId, connection] of connectedUsers.entries()) {
          logger.info(`  User ${userId}: socket ${connection.socket.id}, connected: ${connection.socket.connected}`);
        }

        // Clean up disconnected sockets from connectedUsers map
        for (const [userId, connection] of connectedUsers.entries()) {
          if (!connection.socket.connected) {
            logger.info(`Removing disconnected socket for user ${userId}`);
            connectedUsers.delete(userId);
          }
        }

        // Find users marked online but not actually connected for more than 10 minutes
        const staleUsers = onlineUsers.filter(user => {
          const connection = connectedUsers.get(user.id);
          if (!connection) {
            // Check if user was last active more than 10 minutes ago
            const lastActivity = user.last_activity || user.last_login;
            const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
            return !lastActivity || lastActivity < tenMinutesAgo;
          }
          return false;
        });

        if (staleUsers.length > 0) {
          logger.info(`Found ${staleUsers.length} stale online users (inactive >10min), cleaning up: [${staleUsers.map(u => u.username).join(', ')}]`);

          // Mark them as offline
          for (const user of staleUsers) {
            await UserService.updateUserOnlineStatus(user.id, false);
            logger.info(`Marked user ${user.username} (ID: ${user.id}) as offline due to inactivity`);
          }
        } else {
          logger.info('No stale users found during periodic cleanup');
        }
      } catch (error) {
        logger.error('Error during periodic cleanup:', error);
      }
    }, 10 * 60 * 1000); // 10 minutes (less aggressive)
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Start the server
startServer();

module.exports = { app, server, io };
