-- Create marketplace_transactions table
CREATE TABLE IF NOT EXISTS marketplace_transactions (
    tx_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parcel_id TEXT NOT NULL,
    buyer_id UUID NOT NULL,
    seller_id UUID NULL,
    price_cents BIGINT NOT NULL,
    fee_cents BIGINT NOT NULL,
    seller_receives_cents BIGINT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('buy', 'list')),
    status TEXT NOT NULL CHECK (status IN ('pending', 'completed', 'failed')),
    created_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT fk_buyer FOREIGN KEY (buyer_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_seller FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_parcel FOREIGN KEY (parcel_id) REFERENCES parcels(parcel_id) ON DELETE CASCADE
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_marketplace_tx_parcel_id ON marketplace_transactions(parcel_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_tx_buyer_id ON marketplace_transactions(buyer_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_tx_seller_id ON marketplace_transactions(seller_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_tx_type ON marketplace_transactions(type);
CREATE INDEX IF NOT EXISTS idx_marketplace_tx_status ON marketplace_transactions(status);
CREATE INDEX IF NOT EXISTS idx_marketplace_tx_created_at ON marketplace_transactions(created_at);

