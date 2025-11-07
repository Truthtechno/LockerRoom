# Profile Picture Persistence Fix - Complete Solution

## Issue
Profile picture uploads successfully but disappears after page reload or navigation change.

## Root Causes Identified

1. **Server-side cache (Redis)**: 60-second TTL was serving stale data
2. **Client-side React Query cache**: 30-second staleTime was preventing fresh fetches
3. **Query cache not being cleared**: React Query cache wasn't being removed before invalidation
4. **Settings page staleTime**: 30-second staleTime prevented immediate updates

## Fixes Applied

### 1. **Disabled Server-Side Cache for `/api/users/me`** (`server/routes.ts`)
- **Changed**: Cache TTL from 60 seconds to **0 (no cache)**
- **Reason**: Ensures `/api/users/me` always returns fresh data immediately
- **Impact**: Profile updates appear instantly, no stale cache data

```typescript
cacheGet(
  userCacheKey,
  async () => {
    // ... fetch user data ...
    return responseData;
  },
  0 // No cache TTL - always fetch fresh data
);
```

### 2. **Fixed Settings Page Query** (`client/src/pages/settings.tsx`)
- **Changed**: `staleTime` from 30 seconds to **0**
- **Added**: `refetchOnWindowFocus: true`
- **Added**: Updates auth context with fresh data
- **Reason**: Forces fresh fetch on mount and window focus

```typescript
const { data: userData, isLoading } = useQuery({
  queryKey: ["/api/users/me", user?.id],
  queryFn: async () => {
    const response = await apiRequest("GET", "/api/users/me");
    const data = await response.json();
    // Update auth context with fresh data
    if (data && updateUser) {
      updateUser(data);
    }
    return data;
  },
  enabled: !!user?.id,
  staleTime: 0, // Always consider stale
  refetchOnMount: true,
  refetchOnWindowFocus: true,
});
```

### 3. **Enhanced Client-Side Cache Clearing** (`client/src/hooks/useProfileMedia.ts`)
- **Added**: `removeQueries()` before invalidation to completely clear cache
- **Enhanced**: Refetch ALL queries (not just active ones)
- **Added**: Immediate user context update with new profilePicUrl
- **Reason**: Ensures all components (settings, sidebar, navbar) get fresh data

```typescript
// Remove cached queries completely
qc.removeQueries({ queryKey: ['/api/users/me'] });
qc.removeQueries({ queryKey: ['/api/users/me', user?.id] });

// Invalidate to trigger refetch
await Promise.all([
  qc.invalidateQueries({ queryKey: ['/api/users/me'] }),
  qc.invalidateQueries({ queryKey: ['/api/users/me', user?.id] }),
  // ... other queries
]);

// Force refetch of ALL queries
await Promise.all([
  qc.refetchQueries({ queryKey: ['/api/users/me'] }),
  qc.refetchQueries({ queryKey: ['/api/users/me', user?.id] }),
]);

// Update user context immediately
if (responseData && responseData.profilePicUrl) {
  updateUser({ 
    ...user, 
    profilePicUrl: responseData.profilePicUrl 
  });
}
```

### 4. **Server-Side Cache Invalidation** (`server/routes/system-admin.ts`)
- **Enhanced**: Cache invalidation happens BEFORE returning response
- **Added**: Pattern-based cache invalidation
- **Added**: Better logging for debugging
- **Reason**: Ensures next request gets fresh data, not cached data

```typescript
// Invalidate cache BEFORE returning response
await cacheInvalidate(`user:${userId}`);
await cacheInvalidatePattern(`user:${userId}*`);

// Then return response
res.json(response);
```

## Test Results

✅ **Database**: Profile picture saved correctly in both `systemAdmins` and `users` tables
✅ **API Endpoint**: `/api/users/me` returns correct `profilePicUrl` from `systemAdmins` table
✅ **Cache Invalidation**: Server-side cache cleared correctly
✅ **Query Refetch**: Client-side queries refetch correctly after invalidation

## Expected Behavior Now

1. **Upload Profile Picture**:
   - Image uploaded to Cloudinary ✅
   - Profile updated in database ✅
   - Server cache invalidated ✅
   - Client cache cleared ✅
   - Queries refetched ✅
   - User context updated ✅
   - Sidebar/navbar updated immediately ✅

2. **Page Reload**:
   - `/api/users/me` fetches fresh data (no cache) ✅
   - Settings page query fetches fresh data (staleTime: 0) ✅
   - Sidebar query fetches fresh data (staleTime: 0) ✅
   - Profile picture displayed correctly ✅

3. **Navigation**:
   - All components use fresh data ✅
   - Profile picture persists across pages ✅
   - Sidebar/navbar shows correct profile picture ✅

## Files Modified

1. **`server/routes.ts`**: Disabled cache for `/api/users/me`
2. **`server/routes/system-admin.ts`**: Enhanced cache invalidation
3. **`client/src/hooks/useProfileMedia.ts`**: Enhanced cache clearing and refetch
4. **`client/src/pages/settings.tsx`**: Fixed staleTime and added refetch

## Summary

✅ **Server-side cache**: Disabled for immediate fresh data
✅ **Client-side cache**: Cleared and refetched after upload
✅ **Query configuration**: All queries set to fetch fresh data
✅ **User context**: Updated immediately with new profile picture
✅ **All components**: Receive and display fresh data

The profile picture should now:
- ✅ Upload successfully
- ✅ Persist after page reload
- ✅ Appear in navbar/sidebar immediately
- ✅ Update across all pages
- ✅ Never disappear

**The fix is complete and comprehensive!**

