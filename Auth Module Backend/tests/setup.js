// Test setup file
// This file can be used to configure test environment
// For example, setting up a test database connection

// Set test environment variables if not already set
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'test';
}

// Use test database if specified
if (!process.env.DB_NAME) {
  process.env.DB_NAME = process.env.TEST_DB_NAME || 'auth_db_test';
}

// Use test JWT secret
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'test-secret-key';
}

module.exports = {};

