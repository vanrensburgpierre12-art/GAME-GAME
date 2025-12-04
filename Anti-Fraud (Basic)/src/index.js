/**
 * Anti-Fraud Module
 * Exports middleware and functions for fraud detection
 */

const rateLimit = require('./middleware/rateLimit');
const ipLocationCheck = require('./middleware/ipLocationCheck');
const buyAttemptProtection = require('./middleware/buyAttemptProtection');
const { checkBuyAttempt, recordBuyAttempt } = require('./antifraud');
const rateLimiter = require('./utils/rateLimiter');
const buyAttemptTracker = require('./utils/buyAttemptTracker');

module.exports = {
  // Middleware
  rateLimit,
  ipLocationCheck,
  buyAttemptProtection,
  
  // Functions
  checkBuyAttempt,
  recordBuyAttempt,
  
  // Utilities (for testing/advanced usage)
  rateLimiter,
  buyAttemptTracker,
};

