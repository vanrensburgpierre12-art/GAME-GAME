const pool = require('../config/database');

/**
 * Get parcels within a bounding box using PostGIS ST_Intersects
 * @param {number} minLon - Minimum longitude
 * @param {number} minLat - Minimum latitude
 * @param {number} maxLon - Maximum longitude
 * @param {number} maxLat - Maximum latitude
 * @returns {Promise<Array>} Array of parcel objects with GeoJSON geometry
 */
async function getParcelsByBbox(minLon, minLat, maxLon, maxLat) {
  const query = `
    SELECT 
      parcel_id,
      ST_AsGeoJSON(geom)::json as geometry,
      price_cents,
      available_for_rent,
      metadata
    FROM parcels
    WHERE ST_Intersects(geom, ST_MakeEnvelope($1, $2, $3, $4, 4326))
    ORDER BY parcel_id
  `;
  
  const result = await pool.query(query, [minLon, minLat, maxLon, maxLat]);
  return result.rows;
}

/**
 * Get a single parcel by ID
 * @param {string} parcelId - Parcel ID
 * @returns {Promise<object|null>} Parcel object with GeoJSON geometry or null
 */
async function getParcelById(parcelId) {
  const query = `
    SELECT 
      parcel_id,
      ST_AsGeoJSON(geom)::json as geometry,
      price_cents,
      available_for_rent,
      metadata
    FROM parcels
    WHERE parcel_id = $1
  `;
  
  const result = await pool.query(query, [parcelId]);
  return result.rows[0] || null;
}

/**
 * Create a new parcel (helper function for testing)
 * @param {object} parcelData - Parcel data
 * @returns {Promise<object>} Created parcel
 */
async function createParcel(parcelData) {
  const { parcel_id, geom, owner_id, price_cents, available_for_rent, metadata } = parcelData;
  
  const query = `
    INSERT INTO parcels (parcel_id, geom, owner_id, price_cents, available_for_rent, metadata)
    VALUES ($1, ST_GeomFromText($2, 4326), $3, $4, $5, $6)
    RETURNING parcel_id
  `;
  
  // geom should be WKT (Well-Known Text) format for ST_GeomFromText
  const result = await pool.query(query, [
    parcel_id,
    geom, // WKT format: 'POLYGON((lon lat, lon lat, ...))'
    owner_id || null,
    price_cents || null,
    available_for_rent || false,
    metadata || {},
  ]);
  
  return result.rows[0];
}

module.exports = {
  getParcelsByBbox,
  getParcelById,
  createParcel,
};

