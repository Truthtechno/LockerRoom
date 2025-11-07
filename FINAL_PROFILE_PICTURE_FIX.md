# Final Profile Picture Persistence Fix

## Root Cause Identified from Terminal Logs

The terminal logs reveal the **exact problem**:

1. **JWT Token has stale userId**: `07a184fc-7db2-451c-98cd-c30db341f970` (doesn't exist in `users` table)
2. **Actual user in database**: `7ac0b30f-1a4f-4d1c-b5b8-b9d62c4b3de8`
3. **When `/api/users/me` is called**:
   - Can't find user by JWT userId
   - Falls back to `admins` table
   - Finds admin record but it has `linkedId: null`
   - System admin profile picture lookup fails (needs `linkedId`)
   - Falls back to old `users.profilePicUrl` from cache

## Complete Fix Applied

### 1. **Fixed `/api/users/me` GET Endpoint** (`server/routes.ts`)
- **Added email-based lookup** when JWT userId is stale
- **Falls back to users table by email** before checking admins table
- **Updates userId variable** inside cache function for correct profile picture lookup
- **Added fallback** to `users.profilePicUrl` if `linkedId` is null

### 2. **Fixed PUT `/api/users/me` Endpoint** (`server/routes.ts`)
- **Added email-based lookup** for stale JWT tokens
- **Fixes "User not found" error** when saving account settings

### 3. **Enhanced Profile Picture Lookup** (`server/routes.ts`)
- **Checks if `linkedId` exists** before querying `systemAdmins` table
- **Falls back to `users.profilePicUrl`** if `linkedId` is null or lookup fails
- **Ensures profile picture is always returned** even with stale tokens

### 4. **Client-Side Fixes** (Already Applied)
- Removed React Query cache before invalidating
- Force refetch all queries after upload
- Update user context immediately
- Settings page: `staleTime: 0` for fresh data

### 5. **Server-Side Cache** (Already Applied)
- Cache TTL set to 0 (no cache) for `/api/users/me`
- Cache invalidated before returning response

## Code Changes

### `/api/users/me` GET - Email Lookup Fallback
```typescript
// If user not found by JWT userId, try email lookup
if (!userResult || userResult.length === 0) {
  const userEmail = auth.email;
  if (userEmail) {
    const userByEmailResult = await db.select(...)
      .from(users)
      .where(eq(users.email, userEmail))
      .limit(1);
    
    if (userByEmailResult && userByEmailResult.length > 0) {
      userResult = userByEmailResult;
      userId = userByEmailResult[0].id; // Update userId for profile lookup
    }
  }
}
```

### System Admin Profile Picture - Fallback
```typescript
if (user.role === 'system_admin') {
  if (user.linkedId) {
    // Try systemAdmins table first
    const systemAdminResult = await db.select(...)
      .from(systemAdmins)
      .where(eq(systemAdmins.id, user.linkedId))
      .limit(1);
    
    if (systemAdminResult[0]) {
      profilePicUrl = systemAdminResult[0].profilePicUrl;
    }
  }
  
  // Fallback to users table if linkedId is null
  if (!profilePicUrl && user.profilePicUrl) {
    profilePicUrl = user.profilePicUrl;
  }
}
```

## Expected Behavior Now

1. **Upload Profile Picture**:
   - ✅ Uploads to Cloudinary
   - ✅ Updates `systemAdmins` table
   - ✅ Updates `users` table (for fallback)
   - ✅ Cache invalidated
   - ✅ Queries refetched
   - ✅ Profile picture appears immediately

2. **Page Reload**:
   - ✅ `/api/users/me` finds user by email (if JWT userId is stale)
   - ✅ Gets correct `linkedId` from database
   - ✅ Fetches profile picture from `systemAdmins` table
   - ✅ Falls back to `users.profilePicUrl` if needed
   - ✅ Profile picture persists

3. **Navigation**:
   - ✅ All components get fresh data
   - ✅ Profile picture persists across pages
   - ✅ Sidebar/navbar shows correct picture

## Summary

✅ **Fixed stale JWT token handling** - Email lookup fallback
✅ **Fixed profile picture lookup** - Fallback to users table if linkedId is null
✅ **Fixed PUT endpoint** - Handles stale tokens correctly
✅ **Disabled caching** - Always fresh data
✅ **Enhanced client-side** - Complete cache clearing and refetch

**The profile picture should now persist correctly even with stale JWT tokens!**

