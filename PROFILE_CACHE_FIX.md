# Profile Cache Fix - Stale Data When Switching Students

## Problem
When switching between different student accounts, users were seeing the profile data of the previous student instead of the current one. This occurred on:
- Profile page
- Stats page
- Feed page
- Settings page
- Navigation components (sidebar, mobile nav)

## Root Cause
React Query's query keys didn't include the user ID, causing cached data to be shared across different users. When switching from Student A to Student B, React Query returned Student A's cached data because both used the same query key: `["/api/students/me"]`.

## Solution
Added `user?.id` to all query keys that fetch student profile data. This ensures each user gets their own cache entry.

### Files Fixed

1. **client/src/pages/profile.tsx**
   - Changed: `queryKey: ["/api/students/me"]` → `queryKey: ["/api/students/me", user?.id]`
   - Changed: `queryKey: ["/api/posts/student", studentProfile?.id]` → `queryKey: ["/api/posts/student", studentProfile?.id, user?.id]`
   - Updated all `invalidateQueries` calls to include `user?.id`

2. **client/src/pages/stats.tsx**
   - Changed: `queryKey: ["/api/students/me"]` → `queryKey: ["/api/students/me", user?.id]`
   - Changed: `queryKey: ["/api/students/me/stats"]` → `queryKey: ["/api/students/me/stats", user?.id]`
   - Updated `invalidateQueries` calls to include `user?.id`

3. **client/src/pages/feed.tsx**
   - Changed: `queryKey: ["/api/students/me"]` → `queryKey: ["/api/students/me", user?.id]`

4. **client/src/pages/settings.tsx**
   - Changed: `queryKey: ["/api/students/me"]` → `queryKey: ["/api/students/me", user?.id]`

5. **client/src/components/navigation/sidebar.tsx**
   - Changed: `queryKey: ["/api/students/me"]` → `queryKey: ["/api/students/me", user?.id]`

6. **client/src/components/navigation/mobile-nav.tsx**
   - Changed: `queryKey: ["/api/students/me"]` → `queryKey: ["/api/students/me", user?.id]`

## Why This Works
React Query uses query keys to cache data. When the query key changes (by adding `user?.id`), React Query treats it as a different query and fetches fresh data. This prevents one user's cached data from being returned for another user.

## Testing
1. Login as student "thiago@gmail.com"
2. Navigate to profile page - verify it shows thiago's data
3. Logout and login as another student
4. Navigate to profile page - should show the new student's data immediately (no stale data)
5. Check stats, feed, and settings pages - all should show correct data

## Additional Notes
- The `queryKey` includes `user?.id` which means it's `undefined` when user is null
- React Query automatically handles the `undefined` case
- Invalidations also include `user?.id` to ensure the correct cache is cleared
- No linter errors introduced - all code is type-safe

