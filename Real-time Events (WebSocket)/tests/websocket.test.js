const WebSocket = require('ws');
const http = require('http');
const { app, server } = require('../src/index');
const path = require('path');
const { generateToken } = require(path.join(__dirname, '../../Auth Module Backend/src/utils/jwt'));
const { createUser } = require(path.join(__dirname, '../../Auth Module Backend/src/models/user'));
const bcrypt = require('bcrypt');

describe('WebSocket Server', () => {
  let testUser;
  let testUserToken;
  let testServer;
  
  beforeAll(async () => {
    // Create test user
    const passwordHash = await bcrypt.hash('testpassword123', 10);
    testUser = await createUser('wstest@example.com', passwordHash, 'WS Test User');
    testUserToken = generateToken(testUser.id);
    
    // Start test server
    testServer = http.createServer(app);
    const WebSocketServer = require('../src/websocket');
    const wsServer = new WebSocketServer(testServer);
    wsServer.initialize();
    
    await new Promise((resolve) => {
      testServer.listen(0, () => {
        resolve();
      });
    });
  });
  
  afterAll(async () => {
    if (testServer) {
      await new Promise((resolve) => {
        testServer.close(() => resolve());
      });
    }
  });
  
  describe('Connection', () => {
    it('should accept connection with valid JWT token in query param', (done) => {
      const port = testServer.address().port;
      const ws = new WebSocket(`ws://localhost:${port}/ws?token=${testUserToken}`);
      
      ws.on('open', () => {
        ws.close();
        done();
      });
      
      ws.on('error', (error) => {
        done(error);
      });
    });
    
    it('should reject connection without token', (done) => {
      const port = testServer.address().port;
      const ws = new WebSocket(`ws://localhost:${port}/ws`);
      
      ws.on('error', (error) => {
        // Expected to fail
        expect(error.message).toBeDefined();
        done();
      });
      
      ws.on('open', () => {
        ws.close();
        done(new Error('Connection should have been rejected'));
      });
    });
    
    it('should reject connection with invalid token', (done) => {
      const port = testServer.address().port;
      const ws = new WebSocket(`ws://localhost:${port}/ws?token=invalid-token`);
      
      ws.on('error', (error) => {
        // Expected to fail
        expect(error.message).toBeDefined();
        done();
      });
      
      ws.on('open', () => {
        ws.close();
        done(new Error('Connection should have been rejected'));
      });
    });
    
    it('should send welcome message on connection', (done) => {
      const port = testServer.address().port;
      const ws = new WebSocket(`ws://localhost:${port}/ws?token=${testUserToken}`);
      
      ws.on('message', (data) => {
        const message = JSON.parse(data.toString());
        expect(message.type).toBe('connected');
        expect(message.message).toContain('established');
        ws.close();
        done();
      });
      
      ws.on('error', (error) => {
        done(error);
      });
    });
  });
});

