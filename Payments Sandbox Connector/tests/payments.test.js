const request = require('supertest');
const app = require('../src/index');
const pool = require('../src/config/database');
const path = require('path');
const { createUser } = require(path.join(__dirname, '../../Auth Module Backend/src/models/user'));
const { getWallet } = require(path.join(__dirname, '../../Wallet/src/models/wallet'));
const { getLedgerEntryById } = require(path.join(__dirname, '../../Wallet/src/models/walletLedger'));
const bcrypt = require('bcrypt');
const { generateToken } = require(path.join(__dirname, '../../Auth Module Backend/src/utils/jwt'));

// Test helper: Create a test user
async function createTestUser(email) {
  const passwordHash = await bcrypt.hash('testpassword123', 10);
  const user = await createUser(email, passwordHash, 'Test User');
  return user;
}

describe('Payments API Tests', () => {
  let testUser;
  let testUserToken;
  
  beforeAll(async () => {
    // Clean up test data
    try {
      await pool.query("DELETE FROM wallet_ledger WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'paymenttest%@example.com')");
      await pool.query("DELETE FROM wallets WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'paymenttest%@example.com')");
      await pool.query("DELETE FROM users WHERE email LIKE 'paymenttest%@example.com'");
    } catch (error) {
      console.log('Cleanup before tests:', error.message);
    }
    
    // Create test user
    testUser = await createTestUser('paymenttest@example.com');
    testUserToken = generateToken(testUser.id);
  });
  
  afterAll(async () => {
    // Clean up test data
    try {
      await pool.query("DELETE FROM wallet_ledger WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'paymenttest%@example.com')");
      await pool.query("DELETE FROM wallets WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'paymenttest%@example.com')");
      await pool.query("DELETE FROM users WHERE email LIKE 'paymenttest%@example.com'");
    } catch (error) {
      console.log('Cleanup after tests:', error.message);
    }
    await pool.end();
  });
  
  describe('POST /payments/deposit', () => {
    it('should create deposit ledger entry and return payment URL', async () => {
      const response = await request(app)
        .post('/payments/deposit')
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({
          amount_cents: 10000,
        })
        .expect(201);
      
      expect(response.body).toHaveProperty('tx_id');
      expect(response.body).toHaveProperty('payment_url');
      expect(response.body.amount_cents).toBe(10000);
      expect(response.body.status).toBe('pending');
      expect(response.body.payment_url).toContain('sandbox-payment.example.com');
      expect(response.body.payment_url).toContain(response.body.tx_id);
      
      // Verify ledger entry was created
      const ledgerEntry = await getLedgerEntryById(response.body.tx_id);
      expect(ledgerEntry).not.toBeNull();
      expect(ledgerEntry.amount_cents).toBe(10000);
      expect(ledgerEntry.type).toBe('deposit');
      expect(ledgerEntry.status).toBe('pending');
      expect(ledgerEntry.user_id).toBe(testUser.id);
    });
    
    it('should return 400 for missing amount_cents', async () => {
      const response = await request(app)
        .post('/payments/deposit')
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({})
        .expect(400);
      
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('amount_cents');
    });
    
    it('should return 400 for negative amount', async () => {
      const response = await request(app)
        .post('/payments/deposit')
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({
          amount_cents: -1000,
        })
        .expect(400);
      
      expect(response.body).toHaveProperty('error');
    });
    
    it('should return 400 for non-integer amount', async () => {
      const response = await request(app)
        .post('/payments/deposit')
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({
          amount_cents: 10.5,
        })
        .expect(400);
      
      expect(response.body).toHaveProperty('error');
    });
    
    it('should return 401 without authentication token', async () => {
      const response = await request(app)
        .post('/payments/deposit')
        .send({
          amount_cents: 10000,
        })
        .expect(401);
      
      expect(response.body).toHaveProperty('error');
    });
  });
  
  describe('POST /payments/webhook', () => {
    let depositTxId;
    
    beforeEach(async () => {
      // Create a pending deposit for webhook tests
      const response = await request(app)
        .post('/payments/deposit')
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({
          amount_cents: 5000,
        });
      
      depositTxId = response.body.tx_id;
    });
    
    it('should confirm deposit and credit wallet balance', async () => {
      // Get initial wallet balance
      const walletBefore = await getWallet(testUser.id);
      const balanceBefore = walletBefore ? walletBefore.balance_cents : 0;
      
      // Send webhook
      const response = await request(app)
        .post('/payments/webhook')
        .send({
          tx_id: depositTxId,
          status: 'completed',
        })
        .expect(200);
      
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.tx_id).toBe(depositTxId);
      expect(response.body.status).toBe('completed');
      
      // Verify ledger status updated
      const ledgerEntry = await getLedgerEntryById(depositTxId);
      expect(ledgerEntry.status).toBe('completed');
      
      // Verify wallet balance credited
      const walletAfter = await getWallet(testUser.id);
      expect(walletAfter.balance_cents).toBe(balanceBefore + 5000);
    });
    
    it('should be idempotent - duplicate webhook calls should not double-credit', async () => {
      // Get initial wallet balance
      const walletBefore = await getWallet(testUser.id);
      const balanceBefore = walletBefore ? walletBefore.balance_cents : 0;
      
      // First webhook call
      const response1 = await request(app)
        .post('/payments/webhook')
        .send({
          tx_id: depositTxId,
          status: 'completed',
        })
        .expect(200);
      
      expect(response1.body.success).toBe(true);
      
      // Second webhook call (duplicate)
      const response2 = await request(app)
        .post('/payments/webhook')
        .send({
          tx_id: depositTxId,
          status: 'completed',
        })
        .expect(200);
      
      expect(response2.body.success).toBe(true);
      expect(response2.body.message).toContain('already in this status');
      
      // Verify wallet balance only credited once
      const walletAfter = await getWallet(testUser.id);
      expect(walletAfter.balance_cents).toBe(balanceBefore + 5000);
    });
    
    it('should mark deposit as failed without crediting balance', async () => {
      // Get initial wallet balance
      const walletBefore = await getWallet(testUser.id);
      const balanceBefore = walletBefore ? walletBefore.balance_cents : 0;
      
      // Send failed webhook
      const response = await request(app)
        .post('/payments/webhook')
        .send({
          tx_id: depositTxId,
          status: 'failed',
        })
        .expect(200);
      
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.status).toBe('failed');
      
      // Verify ledger status updated
      const ledgerEntry = await getLedgerEntryById(depositTxId);
      expect(ledgerEntry.status).toBe('failed');
      
      // Verify wallet balance NOT credited
      const walletAfter = await getWallet(testUser.id);
      expect(walletAfter.balance_cents).toBe(balanceBefore);
    });
    
    it('should return 404 for invalid tx_id', async () => {
      const fakeTxId = '00000000-0000-0000-0000-000000000000';
      
      const response = await request(app)
        .post('/payments/webhook')
        .send({
          tx_id: fakeTxId,
          status: 'completed',
        })
        .expect(404);
      
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('not found');
    });
    
    it('should return 400 for missing tx_id', async () => {
      const response = await request(app)
        .post('/payments/webhook')
        .send({
          status: 'completed',
        })
        .expect(400);
      
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('tx_id');
    });
    
    it('should return 400 for missing status', async () => {
      const response = await request(app)
        .post('/payments/webhook')
        .send({
          tx_id: depositTxId,
        })
        .expect(400);
      
      expect(response.body).toHaveProperty('error');
    });
    
    it('should return 400 for invalid status', async () => {
      const response = await request(app)
        .post('/payments/webhook')
        .send({
          tx_id: depositTxId,
          status: 'invalid_status',
        })
        .expect(400);
      
      expect(response.body).toHaveProperty('error');
    });
    
    it('should return 400 when trying to update non-pending transaction', async () => {
      // First, complete the transaction
      await request(app)
        .post('/payments/webhook')
        .send({
          tx_id: depositTxId,
          status: 'completed',
        });
      
      // Try to update it again to failed (should fail)
      const response = await request(app)
        .post('/payments/webhook')
        .send({
          tx_id: depositTxId,
          status: 'failed',
        })
        .expect(400);
      
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Cannot update');
    });
  });
  
  describe('Deposit Lifecycle', () => {
    it('should complete full deposit lifecycle: create -> webhook -> balance credited', async () => {
      // Step 1: Create deposit
      const depositResponse = await request(app)
        .post('/payments/deposit')
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({
          amount_cents: 25000,
        })
        .expect(201);
      
      const txId = depositResponse.body.tx_id;
      
      // Verify pending status
      let ledgerEntry = await getLedgerEntryById(txId);
      expect(ledgerEntry.status).toBe('pending');
      
      // Get wallet balance before
      const walletBefore = await getWallet(testUser.id);
      const balanceBefore = walletBefore ? walletBefore.balance_cents : 0;
      
      // Step 2: Webhook confirms deposit
      const webhookResponse = await request(app)
        .post('/payments/webhook')
        .send({
          tx_id: txId,
          status: 'completed',
        })
        .expect(200);
      
      expect(webhookResponse.body.success).toBe(true);
      
      // Step 3: Verify final state
      ledgerEntry = await getLedgerEntryById(txId);
      expect(ledgerEntry.status).toBe('completed');
      
      const walletAfter = await getWallet(testUser.id);
      expect(walletAfter.balance_cents).toBe(balanceBefore + 25000);
    });
  });
});

