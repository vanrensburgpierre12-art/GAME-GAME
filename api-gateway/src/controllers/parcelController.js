const { getParcelsByBbox, getParcelById } = require('../models/parcel');
const { parseBbox, validateBbox, createFeature, createFeatureCollection } = require('../utils/geojson');

/**
 * Get parcels within a bounding box
 * GET /parcels?bbox=minLon,minLat,maxLon,maxLat
 */
async function getParcels(req, res) {
  try {
    const { bbox } = req.query;
    
    // Validate bbox parameter
    if (!bbox) {
      return res.status(400).json({ 
        error: 'bbox parameter is required',
        format: 'bbox=minLon,minLat,maxLon,maxLat'
      });
    }
    
    // Parse bbox string
    const bboxObj = parseBbox(bbox);
    if (!bboxObj) {
      return res.status(400).json({ 
        error: 'Invalid bbox format',
        format: 'bbox=minLon,minLat,maxLon,maxLat',
        example: 'bbox=-122.5,37.7,-122.3,37.8'
      });
    }
    
    // Validate bbox coordinates
    const validation = validateBbox(bboxObj);
    if (!validation.valid) {
      return res.status(400).json({ 
        error: validation.error,
        bbox: bboxObj
      });
    }
    
    // Query parcels
    const parcels = await getParcelsByBbox(
      bboxObj.minLon,
      bboxObj.minLat,
      bboxObj.maxLon,
      bboxObj.maxLat
    );
    
    // Convert to GeoJSON FeatureCollection
    const features = parcels.map(parcel => createFeature(parcel));
    const featureCollection = createFeatureCollection(features);
    
    res.json(featureCollection);
  } catch (error) {
    console.error('Get parcels error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Get a single parcel by ID
 * GET /parcels/:id
 */
async function getParcelByIdHandler(req, res) {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({ error: 'Parcel ID is required' });
    }
    
    const parcel = await getParcelById(id);
    
    if (!parcel) {
      return res.status(404).json({ error: 'Parcel not found' });
    }
    
    // Convert to GeoJSON Feature
    const feature = createFeature(parcel);
    
    res.json(feature);
  } catch (error) {
    console.error('Get parcel by ID error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = {
  getParcels,
  getParcelById: getParcelByIdHandler,
};

