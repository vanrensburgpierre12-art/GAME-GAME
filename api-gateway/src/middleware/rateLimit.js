const rateLimiter = require('../utils/rateLimiter');

/**
 * Get client IP from request
 * @param {object} req - Express request object
 * @returns {string} IP address
 */
function getClientIp(req) {
  return req.ip || 
         req.connection?.remoteAddress || 
         req.socket?.remoteAddress ||
         req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
         req.headers['x-real-ip'] ||
         'unknown';
}

/**
 * Rate limiting middleware factory
 * @param {object} options - Configuration options
 * @param {number} options.maxRequests - Maximum requests allowed (default: 60)
 * @param {number} options.windowMs - Time window in milliseconds (default: 60000 = 1 minute)
 * @param {function} options.keyGenerator - Function to generate rate limit key (default: uses IP)
 * @param {string} options.message - Error message when rate limited (default: 'Too many requests')
 * @returns {function} Express middleware
 */
function rateLimit(options = {}) {
  const {
    maxRequests = 60,
    windowMs = 60000, // 1 minute
    keyGenerator = (req) => {
      // Default: use IP address
      return `ip:${getClientIp(req)}`;
    },
    message = 'Too many requests, please try again later',
  } = options;
  
  return (req, res, next) => {
    const key = keyGenerator(req);
    
    const result = rateLimiter.checkLimit(key, maxRequests, windowMs);
    
    // Set rate limit headers
    res.set({
      'X-RateLimit-Limit': maxRequests,
      'X-RateLimit-Remaining': result.remaining,
      'X-RateLimit-Reset': Math.floor(result.resetAt.getTime() / 1000),
    });
    
    if (!result.allowed) {
      return res.status(429).json({
        error: message,
        retryAfter: Math.ceil((result.resetAt.getTime() - Date.now()) / 1000),
      });
    }
    
    next();
  };
}

module.exports = rateLimit;

