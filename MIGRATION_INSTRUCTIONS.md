# LockerRoom Migration Instructions

## Overview
This migration fixes the issue where old posts disappeared after introducing the new upload flow with `status`, `cloudinaryPublicId`, and `thumbnailUrl` fields.

## What This Migration Does

1. **Adds new database fields** with safe defaults:
   - `status` → defaults to "ready"
   - `cloudinary_public_id` → defaults to "legacy_{post_id}" for existing posts
   - `thumbnail_url` → defaults to placeholder or original URL

2. **Backfills existing posts** with proper default values
3. **Updates query logic** to include legacy posts in feeds and profiles
4. **Preserves all existing data** - no posts are deleted or overwritten

## Running the Migration

### Option 1: Automated Script (Recommended)
```bash
# Run the complete migration
npm run ts-node scripts/run-migration.ts
```

### Option 2: Manual Steps
```bash
# Step 1: Apply database migration
psql -d your_database -f migrations/0006_add_post_upload_fields.sql

# Step 2: Backfill legacy posts
npm run ts-node scripts/backfill-legacy-posts.ts
```

### Option 3: Using Drizzle (if configured)
```bash
# Generate and apply migration
npx drizzle-kit generate
npx drizzle-kit push

# Backfill legacy posts
npm run ts-node scripts/backfill-legacy-posts.ts
```

## Verification

After running the migration:

1. **Check the feed** - old posts should now appear
2. **Check user profiles** - old posts should be visible
3. **Create a new post** - should work with the new upload system
4. **Upload a large video** - should show processing state correctly

## Files Modified

- `migrations/0006_add_post_upload_fields.sql` - Database schema changes
- `scripts/backfill-legacy-posts.ts` - Legacy post backfill script
- `scripts/run-migration.ts` - Migration runner
- `server/storage.ts` - Updated query logic to include legacy posts

## Safety Notes

- ✅ **Safe for production** - no data is deleted or overwritten
- ✅ **Backward compatible** - old posts continue to work
- ✅ **Non-blocking** - can be run during normal operation
- ✅ **Reversible** - can be rolled back if needed

## Troubleshooting

### Old posts still not showing?
1. Check if the migration ran successfully
2. Verify the backfill script completed without errors
3. Check database logs for any constraint violations

### New uploads not working?
1. Ensure the new upload routes are properly deployed
2. Check that Cloudinary configuration is correct
3. Verify webhook endpoints are accessible

### Performance issues?
1. The migration adds indexes for better performance
2. Consider running during low-traffic periods
3. Monitor database performance during migration

## Rollback (if needed)

If you need to rollback:

```sql
-- Remove the new columns (only if no new posts have been created)
ALTER TABLE posts DROP COLUMN IF EXISTS status;
ALTER TABLE posts DROP COLUMN IF EXISTS cloudinary_public_id;
ALTER TABLE posts DROP COLUMN IF EXISTS thumbnail_url;

-- Remove indexes
DROP INDEX IF EXISTS idx_posts_status;
DROP INDEX IF EXISTS idx_posts_cloudinary_public_id;
```

**Note**: Only rollback if you haven't created any new posts with the new system.
