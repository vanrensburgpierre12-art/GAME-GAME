# Admin Panel Backend

Backend API for admin panel with admin-only endpoints for managing parcels, KYC verification, transaction logs, and system administration.

## Features

- Admin-only endpoints (requires `is_admin = true`)
- Parcel management and overview
- H3 seeder for creating parcels
- KYC verification endpoints
- Combined transaction logs (marketplace + wallet)
- User management and statistics
- System statistics dashboard

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables (optional):
```bash
# .env file
DB_HOST=localhost
DB_PORT=5432
DB_NAME=auth_db
DB_USER=postgres
DB_PASSWORD=postgres
ADMIN_PORT=3007
FRONTEND_URL=http://localhost:3008
```

3. Start the server:
```bash
npm start
```

## API Endpoints

All endpoints require authentication and admin privileges.

### GET /admin/parcels

Get all parcels with pagination and filtering.

**Query Parameters:**
- `page` (number, default: 1) - Page number
- `limit` (number, default: 50) - Items per page
- `owner_id` (UUID, optional) - Filter by owner
- `min_price` (number, optional) - Minimum price filter
- `max_price` (number, optional) - Maximum price filter

**Response:**
```json
{
  "parcels": [...],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 100,
    "totalPages": 2
  }
}
```

### POST /admin/seed

Trigger H3 seeder to create parcels.

**Request Body:**
```json
{
  "resolution": 9,
  "bbox": {
    "minLon": -122.5,
    "minLat": 37.7,
    "maxLon": -122.3,
    "maxLat": 37.8
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Created 100 parcels",
  "parcelsCreated": 100,
  "parcelIds": [...],
  "resolution": 9
}
```

### POST /admin/kyc/verify/:user_id

Verify or reject KYC submission.

**Request Body:**
```json
{
  "status": "verified"
}
```

### GET /admin/logs/transactions

Get combined transaction logs (marketplace + wallet).

**Query Parameters:**
- `type` (string, optional) - Filter by type (buy, list, deposit, withdraw)
- `status` (string, optional) - Filter by status
- `start_date` (ISO date, optional) - Start date filter
- `end_date` (ISO date, optional) - End date filter
- `page` (number, default: 1)
- `limit` (number, default: 100)

### GET /admin/users

Get all users with statistics.

**Query Parameters:**
- `page` (number, default: 1)
- `limit` (number, default: 50)
- `kyc_status` (string, optional) - Filter by KYC status

### GET /admin/stats

Get system statistics.

**Response:**
```json
{
  "users": { "total": 150 },
  "parcels": {
    "total": 1000,
    "owned": 450,
    "for_sale": 200
  },
  "transactions": {
    "total": 500,
    "total_volume_cents": 5000000
  },
  "wallets": {
    "total_balance_cents": 10000000
  },
  "kyc": {
    "pending": 5
  }
}
```

### GET /admin/kyc/pending

Get pending KYC submissions.

**Query Parameters:**
- `page` (number, default: 1)
- `limit` (number, default: 50)

## Authentication

All endpoints require:
1. Valid JWT token in `Authorization: Bearer <token>` header
2. User must have `is_admin = true` in users table

## Integration

This module integrates with:
- **Auth Module**: Uses `authenticateToken` middleware
- **KYC Module**: Uses KYC verification functions
- **Database**: Same PostgreSQL instance, shared connection pool

## Port Configuration

Default port: `3007`

Override with environment variable:
```bash
ADMIN_PORT=3008 npm start
```

