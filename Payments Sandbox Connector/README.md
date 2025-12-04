# Payments Sandbox Connector Module

A payments module that integrates with a fake/sandbox payment provider for testing deposit flows. This module handles deposit initiation, payment URL generation, and webhook callbacks for confirming deposits.

## Features

- Deposit creation with pending ledger entries
- Fake payment URL generation for testing
- Webhook callback handling for deposit confirmation
- Idempotent webhook processing
- Automatic wallet balance crediting on confirmation
- Database transaction safety

## Setup

1. Install dependencies:
```bash
npm install
```

2. Ensure database is set up (uses same database as auth and wallet modules):
```bash
# Wallet tables must exist (run wallet migrations first)
psql -d auth_db -f ../Wallet/src/migrations/001_create_wallet_tables.sql
```

3. Configure environment variables (optional, defaults provided):
```bash
# .env file
DB_HOST=localhost
DB_PORT=5432
DB_NAME=auth_db
DB_USER=postgres
DB_PASSWORD=postgres
PAYMENTS_PORT=3004
```

4. Start the server:
```bash
npm start
```

## API Endpoints

### POST /payments/deposit

Create a deposit and generate a fake payment URL for testing.

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**Request Body:**
```json
{
  "amount_cents": 10000
}
```

**Response:**
```json
{
  "tx_id": "uuid",
  "payment_url": "https://sandbox-payment.example.com/pay/{tx_id}",
  "amount_cents": 10000,
  "status": "pending"
}
```

**Error Responses:**
- `400` - Invalid amount (missing, negative, or non-integer)
- `401` - Authentication required

### POST /payments/webhook

Handle webhook callback from sandbox payment provider. Updates ledger status and credits wallet balance if status is 'completed'. This endpoint is idempotent - duplicate calls with the same status will not double-credit the wallet.

**Request Body:**
```json
{
  "tx_id": "uuid",
  "status": "completed"
}
```

Or for failed payments:
```json
{
  "tx_id": "uuid",
  "status": "failed"
}
```

**Response:**
```json
{
  "success": true,
  "tx_id": "uuid",
  "status": "completed"
}
```

**Error Responses:**
- `400` - Invalid request (missing tx_id, invalid status, or transaction not in pending state)
- `404` - Transaction not found

**Idempotency:**
If a webhook is called multiple times with the same status, subsequent calls will return success without re-processing:
```json
{
  "success": true,
  "tx_id": "uuid",
  "status": "completed",
  "message": "Transaction already in this status"
}
```

## Deposit Lifecycle

1. **Create Deposit**: Client calls `POST /payments/deposit` with `amount_cents`
   - Creates `wallet_ledger` entry with `type='deposit'`, `status='pending'`
   - Returns `payment_url` for testing

2. **Payment Processing**: (Simulated in sandbox)
   - User would visit the `payment_url` in a real scenario
   - Sandbox provider processes the payment

3. **Webhook Callback**: Sandbox provider calls `POST /payments/webhook`
   - Updates ledger status to `completed` or `failed`
   - If `completed`: Credits wallet balance in a database transaction
   - If `failed`: Only updates ledger status (no balance change)

4. **Result**: Wallet balance is updated and ledger entry reflects final status

## Database Integration

This module uses the existing `wallet_ledger` table from the Wallet module:

- **No new migrations required** - Uses existing wallet_ledger schema
- **Shared models** - Imports functions from Wallet module:
  - `walletLedger.createLedgerEntry()` - Create deposit entries
  - `walletLedger.getLedgerEntryById()` - Lookup transactions
  - `walletLedger.updateLedgerStatus()` - Update status (added for payments)
  - `wallet.updateBalance()` - Credit wallet on confirmation
  - `wallet.initializeWallet()` - Ensure wallet exists

## Testing

Run tests:
```bash
npm test
```

Tests include:
- Deposit creation with payment URL generation
- Webhook confirmation and balance crediting
- Webhook idempotency (duplicate calls don't double-credit)
- Failed payment handling
- Invalid transaction ID handling
- Input validation
- Full deposit lifecycle

## Integration

This module integrates with:

- **Auth Module**: Uses `authenticateToken` middleware for deposit endpoint
- **Wallet Module**: Accesses `wallet_ledger` table and wallet balance functions
- **Database**: Same PostgreSQL instance, shared connection pool pattern

## Security

- All balance updates use database transactions
- Input validation on all endpoints
- Idempotent webhook processing prevents double-crediting
- Authentication required for deposit creation
- Webhook endpoint is public (for sandbox provider callbacks)

## Example Usage

### Create a Deposit

```bash
curl -X POST http://localhost:3004/payments/deposit \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"amount_cents": 5000}'
```

Response:
```json
{
  "tx_id": "123e4567-e89b-12d3-a456-426614174000",
  "payment_url": "https://sandbox-payment.example.com/pay/123e4567-e89b-12d3-a456-426614174000",
  "amount_cents": 5000,
  "status": "pending"
}
```

### Simulate Webhook Callback

```bash
curl -X POST http://localhost:3004/payments/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "tx_id": "123e4567-e89b-12d3-a456-426614174000",
    "status": "completed"
  }'
```

Response:
```json
{
  "success": true,
  "tx_id": "123e4567-e89b-12d3-a456-426614174000",
  "status": "completed"
}
```

## Port Configuration

Default port: `3004`

Override with environment variable:
```bash
PAYMENTS_PORT=3005 npm start
```

