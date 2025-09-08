# LockerRoom Viewer Portal Testing Guide

## Overview

This document provides comprehensive testing instructions for the LockerRoom Viewer Portal, which allows non-student users to engage with the platform by viewing, commenting on, and following student athlete content.

## Key Features Implemented

### 1. Account Creation & Authentication
- **Create Account Option**: Viewers can register directly from the login page
- **Role-Based Access**: Automatic assignment of "viewer" role during registration
- **Secure Login**: Email and password authentication system

### 2. Social Interaction Features
- **Commenting System**: Viewers can comment on student posts with real-time display
- **Follow/Unfollow System**: Follow student athletes with visual feedback
- **Search Functionality**: Search for students by name with follow buttons
- **Saved Posts**: Bookmark posts for later viewing

### 3. Dedicated Portal Pages
- **Feed Page**: View all student posts with interaction capabilities
- **Saved Posts Page**: Access bookmarked content
- **Following Page**: Manage followed student athletes
- **Settings Page**: Personalized profile and notification management

### 4. Role-Specific Navigation
- **Sidebar Navigation**: Custom tabs for viewers (Feed, Saved, Following, Settings)
- **Mobile Navigation**: Responsive navigation optimized for mobile devices
- **No Student Features**: Stats and Create post options hidden from viewers

## Testing Instructions

### Pre-Testing Setup

1. **Start the Application**
   ```bash
   npm run dev
   ```

2. **Access the Application**
   - Navigate to `http://localhost:5000`
   - Ensure the database is running and populated with sample data

### Test Case 1: Account Creation

**Objective**: Verify viewers can create accounts and access the platform

**Steps**:
1. Navigate to the login page
2. Click "Create Account" link
3. Fill in registration form:
   - **Name**: John Viewer
   - **Email**: john.viewer@example.com
   - **Password**: password123
   - **Role**: Viewer (should be default)
4. Submit the form
5. Verify automatic login and redirect to feed

**Expected Results**:
- Account created successfully
- User logged in automatically
- Redirected to feed page
- Navigation shows viewer-specific tabs

### Test Case 2: Feed Interaction

**Objective**: Test viewing and interacting with student posts

**Steps**:
1. Log in as a viewer
2. Navigate to Feed page
3. Scroll through available posts
4. Test post interactions:
   - Click heart icon to like/unlike posts
   - Click bookmark icon to save/unsave posts
   - Click comment icon to view comments
   - Add a comment to a post
5. Verify all interactions work correctly

**Expected Results**:
- Posts display correctly with student information
- Like/unlike functionality works with visual feedback
- Save/unsave functionality works with visual feedback
- Comments display in real-time
- New comments appear immediately

### Test Case 3: Search and Follow System

**Objective**: Verify student search and follow functionality

**Steps**:
1. From the Feed page, use the search bar
2. Search for student names (e.g., "Alex")
3. Review search results
4. Click "Follow" button on a student
5. Verify follow status changes to "Following"
6. Click "Following" button to unfollow
7. Navigate to Following page
8. Verify followed students appear in the list

**Expected Results**:
- Search returns relevant student results
- Follow/unfollow buttons work correctly
- Follow status persists across page refreshes
- Following page shows accurate list
- Follow counts update correctly

### Test Case 4: Saved Posts Management

**Objective**: Test saved posts functionality

**Steps**:
1. From the Feed, save multiple posts using bookmark icon
2. Navigate to "Saved" tab
3. Verify saved posts appear
4. Test unsaving posts from the Saved page
5. Return to Feed and verify bookmark status updated

**Expected Results**:
- Saved posts appear in Saved tab
- Posts display with full details
- Unsave functionality works from Saved page
- Bookmark icons reflect correct state in Feed

### Test Case 5: Following Page Management

**Objective**: Test following list and management

**Steps**:
1. Follow multiple students from Feed or Search
2. Navigate to "Following" tab
3. Review the list of followed students
4. Click "Unfollow" button on a student
5. Verify student removed from list
6. Check follower counts update correctly

**Expected Results**:
- All followed students display with details
- Student information shows correctly (name, sport, position, school)
- Unfollow functionality works
- List updates immediately after unfollowing
- Follower counts decrease appropriately

### Test Case 6: Settings and Profile Management

**Objective**: Test viewer-specific settings functionality

**Steps**:
1. Navigate to Settings page
2. Update profile information:
   - Change name
   - Add/edit bio
   - Update phone number
3. Adjust notification settings:
   - Toggle student activity notifications
   - Toggle comment reply notifications
   - Toggle academy update notifications
4. Modify privacy settings:
   - Change profile visibility
   - Toggle contact information display
   - Toggle direct message permissions
5. Save all changes

**Expected Results**:
- Profile updates save successfully
- Notification preferences persist
- Privacy settings apply correctly
- Settings interface shows viewer-appropriate options only
- No student-specific settings (like jersey number) appear

### Test Case 7: Navigation and Role Restrictions

**Objective**: Verify role-based navigation and access restrictions

**Steps**:
1. Log in as a viewer
2. Check sidebar navigation tabs
3. Check mobile navigation tabs
4. Attempt to access student-only features
5. Verify proper redirects and restrictions

**Expected Results**:
- Sidebar shows: Feed, Saved, Following, Settings
- Mobile navigation shows: Feed, Search, Saved, Following
- No "Create Post" or "Stats" options for viewers
- No "Profile" tab for viewers
- Appropriate role badge displays in Settings

### Test Case 8: Responsive Design

**Objective**: Test mobile and responsive functionality

**Steps**:
1. Test on desktop (1920x1080)
2. Test on tablet (768x1024)
3. Test on mobile (375x667)
4. Verify all features work across devices
5. Check navigation adapts correctly

**Expected Results**:
- Interface adapts to all screen sizes
- Mobile navigation functions properly
- Touch interactions work on mobile
- Text remains readable at all sizes
- Images and cards scale appropriately

### Test Case 9: Cross-Role Interaction

**Objective**: Test interactions between viewers and students

**Steps**:
1. Have a student post content
2. Log in as viewer and interact with the post
3. Verify student can see viewer comments
4. Test follow notifications (if implemented)
5. Check privacy settings respect

**Expected Results**:
- Viewer comments visible to students
- Follow actions reflect in student follower counts
- Privacy settings properly enforced
- No unauthorized access to student features

### Test Case 10: Data Persistence

**Objective**: Verify data persistence across sessions

**Steps**:
1. As viewer, follow students and save posts
2. Log out completely
3. Log back in
4. Verify all data persists:
   - Followed students remain followed
   - Saved posts remain saved
   - Settings remain as configured

**Expected Results**:
- All user data persists correctly
- No data loss between sessions
- State remains consistent
- Database properly stores viewer data

## Performance Testing

### Load Testing
- Test with multiple viewers simultaneously
- Verify comment loading with many comments
- Test search performance with large student database

### Navigation Testing
- Verify smooth transitions between pages
- Test back/forward browser navigation
- Ensure no broken links or dead ends

## Accessibility Testing

### Screen Reader Testing
- Test with screen reader software
- Verify all interactive elements have proper labels
- Check ARIA attributes are correctly implemented

### Keyboard Navigation
- Test full functionality using only keyboard
- Verify tab order is logical
- Ensure all interactive elements are reachable

## Security Testing

### Authentication Testing
- Verify viewers cannot access admin features
- Test session management and timeout
- Verify proper role-based restrictions

### Data Validation
- Test form validation with invalid inputs
- Verify XSS protection in comments
- Test SQL injection prevention

## Browser Compatibility

Test the viewer portal on:
- **Chrome** (latest)
- **Firefox** (latest)
- **Safari** (latest)
- **Edge** (latest)
- **Mobile browsers** (iOS Safari, Android Chrome)

## Known Issues and Limitations

### Current Limitations
- Direct messaging not implemented
- Real-time notifications require page refresh
- Advanced search filters not available

### Future Enhancements
- Push notifications for mobile
- Advanced search and filtering
- Direct messaging system
- Enhanced privacy controls

## Test Data Requirements

### Sample Viewer Accounts
```
Email: viewer1@example.com | Password: password123
Email: viewer2@example.com | Password: password123
Email: viewer3@example.com | Password: password123
```

### Sample Student Accounts
```
Students should have posts, various sports, and different schools
Ensure follower counts and engagement data exist
```

## Conclusion

The LockerRoom Viewer Portal provides a comprehensive platform for non-student users to engage with student athlete content. All core features have been implemented with proper role-based access controls and responsive design.

For issues or questions regarding testing, please contact the development team.

---

**Last Updated**: September 2025  
**Version**: 1.0  
**Status**: Ready for Production Testing