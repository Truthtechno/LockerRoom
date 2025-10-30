# Migration Summary: Fix Data Type Mismatches and Add Performance Indexes

## Overview
This migration fixes data type mismatches between `users.id` (varchar) and `posts.id` (varchar) in the `user_follows` and `saved_posts` tables, and adds performance indexes.

## Changes Made

### 1. Fixed user_follows Table
- **Issue**: The `user_follows` table was using `UUID` type for `follower_id` and `following_id`, but `users.id` is `varchar`
- **Solution**: Recreated the table with `varchar` types to match `users.id`
- **Migration**: `0005_fix_data_types_and_indexes.sql`

### 2. Verified saved_posts Table
- **Status**: Already correct - uses `varchar` for both `user_id` and `post_id`
- **No changes needed**: Both fields already match the referenced table types

### 3. Added Performance Indexes

#### user_follows Table Indexes:
- `idx_user_follows_follower_id` - For queries by follower
- `idx_user_follows_following_id` - For queries by following
- `idx_user_follows_created_at` - For time-based queries
- `idx_user_follows_follower_following` - Composite index for unique constraint

#### saved_posts Table Indexes:
- `idx_saved_posts_user_id` - For queries by user
- `idx_saved_posts_post_id` - For queries by post
- `idx_saved_posts_created_at` - For time-based queries
- `idx_saved_posts_user_post` - Composite index for performance

#### Additional Indexes:
- `idx_post_likes_user_id` - For post likes queries
- `idx_post_likes_post_id` - For post likes queries
- `idx_post_comments_user_id` - For post comments queries
- `idx_post_comments_post_id` - For post comments queries

## Data Type Compatibility

### Before Migration:
- `users.id`: `varchar` ✅
- `posts.id`: `varchar` ✅
- `user_follows.follower_id`: `UUID` ❌ (mismatch)
- `user_follows.following_id`: `UUID` ❌ (mismatch)
- `saved_posts.user_id`: `varchar` ✅
- `saved_posts.post_id`: `varchar` ✅

### After Migration:
- `users.id`: `varchar` ✅
- `posts.id`: `varchar` ✅
- `user_follows.follower_id`: `varchar` ✅ (fixed)
- `user_follows.following_id`: `varchar` ✅ (fixed)
- `saved_posts.user_id`: `varchar` ✅
- `saved_posts.post_id`: `varchar` ✅

## Production Safety

### Migration Strategy:
1. **Drop and Recreate**: The migration drops the existing `user_follows` table and recreates it with correct types
2. **Data Loss**: This approach will result in data loss for the `user_follows` table
3. **Alternative**: For production with existing data, consider:
   - Backup existing data
   - Alter column types instead of dropping/recreating
   - Migrate data to new structure

### Recommended Production Approach:
```sql
-- For production with existing data, use this approach instead:
ALTER TABLE user_follows ALTER COLUMN follower_id TYPE varchar USING follower_id::varchar;
ALTER TABLE user_follows ALTER COLUMN following_id TYPE varchar USING following_id::varchar;
```

## Files Modified

1. **New Migration**: `migrations/0005_fix_data_types_and_indexes.sql`
2. **Updated Journal**: `migrations/meta/_journal.json`
3. **New Snapshot**: `migrations/meta/0005_snapshot.json`
4. **Test Script**: `test-migration.sql` (for verification)

## Verification

Run the test script to verify the migration:
```bash
psql -d your_database -f test-migration.sql
```

## Next Steps

1. **Review**: Review the migration script for your specific production needs
2. **Backup**: Create a backup before running in production
3. **Test**: Test the migration in a staging environment first
4. **Deploy**: Run the migration in production
5. **Verify**: Verify that both tables exist and have correct data types and indexes

## Performance Impact

The added indexes will improve query performance for:
- User following relationships
- Saved posts queries
- Post likes and comments queries
- Time-based queries on these tables

Expected performance improvements:
- Faster user following lookups
- Faster saved posts retrieval
- Better performance for social features
- Improved query execution times for related operations
