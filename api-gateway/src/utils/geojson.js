/**
 * Parse bbox query parameter string
 * Format: "minLon,minLat,maxLon,maxLat"
 * @param {string} bboxString - Bbox string from query parameter
 * @returns {object|null} Parsed bbox object or null if invalid
 */
function parseBbox(bboxString) {
  if (!bboxString || typeof bboxString !== 'string') {
    return null;
  }
  
  const parts = bboxString.split(',');
  if (parts.length !== 4) {
    return null;
  }
  
  const coords = parts.map(part => parseFloat(part.trim()));
  
  // Check if all values are valid numbers
  if (coords.some(isNaN)) {
    return null;
  }
  
  return {
    minLon: coords[0],
    minLat: coords[1],
    maxLon: coords[2],
    maxLat: coords[3],
  };
}

/**
 * Validate bbox coordinates
 * @param {object} bbox - Bbox object with minLon, minLat, maxLon, maxLat
 * @returns {object} { valid: boolean, error: string|null }
 */
function validateBbox(bbox) {
  if (!bbox) {
    return { valid: false, error: 'Bbox is required' };
  }
  
  const { minLon, minLat, maxLon, maxLat } = bbox;
  
  // Validate longitude range (-180 to 180)
  if (minLon < -180 || minLon > 180 || maxLon < -180 || maxLon > 180) {
    return { valid: false, error: 'Longitude must be between -180 and 180' };
  }
  
  // Validate latitude range (-90 to 90)
  if (minLat < -90 || minLat > 90 || maxLat < -90 || maxLat > 90) {
    return { valid: false, error: 'Latitude must be between -90 and 90' };
  }
  
  // Validate min < max
  if (minLon >= maxLon) {
    return { valid: false, error: 'minLon must be less than maxLon' };
  }
  
  if (minLat >= maxLat) {
    return { valid: false, error: 'minLat must be less than maxLat' };
  }
  
  return { valid: true, error: null };
}

/**
 * Create a GeoJSON Feature from parcel data
 * @param {object} parcel - Parcel row from database
 * @returns {object} GeoJSON Feature
 */
function createFeature(parcel) {
  return {
    type: 'Feature',
    id: parcel.parcel_id,
    geometry: parcel.geometry, // Already converted to GeoJSON by ST_AsGeoJSON
    properties: {
      owner_id: parcel.owner_id,
      price_cents: parcel.price_cents,
      available_for_rent: parcel.available_for_rent,
      metadata: parcel.metadata || {},
    },
  };
}

/**
 * Create a GeoJSON FeatureCollection from an array of features
 * @param {Array} features - Array of GeoJSON Features
 * @returns {object} GeoJSON FeatureCollection
 */
function createFeatureCollection(features) {
  return {
    type: 'FeatureCollection',
    features: features || [],
  };
}

module.exports = {
  parseBbox,
  validateBbox,
  createFeature,
  createFeatureCollection,
};

