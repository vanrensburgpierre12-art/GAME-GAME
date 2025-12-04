const pool = require('../config/database');

/**
 * Create a marketplace transaction record
 * @param {object} transactionData - Transaction data
 * @param {object} client - Database client (for transaction, optional)
 * @returns {Promise<object>} Created transaction
 */
async function createTransaction(transactionData, client = null) {
  const db = client || pool;
  
  const {
    parcel_id,
    buyer_id,
    seller_id,
    price_cents,
    fee_cents,
    seller_receives_cents,
    type,
    status,
  } = transactionData;
  
  const query = `
    INSERT INTO marketplace_transactions (
      parcel_id, buyer_id, seller_id, price_cents, 
      fee_cents, seller_receives_cents, type, status
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING tx_id, parcel_id, buyer_id, seller_id, price_cents, 
              fee_cents, seller_receives_cents, type, status, created_at
  `;
  
  const result = await db.query(query, [
    parcel_id,
    buyer_id,
    seller_id || null,
    price_cents,
    fee_cents,
    seller_receives_cents,
    type,
    status,
  ]);
  
  return result.rows[0];
}

/**
 * Get transaction by ID
 * @param {string} txId - Transaction ID (UUID)
 * @returns {Promise<object|null>} Transaction or null
 */
async function getTransactionById(txId) {
  const query = `
    SELECT tx_id, parcel_id, buyer_id, seller_id, price_cents, 
           fee_cents, seller_receives_cents, type, status, created_at
    FROM marketplace_transactions
    WHERE tx_id = $1
  `;
  
  const result = await pool.query(query, [txId]);
  return result.rows[0] || null;
}

/**
 * Get transactions for a parcel
 * @param {string} parcelId - Parcel ID
 * @param {number} limit - Limit results
 * @returns {Promise<Array>} Array of transactions
 */
async function getTransactionsByParcel(parcelId, limit = 10) {
  const query = `
    SELECT tx_id, parcel_id, buyer_id, seller_id, price_cents, 
           fee_cents, seller_receives_cents, type, status, created_at
    FROM marketplace_transactions
    WHERE parcel_id = $1
    ORDER BY created_at DESC
    LIMIT $2
  `;
  
  const result = await pool.query(query, [parcelId, limit]);
  return result.rows;
}

module.exports = {
  createTransaction,
  getTransactionById,
  getTransactionsByParcel,
};

