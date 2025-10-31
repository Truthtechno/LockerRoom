# LockerRoom Migration Guide

This guide explains how to run the automated migration process to restore legacy posts, cover photos, and profile images in LockerRoom.

## Prerequisites

1. **Database Connection**: Ensure you have a `.env` file in the project root with your Neon database connection string:
   ```
   DATABASE_URL=postgresql://<user>:<password>@<host>/<dbname>?sslmode=require
   ```

2. **Dependencies**: Make sure all dependencies are installed:
   ```bash
   npm install
   ```

## Migration Process

The migration process consists of three main steps:

### 1. Database Schema Migration
- Adds new upload fields to the `posts` table:
  - `status` (text, default: 'ready')
  - `cloudinary_public_id` (text, nullable)
  - `thumbnail_url` (text, nullable)
- Creates indexes for better performance
- Sets safe defaults for existing posts

### 2. Legacy Data Backfill
- Updates existing posts with safe default values:
  - Sets `status = "ready"` for all posts
  - Creates `cloudinaryPublicId = "legacy_{id}"` for posts with media
  - Sets `thumbnailUrl` to the original media URL for images
  - Preserves existing profile images and cover photos

### 3. Migration Testing
- Verifies database connection
- Checks that all posts have the new fields
- Confirms legacy posts are visible in the feed
- Validates profile images and cover photos are restored
- Tests that new posts still work with the enhanced upload flow

## Running the Migration

### Option 1: Automated Migration (Recommended)
Run the complete migration process in one command:
```bash
npm run migrate
```

This will:
1. Run the database migration (via drizzle-kit or manual SQL)
2. Backfill legacy posts and profile images
3. Test the migration results
4. Report success/failure status

### Option 2: Manual Step-by-Step
If you prefer to run each step individually:

```bash
# Step 1: Run database migration
npm run db:push

# Step 2: Backfill legacy data
npm run migrate:backfill

# Step 3: Test the migration
npm run migrate:test
```

## What Gets Restored

### Legacy Posts
- All existing posts are preserved with no data loss
- Posts get default values for new fields:
  - `status`: "ready" (ready for display)
  - `cloudinaryPublicId`: "legacy_{post_id}" (for identification)
  - `thumbnailUrl`: Original media URL (for images)

### Profile Images & Cover Photos
- Existing profile images are preserved
- Existing cover photos are preserved
- URLs are maintained as-is (no data loss)

### New Upload System
- New posts will use the enhanced Cloudinary upload system
- Existing posts continue to work with their original URLs
- No breaking changes to the frontend

## Verification

After running the migration, verify the results:

1. **Check the Console Output**: Look for success messages:
   - ✅ Database connection successful
   - ✅ Legacy posts are visible in feed
   - ✅ Profile images restored and available
   - ✅ Cover photos restored and available

2. **Test the Frontend**:
   - Restart the dev server: `npm run dev:both`
   - Check the feed page - all posts should be visible
   - Check user profiles - profile images and cover photos should display
   - Try creating a new post - should work with the enhanced system

3. **Database Verification**:
   - Run `npm run migrate:test` to re-run the verification tests
   - Check that all posts have the new fields populated

## Troubleshooting

### "No DATABASE_URL found" Error
- Ensure `.env` file exists in the project root
- Verify the `DATABASE_URL` is properly formatted
- Check that the database is accessible

### Drizzle Push Fails
- The migration will automatically fall back to manual SQL execution
- This is normal and expected behavior
- The SQL migration file will be executed directly against the database

### Legacy Posts Not Visible
- Run the test script: `npm run migrate:test`
- Check the console output for specific error messages
- Verify that the backfill script completed successfully

### Profile Images Not Showing
- Check that the user has a valid `profileImageUrl` in the database
- Verify the image URL is accessible
- Run the test script to confirm profile images are detected

## Rollback (if needed)

If you need to rollback the migration:

1. **Remove the new columns** (be careful - this will lose data):
   ```sql
   ALTER TABLE posts DROP COLUMN IF EXISTS status;
   ALTER TABLE posts DROP COLUMN IF EXISTS cloudinary_public_id;
   ALTER TABLE posts DROP COLUMN IF EXISTS thumbnail_url;
   ```

2. **Restart the application** to clear any cached data

## Support

If you encounter issues:
1. Check the console output for specific error messages
2. Verify your database connection string
3. Ensure all dependencies are installed
4. Run the test script to diagnose issues: `npm run migrate:test`

The migration is designed to be safe and non-destructive - it only adds new fields and sets default values without modifying existing data.
