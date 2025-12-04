#!/bin/bash
set -e

echo "========================================="
echo "Running Database Migrations"
echo "========================================="

# Wait for PostgreSQL to be ready
echo "Waiting for PostgreSQL to be ready..."
until PGPASSWORD=$DB_PASSWORD psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -c '\q' 2>/dev/null; do
  >&2 echo "PostgreSQL is unavailable - sleeping"
  sleep 2
done

echo "PostgreSQL is ready!"
echo ""

# Enable PostGIS extension
echo "Enabling PostGIS extension..."
PGPASSWORD=$DB_PASSWORD psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -c "CREATE EXTENSION IF NOT EXISTS postgis;"
echo "PostGIS enabled!"
echo ""

# Function to run migration files from a directory
run_migrations() {
  local module_name=$1
  local migration_dir=$2
  
  echo "========================================="
  echo "Running migrations for: $module_name"
  echo "========================================="
  
  if [ ! -d "$migration_dir" ]; then
    echo "⚠ No migrations directory found for $module_name at $migration_dir"
    echo ""
    return
  fi
  
  # Run each .sql file in order
  for file in $(ls -1 $migration_dir/*.sql 2>/dev/null | sort); do
    if [ -f "$file" ]; then
      echo "Running: $(basename $file)"
      PGPASSWORD=$DB_PASSWORD psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -f "$file"
      echo "✓ Completed: $(basename $file)"
      echo ""
    fi
  done
  
  echo "✓ $module_name migrations completed"
  echo ""
}

# Run migrations for each module in dependency order
run_migrations "Auth Module" "/migrations/auth"
run_migrations "Wallet Module" "/migrations/wallet"
run_migrations "Parcels Module" "/migrations/parcels"
run_migrations "Marketplace Module" "/migrations/marketplace"
run_migrations "Rentals Module" "/migrations/rentals"
run_migrations "KYC Module" "/migrations/kyc"

echo "========================================="
echo "All Migrations Completed Successfully!"
echo "========================================="

