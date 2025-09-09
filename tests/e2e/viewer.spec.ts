import { test, expect, Page } from '@playwright/test';

test.describe('Viewer Portal', () => {
  let page: Page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    
    // Login as viewer
    await page.goto('/login');
    await page.fill('[data-testid="input-email"]', 'viewer@lockerroom.com');
    await page.fill('[data-testid="input-password"]', 'Viewer123!');
    await page.click('[data-testid="button-login"]');
    
    // Wait for redirect to feed
    await page.waitForURL('/feed');
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('TC-VIE-001: Viewer Login and Feed Access', async () => {
    // Verify feed loads
    await expect(page).toHaveURL('/feed');
    await expect(page.locator('main, .feed')).toBeVisible();
    
    // Take screenshot
    await page.screenshot({ path: 'artifacts/usability-tests/screenshots/viewer-feed.png' });
    
    // Verify viewer navigation (no Stats tab)
    await expect(page.locator('[data-testid="mobile-nav-feed"]')).toBeVisible();
    await expect(page.locator('[data-testid="mobile-nav-search"]')).toBeVisible();
    await expect(page.locator('[data-testid="mobile-nav-saved"]')).toBeVisible();
    await expect(page.locator('[data-testid="mobile-nav-following"]')).toBeVisible();
    
    // Verify Stats tab is NOT visible for viewers
    await expect(page.locator('[data-testid="mobile-nav-stats"]')).not.toBeVisible();
  });

  test('TC-VIE-002: Search Students', async () => {
    // Navigate to search
    await page.click('[data-testid="mobile-nav-search"]');
    await page.waitForURL('/search');
    
    // Take screenshot
    await page.screenshot({ path: 'artifacts/usability-tests/screenshots/viewer-search.png' });
    
    // Search for students
    const searchInput = page.locator('[data-testid="search-input"]');
    await expect(searchInput).toBeVisible();
    await searchInput.fill('Diego');
    
    // Wait for search results
    await page.waitForLoadState('networkidle');
    
    // Take screenshot of search results
    await page.screenshot({ path: 'artifacts/usability-tests/screenshots/search-results.png' });
    
    // Verify search results appear
    await expect(page.locator('.search-results, .student-card, .result')).toBeVisible();
  });

  test('TC-VIE-003: Follow and Unfollow Students', async () => {
    // Navigate to search
    await page.click('[data-testid="mobile-nav-search"]');
    await page.waitForURL('/search');
    
    // Search for a student
    await page.fill('[data-testid="search-input"]', 'Rodriguez');
    await page.waitForLoadState('networkidle');
    
    // Find and click follow button
    const followButton = page.locator('button:has-text("Follow"), [data-testid*="follow"]').first();
    
    if (await followButton.isVisible()) {
      // Follow the student
      await followButton.click();
      await page.waitForLoadState('networkidle');
      
      // Take screenshot of follow action
      await page.screenshot({ path: 'artifacts/usability-tests/screenshots/follow-action.png' });
      
      // Verify button text changed to "Following" or "Unfollow"
      await expect(page.locator('button:has-text("Following"), button:has-text("Unfollow")')).toBeVisible();
      
      // Unfollow the student
      const unfollowButton = page.locator('button:has-text("Following"), button:has-text("Unfollow")').first();
      await unfollowButton.click();
      await page.waitForLoadState('networkidle');
      
      // Take screenshot of unfollow action
      await page.screenshot({ path: 'artifacts/usability-tests/screenshots/unfollow-action.png' });
      
      // Verify button text changed back to "Follow"
      await expect(page.locator('button:has-text("Follow")')).toBeVisible();
    }
  });

  test('TC-VIE-004: Comment on Posts', async () => {
    // Go to feed
    await page.goto('/feed');
    await page.waitForLoadState('networkidle');
    
    // Find first post
    const firstPost = page.locator('.post, [data-testid*="post-"], .post-card').first();
    await expect(firstPost).toBeVisible();
    
    // Find comment button
    const commentButton = page.locator('button:has([data-icon="message"]), .comment-button, [data-testid*="comment"]').first();
    
    if (await commentButton.isVisible()) {
      await commentButton.click();
      
      // Add comment
      const commentInput = page.locator('input[placeholder*="comment"], textarea[placeholder*="comment"], .comment-input input, .comment-input textarea').first();
      if (await commentInput.isVisible()) {
        await commentInput.fill('Great post from a viewer! 👀');
        
        // Submit comment
        const submitComment = page.locator('button:has-text("Post"), button:has-text("Comment"), .comment-submit').first();
        if (await submitComment.isVisible()) {
          await submitComment.click();
        } else {
          await commentInput.press('Enter');
        }
        
        // Wait for comment to appear
        await page.waitForLoadState('networkidle');
        
        // Take screenshot
        await page.screenshot({ path: 'artifacts/usability-tests/screenshots/viewer-comment.png' });
        
        // Verify comment appears
        await expect(page.locator(':has-text("Great post from a viewer")')).toBeVisible();
      }
    }
  });

  test('TC-VIE-005: Save and Unsave Posts', async () => {
    // Go to feed
    await page.goto('/feed');
    await page.waitForLoadState('networkidle');
    
    // Find first post
    const firstPost = page.locator('.post, [data-testid*="post-"], .post-card').first();
    await expect(firstPost).toBeVisible();
    
    // Find save button
    const saveButton = page.locator('button:has([data-icon="bookmark"]), .save-button, [data-testid*="save"]').first();
    
    if (await saveButton.isVisible()) {
      // Save the post
      await saveButton.click();
      await page.waitForLoadState('networkidle');
      
      // Take screenshot
      await page.screenshot({ path: 'artifacts/usability-tests/screenshots/save-post.png' });
      
      // Navigate to saved posts
      await page.click('[data-testid="mobile-nav-saved"]');
      await page.waitForURL('/saved');
      
      // Take screenshot of saved posts page
      await page.screenshot({ path: 'artifacts/usability-tests/screenshots/saved-posts-page.png' });
      
      // Verify saved post appears
      await expect(page.locator('.post, .saved-post')).toBeVisible();
      
      // Unsave the post
      const unsaveButton = page.locator('button:has([data-icon="bookmark"]), .save-button, [data-testid*="save"]').first();
      if (await unsaveButton.isVisible()) {
        await unsaveButton.click();
        await page.waitForLoadState('networkidle');
        
        // Take screenshot after unsaving
        await page.screenshot({ path: 'artifacts/usability-tests/screenshots/unsave-post.png' });
      }
    }
  });

  test('TC-VIE-006: View Following List', async () => {
    // Navigate to following page
    await page.click('[data-testid="mobile-nav-following"]');
    await page.waitForURL('/following');
    
    // Take screenshot
    await page.screenshot({ path: 'artifacts/usability-tests/screenshots/following-page.png' });
    
    // Verify following list interface
    await expect(page.locator('main, .following-list')).toBeVisible();
    
    // If there are followed users, verify they appear
    const followedUsers = page.locator('.following-item, .user-card, .student-card');
    if (await followedUsers.count() > 0) {
      await expect(followedUsers.first()).toBeVisible();
      
      // Test unfollow from following page
      const unfollowButton = page.locator('button:has-text("Unfollow"), button:has-text("Following")').first();
      if (await unfollowButton.isVisible()) {
        await unfollowButton.click();
        await page.waitForLoadState('networkidle');
        
        // Take screenshot after unfollowing
        await page.screenshot({ path: 'artifacts/usability-tests/screenshots/unfollow-from-following-page.png' });
      }
    }
  });

  test('TC-VIE-007: Edit Viewer Profile and Settings', async () => {
    // Navigate to settings
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
    
    // Take screenshot
    await page.screenshot({ path: 'artifacts/usability-tests/screenshots/viewer-settings.png' });
    
    // Edit viewer profile
    const nameField = page.locator('input[name="name"], input[placeholder*="name"]').first();
    if (await nameField.isVisible()) {
      await nameField.clear();
      await nameField.fill('Updated Viewer Name');
    }
    
    const bioField = page.locator('textarea[name="bio"], textarea[placeholder*="bio"]').first();
    if (await bioField.isVisible()) {
      await bioField.clear();
      await bioField.fill('Updated viewer bio from automated testing');
    }
    
    // Save changes
    const saveButton = page.locator('button:has-text("Save"), button[type="submit"]').first();
    if (await saveButton.isVisible()) {
      await saveButton.click();
      
      // Wait for success message
      await page.waitForSelector('.toast, .success, .alert-success', { timeout: 5000 });
      
      // Take screenshot
      await page.screenshot({ path: 'artifacts/usability-tests/screenshots/viewer-profile-updated.png' });
    }
  });

  test('TC-VIE-008: Change Password', async () => {
    // Navigate to settings
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
    
    // Look for password change section
    const currentPasswordField = page.locator('input[name="currentPassword"], input[placeholder*="current"]').first();
    const newPasswordField = page.locator('input[name="newPassword"], input[placeholder*="new"]').first();
    const confirmPasswordField = page.locator('input[name="confirmPassword"], input[placeholder*="confirm"]').first();
    
    if (await currentPasswordField.isVisible()) {
      await currentPasswordField.fill('Viewer123!');
      await newPasswordField.fill('NewViewer123!');
      await confirmPasswordField.fill('NewViewer123!');
      
      // Submit password change
      const changePasswordButton = page.locator('button:has-text("Change Password"), button:has-text("Update Password")').first();
      if (await changePasswordButton.isVisible()) {
        await changePasswordButton.click();
        
        // Wait for success message
        await page.waitForSelector('.toast, .success, .alert-success', { timeout: 5000 });
        
        // Take screenshot
        await page.screenshot({ path: 'artifacts/usability-tests/screenshots/password-changed.png' });
      }
    }
  });

  test('TC-VIE-009: Notification Settings', async () => {
    // Navigate to settings
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
    
    // Look for notification settings toggles
    const notificationToggles = page.locator('input[type="checkbox"], .toggle, .switch');
    
    if (await notificationToggles.count() > 0) {
      // Toggle first notification setting
      await notificationToggles.first().click();
      
      // Save notification settings
      const saveButton = page.locator('button:has-text("Save Notifications"), button:has-text("Save")').first();
      if (await saveButton.isVisible()) {
        await saveButton.click();
      }
      
      // Take screenshot
      await page.screenshot({ path: 'artifacts/usability-tests/screenshots/notification-settings.png' });
    }
  });

  test('TC-VIE-010: Privacy Settings', async () => {
    // Navigate to settings
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
    
    // Look for privacy settings section
    const privacySection = page.locator(':has-text("Privacy"), .privacy-settings');
    
    if (await privacySection.isVisible()) {
      // Toggle privacy settings
      const privacyToggles = privacySection.locator('input[type="checkbox"], .toggle, .switch');
      
      if (await privacyToggles.count() > 0) {
        await privacyToggles.first().click();
        
        // Save privacy settings
        const saveButton = page.locator('button:has-text("Save Privacy"), button:has-text("Save")').first();
        if (await saveButton.isVisible()) {
          await saveButton.click();
        }
        
        // Take screenshot
        await page.screenshot({ path: 'artifacts/usability-tests/screenshots/privacy-settings.png' });
      }
    }
  });

  test('TC-VIE-011: No Stats Tab Verification', async () => {
    // Verify viewer cannot access stats
    await page.goto('/stats');
    
    // Should redirect or show access denied
    const currentUrl = page.url();
    if (currentUrl.includes('/stats')) {
      // If still on stats page, verify no content or error message
      const statsContent = page.locator('.chart, .analytics, .stats-content');
      await expect(statsContent).not.toBeVisible();
    } else {
      // Should have redirected away from stats
      expect(currentUrl).not.toContain('/stats');
    }
    
    // Take screenshot
    await page.screenshot({ path: 'artifacts/usability-tests/screenshots/viewer-no-stats.png' });
  });
});