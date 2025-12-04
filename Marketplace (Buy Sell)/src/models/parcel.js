const pool = require('../config/database');

/**
 * Get parcel by ID with row-level lock (SELECT ... FOR UPDATE)
 * Used in transactions to prevent race conditions
 * @param {string} parcelId - Parcel ID
 * @param {object} client - Database client (must be in transaction)
 * @returns {Promise<object|null>} Parcel with lock or null
 */
async function getParcelForUpdate(parcelId, client) {
  if (!client) {
    throw new Error('Database client required for transaction');
  }
  
  const query = `
    SELECT parcel_id, owner_id, price_cents, available_for_rent
    FROM parcels
    WHERE parcel_id = $1
    FOR UPDATE
  `;
  
  const result = await client.query(query, [parcelId]);
  return result.rows[0] || null;
}

/**
 * Update parcel owner and price
 * @param {string} parcelId - Parcel ID
 * @param {string} ownerId - New owner ID (UUID)
 * @param {number} priceCents - New price in cents (optional)
 * @param {object} client - Database client (must be in transaction)
 * @returns {Promise<object>} Updated parcel
 */
async function updateParcelOwner(parcelId, ownerId, priceCents = null, client) {
  if (!client) {
    throw new Error('Database client required for transaction');
  }
  
  let query;
  let params;
  
  if (priceCents !== null) {
    query = `
      UPDATE parcels
      SET owner_id = $1, price_cents = $2
      WHERE parcel_id = $3
      RETURNING parcel_id, owner_id, price_cents
    `;
    params = [ownerId, priceCents, parcelId];
  } else {
    query = `
      UPDATE parcels
      SET owner_id = $1
      WHERE parcel_id = $2
      RETURNING parcel_id, owner_id, price_cents
    `;
    params = [ownerId, parcelId];
  }
  
  const result = await client.query(query, params);
  return result.rows[0];
}

/**
 * Update parcel price (for listing)
 * @param {string} parcelId - Parcel ID
 * @param {number} priceCents - New price in cents
 * @param {object} client - Database client (must be in transaction)
 * @returns {Promise<object>} Updated parcel
 */
async function updateParcelPrice(parcelId, priceCents, client) {
  if (!client) {
    throw new Error('Database client required for transaction');
  }
  
  const query = `
    UPDATE parcels
    SET price_cents = $1
    WHERE parcel_id = $2
    RETURNING parcel_id, owner_id, price_cents
  `;
  
  const result = await client.query(query, [priceCents, parcelId]);
  return result.rows[0];
}

module.exports = {
  getParcelForUpdate,
  updateParcelOwner,
  updateParcelPrice,
};

