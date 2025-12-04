const request = require('supertest');
const app = require('../src/index');
const pool = require('../src/config/database');
const { createUser, findUserByEmail } = require('../src/models/user');
const bcrypt = require('bcrypt');

// Test data
const testUser = {
  email: 'test@example.com',
  password: 'testpassword123',
  display_name: 'Test User',
};

const testUser2 = {
  email: 'test2@example.com',
  password: 'testpassword123',
  display_name: 'Test User 2',
};

describe('Auth API Tests', () => {
  // Clean up test data before and after tests
  beforeAll(async () => {
    // Clean up any existing test users
    try {
      await pool.query("DELETE FROM users WHERE email LIKE 'test%@example.com'");
    } catch (error) {
      // Table might not exist yet, that's okay
      console.log('Cleanup before tests:', error.message);
    }
  });

  afterAll(async () => {
    // Clean up test users
    try {
      await pool.query("DELETE FROM users WHERE email LIKE 'test%@example.com'");
    } catch (error) {
      console.log('Cleanup after tests:', error.message);
    }
    // Close database connection
    await pool.end();
  });

  describe('POST /auth/register', () => {
    it('should register a new user successfully', async () => {
      const response = await request(app)
        .post('/auth/register')
        .send(testUser)
        .expect(201);

      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user).toHaveProperty('id');
      expect(response.body.user.email).toBe(testUser.email);
      expect(response.body.user.display_name).toBe(testUser.display_name);
      expect(response.body.user.kyc_status).toBe('none');
      expect(response.body.user).not.toHaveProperty('password_hash');
    });

    it('should return 409 for duplicate email', async () => {
      // First registration
      await request(app)
        .post('/auth/register')
        .send(testUser2);

      // Try to register again with same email
      const response = await request(app)
        .post('/auth/register')
        .send(testUser2)
        .expect(409);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('already registered');
    });

    it('should return 400 for missing email', async () => {
      const response = await request(app)
        .post('/auth/register')
        .send({
          password: 'testpassword123',
          display_name: 'Test User',
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('required');
    });

    it('should return 400 for missing password', async () => {
      const response = await request(app)
        .post('/auth/register')
        .send({
          email: 'test@example.com',
          display_name: 'Test User',
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('required');
    });

    it('should return 400 for missing display_name', async () => {
      const response = await request(app)
        .post('/auth/register')
        .send({
          email: 'test@example.com',
          password: 'testpassword123',
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('required');
    });

    it('should return 400 for invalid email format', async () => {
      const response = await request(app)
        .post('/auth/register')
        .send({
          email: 'invalid-email',
          password: 'testpassword123',
          display_name: 'Test User',
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('email');
    });

    it('should return 400 for password too short', async () => {
      const response = await request(app)
        .post('/auth/register')
        .send({
          email: 'test@example.com',
          password: '12345', // Less than 6 characters
          display_name: 'Test User',
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Password');
    });

    it('should return 400 for empty display_name', async () => {
      const response = await request(app)
        .post('/auth/register')
        .send({
          email: 'test@example.com',
          password: 'testpassword123',
          display_name: '   ',
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Display name');
    });
  });

  describe('POST /auth/login', () => {
    let registeredUser;

    beforeAll(async () => {
      // Register a user for login tests
      const passwordHash = await bcrypt.hash('loginpassword123', 10);
      registeredUser = await createUser(
        'logintest@example.com',
        passwordHash,
        'Login Test User'
      );
    });

    it('should login successfully with correct credentials', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'logintest@example.com',
          password: 'loginpassword123',
        })
        .expect(200);

      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.id).toBe(registeredUser.id);
      expect(response.body.user.email).toBe('logintest@example.com');
      expect(response.body.user.display_name).toBe('Login Test User');
      expect(response.body.user.kyc_status).toBe('none');
    });

    it('should return 401 for incorrect password', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'logintest@example.com',
          password: 'wrongpassword',
        })
        .expect(401);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Invalid email or password');
    });

    it('should return 401 for non-existent email', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'anypassword',
        })
        .expect(401);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Invalid email or password');
    });

    it('should return 400 for missing email', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          password: 'testpassword123',
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('required');
    });

    it('should return 400 for missing password', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'test@example.com',
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('required');
    });
  });

  describe('GET /auth/me', () => {
    let testToken;
    let testUserId;

    beforeAll(async () => {
      // Register a user and get token
      const passwordHash = await bcrypt.hash('metestpassword123', 10);
      const user = await createUser(
        'metest@example.com',
        passwordHash,
        'Me Test User'
      );
      testUserId = user.id;

      // Login to get token
      const loginResponse = await request(app)
        .post('/auth/login')
        .send({
          email: 'metest@example.com',
          password: 'metestpassword123',
        });

      testToken = loginResponse.body.token;
    });

    it('should return user profile with valid token', async () => {
      const response = await request(app)
        .get('/auth/me')
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('id');
      expect(response.body.id).toBe(testUserId);
      expect(response.body.email).toBe('metest@example.com');
      expect(response.body.display_name).toBe('Me Test User');
      expect(response.body.kyc_status).toBe('none');
      expect(response.body).not.toHaveProperty('password_hash');
    });

    it('should return 401 without token', async () => {
      const response = await request(app)
        .get('/auth/me')
        .expect(401);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('token');
    });

    it('should return 401 with invalid token', async () => {
      const response = await request(app)
        .get('/auth/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    it('should return 401 with malformed Authorization header', async () => {
      const response = await request(app)
        .get('/auth/me')
        .set('Authorization', 'InvalidFormat token')
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });
  });
});

