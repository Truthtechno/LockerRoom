import request from 'supertest';
import { describe, beforeAll, afterAll, test, expect } from '@jest/globals';
import { createServer } from '../../server/index';
import type { Server } from 'http';

describe('Posts API Tests', () => {
  let server: Server;
  let app: any;
  let studentToken: string;
  let viewerToken: string;
  let testPostId: string;

  beforeAll(async () => {
    const result = await createServer();
    app = result.app;
    server = result.server;

    // Login as student to get token
    const studentLogin = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'marcus.rodriguez@student.com',
        password: 'student123'
      });
    studentToken = studentLogin.body.token;

    // Login as viewer to get token
    const viewerLogin = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'sarah.johnson@viewer.com',
        password: 'viewer123'
      });
    viewerToken = viewerLogin.body.token;
  });

  afterAll((done) => {
    server.close(done);
  });

  describe('GET /api/posts', () => {
    test('should fetch all posts', async () => {
      const response = await request(app)
        .get('/api/posts');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      
      // Save a post ID for later tests
      if (response.body.length > 0) {
        testPostId = response.body[0].id;
      }
    });
  });

  describe('POST /api/posts/:postId/like', () => {
    test('should allow viewer to like a post', async () => {
      const response = await request(app)
        .post(`/api/posts/${testPostId}/like`)
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(response.status).toBe(200);
    });

    test('should allow student to like a post', async () => {
      const response = await request(app)
        .post(`/api/posts/${testPostId}/like`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(200);
    });

    test('should require authentication', async () => {
      const response = await request(app)
        .post(`/api/posts/${testPostId}/like`);

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/posts/:postId/comments', () => {
    test('should allow viewer to comment on post', async () => {
      const response = await request(app)
        .post(`/api/posts/${testPostId}/comments`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({
          content: 'Great post! Keep up the good work! 🔥'
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('content');
      expect(response.body.content).toBe('Great post! Keep up the good work! 🔥');
    });

    test('should allow student to comment on post', async () => {
      const response = await request(app)
        .post(`/api/posts/${testPostId}/comments`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          content: 'Nice work teammate!'
        });

      expect(response.status).toBe(200);
    });

    test('should require authentication for comments', async () => {
      const response = await request(app)
        .post(`/api/posts/${testPostId}/comments`)
        .send({
          content: 'Unauthorized comment'
        });

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/posts/:postId/comments', () => {
    test('should fetch comments for a post', async () => {
      const response = await request(app)
        .get(`/api/posts/${testPostId}/comments`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });

    test('should fetch all comments when limit=all', async () => {
      const response = await request(app)
        .get(`/api/posts/${testPostId}/comments?limit=all`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('POST /api/posts/:postId/save', () => {
    test('should allow viewer to save a post', async () => {
      const response = await request(app)
        .post(`/api/posts/${testPostId}/save`)
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(response.status).toBe(200);
    });

    test('should require authentication for saves', async () => {
      const response = await request(app)
        .post(`/api/posts/${testPostId}/save`);

      expect(response.status).toBe(401);
    });
  });

  describe('DELETE /api/posts/:postId/save', () => {
    test('should allow viewer to unsave a post', async () => {
      const response = await request(app)
        .delete(`/api/posts/${testPostId}/save`)
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(response.status).toBe(200);
    });
  });
});