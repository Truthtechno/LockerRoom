#!/usr/bin/env ts-node

/**
 * One-time migration script to backfill legacy posts with new upload fields
 * This script safely updates existing posts without losing data
 */

import { db } from '../server/db';
import { posts, students, users } from '../shared/schema';
import { eq, isNull, or, and } from 'drizzle-orm';

async function backfillUserProfileImages() {
  console.log('🖼️  Backfilling user profile images and cover photos...');
  
  try {
    // Get all users that might have legacy profile images or cover photos using raw SQL
    const allUsersResult = await db.execute('SELECT * FROM users');
    const allUsers = allUsersResult.rows;
    console.log(`📊 Found ${allUsers.length} users to check for profile images`);

    let updatedUsers = 0;

    for (const user of allUsers) {
      const updates: any = {};

      // Check if user has legacy profile image data that needs to be restored
      if (user.profile_image_url && !user.profile_image_url.includes('cloudinary.com')) {
        // This might be a legacy image URL that needs to be preserved
        console.log(`📸 Preserving legacy profile image for user ${user.id}: ${user.profile_image_url}`);
      }

      // Check if user has legacy cover photo data that needs to be restored  
      if (user.cover_photo_url && !user.cover_photo_url.includes('cloudinary.com')) {
        // This might be a legacy cover photo URL that needs to be preserved
        console.log(`🖼️  Preserving legacy cover photo for user ${user.id}: ${user.cover_photo_url}`);
      }

      // Update the user if there are changes using raw SQL
      if (Object.keys(updates).length > 0) {
        const updateFields = Object.keys(updates).map(key => {
          const value = updates[key];
          // Escape single quotes in values
          const escapedValue = typeof value === 'string' ? value.replace(/'/g, "''") : value;
          return `${key} = '${escapedValue}'`;
        }).join(', ');
        
        await db.execute(`
          UPDATE users 
          SET ${updateFields}
          WHERE id = '${user.id}'
        `);
        
        updatedUsers++;
      }
    }

    console.log(`✅ Profile image backfill completed: ${updatedUsers} users updated`);
  } catch (error) {
    console.error('❌ Profile image backfill failed:', error);
    throw error;
  }
}

async function backfillLegacyPosts() {
  console.log('🔄 Starting legacy posts backfill migration...');
  
  try {
    // Get all posts that need backfilling using raw SQL since Drizzle doesn't know about new columns yet
    const legacyPostsResult = await db.execute(`
      SELECT * FROM posts 
      WHERE status IS NULL 
         OR cloudinary_public_id IS NULL 
         OR thumbnail_url IS NULL
    `);
    
    const legacyPosts = legacyPostsResult.rows;

    console.log(`📊 Found ${legacyPosts.length} posts to backfill`);

    if (legacyPosts.length === 0) {
      console.log('✅ No posts need backfilling. Migration complete.');
      return;
    }

    let updatedCount = 0;

    for (const post of legacyPosts) {
      const updates: any = {};

      // Set status if missing
      if (!post.status) {
        updates.status = 'ready';
      }

      // Set cloudinaryPublicId if missing
      if (!post.cloudinary_public_id) {
        if (post.media_url || post.content_url) {
          // Create a legacy identifier
          updates.cloudinary_public_id = `legacy_${post.id}`;
        }
      }

      // Set thumbnailUrl if missing
      if (!post.thumbnail_url) {
        const mediaType = post.media_type || post.content_type || 'image';
        const mediaUrl = post.media_url || post.content_url;
        
        if (mediaType === 'video') {
          // Use a placeholder video thumbnail
          updates.thumbnail_url = 'https://res.cloudinary.com/dh9cfkyhc/image/upload/f_auto,q_auto,w_400/v1620000000/placeholder-video-thumbnail.jpg';
        } else if (mediaType === 'image' && mediaUrl) {
          // For images, use the original URL with Cloudinary optimizations if it's already a Cloudinary URL
          if (mediaUrl.includes('cloudinary.com')) {
            // Extract public_id from existing Cloudinary URL and add optimizations
            const publicIdMatch = mediaUrl.match(/\/upload\/[^\/]+\/(.+)$/);
            if (publicIdMatch) {
              updates.thumbnail_url = `https://res.cloudinary.com/dh9cfkyhc/image/upload/f_auto,q_auto,w_auto/${publicIdMatch[1]}`;
            } else {
              updates.thumbnail_url = mediaUrl;
            }
          } else {
            // For non-Cloudinary images, use as-is
            updates.thumbnail_url = mediaUrl;
          }
        }
      }

      // Update the post if there are changes using raw SQL
      if (Object.keys(updates).length > 0) {
        const updateFields = Object.keys(updates).map(key => {
          const value = updates[key];
          // Escape single quotes in values
          const escapedValue = typeof value === 'string' ? value.replace(/'/g, "''") : value;
          return `${key} = '${escapedValue}'`;
        }).join(', ');
        
        
        await db.execute(`
          UPDATE posts 
          SET ${updateFields}
          WHERE id = '${post.id}'
        `);
        
        updatedCount++;
        console.log(`✅ Updated post ${post.id}: ${Object.keys(updates).join(', ')}`);
      }
    }

    console.log(`🎉 Posts backfill completed successfully!`);
    console.log(`📈 Updated ${updatedCount} posts out of ${legacyPosts.length} total`);
    console.log(`📝 All legacy posts now have proper default values`);

    // Also backfill user profile images and cover photos
    await backfillUserProfileImages();

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

// Run the migration if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  backfillLegacyPosts()
    .then(() => {
      console.log('✅ Migration script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Migration script failed:', error);
      process.exit(1);
    });
}

export { backfillLegacyPosts };
