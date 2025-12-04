// Test setup file for parcels module
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'test';
}

// Use test database if specified
if (!process.env.DB_NAME) {
  process.env.DB_NAME = process.env.TEST_DB_NAME || 'auth_db_test';
}

module.exports = {};

