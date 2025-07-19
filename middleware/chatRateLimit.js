const rateLimit = require('express-rate-limit');
const logger = require('../utils/logger');

// Rate limiting for chat messages
const chatMessageRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // Limit each user to 30 messages per minute
  message: {
    error: 'Too many messages sent',
    message: 'Please slow down. You can send up to 30 messages per minute.',
    retryAfter: 60
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Rate limit by username for user endpoints
    if (req.body.username) {
      return `chat_user_${req.body.username}`;
    }
    // Rate limit by admin ID for admin endpoints
    if (req.user && req.user.id) {
      return `chat_admin_${req.user.id}`;
    }
    // Fallback to IP address
    return req.ip;
  },
  handler: (req, res) => {
    logger.warn(`Chat rate limit exceeded for ${req.ip} - ${req.body.username || req.user?.username || 'unknown'}`);
    res.status(429).json({
      error: 'Rate limit exceeded',
      message: 'Too many messages sent. Please slow down.',
      retryAfter: Math.round(req.rateLimit.resetTime / 1000)
    });
  },
  skip: (req) => {
    // Skip rate limiting for admin endpoints in development
    if (process.env.NODE_ENV === 'development' && req.user?.role === 'super_admin') {
      return true;
    }
    return false;
  }
});

// Rate limiting for conversation creation
const conversationCreationRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each user to 5 new conversations per 15 minutes
  message: {
    error: 'Too many conversations created',
    message: 'Please wait before creating another conversation.',
    retryAfter: 900
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    if (req.body.username) {
      return `conv_user_${req.body.username}`;
    }
    return req.ip;
  },
  handler: (req, res) => {
    logger.warn(`Conversation creation rate limit exceeded for ${req.ip} - ${req.body.username || 'unknown'}`);
    res.status(429).json({
      error: 'Rate limit exceeded',
      message: 'Too many conversations created. Please wait before creating another one.',
      retryAfter: Math.round(req.rateLimit.resetTime / 1000)
    });
  }
});

// Rate limiting for typing indicators
const typingIndicatorRateLimit = rateLimit({
  windowMs: 10 * 1000, // 10 seconds
  max: 20, // Limit typing indicators to 20 per 10 seconds
  message: {
    error: 'Too many typing indicators',
    message: 'Please reduce typing indicator frequency.'
  },
  standardHeaders: false,
  legacyHeaders: false,
  keyGenerator: (req) => {
    if (req.body.username) {
      return `typing_user_${req.body.username}`;
    }
    if (req.user && req.user.id) {
      return `typing_admin_${req.user.id}`;
    }
    return req.ip;
  },
  handler: (req, res) => {
    // Silently reject excessive typing indicators
    res.status(429).json({
      error: 'Rate limit exceeded',
      message: 'Too many typing indicators.'
    });
  }
});

module.exports = {
  chatMessageRateLimit,
  conversationCreationRateLimit,
  typingIndicatorRateLimit
};
