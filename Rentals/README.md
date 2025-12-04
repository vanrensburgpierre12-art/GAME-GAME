# Rentals Module Backend

A production-ready rentals module for managing parcel rentals with time-based pricing and fee calculation.

## Features

- List parcels for rent (owner-only)
- Start rentals with duration validation
- Automatic cost calculation based on price per hour
- Fee calculation and wallet debit/credit
- View active rentals
- Transaction safety with row-level locking

## Setup

1. Install dependencies:
```bash
npm install
```

2. Run migration to create rental tables:
```bash
psql -d auth_db -f src/migrations/001_create_rental_tables.sql
```

3. Configure rental fee (optional):
```bash
# In .env file
RENTAL_FEE_PERCENT=5  # Default is 5% (uses MARKETPLACE_FEE_PERCENT if not set)
```

4. Start the server:
```bash
npm start
```

## API Endpoints

### POST /rent/list/:parcel_id

List a parcel for rent (owner-only).

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**Request Body:**
```json
{
  "price_per_hour_cents": 10000,
  "min_seconds": 3600,
  "max_seconds": 86400
}
```

**Response:**
```json
{
  "listing_id": "uuid",
  "parcel_id": "parcel_123",
  "price_per_hour_cents": 10000,
  "min_seconds": 3600,
  "max_seconds": 86400,
  "active": true,
  "created_at": "2024-01-01T00:00:00.000Z"
}
```

**Error Responses:**
- `400` - Invalid parameters
- `403` - User does not own the parcel
- `404` - Parcel not found
- `500` - Internal server error

### POST /rent/start/:parcel_id

Start a rental.

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**Request Body:**
```json
{
  "duration_seconds": 7200
}
```

**Response:**
```json
{
  "rental_id": "uuid",
  "parcel_id": "parcel_123",
  "owner_id": "uuid",
  "renter_id": "uuid",
  "start_ts": "2024-01-01T00:00:00.000Z",
  "end_ts": "2024-01-01T02:00:00.000Z",
  "total_cents": 20000,
  "fee_cents": 1000,
  "owner_receives_cents": 19000,
  "status": "active",
  "created_at": "2024-01-01T00:00:00.000Z"
}
```

**Error Responses:**
- `400` - Invalid duration or parcel not listed
- `409` - Insufficient balance
- `500` - Internal server error

### GET /rent/my

Get active rentals for current user (as renter or owner).

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**Response:**
```json
{
  "rentals": [
    {
      "rental_id": "uuid",
      "parcel_id": "parcel_123",
      "owner_id": "uuid",
      "renter_id": "uuid",
      "start_ts": "2024-01-01T00:00:00.000Z",
      "end_ts": "2024-01-01T02:00:00.000Z",
      "total_cents": 20000,
      "status": "active",
      "created_at": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

## Database Schema

### rent_listings table

- `listing_id` UUID PRIMARY KEY
- `parcel_id` TEXT NOT NULL (references parcels.parcel_id)
- `owner_id` UUID NOT NULL (references users.id)
- `price_per_hour_cents` BIGINT NOT NULL
- `min_seconds` INTEGER NOT NULL
- `max_seconds` INTEGER NOT NULL
- `active` BOOLEAN NOT NULL DEFAULT true
- `created_at` TIMESTAMP DEFAULT NOW()
- `updated_at` TIMESTAMP DEFAULT NOW()
- Unique constraint: one active listing per parcel

### rental_agreements table

- `rental_id` UUID PRIMARY KEY
- `parcel_id` TEXT NOT NULL (references parcels.parcel_id)
- `owner_id` UUID NOT NULL (references users.id)
- `renter_id` UUID NOT NULL (references users.id)
- `start_ts` TIMESTAMP NOT NULL
- `end_ts` TIMESTAMP NOT NULL
- `total_cents` BIGINT NOT NULL
- `status` TEXT NOT NULL ('active', 'completed', 'cancelled')
- `created_at` TIMESTAMP DEFAULT NOW()

## Rental Start Flow

1. Lock listing row using `SELECT ... FOR UPDATE`
2. Validate parcel is listed for rent (active = true)
3. Validate duration within min/max seconds
4. Calculate total cost: (price_per_hour_cents × duration_seconds) / 3600
5. Check renter's wallet balance
6. Calculate fee and owner receives amount
7. Debit renter's wallet
8. Credit owner's wallet (minus fee)
9. Create rental_agreement with status='active'
10. Set start_ts = NOW(), end_ts = NOW() + duration_seconds
11. Commit transaction

## Cost Calculation

- **Total Cost**: `(price_per_hour_cents × duration_seconds) / 3600`
- **Fee**: `total_cents × (fee_percent / 100)`
- **Owner Receives**: `total_cents - fee_cents`

Example:
- Price: 10,000 cents/hour
- Duration: 2 hours (7,200 seconds)
- Total: 20,000 cents
- Fee (5%): 1,000 cents
- Owner receives: 19,000 cents

## Validation

- **Duration**: Must be between min_seconds and max_seconds
- **Listing**: Parcel must have an active listing
- **Ownership**: Only parcel owner can create listings
- **Balance**: Renter must have sufficient balance

## Security Features

- **Row-level locking**: Uses `SELECT ... FOR UPDATE` to prevent race conditions
- **Transaction safety**: All operations within database transactions
- **Balance validation**: Checks available balance before rental
- **Ownership validation**: Prevents unauthorized listing creation
- **SQL injection prevention**: All queries use parameterized statements

## Testing

Run tests:
```bash
npm test
```

Tests include:
- List parcel for rent
- Start rental with fee calculation
- Duration validation (min/max)
- Insufficient balance handling
- Parcel not listed for rent
- Ownership validation
- Basic rent flow (list → start → check)

## Environment Variables

- `DB_HOST` - PostgreSQL host (default: localhost)
- `DB_PORT` - PostgreSQL port (default: 5432)
- `DB_NAME` - Database name (default: auth_db)
- `DB_USER` - Database user (default: postgres)
- `DB_PASSWORD` - Database password (default: postgres)
- `RENTALS_PORT` - Server port (default: 3004)
- `RENTAL_FEE_PERCENT` - Rental fee percentage (default: 5, or uses MARKETPLACE_FEE_PERCENT)
- `NODE_ENV` - Environment (development/production)

## Integration

This module integrates with:
- **Auth Module**: For user authentication
- **Wallet Module**: For balance operations
- **Parcels API**: For parcel ownership verification

Ensure these modules are accessible and properly configured.

