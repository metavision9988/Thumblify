// Test setup file
require('dotenv').config({ path: '.env.test' });

// Global test setup
beforeAll(async () => {
  // Setup test database connection, etc.
  process.env.NODE_ENV = 'test';
});

afterAll(async () => {
  // Cleanup
  if (global.testServer) {
    await global.testServer.close();
  }
});