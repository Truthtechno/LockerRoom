import request from 'supertest';
import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';

const API_BASE = 'http://localhost:5174';

describe('Admin API Tests', () => {
  let systemAdminToken: string;
  let schoolAdminToken: string;
  let viewerToken: string;
  let schoolId: string;
  let newStudentId: string;

  beforeAll(async () => {
    // Login as system admin
    const systemAdminLogin = await request(API_BASE)
      .post('/api/auth/login')
      .send({
        email: 'admin@lockerroom.com',
        password: 'admin123'
      });
    
    systemAdminToken = systemAdminLogin.body.token;

    // Login as school admin
    const schoolAdminLogin = await request(API_BASE)
      .post('/api/auth/login')
      .send({
        email: 'principal@lincoln.edu',
        password: 'principal123'
      });
    
    schoolAdminToken = schoolAdminLogin.body.token;
    schoolId = schoolAdminLogin.body.profile.schoolId;

    // Login as viewer
    const viewerLogin = await request(API_BASE)
      .post('/api/auth/login')
      .send({
        email: 'sarah.johnson@viewer.com',
        password: 'viewer123'
      });
    
    viewerToken = viewerLogin.body.token;
  });

  describe('School Admin - Add Student', () => {
    test('should add student successfully with minimal fields (name + email)', async () => {
      const studentData = {
        name: 'Test Student Minimal',
        email: `test.student.minimal.${Date.now()}@student.com`
      };

      const response = await request(API_BASE)
        .post('/api/school-admin/add-student')
        .set('Authorization', `Bearer ${schoolAdminToken}`)
        .send(studentData)
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Student added successfully');
      expect(response.body).toHaveProperty('student');
      expect(response.body).toHaveProperty('oneTimePassword');
      expect(response.body.student.email).toBe(studentData.email);
      expect(response.body.student.name).toBe(studentData.name);
      expect(response.body.student.phone).toBeNull();
      
      newStudentId = response.body.student.id;
    });

    test('should add student successfully with all optional fields', async () => {
      const studentData = {
        name: 'Test Student Complete',
        email: `test.student.complete.${Date.now()}@student.com`,
        phone: '555-0123',
        sport: 'Basketball',
        position: 'Guard',
        bio: 'Test student bio',
        grade: 'Grade 10',
        gender: 'male',
        dateOfBirth: '2005-01-01',
        guardianContact: 'Parent Name - 555-9999',
        roleNumber: '7'
      };

      const response = await request(API_BASE)
        .post('/api/school-admin/add-student')
        .set('Authorization', `Bearer ${schoolAdminToken}`)
        .send(studentData)
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Student added successfully');
      expect(response.body).toHaveProperty('student');
      expect(response.body).toHaveProperty('oneTimePassword');
      expect(response.body.student.email).toBe(studentData.email);
      expect(response.body.student.name).toBe(studentData.name);
      expect(response.body.student.phone).toBe(studentData.phone);
    });

    test('should return 400 for duplicate email', async () => {
      const studentData = {
        name: 'Test Student',
        email: 'marcus.rodriguez@student.com' // Existing email
      };

      const response = await request(API_BASE)
        .post('/api/school-admin/add-student')
        .set('Authorization', `Bearer ${schoolAdminToken}`)
        .send(studentData)
        .expect(409);

      expect(response.body.error.code).toBe('email_taken');
      expect(response.body.error.message).toBe('Email already registered');
    });

    test('should return 400 for missing required fields', async () => {
      const studentData = {
        email: `test.student.missing.name.${Date.now()}@student.com`
        // Missing name
      };

      const response = await request(API_BASE)
        .post('/api/school-admin/add-student')
        .set('Authorization', `Bearer ${schoolAdminToken}`)
        .send(studentData)
        .expect(400);

      expect(response.body.error.code).toBe('validation_error');
      expect(response.body.error.message).toBe('Name and email are required');
    });

    test('should return 403 for non-school-admin users', async () => {
      const studentData = {
        name: 'Test Student',
        email: `test.student.unauthorized.${Date.now()}@student.com`
      };

      const response = await request(API_BASE)
        .post('/api/school-admin/add-student')
        .set('Authorization', `Bearer ${viewerToken}`)
        .send(studentData)
        .expect(403);

      expect(response.body.message).toBe('Insufficient permissions');
    });
  });

  describe('School Analytics', () => {
    test('should return school analytics', async () => {
      const response = await request(API_BASE)
        .get(`/api/schools/${schoolId}/analytics`)
        .expect(200);

      expect(response.body).toHaveProperty('totalStudents');
      expect(response.body).toHaveProperty('averageSchoolRating');
      expect(response.body).toHaveProperty('gradeDistribution');
      expect(response.body).toHaveProperty('genderDistribution');
      expect(response.body).toHaveProperty('ratingsStats');
      expect(typeof response.body.totalStudents).toBe('number');
    });

    test('should return school stats', async () => {
      const response = await request(API_BASE)
        .get(`/api/schools/${schoolId}/stats`)
        .expect(200);

      expect(response.body).toHaveProperty('totalStudents');
      expect(response.body).toHaveProperty('totalPosts');
      expect(response.body).toHaveProperty('totalLikes');
      expect(response.body).toHaveProperty('totalComments');
    });
  });

  describe('System Admin - School Applications', () => {
    test('should get school applications', async () => {
      const response = await request(API_BASE)
        .get('/api/admin/school-applications')
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    test('should return 403 for non-system-admin users', async () => {
      const response = await request(API_BASE)
        .get('/api/admin/school-applications')
        .set('Authorization', `Bearer ${schoolAdminToken}`)
        .expect(403);

      expect(response.body.message).toBe('Insufficient permissions');
    });
  });

  describe('System Admin - System Settings', () => {
    test('should get system settings', async () => {
      const response = await request(API_BASE)
        .get('/api/admin/system-settings')
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    test('should create system setting', async () => {
      const settingData = {
        key: 'test_setting',
        value: 'test_value',
        description: 'Test setting for API test'
      };

      const response = await request(API_BASE)
        .post('/api/admin/system-settings')
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .send(settingData)
        .expect(200);

      expect(response.body).toHaveProperty('key', settingData.key);
      expect(response.body).toHaveProperty('value', settingData.value);
    });

    test('should return 403 for non-system-admin users', async () => {
      const settingData = {
        key: 'test_setting_2',
        value: 'test_value_2',
        description: 'Test setting for API test'
      };

      const response = await request(API_BASE)
        .post('/api/admin/system-settings')
        .set('Authorization', `Bearer ${schoolAdminToken}`)
        .send(settingData)
        .expect(403);

      expect(response.body.message).toBe('Insufficient permissions');
    });
  });

  describe('System Admin - Role Management', () => {
    test('should get admin roles', async () => {
      const response = await request(API_BASE)
        .get('/api/admin/roles')
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    test('should create admin role', async () => {
      const roleData = {
        userId: 'test-user-id',
        role: 'school_admin',
        schoolId: schoolId,
        permissions: ['manage_students', 'view_analytics']
      };

      const response = await request(API_BASE)
        .post('/api/admin/roles')
        .set('Authorization', `Bearer ${systemAdminToken}`)
        .send(roleData)
        .expect(200);

      expect(response.body).toHaveProperty('userId', roleData.userId);
      expect(response.body).toHaveProperty('role', roleData.role);
    });

    test('should return 403 for non-system-admin users', async () => {
      const roleData = {
        userId: 'test-user-id',
        role: 'school_admin',
        schoolId: schoolId
      };

      const response = await request(API_BASE)
        .post('/api/admin/roles')
        .set('Authorization', `Bearer ${schoolAdminToken}`)
        .send(roleData)
        .expect(403);

      expect(response.body.message).toBe('Insufficient permissions');
    });
  });

  describe('System Analytics', () => {
    test('should return system stats', async () => {
      const response = await request(API_BASE)
        .get('/api/system/stats')
        .expect(200);

      expect(response.body).toHaveProperty('totalSchools');
      expect(response.body).toHaveProperty('totalStudents');
      expect(response.body).toHaveProperty('totalPosts');
      expect(response.body).toHaveProperty('totalUsers');
      expect(typeof response.body.totalSchools).toBe('number');
    });

    test('should return analytics stats', async () => {
      const response = await request(API_BASE)
        .get('/api/analytics/stats')
        .expect(200);

      expect(response.body).toHaveProperty('totalEvents');
      expect(response.body).toHaveProperty('uniqueUsers');
      expect(response.body).toHaveProperty('topEvents');
    });
  });

  describe('School Settings', () => {
    test('should get school settings', async () => {
      const response = await request(API_BASE)
        .get(`/api/schools/${schoolId}/settings`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    test('should create school setting', async () => {
      const settingData = {
        key: 'test_school_setting',
        value: 'test_value',
        description: 'Test school setting'
      };

      const response = await request(API_BASE)
        .post(`/api/schools/${schoolId}/settings`)
        .send(settingData)
        .expect(200);

      expect(response.body).toHaveProperty('key', settingData.key);
      expect(response.body).toHaveProperty('value', settingData.value);
      expect(response.body).toHaveProperty('schoolId', schoolId);
    });
  });
});
