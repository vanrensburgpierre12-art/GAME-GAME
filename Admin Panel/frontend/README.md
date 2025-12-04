# Admin Panel Frontend

React frontend for the admin panel with pages for managing parcels, KYC verification, transaction logs, and users.

## Features

- Dashboard with system statistics
- Parcel overview and management
- KYC review and verification
- Transaction logs (marketplace + wallet)
- User management
- Role-based authentication (admin only)

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create `.env` file:
```
VITE_API_URL=http://localhost:3007
VITE_AUTH_URL=http://localhost:3000
```

3. Start development server:
```bash
npm run dev
```

4. Build for production:
```bash
npm run build
```

## Pages

### Dashboard
- System statistics overview
- Quick metrics (users, parcels, transactions, KYC pending)

### Parcel Overview
- List all parcels with filtering
- Seed parcels (H3 seeder trigger)
- View parcel details

### KYC Review
- List pending KYC submissions
- View submission details
- Verify or reject submissions

### Transaction Logs
- Combined view of marketplace and wallet transactions
- Filter by type, status, date range
- View transaction details

### Users
- List all users with statistics
- Filter by KYC status
- View user details (balance, parcels owned, transactions)

## Authentication

- Login page requires admin credentials
- Token stored in localStorage
- Protected routes redirect to login if not authenticated
- Token automatically added to API requests

## Environment Variables

- `VITE_API_URL` - Admin backend API URL (default: http://localhost:3007)
- `VITE_AUTH_URL` - Auth module URL for login (default: http://localhost:3000)

## Port Configuration

Default port: `3008`

Override in `vite.config.js`:
```javascript
server: {
  port: 3009,
}
```

