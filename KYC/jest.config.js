module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/migrations/**',
  ],
  coverageDirectory: 'coverage',
  verbose: true,
  testTimeout: 10000, // Increase timeout for database operations
};

