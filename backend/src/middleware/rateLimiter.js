const rateLimit = require('express-rate-limit');
const { errorResponse } = require('../utils/response');

// General API rate limiter
const generalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // requests per window
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests, please try again later',
      details: null
    },
    timestamp: new Date().toISOString()
  },
  standardHeaders: true, // Return rate limit info in headers
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Use user ID if authenticated, otherwise use IP
    return req.user?.id || req.ip;
  },
  skip: (req) => {
    // Skip rate limiting in test environment
    return process.env.NODE_ENV === 'test';
  }
});

// Stricter rate limiter for capture operations
const captureLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: (req) => {
    // Different limits based on user plan
    if (!req.user) return 10; // Anonymous users get very limited access
    
    switch (req.user.planType) {
      case 'free': return 50;
      case 'pro': return 500;
      case 'business': return 2000;
      case 'enterprise': return Infinity;
      default: return 50;
    }
  },
  message: {
    success: false,
    error: {
      code: 'CAPTURE_LIMIT_EXCEEDED', 
      message: 'Capture limit exceeded for your plan. Please upgrade or wait.',
      details: null
    },
    timestamp: new Date().toISOString()
  },
  keyGenerator: (req) => req.user?.id || req.ip,
  skip: (req) => {
    // Skip rate limiting in test environment
    return process.env.NODE_ENV === 'test' && 
           process.env.RATE_LIMIT_MAX_REQUESTS === 'Infinity';
  }
});

// Authentication rate limiter (stricter for login/register)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Only 5 attempts per window
  message: {
    success: false,
    error: {
      code: 'AUTH_RATE_LIMIT_EXCEEDED',
      message: 'Too many authentication attempts, please try again in 15 minutes',
      details: null
    },
    timestamp: new Date().toISOString()
  },
  keyGenerator: (req) => req.ip,
  skip: (req) => {
    // Skip rate limiting in test environment
    return process.env.NODE_ENV === 'test';
  }
});

module.exports = {
  generalLimiter,
  captureLimiter,
  authLimiter
};