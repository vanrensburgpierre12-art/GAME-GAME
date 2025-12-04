const express = require('express');
const router = express.Router();
const {
  getParcels,
  triggerSeeder,
  verifyKYC,
  getTransactionLogs,
  getUsers,
  getStats,
  getPendingKYC,
} = require('../controllers/adminController');
const { requireAdmin } = require('../middleware/adminAuth');
const { authenticateToken } = require('../middleware/auth');

// All admin routes require authentication + admin check
router.use(authenticateToken);
router.use(requireAdmin);

// Admin endpoints
router.get('/parcels', getParcels);
router.post('/seed', triggerSeeder);
router.post('/kyc/verify/:user_id', verifyKYC);
router.get('/logs/transactions', getTransactionLogs);
router.get('/users', getUsers);
router.get('/stats', getStats);
router.get('/kyc/pending', getPendingKYC);

module.exports = router;

