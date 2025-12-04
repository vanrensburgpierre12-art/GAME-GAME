const request = require('supertest');
const app = require('../src/index');
const pool = require('../src/config/database');
const path = require('path');
const fs = require('fs');
const { createUser } = require(path.join(__dirname, '../../Auth Module Backend/src/models/user'));
const { getUserKycStatus } = require('../src/models/kyc');
const bcrypt = require('bcrypt');
const { generateToken } = require(path.join(__dirname, '../../Auth Module Backend/src/utils/jwt'));

// Test helper: Create a test user
async function createTestUser(email, kycStatus = 'none', isAdmin = false) {
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
  
  // Update admin status if needed
  if (isAdmin) {
    await pool.query(
      'UPDATE users SET is_admin = $1 WHERE id = $2',
      [true, user.id]
    );
    user.is_admin = true;
  }
  
  return user;
}

// Helper to create a test file
function createTestFile() {
  const testFilePath = path.join(__dirname, 'test-document.pdf');
  fs.writeFileSync(testFilePath, 'test file content');
  return testFilePath;
}

// Helper to cleanup test files
function cleanupTestFiles() {
  const uploadsDir = path.join(__dirname, '../uploads/kyc');
  if (fs.existsSync(uploadsDir)) {
    fs.rmSync(uploadsDir, { recursive: true, force: true });
  }
  const testFile = path.join(__dirname, 'test-document.pdf');
  if (fs.existsSync(testFile)) {
    fs.unlinkSync(testFile);
  }
}

describe('KYC API Tests', () => {
  let testUser;
  let testUserToken;
  let adminUser;
  let adminUserToken;
  
  beforeAll(async () => {
    // Clean up test data
    try {
      await pool.query("DELETE FROM kyc_submissions WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'kyctest%@example.com')");
      await pool.query("DELETE FROM users WHERE email LIKE 'kyctest%@example.com'");
    } catch (error) {
      console.log('Cleanup before tests:', error.message);
    }
    
    // Create test users
    testUser = await createTestUser('kyctest@example.com', 'none', false);
    testUserToken = generateToken(testUser.id);
    
    adminUser = await createTestUser('kyctestadmin@example.com', 'none', true);
    adminUserToken = generateToken(adminUser.id);
    
    // Clean up any existing uploads
    cleanupTestFiles();
  });
  
  afterAll(async () => {
    // Clean up test data
    try {
      await pool.query("DELETE FROM kyc_submissions WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'kyctest%@example.com')");
      await pool.query("DELETE FROM users WHERE email LIKE 'kyctest%@example.com'");
    } catch (error) {
      console.log('Cleanup after tests:', error.message);
    }
    
    // Clean up test files
    cleanupTestFiles();
    
    await pool.end();
  });
  
  describe('POST /kyc/submit', () => {
    it('should create KYC submission and update user status', async () => {
      const testFile = createTestFile();
      
      const response = await request(app)
        .post('/kyc/submit')
        .set('Authorization', `Bearer ${testUserToken}`)
        .field('full_name', 'John Doe')
        .field('date_of_birth', '1990-01-15')
        .field('id_number', 'ID123456')
        .field('id_type', 'passport')
        .attach('id_document', testFile)
        .expect(201);
      
      expect(response.body).toHaveProperty('submission_id');
      expect(response.body.status).toBe('submitted');
      expect(response.body.message).toContain('submitted successfully');
      
      // Verify user status updated
      const user = await getUserKycStatus(testUser.id);
      expect(user.kyc_status).toBe('submitted');
      
      // Cleanup
      if (fs.existsSync(testFile)) {
        fs.unlinkSync(testFile);
      }
    });
    
    it('should return 400 for missing required fields', async () => {
      const testFile = createTestFile();
      
      const response = await request(app)
        .post('/kyc/submit')
        .set('Authorization', `Bearer ${testUserToken}`)
        .field('full_name', 'John Doe')
        .field('date_of_birth', '1990-01-15')
        // Missing id_number and id_type
        .attach('id_document', testFile)
        .expect(400);
      
      expect(response.body).toHaveProperty('error');
      
      // Cleanup
      if (fs.existsSync(testFile)) {
        fs.unlinkSync(testFile);
      }
    });
    
    it('should return 400 for invalid date format', async () => {
      const testFile = createTestFile();
      
      const response = await request(app)
        .post('/kyc/submit')
        .set('Authorization', `Bearer ${testUserToken}`)
        .field('full_name', 'John Doe')
        .field('date_of_birth', '01-15-1990') // Invalid format
        .field('id_number', 'ID123456')
        .field('id_type', 'passport')
        .attach('id_document', testFile)
        .expect(400);
      
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('format');
      
      // Cleanup
      if (fs.existsSync(testFile)) {
        fs.unlinkSync(testFile);
      }
    });
    
    it('should return 400 for invalid id_type', async () => {
      const testFile = createTestFile();
      
      const response = await request(app)
        .post('/kyc/submit')
        .set('Authorization', `Bearer ${testUserToken}`)
        .field('full_name', 'John Doe')
        .field('date_of_birth', '1990-01-15')
        .field('id_number', 'ID123456')
        .field('id_type', 'invalid_type')
        .attach('id_document', testFile)
        .expect(400);
      
      expect(response.body).toHaveProperty('error');
      
      // Cleanup
      if (fs.existsSync(testFile)) {
        fs.unlinkSync(testFile);
      }
    });
    
    it('should return 400 for missing file', async () => {
      const response = await request(app)
        .post('/kyc/submit')
        .set('Authorization', `Bearer ${testUserToken}`)
        .field('full_name', 'John Doe')
        .field('date_of_birth', '1990-01-15')
        .field('id_number', 'ID123456')
        .field('id_type', 'passport')
        .expect(400);
      
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('file is required');
    });
    
    it('should return 401 without authentication token', async () => {
      const testFile = createTestFile();
      
      const response = await request(app)
        .post('/kyc/submit')
        .field('full_name', 'John Doe')
        .field('date_of_birth', '1990-01-15')
        .field('id_number', 'ID123456')
        .field('id_type', 'passport')
        .attach('id_document', testFile)
        .expect(401);
      
      expect(response.body).toHaveProperty('error');
      
      // Cleanup
      if (fs.existsSync(testFile)) {
        fs.unlinkSync(testFile);
      }
    });
  });
  
  describe('GET /kyc/status', () => {
    beforeEach(async () => {
      // Create a submission for test user
      const testFile = createTestFile();
      await request(app)
        .post('/kyc/submit')
        .set('Authorization', `Bearer ${testUserToken}`)
        .field('full_name', 'John Doe')
        .field('date_of_birth', '1990-01-15')
        .field('id_number', 'ID123456')
        .field('id_type', 'passport')
        .attach('id_document', testFile);
      
      if (fs.existsSync(testFile)) {
        fs.unlinkSync(testFile);
      }
    });
    
    it('should return KYC status and submission info', async () => {
      const response = await request(app)
        .get('/kyc/status')
        .set('Authorization', `Bearer ${testUserToken}`)
        .expect(200);
      
      expect(response.body).toHaveProperty('kyc_status');
      expect(response.body.kyc_status).toBe('submitted');
      expect(response.body).toHaveProperty('submission');
      expect(response.body.submission).toHaveProperty('id');
      expect(response.body.submission).toHaveProperty('full_name');
      expect(response.body.submission).toHaveProperty('status');
    });
    
    it('should return status without submission for new user', async () => {
      const newUser = await createTestUser('kyctestnew@example.com');
      const newUserToken = generateToken(newUser.id);
      
      const response = await request(app)
        .get('/kyc/status')
        .set('Authorization', `Bearer ${newUserToken}`)
        .expect(200);
      
      expect(response.body).toHaveProperty('kyc_status');
      expect(response.body.kyc_status).toBe('none');
      expect(response.body.submission).toBeUndefined();
    });
    
    it('should return 401 without authentication token', async () => {
      const response = await request(app)
        .get('/kyc/status')
        .expect(401);
      
      expect(response.body).toHaveProperty('error');
    });
  });
  
  describe('POST /kyc/admin/verify/:user_id', () => {
    let submissionUserId;
    
    beforeEach(async () => {
      // Create a user with submitted KYC
      const submittedUser = await createTestUser('kyctestsubmitted@example.com', 'submitted');
      const submittedUserToken = generateToken(submittedUser.id);
      submissionUserId = submittedUser.id;
      
      const testFile = createTestFile();
      await request(app)
        .post('/kyc/submit')
        .set('Authorization', `Bearer ${submittedUserToken}`)
        .field('full_name', 'Jane Doe')
        .field('date_of_birth', '1985-05-20')
        .field('id_number', 'ID789012')
        .field('id_type', 'drivers_license')
        .attach('id_document', testFile);
      
      if (fs.existsSync(testFile)) {
        fs.unlinkSync(testFile);
      }
    });
    
    it('should verify KYC submission and update user status (admin only)', async () => {
      const response = await request(app)
        .post(`/kyc/admin/verify/${submissionUserId}`)
        .set('Authorization', `Bearer ${adminUserToken}`)
        .send({
          status: 'verified',
        })
        .expect(200);
      
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.kyc_status).toBe('verified');
      
      // Verify user status updated
      const user = await getUserKycStatus(submissionUserId);
      expect(user.kyc_status).toBe('verified');
    });
    
    it('should reject KYC submission and reset user status (admin only)', async () => {
      const response = await request(app)
        .post(`/kyc/admin/verify/${submissionUserId}`)
        .set('Authorization', `Bearer ${adminUserToken}`)
        .send({
          status: 'rejected',
        })
        .expect(200);
      
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.kyc_status).toBe('none');
      
      // Verify user status reset
      const user = await getUserKycStatus(submissionUserId);
      expect(user.kyc_status).toBe('none');
    });
    
    it('should default to verified if status not provided', async () => {
      const response = await request(app)
        .post(`/kyc/admin/verify/${submissionUserId}`)
        .set('Authorization', `Bearer ${adminUserToken}`)
        .send({})
        .expect(200);
      
      expect(response.body.kyc_status).toBe('verified');
    });
    
    it('should return 403 for non-admin users', async () => {
      const response = await request(app)
        .post(`/kyc/admin/verify/${submissionUserId}`)
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({
          status: 'verified',
        })
        .expect(403);
      
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Admin');
    });
    
    it('should return 404 for user with no submission', async () => {
      const newUser = await createTestUser('kyctestnosub@example.com');
      
      const response = await request(app)
        .post(`/kyc/admin/verify/${newUser.id}`)
        .set('Authorization', `Bearer ${adminUserToken}`)
        .send({
          status: 'verified',
        })
        .expect(404);
      
      expect(response.body).toHaveProperty('error');
    });
    
    it('should return 400 for invalid status', async () => {
      const response = await request(app)
        .post(`/kyc/admin/verify/${submissionUserId}`)
        .set('Authorization', `Bearer ${adminUserToken}`)
        .send({
          status: 'invalid_status',
        })
        .expect(400);
      
      expect(response.body).toHaveProperty('error');
    });
    
    it('should return 401 without authentication token', async () => {
      const response = await request(app)
        .post(`/kyc/admin/verify/${submissionUserId}`)
        .send({
          status: 'verified',
        })
        .expect(401);
      
      expect(response.body).toHaveProperty('error');
    });
  });
});

