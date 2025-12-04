# Gaming Platform

A comprehensive parcel-based virtual property gaming platform with marketplace, rentals, payments, KYC, and real-time features.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        Nginx (Port 80)                      │
│               Reverse Proxy + Load Balancer                │
└──────────────┬──────────────────────────┬───────────────────┘
               │                          │
    ┌──────────┴────────┐      ┌─────────┴──────────┐
    │  Frontend (Map)   │      │ Frontend (Admin)   │
    │  React + Mapbox   │      │      React         │
    └───────────────────┘      └────────────────────┘
               │                          │
               └──────────┬───────────────┘
                          │
        ┌─────────────────┼─────────────────┐
        │                 │                 │
   ┌────┴────┐      ┌────┴────┐      ┌────┴────┐
   │   API   │      │Payments │      │   KYC   │
   │ Gateway │      │ Service │      │ Service │
   │(Core)   │      │         │      │         │
   └────┬────┘      └────┬────┘      └────┬────┘
        │                │                 │
   ┌────┴────┐      ┌───┴─────┐
   │Real-time│      │  Admin  │
   │   WS    │      │ Backend │
   └────┬────┘      └────┬────┘
        │                │
        └────────┬───────┘
                 │
    ┌────────────┴────────────┐
    │  PostgreSQL + PostGIS   │  Redis
    └─────────────────────────┘    │
```

## Services

### Core Services

#### API Gateway (Port 4000)
Hybrid monolith containing:
- **Auth**: User registration, login, JWT authentication
- **Parcels**: Geospatial parcel queries (PostGIS)
- **Wallet**: Balance management and transaction ledger
- **Marketplace**: Buy and sell parcels
- **Rentals**: Time-based parcel rentals
- **Anti-Fraud**: Rate limiting and security

#### Payments Service (Port 3005)
- Sandbox payment integration
- Deposit handling
- Webhook processing
- Ledger management

#### KYC Service (Port 3007)
- KYC document submission
- Admin verification workflow
- Document upload and storage

#### Real-time Service (Port 3006)
- WebSocket connections
- Real-time parcel updates
- Redis pub/sub for scaling
- Event broadcasting

#### Admin Backend (Port 3008)
- Admin-only endpoints
- User management
- Transaction logs
- System monitoring

### Frontends

#### Map Frontend
- Interactive Mapbox GL map
- Parcel visualization
- Buy/rent interface
- Real-time updates

#### Admin Frontend
- Admin dashboard
- KYC review
- User management
- Analytics

### Infrastructure

#### Nginx
- Reverse proxy
- Load balancing
- WebSocket routing
- Rate limiting
- SSL termination (production)

#### PostgreSQL + PostGIS
- Persistent data storage
- Geospatial queries
- Transaction support

#### Redis
- Caching
- Pub/sub for real-time events
- Session storage

## Quick Start

### Prerequisites

- Docker 20.10+
- Docker Compose 2.0+
- 8GB RAM minimum
- 20GB disk space

### Setup

1. **Clone the repository**
   ```bash
   cd "Gaming gaming"
   ```

2. **Set environment variables**
   ```bash
   # Create .env file in root
   echo "JWT_SECRET=$(openssl rand -hex 32)" > .env
   echo "MAPBOX_TOKEN=your-mapbox-token" >> .env
   echo "PAYMENT_WEBHOOK_SECRET=$(openssl rand -hex 32)" >> .env
   ```

3. **Build and start all services**
   ```bash
   npm run docker:build
   npm run docker:up
   ```

4. **Check service health**
   ```bash
   npm run docker:ps
   npm run docker:logs
   ```

5. **Access the application**
   - Map Frontend: http://localhost
   - Admin Panel: http://localhost/admin
   - API Gateway: http://localhost/api
   - API Health: http://localhost/health

### Development

Run services individually for development:

```bash
# API Gateway
npm run dev:api

# Payments Service
npm run dev:payments

# KYC Service
npm run dev:kyc

# Real-time Service
npm run dev:realtime

# Admin Backend
npm run dev:admin-backend

# Map Frontend
npm run dev:map

# Admin Frontend
npm run dev:admin-frontend
```

### Testing

```bash
# Run all tests
npm run test:api
npm run test:payments
npm run test:kyc
npm run test:realtime
```

## API Documentation

### Authentication

All authenticated endpoints require a JWT token in the Authorization header:

```
Authorization: Bearer <token>
```

Get a token by registering or logging in:

```bash
# Register
curl -X POST http://localhost/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password123","display_name":"User"}'

# Login
curl -X POST http://localhost/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password123"}'
```

### Core Endpoints

#### Parcels
- `GET /api/parcels?bbox=minLon,minLat,maxLon,maxLat` - Get parcels in bounding box
- `GET /api/parcels/:id` - Get single parcel

#### Wallet
- `GET /api/wallet` - Get balance (auth)
- `POST /api/wallet/deposit` - Create deposit (auth)
- `POST /api/wallet/withdraw` - Withdraw funds (auth + KYC)

#### Marketplace
- `POST /api/market/buy/:parcel_id` - Buy parcel (auth)
- `POST /api/market/list/:parcel_id` - List for sale (auth)

#### Rentals
- `POST /api/rent/list/:parcel_id` - List for rent (auth)
- `POST /api/rent/start/:parcel_id` - Start rental (auth)
- `GET /api/rent/my` - Get my rentals (auth)

#### Payments
- `POST /api/payments/deposit` - Create deposit (auth)
- `POST /api/payments/webhook` - Payment webhook (public)

#### KYC
- `POST /api/kyc/submit` - Submit KYC (auth)
- `GET /api/kyc/status` - Check status (auth)
- `POST /api/kyc/admin/verify/:user_id` - Verify user (admin)

#### Admin
- `GET /api/admin/parcels` - Get all parcels (admin)
- `POST /api/admin/seed` - Seed parcels (admin)
- `GET /api/admin/users` - Get users (admin)
- `GET /api/admin/logs/transactions` - Transaction logs (admin)

### WebSocket

Connect to real-time updates:

```javascript
const ws = new WebSocket('ws://localhost/ws?token=YOUR_JWT_TOKEN');

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.type === 'parcel_updated') {
    console.log('Parcel updated:', data.parcel_id);
  }
};
```

## Database Schema

### Users
- `id` (UUID, PK)
- `email` (unique)
- `password_hash`
- `display_name`
- `kyc_status` (none, submitted, verified, rejected)
- `is_admin` (boolean)
- `created_at`

### Parcels
- `parcel_id` (string, PK)
- `geom` (geometry, PostGIS)
- `owner_id` (UUID, FK -> users)
- `price_cents` (integer, nullable)
- `available_for_rent` (boolean)
- `metadata` (jsonb)

### Wallets
- `user_id` (UUID, PK, FK -> users)
- `balance_cents` (integer)
- `reserved_cents` (integer)

### Wallet Ledger
- `tx_id` (UUID, PK)
- `user_id` (UUID, FK -> users)
- `amount_cents` (integer)
- `type` (deposit, withdraw)
- `ref` (text)
- `status` (pending, completed, failed)
- `created_at`

### Marketplace Transactions
- `tx_id` (UUID, PK)
- `parcel_id` (string, FK -> parcels)
- `buyer_id` (UUID, FK -> users)
- `seller_id` (UUID, FK -> users)
- `price_cents` (integer)
- `fee_cents` (integer)
- `seller_receives_cents` (integer)
- `type` (buy, list)
- `status` (completed)
- `created_at`

### Rental Listings & Agreements
See individual service READMEs for details.

## Configuration

### Environment Variables

See `.env.example` files in each service directory for full configuration options.

Key variables:
- `JWT_SECRET` - Secret key for JWT tokens (required)
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` - Database connection
- `MAPBOX_TOKEN` - Mapbox access token for map frontend
- `MARKETPLACE_FEE_PERCENT` - Fee percentage (default: 5)
- `RENTAL_FEE_PERCENT` - Rental fee percentage (default: 5)

### Scaling

To scale services horizontally:

```bash
# Scale API Gateway to 3 instances
docker-compose up -d --scale api-gateway=3

# Scale Real-time service to 2 instances
docker-compose up -d --scale realtime-service=2
```

Note: Redis pub/sub ensures real-time events work across scaled instances.

## Monitoring

### Service Health Checks

```bash
# Check all services
curl http://localhost/health

# Check specific service
curl http://localhost:4000/health  # API Gateway
curl http://localhost:3005/health  # Payments
curl http://localhost:3006/health  # Real-time
```

### Logs

```bash
# All services
npm run docker:logs

# Specific service
npm run docker:logs:api
npm run docker:logs:payments
npm run docker:logs:nginx
```

### Docker Stats

```bash
docker stats
```

## Troubleshooting

### Services not starting

```bash
# Check service status
npm run docker:ps

# View logs
npm run docker:logs

# Restart services
npm run docker:restart
```

### Database connection issues

```bash
# Check PostgreSQL
docker-compose logs postgres

# Check if migrations ran
docker-compose logs migrations
```

### Port conflicts

If ports are already in use, modify `docker-compose.yml`:

```yaml
ports:
  - "8080:80"  # Change external port
```

### Clean restart

```bash
# Stop and remove all containers, volumes
npm run docker:clean

# Rebuild from scratch
npm run docker:rebuild
```

## Production Deployment

### Security Checklist

- [ ] Change all default passwords and secrets
- [ ] Set strong `JWT_SECRET`
- [ ] Enable SSL/TLS (configure nginx for HTTPS)
- [ ] Configure firewall rules
- [ ] Enable database backups
- [ ] Set up monitoring and alerting
- [ ] Review and adjust rate limits
- [ ] Scan for vulnerabilities
- [ ] Enable audit logging

### Performance

- Use production-grade PostgreSQL configuration
- Configure Redis persistence
- Set up CDN for static assets
- Enable nginx caching
- Configure database connection pooling
- Monitor resource usage

## License

ISC

## Support

For issues and questions, please open an issue on the repository.

