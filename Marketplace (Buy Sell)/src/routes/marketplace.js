const express = require('express');
const router = express.Router();
const { buyParcel, listParcel } = require('../controllers/marketplaceController');

// Import auth middleware from auth module
const path = require('path');
const authMiddlewarePath = path.join(__dirname, '../../Auth Module Backend/src/middleware/auth');

let authenticateToken;
try {
  const authMiddleware = require(authMiddlewarePath);
  authenticateToken = authMiddleware.authenticateToken;
} catch (error) {
  console.warn('Auth module not found at:', authMiddlewarePath);
  console.warn('Error:', error.message);
  authenticateToken = (req, res, next) => {
    res.status(500).json({ error: 'Authentication module not configured. Ensure auth module is accessible.' });
  };
}

// POST /market/buy/:parcel_id - Buy a parcel
router.post('/buy/:parcel_id', authenticateToken, buyParcel);

// POST /market/list/:parcel_id - List a parcel for sale
router.post('/list/:parcel_id', authenticateToken, listParcel);

module.exports = router;

