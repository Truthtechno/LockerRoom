# Xen Scout Profile Picture Upload Fix

## Issue
Profile picture upload feature for Xen Scouts was failing with error: "Profile picture upload failed - Invalid response from server - please try again"

## Root Cause
The `xen_scout` role was not properly handled in the profile picture upload flow:

1. **Frontend (`useProfileMedia.ts`)**: Only checked for `scout_admin` and `system_admin` roles, but not `xen_scout`
2. **Backend (`/api/admins/me`)**: Only allowed `scout_admin` and `system_admin` roles, excluding `xen_scout`
3. **Backend (`/api/profile/picture`)**: Did not handle scout roles (`scout_admin` and `xen_scout`)

## Fixes Applied

### 1. Frontend Fix - `client/src/hooks/useProfileMedia.ts`
**Changed**: Added `xen_scout` to the role check for admin profile updates

```typescript
// Before:
} else if (user?.role === 'scout_admin' || user?.role === 'system_admin') {
  await putAdminMe({ profilePicUrl: url });

// After:
} else if (user?.role === 'scout_admin' || user?.role === 'xen_scout' || user?.role === 'system_admin') {
  await putAdminMe({ profilePicUrl: url });
```

### 2. Backend Fix - `server/routes.ts` - `/api/admins/me` endpoint
**Changed**: 
- Allowed `xen_scout` role to access the endpoint
- Added explicit handling for `scout_admin` and `xen_scout` roles
- Updated error messages to be more descriptive

```typescript
// Before:
if (userRole !== 'scout_admin' && userRole !== 'system_admin') {
  return res.status(403).json({ 
    error: { 
      code: "unauthorized_role", 
      message: "Only scout admins and system admins can update their profiles" 
    } 
  });
}

// After:
if (userRole !== 'scout_admin' && userRole !== 'xen_scout' && userRole !== 'system_admin') {
  return res.status(403).json({ 
    error: { 
      code: "unauthorized_role", 
      message: "Only scout admins, xen scouts, and system admins can update their profiles" 
    } 
  });
}
```

Also added explicit handling:
```typescript
} else if (userRole === 'scout_admin' || userRole === 'xen_scout') {
  // For scout admins and xen scouts: update admins table
  console.log('🔄 Updating admins table for scout:', { linkedId, profilePicUrl, role: userRole });
  updatedAdmin = await db.update(admins)
    .set(updates)
    .where(eq(admins.id, linkedId))
    .returning();
  // ... rest of logic
}
```

### 3. Backend Fix - `server/routes/profile.ts` - `/api/profile/picture` endpoint
**Changed**:
- Added `admins` table import
- Added handling for `scout_admin` and `xen_scout` roles
- Updated TypeScript types to include scout roles

```typescript
// Added import:
import { students, viewers, schoolAdmins, systemAdmins, admins } from '@shared/schema';

// Added role handling:
} else if (role === 'scout_admin' || role === 'xen_scout') {
  // For scouts: users.linked_id = admins.id
  if (!linkedId) {
    console.log('❌ No linkedId for scout:', role);
    return res.status(404).json({ error: 'Scout profile not found' });
  }
  console.log('🔄 Updating admins table for scout:', { linkedId, url, role });
  updateResult = await db.update(admins)
    .set({ profilePicUrl: url })
    .where(eq(admins.id, linkedId));
}
```

## Testing

A comprehensive test script has been created: `test-xen-scout-profile-upload.js`

This script tests:
1. ✅ Login as Xen Scout
2. ✅ Fetch user data from `/api/users/me` and verify `linkedId` is present
3. ✅ Test `/api/admins/me` endpoint access
4. ✅ Test profile picture update via `/api/admins/me` (PUT)
5. ✅ Verify upload by fetching user data again
6. ✅ Test direct file upload via `/api/profile/picture` (PUT)

## Files Modified

1. `client/src/hooks/useProfileMedia.ts` - Added `xen_scout` role support
2. `server/routes.ts` - Updated `/api/admins/me` to allow and handle `xen_scout`
3. `server/routes/profile.ts` - Added scout role handling to `/api/profile/picture`

## Files Created

1. `test-xen-scout-profile-upload.js` - Comprehensive test script
2. `XEN_SCOUT_PROFILE_UPLOAD_FIX.md` - This documentation

## Verification Steps

1. Start the development server
2. Login as a Xen Scout user (e.g., `brian@scout.com` or `scout123@xen.com`)
3. Navigate to Account Settings
4. Attempt to upload a profile picture
5. Verify the upload succeeds without errors
6. Run the test script: `node test-xen-scout-profile-upload.js`

## Expected Behavior After Fix

- Xen Scouts can now upload profile pictures successfully
- The upload flow works through the Cloudinary upload (frontend) → `/api/admins/me` (backend) path
- Direct file uploads via `/api/profile/picture` also work for scout roles
- Profile picture URLs are correctly stored in the `admins` table
- User profile is updated with the new profile picture URL
