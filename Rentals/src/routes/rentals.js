const express = require('express');
const router = express.Router();
const { listParcel, startRental, getMyRentals } = require('../controllers/rentalController');

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

// POST /rent/list/:parcel_id - List a parcel for rent (owner-only, validated in controller)
router.post('/list/:parcel_id', authenticateToken, listParcel);

// POST /rent/start/:parcel_id - Start a rental
router.post('/start/:parcel_id', authenticateToken, startRental);

// GET /rent/my - Get active rentals for current user
router.get('/my', authenticateToken, getMyRentals);

module.exports = router;

