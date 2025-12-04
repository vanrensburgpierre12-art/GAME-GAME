const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { submit, getStatus, adminVerify } = require('../controllers/kycController');

// Import auth middleware (local copy)
const { authenticateToken } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/admin');

// Configure multer for file uploads
// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, '../../uploads/kyc');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Create user-specific directory
    // req.user will be available after authenticateToken middleware runs
    const userId = req.user ? req.user.id : 'temp';
    const userDir = path.join(uploadsDir, userId);
    if (!fs.existsSync(userDir)) {
      fs.mkdirSync(userDir, { recursive: true });
    }
    cb(null, userDir);
  },
  filename: function (req, file, cb) {
    // Generate unique filename: timestamp_originalname
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext);
    cb(null, `${timestamp}_${name}${ext}`);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: function (req, file, cb) {
    // Accept common document formats
    const allowedMimes = [
      'image/jpeg',
      'image/png',
      'image/jpg',
      'application/pdf',
    ];
    
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, and PDF files are allowed.'));
    }
  }
});

// POST /kyc/submit - Requires authentication, uses multer for file upload
router.post('/submit', authenticateToken, upload.single('id_document'), submit);

// GET /kyc/status - Requires authentication
router.get('/status', authenticateToken, getStatus);

// POST /kyc/admin/verify/:user_id - Requires authentication + admin middleware
router.post('/admin/verify/:user_id', authenticateToken, requireAdmin, adminVerify);

module.exports = router;

