import request from 'supertest';
import { describe, beforeAll, afterAll, test, expect } from '@jest/globals';
import { createServer } from '../../server/index';
import type { Server } from 'http';

describe('Authentication API Tests', () => {
  let server: Server;
  let app: any;

  beforeAll(async () => {
    const result = await createServer();
    app = result.app;
    server = result.server;
  });

  afterAll((done) => {
    server.close(done);
  });

  describe('POST /api/auth/register', () => {
    test('should register a new viewer', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test.viewer@example.com',
          password: 'password123',
          role: 'viewer',
          name: 'Test Viewer',
          bio: 'Test viewer account'
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token');
      expect(response.body.user.role).toBe('viewer');
      expect(response.body.user.email).toBe('test.viewer@example.com');
    });

    test('should register a new student', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test.student@example.com',
          password: 'password123',
          role: 'student',
          name: 'Test Student',
          schoolId: 'some-school-id',
          sport: 'Soccer',
          position: 'Forward'
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token');
      expect(response.body.user.role).toBe('student');
    });

    test('should reject duplicate email', async () => {
      // Try to register the same email again
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test.viewer@example.com',
          password: 'password123',
          role: 'viewer',
          name: 'Duplicate Test'
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('already exists');
    });
  });

  describe('POST /api/auth/login', () => {
    test('should login with valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test.viewer@example.com',
          password: 'password123'
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token');
      expect(response.body.user.email).toBe('test.viewer@example.com');
    });

    test('should reject invalid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test.viewer@example.com',
          password: 'wrongpassword'
        });

      expect(response.status).toBe(401);
      expect(response.body.message).toContain('Invalid credentials');
    });

    test('should reject non-existent email', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'password123'
        });

      expect(response.status).toBe(401);
    });
  });

  describe('Demo Account Logins', () => {
    test('should login system admin', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'admin@lockerroom.com',
          password: 'admin123'
        });

      expect(response.status).toBe(200);
      expect(response.body.user.role).toBe('system_admin');
    });

    test('should login school admin', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'principal@lincoln.edu',
          password: 'principal123'
        });

      expect(response.status).toBe(200);
      expect(response.body.user.role).toBe('school_admin');
    });

    test('should login student', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'marcus.rodriguez@student.com',
          password: 'student123'
        });

      expect(response.status).toBe(200);
      expect(response.body.user.role).toBe('student');
    });

    test('should login viewer', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'sarah.johnson@viewer.com',
          password: 'viewer123'
        });

      expect(response.status).toBe(200);
      expect(response.body.user.role).toBe('viewer');
    });
  });
});