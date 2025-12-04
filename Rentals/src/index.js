require('dotenv').config();
const express = require('express');
const rentalsRoutes = require('./routes/rentals');

const app = express();
const PORT = process.env.RENTALS_PORT || 3004;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Routes
app.use('/rent', rentalsRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', module: 'rentals', timestamp: new Date().toISOString() });
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
  console.log(`Rentals module running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Rental fee: ${process.env.RENTAL_FEE_PERCENT || process.env.MARKETPLACE_FEE_PERCENT || '5'}%`);
});

module.exports = app;

