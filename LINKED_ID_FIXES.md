# Database Column Naming Fixes: linked_id vs linkedId

## Problem Summary

There was a critical mismatch between database column naming and backend expectations that was breaking profile picture uploads for viewers:

1. **Database Schema**: The `users` table has a column named `linked_id` (snake_case)
2. **Backend Code**: Was using `linkedId` (camelCase) in Drizzle ORM queries
3. **Result**: Profile picture uploads failed with "Profile record not found" error

## Root Cause

In the schema definition:
```typescript
export const users = pgTable("users", {
  // ...
  linkedId: varchar("linked_id").notNull(), // TypeScript property vs DB column name
  // ...
});
```

The TypeScript property `linkedId` maps to the database column `linked_id`, but the backend code was inconsistently handling this mapping.

## Fixes Applied

### 1. **Backend Routes (`server/routes.ts`)**

#### Fixed `/api/users/me` endpoint:
- ✅ Added comprehensive logging for debugging
- ✅ Added validation for `userId` before querying
- ✅ Fixed profile picture retrieval queries for all roles
- ✅ Enhanced error handling with proper error codes

#### Fixed `/api/profile/picture` endpoint:
- ✅ Added comprehensive logging showing `userId`, `userRole`, `linkedId`
- ✅ Fixed database update queries for all roles:
  - **Viewer**: `UPDATE viewers SET profile_pic_url = ? WHERE id = users.linked_id`
  - **Student**: `UPDATE students SET profile_pic_url = ? WHERE user_id = users.id`
  - **School Admin**: `UPDATE school_admins SET profile_pic_url = ? WHERE id = users.linked_id`
  - **System Admin**: `UPDATE system_admins SET profile_pic_url = ? WHERE id = users.linked_id`

### 2. **Auth Middleware (`server/middleware/auth.ts`)**

- ✅ Already correctly normalizing both `linkedId` and `linked_id` to `linkedId`
- ✅ Added comprehensive logging for token validation

### 3. **Storage Functions (`server/storage.ts`)**

- ✅ Added comments clarifying column mapping
- ✅ Fixed `updateUserSchoolLink` function

### 4. **Auth Storage (`server/auth-storage.ts`)**

- ✅ Added comments clarifying column mapping in all queries
- ✅ Fixed `getUserProfile` function for all roles
- ✅ Fixed user creation and verification functions

## Database Query Logic

### For Viewers:
```sql
-- Get profile picture
SELECT profile_pic_url FROM viewers WHERE id = users.linked_id;

-- Update profile picture  
UPDATE viewers SET profile_pic_url = ? WHERE id = users.linked_id;
```

### For Students:
```sql
-- Get profile picture
SELECT profile_pic_url FROM students WHERE user_id = users.id;

-- Update profile picture
UPDATE students SET profile_pic_url = ? WHERE user_id = users.id;
```

### For School/System Admins:
```sql
-- Get profile picture
SELECT profile_pic_url FROM school_admins WHERE id = users.linked_id;

-- Update profile picture
UPDATE school_admins SET profile_pic_url = ? WHERE id = users.linked_id;
```

## Console Logs Added

### Backend Logs:
- `🔍 /api/users/me - Auth object:` - Shows auth details and token length
- `🔍 /api/users/me - Database query result:` - Shows query results
- `📸 Profile picture upload:` - Shows upload details including linkedId
- `🔄 Updating viewers table:` - Shows exact table and row being updated
- `📸 Profile picture update successful:` - Confirms database update

### Frontend Logs:
- `📤 Uploading profile picture:` - Shows upload details including token length
- `📥 Upload response:` - Shows response details

## Testing

Created `test-viewer-profile-upload.js` to verify the complete flow:
1. Login with viewer@lockerroom.com
2. Fetch user data from `/api/users/me` → confirm it returns `linkedId`
3. Upload profile picture → confirm it updates `viewers.profile_pic_url` correctly
4. Verify the upload by fetching user data again

## Key Changes Made

### Files Modified:
1. `server/routes.ts` - Fixed database queries and added comprehensive logging
2. `server/storage.ts` - Added clarifying comments
3. `server/auth-storage.ts` - Added clarifying comments
4. `test-viewer-profile-upload.js` - Created test script

### Database Schema Understanding:
- `users.linkedId` (TypeScript) → `users.linked_id` (database column)
- For viewers: `users.linked_id` = `viewers.id`
- For students: `users.linked_id` = `students.id` AND `students.user_id` = `users.id`
- For admins: `users.linked_id` = `school_admins.id` or `system_admins.id`

## Expected Results

After these fixes:
1. ✅ `/api/users/me` should return `linkedId` for all user types
2. ✅ Profile picture uploads should work for all roles
3. ✅ Database updates should target the correct tables and rows
4. ✅ Console logs should show detailed debugging information

## Next Steps

1. Run the test script to verify all fixes work
2. Test with different user roles (student, school_admin, system_admin)
3. Monitor console logs for any remaining issues
4. Consider adding more comprehensive error handling
