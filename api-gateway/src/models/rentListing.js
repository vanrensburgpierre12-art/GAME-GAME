const pool = require('../config/database');

/**
 * Create or update a rent listing
 * If active listing exists, update it; otherwise create new
 * @param {string} parcelId - Parcel ID
 * @param {string} ownerId - Owner ID (UUID)
 * @param {number} pricePerHourCents - Price per hour in cents
 * @param {number} minSeconds - Minimum rental duration in seconds
 * @param {number} maxSeconds - Maximum rental duration in seconds
 * @param {boolean} active - Whether listing is active
 * @param {object} client - Database client (for transaction, optional)
 * @returns {Promise<object>} Created or updated listing
 */
async function createOrUpdateListing(parcelId, ownerId, pricePerHourCents, minSeconds, maxSeconds, active, client = null) {
  const db = client || pool;
  
  // First, deactivate any existing active listing for this parcel
  if (active) {
    await db.query(
      'UPDATE rent_listings SET active = false WHERE parcel_id = $1 AND active = true',
      [parcelId]
    );
  }
  
  // Insert new listing
  const query = `
    INSERT INTO rent_listings (parcel_id, owner_id, price_per_hour_cents, min_seconds, max_seconds, active)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING listing_id, parcel_id, owner_id, price_per_hour_cents, min_seconds, max_seconds, active, created_at, updated_at
  `;
  
  const result = await db.query(query, [parcelId, ownerId, pricePerHourCents, minSeconds, maxSeconds, active]);
  return result.rows[0];
}

/**
 * Get active listing for a parcel
 * @param {string} parcelId - Parcel ID
 * @param {object} client - Database client (optional)
 * @returns {Promise<object|null>} Active listing or null
 */
async function getListingByParcel(parcelId, client = null) {
  const db = client || pool;
  
  const query = `
    SELECT listing_id, parcel_id, owner_id, price_per_hour_cents, min_seconds, max_seconds, active, created_at, updated_at
    FROM rent_listings
    WHERE parcel_id = $1 AND active = true
    LIMIT 1
  `;
  
  const result = await db.query(query, [parcelId]);
  return result.rows[0] || null;
}

/**
 * Get listing with row lock (SELECT ... FOR UPDATE)
 * Used in transactions to prevent race conditions
 * @param {string} parcelId - Parcel ID
 * @param {object} client - Database client (must be in transaction)
 * @returns {Promise<object|null>} Listing with lock or null
 */
async function getListingForUpdate(parcelId, client) {
  if (!client) {
    throw new Error('Database client required for transaction');
  }
  
  const query = `
    SELECT listing_id, parcel_id, owner_id, price_per_hour_cents, min_seconds, max_seconds, active
    FROM rent_listings
    WHERE parcel_id = $1 AND active = true
    FOR UPDATE
    LIMIT 1
  `;
  
  const result = await client.query(query, [parcelId]);
  return result.rows[0] || null;
}

module.exports = {
  createOrUpdateListing,
  getListingByParcel,
  getListingForUpdate,
};

