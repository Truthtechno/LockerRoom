import { test, expect } from '@playwright/test';

test.describe('Student Portal', () => {
  test.beforeEach(async ({ page }) => {
    // Login as student
    await page.goto('/login');
    await page.fill('[data-testid="input-email"]', 'marcus.rodriguez@student.com');
    await page.fill('[data-testid="input-password"]', 'student123');
    await page.click('[data-testid="button-login"]');
    await expect(page).toHaveURL('/feed');
  });

  test('Should be able to upload photo post', async ({ page }) => {
    // Navigate to create post
    await page.click('[data-testid="create-post-button"]');
    
    // Fill caption
    await page.fill('[data-testid="post-caption"]', 'Test photo post from E2E test');
    
    // Upload photo
    const fileInput = page.locator('[data-testid="media-upload"]');
    await fileInput.setInputFiles('tests/fixtures/test-image.png');
    
    // Submit post
    await page.click('[data-testid="submit-post"]');
    
    // Should show success message
    await expect(page.locator('text=Post created successfully')).toBeVisible();
    
    // Should appear in feed
    await expect(page.locator('text=Test photo post from E2E test')).toBeVisible();
  });

  test('Should be able to upload video post', async ({ page }) => {
    await page.click('[data-testid="create-post-button"]');
    
    await page.fill('[data-testid="post-caption"]', 'Test video post from E2E test');
    
    // Upload video
    const fileInput = page.locator('[data-testid="media-upload"]');
    await fileInput.setInputFiles('tests/fixtures/test-video.mp4');
    
    await page.click('[data-testid="submit-post"]');
    
    await expect(page.locator('text=Post created successfully')).toBeVisible();
    await expect(page.locator('text=Test video post from E2E test')).toBeVisible();
  });

  test('Should be able to like and comment on posts', async ({ page }) => {
    // Go to feed
    await page.goto('/feed');
    
    // Like first post
    const likeBtn = page.locator('[data-testid="like-button"]:first-child');
    await likeBtn.click();
    
    // Should show liked state
    await expect(likeBtn).toHaveClass(/liked/);
    
    // Add comment
    await page.click('[data-testid="comment-button"]:first-child');
    await page.fill('[data-testid="comment-input"]', 'Great post!');
    await page.click('[data-testid="submit-comment"]');
    
    // Comment should appear
    await expect(page.locator('text=Great post!')).toBeVisible();
  });

  test('Analytics should show engagement counts', async ({ page }) => {
    // Navigate to stats page
    await page.goto('/stats');
    
    // Should see analytics data
    await expect(page.locator('[data-testid="total-posts"]')).toBeVisible();
    await expect(page.locator('[data-testid="total-likes"]')).toBeVisible();
    await expect(page.locator('[data-testid="total-comments"]')).toBeVisible();
    await expect(page.locator('[data-testid="total-saves"]')).toBeVisible();
    
    // Should have non-zero values
    const postsCount = await page.textContent('[data-testid="total-posts"]');
    expect(parseInt(postsCount || '0')).toBeGreaterThan(0);
  });

  test('Should be able to update profile', async ({ page }) => {
    await page.goto('/settings');
    
    // Update profile fields
    await page.fill('[data-testid="input-bio"]', 'Updated student bio');
    await page.fill('[data-testid="input-sport"]', 'Basketball');
    await page.fill('[data-testid="input-position"]', 'Point Guard');
    
    // Upload profile photo
    const fileInput = page.locator('[data-testid="profile-photo-upload"]');
    await fileInput.setInputFiles('tests/fixtures/test-image.png');
    
    // Save changes
    await page.click('[data-testid="button-save-profile"]');
    
    // Should show success message
    await expect(page.locator('text=Profile updated successfully')).toBeVisible();
  });

  test('Should be able to change password', async ({ page }) => {
    await page.goto('/settings');
    
    // Navigate to password change
    await page.click('[data-testid="password-tab"]');
    
    // Fill password form
    await page.fill('[data-testid="input-current-password"]', 'student123');
    await page.fill('[data-testid="input-new-password"]', 'newstudent123');
    await page.fill('[data-testid="input-confirm-password"]', 'newstudent123');
    
    // Submit
    await page.click('[data-testid="button-change-password"]');
    
    // Should show success
    await expect(page.locator('text=Password updated successfully')).toBeVisible();
  });
});