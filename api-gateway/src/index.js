require('dotenv').config();
const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const parcelRoutes = require('./routes/parcels');
const walletRoutes = require('./routes/wallet');
const marketplaceRoutes = require('./routes/marketplace');
const rentalRoutes = require('./routes/rentals');
const rateLimit = require('./middleware/rateLimit');

const app = express();
const PORT = process.env.PORT || 4000;

// Trust proxy (important for rate limiting by IP when behind reverse proxy)
app.set('trust proxy', true);

// CORS configuration
const corsOptions = {
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
};
app.use(cors(corsOptions));

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Global rate limiting (100 requests per minute per IP)
app.use(rateLimit({
  maxRequests: 100,
  windowMs: 60000,
  message: 'Too many requests from this IP, please try again later',
}));

// Mount routes
app.use('/auth', authRoutes);
app.use('/parcels', parcelRoutes);
app.use('/wallet', walletRoutes);
app.use('/market', marketplaceRoutes);
app.use('/rent', rentalRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'api-gateway',
    timestamp: new Date().toISOString() 
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'Gaming Platform API Gateway',
    version: '1.0.0',
    endpoints: {
      auth: '/auth',
      parcels: '/parcels',
      wallet: '/wallet',
      marketplace: '/market',
      rentals: '/rent',
      health: '/health',
    },
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`API Gateway running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log('Available routes:');
  console.log('  - POST /auth/register');
  console.log('  - POST /auth/login');
  console.log('  - GET  /auth/me');
  console.log('  - GET  /parcels?bbox=...');
  console.log('  - GET  /parcels/:id');
  console.log('  - GET  /wallet');
  console.log('  - POST /wallet/deposit');
  console.log('  - POST /wallet/withdraw');
  console.log('  - POST /market/buy/:parcel_id');
  console.log('  - POST /market/list/:parcel_id');
  console.log('  - POST /rent/list/:parcel_id');
  console.log('  - POST /rent/start/:parcel_id');
  console.log('  - GET  /rent/my');
  console.log('  - GET  /health');
});

module.exports = app;

