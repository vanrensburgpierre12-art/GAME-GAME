const express = require('express');
const router = express.Router();
const { buyParcel, listParcel } = require('../controllers/marketplaceController');
const { authenticateToken } = require('../middleware/auth');

// POST /market/buy/:parcel_id - Buy a parcel
router.post('/buy/:parcel_id', authenticateToken, buyParcel);

// POST /market/list/:parcel_id - List a parcel for sale
router.post('/list/:parcel_id', authenticateToken, listParcel);

module.exports = router;

