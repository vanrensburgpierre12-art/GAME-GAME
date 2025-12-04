-- Create wallets table
CREATE TABLE IF NOT EXISTS wallets (
    user_id UUID PRIMARY KEY,
    balance_cents BIGINT NOT NULL DEFAULT 0,
    reserved_cents BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT non_negative_balance CHECK (balance_cents >= 0),
    CONSTRAINT non_negative_reserved CHECK (reserved_cents >= 0)
);

-- Create wallet_ledger table
CREATE TABLE IF NOT EXISTS wallet_ledger (
    tx_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    amount_cents BIGINT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('deposit', 'withdraw')),
    ref TEXT,
    status TEXT NOT NULL CHECK (status IN ('pending', 'completed', 'failed')),
    created_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT fk_ledger_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_wallet_ledger_user_id ON wallet_ledger(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_ledger_created_at ON wallet_ledger(created_at);
CREATE INDEX IF NOT EXISTS idx_wallet_ledger_status ON wallet_ledger(status);

