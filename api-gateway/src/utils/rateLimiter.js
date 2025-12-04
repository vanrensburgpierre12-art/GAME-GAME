/**
 * In-memory rate limiter
 * Tracks requests per key (IP, user ID, etc.) within a time window
 */
class RateLimiter {
  constructor() {
    // Map of key -> array of timestamps
    this.requests = new Map();
    
    // Cleanup interval to remove expired entries
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000); // Clean up every minute
  }
  
  /**
   * Check if a request is allowed
   * @param {string} key - Unique key (IP, user ID, etc.)
   * @param {number} maxRequests - Maximum requests allowed
   * @param {number} windowMs - Time window in milliseconds
   * @returns {object} { allowed: boolean, remaining: number, resetAt: Date }
   */
  checkLimit(key, maxRequests, windowMs) {
    const now = Date.now();
    const cutoff = now - windowMs;
    
    // Get existing requests for this key
    let timestamps = this.requests.get(key) || [];
    
    // Filter out expired requests
    timestamps = timestamps.filter(ts => ts > cutoff);
    
    // Check if limit exceeded
    const count = timestamps.length;
    const allowed = count < maxRequests;
    
    if (allowed) {
      // Add current request timestamp
      timestamps.push(now);
      this.requests.set(key, timestamps);
    }
    
    // Calculate reset time (oldest request + window)
    const resetAt = timestamps.length > 0 
      ? new Date(Math.min(...timestamps) + windowMs)
      : new Date(now + windowMs);
    
    return {
      allowed,
      remaining: Math.max(0, maxRequests - count - (allowed ? 1 : 0)),
      resetAt,
    };
  }
  
  /**
   * Reset rate limit for a key
   * @param {string} key - Key to reset
   */
  reset(key) {
    this.requests.delete(key);
  }
  
  /**
   * Get current count for a key
   * @param {string} key - Key to check
   * @param {number} windowMs - Time window in milliseconds
   * @returns {number} Current request count
   */
  getCount(key, windowMs) {
    const now = Date.now();
    const cutoff = now - windowMs;
    const timestamps = this.requests.get(key) || [];
    return timestamps.filter(ts => ts > cutoff).length;
  }
  
  /**
   * Clean up expired entries
   */
  cleanup() {
    const now = Date.now();
    const maxAge = 3600000; // Keep entries for 1 hour max
    
    for (const [key, timestamps] of this.requests.entries()) {
      const cutoff = now - maxAge;
      const validTimestamps = timestamps.filter(ts => ts > cutoff);
      
      if (validTimestamps.length === 0) {
        this.requests.delete(key);
      } else {
        this.requests.set(key, validTimestamps);
      }
    }
  }
  
  /**
   * Clear all entries (useful for testing)
   */
  clear() {
    this.requests.clear();
  }
  
  /**
   * Destroy the limiter and clear intervals
   */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.clear();
  }
}

// Singleton instance
const rateLimiter = new RateLimiter();

module.exports = rateLimiter;

