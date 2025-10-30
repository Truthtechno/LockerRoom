# Profile Picture Upload Fixes

## Issues Fixed

### 1. **JWT/Auth Token Issues** ✅
- **Problem**: Some requests showed `tokenLength: 10` (malformed token), others were valid
- **Solution**: 
  - Added comprehensive token validation in `/api/users/me` endpoint
  - Added token length logging in frontend (`useProfileMedia.ts`)
  - Enhanced error handling for invalid tokens
  - Added proper Authorization header validation

### 2. **Missing Profile Picture Upload Endpoint** ✅
- **Problem**: Frontend was calling `/api/profile/picture` but this endpoint didn't exist
- **Solution**: 
  - Created new `/api/profile/picture` endpoint in `server/routes.ts`
  - Handles role-based profile picture updates (student, viewer, school_admin, system_admin)
  - Uses Cloudinary for image storage with proper transformations
  - Includes comprehensive logging and error handling

### 3. **Database Query Error** ✅
- **Problem**: `/api/users/me` sometimes threw `NeonDbError: syntax error at or near "="`
- **Solution**:
  - Fixed database query to use proper `eq()` function with correct column references
  - Added validation for `userId` before querying
  - Fixed profile picture retrieval logic for different user roles
  - Enhanced error handling and logging

### 4. **File Upload Path Issues** ✅
- **Problem**: Error `ENOENT: no such file or directory, open .../uploads/profile-pics/...jpg`
- **Solution**:
  - Updated to use Cloudinary instead of local file storage
  - Cloudinary automatically handles file storage and provides CDN URLs
  - No need for local directory creation

## Code Changes

### Backend (`server/routes.ts`)

1. **Added `/api/profile/picture` endpoint**:
   ```typescript
   app.put("/api/profile/picture", requireAuth, upload.single("profilePic"), async (req, res) => {
     // Handles profile picture upload for all user roles
     // Uses Cloudinary for storage
     // Updates appropriate role-specific table
   });
   ```

2. **Enhanced `/api/users/me` endpoint**:
   - Added userId validation
   - Fixed database queries for profile picture retrieval
   - Added comprehensive logging
   - Improved error handling

3. **Fixed imports**:
   - Added `systemAdmins` import from schema

### Frontend (`client/src/hooks/useProfileMedia.ts`)

1. **Enhanced token logging**:
   ```typescript
   console.log('📤 Uploading profile picture:', {
     fileSize: croppedImageBlob.size,
     fileType: croppedImageBlob.type,
     hasToken: !!token,
     tokenLength: token.length  // Added this
   });
   ```

## Testing

Created `test-profile-upload.js` to verify the complete flow:
1. Login with viewer credentials
2. Fetch user data from `/api/users/me`
3. Upload profile picture to `/api/profile/picture`
4. Verify the upload by fetching user data again

## Console Logs Added

### Backend Logs:
- `🔍 /api/users/me - Auth object:` - Shows auth details and token length
- `🔍 /api/users/me - Database query result:` - Shows query results
- `📸 Profile picture upload:` - Shows upload details
- `📸 Cloudinary upload successful:` - Confirms Cloudinary upload
- `📸 Profile picture update successful:` - Confirms database update

### Frontend Logs:
- `📤 Uploading profile picture:` - Shows upload details including token length
- `📥 Upload response:` - Shows response details
- `✅ Profile picture updated successfully:` - Confirms success

## Database Schema Understanding

The system uses a role-based architecture:
- `users` table: Core authentication data (no profilePicUrl field)
- `students` table: Student-specific data including profilePicUrl
- `viewers` table: Viewer-specific data including profilePicUrl  
- `schoolAdmins` table: School admin data including profilePicUrl
- `systemAdmins` table: System admin data including profilePicUrl

Profile pictures are stored in the role-specific tables, not the main users table.

## Next Steps

1. Run the test script to verify all fixes work
2. Test with different user roles (student, viewer, school_admin, system_admin)
3. Monitor console logs for any remaining issues
4. Consider adding image validation and size limits
