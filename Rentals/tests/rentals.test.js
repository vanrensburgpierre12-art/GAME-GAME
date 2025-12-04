const request = require('supertest');
const app = require('../src/index');
const pool = require('../src/config/database');
const { createOrUpdateListing, getListingByParcel } = require('../src/models/rentListing');
const { createAgreement, getActiveRentalsByUser } = require('../src/models/rentalAgreement');
const { calculateTotalCost, calculateFee, calculateOwnerReceives } = require('../src/config/rentals');

// Import modules
const path = require('path');
const walletModule = require(path.join(__dirname, '../../Wallet/src/models/wallet'));
const { createUser } = require(path.join(__dirname, '../../Auth Module Backend/src/models/user'));
const { generateToken } = require(path.join(__dirname, '../../Auth Module Backend/src/utils/jwt'));
const bcrypt = require('bcrypt');
const parcelModule = require(path.join(__dirname, '../../Parcels API/src/models/parcel'));

// Test helper: Create a test user
async function createTestUser(email, kycStatus = 'none') {
  const passwordHash = await bcrypt.hash('testpassword123', 10);
  const user = await createUser(email, passwordHash, 'Test User');
  
  if (kycStatus !== 'none') {
    await pool.query(
      'UPDATE users SET kyc_status = $1 WHERE id = $2',
      [kycStatus, user.id]
    );
    user.kyc_status = kycStatus;
  }
  
  return user;
}

describe('Rentals API Tests', () => {
  let owner;
  let ownerToken;
  let renter;
  let renterToken;
  let testParcelId;
  
  beforeAll(async () => {
    // Clean up test data
    try {
      await pool.query("DELETE FROM rental_agreements WHERE parcel_id LIKE 'test_%'");
      await pool.query("DELETE FROM rent_listings WHERE parcel_id LIKE 'test_%'");
      await pool.query("DELETE FROM parcels WHERE parcel_id LIKE 'test_%'");
      await pool.query("DELETE FROM wallets WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'rentaltest%@example.com')");
      await pool.query("DELETE FROM users WHERE email LIKE 'rentaltest%@example.com'");
    } catch (error) {
      console.log('Cleanup before tests:', error.message);
    }
    
    // Create test users
    owner = await createTestUser('rentaltestowner@example.com', 'verified');
    ownerToken = generateToken(owner.id);
    
    renter = await createTestUser('rentaltestrenter@example.com', 'verified');
    renterToken = generateToken(renter.id);
    
    // Create test parcel owned by owner
    testParcelId = 'test_parcel_rental_1';
    await parcelModule.createParcel({
      parcel_id: testParcelId,
      geom: 'POLYGON((-122.4194 37.7749, -122.4190 37.7749, -122.4190 37.7753, -122.4194 37.7753, -122.4194 37.7749))',
      owner_id: owner.id,
      price_cents: null,
      available_for_rent: true,
      metadata: { test: true },
    });
    
    // Set up wallets with balances
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await walletModule.initializeWallet(owner.id, client);
      await walletModule.updateBalance(owner.id, 50000, 0, client);
      await walletModule.initializeWallet(renter.id, client);
      await walletModule.updateBalance(renter.id, 200000, 0, client); // Renter has 200000 cents
      await client.query('COMMIT');
    } finally {
      client.release();
    }
  });
  
  afterAll(async () => {
    // Clean up test data
    try {
      await pool.query("DELETE FROM rental_agreements WHERE parcel_id LIKE 'test_%'");
      await pool.query("DELETE FROM rent_listings WHERE parcel_id LIKE 'test_%'");
      await pool.query("DELETE FROM parcels WHERE parcel_id LIKE 'test_%'");
      await pool.query("DELETE FROM wallets WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'rentaltest%@example.com')");
      await pool.query("DELETE FROM users WHERE email LIKE 'rentaltest%@example.com'");
    } catch (error) {
      console.log('Cleanup after tests:', error.message);
    }
    await pool.end();
  });
  
  describe('POST /rent/list/:parcel_id', () => {
    it('should successfully list a parcel for rent', async () => {
      const response = await request(app)
        .post(`/rent/list/${testParcelId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          price_per_hour_cents: 10000,
          min_seconds: 3600, // 1 hour
          max_seconds: 86400, // 24 hours
        })
        .expect(200);
      
      expect(response.body).toHaveProperty('listing_id');
      expect(response.body.parcel_id).toBe(testParcelId);
      expect(response.body.price_per_hour_cents).toBe(10000);
      expect(response.body.min_seconds).toBe(3600);
      expect(response.body.max_seconds).toBe(86400);
      expect(response.body.active).toBe(true);
    });
    
    it('should return 403 if user does not own the parcel', async () => {
      const otherParcelId = 'test_parcel_other_1';
      await parcelModule.createParcel({
        parcel_id: otherParcelId,
        geom: 'POLYGON((-122.4194 37.7749, -122.4190 37.7749, -122.4190 37.7753, -122.4194 37.7753, -122.4194 37.7749))',
        owner_id: owner.id,
        price_cents: null,
        available_for_rent: true,
        metadata: {},
      });
      
      const response = await request(app)
        .post(`/rent/list/${otherParcelId}`)
        .set('Authorization', `Bearer ${renterToken}`) // Renter trying to list owner's parcel
        .send({
          price_per_hour_cents: 10000,
          min_seconds: 3600,
          max_seconds: 86400,
        })
        .expect(403);
      
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('do not own');
    });
    
    it('should return 400 for invalid price_per_hour_cents', async () => {
      const response = await request(app)
        .post(`/rent/list/${testParcelId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          price_per_hour_cents: -1000,
          min_seconds: 3600,
          max_seconds: 86400,
        })
        .expect(400);
      
      expect(response.body).toHaveProperty('error');
    });
    
    it('should return 400 if max_seconds < min_seconds', async () => {
      const response = await request(app)
        .post(`/rent/list/${testParcelId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          price_per_hour_cents: 10000,
          min_seconds: 86400,
          max_seconds: 3600, // max < min
        })
        .expect(400);
      
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('max_seconds');
    });
  });
  
  describe('POST /rent/start/:parcel_id', () => {
    beforeEach(async () => {
      // Ensure listing exists
      await createOrUpdateListing(
        testParcelId,
        owner.id,
        10000, // 10000 cents per hour
        3600, // min 1 hour
        86400, // max 24 hours
        true
      );
    });
    
    it('should successfully start a rental with fee calculation', async () => {
      const durationSeconds = 7200; // 2 hours
      const response = await request(app)
        .post(`/rent/start/${testParcelId}`)
        .set('Authorization', `Bearer ${renterToken}`)
        .send({ duration_seconds: durationSeconds })
        .expect(201);
      
      expect(response.body).toHaveProperty('rental_id');
      expect(response.body.parcel_id).toBe(testParcelId);
      expect(response.body.renter_id).toBe(renter.id);
      expect(response.body.owner_id).toBe(owner.id);
      expect(response.body).toHaveProperty('start_ts');
      expect(response.body).toHaveProperty('end_ts');
      expect(response.body).toHaveProperty('total_cents');
      expect(response.body).toHaveProperty('fee_cents');
      expect(response.body).toHaveProperty('owner_receives_cents');
      expect(response.body.status).toBe('active');
      
      // Verify cost calculation: 10000 cents/hour * 2 hours = 20000 cents
      expect(response.body.total_cents).toBe(20000);
      
      // Verify fee: 5% of 20000 = 1000 cents
      expect(response.body.fee_cents).toBe(1000);
      expect(response.body.owner_receives_cents).toBe(19000);
      
      // Verify renter's wallet was debited
      const renterWallet = await walletModule.getWallet(renter.id);
      expect(renterWallet.balance_cents).toBe(180000); // 200000 - 20000
      
      // Verify owner's wallet was credited (minus fee)
      const ownerWallet = await walletModule.getWallet(owner.id);
      expect(ownerWallet.balance_cents).toBe(69000); // 50000 + 19000
    });
    
    it('should return 400 if duration is less than min_seconds', async () => {
      const response = await request(app)
        .post(`/rent/start/${testParcelId}`)
        .set('Authorization', `Bearer ${renterToken}`)
        .send({ duration_seconds: 1800 }) // 30 minutes < 1 hour min
        .expect(400);
      
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Duration');
      expect(response.body).toHaveProperty('min_seconds');
    });
    
    it('should return 400 if duration is greater than max_seconds', async () => {
      const response = await request(app)
        .post(`/rent/start/${testParcelId}`)
        .set('Authorization', `Bearer ${renterToken}`)
        .send({ duration_seconds: 100000 }) // > 24 hours max
        .expect(400);
      
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Duration');
      expect(response.body).toHaveProperty('max_seconds');
    });
    
    it('should return 400 if parcel is not listed for rent', async () => {
      const unlistedParcelId = 'test_parcel_unlisted_1';
      await parcelModule.createParcel({
        parcel_id: unlistedParcelId,
        geom: 'POLYGON((-122.4194 37.7749, -122.4190 37.7749, -122.4190 37.7753, -122.4194 37.7753, -122.4194 37.7749))',
        owner_id: owner.id,
        price_cents: null,
        available_for_rent: false,
        metadata: {},
      });
      
      const response = await request(app)
        .post(`/rent/start/${unlistedParcelId}`)
        .set('Authorization', `Bearer ${renterToken}`)
        .send({ duration_seconds: 7200 })
        .expect(400);
      
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('not listed for rent');
    });
    
    it('should return 409 for insufficient balance', async () => {
      // Create a poor renter
      const poorRenter = await createTestUser('rentaltestpoor@example.com', 'verified');
      const poorRenterToken = generateToken(poorRenter.id);
      
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await walletModule.initializeWallet(poorRenter.id, client);
        await walletModule.updateBalance(poorRenter.id, 1000, 0, client); // Only 1000 cents
        await client.query('COMMIT');
      } finally {
        client.release();
      }
      
      const response = await request(app)
        .post(`/rent/start/${testParcelId}`)
        .set('Authorization', `Bearer ${poorRenterToken}`)
        .send({ duration_seconds: 7200 }) // Costs 20000 cents
        .expect(409);
      
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Insufficient');
      expect(response.body).toHaveProperty('required_cents');
      expect(response.body).toHaveProperty('available_cents');
    });
  });
  
  describe('GET /rent/my', () => {
    it('should return active rentals for current user', async () => {
      // Create a rental first
      const listing = await createOrUpdateListing(
        testParcelId,
        owner.id,
        10000,
        3600,
        86400,
        true
      );
      
      const startTs = new Date();
      const endTs = new Date(startTs.getTime() + 7200 * 1000);
      await createAgreement({
        parcel_id: testParcelId,
        owner_id: owner.id,
        renter_id: renter.id,
        start_ts: startTs,
        end_ts: endTs,
        total_cents: 20000,
        status: 'active',
      });
      
      // Get rentals as renter
      const renterResponse = await request(app)
        .get('/rent/my')
        .set('Authorization', `Bearer ${renterToken}`)
        .expect(200);
      
      expect(renterResponse.body).toHaveProperty('rentals');
      expect(Array.isArray(renterResponse.body.rentals)).toBe(true);
      expect(renterResponse.body.rentals.length).toBeGreaterThan(0);
      
      const rental = renterResponse.body.rentals[0];
      expect(rental).toHaveProperty('rental_id');
      expect(rental.parcel_id).toBe(testParcelId);
      expect(rental.renter_id).toBe(renter.id);
      expect(rental.status).toBe('active');
      
      // Get rentals as owner
      const ownerResponse = await request(app)
        .get('/rent/my')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);
      
      expect(ownerResponse.body).toHaveProperty('rentals');
      expect(ownerResponse.body.rentals.length).toBeGreaterThan(0);
    });
    
    it('should return empty array if user has no active rentals', async () => {
      const newUser = await createTestUser('rentaltestnew@example.com', 'verified');
      const newUserToken = generateToken(newUser.id);
      
      const response = await request(app)
        .get('/rent/my')
        .set('Authorization', `Bearer ${newUserToken}`)
        .expect(200);
      
      expect(response.body).toHaveProperty('rentals');
      expect(response.body.rentals).toEqual([]);
    });
  });
  
  describe('Basic rent flow', () => {
    it('should complete full rent flow: list -> start -> check', async () => {
      const flowParcelId = 'test_parcel_flow_1';
      await parcelModule.createParcel({
        parcel_id: flowParcelId,
        geom: 'POLYGON((-122.4194 37.7749, -122.4190 37.7749, -122.4190 37.7753, -122.4194 37.7753, -122.4194 37.7749))',
        owner_id: owner.id,
        price_cents: null,
        available_for_rent: true,
        metadata: {},
      });
      
      // Step 1: List parcel
      const listResponse = await request(app)
        .post(`/rent/list/${flowParcelId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          price_per_hour_cents: 5000,
          min_seconds: 1800, // 30 minutes
          max_seconds: 36000, // 10 hours
        })
        .expect(200);
      
      expect(listResponse.body.active).toBe(true);
      
      // Step 2: Start rental
      const startResponse = await request(app)
        .post(`/rent/start/${flowParcelId}`)
        .set('Authorization', `Bearer ${renterToken}`)
        .send({ duration_seconds: 5400 }) // 1.5 hours
        .expect(201);
      
      expect(startResponse.body.status).toBe('active');
      expect(startResponse.body.total_cents).toBe(7500); // 5000 * 1.5 = 7500
      
      // Step 3: Check rentals
      const myRentalsResponse = await request(app)
        .get('/rent/my')
        .set('Authorization', `Bearer ${renterToken}`)
        .expect(200);
      
      const rental = myRentalsResponse.body.rentals.find(r => r.parcel_id === flowParcelId);
      expect(rental).toBeDefined();
      expect(rental.status).toBe('active');
    });
  });
  
  describe('Cost calculation', () => {
    it('should calculate total cost correctly', () => {
      const pricePerHour = 10000; // 10000 cents per hour
      const durationSeconds = 7200; // 2 hours
      const total = calculateTotalCost(pricePerHour, durationSeconds);
      expect(total).toBe(20000); // 10000 * 2 = 20000
    });
    
    it('should calculate fee correctly', () => {
      const total = 20000;
      const fee = calculateFee(total);
      const ownerReceives = calculateOwnerReceives(total);
      
      expect(fee).toBe(1000); // 5% of 20000
      expect(ownerReceives).toBe(19000); // 20000 - 1000
    });
  });
});

