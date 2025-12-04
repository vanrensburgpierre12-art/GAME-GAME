const pool = require('../config/database');

/**
 * Initialize wallet for a user if it doesn't exist
 * @param {string} userId - User ID (UUID)
 * @param {object} client - Database client (for transaction)
 * @returns {Promise<object>} Wallet object
 */
async function initializeWallet(userId, client = null) {
  const db = client || pool;
  
  // Try to get existing wallet
  const existing = await getWallet(userId);
  if (existing) {
    return existing;
  }
  
  // Create new wallet
  const query = `
    INSERT INTO wallets (user_id, balance_cents, reserved_cents)
    VALUES ($1, 0, 0)
    ON CONFLICT (user_id) DO NOTHING
    RETURNING user_id, balance_cents, reserved_cents
  `;
  
  const result = await db.query(query, [userId]);
  
  // If insert was skipped due to conflict, fetch the existing wallet
  if (result.rows.length === 0) {
    return await getWallet(userId);
  }
  
  return result.rows[0];
}

/**
 * Get wallet balance and reserved amount for a user
 * @param {string} userId - User ID (UUID)
 * @returns {Promise<object|null>} Wallet object or null
 */
async function getWallet(userId) {
  const query = `
    SELECT user_id, balance_cents, reserved_cents
    FROM wallets
    WHERE user_id = $1
  `;
  
  const result = await pool.query(query, [userId]);
  return result.rows[0] || null;
}

/**
 * Update wallet balance within a transaction
 * @param {string} userId - User ID (UUID)
 * @param {number} amountCents - Amount to add/subtract (can be negative)
 * @param {number} reservedCents - Reserved amount to add/subtract (can be negative)
 * @param {object} client - Database client (must be in transaction)
 * @returns {Promise<object>} Updated wallet object
 * @throws {Error} If balance would go negative or transaction fails
 */
async function updateBalance(userId, amountCents, reservedCents, client) {
  if (!client) {
    throw new Error('Database client required for transaction');
  }
  
  // Ensure wallet exists
  await initializeWallet(userId, client);
  
  // Update balance with check constraint
  const query = `
    UPDATE wallets
    SET 
      balance_cents = balance_cents + $2,
      reserved_cents = reserved_cents + $3
    WHERE user_id = $1
    RETURNING user_id, balance_cents, reserved_cents
  `;
  
  const result = await client.query(query, [userId, amountCents, reservedCents]);
  
  if (result.rows.length === 0) {
    throw new Error('Wallet not found after initialization');
  }
  
  const wallet = result.rows[0];
  
  // Check for negative balance (database constraint should catch this, but double-check)
  if (wallet.balance_cents < 0) {
    throw new Error('Insufficient balance');
  }
  
  if (wallet.reserved_cents < 0) {
    throw new Error('Invalid reserved amount');
  }
  
  return wallet;
}

module.exports = {
  getWallet,
  initializeWallet,
  updateBalance,
};

