// Test setup file for wallet module
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'test';
}

// Use test database if specified
if (!process.env.DB_NAME) {
  process.env.DB_NAME = process.env.TEST_DB_NAME || 'auth_db_test';
}

// Set test JWT secret if needed
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'test-secret-key';
}

module.exports = {};

