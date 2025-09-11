import request from 'supertest';
import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';

const API_BASE = 'http://localhost:5174';

describe('Posts API Tests', () => {
  let studentToken: string;
  let viewerToken: string;
  let studentId: string;
  let viewerId: string;
  let testPostId: string;

  beforeAll(async () => {
    // Login as student
    const studentLogin = await request(API_BASE)
      .post('/api/auth/login')
      .send({
        email: 'marcus.rodriguez@student.com',
        password: 'student123'
      });
    
    studentToken = studentLogin.body.token;
    studentId = studentLogin.body.user.id;

    // Login as viewer
    const viewerLogin = await request(API_BASE)
      .post('/api/auth/login')
      .send({
        email: 'sarah.johnson@viewer.com',
        password: 'viewer123'
      });
    
    viewerToken = viewerLogin.body.token;
    viewerId = viewerLogin.body.user.id;
  });

  describe('GET /api/posts', () => {
    test('should return list of posts', async () => {
      const response = await request(API_BASE)
        .get('/api/posts')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      
      // Check post structure
      const post = response.body[0];
      expect(post).toHaveProperty('id');
      expect(post).toHaveProperty('caption');
      expect(post).toHaveProperty('createdAt');
    });
  });

  describe('POST /api/posts/create', () => {
    test('should create post with text only', async () => {
      const postData = {
        caption: 'Test post from API test'
      };

      const response = await request(API_BASE)
        .post('/api/posts/create')
        .set('Authorization', `Bearer ${studentToken}`)
        .send(postData)
        .expect(200);

      expect(response.body).toHaveProperty('id');
      expect(response.body.caption).toBe(postData.caption);
      expect(response.body.studentId).toBe(studentId);
      
      testPostId = response.body.id;
    });

    test('should return 401 without authentication', async () => {
      const postData = {
        caption: 'Test post'
      };

      const response = await request(API_BASE)
        .post('/api/posts/create')
        .send(postData)
        .expect(401);

      expect(response.body.message).toBe('Authentication required');
    });

    test('should return 403 for non-student users', async () => {
      const postData = {
        caption: 'Test post'
      };

      const response = await request(API_BASE)
        .post('/api/posts/create')
        .set('Authorization', `Bearer ${viewerToken}`)
        .send(postData)
        .expect(403);

      expect(response.body.message).toBe('Insufficient permissions');
    });
  });

  describe('POST /api/posts/:postId/like', () => {
    test('should like post successfully', async () => {
      const response = await request(API_BASE)
        .post(`/api/posts/${testPostId}/like`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('id');
      expect(response.body.postId).toBe(testPostId);
      expect(response.body.userId).toBe(viewerId);
    });

    test('should return 401 without authentication', async () => {
      const response = await request(API_BASE)
        .post(`/api/posts/${testPostId}/like`)
        .expect(401);

      expect(response.body.message).toBe('Authentication required');
    });
  });

  describe('DELETE /api/posts/:postId/like', () => {
    test('should unlike post successfully', async () => {
      const response = await request(API_BASE)
        .delete(`/api/posts/${testPostId}/like`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .expect(200);

      expect(response.body.message).toBe('Post unliked');
    });
  });

  describe('POST /api/posts/:postId/comment', () => {
    test('should add comment successfully', async () => {
      const commentData = {
        content: 'Great post!'
      };

      const response = await request(API_BASE)
        .post(`/api/posts/${testPostId}/comment`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .send(commentData)
        .expect(200);

      expect(response.body).toHaveProperty('id');
      expect(response.body.content).toBe(commentData.content);
      expect(response.body.postId).toBe(testPostId);
      expect(response.body.userId).toBe(viewerId);
    });

    test('should return 401 without authentication', async () => {
      const commentData = {
        content: 'Test comment'
      };

      const response = await request(API_BASE)
        .post(`/api/posts/${testPostId}/comment`)
        .send(commentData)
        .expect(401);

      expect(response.body.message).toBe('Authentication required');
    });
  });

  describe('GET /api/posts/:postId/comments', () => {
    test('should return post comments', async () => {
      const response = await request(API_BASE)
        .get(`/api/posts/${testPostId}/comments`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      
      if (response.body.length > 0) {
        const comment = response.body[0];
        expect(comment).toHaveProperty('id');
        expect(comment).toHaveProperty('content');
        expect(comment).toHaveProperty('createdAt');
      }
    });
  });

  describe('POST /api/posts/:postId/save', () => {
    test('should save post successfully', async () => {
      const response = await request(API_BASE)
        .post(`/api/posts/${testPostId}/save`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('id');
      expect(response.body.postId).toBe(testPostId);
      expect(response.body.userId).toBe(viewerId);
    });
  });

  describe('DELETE /api/posts/:postId/save', () => {
    test('should unsave post successfully', async () => {
      const response = await request(API_BASE)
        .delete(`/api/posts/${testPostId}/save`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .expect(200);

      expect(response.body.message).toBe('Post unsaved');
    });
  });

  describe('GET /api/users/:userId/saved-posts', () => {
    test('should return user saved posts', async () => {
      const response = await request(API_BASE)
        .get(`/api/users/${viewerId}/saved-posts`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    test('should return 401 without authentication', async () => {
      const response = await request(API_BASE)
        .get(`/api/users/${viewerId}/saved-posts`)
        .expect(401);

      expect(response.body.message).toBe('Authentication required');
    });

    test('should return 403 for accessing other user\'s saved posts', async () => {
      const response = await request(API_BASE)
        .get('/api/users/other-user-id/saved-posts')
        .set('Authorization', `Bearer ${viewerToken}`)
        .expect(403);

      expect(response.body.message).toBe('Access denied');
    });
  });
});