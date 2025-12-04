const express = require('express');
const router = express.Router();
const { deposit, webhook } = require('../controllers/paymentController');

// Import auth middleware (local copy)
const { authenticateToken } = require('../middleware/auth');

// POST /payments/deposit - Requires authentication
router.post('/deposit', authenticateToken, deposit);

// POST /payments/webhook - Public endpoint (no auth for sandbox)
router.post('/webhook', webhook);

module.exports = router;

