/**
 * Tracks buy attempts to prevent rapid repeated purchases
 */
class BuyAttemptTracker {
  constructor() {
    // Map of "userId:parcelId" -> array of timestamps
    this.attempts = new Map();
    
    // Cleanup interval
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000); // Clean up every minute
  }
  
  /**
   * Record a buy attempt
   * @param {string} userId - User ID
   * @param {string} parcelId - Parcel ID
   * @returns {void}
   */
  recordAttempt(userId, parcelId) {
    const key = `${userId}:${parcelId}`;
    const now = Date.now();
    
    const timestamps = this.attempts.get(key) || [];
    timestamps.push(now);
    this.attempts.set(key, timestamps);
  }
  
  /**
   * Check if buy attempt is allowed
   * @param {string} userId - User ID
   * @param {string} parcelId - Parcel ID
   * @param {number} cooldownMs - Cooldown period in milliseconds (default: 5000 = 5 seconds)
   * @returns {object} { allowed: boolean, lastAttempt?: Date, nextAllowedAt?: Date }
   */
  checkAttempt(userId, parcelId, cooldownMs = 5000) {
    const key = `${userId}:${parcelId}`;
    const now = Date.now();
    const cutoff = now - cooldownMs;
    
    const timestamps = this.attempts.get(key) || [];
    const recentAttempts = timestamps.filter(ts => ts > cutoff);
    
    if (recentAttempts.length > 0) {
      const lastAttempt = new Date(Math.max(...recentAttempts));
      const nextAllowedAt = new Date(lastAttempt.getTime() + cooldownMs);
      
      return {
        allowed: false,
        lastAttempt,
        nextAllowedAt,
      };
    }
    
    return {
      allowed: true,
    };
  }
  
  /**
   * Get attempt count for user-parcel pair
   * @param {string} userId - User ID
   * @param {string} parcelId - Parcel ID
   * @param {number} windowMs - Time window in milliseconds
   * @returns {number} Number of attempts in the window
   */
  getAttemptCount(userId, parcelId, windowMs = 60000) {
    const key = `${userId}:${parcelId}`;
    const now = Date.now();
    const cutoff = now - windowMs;
    
    const timestamps = this.attempts.get(key) || [];
    return timestamps.filter(ts => ts > cutoff).length;
  }
  
  /**
   * Clean up expired entries
   */
  cleanup() {
    const now = Date.now();
    const maxAge = 3600000; // Keep entries for 1 hour max
    
    for (const [key, timestamps] of this.attempts.entries()) {
      const cutoff = now - maxAge;
      const validTimestamps = timestamps.filter(ts => ts > cutoff);
      
      if (validTimestamps.length === 0) {
        this.attempts.delete(key);
      } else {
        this.attempts.set(key, validTimestamps);
      }
    }
  }
  
  /**
   * Clear all entries (useful for testing)
   */
  clear() {
    this.attempts.clear();
  }
  
  /**
   * Destroy the tracker and clear intervals
   */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.clear();
  }
}

// Singleton instance
const buyAttemptTracker = new BuyAttemptTracker();

module.exports = buyAttemptTracker;

