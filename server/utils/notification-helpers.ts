import { storage } from '../storage';
import { db } from '../db';
import { students, users, notifications, submissions, submissionReviews, submissionFinalFeedback } from '@shared/schema';
import { eq, and, inArray, sql } from 'drizzle-orm';

/**
 * Helper function to create notifications for all followers when a student posts
 * This should be called after a post is created or updated to 'ready' status
 */
export async function notifyFollowersOfNewPost(postId: string, studentId: string): Promise<void> {
  try {
    console.log(`🔔 Creating notifications for post ${postId} by student ${studentId}`);
    
    const student = await storage.getStudent(studentId);
    if (!student) {
      console.log(`⚠️ Student ${studentId} not found, skipping notifications`);
      return;
    }

    // Get all users who follow this student
    const followers = await storage.getStudentFollowers(studentId);
    console.log(`📋 Found ${followers.length} follower(s) for student ${student.name} (${studentId})`);

    if (followers.length === 0) {
      console.log(`ℹ️ No followers found for student ${student.name}, skipping notifications`);
      return;
    }

    // Create notifications for each follower
    let notificationCount = 0;
    const errors: string[] = [];

    for (const follower of followers) {
      try {
        // Get the follower's user ID - getStudentFollowers returns objects with id field
        const followerUserId = follower.id;
        if (!followerUserId) {
          console.error(`⚠️ Follower missing userId:`, follower);
          errors.push(`Follower missing userId: ${JSON.stringify(follower)}`);
          continue;
        }

        // Skip if trying to notify the student themselves
        if (followerUserId === student.userId) {
          console.log(`ℹ️ Skipping notification for student themselves: ${follower.name}`);
          continue;
        }

        // Check if notification already exists to avoid duplicates
        const existingNotifications = await db
          .select()
          .from(notifications)
          .where(
            and(
              eq(notifications.userId, followerUserId),
              eq(notifications.entityType, 'post'),
              eq(notifications.entityId, postId),
              eq(notifications.type, 'following_posted')
            )
          )
          .limit(1);

        if (existingNotifications.length > 0) {
          console.log(`ℹ️ Notification already exists for ${follower.name} about post ${postId}, skipping`);
          continue;
        }

        console.log(`📬 Creating notification for follower: ${follower.name} (${followerUserId})`);
        
        await storage.createNotification({
          userId: followerUserId,
          type: 'following_posted',
          title: 'New Post',
          message: `${student.name} posted something new`,
          entityType: 'post',
          entityId: postId,
          relatedUserId: student.userId,
        });

        notificationCount++;
        console.log(`✅ Notification created for ${follower.name}`);
      } catch (e: any) {
        const errorMsg = `Error creating notification for follower ${follower.id}: ${e?.message || e}`;
        console.error(`❌ ${errorMsg}`);
        errors.push(errorMsg);
      }
    }

    console.log(`✅ Created ${notificationCount} notification(s) for ${followers.length} follower(s)`);
    
    if (errors.length > 0) {
      console.error(`⚠️ Encountered ${errors.length} error(s) while creating notifications:`, errors);
    }
  } catch (error: any) {
    console.error('❌ Error in notifyFollowersOfNewPost:', error?.message || error);
    // Don't throw - this is a non-critical operation
  }
}

/**
 * Notify all scouts and scout admins when a student submits
 */
export async function notifyScoutsOfNewSubmission(submissionId: string, studentId: string): Promise<void> {
  try {
    console.log(`🔔 Creating notifications for submission ${submissionId} by student ${studentId}`);
    
    // Get student info
    const student = await db
      .select()
      .from(students)
      .where(eq(students.userId, studentId))
      .limit(1);
    
    if (student.length === 0) {
      console.log(`⚠️ Student ${studentId} not found, skipping notifications`);
      return;
    }

    const studentInfo = student[0];

    // Get all scouts and scout admins
    const scouts = await db
      .select()
      .from(users)
      .where(inArray(users.role, ['xen_scout', 'scout_admin']));

    console.log(`📋 Found ${scouts.length} scout(s) to notify`);

    if (scouts.length === 0) {
      console.log(`ℹ️ No scouts found, skipping notifications`);
      return;
    }

    let notificationCount = 0;

    for (const scout of scouts) {
      try {
        // Check if notification already exists
        const existingNotifications = await db
          .select()
          .from(notifications)
          .where(
            and(
              eq(notifications.userId, scout.id),
              eq(notifications.entityType, 'submission'),
              eq(notifications.entityId, submissionId),
              eq(notifications.type, 'submission_created')
            )
          )
          .limit(1);

        if (existingNotifications.length > 0) {
          continue;
        }

        console.log(`📬 Creating notification for scout: ${scout.name} (${scout.id})`);
        
        await storage.createNotification({
          userId: scout.id,
          type: 'submission_created',
          title: 'New Submission',
          message: `${studentInfo.name} has submitted a new video for review`,
          entityType: 'submission',
          entityId: submissionId,
          relatedUserId: studentId,
        });

        notificationCount++;
        console.log(`✅ Notification created for ${scout.name}`);
      } catch (e: any) {
        console.error(`❌ Error creating notification for scout ${scout.id}: ${e?.message || e}`);
      }
    }

    console.log(`✅ Created ${notificationCount} notification(s) for ${scouts.length} scout(s)`);
  } catch (error: any) {
    console.error('❌ Error in notifyScoutsOfNewSubmission:', error?.message || error);
  }
}

/**
 * Notify other scouts and scout admins when a scout comments/rates on a submission
 */
export async function notifyScoutsOfReviewUpdate(submissionId: string, reviewerScoutId: string, isSubmitted: boolean): Promise<void> {
  try {
    // Only notify when review is submitted (not just saved as draft)
    if (!isSubmitted) {
      return;
    }

    console.log(`🔔 Creating notifications for review update on submission ${submissionId} by scout ${reviewerScoutId}`);
    
    // Get submission info
    const submissionData = await db
      .select()
      .from(submissions)
      .where(eq(submissions.id, submissionId))
      .limit(1);
    
    if (submissionData.length === 0) {
      console.log(`⚠️ Submission ${submissionId} not found, skipping notifications`);
      return;
    }

    // Get reviewer info
    const reviewer = await db
      .select()
      .from(users)
      .where(eq(users.id, reviewerScoutId))
      .limit(1);

    if (reviewer.length === 0) {
      console.log(`⚠️ Reviewer ${reviewerScoutId} not found, skipping notifications`);
      return;
    }

    // Get all other scouts and scout admins (excluding the reviewer)
    const scouts = await db
      .select()
      .from(users)
      .where(
        and(
          inArray(users.role, ['xen_scout', 'scout_admin']),
          sql`${users.id} != ${reviewerScoutId}`
        )
      );

    console.log(`📋 Found ${scouts.length} scout(s) to notify`);

    if (scouts.length === 0) {
      return;
    }

    let notificationCount = 0;

    for (const scout of scouts) {
      try {
        // Check if notification already exists
        const existingNotifications = await db
          .select()
          .from(notifications)
          .where(
            and(
              eq(notifications.userId, scout.id),
              eq(notifications.entityType, 'submission'),
              eq(notifications.entityId, submissionId),
              eq(notifications.type, 'review_submitted'),
              eq(notifications.relatedUserId, reviewerScoutId)
            )
          )
          .limit(1);

        if (existingNotifications.length > 0) {
          continue;
        }

        console.log(`📬 Creating notification for scout: ${scout.name} (${scout.id})`);
        
        await storage.createNotification({
          userId: scout.id,
          type: 'review_submitted',
          title: 'Review Submitted',
          message: `${reviewer[0].name} has submitted their review for a submission`,
          entityType: 'submission',
          entityId: submissionId,
          relatedUserId: reviewerScoutId,
        });

        notificationCount++;
      } catch (e: any) {
        console.error(`❌ Error creating notification for scout ${scout.id}: ${e?.message || e}`);
      }
    }

    console.log(`✅ Created ${notificationCount} notification(s) for ${scouts.length} scout(s)`);
  } catch (error: any) {
    console.error('❌ Error in notifyScoutsOfReviewUpdate:', error?.message || error);
  }
}

/**
 * Notify all scouts when a submission is finalized/sent back to student
 */
export async function notifyScoutsOfSubmissionFinalized(submissionId: string): Promise<void> {
  try {
    console.log(`🔔 Creating notifications for finalized submission ${submissionId}`);
    
    // Get all scouts and scout admins
    const scouts = await db
      .select()
      .from(users)
      .where(inArray(users.role, ['xen_scout', 'scout_admin']));

    console.log(`📋 Found ${scouts.length} scout(s) to notify`);

    if (scouts.length === 0) {
      return;
    }

    let notificationCount = 0;

    for (const scout of scouts) {
      try {
        // Check if notification already exists
        const existingNotifications = await db
          .select()
          .from(notifications)
          .where(
            and(
              eq(notifications.userId, scout.id),
              eq(notifications.entityType, 'submission'),
              eq(notifications.entityId, submissionId),
              eq(notifications.type, 'submission_finalized')
            )
          )
          .limit(1);

        if (existingNotifications.length > 0) {
          continue;
        }

        console.log(`📬 Creating notification for scout: ${scout.name} (${scout.id})`);
        
        await storage.createNotification({
          userId: scout.id,
          type: 'submission_finalized',
          title: 'Submission Finalized',
          message: `A submission you reviewed has been finalized and sent to the student`,
          entityType: 'submission',
          entityId: submissionId,
        });

        notificationCount++;
      } catch (e: any) {
        console.error(`❌ Error creating notification for scout ${scout.id}: ${e?.message || e}`);
      }
    }

    console.log(`✅ Created ${notificationCount} notification(s) for ${scouts.length} scout(s)`);
  } catch (error: any) {
    console.error('❌ Error in notifyScoutsOfSubmissionFinalized:', error?.message || error);
  }
}

/**
 * Notify student when they submit a video for XEN Watch review
 */
export async function notifyStudentOfSubmission(submissionId: string, studentId: string): Promise<void> {
  try {
    console.log(`🔔 Creating submission notification for student ${studentId} (submission ${submissionId})`);
    
    // Check if notification already exists
    const existingNotifications = await db
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, studentId),
          eq(notifications.entityType, 'submission'),
          eq(notifications.entityId, submissionId),
          eq(notifications.type, 'submission_received')
        )
      )
      .limit(1);

    if (existingNotifications.length > 0) {
      console.log(`ℹ️ Notification already exists for student ${studentId} about submission ${submissionId}, skipping`);
      return;
    }

    console.log(`📬 Creating submission notification for student: ${studentId}`);
    
    await storage.createNotification({
      userId: studentId,
      type: 'submission_received',
      title: 'Submission Received',
      message: 'Your video has been received! Our scouts will review it shortly and provide feedback.',
      entityType: 'submission',
      entityId: submissionId,
    });

    console.log(`✅ Notification created for student ${studentId}`);
  } catch (error: any) {
    console.error('❌ Error in notifyStudentOfSubmission:', error?.message || error);
  }
}

/**
 * Notify student when their submission has been reviewed and finalized
 */
export async function notifyStudentOfSubmissionFeedback(submissionId: string, studentId: string): Promise<void> {
  try {
    console.log(`🔔 Creating feedback notification for student ${studentId} (submission ${submissionId})`);
    
    // Check if notification already exists
    const existingNotifications = await db
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, studentId),
          eq(notifications.entityType, 'submission'),
          eq(notifications.entityId, submissionId),
          eq(notifications.type, 'submission_feedback_ready')
        )
      )
      .limit(1);

    if (existingNotifications.length > 0) {
      console.log(`ℹ️ Notification already exists for student ${studentId} about submission ${submissionId} feedback, skipping`);
      return;
    }

    // Get final feedback to include rating in message
    const finalFeedback = await db
      .select()
      .from(submissionFinalFeedback)
      .where(eq(submissionFinalFeedback.submissionId, submissionId))
      .limit(1);

    const ratingText = finalFeedback[0]?.finalRating 
      ? ` Your submission received a ${finalFeedback[0].finalRating}/5 rating.`
      : '';

    console.log(`📬 Creating feedback notification for student: ${studentId}`);
    
    await storage.createNotification({
      userId: studentId,
      type: 'submission_feedback_ready',
      title: 'Feedback Ready',
      message: `Your XEN Watch submission has been reviewed!${ratingText} Check your submissions page to view the detailed feedback.`,
      entityType: 'submission',
      entityId: submissionId,
    });

    console.log(`✅ Notification created for student ${studentId}`);
  } catch (error: any) {
    console.error('❌ Error in notifyStudentOfSubmissionFeedback:', error?.message || error);
  }
}

/**
 * Notify scout admins when a new scout profile is created
 */
export async function notifyScoutAdminsOfNewScout(scoutUserId: string, scoutName: string): Promise<void> {
  try {
    console.log(`🔔 Creating notifications for new scout: ${scoutName} (${scoutUserId})`);
    
    // Get all scout admins
    const scoutAdmins = await db
      .select()
      .from(users)
      .where(eq(users.role, 'scout_admin'));

    console.log(`📋 Found ${scoutAdmins.length} scout admin(s) to notify`);

    if (scoutAdmins.length === 0) {
      return;
    }

    let notificationCount = 0;

    for (const admin of scoutAdmins) {
      try {
        // Skip if trying to notify the admin who created the scout (if same user)
        if (admin.id === scoutUserId) {
          continue;
        }

        // Check if notification already exists
        const existingNotifications = await db
          .select()
          .from(notifications)
          .where(
            and(
              eq(notifications.userId, admin.id),
              eq(notifications.entityType, 'user'),
              eq(notifications.entityId, scoutUserId),
              eq(notifications.type, 'scout_created')
            )
          )
          .limit(1);

        if (existingNotifications.length > 0) {
          continue;
        }

        console.log(`📬 Creating notification for scout admin: ${admin.name} (${admin.id})`);
        
        await storage.createNotification({
          userId: admin.id,
          type: 'scout_created',
          title: 'New Scout Added',
          message: `A new scout profile has been created: ${scoutName}`,
          entityType: 'user',
          entityId: scoutUserId,
          relatedUserId: scoutUserId,
        });

        notificationCount++;
      } catch (e: any) {
        console.error(`❌ Error creating notification for scout admin ${admin.id}: ${e?.message || e}`);
      }
    }

    console.log(`✅ Created ${notificationCount} notification(s) for ${scoutAdmins.length} scout admin(s)`);
  } catch (error: any) {
    console.error('❌ Error in notifyScoutAdminsOfNewScout:', error?.message || error);
  }
}

