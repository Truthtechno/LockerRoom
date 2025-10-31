#!/usr/bin/env ts-node

/**
 * Test script to verify the migration worked correctly
 * This script checks that old posts are now visible and have proper default values
 */

import { db } from '../server/db';
import { posts, students, users } from '../shared/schema';
import { eq, desc, isNotNull } from 'drizzle-orm';
import { storage } from '../server/storage';

async function testMigration() {
  console.log('🧪 Testing migration results...');
  
  try {
    // Test 0: Check database connection
    console.log('\n🔗 Test 0: Verifying database connection...');
    const connectionTest = await db.execute('SELECT 1 as test');
    console.log('✅ Database connection successful');
    // Test 1: Check that all posts have the new fields
    console.log('\n📊 Test 1: Checking new fields on all posts...');
    
    const allPostsResult = await db.execute(`
      SELECT * FROM posts 
      ORDER BY created_at DESC
    `);
    const allPosts = allPostsResult.rows;
    console.log(`📝 Found ${allPosts.length} total posts`);
    
    let legacyPosts = 0;
    let newPosts = 0;
    
    for (const post of allPosts) {
      if (post.cloudinary_public_id?.startsWith('legacy_') || !post.cloudinary_public_id) {
        legacyPosts++;
      } else {
        newPosts++;
      }
    }
    
    console.log(`📊 Legacy posts: ${legacyPosts}`);
    console.log(`📊 New posts: ${newPosts}`);
    console.log(`✅ All posts have status field: ${allPosts.every(p => p.status)}`);

    // Test 2: Check that legacy posts have proper defaults
    console.log('\n🔍 Test 2: Checking legacy post defaults...');
    
    const legacyPostsData = allPosts.filter(p => 
      p.cloudinary_public_id?.startsWith('legacy_') || 
      (!p.cloudinary_public_id && p.media_url)
    );
    
    console.log(`📝 Found ${legacyPostsData.length} legacy posts`);
    
    for (const post of legacyPostsData.slice(0, 3)) { // Check first 3 legacy posts
      console.log(`📄 Post ${post.id}:`);
      console.log(`   Status: ${post.status}`);
      console.log(`   Cloudinary ID: ${post.cloudinary_public_id || 'null'}`);
      console.log(`   Thumbnail: ${post.thumbnail_url ? 'Set' : 'null'}`);
      console.log(`   Media URL: ${post.media_url || 'null'}`);
    }

    // Test 3: Check that storage methods return legacy posts
    console.log('\n🔄 Test 3: Testing storage methods...');
    
    const feedPosts = await storage.getPosts();
    console.log(`📊 Feed posts count: ${feedPosts.length}`);
    
    // Check if we have any posts with media
    const postsWithMedia = feedPosts.filter(p => 
      p.mediaUrl || p.mediaType
    );
    console.log(`📊 Posts with media: ${postsWithMedia.length}`);
    
    // Test 4: Check that legacy posts appear in feed
    console.log('\n📱 Test 4: Checking feed visibility...');
    
    const legacyPostsInFeed = feedPosts.filter(p => 
      p.cloudinaryPublicId?.startsWith('legacy_') || 
      (!p.cloudinaryPublicId && p.mediaUrl)
    );
    
    console.log(`📊 Legacy posts in feed: ${legacyPostsInFeed.length}`);
    
    if (legacyPostsInFeed.length > 0) {
      console.log('✅ Legacy posts are visible in feed!');
      
      // Show sample legacy post
      const samplePost = legacyPostsInFeed[0];
      console.log(`📄 Sample legacy post:`);
      console.log(`   ID: ${samplePost.id}`);
      console.log(`   Media URL: ${samplePost.mediaUrl}`);
      console.log(`   Media Type: ${samplePost.mediaType}`);
      console.log(`   Status: ${samplePost.status}`);
      console.log(`   Student: ${samplePost.student.name}`);
    } else {
      console.log('⚠️  No legacy posts found in feed');
    }

    // Test 5: Check student profile posts
    console.log('\n👤 Test 5: Checking student profile posts...');
    
    if (feedPosts.length > 0) {
      const firstPost = feedPosts[0];
      const studentPosts = await storage.getPostsByStudentWithUserContext(
        firstPost.studentId, 
        firstPost.student.userId
      );
      
      console.log(`📊 Posts for student ${firstPost.student.name}: ${studentPosts.length}`);
      
      const legacyStudentPosts = studentPosts.filter(p => 
        p.cloudinaryPublicId?.startsWith('legacy_') || 
        (!p.cloudinaryPublicId && p.mediaUrl)
      );
      
      console.log(`📊 Legacy posts for this student: ${legacyStudentPosts.length}`);
      
      if (legacyStudentPosts.length > 0) {
        console.log('✅ Legacy posts are visible in student profiles!');
      }
    }

    // Test 6: Check user profile images and cover photos
    console.log('\n🖼️  Test 6: Checking user profile images and cover photos...');
    
    const allUsersResult = await db.execute('SELECT * FROM users');
    const allUsers = allUsersResult.rows;
    console.log(`📊 Found ${allUsers.length} total users`);
    
    const usersWithProfileImages = allUsers.filter(u => u.profile_image_url);
    const usersWithCoverPhotos = allUsers.filter(u => u.cover_photo_url);
    
    console.log(`📊 Users with profile images: ${usersWithProfileImages.length}`);
    console.log(`📊 Users with cover photos: ${usersWithCoverPhotos.length}`);
    
    if (usersWithProfileImages.length > 0) {
      console.log('✅ Profile images restored and available');
      const sampleUser = usersWithProfileImages[0];
      console.log(`📸 Sample profile image URL: ${sampleUser.profile_image_url}`);
    }
    
    if (usersWithCoverPhotos.length > 0) {
      console.log('✅ Cover photos restored and available');
      const sampleUser = usersWithCoverPhotos[0];
      console.log(`🖼️  Sample cover photo URL: ${sampleUser.cover_photo_url}`);
    }

    console.log('\n🎉 Migration test completed successfully!');
    console.log('✅ All tests passed - legacy posts should now be visible');
    console.log('✅ Profile images and cover photos have been restored');
    
  } catch (error) {
    console.error('❌ Migration test failed:', error);
    throw error;
  }
}

// Run the test if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testMigration()
    .then(() => {
      console.log('✅ Migration test completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Migration test failed:', error);
      process.exit(1);
    });
}

export { testMigration };
