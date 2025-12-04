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
 * IP location check middleware
 * Detects mismatches between IP location and user-declared location
 * Currently just logs mismatches (stub implementation)
 * 
 * @param {object} options - Configuration options
 * @param {function} options.getUserLocation - Function to get user's declared location (default: from req.user)
 * @returns {function} Express middleware
 */
function ipLocationCheck(options = {}) {
  const {
    getUserLocation = (req) => {
      // Default: try to get location from user object
      // This is a stub - in real implementation, would get from user profile/metadata
      return req.user?.location || req.user?.country || null;
    },
  } = options;
  
  return (req, res, next) => {
    // Only check if user is authenticated
    if (!req.user) {
      return next();
    }
    
    const clientIp = getClientIp(req);
    const userDeclaredLocation = getUserLocation(req);
    
    // Stub: In real implementation, would use GeoIP service to get IP location
    // For now, just log the IP and declared location
    if (userDeclaredLocation) {
      // This is where we would:
      // 1. Look up IP location using GeoIP service
      // 2. Compare with user-declared location
      // 3. Log mismatch if detected
      
      // Stub implementation - just log for now
      console.log('[IP Location Check]', {
        userId: req.user.id,
        ip: clientIp,
        declaredLocation: userDeclaredLocation,
        timestamp: new Date().toISOString(),
        // In real implementation, would include:
        // ipLocation: ipLocationFromGeoIP,
        // mismatch: ipLocationFromGeoIP !== userDeclaredLocation,
      });
    }
    
    // Always continue (no blocking yet)
    next();
  };
}

module.exports = ipLocationCheck;

