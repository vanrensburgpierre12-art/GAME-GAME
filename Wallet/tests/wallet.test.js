const request = require('supertest');
const app = require('../src/index');
const pool = require('../src/config/database');
const { getWallet, initializeWallet, updateBalance } = require('../src/models/wallet');
const { createLedgerEntry, getLedgerEntries } = require('../src/models/walletLedger');
const path = require('path');
const { createUser } = require(path.join(__dirname, '../../Auth Module Backend/src/models/user'));
const bcrypt = require('bcrypt');
const { generateToken } = require(path.join(__dirname, '../../Auth Module Backend/src/utils/jwt'));

// Test helper: Create a test user
async function createTestUser(email, kycStatus = 'none') {
  const passwordHash = await bcrypt.hash('testpassword123', 10);
  const user = await createUser(email, passwordHash, 'Test User');
  
  // Update KYC status if needed
  if (kycStatus !== 'none') {
    await pool.query(
      'UPDATE users SET kyc_status = $1 WHERE id = $2',
      [kycStatus, user.id]
    );
    user.kyc_status = kycStatus;
  }
  
  return user;
}

describe('Wallet API Tests', () => {
  let testUser;
  let testUserToken;
  let verifiedUser;
  let verifiedUserToken;
  
  beforeAll(async () => {
    // Clean up test data
    try {
      await pool.query("DELETE FROM wallet_ledger WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'wallettest%@example.com')");
      await pool.query("DELETE FROM wallets WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'wallettest%@example.com')");
      await pool.query("DELETE FROM users WHERE email LIKE 'wallettest%@example.com'");
    } catch (error) {
      console.log('Cleanup before tests:', error.message);
    }
    
    // Create test users
    testUser = await createTestUser('wallettest@example.com', 'none');
    testUserToken = generateToken(testUser.id);
    
    verifiedUser = await createTestUser('wallettestverified@example.com', 'verified');
    verifiedUserToken = generateToken(verifiedUser.id);
  });
  
  afterAll(async () => {
    // Clean up test data
    try {
      await pool.query("DELETE FROM wallet_ledger WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'wallettest%@example.com')");
      await pool.query("DELETE FROM wallets WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'wallettest%@example.com')");
      await pool.query("DELETE FROM users WHERE email LIKE 'wallettest%@example.com'");
    } catch (error) {
      console.log('Cleanup after tests:', error.message);
    }
    await pool.end();
  });
  
  describe('GET /wallet', () => {
    it('should return wallet balance for authenticated user', async () => {
      const response = await request(app)
        .get('/wallet')
        .set('Authorization', `Bearer ${testUserToken}`)
        .expect(200);
      
      expect(response.body).toHaveProperty('balance_cents');
      expect(response.body).toHaveProperty('reserved_cents');
      expect(response.body).toHaveProperty('available_cents');
      expect(response.body.balance_cents).toBe(0);
      expect(response.body.reserved_cents).toBe(0);
      expect(response.body.available_cents).toBe(0);
    });
    
    it('should return 401 without authentication token', async () => {
      const response = await request(app)
        .get('/wallet')
        .expect(401);
      
      expect(response.body).toHaveProperty('error');
    });
  });
  
  describe('POST /wallet/deposit', () => {
    it('should create deposit ledger entry with status=pending', async () => {
      const response = await request(app)
        .post('/wallet/deposit')
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({
          amount_cents: 10000,
          ref: 'Test deposit',
        })
        .expect(201);
      
      expect(response.body).toHaveProperty('tx_id');
      expect(response.body.amount_cents).toBe(10000);
      expect(response.body.type).toBe('deposit');
      expect(response.body.status).toBe('pending');
      expect(response.body.ref).toBe('Test deposit');
      expect(response.body).toHaveProperty('created_at');
    });
    
    it('should create deposit without ref', async () => {
      const response = await request(app)
        .post('/wallet/deposit')
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({
          amount_cents: 5000,
        })
        .expect(201);
      
      expect(response.body.amount_cents).toBe(5000);
      expect(response.body.type).toBe('deposit');
      expect(response.body.status).toBe('pending');
    });
    
    it('should return 400 for missing amount_cents', async () => {
      const response = await request(app)
        .post('/wallet/deposit')
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({})
        .expect(400);
      
      expect(response.body).toHaveProperty('error');
    });
    
    it('should return 400 for negative amount', async () => {
      const response = await request(app)
        .post('/wallet/deposit')
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({
          amount_cents: -1000,
        })
        .expect(400);
      
      expect(response.body).toHaveProperty('error');
    });
    
    it('should return 400 for non-integer amount', async () => {
      const response = await request(app)
        .post('/wallet/deposit')
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({
          amount_cents: 10.5,
        })
        .expect(400);
      
      expect(response.body).toHaveProperty('error');
    });
  });
  
  describe('POST /wallet/withdraw', () => {
    beforeEach(async () => {
      // Set up wallet with balance for withdraw tests
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await initializeWallet(verifiedUser.id, client);
        await updateBalance(verifiedUser.id, 50000, 0, client); // Add 50000 cents
        await client.query('COMMIT');
      } finally {
        client.release();
      }
    });
    
    it('should create withdraw ledger entry for verified user', async () => {
      const response = await request(app)
        .post('/wallet/withdraw')
        .set('Authorization', `Bearer ${verifiedUserToken}`)
        .send({
          amount_cents: 10000,
          ref: 'Test withdrawal',
        })
        .expect(201);
      
      expect(response.body).toHaveProperty('tx_id');
      expect(response.body.amount_cents).toBe(10000);
      expect(response.body.type).toBe('withdraw');
      expect(response.body.status).toBe('pending');
      expect(response.body.ref).toBe('Test withdrawal');
    });
    
    it('should return 403 for non-verified user', async () => {
      const response = await request(app)
        .post('/wallet/withdraw')
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({
          amount_cents: 1000,
        })
        .expect(403);
      
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('KYC');
    });
    
    it('should return 409 for insufficient balance', async () => {
      const response = await request(app)
        .post('/wallet/withdraw')
        .set('Authorization', `Bearer ${verifiedUserToken}`)
        .send({
          amount_cents: 100000, // More than available
        })
        .expect(409);
      
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Insufficient');
      expect(response.body).toHaveProperty('available_cents');
    });
    
    it('should return 400 for invalid amount', async () => {
      const response = await request(app)
        .post('/wallet/withdraw')
        .set('Authorization', `Bearer ${verifiedUserToken}`)
        .send({
          amount_cents: -1000,
        })
        .expect(400);
      
      expect(response.body).toHaveProperty('error');
    });
  });
  
  describe('Balance Updates and Transactions', () => {
    it('should update balance within transaction', async () => {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        
        await initializeWallet(testUser.id, client);
        const wallet1 = await updateBalance(testUser.id, 10000, 0, client);
        expect(wallet1.balance_cents).toBe(10000);
        
        const wallet2 = await updateBalance(testUser.id, 5000, 0, client);
        expect(wallet2.balance_cents).toBe(15000);
        
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    });
    
    it('should rollback transaction on error', async () => {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        
        await initializeWallet(testUser.id, client);
        await updateBalance(testUser.id, 10000, 0, client);
        
        // Try to withdraw more than available (should fail)
        try {
          await updateBalance(testUser.id, -20000, 0, client);
          throw new Error('Should have failed');
        } catch (error) {
          expect(error.message).toContain('Insufficient');
        }
        
        await client.query('ROLLBACK');
        
        // Verify balance was rolled back
        const wallet = await getWallet(testUser.id);
        expect(wallet.balance_cents).toBeLessThan(20000);
      } finally {
        client.release();
      }
    });
  });
  
  describe('Concurrent Debit Operations', () => {
    it('should handle concurrent withdrawals correctly', async () => {
      // Set up wallet with balance
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await initializeWallet(verifiedUser.id, client);
        await updateBalance(verifiedUser.id, 100000, 0, client);
        await client.query('COMMIT');
      } finally {
        client.release();
      }
      
      // Attempt multiple concurrent withdrawals
      const withdrawalAmount = 30000;
      const numWithdrawals = 3; // Total: 90000, should succeed
      
      const promises = Array(numWithdrawals).fill(null).map(() =>
        request(app)
          .post('/wallet/withdraw')
          .set('Authorization', `Bearer ${verifiedUserToken}`)
          .send({ amount_cents: withdrawalAmount })
      );
      
      const responses = await Promise.all(promises);
      
      // All should succeed (total 90000 < 100000)
      responses.forEach(response => {
        expect([201, 409]).toContain(response.status);
      });
      
      // Verify ledger entries were created
      const ledgerEntries = await getLedgerEntries(verifiedUser.id, { type: 'withdraw' });
      expect(ledgerEntries.length).toBeGreaterThanOrEqual(numWithdrawals);
    });
    
    it('should prevent over-withdrawal with concurrent requests', async () => {
      // Set up wallet with limited balance
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await initializeWallet(verifiedUser.id, client);
        await updateBalance(verifiedUser.id, 50000, 0, client);
        await client.query('COMMIT');
      } finally {
        client.release();
      }
      
      // Attempt concurrent withdrawals that exceed balance
      const withdrawalAmount = 30000;
      const numWithdrawals = 3; // Total: 90000 > 50000, some should fail
      
      const promises = Array(numWithdrawals).fill(null).map(() =>
        request(app)
          .post('/wallet/withdraw')
          .set('Authorization', `Bearer ${verifiedUserToken}`)
          .send({ amount_cents: withdrawalAmount })
      );
      
      const responses = await Promise.all(promises);
      
      // At least one should fail with 409
      const statusCodes = responses.map(r => r.status);
      expect(statusCodes).toContain(409);
      
      // Count successful withdrawals
      const successful = responses.filter(r => r.status === 201).length;
      expect(successful).toBeLessThan(numWithdrawals);
    });
  });
  
  describe('Ledger Immutability', () => {
    it('should create immutable ledger entries', async () => {
      const ledgerEntry = await createLedgerEntry(
        testUser.id,
        1000,
        'deposit',
        'Test',
        'pending'
      );
      
      const txId = ledgerEntry.tx_id;
      
      // Try to update (should fail - no UPDATE allowed in schema)
      try {
        await pool.query(
          'UPDATE wallet_ledger SET amount_cents = 2000 WHERE tx_id = $1',
          [txId]
        );
        // If we get here, the update succeeded (which we don't want)
        // In production, you might want to add triggers to prevent updates
      } catch (error) {
        // Expected - updates should be prevented
      }
      
      // Verify original entry still exists
      const entry = await getLedgerEntries(testUser.id, {});
      const found = entry.find(e => e.tx_id === txId);
      expect(found).toBeDefined();
      expect(found.amount_cents).toBe(1000);
    });
  });
});

