const buyAttemptTracker = require('../utils/buyAttemptTracker');

/**
 * Middleware to block rapid repeated buy attempts
 * @param {object} options - Configuration options
 * @param {number} options.cooldownMs - Cooldown period in milliseconds (default: 5000 = 5 seconds)
 * @param {function} options.getParcelId - Function to extract parcel ID from request (default: from params)
 * @returns {function} Express middleware
 */
function buyAttemptProtection(options = {}) {
  const {
    cooldownMs = 5000, // 5 seconds cooldown
    getParcelId = (req) => {
      // Default: get from route params
      return req.params.parcel_id || req.body.parcel_id;
    },
  } = options;
  
  return (req, res, next) => {
    // Only check if user is authenticated
    if (!req.user) {
      return next();
    }
    
    const userId = req.user.id;
    const parcelId = getParcelId(req);
    
    if (!parcelId) {
      // No parcel ID, skip check
      return next();
    }
    
    // Check if attempt is allowed
    const result = buyAttemptTracker.checkAttempt(userId, parcelId, cooldownMs);
    
    if (!result.allowed) {
      const retryAfter = Math.ceil((result.nextAllowedAt.getTime() - Date.now()) / 1000);
      
      return res.status(429).json({
        error: 'Too many buy attempts. Please wait before trying again.',
        retryAfter,
        nextAllowedAt: result.nextAllowedAt.toISOString(),
      });
    }
    
    // Record the attempt (will be recorded again in the controller, but that's okay)
    // This ensures we track even failed attempts
    buyAttemptTracker.recordAttempt(userId, parcelId);
    
    next();
  };
}

module.exports = buyAttemptProtection;

