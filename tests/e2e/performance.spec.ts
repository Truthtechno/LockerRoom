import { test, expect } from '@playwright/test';

test.describe('Performance Tests', () => {
  test('Login performance should be fast', async ({ page }) => {
    const startTime = Date.now();
    
    await page.goto('/login');
    await page.fill('[data-testid="input-email"]', 'sarah.johnson@viewer.com');
    await page.fill('[data-testid="input-password"]', 'viewer123');
    await page.click('[data-testid="button-login"]');
    
    // Wait for redirect to feed
    await expect(page).toHaveURL('/feed');
    
    const endTime = Date.now();
    const loginTime = endTime - startTime;
    
    // Login should complete within 3 seconds
    expect(loginTime).toBeLessThan(3000);
    
    console.log(`Login completed in ${loginTime}ms`);
  });

  test('Feed load performance should be fast', async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.fill('[data-testid="input-email"]', 'sarah.johnson@viewer.com');
    await page.fill('[data-testid="input-password"]', 'viewer123');
    await page.click('[data-testid="button-login"]');
    
    const startTime = Date.now();
    
    // Navigate to feed
    await page.goto('/feed');
    
    // Wait for posts to load
    await expect(page.locator('[data-testid="post-card"]')).toHaveCount.greaterThan(0);
    
    const endTime = Date.now();
    const feedLoadTime = endTime - startTime;
    
    // Feed should load within 2 seconds
    expect(feedLoadTime).toBeLessThan(2000);
    
    console.log(`Feed loaded in ${feedLoadTime}ms`);
  });

  test('Post upload performance should be reasonable', async ({ page }) => {
    // Login as student
    await page.goto('/login');
    await page.fill('[data-testid="input-email"]', 'marcus.rodriguez@student.com');
    await page.fill('[data-testid="input-password"]', 'student123');
    await page.click('[data-testid="button-login"]');
    
    const startTime = Date.now();
    
    // Create post
    await page.click('[data-testid="create-post-button"]');
    await page.fill('[data-testid="post-caption"]', 'Performance test post');
    
    // Upload image
    const fileInput = page.locator('[data-testid="media-upload"]');
    await fileInput.setInputFiles('tests/fixtures/test-image.png');
    
    // Submit post
    await page.click('[data-testid="submit-post"]');
    
    // Wait for success message
    await expect(page.locator('text=Post created successfully')).toBeVisible();
    
    const endTime = Date.now();
    const uploadTime = endTime - startTime;
    
    // Post upload should complete within 10 seconds (including Cloudinary upload)
    expect(uploadTime).toBeLessThan(10000);
    
    console.log(`Post upload completed in ${uploadTime}ms`);
  });

  test('Add student performance should be reasonable', async ({ page }) => {
    // Login as school admin
    await page.goto('/login');
    await page.fill('[data-testid="input-email"]', 'principal@lincoln.edu');
    await page.fill('[data-testid="input-password"]', 'principal123');
    await page.click('[data-testid="button-login"]');
    
    const startTime = Date.now();
    
    // Navigate to add student
    await page.goto('/school-admin/add-student');
    
    // Fill form
    await page.fill('[data-testid="input-name"]', 'Performance Test Student');
    await page.fill('[data-testid="input-email"]', `perf.test.${Date.now()}@student.com`);
    await page.selectOption('[data-testid="select-sport"]', 'Basketball');
    await page.fill('[data-testid="input-position"]', 'Guard');
    await page.fill('[data-testid="input-bio"]', 'Performance test student');
    
    // Submit form
    await page.click('[data-testid="button-add-student"]');
    
    // Wait for success
    await expect(page.locator('text=Student added successfully')).toBeVisible();
    
    const endTime = Date.now();
    const addStudentTime = endTime - startTime;
    
    // Add student should complete within 5 seconds
    expect(addStudentTime).toBeLessThan(5000);
    
    console.log(`Add student completed in ${addStudentTime}ms`);
  });

  test('Search performance should be fast', async ({ page }) => {
    // Login as viewer
    await page.goto('/login');
    await page.fill('[data-testid="input-email"]', 'sarah.johnson@viewer.com');
    await page.fill('[data-testid="input-password"]', 'viewer123');
    await page.click('[data-testid="button-login"]');
    
    const startTime = Date.now();
    
    // Navigate to search
    await page.goto('/search');
    
    // Perform search
    await page.fill('[data-testid="search-input"]', 'marcus');
    await page.click('[data-testid="search-button"]');
    
    // Wait for results
    await expect(page.locator('[data-testid="student-result"]')).toHaveCount.greaterThan(0);
    
    const endTime = Date.now();
    const searchTime = endTime - startTime;
    
    // Search should complete within 1 second
    expect(searchTime).toBeLessThan(1000);
    
    console.log(`Search completed in ${searchTime}ms`);
  });

  test('Analytics load performance should be reasonable', async ({ page }) => {
    // Login as school admin
    await page.goto('/login');
    await page.fill('[data-testid="input-email"]', 'principal@lincoln.edu');
    await page.fill('[data-testid="input-password"]', 'principal123');
    await page.click('[data-testid="button-login"]');
    
    const startTime = Date.now();
    
    // Navigate to analytics
    await page.goto('/school-admin/live-reports');
    
    // Wait for analytics to load
    await expect(page.locator('[data-testid="total-students"]')).toBeVisible();
    await expect(page.locator('[data-testid="total-posts"]')).toBeVisible();
    
    const endTime = Date.now();
    const analyticsLoadTime = endTime - startTime;
    
    // Analytics should load within 3 seconds
    expect(analyticsLoadTime).toBeLessThan(3000);
    
    console.log(`Analytics loaded in ${analyticsLoadTime}ms`);
  });

  test('Page navigation should be fast', async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.fill('[data-testid="input-email"]', 'sarah.johnson@viewer.com');
    await page.fill('[data-testid="input-password"]', 'viewer123');
    await page.click('[data-testid="button-login"]');
    
    const pages = ['/feed', '/search', '/following', '/saved', '/settings'];
    
    for (const pagePath of pages) {
      const startTime = Date.now();
      
      await page.goto(pagePath);
      
      // Wait for page to be ready
      await page.waitForLoadState('networkidle');
      
      const endTime = Date.now();
      const navigationTime = endTime - startTime;
      
      // Each page should load within 2 seconds
      expect(navigationTime).toBeLessThan(2000);
      
      console.log(`${pagePath} loaded in ${navigationTime}ms`);
    }
  });

  test('Memory usage should be reasonable', async ({ page }) => {
    // Login and perform various actions
    await page.goto('/login');
    await page.fill('[data-testid="input-email"]', 'sarah.johnson@viewer.com');
    await page.fill('[data-testid="input-password"]', 'viewer123');
    await page.click('[data-testid="button-login"]');
    
    // Navigate through multiple pages
    const pages = ['/feed', '/search', '/following', '/saved', '/settings'];
    
    for (const pagePath of pages) {
      await page.goto(pagePath);
      await page.waitForLoadState('networkidle');
    }
    
    // Check memory usage
    const metrics = await page.evaluate(() => {
      return {
        memory: (performance as any).memory,
        timing: performance.timing
      };
    });
    
    if (metrics.memory) {
      // Check that memory usage is reasonable (less than 100MB)
      const usedJSHeapSize = metrics.memory.usedJSHeapSize;
      const totalJSHeapSize = metrics.memory.totalJSHeapSize;
      
      console.log(`Used JS Heap Size: ${usedJSHeapSize / 1024 / 1024}MB`);
      console.log(`Total JS Heap Size: ${totalJSHeapSize / 1024 / 1024}MB`);
      
      // Memory usage should be reasonable
      expect(usedJSHeapSize).toBeLessThan(100 * 1024 * 1024); // 100MB
    }
  });

  test('Network requests should be optimized', async ({ page }) => {
    const requests: string[] = [];
    
    // Track network requests
    page.on('request', request => {
      requests.push(request.url());
    });
    
    // Login and navigate
    await page.goto('/login');
    await page.fill('[data-testid="input-email"]', 'sarah.johnson@viewer.com');
    await page.fill('[data-testid="input-password"]', 'viewer123');
    await page.click('[data-testid="button-login"]');
    
    await page.goto('/feed');
    await page.waitForLoadState('networkidle');
    
    // Check for unnecessary requests
    const duplicateRequests = requests.filter((url, index) => requests.indexOf(url) !== index);
    expect(duplicateRequests.length).toBe(0);
    
    // Check for large requests
    const largeRequests = requests.filter(url => {
      // This would need to be implemented with actual request size tracking
      return false;
    });
    
    console.log(`Total requests made: ${requests.length}`);
    console.log(`Duplicate requests: ${duplicateRequests.length}`);
  });
});
