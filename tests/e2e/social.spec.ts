import { test, expect } from '@playwright/test';

test.describe('Social Features E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5000');
    
    // Login as viewer for social interactions
    await page.click('[data-testid="link-login"]');
    await page.fill('[data-testid="input-email"]', 'sarah.johnson@viewer.com');
    await page.fill('[data-testid="input-password"]', 'viewer123');
    await page.click('[data-testid="button-login"]');
    await page.waitForURL(/.*feed/);
  });

  test('should allow liking posts', async ({ page }) => {
    // Find first post and like it
    const firstPost = page.locator('[data-testid^="card-post-"]').first();
    const likeButton = firstPost.locator('[data-testid="button-like"]');
    
    // Click like button
    await likeButton.click();
    
    // Should update UI to show liked state
    await expect(likeButton).toHaveClass(/liked/);
    
    // Click again to unlike
    await likeButton.click();
    await expect(likeButton).not.toHaveClass(/liked/);
  });

  test('should allow commenting on posts', async ({ page }) => {
    // Find first post
    const firstPost = page.locator('[data-testid^="card-post-"]').first();
    
    // Click comment button to show input
    await firstPost.locator('[data-testid="button-comment"]').click();
    
    // Fill comment input
    const commentInput = firstPost.locator('[data-testid="input-comment"]');
    await commentInput.fill('Great post! Keep up the excellent work! 🔥');
    
    // Submit comment
    await firstPost.locator('[data-testid="button-submit-comment"]').click();
    
    // Should show the new comment
    await expect(firstPost.locator('[data-testid="text-comment"]')).toContainText('Great post! Keep up the excellent work! 🔥');
  });

  test('should allow viewing all comments', async ({ page }) => {
    // Find first post with comments
    const firstPost = page.locator('[data-testid^="card-post-"]').first();
    
    // Click "View All Comments"
    await firstPost.locator('[data-testid="link-view-all-comments"]').click();
    
    // Should open comments modal or navigate to comments page
    await expect(page.locator('[data-testid="modal-comments"]')).toBeVisible();
    
    // Should show multiple comments
    const comments = page.locator('[data-testid^="comment-"]');
    await expect(comments).toHaveCountGreaterThan(0);
  });

  test('should allow saving posts', async ({ page }) => {
    // Find first post
    const firstPost = page.locator('[data-testid^="card-post-"]').first();
    const saveButton = firstPost.locator('[data-testid="button-save"]');
    
    // Save the post
    await saveButton.click();
    
    // Should update UI to show saved state
    await expect(saveButton).toHaveClass(/saved/);
    
    // Navigate to saved posts
    await page.click('[data-testid="link-saved-posts"]');
    
    // Should see the saved post
    await expect(page.locator('[data-testid^="card-post-"]')).toHaveCountGreaterThan(0);
  });

  test('should allow following students', async ({ page }) => {
    // Navigate to search
    await page.click('[data-testid="link-search"]');
    
    // Search for students
    await page.fill('[data-testid="input-search"]', 'Marcus');
    await page.press('[data-testid="input-search"]', 'Enter');
    
    // Should show search results
    const studentResult = page.locator('[data-testid^="result-student-"]').first();
    await expect(studentResult).toBeVisible();
    
    // Follow the student
    const followButton = studentResult.locator('[data-testid="button-follow"]');
    await followButton.click();
    
    // Should update to show following state
    await expect(followButton).toContainText('Following');
    
    // Navigate to following list
    await page.click('[data-testid="link-following"]');
    
    // Should see the followed student
    await expect(page.locator('[data-testid^="card-student-"]')).toHaveCountGreaterThan(0);
  });

  test('should make profile avatars clickable', async ({ page }) => {
    // Find a post with student avatar
    const firstPost = page.locator('[data-testid^="card-post-"]').first();
    const avatar = firstPost.locator('[data-testid="img-avatar"]');
    
    // Click on avatar
    await avatar.click();
    
    // Should navigate to student profile
    await expect(page).toHaveURL(/.*profile/);
    
    // Should show student profile information
    await expect(page.locator('[data-testid="text-student-name"]')).toBeVisible();
    await expect(page.locator('[data-testid="text-student-position"]')).toBeVisible();
  });
});