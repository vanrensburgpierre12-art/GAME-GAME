const pool = require('../config/database');

/**
 * Create a rental agreement
 * @param {object} agreementData - Agreement data
 * @param {object} client - Database client (for transaction, optional)
 * @returns {Promise<object>} Created agreement
 */
async function createAgreement(agreementData, client = null) {
  const db = client || pool;
  
  const {
    parcel_id,
    owner_id,
    renter_id,
    start_ts,
    end_ts,
    total_cents,
    status,
  } = agreementData;
  
  const query = `
    INSERT INTO rental_agreements (parcel_id, owner_id, renter_id, start_ts, end_ts, total_cents, status)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING rental_id, parcel_id, owner_id, renter_id, start_ts, end_ts, total_cents, status, created_at
  `;
  
  const result = await db.query(query, [
    parcel_id,
    owner_id,
    renter_id,
    start_ts,
    end_ts,
    total_cents,
    status,
  ]);
  
  return result.rows[0];
}

/**
 * Get active rentals for a renter
 * @param {string} renterId - Renter ID (UUID)
 * @returns {Promise<Array>} Array of active rental agreements
 */
async function getActiveRentalsByRenter(renterId) {
  const query = `
    SELECT rental_id, parcel_id, owner_id, renter_id, start_ts, end_ts, total_cents, status, created_at
    FROM rental_agreements
    WHERE renter_id = $1 AND status = 'active'
    ORDER BY start_ts DESC
  `;
  
  const result = await pool.query(query, [renterId]);
  return result.rows;
}

/**
 * Get active rentals for an owner
 * @param {string} ownerId - Owner ID (UUID)
 * @returns {Promise<Array>} Array of active rental agreements
 */
async function getActiveRentalsByOwner(ownerId) {
  const query = `
    SELECT rental_id, parcel_id, owner_id, renter_id, start_ts, end_ts, total_cents, status, created_at
    FROM rental_agreements
    WHERE owner_id = $1 AND status = 'active'
    ORDER BY start_ts DESC
  `;
  
  const result = await pool.query(query, [ownerId]);
  return result.rows;
}

/**
 * Get all active rentals for a user (as renter or owner)
 * @param {string} userId - User ID (UUID)
 * @returns {Promise<Array>} Array of active rental agreements
 */
async function getActiveRentalsByUser(userId) {
  const query = `
    SELECT rental_id, parcel_id, owner_id, renter_id, start_ts, end_ts, total_cents, status, created_at
    FROM rental_agreements
    WHERE (renter_id = $1 OR owner_id = $1) AND status = 'active'
    ORDER BY start_ts DESC
  `;
  
  const result = await pool.query(query, [userId]);
  return result.rows;
}

module.exports = {
  createAgreement,
  getActiveRentalsByRenter,
  getActiveRentalsByOwner,
  getActiveRentalsByUser,
};

