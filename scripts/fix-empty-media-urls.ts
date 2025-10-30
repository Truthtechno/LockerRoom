#!/usr/bin/env tsx

import { db } from '../server/db';
import { posts } from '../shared/schema';
import { eq, or, isNull } from 'drizzle-orm';

async function fixEmptyMediaUrls() {
  console.log('🔧 Starting fix for empty mediaUrl values...');
  
  try {
    // Find posts with empty or null mediaUrl
    const emptyMediaPosts = await db.select().from(posts).where(
      or(
        eq(posts.mediaUrl, ''),
        isNull(posts.mediaUrl)
      )
    );
    
    console.log(`📊 Found ${emptyMediaPosts.length} posts with empty mediaUrl`);
    
    if (emptyMediaPosts.length === 0) {
      console.log('✅ No posts with empty mediaUrl found. All good!');
      return;
    }
    
    // Update each post based on its status
    for (const post of emptyMediaPosts) {
      let newMediaUrl: string;
      let newThumbnailUrl: string;
      
      if (post.status === 'processing') {
        newMediaUrl = '/api/placeholder/processing';
        newThumbnailUrl = '/api/placeholder/video-thumbnail';
      } else if (post.status === 'failed') {
        newMediaUrl = '/api/placeholder/failed';
        newThumbnailUrl = '/api/placeholder/failed-thumbnail';
      } else {
        // For posts with 'ready' status but empty mediaUrl, mark as failed
        newMediaUrl = '/api/placeholder/failed';
        newThumbnailUrl = '/api/placeholder/failed-thumbnail';
        console.log(`⚠️ Post ${post.id} has 'ready' status but empty mediaUrl - marking as failed`);
      }
      
      await db.update(posts)
        .set({
          mediaUrl: newMediaUrl,
          thumbnailUrl: newThumbnailUrl,
          status: post.status === 'ready' ? 'failed' : post.status
        })
        .where(eq(posts.id, post.id));
      
      console.log(`✅ Updated post ${post.id}: ${post.status} -> ${newMediaUrl}`);
    }
    
    console.log('🎉 Successfully fixed all empty mediaUrl values!');
    
  } catch (error) {
    console.error('❌ Error fixing empty mediaUrl values:', error);
    throw error;
  }
}

// Run the fix
fixEmptyMediaUrls()
  .then(() => {
    console.log('✅ Migration completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  });
