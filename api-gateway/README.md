# API Gateway

Consolidated backend gateway for the Gaming Platform. This module combines Auth, Parcels, Wallet, Marketplace, Rentals, and Anti-Fraud functionality into a single service.

## Architecture

The API Gateway is a hybrid monolith that consolidates core backend modules:

- **Auth**: User registration, login, and JWT authentication
- **Parcels**: Geospatial parcel queries with PostGIS
- **Wallet**: Balance management and transaction ledger
- **Marketplace**: Buy and sell parcels
- **Rentals**: Rent parcels for time-based usage
- **Anti-Fraud**: Rate limiting and security middleware

## Features

- Single database connection pool shared across all modules
- JWT-based authentication
- Rate limiting (100 req/min per IP globally)
- Transaction-safe operations (atomic DB transactions)
- CORS support for frontend integration
- Health check endpoint

## API Endpoints

### Authentication (`/auth`)
- `POST /auth/register` - Register new user
- `POST /auth/login` - Login and get JWT token
- `GET /auth/me` - Get current user profile (requires auth)

### Parcels (`/parcels`)
- `GET /parcels?bbox=minLon,minLat,maxLon,maxLat` - Get parcels in bounding box (GeoJSON)
- `GET /parcels/:id` - Get single parcel by ID

### Wallet (`/wallet`)
- `GET /wallet` - Get wallet balance (requires auth)
- `POST /wallet/deposit` - Create deposit ledger entry (requires auth)
- `POST /wallet/withdraw` - Create withdraw ledger entry (requires auth + KYC)

### Marketplace (`/market`)
- `POST /market/buy/:parcel_id` - Buy a parcel (requires auth)
- `POST /market/list/:parcel_id` - List parcel for sale (requires auth)

### Rentals (`/rent`)
- `POST /rent/list/:parcel_id` - List parcel for rent (requires auth, owner only)
- `POST /rent/start/:parcel_id` - Start a rental (requires auth)
- `GET /rent/my` - Get active rentals (requires auth)

### System
- `GET /health` - Health check
- `GET /` - API information

## Environment Variables

See `.env.example` for all configuration options.

Key variables:
- `PORT` - Server port (default: 4000)
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` - PostgreSQL connection
- `JWT_SECRET` - Secret key for JWT tokens
- `MARKETPLACE_FEE_PERCENT` - Marketplace fee percentage (default: 5)
- `RENTAL_FEE_PERCENT` - Rental fee percentage (default: 5)

## Running Locally

```bash
npm install
cp .env.example .env
# Edit .env with your database credentials
npm start
```

## Running with Docker

```bash
docker build -t api-gateway .
docker run -p 4000:4000 --env-file .env api-gateway
```

## Database Requirements

The API Gateway requires PostgreSQL 15+ with PostGIS extension. All migrations should be run before starting the gateway.

Required tables:
- `users` (Auth module)
- `wallets`, `wallet_ledger` (Wallet module)
- `parcels` (Parcels module, with PostGIS geometry column)
- `marketplace_transactions` (Marketplace module)
- `rent_listings`, `rental_agreements` (Rentals module)

## Development

The gateway is structured as follows:

```
api-gateway/
├── src/
│   ├── config/          # Configuration (database, fees)
│   ├── controllers/     # Request handlers
│   ├── middleware/      # Auth, KYC, rate limiting
│   ├── models/          # Database models
│   ├── routes/          # Route definitions
│   ├── utils/           # JWT, GeoJSON helpers, rate limiter
│   └── index.js         # Main entry point
├── package.json
├── Dockerfile
└── README.md
```

## License

ISC

