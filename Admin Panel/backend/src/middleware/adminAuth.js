const path = require('path');

/**
 * Middleware to require admin privileges
 * Checks that req.user.is_admin === true
 * Must be used after authenticateToken middleware
 */
function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  if (!req.user.is_admin) {
    return res.status(403).json({ 
      error: 'Admin access required',
    });
  }
  
  next();
}

/**
 * Authenticate and check admin in one middleware
 * Combines authentication and admin check
 */
async function authenticateAdmin(req, res, next) {
  try {
    // Import auth middleware
    const authMiddlewarePath = path.join(__dirname, '../../../Auth Module Backend/src/middleware/auth');
    const { authenticateToken } = require(authMiddlewarePath);
    
    // First authenticate
    await new Promise((resolve, reject) => {
      authenticateToken(req, res, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    
    // Then check admin
    requireAdmin(req, res, next);
  } catch (error) {
    return res.status(401).json({ error: 'Authentication failed' });
  }
}

module.exports = {
  requireAdmin,
  authenticateAdmin,
};

