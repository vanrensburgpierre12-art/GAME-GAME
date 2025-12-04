const EventEmitter = require('events');

/**
 * Redis pub/sub client (stub implementation)
 * Can be replaced with real Redis client when Redis is available
 */
class RedisStub extends EventEmitter {
  constructor() {
    super();
    this.subscribers = new Map(); // channel -> Set of callbacks
    this.isConnected = false;
  }
  
  /**
   * Connect to Redis (stub - always succeeds)
   */
  async connect() {
    this.isConnected = true;
    return this;
  }
  
  /**
   * Publish message to channel
   * @param {string} channel - Channel name
   * @param {string} message - Message to publish
   * @returns {number} Number of subscribers that received the message
   */
  async publish(channel, message) {
    if (!this.isConnected) {
      throw new Error('Redis client not connected');
    }
    
    const callbacks = this.subscribers.get(channel) || new Set();
    let count = 0;
    
    // Call all subscribers
    for (const callback of callbacks) {
      try {
        callback(message, channel);
        count++;
      } catch (error) {
        console.error('Error in Redis subscriber callback:', error);
      }
    }
    
    return count;
  }
  
  /**
   * Subscribe to channel
   * @param {string} channel - Channel name
   * @param {function} callback - Callback function(message, channel)
   */
  subscribe(channel, callback) {
    if (!this.subscribers.has(channel)) {
      this.subscribers.set(channel, new Set());
    }
    
    this.subscribers.get(channel).add(callback);
    
    // Return unsubscribe function
    return () => {
      const callbacks = this.subscribers.get(channel);
      if (callbacks) {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          this.subscribers.delete(channel);
        }
      }
    };
  }
  
  /**
   * Unsubscribe from channel
   * @param {string} channel - Channel name
   * @param {function} callback - Callback function to remove
   */
  unsubscribe(channel, callback) {
    const callbacks = this.subscribers.get(channel);
    if (callbacks) {
      callbacks.delete(callback);
      if (callbacks.size === 0) {
        this.subscribers.delete(channel);
      }
    }
  }
  
  /**
   * Disconnect from Redis
   */
  async disconnect() {
    this.isConnected = false;
    this.subscribers.clear();
  }
}

// Try to use real Redis if available, otherwise use stub
let redisClient;

try {
  // Check if redis is available
  const redis = require('redis');
  
  // Create real Redis client
  const redisHost = process.env.REDIS_HOST || 'redis';
  const redisPort = process.env.REDIS_PORT || 6379;
  redisClient = redis.createClient({
    url: process.env.REDIS_URL || `redis://${redisHost}:${redisPort}`,
  });
  
  redisClient.on('error', (err) => {
    console.error('Redis client error:', err);
    // Fall back to stub if Redis connection fails
    console.log('Falling back to in-memory pub/sub');
    redisClient = new RedisStub();
    redisClient.connect();
  });
  
  redisClient.on('connect', () => {
    console.log('Connected to Redis');
  });
  
  // Don't auto-connect - let index.js handle it
  // This prevents "Socket already opened" errors
} catch (error) {
  // Redis not installed, use stub
  console.log('Redis not available, using in-memory pub/sub');
  redisClient = new RedisStub();
  redisClient.connect();
}

module.exports = redisClient;

