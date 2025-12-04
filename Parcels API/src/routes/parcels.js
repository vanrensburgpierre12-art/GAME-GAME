const express = require('express');
const router = express.Router();
const { getParcels, getParcelById } = require('../controllers/parcelController');

// GET /parcels - Get parcels within bounding box
router.get('/', getParcels);

// GET /parcels/:id - Get single parcel by ID
router.get('/:id', getParcelById);

module.exports = router;

