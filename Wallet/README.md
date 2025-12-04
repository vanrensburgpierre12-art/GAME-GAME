# Wallet Module Backend

A production-ready wallet module with balance tracking, deposits, withdrawals, and immutable ledger entries.

## Features

- Wallet balance and reserved amount tracking
- Deposit and withdrawal operations
- Immutable transaction ledger
- KYC verification requirement for withdrawals
- Database transaction safety
- Concurrent operation handling

## Setup

1. Install dependencies:
```bash
npm install
```

2. Ensure database is set up (uses same database as auth module):
```bash
# Run wallet migrations
psql -d auth_db -f src/migrations/001_create_wallet_tables.sql
```

3. Start the server:
```bash
npm start
```

## API Endpoints

### GET /wallet
Get wallet balance and reserved amount.

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**Response:**
```json
{
  "balance_cents": 100000,
  "reserved_cents": 5000,
  "available_cents": 95000
}
```

### POST /wallet/deposit
Create a deposit ledger entry.

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**Request Body:**
```json
{
  "amount_cents": 10000,
  "ref": "Payment reference (optional)"
}
```

**Response:**
```json
{
  "tx_id": "uuid",
  "amount_cents": 10000,
  "type": "deposit",
  "status": "pending",
  "ref": "Payment reference",
  "created_at": "2024-01-01T00:00:00.000Z"
}
```

### POST /wallet/withdraw
Create a withdrawal ledger entry (requires KYC verification).

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**Request Body:**
```json
{
  "amount_cents": 5000,
  "ref": "Withdrawal reference (optional)"
}
```

**Response:**
```json
{
  "tx_id": "uuid",
  "amount_cents": 5000,
  "type": "withdraw",
  "status": "pending",
  "ref": "Withdrawal reference",
  "created_at": "2024-01-01T00:00:00.000Z"
}
```

**Error Responses:**
- `403` - KYC verification required
- `409` - Insufficient balance

## Database Schema

### wallets table
- `user_id` UUID PRIMARY KEY (references users.id)
- `balance_cents` BIGINT NOT NULL DEFAULT 0
- `reserved_cents` BIGINT NOT NULL DEFAULT 0

### wallet_ledger table
- `tx_id` UUID PRIMARY KEY
- `user_id` UUID NOT NULL (references users.id)
- `amount_cents` BIGINT NOT NULL
- `type` TEXT NOT NULL ('deposit' or 'withdraw')
- `ref` TEXT (optional reference)
- `status` TEXT NOT NULL ('pending', 'completed', 'failed')
- `created_at` TIMESTAMP DEFAULT NOW()

## Testing

Run tests:
```bash
npm test
```

Tests include:
- Balance operations
- Deposit and withdrawal endpoints
- KYC verification requirements
- Concurrent debit operations
- Transaction safety
- Ledger immutability

## Integration

This module integrates with the auth module:
- Uses `authenticateToken` middleware from auth module
- Checks `kyc_status` from users table
- Uses same database connection pool

## Security

- All balance updates use database transactions
- Never trust client values - all inputs validated server-side
- Ledger entries are immutable (no updates/deletes)
- KYC verification required for withdrawals
- Database-level constraints prevent negative balances

