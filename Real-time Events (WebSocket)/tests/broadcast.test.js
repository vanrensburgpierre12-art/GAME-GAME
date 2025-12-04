const WebSocket = require('ws');
const http = require('http');
const express = require('express');
const { publishParcelUpdate } = require('../src/events');
const path = require('path');
const { generateToken } = require(path.join(__dirname, '../../Auth Module Backend/src/utils/jwt'));
const { createUser } = require(path.join(__dirname, '../../Auth Module Backend/src/models/user'));
const bcrypt = require('bcrypt');

describe('Broadcast Behavior', () => {
  let testUser1;
  let testUser2;
  let token1;
  let token2;
  let testServer;
  let wsServer;
  
  beforeAll(async () => {
    // Create test users
    const passwordHash1 = await bcrypt.hash('testpassword123', 10);
    const passwordHash2 = await bcrypt.hash('testpassword123', 10);
    testUser1 = await createUser('wsbroadcast1@example.com', passwordHash1, 'WS Test User 1');
    testUser2 = await createUser('wsbroadcast2@example.com', passwordHash2, 'WS Test User 2');
    token1 = generateToken(testUser1.id);
    token2 = generateToken(testUser2.id);
    
    // Create test server
    const app = express();
    testServer = http.createServer(app);
    const WebSocketServer = require('../src/websocket');
    wsServer = new WebSocketServer(testServer);
    wsServer.initialize();
    
    await new Promise((resolve) => {
      testServer.listen(0, () => {
        resolve();
      });
    });
  });
  
  afterAll(async () => {
    if (wsServer) {
      wsServer.close();
    }
    if (testServer) {
      await new Promise((resolve) => {
        testServer.close(() => resolve());
      });
    }
  });
  
  it('should broadcast parcel_updated event to all connected clients', (done) => {
    const port = testServer.address().port;
    const parcelId = 'test-parcel-123';
    let receivedCount = 0;
    const expectedCount = 2;
    
    // Connect first client
    const ws1 = new WebSocket(`ws://localhost:${port}/ws?token=${token1}`);
    let ws1Ready = false;
    
    ws1.on('open', () => {
      ws1Ready = true;
      checkAndPublish();
    });
    
    ws1.on('message', (data) => {
      const message = JSON.parse(data.toString());
      if (message.type === 'parcel_updated') {
        expect(message.parcel_id).toBe(parcelId);
        receivedCount++;
        checkDone();
      }
    });
    
    // Connect second client
    const ws2 = new WebSocket(`ws://localhost:${port}/ws?token=${token2}`);
    let ws2Ready = false;
    
    ws2.on('open', () => {
      ws2Ready = true;
      checkAndPublish();
    });
    
    ws2.on('message', (data) => {
      const message = JSON.parse(data.toString());
      if (message.type === 'parcel_updated') {
        expect(message.parcel_id).toBe(parcelId);
        receivedCount++;
        checkDone();
      }
    });
    
    function checkAndPublish() {
      if (ws1Ready && ws2Ready) {
        // Wait a bit for connections to be fully established
        setTimeout(() => {
          publishParcelUpdate(parcelId);
        }, 100);
      }
    }
    
    function checkDone() {
      if (receivedCount === expectedCount) {
        ws1.close();
        ws2.close();
        done();
      }
    }
    
    // Timeout after 5 seconds
    setTimeout(() => {
      if (receivedCount < expectedCount) {
        ws1.close();
        ws2.close();
        done(new Error(`Expected ${expectedCount} messages, received ${receivedCount}`));
      }
    }, 5000);
  });
  
  it('should not send events to disconnected clients', (done) => {
    const port = testServer.address().port;
    const parcelId = 'test-parcel-456';
    let receivedCount = 0;
    
    // Connect client
    const ws = new WebSocket(`ws://localhost:${port}/ws?token=${token1}`);
    
    ws.on('open', () => {
      // Disconnect immediately
      ws.close();
      
      // Wait a bit, then publish event
      setTimeout(() => {
        publishParcelUpdate(parcelId);
        
        // Wait to ensure no message is received
        setTimeout(() => {
          expect(receivedCount).toBe(0);
          done();
        }, 500);
      }, 100);
    });
    
    ws.on('message', () => {
      receivedCount++;
    });
  });
  
  it('should handle multiple events in sequence', (done) => {
    const port = testServer.address().port;
    const parcelIds = ['parcel-1', 'parcel-2', 'parcel-3'];
    const receivedEvents = [];
    
    const ws = new WebSocket(`ws://localhost:${port}/ws?token=${token1}`);
    
    ws.on('open', () => {
      // Publish multiple events
      setTimeout(() => {
        parcelIds.forEach((id, index) => {
          setTimeout(() => {
            publishParcelUpdate(id);
          }, index * 50);
        });
      }, 100);
    });
    
    ws.on('message', (data) => {
      const message = JSON.parse(data.toString());
      if (message.type === 'parcel_updated') {
        receivedEvents.push(message.parcel_id);
        
        if (receivedEvents.length === parcelIds.length) {
          expect(receivedEvents).toEqual(parcelIds);
          ws.close();
          done();
        }
      }
    });
    
    // Timeout
    setTimeout(() => {
      ws.close();
      if (receivedEvents.length < parcelIds.length) {
        done(new Error(`Expected ${parcelIds.length} events, received ${receivedEvents.length}`));
      }
    }, 2000);
  });
});

