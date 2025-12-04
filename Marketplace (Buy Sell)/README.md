# Marketplace Module Backend

A production-ready marketplace module for buying and listing parcels with transaction safety and fee calculation.

## Features

- Buy parcels with automatic fee calculation
- List parcels for sale
- Transaction safety using SELECT ... FOR UPDATE
- Prevents double-buy race conditions
- Automatic wallet debit/credit
- Configurable marketplace fee

## Setup

1. Install dependencies:
```bash
npm install
```

2. Run migration to create marketplace_transactions table:
```bash
psql -d auth_db -f src/migrations/001_create_marketplace_transactions_table.sql
```

3. Configure marketplace fee (optional):
```bash
# In .env file
MARKETPLACE_FEE_PERCENT=5  # Default is 5%
```

4. Start the server:
```bash
npm start
```

## API Endpoints

### POST /market/buy/:parcel_id

Buy a parcel.

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**Response:**
```json
{
  "tx_id": "uuid",
  "parcel_id": "parcel_123",
  "price_cents": 100000,
  "fee_cents": 5000,
  "seller_receives_cents": 95000,
  "status": "completed",
  "created_at": "2024-01-01T00:00:00.000Z"
}
```

**Error Responses:**
- `400` - Invalid request (parcel not for sale, user already owns parcel)
- `404` - Parcel not found
- `409` - Insufficient balance
- `500` - Internal server error

### POST /market/list/:parcel_id

List a parcel for sale.

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**Request Body:**
```json
{
  "price_cents": 100000
}
```

**Response:**
```json
{
  "tx_id": "uuid",
  "parcel_id": "parcel_123",
  "price_cents": 100000,
  "status": "completed",
  "created_at": "2024-01-01T00:00:00.000Z"
}
```

**Error Responses:**
- `400` - Invalid price_cents
- `403` - User does not own the parcel
- `404` - Parcel not found
- `500` - Internal server error

## Database Schema

### marketplace_transactions table

- `tx_id` UUID PRIMARY KEY
- `parcel_id` TEXT NOT NULL (references parcels.parcel_id)
- `buyer_id` UUID NOT NULL (references users.id)
- `seller_id` UUID NULL (references users.id)
- `price_cents` BIGINT NOT NULL
- `fee_cents` BIGINT NOT NULL
- `seller_receives_cents` BIGINT NOT NULL
- `type` TEXT NOT NULL ('buy' or 'list')
- `status` TEXT NOT NULL ('pending', 'completed', 'failed')
- `created_at` TIMESTAMP DEFAULT NOW()

## Buy Flow

1. Lock parcel row using `SELECT ... FOR UPDATE`
2. Validate parcel exists and has a price
3. Validate buyer is not the current owner
4. Check buyer's wallet balance
5. Calculate fee and seller receives amount
6. Debit buyer's wallet
7. Credit seller's wallet (minus fee)
8. Update parcel owner_id
9. Create transaction record
10. Commit transaction

## Security Features

- **Row-level locking**: Uses `SELECT ... FOR UPDATE` to prevent race conditions
- **Transaction safety**: All operations within database transactions
- **Balance validation**: Checks available balance before purchase
- **Ownership validation**: Prevents users from buying their own parcels
- **SQL injection prevention**: All queries use parameterized statements

## Fee Configuration

The marketplace fee is configurable via environment variable:

```bash
MARKETPLACE_FEE_PERCENT=5  # 5% fee (default)
```

Fee calculation:
- Fee = price_cents × (fee_percent / 100)
- Seller receives = price_cents - fee_cents

## Testing

Run tests:
```bash
npm test
```

Tests include:
- Successful buy with fee calculation
- Insufficient funds handling
- Double-buy race condition prevention
- Listing parcels for sale
- Ownership validation

## Environment Variables

- `DB_HOST` - PostgreSQL host (default: localhost)
- `DB_PORT` - PostgreSQL port (default: 5432)
- `DB_NAME` - Database name (default: auth_db)
- `DB_USER` - Database user (default: postgres)
- `DB_PASSWORD` - Database password (default: postgres)
- `MARKETPLACE_PORT` - Server port (default: 3003)
- `MARKETPLACE_FEE_PERCENT` - Marketplace fee percentage (default: 5)
- `NODE_ENV` - Environment (development/production)

## Integration

This module integrates with:
- **Auth Module**: For user authentication
- **Wallet Module**: For balance operations
- **Parcels API**: For parcel data

Ensure these modules are accessible and properly configured.

