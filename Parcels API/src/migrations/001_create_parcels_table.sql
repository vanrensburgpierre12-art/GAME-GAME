-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- Create parcels table
CREATE TABLE IF NOT EXISTS parcels (
    parcel_id TEXT PRIMARY KEY,
    geom GEOMETRY(POLYGON, 4326) NOT NULL,
    owner_id UUID NULL,
    price_cents BIGINT NULL,
    available_for_rent BOOLEAN NOT NULL DEFAULT false,
    metadata JSONB DEFAULT '{}'::jsonb,
    CONSTRAINT fk_owner FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Create spatial index on geometry column for efficient spatial queries
CREATE INDEX IF NOT EXISTS idx_parcels_geom ON parcels USING GIST (geom);

-- Create index on owner_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_parcels_owner_id ON parcels(owner_id);

-- Create index on available_for_rent for filtering
CREATE INDEX IF NOT EXISTS idx_parcels_available_for_rent ON parcels(available_for_rent);

