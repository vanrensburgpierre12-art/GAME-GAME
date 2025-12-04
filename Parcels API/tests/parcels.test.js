const request = require('supertest');
const app = require('../src/index');
const pool = require('../src/config/database');
const { getParcelsByBbox, getParcelById, createParcel } = require('../src/models/parcel');
const { parseBbox, validateBbox, createFeature, createFeatureCollection } = require('../src/utils/geojson');

// Test helper: Create test parcels
async function createTestParcel(parcelId, wktPolygon, priceCents = null, availableForRent = false) {
  return await createParcel({
    parcel_id: parcelId,
    geom: wktPolygon,
    owner_id: null,
    price_cents: priceCents,
    available_for_rent: availableForRent,
    metadata: { test: true },
  });
}

describe('Parcels API Tests', () => {
  const testParcels = [];
  
  beforeAll(async () => {
    // Clean up test data
    try {
      await pool.query("DELETE FROM parcels WHERE parcel_id LIKE 'test_%'");
    } catch (error) {
      console.log('Cleanup before tests:', error.message);
    }
    
    // Create test parcels
    // Parcel 1: Small polygon in San Francisco area
    const parcel1 = await createTestParcel(
      'test_parcel_1',
      'POLYGON((-122.4194 37.7749, -122.4190 37.7749, -122.4190 37.7753, -122.4194 37.7753, -122.4194 37.7749))',
      100000,
      true
    );
    testParcels.push(parcel1);
    
    // Parcel 2: Another polygon nearby
    const parcel2 = await createTestParcel(
      'test_parcel_2',
      'POLYGON((-122.4100 37.7800, -122.4095 37.7800, -122.4095 37.7805, -122.4100 37.7805, -122.4100 37.7800))',
      200000,
      false
    );
    testParcels.push(parcel2);
    
    // Parcel 3: Outside the test bbox
    const parcel3 = await createTestParcel(
      'test_parcel_3',
      'POLYGON((-122.5000 37.7000, -122.4995 37.7000, -122.4995 37.7005, -122.5000 37.7005, -122.5000 37.7000))',
      150000,
      true
    );
    testParcels.push(parcel3);
  });
  
  afterAll(async () => {
    // Clean up test data
    try {
      await pool.query("DELETE FROM parcels WHERE parcel_id LIKE 'test_%'");
    } catch (error) {
      console.log('Cleanup after tests:', error.message);
    }
    await pool.end();
  });
  
  describe('GET /parcels', () => {
    it('should return GeoJSON FeatureCollection with valid bbox', async () => {
      const response = await request(app)
        .get('/parcels')
        .query({ bbox: '-122.42,37.77,-122.40,37.78' })
        .expect(200);
      
      expect(response.body).toHaveProperty('type', 'FeatureCollection');
      expect(response.body).toHaveProperty('features');
      expect(Array.isArray(response.body.features)).toBe(true);
      
      // Should find at least parcel 1
      expect(response.body.features.length).toBeGreaterThan(0);
      
      // Check feature structure
      if (response.body.features.length > 0) {
        const feature = response.body.features[0];
        expect(feature).toHaveProperty('type', 'Feature');
        expect(feature).toHaveProperty('id');
        expect(feature).toHaveProperty('geometry');
        expect(feature).toHaveProperty('properties');
        expect(feature.geometry).toHaveProperty('type');
        expect(feature.geometry).toHaveProperty('coordinates');
        expect(feature.properties).toHaveProperty('price_cents');
        expect(feature.properties).toHaveProperty('available_for_rent');
        expect(feature.properties).toHaveProperty('metadata');
      }
    });
    
    it('should return empty FeatureCollection when no parcels in bbox', async () => {
      const response = await request(app)
        .get('/parcels')
        .query({ bbox: '0,0,1,1' }) // Different area with no test parcels
        .expect(200);
      
      expect(response.body).toHaveProperty('type', 'FeatureCollection');
      expect(response.body.features).toEqual([]);
    });
    
    it('should return 400 for missing bbox parameter', async () => {
      const response = await request(app)
        .get('/parcels')
        .expect(400);
      
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('bbox');
    });
    
    it('should return 400 for invalid bbox format', async () => {
      const response = await request(app)
        .get('/parcels')
        .query({ bbox: 'invalid' })
        .expect(400);
      
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('format');
    });
    
    it('should return 400 for bbox with wrong number of coordinates', async () => {
      const response = await request(app)
        .get('/parcels')
        .query({ bbox: '-122.42,37.77,-122.40' }) // Only 3 coordinates
        .expect(400);
      
      expect(response.body).toHaveProperty('error');
    });
    
    it('should return 400 for bbox with min >= max longitude', async () => {
      const response = await request(app)
        .get('/parcels')
        .query({ bbox: '-122.40,37.77,-122.42,37.78' }) // minLon > maxLon
        .expect(400);
      
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('minLon');
    });
    
    it('should return 400 for bbox with min >= max latitude', async () => {
      const response = await request(app)
        .get('/parcels')
        .query({ bbox: '-122.42,37.78,-122.40,37.77' }) // minLat > maxLat
        .expect(400);
      
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('minLat');
    });
    
    it('should return 400 for bbox with out-of-range longitude', async () => {
      const response = await request(app)
        .get('/parcels')
        .query({ bbox: '-200,37.77,-122.40,37.78' }) // Longitude < -180
        .expect(400);
      
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Longitude');
    });
    
    it('should return 400 for bbox with out-of-range latitude', async () => {
      const response = await request(app)
        .get('/parcels')
        .query({ bbox: '-122.42,100,-122.40,37.78' }) // Latitude > 90
        .expect(400);
      
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Latitude');
    });
    
    it('should filter parcels correctly by bbox', async () => {
      // Bbox that includes parcel 1 but not parcel 3
      const response = await request(app)
        .get('/parcels')
        .query({ bbox: '-122.42,37.77,-122.40,37.78' })
        .expect(200);
      
      const parcelIds = response.body.features.map(f => f.id);
      expect(parcelIds).toContain('test_parcel_1');
      expect(parcelIds).not.toContain('test_parcel_3');
    });
  });
  
  describe('GET /parcels/:id', () => {
    it('should return GeoJSON Feature for valid parcel ID', async () => {
      const response = await request(app)
        .get('/parcels/test_parcel_1')
        .expect(200);
      
      expect(response.body).toHaveProperty('type', 'Feature');
      expect(response.body).toHaveProperty('id', 'test_parcel_1');
      expect(response.body).toHaveProperty('geometry');
      expect(response.body).toHaveProperty('properties');
      expect(response.body.geometry).toHaveProperty('type', 'Polygon');
      expect(response.body.geometry).toHaveProperty('coordinates');
      expect(response.body.properties.price_cents).toBe(100000);
      expect(response.body.properties.available_for_rent).toBe(true);
    });
    
    it('should return 404 for non-existent parcel ID', async () => {
      const response = await request(app)
        .get('/parcels/nonexistent_parcel')
        .expect(404);
      
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('not found');
    });
    
    it('should not include owner_id in response', async () => {
      const response = await request(app)
        .get('/parcels/test_parcel_1')
        .expect(200);
      
      // owner_id should not be in properties
      expect(response.body.properties).not.toHaveProperty('owner_id');
      expect(response.body).not.toHaveProperty('owner_id');
    });
  });
  
  describe('GeoJSON Utilities', () => {
    it('should parse valid bbox string', () => {
      const bbox = parseBbox('-122.5,37.7,-122.3,37.8');
      expect(bbox).toEqual({
        minLon: -122.5,
        minLat: 37.7,
        maxLon: -122.3,
        maxLat: 37.8,
      });
    });
    
    it('should return null for invalid bbox format', () => {
      expect(parseBbox('invalid')).toBeNull();
      expect(parseBbox('-122.5,37.7')).toBeNull();
      expect(parseBbox(null)).toBeNull();
    });
    
    it('should validate correct bbox', () => {
      const bbox = { minLon: -122.5, minLat: 37.7, maxLon: -122.3, maxLat: 37.8 };
      const validation = validateBbox(bbox);
      expect(validation.valid).toBe(true);
      expect(validation.error).toBeNull();
    });
    
    it('should reject bbox with min >= max', () => {
      const bbox1 = { minLon: -122.3, minLat: 37.7, maxLon: -122.5, maxLat: 37.8 };
      const validation1 = validateBbox(bbox1);
      expect(validation1.valid).toBe(false);
      
      const bbox2 = { minLon: -122.5, minLat: 37.8, maxLon: -122.3, maxLat: 37.7 };
      const validation2 = validateBbox(bbox2);
      expect(validation2.valid).toBe(false);
    });
    
    it('should create valid GeoJSON Feature', () => {
      const parcel = {
        parcel_id: 'test',
        geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]] },
        price_cents: 100000,
        available_for_rent: true,
        metadata: { test: true },
      };
      
      const feature = createFeature(parcel);
      expect(feature.type).toBe('Feature');
      expect(feature.id).toBe('test');
      expect(feature.geometry).toBeDefined();
      expect(feature.properties.price_cents).toBe(100000);
      expect(feature.properties).not.toHaveProperty('owner_id');
    });
    
    it('should create valid GeoJSON FeatureCollection', () => {
      const features = [
        { type: 'Feature', id: '1', geometry: {}, properties: {} },
        { type: 'Feature', id: '2', geometry: {}, properties: {} },
      ];
      
      const collection = createFeatureCollection(features);
      expect(collection.type).toBe('FeatureCollection');
      expect(collection.features).toEqual(features);
    });
  });
  
  describe('PostGIS Queries', () => {
    it('should query parcels by bbox using ST_Intersects', async () => {
      const parcels = await getParcelsByBbox(-122.42, 37.77, -122.40, 37.78);
      expect(Array.isArray(parcels)).toBe(true);
      
      if (parcels.length > 0) {
        const parcel = parcels[0];
        expect(parcel).toHaveProperty('parcel_id');
        expect(parcel).toHaveProperty('geometry');
        expect(parcel.geometry).toHaveProperty('type');
        expect(parcel.geometry).toHaveProperty('coordinates');
      }
    });
    
    it('should return parcel by ID', async () => {
      const parcel = await getParcelById('test_parcel_1');
      expect(parcel).toBeDefined();
      expect(parcel.parcel_id).toBe('test_parcel_1');
      expect(parcel.geometry).toBeDefined();
    });
    
    it('should return null for non-existent parcel', async () => {
      const parcel = await getParcelById('nonexistent');
      expect(parcel).toBeNull();
    });
  });
});

