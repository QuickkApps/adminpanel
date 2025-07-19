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
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ["http://localhost:3000"],
    methods: ["GET", "POST"]
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

// CORS configuration
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ["http://localhost:3000"],
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
app.use('/api/auth', authRoutes);

// Config routes - some need auth, some don't
app.use('/api/config', configRoutes);

// User and admin management routes
app.use('/api/users', usersRoutes);
app.use('/api/admins', adminsRoutes);

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
  logger.info(`Client connected: ${socket.id}`);

  socket.on('disconnect', async () => {
    logger.info(`Client disconnected: ${socket.id}`);

    // Handle user disconnection
    if (socket.userId && socket.userType === 'user') {
      try {
        await UserService.endUserSession(socket.sessionToken, 'disconnect');
        await UserService.updateUserOnlineStatus(socket.userId, false);
        connectedUsers.delete(socket.userId);

        // Notify admins of user disconnection
        socket.to('admin-room').emit('user-disconnected', {
          userId: socket.userId,
          username: socket.username,
          disconnectedAt: new Date().toISOString()
        });

        logger.info(`User session ended: ${socket.username}`);
      } catch (error) {
        logger.error('Error handling user disconnection:', error);
      }
    }

    // Handle admin disconnection
    if (socket.userRole === 'admin') {
      adminSockets.delete(socket.id);
    }
  });

  // Handle admin authentication for WebSocket
  socket.on('authenticate', async (data) => {
    try {
      const { token, userType = 'admin' } = data;
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      socket.userId = decoded.id;
      socket.username = decoded.username;
      socket.userRole = decoded.role;
      socket.userType = userType;

      if (userType === 'admin') {
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

        // End any existing active sessions for this user
        await UserService.endActiveUserSessions(user.id, 'new_connection');

        // Remove user from connected users map if already connected
        if (connectedUsers.has(user.id)) {
          const existingConnection = connectedUsers.get(user.id);
          if (existingConnection.socket && existingConnection.socket.connected) {
            existingConnection.socket.disconnect(true);
          }
          connectedUsers.delete(user.id);
          logger.info(`Removed existing connection for user: ${user.username}`);
        }

        // Create new user session
        session = await UserService.createUserSession(user.id, {
          sessionToken,
          socketId: socket.id,
          ipAddress: socket.handshake.address,
          userAgent: socket.handshake.headers['user-agent'],
          deviceInfo,
          appVersion
        });

        // Update user online status in database
        await UserService.updateUserOnlineStatus(user.id, true);

        socket.userId = user.id;
        socket.username = username;
        socket.sessionToken = sessionToken;
        socket.userType = 'user';

        // Store connection info for manual logins only
        connectedUsers.set(user.id, {
          socket,
          userInfo: user,
          sessionInfo: session,
          connectedAt: new Date()
        });

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

  // Get online users (admin only)
  socket.on('get-online-users', async (callback) => {
    logger.info(`WebSocket get-online-users request from ${socket.id}, role: ${socket.userRole}`);
    if (socket.userRole === 'admin' || socket.userRole === 'super_admin') {
      try {
        // Use the same data source as the REST API
        const onlineUsers = await UserService.getOnlineUsers();
        logger.info(`WebSocket returning ${onlineUsers.length} online users`);
        callback({ success: true, users: onlineUsers, count: onlineUsers.length });
      } catch (error) {
        logger.error('Error getting online users via WebSocket:', error);
        callback({ success: false, message: 'Failed to get online users' });
      }
    } else {
      logger.warn(`WebSocket get-online-users access denied for role: ${socket.userRole}`);
      callback({ success: false, message: 'Access denied' });
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

    // Start periodic cleanup of stale online users (every 5 minutes)
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

        // Find users marked online but not actually connected
        const staleUsers = onlineUsers.filter(user => !actuallyOnlineUserIds.includes(user.id));

        if (staleUsers.length > 0) {
          logger.info(`Found ${staleUsers.length} stale online users, cleaning up: [${staleUsers.map(u => u.username).join(', ')}]`);

          // Mark them as offline
          for (const user of staleUsers) {
            await UserService.updateUserOnlineStatus(user.id, false);
            logger.info(`Marked user ${user.username} (ID: ${user.id}) as offline`);
          }
        } else {
          logger.info('No stale users found during periodic cleanup');
        }
      } catch (error) {
        logger.error('Error during periodic cleanup:', error);
      }
    }, 5 * 60 * 1000); // 5 minutes
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Start the server
startServer();

module.exports = { app, server, io };
