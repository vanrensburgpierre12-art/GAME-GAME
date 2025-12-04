-- Create rent_listings table
CREATE TABLE IF NOT EXISTS rent_listings (
    listing_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parcel_id TEXT NOT NULL,
    owner_id UUID NOT NULL,
    price_per_hour_cents BIGINT NOT NULL,
    min_seconds INTEGER NOT NULL,
    max_seconds INTEGER NOT NULL,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT fk_parcel FOREIGN KEY (parcel_id) REFERENCES parcels(parcel_id) ON DELETE CASCADE,
    CONSTRAINT fk_owner FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT positive_price CHECK (price_per_hour_cents > 0),
    CONSTRAINT valid_duration CHECK (min_seconds > 0 AND max_seconds >= min_seconds)
);

-- Create unique index to ensure only one active listing per parcel
CREATE UNIQUE INDEX IF NOT EXISTS idx_rent_listings_one_active 
ON rent_listings(parcel_id) WHERE active = true;

-- Create rental_agreements table
CREATE TABLE IF NOT EXISTS rental_agreements (
    rental_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parcel_id TEXT NOT NULL,
    owner_id UUID NOT NULL,
    renter_id UUID NOT NULL,
    start_ts TIMESTAMP NOT NULL,
    end_ts TIMESTAMP NOT NULL,
    total_cents BIGINT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('active', 'completed', 'cancelled')),
    created_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT fk_agreement_parcel FOREIGN KEY (parcel_id) REFERENCES parcels(parcel_id) ON DELETE CASCADE,
    CONSTRAINT fk_agreement_owner FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_agreement_renter FOREIGN KEY (renter_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT valid_timespan CHECK (end_ts > start_ts),
    CONSTRAINT positive_total CHECK (total_cents > 0)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_rent_listings_parcel_id ON rent_listings(parcel_id);
CREATE INDEX IF NOT EXISTS idx_rent_listings_owner_id ON rent_listings(owner_id);
CREATE INDEX IF NOT EXISTS idx_rent_listings_active ON rent_listings(active) WHERE active = true;

CREATE INDEX IF NOT EXISTS idx_rental_agreements_parcel_id ON rental_agreements(parcel_id);
CREATE INDEX IF NOT EXISTS idx_rental_agreements_owner_id ON rental_agreements(owner_id);
CREATE INDEX IF NOT EXISTS idx_rental_agreements_renter_id ON rental_agreements(renter_id);
CREATE INDEX IF NOT EXISTS idx_rental_agreements_status ON rental_agreements(status);
CREATE INDEX IF NOT EXISTS idx_rental_agreements_start_ts ON rental_agreements(start_ts);
CREATE INDEX IF NOT EXISTS idx_rental_agreements_end_ts ON rental_agreements(end_ts);

