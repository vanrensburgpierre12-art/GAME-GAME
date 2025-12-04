const request = require('supertest');
const app = require('../src/index');
const pool = require('../src/config/database');
const { getParcelForUpdate, updateParcelOwner } = require('../src/models/parcel');
const { createTransaction } = require('../src/models/marketplaceTransaction');
const { calculateFee, calculateSellerReceives } = require('../src/config/marketplace');

// Import wallet and auth modules
const path = require('path');
const walletModule = require(path.join(__dirname, '../../Wallet/src/models/wallet'));
const { createUser } = require(path.join(__dirname, '../../Auth Module Backend/src/models/user'));
const { generateToken } = require(path.join(__dirname, '../../Auth Module Backend/src/utils/jwt'));
const bcrypt = require('bcrypt');

// Import parcel creation helper
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

describe('Marketplace API Tests', () => {
  let buyer;
  let buyerToken;
  let seller;
  let sellerToken;
  let testParcelId;
  
  beforeAll(async () => {
    // Clean up test data
    try {
      await pool.query("DELETE FROM marketplace_transactions WHERE parcel_id LIKE 'test_%'");
      await pool.query("DELETE FROM parcels WHERE parcel_id LIKE 'test_%'");
      await pool.query("DELETE FROM wallets WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'markettest%@example.com')");
      await pool.query("DELETE FROM users WHERE email LIKE 'markettest%@example.com'");
    } catch (error) {
      console.log('Cleanup before tests:', error.message);
    }
    
    // Create test users
    buyer = await createTestUser('markettestbuyer@example.com', 'verified');
    buyerToken = generateToken(buyer.id);
    
    seller = await createTestUser('markettestseller@example.com', 'verified');
    sellerToken = generateToken(seller.id);
    
    // Create test parcel owned by seller
    testParcelId = 'test_parcel_market_1';
    await parcelModule.createParcel({
      parcel_id: testParcelId,
      geom: 'POLYGON((-122.4194 37.7749, -122.4190 37.7749, -122.4190 37.7753, -122.4194 37.7753, -122.4194 37.7749))',
      owner_id: seller.id,
      price_cents: 100000,
      available_for_rent: false,
      metadata: { test: true },
    });
    
    // Set up wallets with balances
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await walletModule.initializeWallet(buyer.id, client);
      await walletModule.updateBalance(buyer.id, 200000, 0, client); // Buyer has 200000 cents
      await walletModule.initializeWallet(seller.id, client);
      await walletModule.updateBalance(seller.id, 50000, 0, client); // Seller has 50000 cents
      await client.query('COMMIT');
    } finally {
      client.release();
    }
  });
  
  afterAll(async () => {
    // Clean up test data
    try {
      await pool.query("DELETE FROM marketplace_transactions WHERE parcel_id LIKE 'test_%'");
      await pool.query("DELETE FROM parcels WHERE parcel_id LIKE 'test_%'");
      await pool.query("DELETE FROM wallets WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'markettest%@example.com')");
      await pool.query("DELETE FROM users WHERE email LIKE 'markettest%@example.com'");
    } catch (error) {
      console.log('Cleanup after tests:', error.message);
    }
    await pool.end();
  });
  
  describe('POST /market/buy/:parcel_id', () => {
    it('should successfully buy a parcel with fee calculation', async () => {
      const response = await request(app)
        .post(`/market/buy/${testParcelId}`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .expect(200);
      
      expect(response.body).toHaveProperty('tx_id');
      expect(response.body.parcel_id).toBe(testParcelId);
      expect(response.body.price_cents).toBe(100000);
      expect(response.body).toHaveProperty('fee_cents');
      expect(response.body).toHaveProperty('seller_receives_cents');
      expect(response.body.status).toBe('completed');
      
      // Verify fee calculation (5% = 5000 cents)
      expect(response.body.fee_cents).toBe(5000);
      expect(response.body.seller_receives_cents).toBe(95000);
      
      // Verify parcel owner changed
      const parcel = await pool.query(
        'SELECT owner_id, price_cents FROM parcels WHERE parcel_id = $1',
        [testParcelId]
      );
      expect(parcel.rows[0].owner_id).toBe(buyer.id);
      
      // Verify buyer's wallet was debited
      const buyerWallet = await walletModule.getWallet(buyer.id);
      expect(buyerWallet.balance_cents).toBe(100000); // 200000 - 100000
      
      // Verify seller's wallet was credited (minus fee)
      const sellerWallet = await walletModule.getWallet(seller.id);
      expect(sellerWallet.balance_cents).toBe(145000); // 50000 + 95000
    });
    
    it('should return 409 for insufficient funds', async () => {
      // Create a new parcel and user with low balance
      const poorBuyer = await createTestUser('markettestpoor@example.com', 'verified');
      const poorBuyerToken = generateToken(poorBuyer.id);
      
      const poorParcelId = 'test_parcel_poor_1';
      await parcelModule.createParcel({
        parcel_id: poorParcelId,
        geom: 'POLYGON((-122.4194 37.7749, -122.4190 37.7749, -122.4190 37.7753, -122.4194 37.7753, -122.4194 37.7749))',
        owner_id: seller.id,
        price_cents: 200000,
        available_for_rent: false,
        metadata: {},
      });
      
      // Give poor buyer only 50000 cents
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await walletModule.initializeWallet(poorBuyer.id, client);
        await walletModule.updateBalance(poorBuyer.id, 50000, 0, client);
        await client.query('COMMIT');
      } finally {
        client.release();
      }
      
      const response = await request(app)
        .post(`/market/buy/${poorParcelId}`)
        .set('Authorization', `Bearer ${poorBuyerToken}`)
        .expect(409);
      
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Insufficient');
      expect(response.body).toHaveProperty('required_cents');
      expect(response.body).toHaveProperty('available_cents');
    });
    
    it('should return 400 if user tries to buy their own parcel', async () => {
      // Create a parcel owned by buyer
      const ownParcelId = 'test_parcel_own_1';
      await parcelModule.createParcel({
        parcel_id: ownParcelId,
        geom: 'POLYGON((-122.4194 37.7749, -122.4190 37.7749, -122.4190 37.7753, -122.4194 37.7753, -122.4194 37.7749))',
        owner_id: buyer.id,
        price_cents: 50000,
        available_for_rent: false,
        metadata: {},
      });
      
      const response = await request(app)
        .post(`/market/buy/${ownParcelId}`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .expect(400);
      
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('already own');
    });
    
    it('should return 404 for non-existent parcel', async () => {
      const response = await request(app)
        .post('/market/buy/nonexistent_parcel')
        .set('Authorization', `Bearer ${buyerToken}`)
        .expect(404);
      
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('not found');
    });
    
    it('should return 400 for parcel without price', async () => {
      const noPriceParcelId = 'test_parcel_no_price_1';
      await parcelModule.createParcel({
        parcel_id: noPriceParcelId,
        geom: 'POLYGON((-122.4194 37.7749, -122.4190 37.7749, -122.4190 37.7753, -122.4194 37.7753, -122.4194 37.7749))',
        owner_id: seller.id,
        price_cents: null,
        available_for_rent: false,
        metadata: {},
      });
      
      const response = await request(app)
        .post(`/market/buy/${noPriceParcelId}`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .expect(400);
      
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('not for sale');
    });
  });
  
  describe('POST /market/list/:parcel_id', () => {
    it('should successfully list a parcel for sale', async () => {
      const listParcelId = 'test_parcel_list_1';
      await parcelModule.createParcel({
        parcel_id: listParcelId,
        geom: 'POLYGON((-122.4194 37.7749, -122.4190 37.7749, -122.4190 37.7753, -122.4194 37.7753, -122.4194 37.7749))',
        owner_id: seller.id,
        price_cents: null,
        available_for_rent: false,
        metadata: {},
      });
      
      const response = await request(app)
        .post(`/market/list/${listParcelId}`)
        .set('Authorization', `Bearer ${sellerToken}`)
        .send({ price_cents: 150000 })
        .expect(200);
      
      expect(response.body).toHaveProperty('tx_id');
      expect(response.body.parcel_id).toBe(listParcelId);
      expect(response.body.price_cents).toBe(150000);
      expect(response.body.status).toBe('completed');
      
      // Verify parcel price was updated
      const parcel = await pool.query(
        'SELECT price_cents FROM parcels WHERE parcel_id = $1',
        [listParcelId]
      );
      expect(parcel.rows[0].price_cents).toBe(150000);
    });
    
    it('should return 403 if user does not own the parcel', async () => {
      const otherParcelId = 'test_parcel_other_1';
      await parcelModule.createParcel({
        parcel_id: otherParcelId,
        geom: 'POLYGON((-122.4194 37.7749, -122.4190 37.7749, -122.4190 37.7753, -122.4194 37.7753, -122.4194 37.7749))',
        owner_id: seller.id,
        price_cents: null,
        available_for_rent: false,
        metadata: {},
      });
      
      const response = await request(app)
        .post(`/market/list/${otherParcelId}`)
        .set('Authorization', `Bearer ${buyerToken}`) // Buyer trying to list seller's parcel
        .send({ price_cents: 100000 })
        .expect(403);
      
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('do not own');
    });
    
    it('should return 400 for invalid price_cents', async () => {
      const listParcelId = 'test_parcel_list_2';
      await parcelModule.createParcel({
        parcel_id: listParcelId,
        geom: 'POLYGON((-122.4194 37.7749, -122.4190 37.7749, -122.4190 37.7753, -122.4194 37.7753, -122.4194 37.7749))',
        owner_id: seller.id,
        price_cents: null,
        available_for_rent: false,
        metadata: {},
      });
      
      // Test missing price_cents
      const response1 = await request(app)
        .post(`/market/list/${listParcelId}`)
        .set('Authorization', `Bearer ${sellerToken}`)
        .send({})
        .expect(400);
      
      expect(response1.body).toHaveProperty('error');
      
      // Test negative price
      const response2 = await request(app)
        .post(`/market/list/${listParcelId}`)
        .set('Authorization', `Bearer ${sellerToken}`)
        .send({ price_cents: -1000 })
        .expect(400);
      
      expect(response2.body).toHaveProperty('error');
    });
  });
  
  describe('Double-buy race condition', () => {
    it('should prevent double-buy using SELECT FOR UPDATE', async () => {
      // Create a parcel for concurrent buy test
      const raceParcelId = 'test_parcel_race_1';
      await parcelModule.createParcel({
        parcel_id: raceParcelId,
        geom: 'POLYGON((-122.4194 37.7749, -122.4190 37.7749, -122.4190 37.7753, -122.4194 37.7753, -122.4194 37.7749))',
        owner_id: seller.id,
        price_cents: 50000,
        available_for_rent: false,
        metadata: {},
      });
      
      // Create two buyers with sufficient balance
      const buyer1 = await createTestUser('markettestrace1@example.com', 'verified');
      const buyer1Token = generateToken(buyer1.id);
      const buyer2 = await createTestUser('markettestrace2@example.com', 'verified');
      const buyer2Token = generateToken(buyer2.id);
      
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await walletModule.initializeWallet(buyer1.id, client);
        await walletModule.updateBalance(buyer1.id, 100000, 0, client);
        await walletModule.initializeWallet(buyer2.id, client);
        await walletModule.updateBalance(buyer2.id, 100000, 0, client);
        await client.query('COMMIT');
      } finally {
        client.release();
      }
      
      // Attempt concurrent buys
      const [response1, response2] = await Promise.all([
        request(app)
          .post(`/market/buy/${raceParcelId}`)
          .set('Authorization', `Bearer ${buyer1Token}`),
        request(app)
          .post(`/market/buy/${raceParcelId}`)
          .set('Authorization', `Bearer ${buyer2Token}`),
      ]);
      
      // One should succeed, one should fail
      const successCount = [response1, response2].filter(r => r.status === 200).length;
      const failCount = [response1, response2].filter(r => r.status !== 200).length;
      
      expect(successCount).toBe(1);
      expect(failCount).toBe(1);
      
      // Verify parcel has only one owner
      const parcel = await pool.query(
        'SELECT owner_id FROM parcels WHERE parcel_id = $1',
        [raceParcelId]
      );
      const ownerId = parcel.rows[0].owner_id;
      expect([buyer1.id, buyer2.id]).toContain(ownerId);
    });
  });
  
  describe('Fee calculation', () => {
    it('should calculate fee correctly', () => {
      const price = 100000;
      const fee = calculateFee(price);
      const sellerReceives = calculateSellerReceives(price);
      
      expect(fee).toBe(5000); // 5% of 100000
      expect(sellerReceives).toBe(95000); // 100000 - 5000
    });
    
    it('should handle different fee percentages', () => {
      // Test with 10% fee
      process.env.MARKETPLACE_FEE_PERCENT = '10';
      delete require.cache[require.resolve('../src/config/marketplace')];
      const marketplaceConfig = require('../src/config/marketplace');
      
      const price = 100000;
      const fee = marketplaceConfig.calculateFee(price);
      const sellerReceives = marketplaceConfig.calculateSellerReceives(price);
      
      expect(fee).toBe(10000); // 10% of 100000
      expect(sellerReceives).toBe(90000); // 100000 - 10000
      
      // Reset to default
      process.env.MARKETPLACE_FEE_PERCENT = '5';
    });
  });
});

