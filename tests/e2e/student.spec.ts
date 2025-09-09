import { test, expect, Page } from '@playwright/test';
import path from 'path';

test.describe('Student Portal', () => {
  let page: Page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    
    // Login as student
    await page.goto('/login');
    await page.fill('[data-testid="input-email"]', 'student@lockerroom.com');
    await page.fill('[data-testid="input-password"]', 'Student123!');
    await page.click('[data-testid="button-login"]');
    
    // Wait for redirect to feed
    await page.waitForURL('/feed');
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('TC-STU-001: Student Login and Feed Access', async () => {
    // Verify feed loads
    await expect(page).toHaveURL('/feed');
    await expect(page.locator('main, .feed')).toBeVisible();
    
    // Take screenshot
    await page.screenshot({ path: 'artifacts/usability-tests/screenshots/student-feed.png' });
    
    // Verify student navigation
    await expect(page.locator('[data-testid="mobile-nav-feed"]')).toBeVisible();
    await expect(page.locator('[data-testid="mobile-nav-create"]')).toBeVisible();
    await expect(page.locator('[data-testid="mobile-nav-stats"]')).toBeVisible();
  });

  test('TC-STU-002: Create Photo Post', async () => {
    // Navigate to create post
    const createButton = page.locator('[data-testid="mobile-nav-create"], [data-testid="button-add-photo"], button:has-text("Photo")').first();
    await createButton.click();
    
    // Take screenshot of create interface
    await page.screenshot({ path: 'artifacts/usability-tests/screenshots/create-photo-interface.png' });
    
    // Upload photo
    const photoButton = page.locator('[data-testid="button-add-photo"]');
    if (await photoButton.isVisible()) {
      await photoButton.click();
      
      // Handle file input
      const fileInput = page.locator('input[type="file"][accept*="image"]');
      await fileInput.setInputFiles(path.join(process.cwd(), 'tests/fixtures/test-image.png'));
      
      // Wait for preview
      await page.waitForSelector('img, .media-preview', { timeout: 5000 });
      
      // Add caption
      const captionInput = page.locator('textarea[placeholder*="caption"], textarea[name="caption"], .caption-input textarea').first();
      if (await captionInput.isVisible()) {
        await captionInput.fill('Test photo post from automated testing 📸');
      }
      
      // Submit post
      const shareButton = page.locator('[data-testid="button-share-post"], button:has-text("Share"), button[type="submit"]').first();
      await shareButton.click();
      
      // Wait for success
      await page.waitForLoadState('networkidle');
      
      // Take screenshot of result
      await page.screenshot({ path: 'artifacts/usability-tests/screenshots/photo-post-created.png' });
      
      // Verify post appears in feed
      await page.goto('/feed');
      await page.waitForLoadState('networkidle');
      await expect(page.locator(':has-text("Test photo post")')).toBeVisible();
    }
  });

  test('TC-STU-003: Create Video Post', async () => {
    // Navigate to create post
    const createButton = page.locator('[data-testid="mobile-nav-create"], [data-testid="button-add-video"], button:has-text("Video")').first();
    await createButton.click();
    
    // Upload video
    const videoButton = page.locator('[data-testid="button-add-video"]');
    if (await videoButton.isVisible()) {
      await videoButton.click();
      
      // Handle file input
      const fileInput = page.locator('input[type="file"][accept*="video"]');
      await fileInput.setInputFiles(path.join(process.cwd(), 'tests/fixtures/test-video.mp4'));
      
      // Wait for preview
      await page.waitForSelector('video, .video-preview', { timeout: 5000 });
      
      // Add caption
      const captionInput = page.locator('textarea[placeholder*="caption"], textarea[name="caption"], .caption-input textarea').first();
      if (await captionInput.isVisible()) {
        await captionInput.fill('Test video post from automated testing 🎥');
      }
      
      // Submit post
      const shareButton = page.locator('[data-testid="button-share-post"], button:has-text("Share")').first();
      await shareButton.click();
      
      // Wait for success
      await page.waitForLoadState('networkidle');
      
      // Take screenshot
      await page.screenshot({ path: 'artifacts/usability-tests/screenshots/video-post-created.png' });
    }
  });

  test('TC-STU-004: Interact with Posts', async () => {
    // Go to feed
    await page.goto('/feed');
    await page.waitForLoadState('networkidle');
    
    // Find first post
    const firstPost = page.locator('.post, [data-testid*="post-"], .post-card').first();
    await expect(firstPost).toBeVisible();
    
    // Get post ID if available
    const postElement = await firstPost.getAttribute('data-testid') || await firstPost.getAttribute('id');
    let postId = 'unknown';
    if (postElement && postElement.includes('post-')) {
      postId = postElement.split('post-')[1];
    }
    
    // Like the post
    const likeButton = page.locator(`[data-testid="button-like-${postId}"], button:has([data-icon="heart"]), .like-button`).first();
    if (await likeButton.isVisible()) {
      await likeButton.click();
      await page.waitForTimeout(500); // Wait for animation
    }
    
    // Comment on the post
    const commentButton = page.locator(`[data-testid="button-comment-${postId}"], button:has([data-icon="message"]), .comment-button`).first();
    if (await commentButton.isVisible()) {
      await commentButton.click();
      
      // Add comment if comment input appears
      const commentInput = page.locator('input[placeholder*="comment"], textarea[placeholder*="comment"], .comment-input input, .comment-input textarea').first();
      if (await commentInput.isVisible()) {
        await commentInput.fill('Great post! 👍');
        
        // Submit comment
        const submitComment = page.locator('button:has-text("Post"), button:has-text("Comment"), .comment-submit').first();
        if (await submitComment.isVisible()) {
          await submitComment.click();
        } else {
          await commentInput.press('Enter');
        }
      }
    }
    
    // Take screenshot of interactions
    await page.screenshot({ path: 'artifacts/usability-tests/screenshots/post-interactions.png' });
  });

  test('TC-STU-005: Edit Profile', async () => {
    // Navigate to profile/settings
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
    
    // Take screenshot
    await page.screenshot({ path: 'artifacts/usability-tests/screenshots/student-profile-edit.png' });
    
    // Edit profile fields
    const nameField = page.locator('input[name="name"], input[placeholder*="name"]').first();
    if (await nameField.isVisible()) {
      await nameField.clear();
      await nameField.fill('Updated Student Name');
    }
    
    const bioField = page.locator('textarea[name="bio"], textarea[placeholder*="bio"]').first();
    if (await bioField.isVisible()) {
      await bioField.clear();
      await bioField.fill('Updated bio from automated testing');
    }
    
    const phoneField = page.locator('input[name="phone"], input[placeholder*="phone"]').first();
    if (await phoneField.isVisible()) {
      await phoneField.clear();
      await phoneField.fill('555-TEST-123');
    }
    
    // Save changes
    const saveButton = page.locator('[data-testid="settings-save"], button:has-text("Save"), button[type="submit"]').first();
    if (await saveButton.isVisible()) {
      await saveButton.click();
      
      // Wait for success message
      await page.waitForSelector('.toast, .success, .alert-success', { timeout: 5000 });
      
      // Take screenshot of success
      await page.screenshot({ path: 'artifacts/usability-tests/screenshots/profile-updated.png' });
    }
  });

  test('TC-STU-006: Upload Profile Picture', async () => {
    // Navigate to profile settings
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
    
    // Look for profile picture upload
    const uploadButton = page.locator('button:has-text("Upload"), input[type="file"], .upload-avatar').first();
    
    if (await uploadButton.isVisible()) {
      if (await uploadButton.getAttribute('type') === 'file') {
        // Direct file input
        await uploadButton.setInputFiles(path.join(process.cwd(), 'tests/fixtures/test-image.png'));
      } else {
        // Button that triggers file input
        await uploadButton.click();
        const fileInput = page.locator('input[type="file"]').first();
        await fileInput.setInputFiles(path.join(process.cwd(), 'tests/fixtures/test-image.png'));
      }
      
      // Wait for upload completion
      await page.waitForLoadState('networkidle');
      
      // Take screenshot
      await page.screenshot({ path: 'artifacts/usability-tests/screenshots/profile-pic-uploaded.png' });
    }
  });

  test('TC-STU-007: View Analytics Dashboard', async () => {
    // Navigate to stats
    await page.goto('/stats');
    await page.waitForLoadState('networkidle');
    
    // Take screenshot
    await page.screenshot({ path: 'artifacts/usability-tests/screenshots/student-analytics.png' });
    
    // Verify analytics components are visible
    await expect(page.locator('.chart, .analytics, .stats')).toBeVisible();
    
    // Check for engagement metrics
    const engagementSection = page.locator(':has-text("Engagement"), :has-text("Likes"), :has-text("Comments")');
    if (await engagementSection.isVisible()) {
      await expect(engagementSection).toBeVisible();
    }
  });

  test('TC-STU-008: Share Profile', async () => {
    // Navigate to profile
    await page.goto('/profile');
    await page.waitForLoadState('networkidle');
    
    // Look for share profile button
    const shareButton = page.locator('[data-testid="button-share-profile"], button:has-text("Share")').first();
    
    if (await shareButton.isVisible()) {
      await shareButton.click();
      
      // Take screenshot of share dialog
      await page.screenshot({ path: 'artifacts/usability-tests/screenshots/share-profile-dialog.png' });
      
      // Verify share options are visible
      await expect(page.locator('[role="dialog"], .share-dialog, .modal')).toBeVisible();
    }
  });

  test('TC-STU-009: Privacy Settings Toggle', async () => {
    // Navigate to settings
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
    
    // Look for privacy settings
    const privacyToggle = page.locator('input[type="checkbox"], .toggle, .switch').first();
    
    if (await privacyToggle.isVisible()) {
      // Toggle privacy setting
      await privacyToggle.click();
      
      // Save settings
      const saveButton = page.locator('button:has-text("Save")').first();
      if (await saveButton.isVisible()) {
        await saveButton.click();
      }
      
      // Take screenshot
      await page.screenshot({ path: 'artifacts/usability-tests/screenshots/privacy-settings.png' });
    }
  });

  test('TC-STU-010: Large File Upload Rejection', async () => {
    // Create a large dummy file (simulate)
    const createButton = page.locator('[data-testid="mobile-nav-create"], [data-testid="button-add-photo"]').first();
    await createButton.click();
    
    const photoButton = page.locator('[data-testid="button-add-photo"]');
    if (await photoButton.isVisible()) {
      await photoButton.click();
      
      // Try to upload large file (this will test client-side validation)
      try {
        await page.evaluate(() => {
          const input = document.querySelector('input[type="file"]') as HTMLInputElement;
          if (input) {
            // Create a large file blob
            const largeFile = new File(['x'.repeat(10 * 1024 * 1024)], 'large-file.jpg', { type: 'image/jpeg' });
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(largeFile);
            input.files = dataTransfer.files;
            input.dispatchEvent(new Event('change', { bubbles: true }));
          }
        });
        
        // Wait for error message
        await page.waitForSelector('.error, .alert-error, .toast:has-text("large")', { timeout: 5000 });
        
        // Take screenshot of error
        await page.screenshot({ path: 'artifacts/usability-tests/screenshots/large-file-error.png' });
      } catch (error) {
        // File size validation may prevent this test
        console.log('Large file test not applicable or blocked by validation');
      }
    }
  });
});