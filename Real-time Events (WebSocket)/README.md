# Real-time Events (WebSocket) Module

A real-time events module using WebSockets to broadcast parcel updates to connected clients. Uses Redis pub/sub for multi-server broadcasting (with fallback to in-memory pub/sub if Redis is not available).

## Features

- WebSocket server on `/ws` endpoint
- JWT authentication for WebSocket connections
- Broadcast parcel update events to all connected clients
- Redis pub/sub support (with stub fallback)
- Automatic event publishing on parcel changes
- Multi-client support

## Setup

1. Install dependencies:
```bash
npm install
```

2. Optional: Install Redis for multi-server support:
```bash
npm install redis
```

Or use the built-in in-memory pub/sub (default).

3. Configure environment variables (optional):
```bash
# .env file
REALTIME_PORT=3006
REDIS_URL=redis://localhost:6379  # Optional, for Redis support
JWT_SECRET=your-secret-key  # Should match Auth module
```

4. Start the server:
```bash
npm start
```

## WebSocket Connection

### Endpoint
```
ws://localhost:3006/ws
```

### Authentication
Connect with JWT token as query parameter:
```
ws://localhost:3006/ws?token=<jwt-token>
```

Or use Authorization header (if supported by your WebSocket client):
```
Authorization: Bearer <jwt-token>
```

### Connection Flow

1. Client connects to `/ws` with JWT token
2. Server verifies token and authenticates user
3. Server sends welcome message:
   ```json
   {
     "type": "connected",
     "message": "WebSocket connection established"
   }
   ```
4. Client receives parcel update events as they occur

## Events

### parcel_updated

Broadcasted when a parcel's owner or price changes (buy/list operations).

**Event Format:**
```json
{
  "type": "parcel_updated",
  "parcel_id": "parcel_123"
}
```

## Integration

### Publishing Events from Marketplace

#### Option 1: Using Middleware

```javascript
const { publishParcelEvent } = require('../../Real-time Events (WebSocket)/src/middleware/parcelEvents');

// In marketplace routes
router.post('/buy/:parcel_id', 
  authenticateToken, 
  buyParcel, 
  publishParcelEvent  // Add this middleware
);
```

#### Option 2: Direct Function Call

```javascript
const { publishParcelUpdateDirect } = require('../../Real-time Events (WebSocket)/src/middleware/parcelEvents');

// In marketplace controller after successful buy/list
async function buyParcel(req, res) {
  // ... buy logic ...
  
  await updateParcelOwner(parcel_id, buyerId, null, client);
  
  // Publish event
  publishParcelUpdateDirect(parcel_id);
  
  res.json({ ... });
}
```

### Client Example (JavaScript)

```javascript
const WebSocket = require('ws');

// Connect with JWT token
const token = 'your-jwt-token';
const ws = new WebSocket(`ws://localhost:3006/ws?token=${token}`);

ws.on('open', () => {
  console.log('Connected to WebSocket server');
});

ws.on('message', (data) => {
  const event = JSON.parse(data.toString());
  
  if (event.type === 'parcel_updated') {
    console.log('Parcel updated:', event.parcel_id);
    // Refresh parcel data or update UI
  }
});

ws.on('error', (error) => {
  console.error('WebSocket error:', error);
});

ws.on('close', () => {
  console.log('WebSocket connection closed');
});
```

### Browser Example

```javascript
const token = 'your-jwt-token';
const ws = new WebSocket(`ws://localhost:3006/ws?token=${token}`);

ws.onopen = () => {
  console.log('Connected');
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.type === 'parcel_updated') {
    console.log('Parcel updated:', data.parcel_id);
    // Update UI
  }
};

ws.onerror = (error) => {
  console.error('WebSocket error:', error);
};
```

## API Reference

### Functions

#### `publishParcelUpdate(parcelId)`

Publish a parcel update event.

**Parameters:**
- `parcelId` (string) - Parcel ID

**Example:**
```javascript
const { publishParcelUpdate } = require('./src/events');
await publishParcelUpdate('parcel_123');
```

#### `subscribeToParcelEvents(callback)`

Subscribe to parcel events (used internally by WebSocket server).

**Parameters:**
- `callback` (function) - Callback function(event)

**Returns:**
- Unsubscribe function

## Architecture

### Components

1. **WebSocket Server** (`src/websocket.js`)
   - Manages WebSocket connections
   - Authenticates clients using JWT
   - Broadcasts events to all connected clients

2. **Event Publisher** (`src/events.js`)
   - Publishes events to Redis pub/sub
   - Subscribes to events and broadcasts to WebSocket clients

3. **Redis Client** (`src/redis.js`)
   - Real Redis client if available
   - In-memory stub if Redis not available
   - Provides pub/sub functionality

4. **Authentication** (`src/auth.js`)
   - JWT token verification for WebSocket connections
   - Extracts token from query params or headers

### Event Flow

1. Marketplace operation (buy/list) completes
2. `publishParcelUpdate(parcelId)` is called
3. Event is published to Redis channel `parcel_events`
4. WebSocket server subscribes to channel
5. Event is received and broadcasted to all connected clients
6. Clients receive `{ type: 'parcel_updated', parcel_id: '...' }`

## Redis Support

### With Redis

If Redis is installed and `REDIS_URL` is configured:
- Events are published to Redis pub/sub
- Multiple server instances can share events
- Scalable for production

### Without Redis (Stub Mode)

If Redis is not available:
- Uses in-memory EventEmitter
- Works for single-server deployments
- Events are only shared within the same process

## Testing

Run tests:
```bash
npm test
```

Tests include:
- WebSocket connection with valid/invalid JWT
- Event broadcasting to multiple clients
- Connection cleanup on disconnect
- Multiple events in sequence

## Port Configuration

Default port: `3006`

Override with environment variable:
```bash
REALTIME_PORT=3007 npm start
```

## Security

- **JWT Authentication**: All WebSocket connections require valid JWT token
- **Token Verification**: Tokens are verified against Auth module
- **User Validation**: Users must exist in database
- **Connection Rejection**: Invalid tokens result in connection rejection

## Limitations

- **In-Memory Storage**: Client connections are stored in memory (lost on restart)
- **Single Process**: Stub mode only works within single process
- **No Message Queuing**: Disconnected clients don't receive missed events
- **No Room/Channel Support**: All clients receive all events (can be extended)

## Future Enhancements

- Room/channel support for targeted broadcasts
- Message queuing for offline clients
- Connection persistence (Redis-backed)
- Rate limiting for WebSocket connections
- Heartbeat/ping-pong for connection health
- Client reconnection handling
- Event filtering/subscription

## Troubleshooting

### Connection Rejected

- Verify JWT token is valid and not expired
- Check token is passed correctly (query param or header)
- Ensure Auth module is accessible

### Events Not Received

- Verify event is being published (`publishParcelUpdate` is called)
- Check Redis connection (if using Redis)
- Verify WebSocket connection is established
- Check server logs for errors

### Redis Connection Issues

- Verify Redis is running: `redis-cli ping`
- Check `REDIS_URL` environment variable
- Module will fall back to stub mode if Redis unavailable

