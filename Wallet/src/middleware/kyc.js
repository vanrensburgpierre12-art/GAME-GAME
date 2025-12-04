/**
 * Middleware to require KYC verification
 * Checks that req.user.kyc_status === 'verified'
 * Must be used after authenticateToken middleware
 */
function requireKYCVerified(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  if (req.user.kyc_status !== 'verified') {
    return res.status(403).json({ 
      error: 'KYC verification required',
      kyc_status: req.user.kyc_status 
    });
  }
  
  next();
}

module.exports = {
  requireKYCVerified,
};

