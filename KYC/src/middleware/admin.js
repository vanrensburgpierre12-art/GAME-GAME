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

module.exports = {
  requireAdmin,
};

