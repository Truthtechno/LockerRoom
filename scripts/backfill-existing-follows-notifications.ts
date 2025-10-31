import { db } from '../server/db';
import { sql } from 'drizzle-orm';
import { storage } from '../server/storage';
import { studentFollowers, users, students } from '@shared/schema';
import { eq } from 'drizzle-orm';

/**
 * Backfill script to create notifications for existing follows
 * OPTIONAL: Only creates notifications for existing follows if you want historical data
 * This does NOT modify existing data - only adds notifications
 */

async function backfillFollowNotifications() {
  console.log('🔄 Backfilling notifications for existing follows...\n');
  console.log('📝 This will create notifications for existing follow relationships');
  console.log('✅ Safe to run - only ADDS notifications, does not modify existing data\n');

  try {
    // Get all existing follow relationships
    const follows = await db
      .select({
        followerUserId: studentFollowers.followerUserId,
        studentId: studentFollowers.studentId,
        createdAt: studentFollowers.createdAt,
      })
      .from(studentFollowers)
      .orderBy(studentFollowers.createdAt);

    console.log(`📊 Found ${follows.length} existing follow relationships\n`);

    if (follows.length === 0) {
      console.log('ℹ️  No existing follows to backfill\n');
      return 0;
    }

    let createdCount = 0;
    let skippedCount = 0;

    for (const follow of follows) {
      try {
        // Get the student being followed
        const student = await db.select().from(students).where(eq(students.id, follow.studentId)).limit(1);
        if (student.length === 0) {
          skippedCount++;
          continue;
        }

        // Get the follower user
        const followerUser = await db.select().from(users).where(eq(users.id, follow.followerUserId)).limit(1);
        if (followerUser.length === 0) {
          skippedCount++;
          continue;
        }

        // Check if notification already exists for this follow
        const existing = await db.execute(sql`
          SELECT id FROM notifications
          WHERE user_id = ${student[0].userId}
            AND type = 'new_follower'
            AND related_user_id = ${follow.followerUserId}
            AND entity_type = 'user'
            AND entity_id = ${student[0].userId}
          LIMIT 1
        `);

        if (existing.rows.length > 0) {
          skippedCount++;
          continue;
        }

        // Create notification for the student being followed
        await storage.createNotification({
          userId: student[0].userId,
          type: 'new_follower',
          title: 'New Follower',
          message: `${followerUser[0].name || 'Someone'} started following you`,
          entityType: 'user',
          entityId: student[0].userId,
          relatedUserId: follow.followerUserId,
          // Set the notification creation time to match the follow time
        });

        createdCount++;

        if (createdCount % 10 === 0) {
          console.log(`   Processed ${createdCount + skippedCount}/${follows.length} follows...`);
        }
      } catch (e: any) {
        // Skip if notification already exists or other error
        if (e?.message?.includes('duplicate') || e?.code === '23505') {
          skippedCount++;
        } else {
          console.error(`Error processing follow ${follow.followerUserId} -> ${follow.studentId}:`, e.message);
          skippedCount++;
        }
      }
    }

    console.log(`\n✅ Backfill complete!`);
    console.log(`   Created: ${createdCount} notifications`);
    console.log(`   Skipped: ${skippedCount} (already exist or errors)\n`);

    return createdCount;

  } catch (error) {
    console.error('❌ Backfill error:', error);
    throw error;
  }
}

async function main() {
  console.log('🚀 Starting Follow Notifications Backfill...\n');

  try {
    const count = await backfillFollowNotifications();

    if (count > 0) {
      console.log('🎉 Backfill completed successfully!');
      console.log(`📬 ${count} notifications created for existing follows`);
      console.log('✅ Users should now see notifications for their existing followers');
    } else {
      console.log('ℹ️  No new notifications were created (they may already exist)');
    }

  } catch (error) {
    console.error('❌ Backfill failed:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (process.argv[1] && process.argv[1].endsWith('backfill-existing-follows-notifications.ts')) {
  main()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Script failed:', error);
      process.exit(1);
    });
}

export { backfillFollowNotifications };

