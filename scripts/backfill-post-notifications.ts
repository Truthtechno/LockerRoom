import { db } from '../server/db';
import { posts, students, studentFollowers, notifications } from '@shared/schema';
import { eq, desc, sql, and } from 'drizzle-orm';
import { storage } from '../server/storage';
import { notifyFollowersOfNewPost } from '../server/utils/notification-helpers';

/**
 * Backfill script to create notifications for existing posts
 * This will create notifications for all posts that don't have notifications yet
 */

async function backfillPostNotifications() {
  console.log('🔄 Starting notification backfill for existing posts...\n');
  console.log('='.repeat(60));

  try {
    // Get all posts
    const allPosts = await db
      .select()
      .from(posts)
      .where(sql`${posts.status} = 'ready'`)
      .orderBy(desc(posts.createdAt));

    console.log(`📋 Found ${allPosts.length} ready post(s) to process\n`);

    let totalProcessed = 0;
    let totalNotificationsCreated = 0;
    let skippedPosts = 0;

    for (const post of allPosts) {
      try {
        if (!post.studentId) {
          console.log(`⚠️  Post ${post.id} has no studentId, skipping`);
          skippedPosts++;
          continue;
        }

        // Check if notifications already exist for this post
        const existingNotifications = await db
          .select()
          .from(notifications)
          .where(
            and(
              eq(notifications.entityType, 'post'),
              eq(notifications.entityId, post.id),
              eq(notifications.type, 'following_posted')
            )
          )
          .limit(1);

        if (existingNotifications.length > 0) {
          console.log(`ℹ️  Post ${post.id} already has notifications, skipping`);
          skippedPosts++;
          continue;
        }

        // Get student info
        const student = await storage.getStudent(post.studentId);
        if (!student) {
          console.log(`⚠️  Student ${post.studentId} not found for post ${post.id}, skipping`);
          skippedPosts++;
          continue;
        }

        // Get followers for this student
        const followers = await storage.getStudentFollowers(post.studentId);
        if (followers.length === 0) {
          console.log(`ℹ️  Post ${post.id}: Student ${student.name} has no followers, skipping`);
          skippedPosts++;
          continue;
        }

        console.log(`\n📝 Processing post ${post.id} by ${student.name}...`);
        console.log(`   Created: ${post.createdAt}`);
        console.log(`   Followers: ${followers.length}`);

        // Create notifications for this post
        await notifyFollowersOfNewPost(post.id, post.studentId);
        
        // Verify notifications were created
        const newNotifications = await db
          .select()
          .from(notifications)
          .where(
            and(
              eq(notifications.entityType, 'post'),
              eq(notifications.entityId, post.id),
              eq(notifications.type, 'following_posted')
            )
          );

        const createdCount = newNotifications.length;
        totalNotificationsCreated += createdCount;
        totalProcessed++;

        console.log(`   ✅ Created ${createdCount} notification(s)`);

      } catch (error: any) {
        console.error(`❌ Error processing post ${post.id}:`, error?.message || error);
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 Backfill Summary:');
    console.log(`   Total Posts Processed: ${totalProcessed}`);
    console.log(`   Posts Skipped: ${skippedPosts}`);
    console.log(`   Total Notifications Created: ${totalNotificationsCreated}`);
    console.log('='.repeat(60));
    console.log('\n✅ Backfill completed!\n');

  } catch (error: any) {
    console.error('❌ Backfill error:', error?.message || error);
    throw error;
  }
}

async function main() {
  try {
    await backfillPostNotifications();
    process.exit(0);
  } catch (error) {
    console.error('❌ Script failed:', error);
    process.exit(1);
  }
}

if (process.argv[1] && process.argv[1].endsWith('backfill-post-notifications.ts')) {
  main();
}

export { backfillPostNotifications };

