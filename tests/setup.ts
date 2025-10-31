import 'dotenv/config';

// Global test setup
beforeAll(async () => {
  // Ensure test database is clean and seeded
  console.log('Setting up test environment...');
});

afterAll(async () => {
  // Cleanup after all tests
  console.log('Cleaning up test environment...');
});

// Global test timeout
jest.setTimeout(30000);
