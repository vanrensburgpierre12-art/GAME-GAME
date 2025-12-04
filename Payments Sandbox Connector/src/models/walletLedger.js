const pool = require('../config/database');

/**
 * Create an immutable ledger entry
 * @param {string} userId - User ID (UUID)
 * @param {number} amountCents - Amount in cents (positive for deposit, negative for withdraw)
 * @param {string} type - Transaction type ('deposit' or 'withdraw')
 * @param {string} ref - Optional reference/description
 * @param {string} status - Transaction status ('pending', 'completed', 'failed')
 * @param {object} client - Database client (for transaction, optional)
 * @returns {Promise<object>} Created ledger entry
 */
async function createLedgerEntry(userId, amountCents, type, ref, status, client = null) {
  const db = client || pool;
  
  // Validate type
  if (type !== 'deposit' && type !== 'withdraw') {
    throw new Error('Invalid ledger type. Must be "deposit" or "withdraw"');
  }
  
  // Validate status
  if (!['pending', 'completed', 'failed'].includes(status)) {
    throw new Error('Invalid ledger status. Must be "pending", "completed", or "failed"');
  }
  
  // Validate amount
  if (typeof amountCents !== 'number' || amountCents <= 0) {
    throw new Error('Amount must be a positive number');
  }
  
  const query = `
    INSERT INTO wallet_ledger (user_id, amount_cents, type, ref, status)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING tx_id, user_id, amount_cents, type, ref, status, created_at
  `;
  
  const result = await db.query(query, [userId, amountCents, type, ref || null, status]);
  return result.rows[0];
}

/**
 * Get ledger entry by transaction ID
 * @param {string} txId - Transaction ID (UUID)
 * @returns {Promise<object|null>} Ledger entry or null
 */
async function getLedgerEntryById(txId) {
  const query = `
    SELECT tx_id, user_id, amount_cents, type, ref, status, created_at
    FROM wallet_ledger
    WHERE tx_id = $1
  `;
  
  const result = await pool.query(query, [txId]);
  return result.rows[0] || null;
}

/**
 * Update ledger entry status
 * @param {string} txId - Transaction ID (UUID)
 * @param {string} newStatus - New status ('pending', 'completed', 'failed')
 * @param {object} client - Database client (for transaction, required)
 * @returns {Promise<object>} Updated ledger entry
 */
async function updateLedgerStatus(txId, newStatus, client) {
  if (!client) {
    throw new Error('Database client required for transaction');
  }
  
  // Validate status
  if (!['pending', 'completed', 'failed'].includes(newStatus)) {
    throw new Error('Invalid ledger status. Must be "pending", "completed", or "failed"');
  }
  
  const query = `
    UPDATE wallet_ledger
    SET status = $1
    WHERE tx_id = $2
    RETURNING tx_id, user_id, amount_cents, type, ref, status, created_at
  `;
  
  const result = await client.query(query, [newStatus, txId]);
  
  if (result.rows.length === 0) {
    throw new Error('Ledger entry not found');
  }
  
  return result.rows[0];
}

module.exports = {
  createLedgerEntry,
  getLedgerEntryById,
  updateLedgerStatus,
};

