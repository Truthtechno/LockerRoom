import request from 'supertest';
import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';

// Import your Express app
// Note: You'll need to export your app from server/index.ts for this to work
const API_BASE = 'http://localhost:5174';

describe('Auth API Tests', () => {
  let testUserToken: string;
  let testUserId: string;

  beforeAll(async () => {
    // Ensure test database is clean and seeded
    // This would typically involve running your seed script
  });

  afterAll(async () => {
    // Cleanup test data
  });

  describe('POST /api/auth/signup', () => {
    test('should register new viewer successfully', async () => {
      const userData = {
        name: 'Test User',
        email: `test-${Date.now()}@example.com`,
        password: 'testpassword123'
      };

      const response = await request(API_BASE)
        .post('/api/auth/signup')
        .send(userData)
        .expect(200);

      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('profile');
      expect(response.body.user.role).toBe('viewer');
      expect(response.body.user.email).toBe(userData.email);
      
      testUserToken = response.body.token;
      testUserId = response.body.user.id;
    });

    test('should return 409 for duplicate email', async () => {
      const userData = {
        name: 'Test User',
        email: 'sarah.johnson@viewer.com', // Existing email from seed data
        password: 'testpassword123'
      };

      const response = await request(API_BASE)
        .post('/api/auth/signup')
        .send(userData)
        .expect(409);

      expect(response.body.error.code).toBe('email_taken');
      expect(response.body.error.message).toBe('Email already registered');
    });

    test('should return 400 for missing fields', async () => {
      const userData = {
        name: 'Test User'
        // Missing email and password
      };

      const response = await request(API_BASE)
        .post('/api/auth/signup')
        .send(userData)
        .expect(400);

      expect(response.body.error.code).toBe('missing_fields');
    });

    test('should validate password strength', async () => {
      const userData = {
        name: 'Test User',
        email: `test-${Date.now()}@example.com`,
        password: '123' // Too short
      };

      const response = await request(API_BASE)
        .post('/api/auth/signup')
        .send(userData)
        .expect(400);

      expect(response.body.error).toBeDefined();
    });
  });

  describe('POST /api/auth/login', () => {
    test('should login with valid credentials', async () => {
      const loginData = {
        email: 'sarah.johnson@viewer.com',
        password: 'viewer123'
      };

      const response = await request(API_BASE)
        .post('/api/auth/login')
        .send(loginData)
        .expect(200);

      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('profile');
      expect(response.body.user.email).toBe(loginData.email);
    });

    test('should return 401 for invalid credentials', async () => {
      const loginData = {
        email: 'sarah.johnson@viewer.com',
        password: 'wrongpassword'
      };

      const response = await request(API_BASE)
        .post('/api/auth/login')
        .send(loginData)
        .expect(401);

      expect(response.body.error.code).toBe('invalid_credentials');
    });

    test('should return 400 for missing fields', async () => {
      const loginData = {
        email: 'sarah.johnson@viewer.com'
        // Missing password
      };

      const response = await request(API_BASE)
        .post('/api/auth/login')
        .send(loginData)
        .expect(400);

      expect(response.body.error.code).toBe('missing_fields');
    });
  });

  describe('POST /api/users/:userId/change-password', () => {
    test('should change password with valid current password', async () => {
      const passwordData = {
        currentPassword: 'testpassword123',
        newPassword: 'newpassword123'
      };

      const response = await request(API_BASE)
        .post(`/api/users/${testUserId}/change-password`)
        .set('Authorization', `Bearer ${testUserToken}`)
        .send(passwordData)
        .expect(200);

      expect(response.body.message).toBe('Password updated successfully');
    });

    test('should return 400 for incorrect current password', async () => {
      const passwordData = {
        currentPassword: 'wrongpassword',
        newPassword: 'newpassword123'
      };

      const response = await request(API_BASE)
        .post(`/api/users/${testUserId}/change-password`)
        .set('Authorization', `Bearer ${testUserToken}`)
        .send(passwordData)
        .expect(400);

      expect(response.body.message).toBe('Current password is incorrect');
    });

    test('should return 401 without authentication', async () => {
      const passwordData = {
        currentPassword: 'testpassword123',
        newPassword: 'newpassword123'
      };

      const response = await request(API_BASE)
        .post(`/api/users/${testUserId}/change-password`)
        .send(passwordData)
        .expect(401);

      expect(response.body.message).toBe('Authentication required');
    });
  });

  describe('GET /api/users/me/:userId', () => {
    test('should return user profile with valid token', async () => {
      const response = await request(API_BASE)
        .get(`/api/users/me/${testUserId}`)
        .set('Authorization', `Bearer ${testUserToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('name');
      expect(response.body).toHaveProperty('role');
    });

    test('should return 401 without authentication', async () => {
      const response = await request(API_BASE)
        .get(`/api/users/me/${testUserId}`)
        .expect(401);

      expect(response.body.message).toBe('Authentication required');
    });

    test('should return 403 for accessing other user\'s data', async () => {
      const response = await request(API_BASE)
        .get('/api/users/me/other-user-id')
        .set('Authorization', `Bearer ${testUserToken}`)
        .expect(403);

      expect(response.body.message).toBe('Access denied');
    });
  });
});