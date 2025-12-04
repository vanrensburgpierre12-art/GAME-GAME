const rateLimiter = require('./utils/rateLimiter');
const buyAttemptTracker = require('./utils/buyAttemptTracker');

/**
 * Check if a buy attempt is allowed
 * Performs multiple fraud checks:
 * - Rate limiting
 * - Buy attempt frequency
 * - New user caps
 * 
 * @param {object} user - User object (must have id, created_at)
 * @param {object} parcel - Parcel object (must have parcel_id)
 * @param {object} options - Configuration options
 * @param {number} options.maxBuyAttemptsPerMinute - Max buy attempts per minute (default: 10)
 * @param {number} options.buyCooldownMs - Cooldown between buy attempts for same parcel (default: 5000)
 * @param {number} options.newUserMaxBuys - Max buys for new users in first 24h (default: 3)
 * @param {number} options.newUserWindowMs - New user window in ms (default: 86400000 = 24h)
 * @returns {object} { allowed: boolean, reason?: string }
 */
function checkBuyAttempt(user, parcel, options = {}) {
  const {
    maxBuyAttemptsPerMinute = 10,
    buyCooldownMs = 5000,
    newUserMaxBuys = 3,
    newUserWindowMs = 86400000, // 24 hours
  } = options;
  
  // Check 1: Rate limiting (per user)
  const rateLimitKey = `user:${user.id}`;
  const rateLimitResult = rateLimiter.checkLimit(rateLimitKey, maxBuyAttemptsPerMinute, 60000);
  
  if (!rateLimitResult.allowed) {
    return {
      allowed: false,
      reason: `Rate limit exceeded. Maximum ${maxBuyAttemptsPerMinute} buy attempts per minute.`,
    };
  }
  
  // Check 2: Buy attempt frequency (same parcel)
  const buyAttemptResult = buyAttemptTracker.checkAttempt(user.id, parcel.parcel_id, buyCooldownMs);
  
  if (!buyAttemptResult.allowed) {
    const retryAfter = Math.ceil((buyAttemptResult.nextAllowedAt.getTime() - Date.now()) / 1000);
    return {
      allowed: false,
      reason: `Too many buy attempts for this parcel. Please wait ${retryAfter} seconds.`,
    };
  }
  
  // Check 3: New user caps
  if (user.created_at) {
    const userCreatedAt = new Date(user.created_at);
    const now = Date.now();
    const userAge = now - userCreatedAt.getTime();
    
    if (userAge < newUserWindowMs) {
      // User is within new user window
      // Count buy attempts in the last window
      const buyAttemptCount = buyAttemptTracker.getAttemptCount(user.id, parcel.parcel_id, newUserWindowMs);
      
      // For simplicity, we're checking per-parcel. In a real system, you'd track total buys across all parcels
      // This is a simplified version - you might want to track total purchases in a separate system
      if (buyAttemptCount >= newUserMaxBuys) {
        return {
          allowed: false,
          reason: `New user limit reached. Maximum ${newUserMaxBuys} buy attempts in first 24 hours.`,
        };
      }
    }
  }
  
  // All checks passed
  return {
    allowed: true,
  };
}

/**
 * Record a buy attempt (call this after successful buy)
 * @param {string} userId - User ID
 * @param {string} parcelId - Parcel ID
 */
function recordBuyAttempt(userId, parcelId) {
  buyAttemptTracker.recordAttempt(userId, parcelId);
}

module.exports = {
  checkBuyAttempt,
  recordBuyAttempt,
};

