const express = require('express');
const router = express.Router();
const { listParcel, startRental, getMyRentals } = require('../controllers/rentalController');
const { authenticateToken } = require('../middleware/auth');

// POST /rent/list/:parcel_id - List a parcel for rent (owner-only, validated in controller)
router.post('/list/:parcel_id', authenticateToken, listParcel);

// POST /rent/start/:parcel_id - Start a rental
router.post('/start/:parcel_id', authenticateToken, startRental);

// GET /rent/my - Get active rentals for current user
router.get('/my', authenticateToken, getMyRentals);

module.exports = router;

