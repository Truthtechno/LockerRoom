# Auth Middleware linkedId Fix

## Problem Summary

The profile picture upload flow was failing with "Profile record not found" because:

1. **Auth Middleware Issue**: The `requireAuth` middleware was not fetching the `linked_id` column from the database after JWT verification
2. **Missing linkedId**: `req.user.linkedId` was always undefined, causing profile picture handler to fail
3. **Database Query Failure**: Profile picture updates couldn't find the correct records to update

## Root Cause

The auth middleware was only using JWT payload data and not fetching fresh user data from the database, so the `linkedId` field (which maps to `linked_id` column) was never populated in `req.user`.

## Fixes Applied

### 1. **Updated Auth Middleware (`server/middleware/auth.ts`)**

#### Added Database Import:
```typescript
import { db } from '../db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';
```

#### Updated `requireAuth` Function:
- ✅ Made function `async` to support database queries
- ✅ Added database query to fetch user data after JWT verification
- ✅ Populated `req.user.linkedId` with `dbUser.linkedId` (maps to `linked_id` column)
- ✅ Added comprehensive logging for debugging

#### Key Changes:
```typescript
// Fetch user data from database to get linked_id
const [dbUser] = await db.select({
  id: users.id,
  email: users.email,
  role: users.role,
  schoolId: users.schoolId,
  linkedId: users.linkedId // This maps to linked_id column
})
.from(users)
.where(eq(users.id, payload.id));

// Create normalized payload with database data
const normalizedPayload = {
  id: dbUser.id,
  email: dbUser.email,
  role: dbUser.role,
  schoolId: dbUser.schoolId,
  linkedId: dbUser.linkedId // This is the linked_id from database
};
```

### 2. **Enhanced Profile Picture Handler (`server/routes.ts`)**

#### Added Validation:
- ✅ Validate `linkedId` is available before processing
- ✅ Return clear error if `linkedId` is missing

#### Enhanced Logging:
- ✅ Log `req.user` object with `linkedId` availability
- ✅ Log exact database update queries being executed
- ✅ Log whether rows were updated successfully

#### Key Changes:
```typescript
// Validate linkedId is available
if (!linkedId) {
  console.error('❌ linkedId is missing from req.user:', auth);
  return res.status(400).json({ 
    success: false,
    error: { 
      code: "missing_linked_id", 
      message: "User linked ID not found" 
    } 
  });
}

// Log the exact query being executed
updateQuery = `UPDATE viewers SET profile_pic_url = ? WHERE id = ?`;
console.log('🔄 Updating viewers table:', { linkedId, profilePicUrl, query: updateQuery });
```

### 3. **Verified `/api/users/me` Endpoint**

- ✅ Already includes `linkedId` in response (aliasing `linked_id` as `linkedId`)
- ✅ No changes needed - endpoint was already correct

## Database Query Logic

### For Viewers:
```sql
-- Auth middleware fetches: SELECT linked_id FROM users WHERE id = ?
-- Profile picture update: UPDATE viewers SET profile_pic_url = ? WHERE id = users.linked_id
```

### For Students:
```sql
-- Auth middleware fetches: SELECT linked_id FROM users WHERE id = ?
-- Profile picture update: UPDATE students SET profile_pic_url = ? WHERE user_id = users.id
```

### For School/System Admins:
```sql
-- Auth middleware fetches: SELECT linked_id FROM users WHERE id = ?
-- Profile picture update: UPDATE school_admins SET profile_pic_url = ? WHERE id = users.linked_id
```

## Console Logs Added

### Auth Middleware Logs:
- `🔐 Auth middleware:` - Shows token validation details
- `🔐 JWT payload:` - Shows JWT payload contents
- `🔐 Database user:` - Shows user data fetched from database
- `🔐 Final normalized payload:` - Shows final req.user object with linkedId

### Profile Picture Handler Logs:
- `📸 Profile picture upload - req.user object:` - Shows req.user with linkedId availability
- `🔄 Updating viewers table:` - Shows exact database update query
- `📸 Profile picture update successful:` - Confirms successful update

## Testing

Created `test-linkedid-fix.js` to verify the complete flow:
1. Login with viewer@lockerroom.com
2. Test `/api/users/me` → confirm it returns `linkedId`
3. Upload profile picture → confirm it updates `viewers` table correctly
4. Verify the upload by fetching user data again

## Expected Results

After these fixes:
1. ✅ Auth middleware fetches `linked_id` from database and populates `req.user.linkedId`
2. ✅ `/api/users/me` returns `{ id, email, role, linkedId }` with correct linkedId
3. ✅ Profile picture uploads work for all roles (viewer, student, school_admin, system_admin)
4. ✅ Database updates target the correct tables and rows
5. ✅ No more "Profile record not found" errors
6. ✅ Comprehensive logging shows exactly what's happening

## Key Benefits

1. **Consistency**: `req.user.linkedId` is now always populated from database
2. **Reliability**: Profile picture uploads work for all user roles
3. **Debugging**: Comprehensive logging shows exact database queries
4. **Error Handling**: Clear error messages when linkedId is missing
5. **Performance**: Single database query in auth middleware vs multiple queries in handlers

## Files Modified

1. `server/middleware/auth.ts` - Updated to fetch linkedId from database
2. `server/routes.ts` - Enhanced profile picture handler with validation and logging
3. `test-linkedid-fix.js` - Created comprehensive test script

The profile picture upload functionality should now work correctly for all user roles, with the auth middleware properly populating `req.user.linkedId` from the database.
