const express = require('express');
const router = express.Router();
const { getWallet, deposit, withdraw } = require('../controllers/walletController');
const { requireKYCVerified } = require('../middleware/kyc');
const { authenticateToken } = require('../middleware/auth');

// GET /wallet - Get wallet balance
router.get('/', authenticateToken, getWallet);

// POST /wallet/deposit - Create deposit ledger entry
router.post('/deposit', authenticateToken, deposit);

// POST /wallet/withdraw - Create withdraw ledger entry (requires KYC)
router.post('/withdraw', authenticateToken, requireKYCVerified, withdraw);

module.exports = router;

