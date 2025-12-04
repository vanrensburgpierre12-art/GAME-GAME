-- Create enum type for kyc_status
CREATE TYPE kyc_status_enum AS ENUM ('none', 'submitted', 'verified');

-- Create users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    kyc_status kyc_status_enum DEFAULT 'none' NOT NULL
);

-- Create index on email for faster lookups
CREATE INDEX idx_users_email ON users(email);

