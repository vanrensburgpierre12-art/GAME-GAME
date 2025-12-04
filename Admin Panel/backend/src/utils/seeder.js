const pool = require('../config/database');

/**
 * H3 seeder - Creates parcels using H3 hexagonal grid system
 * This is a stub implementation that creates sample parcels
 * In production, would use actual H3 library to generate hexagons
 * 
 * @param {object} options - Seeder options
 * @param {number} options.resolution - H3 resolution (0-15, default: 9)
 * @param {object} options.bbox - Bounding box { minLon, minLat, maxLon, maxLat }
 * @returns {Promise<object>} Seed results
 */
async function seedParcels(options = {}) {
  const {
    resolution = 9,
    bbox = {
      minLon: -122.5,
      minLat: 37.7,
      maxLon: -122.3,
      maxLat: 37.8,
    },
  } = options;
  
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Stub implementation: Create a simple grid of parcels
    // In production, would use H3 library to generate proper hexagons
    const parcels = [];
    const gridSize = 10; // 10x10 grid for demo
    const lonStep = (bbox.maxLon - bbox.minLon) / gridSize;
    const latStep = (bbox.maxLat - bbox.minLat) / gridSize;
    
    for (let i = 0; i < gridSize; i++) {
      for (let j = 0; j < gridSize; j++) {
        const centerLon = bbox.minLon + (i + 0.5) * lonStep;
        const centerLat = bbox.minLat + (j + 0.5) * latStep;
        
        // Create a simple square polygon (in production, would be hexagon)
        const size = Math.min(lonStep, latStep) * 0.4;
        const polygon = {
          type: 'Polygon',
          coordinates: [[
            [centerLon - size, centerLat - size],
            [centerLon + size, centerLat - size],
            [centerLon + size, centerLat + size],
            [centerLon - size, centerLat + size],
            [centerLon - size, centerLat - size],
          ]],
        };
        
        const parcelId = `parcel_${i}_${j}`;
        
        // Check if parcel already exists
        const existing = await client.query(
          'SELECT parcel_id FROM parcels WHERE parcel_id = $1',
          [parcelId]
        );
        
        if (existing.rows.length === 0) {
          // Insert parcel
          await client.query(
            `INSERT INTO parcels (parcel_id, geom, owner_id, price_cents, available_for_rent)
             VALUES ($1, ST_GeomFromGeoJSON($2), NULL, NULL, false)`,
            [parcelId, JSON.stringify(polygon)]
          );
          
          parcels.push(parcelId);
        }
      }
    }
    
    await client.query('COMMIT');
    
    return {
      success: true,
      parcelsCreated: parcels.length,
      parcelIds: parcels,
      resolution,
      bbox,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Seeder error:', error);
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  seedParcels,
};

