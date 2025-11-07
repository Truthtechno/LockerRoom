# System Admin Profile Update Fix - Verification

## Issue Summary
System admin profile picture upload was failing with "System admin profile not found" error.

## Root Causes Identified

1. **System admin creation bug**: System admins were being created in the `admins` table instead of the `system_admins` table
2. **Stale JWT tokens**: JWT tokens may contain outdated userIds that don't match the database
3. **Missing system_admins records**: Some system admin accounts were created without corresponding `system_admins` table records

## Fixes Implemented

### 1. Fixed System Admin Creation (`server/routes/admin.ts`)
- ✅ System admins now correctly create records in `system_admins` table
- ✅ Scout admins/xen scouts continue using `admins` table
- ✅ Proper email validation before creation

### 2. Added Automatic Recovery (`server/auth-storage.ts`)
- ✅ Detects when `system_admins` record is missing
- ✅ Automatically creates missing `system_admins` record
- ✅ Fixes incorrect `linkedId` references (self-referential or pointing to wrong table)
- ✅ Updates user's `linkedId` to point to correct record

### 3. Added JWT Fallback (`server/routes/system-admin.ts`)
- ✅ Verifies userId from JWT exists in database
- ✅ Falls back to email lookup if userId is stale/invalid
- ✅ Uses database-linkedId instead of JWT-linkedId (more reliable)
- ✅ Better error messages suggesting re-login

### 4. Improved Client-Side Error Handling (`client/src/hooks/useProfileMedia.ts`)
- ✅ Uses `apiRequest` utility for reliable token handling
- ✅ Better error messages for token expiration
- ✅ Suggests re-login when session issues detected
- ✅ Retry logic for transient failures

## Test Results

### Test 1: Database Verification
```
✅ User found in database
✅ System admin record exists
✅ Proper linkedId relationship
```

### Test 2: Profile Update Function
```
✅ Profile update successful
✅ Database verified - profile picture updated correctly
```

### Test 3: End-to-End Test
```
✅ ALL TESTS PASSED!
- User lookup: ✅
- System admin record verification: ✅
- Profile update: ✅
- Database verification: ✅
```

## Current User Account Status

**Email**: brayamooti@gmail.com
**UserId**: 7ac0b30f-1a4f-4d1c-b5b8-b9d62c4b3de8
**LinkedId**: 0f801d94-1da3-4070-ada6-b5c623338bbe
**Status**: ✅ Properly configured with system_admins record

## Next Steps for User

1. **Log out and log back in** to get a fresh JWT token with correct userId
2. Try uploading profile picture again
3. If still failing, check server logs for detailed error messages

## Verification Commands

```bash
# Test user lookup
npx tsx scripts/find-system-admin-by-email.ts brayamooti@gmail.com

# Test profile update
npx tsx scripts/test-profile-update.ts brayamooti@gmail.com

# Full end-to-end test
npx tsx scripts/test-system-admin-profile-end-to-end.ts brayamooti@gmail.com
```

## Expected Behavior

1. User uploads profile picture
2. Image is uploaded to Cloudinary
3. System looks up user (by userId or email fallback)
4. Verifies system_admins record exists (creates if missing)
5. Updates system_admins table with new profilePicUrl
6. Returns success response
7. UI refreshes with new profile picture

## Error Handling

- **Stale JWT token**: Falls back to email lookup, suggests re-login
- **Missing system_admins record**: Automatically creates one
- **Wrong linkedId**: Automatically fixes and updates
- **Network errors**: Retries up to 2 times
- **Auth errors**: Clear message to re-login

