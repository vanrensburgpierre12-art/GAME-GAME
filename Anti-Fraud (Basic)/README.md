# Anti-Fraud Module

A basic anti-fraud module providing rate limiting, IP location checks, and buy attempt protection for the marketplace system.

## Features

- **Rate Limiting**: Configurable requests per minute per endpoint
- **IP Location Detection**: Detects mismatches between IP and user-declared location (logs only)
- **Buy Attempt Protection**: Blocks rapid repeated buy attempts for the same parcel
- **New User Caps**: Limits buy attempts for new users
- **Extensible Design**: Easy to extend with additional fraud detection rules

## Installation

```bash
npm install
```

## Usage

### As Middleware

```javascript
const express = require('express');
const app = express();
const { rateLimit, ipLocationCheck, buyAttemptProtection } = require('./path/to/antifraud');

// Apply rate limiting to all routes
app.use(rateLimit({ maxRequests: 60, windowMs: 60000 }));

// Apply IP location check (logs mismatches)
app.use(ipLocationCheck());

// Apply buy attempt protection to buy route
app.post('/market/buy/:parcel_id', 
  authenticateToken,
  buyAttemptProtection({ cooldownMs: 5000 }),
  buyParcel
);
```

### As Function

```javascript
const { checkBuyAttempt, recordBuyAttempt } = require('./path/to/antifraud');

// In your buy controller
async function buyParcel(req, res) {
  const user = req.user;
  const parcel = await getParcel(req.params.parcel_id);
  
  // Check if buy attempt is allowed
  const fraudCheck = checkBuyAttempt(user, parcel, {
    maxBuyAttemptsPerMinute: 10,
    buyCooldownMs: 5000,
    newUserMaxBuys: 3,
  });
  
  if (!fraudCheck.allowed) {
    return res.status(429).json({ 
      error: fraudCheck.reason 
    });
  }
  
  // Proceed with buy...
  
  // Record successful buy attempt
  recordBuyAttempt(user.id, parcel.parcel_id);
}
```

## API Reference

### Middleware

#### `rateLimit(options)`

Rate limiting middleware factory.

**Options:**
- `maxRequests` (number, default: 60) - Maximum requests allowed
- `windowMs` (number, default: 60000) - Time window in milliseconds
- `keyGenerator` (function, default: uses IP) - Function to generate rate limit key
- `message` (string, default: 'Too many requests, please try again later') - Error message

**Example:**
```javascript
app.use(rateLimit({ 
  maxRequests: 100, 
  windowMs: 60000,
  keyGenerator: (req) => `user:${req.user?.id || req.ip}`
}));
```

#### `ipLocationCheck(options)`

IP location check middleware (logs mismatches, doesn't block).

**Options:**
- `getUserLocation` (function) - Function to get user's declared location

**Example:**
```javascript
app.use(ipLocationCheck({
  getUserLocation: (req) => req.user?.country
}));
```

#### `buyAttemptProtection(options)`

Blocks rapid repeated buy attempts.

**Options:**
- `cooldownMs` (number, default: 5000) - Cooldown period in milliseconds
- `getParcelId` (function) - Function to extract parcel ID from request

**Example:**
```javascript
app.post('/market/buy/:parcel_id', 
  buyAttemptProtection({ cooldownMs: 10000 })
);
```

### Functions

#### `checkBuyAttempt(user, parcel, options)`

Check if a buy attempt is allowed. Performs multiple fraud checks.

**Parameters:**
- `user` (object) - User object with `id` and `created_at`
- `parcel` (object) - Parcel object with `parcel_id`
- `options` (object, optional) - Configuration options

**Options:**
- `maxBuyAttemptsPerMinute` (number, default: 10)
- `buyCooldownMs` (number, default: 5000)
- `newUserMaxBuys` (number, default: 3)
- `newUserWindowMs` (number, default: 86400000 = 24h)

**Returns:**
```javascript
{
  allowed: boolean,
  reason?: string
}
```

#### `recordBuyAttempt(userId, parcelId)`

Record a buy attempt (call after successful buy).

**Parameters:**
- `userId` (string) - User ID
- `parcelId` (string) - Parcel ID

## Configuration

### Rate Limiting

Default: 60 requests per minute per IP/user.

To customize:
```javascript
rateLimit({ 
  maxRequests: 100,  // Allow 100 requests
  windowMs: 60000    // Per minute
})
```

### Buy Attempt Protection

Default: 5 second cooldown between buy attempts for the same parcel.

To customize:
```javascript
buyAttemptProtection({ 
  cooldownMs: 10000  // 10 second cooldown
})
```

### New User Caps

Default: Maximum 3 buy attempts in first 24 hours for new users.

To customize:
```javascript
checkBuyAttempt(user, parcel, {
  newUserMaxBuys: 5,        // Allow 5 buys
  newUserWindowMs: 86400000 // In 24 hours
})
```

## Testing

Run tests:
```bash
npm test
```

Tests include:
- Rate limiter unit tests
- Buy attempt protection tests
- New user cap tests
- Integration tests

## Extensibility

The module is designed to be easily extended:

1. **Add new fraud checks**: Extend `checkBuyAttempt()` function
2. **Custom rate limit keys**: Use `keyGenerator` option
3. **Additional middleware**: Create new middleware following the same pattern
4. **Persistent storage**: Replace in-memory stores with Redis/database

### Example: Adding a new check

```javascript
// In src/antifraud.js
function checkBuyAttempt(user, parcel, options = {}) {
  // ... existing checks ...
  
  // New check: Block if user has too many failed attempts
  const failedAttempts = getFailedAttemptCount(user.id);
  if (failedAttempts > 5) {
    return {
      allowed: false,
      reason: 'Too many failed buy attempts',
    };
  }
  
  // ... rest of checks ...
}
```

## Integration with Marketplace

Example integration in marketplace controller:

```javascript
const { checkBuyAttempt, recordBuyAttempt } = require('../../Anti-Fraud (Basic)/src');

async function buyParcel(req, res) {
  const user = req.user;
  const parcel = await getParcel(req.params.parcel_id);
  
  // Fraud check
  const fraudCheck = checkBuyAttempt(user, parcel);
  if (!fraudCheck.allowed) {
    return res.status(429).json({ error: fraudCheck.reason });
  }
  
  // ... proceed with buy ...
  
  // Record successful buy
  recordBuyAttempt(user.id, parcel.parcel_id);
}
```

## Architecture

- **In-Memory Storage**: Uses Map-based storage for rate limiting and buy attempt tracking
- **Automatic Cleanup**: Expired entries are cleaned up automatically
- **Singleton Pattern**: Rate limiter and buy attempt tracker are singletons
- **Middleware Pattern**: Follows Express middleware conventions

## Limitations

- **In-Memory Only**: Data is lost on server restart (use Redis for production)
- **Single Server**: Doesn't work across multiple servers (use shared storage)
- **IP Location**: Stub implementation (integrate GeoIP service for production)
- **New User Tracking**: Simplified per-parcel tracking (extend for total purchases)

## Future Enhancements

- Redis-backed storage for distributed systems
- GeoIP service integration for IP location
- Machine learning-based fraud detection
- User behavior analysis
- Device fingerprinting
- Transaction pattern analysis

