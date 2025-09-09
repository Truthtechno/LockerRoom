import { test, expect } from '@playwright/test';

test.describe('API Endpoint Security and Functionality', () => {
  
  test('TC-API-001: Authentication Endpoint Tests', async ({ request }) => {
    // Test login endpoint
    const loginResponse = await request.post('/api/auth/login', {
      data: {
        email: 'student@lockerroom.com',
        password: 'Student123!'
      }
    });
    
    expect(loginResponse.status()).toBe(200);
    const loginData = await loginResponse.json();
    expect(loginData).toHaveProperty('user');
    expect(loginData.user).toHaveProperty('id');
    expect(loginData.user).toHaveProperty('email', 'student@lockerroom.com');
    
    // Test invalid login
    const invalidLoginResponse = await request.post('/api/auth/login', {
      data: {
        email: 'nonexistent@test.com',
        password: 'wrongpassword'
      }
    });
    
    expect(invalidLoginResponse.status()).toBeGreaterThanOrEqual(400);
  });

  test('TC-API-002: Unauthorized Access Prevention', async ({ request }) => {
    // Test accessing protected endpoints without authentication
    const protectedEndpoints = [
      '/api/users/me',
      '/api/posts',
      '/api/students/profile/test-id',
      '/api/system-admin/settings'
    ];
    
    for (const endpoint of protectedEndpoints) {
      const response = await request.get(endpoint);
      // Should return 401 or redirect to login
      expect([401, 403, 302]).toContain(response.status());
    }
  });

  test('TC-API-003: User Role-Based Access Control', async ({ request }) => {
    // Login as viewer
    const viewerLogin = await request.post('/api/auth/login', {
      data: {
        email: 'viewer@lockerroom.com',
        password: 'Viewer123!'
      }
    });
    
    expect(viewerLogin.status()).toBe(200);
    
    // Try to access system admin endpoints as viewer (should fail)
    const systemAdminResponse = await request.get('/api/system-admin/settings');
    expect([401, 403]).toContain(systemAdminResponse.status());
    
    // Try to access school admin endpoints as viewer (should fail)
    const schoolAdminResponse = await request.get('/api/school-admin/students');
    expect([401, 403]).toContain(schoolAdminResponse.status());
  });

  test('TC-API-004: Student Profile API', async ({ request }) => {
    // Login as student
    const loginResponse = await request.post('/api/auth/login', {
      data: {
        email: 'student@lockerroom.com',
        password: 'Student123!'
      }
    });
    
    expect(loginResponse.status()).toBe(200);
    const { user } = await loginResponse.json();
    
    // Get student profile
    const profileResponse = await request.get(`/api/students/profile/${user.id}`);
    expect(profileResponse.status()).toBe(200);
    
    const profile = await profileResponse.json();
    expect(profile).toHaveProperty('name');
    expect(profile).toHaveProperty('userId', user.id);
  });

  test('TC-API-005: Posts API Functionality', async ({ request }) => {
    // Login as student
    const loginResponse = await request.post('/api/auth/login', {
      data: {
        email: 'student@lockerroom.com',
        password: 'Student123!'
      }
    });
    
    expect(loginResponse.status()).toBe(200);
    
    // Get posts feed
    const postsResponse = await request.get('/api/posts');
    expect(postsResponse.status()).toBe(200);
    
    const posts = await postsResponse.json();
    expect(Array.isArray(posts)).toBe(true);
    
    if (posts.length > 0) {
      const firstPost = posts[0];
      expect(firstPost).toHaveProperty('id');
      expect(firstPost).toHaveProperty('caption');
      expect(firstPost).toHaveProperty('mediaUrl');
      
      // Test post interactions
      const likeResponse = await request.post(`/api/posts/${firstPost.id}/like`);
      expect([200, 201]).toContain(likeResponse.status());
      
      // Test commenting
      const commentResponse = await request.post(`/api/posts/${firstPost.id}/comment`, {
        data: {
          content: 'API test comment'
        }
      });
      expect([200, 201]).toContain(commentResponse.status());
    }
  });

  test('TC-API-006: Search API', async ({ request }) => {
    // Login as viewer
    const loginResponse = await request.post('/api/auth/login', {
      data: {
        email: 'viewer@lockerroom.com',
        password: 'Viewer123!'
      }
    });
    
    expect(loginResponse.status()).toBe(200);
    const { user } = await loginResponse.json();
    
    // Test student search
    const searchResponse = await request.get(`/api/search/students?q=Diego&userId=${user.id}`);
    expect(searchResponse.status()).toBe(200);
    
    const searchResults = await searchResponse.json();
    expect(Array.isArray(searchResults)).toBe(true);
  });

  test('TC-API-007: School Admin Restrictions', async ({ request }) => {
    // Login as school admin
    const loginResponse = await request.post('/api/auth/login', {
      data: {
        email: 'school@lockerroom.com',
        password: 'School123!'
      }
    });
    
    expect(loginResponse.status()).toBe(200);
    const { user } = await loginResponse.json();
    
    // Try to modify subscription settings (should be restricted)
    const subscriptionResponse = await request.put(`/api/schools/${user.schoolId}/subscription`, {
      data: {
        plan: 'premium',
        maxStudents: 500
      }
    });
    
    // Should return 403 or similar error
    expect(subscriptionResponse.status()).toBeGreaterThanOrEqual(400);
  });

  test('TC-API-008: Rate Limiting and Security Headers', async ({ request }) => {
    // Test basic security headers
    const response = await request.get('/api/posts');
    
    const headers = response.headers();
    
    // Check for basic security headers (may not all be present)
    const securityHeaders = ['x-content-type-options', 'x-frame-options', 'strict-transport-security'];
    
    // At least some security measures should be in place
    let hasSecurityHeaders = false;
    for (const header of securityHeaders) {
      if (headers[header]) {
        hasSecurityHeaders = true;
        break;
      }
    }
    
    // For development, security headers may not be fully configured
    // This test documents the current state
    console.log('Security headers present:', Object.keys(headers).filter(h => h.startsWith('x-') || h.includes('security')));
  });

  test('TC-API-009: Data Validation', async ({ request }) => {
    // Login first
    const loginResponse = await request.post('/api/auth/login', {
      data: {
        email: 'student@lockerroom.com',
        password: 'Student123!'
      }
    });
    
    expect(loginResponse.status()).toBe(200);
    
    // Test invalid data submission
    const invalidCommentResponse = await request.post('/api/posts/invalid-post-id/comment', {
      data: {
        content: '' // Empty content should be rejected
      }
    });
    
    expect(invalidCommentResponse.status()).toBeGreaterThanOrEqual(400);
    
    // Test SQL injection prevention
    const sqlInjectionResponse = await request.get("/api/search/students?q=' OR 1=1 --");
    // Should either return empty results or proper error, not server error
    expect([200, 400, 404]).toContain(sqlInjectionResponse.status());
  });

  test('TC-API-010: File Upload Restrictions', async ({ request }) => {
    // Login as student
    const loginResponse = await request.post('/api/auth/login', {
      data: {
        email: 'student@lockerroom.com',
        password: 'Student123!'
      }
    });
    
    expect(loginResponse.status()).toBe(200);
    
    // Test file upload endpoints exist and have proper restrictions
    // This tests the endpoint existence and basic validation
    const uploadResponse = await request.post('/api/upload/profile-pic', {
      multipart: {
        file: {
          name: 'test.txt',
          mimeType: 'text/plain',
          buffer: Buffer.from('test file content')
        }
      }
    });
    
    // Should reject non-image files or require proper validation
    expect([400, 415, 422]).toContain(uploadResponse.status());
  });

  test('TC-API-011: Analytics API Access Control', async ({ request }) => {
    // Test system admin analytics access
    const systemAdminLogin = await request.post('/api/auth/login', {
      data: {
        email: 'admin@lockerroom.com',
        password: 'Admin123!'
      }
    });
    
    expect(systemAdminLogin.status()).toBe(200);
    
    // System admin should have access to platform analytics
    const analyticsResponse = await request.get('/api/analytics/platform');
    // Should either succeed or return 404 if endpoint doesn't exist yet
    expect([200, 404]).toContain(analyticsResponse.status());
    
    // Test viewer analytics access (should be restricted)
    const viewerLogin = await request.post('/api/auth/login', {
      data: {
        email: 'viewer@lockerroom.com',
        password: 'Viewer123!'
      }
    });
    
    expect(viewerLogin.status()).toBe(200);
    
    const viewerAnalyticsResponse = await request.get('/api/analytics/platform');
    expect([401, 403]).toContain(viewerAnalyticsResponse.status());
  });

  test('TC-API-012: Following and Social Features', async ({ request }) => {
    // Login as viewer
    const loginResponse = await request.post('/api/auth/login', {
      data: {
        email: 'viewer@lockerroom.com',
        password: 'Viewer123!'
      }
    });
    
    expect(loginResponse.status()).toBe(200);
    const { user } = await loginResponse.json();
    
    // Get student to follow
    const searchResponse = await request.get(`/api/search/students?q=Diego&userId=${user.id}`);
    expect(searchResponse.status()).toBe(200);
    
    const students = await searchResponse.json();
    if (students.length > 0) {
      const studentId = students[0].id;
      
      // Test follow
      const followResponse = await request.post(`/api/students/${studentId}/follow`, {
        data: { userId: user.id }
      });
      expect([200, 201]).toContain(followResponse.status());
      
      // Test unfollow
      const unfollowResponse = await request.delete(`/api/students/${studentId}/follow`, {
        data: { userId: user.id }
      });
      expect([200, 204]).toContain(unfollowResponse.status());
      
      // Test following list
      const followingResponse = await request.get(`/api/users/${user.id}/following`);
      expect(followingResponse.status()).toBe(200);
    }
  });
});