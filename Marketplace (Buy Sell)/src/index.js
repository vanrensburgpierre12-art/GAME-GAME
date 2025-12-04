require('dotenv').config();
const express = require('express');
const marketplaceRoutes = require('./routes/marketplace');

const app = express();
const PORT = process.env.MARKETPLACE_PORT || 3003;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Routes
app.use('/market', marketplaceRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', module: 'marketplace', timestamp: new Date().toISOString() });
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
  console.log(`Marketplace module running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Marketplace fee: ${process.env.MARKETPLACE_FEE_PERCENT || '5'}%`);
});

module.exports = app;

