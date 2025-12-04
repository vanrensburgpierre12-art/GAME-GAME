FROM postgres:15-alpine

# Install bash (alpine uses ash by default)
RUN apk add --no-cache bash

WORKDIR /migrations

# Copy migration script (from build context root)
COPY ["migrations/run-migrations.sh", "/migrations/run-migrations.sh"]
RUN chmod +x /migrations/run-migrations.sh

# Copy migration files from all modules (using JSON array syntax for paths with spaces)
COPY ["Auth Module Backend/src/migrations/", "/migrations/auth/"]
COPY ["Parcels API/src/migrations/", "/migrations/parcels/"]
COPY ["Wallet/src/migrations/", "/migrations/wallet/"]
COPY ["Marketplace (Buy Sell)/src/migrations/", "/migrations/marketplace/"]
COPY ["Rentals/src/migrations/", "/migrations/rentals/"]
COPY ["KYC/src/migrations/", "/migrations/kyc/"]

# Run migrations
ENTRYPOINT ["/migrations/run-migrations.sh"]

