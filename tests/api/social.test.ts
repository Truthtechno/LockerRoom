import request from 'supertest';
import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';

const API_BASE = 'http://localhost:5174';

describe('Social Features API Tests', () => {
  let studentToken: string;
  let viewerToken: string;
  let studentId: string;
  let viewerId: string;
  let targetStudentId: string;

  beforeAll(async () => {
    // Login as student
    const studentLogin = await request(API_BASE)
      .post('/api/auth/login')
      .send({
        email: 'marcus.rodriguez@student.com',
        password: 'student123'
      });
    
    studentToken = studentLogin.body.token;
    studentId = studentLogin.body.user.linkedId;

    // Login as viewer
    const viewerLogin = await request(API_BASE)
      .post('/api/auth/login')
      .send({
        email: 'sarah.johnson@viewer.com',
        password: 'viewer123'
      });
    
    viewerToken = viewerLogin.body.token;
    viewerId = viewerLogin.body.user.id;

    // Get another student ID for following tests
    const studentsResponse = await request(API_BASE)
      .get('/api/students')
      .set('Authorization', `Bearer ${studentToken}`);
    
    const students = studentsResponse.body;
    targetStudentId = students.find((s: any) => s.id !== studentId)?.id;
  });

  describe('POST /api/students/:studentId/follow', () => {
    test('should follow student successfully', async () => {
      const response = await request(API_BASE)
        .post(`/api/students/${targetStudentId}/follow`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('id');
      expect(response.body.followerId).toBe(viewerId);
      expect(response.body.followingId).toBe(targetStudentId);
    });

    test('should return 400 if already following', async () => {
      const response = await request(API_BASE)
        .post(`/api/students/${targetStudentId}/follow`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .expect(400);

      expect(response.body.message).toBe('Already following this student');
    });

    test('should return 401 without authentication', async () => {
      const response = await request(API_BASE)
        .post(`/api/students/${targetStudentId}/follow`)
        .expect(401);

      expect(response.body.message).toBe('Authentication required');
    });
  });

  describe('DELETE /api/students/:studentId/follow', () => {
    test('should unfollow student successfully', async () => {
      const response = await request(API_BASE)
        .delete(`/api/students/${targetStudentId}/follow`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .expect(200);

      expect(response.body.message).toBe('Unfollowed successfully');
    });

    test('should return 401 without authentication', async () => {
      const response = await request(API_BASE)
        .delete(`/api/students/${targetStudentId}/follow`)
        .expect(401);

      expect(response.body.message).toBe('Authentication required');
    });
  });

  describe('GET /api/students/:studentId/followers', () => {
    test('should return student followers', async () => {
      const response = await request(API_BASE)
        .get(`/api/students/${targetStudentId}/followers`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('GET /api/users/:userId/following', () => {
    test('should return user following list', async () => {
      const response = await request(API_BASE)
        .get(`/api/users/${viewerId}/following`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('GET /api/students/:studentId/is-following', () => {
    test('should return follow status', async () => {
      const response = await request(API_BASE)
        .get(`/api/students/${targetStudentId}/is-following`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .expect(200);

      expect(typeof response.body).toBe('boolean');
    });

    test('should return 401 without authentication', async () => {
      const response = await request(API_BASE)
        .get(`/api/students/${targetStudentId}/is-following`)
        .expect(401);

      expect(response.body.message).toBe('Authentication required');
    });
  });

  describe('GET /api/search/students', () => {
    test('should search students by name', async () => {
      const response = await request(API_BASE)
        .get('/api/search/students')
        .query({ q: 'marcus', userId: viewerId })
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      
      if (response.body.length > 0) {
        const student = response.body[0];
        expect(student).toHaveProperty('id');
        expect(student).toHaveProperty('name');
        expect(student.name.toLowerCase()).toContain('marcus');
      }
    });

    test('should return 400 for missing query', async () => {
      const response = await request(API_BASE)
        .get('/api/search/students')
        .expect(400);

      expect(response.body.message).toBe('Search query required');
    });
  });

  describe('Student Analytics', () => {
    test('should return student analytics', async () => {
      const response = await request(API_BASE)
        .get(`/api/students/${studentId}/analytics`)
        .expect(200);

      expect(response.body).toHaveProperty('monthlyEngagement');
      expect(response.body).toHaveProperty('totalStats');
      expect(Array.isArray(response.body.monthlyEngagement)).toBe(true);
      expect(response.body.totalStats).toHaveProperty('posts');
      expect(response.body.totalStats).toHaveProperty('likes');
      expect(response.body.totalStats).toHaveProperty('comments');
      expect(response.body.totalStats).toHaveProperty('saves');
    });

    test('should return student performance data', async () => {
      const response = await request(API_BASE)
        .get(`/api/students/${studentId}/performance`)
        .expect(200);

      expect(response.body).toHaveProperty('sportsPerformance');
      expect(response.body).toHaveProperty('monthlyGoals');
      expect(response.body).toHaveProperty('overallRating');
      expect(Array.isArray(response.body.sportsPerformance)).toBe(true);
      expect(Array.isArray(response.body.monthlyGoals)).toBe(true);
      expect(typeof response.body.overallRating).toBe('number');
    });
  });

  describe('Student Ratings', () => {
    test('should get student ratings', async () => {
      const response = await request(API_BASE)
        .get(`/api/students/${studentId}/ratings`)
        .expect(200);

      expect(response.body).toHaveProperty('ratings');
      expect(response.body).toHaveProperty('averageRating');
      expect(Array.isArray(response.body.ratings)).toBe(true);
      expect(typeof response.body.averageRating).toBe('number');
    });

    test('should add student rating', async () => {
      const ratingData = {
        score: 8,
        comment: 'Great performance!'
      };

      const response = await request(API_BASE)
        .post(`/api/students/${studentId}/ratings`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .send(ratingData)
        .expect(200);

      expect(response.body).toHaveProperty('id');
      expect(response.body.score).toBe(ratingData.score);
      expect(response.body.comment).toBe(ratingData.comment);
      expect(response.body.studentId).toBe(studentId);
      expect(response.body.raterId).toBe(viewerId);
    });

    test('should return 401 without authentication for rating', async () => {
      const ratingData = {
        score: 8,
        comment: 'Great performance!'
      };

      const response = await request(API_BASE)
        .post(`/api/students/${studentId}/ratings`)
        .send(ratingData)
        .expect(401);

      expect(response.body.message).toBe('Authentication required');
    });
  });
});
