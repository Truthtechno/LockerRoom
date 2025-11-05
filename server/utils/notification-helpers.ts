import { storage } from '../storage';
import { db } from '../db';
import { students, users, notifications, submissions, submissionReviews, submissionFinalFeedback, schools, schoolAdmins, systemAdmins, paymentTransactions, scoutProfiles } from '@shared/schema';
import { eq, and, inArray, sql, lt, gte, lte } from 'drizzle-orm';

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
 * Notify system admin and school admins about expiring subscriptions
 * Called when a subscription is within the warning period (1 week for monthly, 1 month for annual)
 */
export async function notifyExpiringSubscriptions(): Promise<void> {
  try {
    console.log('🔔 Checking for expiring subscriptions...');
    
    const now = new Date();
    const oneWeekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const oneMonthFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    
    // Get schools with expiring subscriptions
    const expiringSchools = await db
      .select()
      .from(schools)
      .where(
        and(
          eq(schools.isActive, true),
          sql`${schools.subscriptionExpiresAt} IS NOT NULL`,
          sql`${schools.subscriptionExpiresAt} > ${now}`,
          sql`(
            (${schools.paymentFrequency} = 'monthly' AND ${schools.subscriptionExpiresAt} <= ${oneWeekFromNow}) OR
            (${schools.paymentFrequency} = 'annual' AND ${schools.subscriptionExpiresAt} <= ${oneMonthFromNow})
          )`
        )
      );

    console.log(`📋 Found ${expiringSchools.length} school(s) with expiring subscriptions`);

    // Get all system admins
    const systemAdminUsers = await db
      .select({ userId: users.id })
      .from(users)
      .innerJoin(systemAdmins, eq(users.linkedId, systemAdmins.id))
      .where(eq(users.role, 'system_admin'));

    let notificationCount = 0;

    for (const school of expiringSchools) {
      const expiresAt = school.subscriptionExpiresAt ? new Date(school.subscriptionExpiresAt) : null;
      if (!expiresAt) continue;

      const daysUntilExpiry = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      // Notify system admins
      for (const admin of systemAdminUsers) {
        try {
          await storage.createNotification({
            userId: admin.userId,
            type: 'subscription_expiring',
            title: 'School Subscription Expiring',
            message: `${school.name}'s ${school.paymentFrequency} subscription expires in ${daysUntilExpiry} day${daysUntilExpiry !== 1 ? 's' : ''}. Please renew to avoid service interruption.`,
            entityType: 'school',
            entityId: school.id,
            metadata: JSON.stringify({
              schoolId: school.id,
              schoolName: school.name,
              expiresAt: expiresAt.toISOString(),
              daysUntilExpiry,
              paymentAmount: school.paymentAmount,
              paymentFrequency: school.paymentFrequency,
            }),
          });
          notificationCount++;
        } catch (error) {
          console.error(`Error creating notification for system admin ${admin.userId}:`, error);
        }
      }

      // Notify school admins
      const schoolAdminUsers = await db
        .select({ userId: users.id })
        .from(users)
        .innerJoin(schoolAdmins, eq(users.linkedId, schoolAdmins.id))
        .where(eq(schoolAdmins.schoolId, school.id));

      for (const admin of schoolAdminUsers) {
        try {
          await storage.createNotification({
            userId: admin.userId,
            type: 'subscription_expiring',
            title: 'Subscription Expiring Soon',
            message: `Your school's ${school.paymentFrequency} subscription expires in ${daysUntilExpiry} day${daysUntilExpiry !== 1 ? 's' : ''}. Please contact your administrator to renew.`,
            entityType: 'school',
            entityId: school.id,
            metadata: JSON.stringify({
              schoolId: school.id,
              schoolName: school.name,
              expiresAt: expiresAt.toISOString(),
              daysUntilExpiry,
              paymentAmount: school.paymentAmount,
              paymentFrequency: school.paymentFrequency,
            }),
          });
          notificationCount++;
        } catch (error) {
          console.error(`Error creating notification for school admin ${admin.userId}:`, error);
        }
      }
    }

    console.log(`✅ Created ${notificationCount} notification(s) for expiring subscriptions`);
  } catch (error: any) {
    console.error('❌ Error in notifyExpiringSubscriptions:', error?.message || error);
  }
}

/**
 * Auto-deactivate expired subscriptions
 * This should be run periodically to deactivate schools with expired subscriptions
 */
export async function deactivateExpiredSubscriptions(): Promise<void> {
  try {
    console.log('🔄 Checking for expired subscriptions...');
    
    const now = new Date();
    
    // Get schools with expired subscriptions that are still active
    const expiredSchools = await db
      .select()
      .from(schools)
      .where(
        and(
          eq(schools.isActive, true),
          sql`${schools.subscriptionExpiresAt} IS NOT NULL`,
          sql`${schools.subscriptionExpiresAt} <= ${now}`
        )
      );

    console.log(`📋 Found ${expiredSchools.length} school(s) with expired subscriptions`);

    for (const school of expiredSchools) {
      try {
        // Deactivate school
        await db.update(schools)
          .set({
            isActive: false,
            updatedAt: now,
          })
          .where(eq(schools.id, school.id));

        // Disable school admin accounts
        const schoolAdminUsers = await db
          .select({ id: users.id })
          .from(users)
          .innerJoin(schoolAdmins, eq(users.linkedId, schoolAdmins.id))
          .where(eq(schoolAdmins.schoolId, school.id));

        for (const adminUser of schoolAdminUsers) {
          await db.update(users)
            .set({ emailVerified: false })
            .where(eq(users.id, adminUser.id));
        }

        // Disable student accounts
        const studentUsers = await db
          .select({ id: users.id })
          .from(users)
          .innerJoin(students, eq(users.linkedId, students.id))
          .where(eq(students.schoolId, school.id));

        for (const studentUser of studentUsers) {
          await db.update(users)
            .set({ emailVerified: false })
            .where(eq(users.id, studentUser.id));
        }

        console.log(`✅ Deactivated school: ${school.name} (ID: ${school.id})`);
      } catch (error) {
        console.error(`Error deactivating school ${school.id}:`, error);
      }
    }

    console.log(`✅ Completed deactivation check`);
  } catch (error: any) {
    console.error('❌ Error in deactivateExpiredSubscriptions:', error?.message || error);
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

/**
 * Notify system admins when a student makes a payment for XEN Watch
 * Called when a payment transaction is completed for XEN Watch
 */
export async function notifySystemAdminsOfXenWatchPayment(transactionId: string, studentId: string, amountCents: number, currency: string): Promise<void> {
  try {
    console.log(`🔔 Creating XEN Watch payment notification for transaction ${transactionId} by student ${studentId}`);
    
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
    
    // Format amount
    const amount = (amountCents / 100).toFixed(2);
    const currencySymbol = currency.toUpperCase() === 'USD' ? '$' : currency.toUpperCase();
    
    // Get all system admins
    const systemAdminUsers = await db
      .select({ userId: users.id })
      .from(users)
      .innerJoin(systemAdmins, eq(users.linkedId, systemAdmins.id))
      .where(eq(users.role, 'system_admin'));

    console.log(`📋 Found ${systemAdminUsers.length} system admin(s) to notify`);

    if (systemAdminUsers.length === 0) {
      console.log(`ℹ️ No system admins found, skipping notifications`);
      return;
    }

    let notificationCount = 0;

    for (const admin of systemAdminUsers) {
      try {
        // Check if notification already exists to avoid duplicates
        const existingNotifications = await db
          .select()
          .from(notifications)
          .where(
            and(
              eq(notifications.userId, admin.userId),
              eq(notifications.entityType, 'payment_transaction'),
              eq(notifications.entityId, transactionId),
              eq(notifications.type, 'xen_watch_payment')
            )
          )
          .limit(1);

        if (existingNotifications.length > 0) {
          console.log(`ℹ️ Notification already exists for system admin ${admin.userId} about transaction ${transactionId}, skipping`);
          continue;
        }

        console.log(`📬 Creating payment notification for system admin: ${admin.userId}`);
        
        await storage.createNotification({
          userId: admin.userId,
          type: 'xen_watch_payment',
          title: 'XEN Watch Payment Received',
          message: `${studentInfo.name} made a payment of ${currencySymbol}${amount} for XEN Watch submission`,
          entityType: 'payment_transaction',
          entityId: transactionId,
          relatedUserId: studentId,
          metadata: JSON.stringify({
            transactionId,
            studentId,
            studentName: studentInfo.name,
            amountCents,
            amount,
            currency,
          }),
        });

        notificationCount++;
        console.log(`✅ Notification created for system admin ${admin.userId}`);
      } catch (e: any) {
        console.error(`❌ Error creating notification for system admin ${admin.userId}: ${e?.message || e}`);
      }
    }

    console.log(`✅ Created ${notificationCount} notification(s) for ${systemAdminUsers.length} system admin(s)`);
  } catch (error: any) {
    console.error('❌ Error in notifySystemAdminsOfXenWatchPayment:', error?.message || error);
  }
}

/**
 * Notify system admins when a new school is created
 */
export async function notifySystemAdminsOfNewSchool(schoolId: string, schoolName: string): Promise<void> {
  try {
    console.log(`🔔 Creating school creation notification for ${schoolName} (${schoolId})`);
    
    // Get all system admins
    const systemAdminUsers = await db
      .select({ userId: users.id })
      .from(users)
      .innerJoin(systemAdmins, eq(users.linkedId, systemAdmins.id))
      .where(eq(users.role, 'system_admin'));

    console.log(`📋 Found ${systemAdminUsers.length} system admin(s) to notify`);

    if (systemAdminUsers.length === 0) {
      console.log(`ℹ️ No system admins found, skipping notifications`);
      return;
    }

    let notificationCount = 0;

    for (const admin of systemAdminUsers) {
      try {
        // Check if notification already exists to avoid duplicates
        const existingNotifications = await db
          .select()
          .from(notifications)
          .where(
            and(
              eq(notifications.userId, admin.userId),
              eq(notifications.entityType, 'school'),
              eq(notifications.entityId, schoolId),
              eq(notifications.type, 'school_created')
            )
          )
          .limit(1);

        if (existingNotifications.length > 0) {
          continue;
        }

        console.log(`📬 Creating school creation notification for system admin: ${admin.userId}`);
        
        await storage.createNotification({
          userId: admin.userId,
          type: 'school_created',
          title: 'New School Created',
          message: `A new school "${schoolName}" has been added to the platform`,
          entityType: 'school',
          entityId: schoolId,
          metadata: JSON.stringify({
            schoolId,
            schoolName,
          }),
        });

        notificationCount++;
      } catch (e: any) {
        console.error(`❌ Error creating notification for system admin ${admin.userId}: ${e?.message || e}`);
      }
    }

    console.log(`✅ Created ${notificationCount} notification(s) for ${systemAdminUsers.length} system admin(s)`);
  } catch (error: any) {
    console.error('❌ Error in notifySystemAdminsOfNewSchool:', error?.message || error);
  }
}

/**
 * Notify system admins when a new school admin is created
 */
export async function notifySystemAdminsOfNewSchoolAdmin(schoolAdminId: string, schoolAdminName: string, schoolId: string, schoolName: string): Promise<void> {
  try {
    console.log(`🔔 Creating school admin creation notification for ${schoolAdminName} (${schoolAdminId})`);
    
    // Get all system admins
    const systemAdminUsers = await db
      .select({ userId: users.id })
      .from(users)
      .innerJoin(systemAdmins, eq(users.linkedId, systemAdmins.id))
      .where(eq(users.role, 'system_admin'));

    console.log(`📋 Found ${systemAdminUsers.length} system admin(s) to notify`);

    if (systemAdminUsers.length === 0) {
      console.log(`ℹ️ No system admins found, skipping notifications`);
      return;
    }

    let notificationCount = 0;

    for (const admin of systemAdminUsers) {
      try {
        // Check if notification already exists to avoid duplicates
        const existingNotifications = await db
          .select()
          .from(notifications)
          .where(
            and(
              eq(notifications.userId, admin.userId),
              eq(notifications.entityType, 'user'),
              eq(notifications.entityId, schoolAdminId),
              eq(notifications.type, 'school_admin_created')
            )
          )
          .limit(1);

        if (existingNotifications.length > 0) {
          continue;
        }

        console.log(`📬 Creating school admin creation notification for system admin: ${admin.userId}`);
        
        await storage.createNotification({
          userId: admin.userId,
          type: 'school_admin_created',
          title: 'New School Admin Created',
          message: `${schoolAdminName} has been added as an admin for ${schoolName}`,
          entityType: 'user',
          entityId: schoolAdminId,
          metadata: JSON.stringify({
            schoolAdminId,
            schoolAdminName,
            schoolId,
            schoolName,
          }),
        });

        notificationCount++;
      } catch (e: any) {
        console.error(`❌ Error creating notification for system admin ${admin.userId}: ${e?.message || e}`);
      }
    }

    console.log(`✅ Created ${notificationCount} notification(s) for ${systemAdminUsers.length} system admin(s)`);
  } catch (error: any) {
    console.error('❌ Error in notifySystemAdminsOfNewSchoolAdmin:', error?.message || error);
  }
}

/**
 * Notify system admins when a new xen scout is created
 */
export async function notifySystemAdminsOfNewXenScout(scoutUserId: string, scoutName: string, xenId: string): Promise<void> {
  try {
    console.log(`🔔 Creating xen scout creation notification for ${scoutName} (${scoutUserId})`);
    
    // Get all system admins
    const systemAdminUsers = await db
      .select({ userId: users.id })
      .from(users)
      .innerJoin(systemAdmins, eq(users.linkedId, systemAdmins.id))
      .where(eq(users.role, 'system_admin'));

    console.log(`📋 Found ${systemAdminUsers.length} system admin(s) to notify`);

    if (systemAdminUsers.length === 0) {
      console.log(`ℹ️ No system admins found, skipping notifications`);
      return;
    }

    let notificationCount = 0;

    for (const admin of systemAdminUsers) {
      try {
        // Check if notification already exists to avoid duplicates
        const existingNotifications = await db
          .select()
          .from(notifications)
          .where(
            and(
              eq(notifications.userId, admin.userId),
              eq(notifications.entityType, 'user'),
              eq(notifications.entityId, scoutUserId),
              eq(notifications.type, 'xen_scout_created')
            )
          )
          .limit(1);

        if (existingNotifications.length > 0) {
          continue;
        }

        console.log(`📬 Creating xen scout creation notification for system admin: ${admin.userId}`);
        
        await storage.createNotification({
          userId: admin.userId,
          type: 'xen_scout_created',
          title: 'New XEN Scout Created',
          message: `A new XEN Scout ${scoutName} (${xenId}) has been added to the platform`,
          entityType: 'user',
          entityId: scoutUserId,
          relatedUserId: scoutUserId,
          metadata: JSON.stringify({
            scoutUserId,
            scoutName,
            xenId,
          }),
        });

        notificationCount++;
      } catch (e: any) {
        console.error(`❌ Error creating notification for system admin ${admin.userId}: ${e?.message || e}`);
      }
    }

    console.log(`✅ Created ${notificationCount} notification(s) for ${systemAdminUsers.length} system admin(s)`);
  } catch (error: any) {
    console.error('❌ Error in notifySystemAdminsOfNewXenScout:', error?.message || error);
  }
}

/**
 * Notify system admins when a new scout admin is created
 */
export async function notifySystemAdminsOfNewScoutAdmin(scoutAdminUserId: string, scoutAdminName: string, xenId: string): Promise<void> {
  try {
    console.log(`🔔 Creating scout admin creation notification for ${scoutAdminName} (${scoutAdminUserId})`);
    
    // Get all system admins
    const systemAdminUsers = await db
      .select({ userId: users.id })
      .from(users)
      .innerJoin(systemAdmins, eq(users.linkedId, systemAdmins.id))
      .where(eq(users.role, 'system_admin'));

    console.log(`📋 Found ${systemAdminUsers.length} system admin(s) to notify`);

    if (systemAdminUsers.length === 0) {
      console.log(`ℹ️ No system admins found, skipping notifications`);
      return;
    }

    let notificationCount = 0;

    for (const admin of systemAdminUsers) {
      try {
        // Check if notification already exists to avoid duplicates
        const existingNotifications = await db
          .select()
          .from(notifications)
          .where(
            and(
              eq(notifications.userId, admin.userId),
              eq(notifications.entityType, 'user'),
              eq(notifications.entityId, scoutAdminUserId),
              eq(notifications.type, 'scout_admin_created')
            )
          )
          .limit(1);

        if (existingNotifications.length > 0) {
          continue;
        }

        console.log(`📬 Creating scout admin creation notification for system admin: ${admin.userId}`);
        
        await storage.createNotification({
          userId: admin.userId,
          type: 'scout_admin_created',
          title: 'New Scout Admin Created',
          message: `A new Scout Admin ${scoutAdminName} (${xenId}) has been added to the platform`,
          entityType: 'user',
          entityId: scoutAdminUserId,
          relatedUserId: scoutAdminUserId,
          metadata: JSON.stringify({
            scoutAdminUserId,
            scoutAdminName,
            xenId,
          }),
        });

        notificationCount++;
      } catch (e: any) {
        console.error(`❌ Error creating notification for system admin ${admin.userId}: ${e?.message || e}`);
      }
    }

    console.log(`✅ Created ${notificationCount} notification(s) for ${systemAdminUsers.length} system admin(s)`);
  } catch (error: any) {
    console.error('❌ Error in notifySystemAdminsOfNewScoutAdmin:', error?.message || error);
  }
}

/**
 * Notify system admins and school admins when a school payment is recorded
 * Supports: initial, renewal, student_limit_increase, student_limit_decrease, frequency_change
 */
export async function notifySchoolPaymentRecorded(
  paymentRecordId: string,
  schoolId: string,
  schoolName: string,
  paymentAmount: string,
  paymentFrequency: string,
  paymentType: string,
  studentLimitBefore: number | null,
  studentLimitAfter: number | null,
  oldFrequency: string | null,
  newFrequency: string | null
): Promise<void> {
  try {
    console.log(`🔔 Creating school payment notification for ${schoolName} (${schoolId}) - Type: ${paymentType}`);
    
    // Get all system admins
    const systemAdminUsers = await db
      .select({ userId: users.id })
      .from(users)
      .innerJoin(systemAdmins, eq(users.linkedId, systemAdmins.id))
      .where(eq(users.role, 'system_admin'));

    // Get all school admins for this school
    const schoolAdminUsers = await db
      .select({ userId: users.id })
      .from(users)
      .innerJoin(schoolAdmins, eq(users.linkedId, schoolAdmins.id))
      .where(eq(schoolAdmins.schoolId, schoolId));

    // Build notification message based on payment type
    let title = '';
    let message = '';
    let notificationType = 'school_payment_recorded';

    switch (paymentType) {
      case 'renewal':
        title = 'School Subscription Renewed';
        message = `${schoolName}'s ${paymentFrequency} subscription has been renewed for $${paymentAmount}`;
        notificationType = 'school_renewal';
        break;
      case 'student_limit_increase':
        title = 'Student Limit Increased';
        message = `${schoolName}'s student limit has been increased from ${studentLimitBefore} to ${studentLimitAfter} students (Payment: $${paymentAmount})`;
        notificationType = 'school_limit_increase';
        break;
      case 'student_limit_decrease':
        title = 'Student Limit Decreased';
        message = `${schoolName}'s student limit has been decreased from ${studentLimitBefore} to ${studentLimitAfter} students`;
        notificationType = 'school_limit_decrease';
        break;
      case 'frequency_change':
        title = 'Payment Frequency Changed';
        message = `${schoolName}'s payment frequency changed from ${oldFrequency} to ${newFrequency} (Payment: $${paymentAmount})`;
        notificationType = 'school_frequency_change';
        break;
      case 'initial':
      default:
        title = 'School Payment Recorded';
        message = `Payment of $${paymentAmount} (${paymentFrequency}) recorded for ${schoolName}`;
        notificationType = 'school_payment_recorded';
        break;
    }

    const allRecipients = [...systemAdminUsers, ...schoolAdminUsers];
    console.log(`📋 Found ${systemAdminUsers.length} system admin(s) and ${schoolAdminUsers.length} school admin(s) to notify`);

    if (allRecipients.length === 0) {
      console.log(`ℹ️ No recipients found, skipping notifications`);
      return;
    }

    let notificationCount = 0;

    for (const recipient of allRecipients) {
      try {
        // Check if notification already exists to avoid duplicates
        const existingNotifications = await db
          .select()
          .from(notifications)
          .where(
            and(
              eq(notifications.userId, recipient.userId),
              eq(notifications.entityType, 'school_payment_record'),
              eq(notifications.entityId, paymentRecordId),
              eq(notifications.type, notificationType)
            )
          )
          .limit(1);

        if (existingNotifications.length > 0) {
          continue;
        }

        console.log(`📬 Creating payment notification for user: ${recipient.userId}`);
        
        await storage.createNotification({
          userId: recipient.userId,
          type: notificationType,
          title,
          message,
          entityType: 'school_payment_record',
          entityId: paymentRecordId,
          metadata: JSON.stringify({
            paymentRecordId,
            schoolId,
            schoolName,
            paymentAmount,
            paymentFrequency,
            paymentType,
            studentLimitBefore,
            studentLimitAfter,
            oldFrequency,
            newFrequency,
          }),
        });

        notificationCount++;
      } catch (e: any) {
        console.error(`❌ Error creating notification for user ${recipient.userId}: ${e?.message || e}`);
      }
    }

    console.log(`✅ Created ${notificationCount} notification(s) for ${allRecipients.length} recipient(s)`);
  } catch (error: any) {
    console.error('❌ Error in notifySchoolPaymentRecorded:', error?.message || error);
  }
}

/**
 * Notify system admin, scouts admin, and xen scouts when a form is created
 */
export async function notifyFormCreated(formTemplateId: string, formName: string, createdByUserId: string): Promise<void> {
  try {
    console.log(`🔔 Creating notifications for form ${formTemplateId} created by ${createdByUserId}`);
    
    // Get all system admins, scout admins, and xen scouts
    const recipients = await db
      .select()
      .from(users)
      .where(inArray(users.role, ['system_admin', 'scout_admin', 'xen_scout']));

    console.log(`📋 Found ${recipients.length} recipient(s) to notify`);

    if (recipients.length === 0) {
      console.log(`ℹ️ No recipients found, skipping notifications`);
      return;
    }

    let notificationCount = 0;

    for (const recipient of recipients) {
      try {
        // Skip the creator of the form
        if (recipient.id === createdByUserId) {
          continue;
        }

        // Check if notification already exists
        const existingNotifications = await db
          .select()
          .from(notifications)
          .where(
            and(
              eq(notifications.userId, recipient.id),
              eq(notifications.entityType, 'evaluation_form_template'),
              eq(notifications.entityId, formTemplateId),
              eq(notifications.type, 'form_created')
            )
          )
          .limit(1);

        if (existingNotifications.length > 0) {
          continue;
        }

        console.log(`📬 Creating notification for user: ${recipient.name} (${recipient.id})`);
        
        await storage.createNotification({
          userId: recipient.id,
          type: 'form_created',
          title: 'New Evaluation Form Created',
          message: `A new evaluation form "${formName}" has been created and is available for use`,
          entityType: 'evaluation_form_template',
          entityId: formTemplateId,
          relatedUserId: createdByUserId,
        });

        notificationCount++;
        console.log(`✅ Notification created for ${recipient.name}`);
      } catch (e: any) {
        console.error(`❌ Error creating notification for user ${recipient.id}: ${e?.message || e}`);
      }
    }

    console.log(`✅ Created ${notificationCount} notification(s) for ${recipients.length} recipient(s)`);
  } catch (error: any) {
    console.error('❌ Error in notifyFormCreated:', error?.message || error);
  }
}

/**
 * Notify scout admin, system admin, and the scout who submitted when a form is submitted
 */
export async function notifyFormSubmitted(submissionId: string, formTemplateId: string, formName: string, submittedByUserId: string, submittedByUserName: string, studentName: string | null): Promise<void> {
  try {
    console.log(`🔔 Creating notifications for form submission ${submissionId} by ${submittedByUserId}`);
    console.log(`📋 Form details: ${formName} (${formTemplateId}), Student: ${studentName || 'N/A'}`);
    
    // Fetch submitter user info to ensure we have the name and profile picture
    const submitterUser = await db
      .select()
      .from(users)
      .where(eq(users.id, submittedByUserId))
      .limit(1);
    
    if (submitterUser.length === 0) {
      console.error(`❌ Submitter user not found: ${submittedByUserId}`);
      return;
    }
    
    // Always use the name from the database, not the provided parameter
    // The provided name might be undefined since req.user doesn't include name
    let finalSubmittedByUserName = submitterUser[0].name;
    
    // If name is still missing, try to get it from scoutProfiles
    if (!finalSubmittedByUserName && (submitterUser[0].role === 'xen_scout' || submitterUser[0].role === 'scout_admin')) {
      const scoutProfile = await db
        .select({ name: scoutProfiles.name })
        .from(scoutProfiles)
        .where(eq(scoutProfiles.userId, submittedByUserId))
        .limit(1);
      if (scoutProfile[0]?.name) {
        finalSubmittedByUserName = scoutProfile[0].name;
      }
    }
    
    // Final fallback
    if (!finalSubmittedByUserName) {
      finalSubmittedByUserName = submittedByUserName || 'A scout';
    }
    
    console.log(`📋 Submitter name: ${finalSubmittedByUserName} (from DB: ${submitterUser[0].name || 'none'}, provided: ${submittedByUserName || 'none'})`);
    
    // Get all system admins (need to join with systemAdmins table)
    console.log('🔍 Fetching system admins...');
    const systemAdminUsers = await db
      .select({ id: users.id, name: users.name, role: users.role })
      .from(users)
      .innerJoin(systemAdmins, eq(users.linkedId, systemAdmins.id))
      .where(eq(users.role, 'system_admin'));
    console.log(`📋 Found ${systemAdminUsers.length} system admin(s):`, systemAdminUsers.map(u => ({ id: u.id, name: u.name })));

    // Get all scout admins
    console.log('🔍 Fetching scout admins...');
    const scoutAdminUsers = await db
      .select()
      .from(users)
      .where(eq(users.role, 'scout_admin'));
    console.log(`📋 Found ${scoutAdminUsers.length} scout admin(s):`, scoutAdminUsers.map(u => ({ id: u.id, name: u.name })));

    // Combine all recipients
    const recipients = [...systemAdminUsers, ...scoutAdminUsers];
    if (submitterUser[0] && (submitterUser[0].role === 'xen_scout' || submitterUser[0].role === 'scout_admin')) {
      // Only add if not already in recipients list
      if (!recipients.find(r => r.id === submitterUser[0].id)) {
        recipients.push(submitterUser[0]);
      }
    }

    console.log(`📋 Found ${recipients.length} recipient(s) to notify`);

    if (recipients.length === 0) {
      console.log(`ℹ️ No recipients found, skipping notifications`);
      return;
    }

    let notificationCount = 0;

    for (const recipient of recipients) {
      try {
        // Check if notification already exists
        const existingNotifications = await db
          .select()
          .from(notifications)
          .where(
            and(
              eq(notifications.userId, recipient.id),
              eq(notifications.entityType, 'evaluation_form_submission'),
              eq(notifications.entityId, submissionId),
              eq(notifications.type, 'form_submitted')
            )
          )
          .limit(1);

        if (existingNotifications.length > 0) {
          continue;
        }

        console.log(`📬 Creating notification for user: ${recipient.name} (${recipient.id})`);
        
        const studentInfo = studentName ? ` for ${studentName}` : '';
        // Customize message for the submitter - use the final name we determined earlier
        const message = recipient.id === submittedByUserId
          ? `You have successfully submitted the evaluation form "${formName}"${studentInfo}`
          : `${finalSubmittedByUserName} has submitted the evaluation form "${formName}"${studentInfo}`;
        
        await storage.createNotification({
          userId: recipient.id,
          type: 'form_submitted',
          title: recipient.id === submittedByUserId ? 'Form Submission Confirmed' : 'New Form Submission',
          message,
          entityType: 'evaluation_form_submission',
          entityId: submissionId,
          relatedUserId: submittedByUserId,
          metadata: JSON.stringify({
            formTemplateId,
            formName,
            studentName,
          }),
        });

        notificationCount++;
        console.log(`✅ Notification created for ${recipient.name}`);
      } catch (e: any) {
        console.error(`❌ Error creating notification for user ${recipient.id}: ${e?.message || e}`);
      }
    }

    console.log(`✅ Created ${notificationCount} notification(s) for ${recipients.length} recipient(s)`);
  } catch (error: any) {
    console.error('❌ Error in notifyFormSubmitted:', error?.message || error);
  }
}

