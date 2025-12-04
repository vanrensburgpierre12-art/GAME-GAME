require('dotenv').config();
const express = require('express');
const http = require('http');
const WebSocketServer = require('./websocket');
const redisClient = require('./redis');

const app = express();
const server = http.createServer(app);
const PORT = process.env.REALTIME_PORT || 3006;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'realtime-events',
    clients: wsServer ? wsServer.getClientCount() : 0,
  });
});

// Initialize WebSocket server
let wsServer;
(async () => {
  try {
    // Connect to Redis (or use stub) - only if not already connected
    if (!redisClient.isConnected && typeof redisClient.connect === 'function') {
      await redisClient.connect();
    }
    
    // Initialize WebSocket server
    wsServer = new WebSocketServer(server);
    wsServer.initialize();
  } catch (error) {
    console.error('Error initializing WebSocket server:', error);
    // Don't exit - continue with stub if Redis fails
    console.log('Continuing with in-memory pub/sub');
    wsServer = new WebSocketServer(server);
    wsServer.initialize();
  }
})();

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`Real-time Events module running on port ${PORT}`);
  console.log(`WebSocket endpoint: ws://localhost:${PORT}/ws`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  if (wsServer) {
    wsServer.close();
  }
  await redisClient.disconnect();
  server.close(() => {
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully');
  if (wsServer) {
    wsServer.close();
  }
  await redisClient.disconnect();
  server.close(() => {
    process.exit(0);
  });
});

module.exports = { app, server, wsServer: () => wsServer };

