const express = require('express');
const router = express.Router();
const { getWallet, deposit, withdraw } = require('../controllers/walletController');
const { requireKYCVerified } = require('../middleware/kyc');

// Import auth middleware from auth module
// Path is relative to Wallet folder, going up to parent and into Auth Module Backend
const path = require('path');
const authMiddlewarePath = path.join(__dirname, '../../Auth Module Backend/src/middleware/auth');

let authenticateToken;
try {
  const authMiddleware = require(authMiddlewarePath);
  authenticateToken = authMiddleware.authenticateToken;
} catch (error) {
  // Fallback: create a simple auth middleware if auth module not available
  console.warn('Auth module not found at:', authMiddlewarePath);
  console.warn('Error:', error.message);
  authenticateToken = (req, res, next) => {
    res.status(500).json({ error: 'Authentication module not configured. Ensure auth module is accessible.' });
  };
}

// GET /wallet - Get wallet balance
router.get('/', authenticateToken, getWallet);

// POST /wallet/deposit - Create deposit ledger entry
router.post('/deposit', authenticateToken, deposit);

// POST /wallet/withdraw - Create withdraw ledger entry (requires KYC)
router.post('/withdraw', authenticateToken, requireKYCVerified, withdraw);

module.exports = router;

