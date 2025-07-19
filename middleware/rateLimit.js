const rateLimit = require('express-rate-limit');
const logger = require('../utils/logger');

const rateLimitMiddleware = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 500, // Increased limit for app endpoints
  message: {
    error: 'Too many requests',
    message: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: (req, res) => {
    logger.warn(`Rate limit exceeded for IP: ${req.ip} - Path: ${req.path}`);
    res.status(429).json({
      error: 'Too many requests',
      message: 'Too many requests from this IP, please try again later.'
    });
  },
  skip: (req) => {
    // Skip rate limiting for health check endpoints and app status updates
    return req.path === '/api/app/ping' ||
           req.path === '/api/app/status' ||
           req.path === '/api/config/app';
  }
});

module.exports = rateLimitMiddleware;
