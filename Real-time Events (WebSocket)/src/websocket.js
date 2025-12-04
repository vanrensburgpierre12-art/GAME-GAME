const WebSocket = require('ws');
const { authenticateWebSocket, extractToken } = require('./auth');
const { subscribeToParcelEvents } = require('./events');

/**
 * WebSocket server manager
 */
class WebSocketServer {
  constructor(server) {
    this.server = server;
    this.wss = null;
    this.clients = new Map(); // userId -> Set of WebSocket connections
    this.unsubscribe = null;
  }
  
  /**
   * Initialize WebSocket server
   */
  initialize() {
    // Create WebSocket server
    this.wss = new WebSocket.Server({
      server: this.server,
      path: '/ws',
    });
    
    // Handle new connections
    this.wss.on('connection', async (ws, request) => {
      // Authenticate connection
      const token = extractToken(request);
      if (!token) {
        ws.close(1008, 'Authentication token required');
        return;
      }
      
      const user = await authenticateWebSocket(token);
      if (!user) {
        ws.close(1008, 'Authentication failed');
        return;
      }
      
      // Add client to user's connection set
      if (!this.clients.has(user.id)) {
        this.clients.set(user.id, new Set());
      }
      this.clients.get(user.id).add(ws);
      
      // Send welcome message
      ws.send(JSON.stringify({
        type: 'connected',
        message: 'WebSocket connection established',
      }));
      
      // Handle connection close
      ws.on('close', () => {
        const userConnections = this.clients.get(user.id);
        if (userConnections) {
          userConnections.delete(ws);
          if (userConnections.size === 0) {
            this.clients.delete(user.id);
          }
        }
      });
      
      // Handle errors
      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
      });
    });
    
    // Subscribe to parcel events from Redis
    this.unsubscribe = subscribeToParcelEvents((event) => {
      this.broadcast(event);
    });
    
    console.log('WebSocket server initialized on /ws');
  }
  
  /**
   * Broadcast event to all connected clients
   * @param {object} event - Event object
   */
  broadcast(event) {
    const message = JSON.stringify(event);
    let sentCount = 0;
    
    // Send to all connected clients
    for (const [userId, connections] of this.clients.entries()) {
      for (const ws of connections) {
        if (ws.readyState === WebSocket.OPEN) {
          try {
            ws.send(message);
            sentCount++;
          } catch (error) {
            console.error(`Error sending message to user ${userId}:`, error);
          }
        }
      }
    }
    
    return sentCount;
  }
  
  /**
   * Send event to specific user
   * @param {string} userId - User ID
   * @param {object} event - Event object
   */
  sendToUser(userId, event) {
    const connections = this.clients.get(userId);
    if (!connections) {
      return 0;
    }
    
    const message = JSON.stringify(event);
    let sentCount = 0;
    
    for (const ws of connections) {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(message);
          sentCount++;
        } catch (error) {
          console.error(`Error sending message to user ${userId}:`, error);
        }
      }
    }
    
    return sentCount;
  }
  
  /**
   * Get number of connected clients
   * @returns {number} Number of connected clients
   */
  getClientCount() {
    let count = 0;
    for (const connections of this.clients.values()) {
      count += connections.size;
    }
    return count;
  }
  
  /**
   * Close WebSocket server
   */
  close() {
    if (this.unsubscribe) {
      this.unsubscribe();
    }
    
    if (this.wss) {
      this.wss.close();
    }
    
    this.clients.clear();
  }
}

module.exports = WebSocketServer;

