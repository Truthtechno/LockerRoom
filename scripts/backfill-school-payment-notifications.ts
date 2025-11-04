import { db } from '../server/db';
import { schools, schoolPaymentRecords, users, systemAdmins, schoolAdmins, notifications } from '@shared/schema';
import { eq, and, sql } from 'drizzle-orm';
import { storage } from '../server/storage';

/**
 * Backfill script to create notifications for existing school payment records
 * This will create notifications for system admins and school admins for all historical payments
 */

async function backfillSchoolPaymentNotifications() {
  console.log('💳 Backfilling school payment notifications...\n');
  console.log('='.repeat(60));
  console.log('This script will create notifications for:');
  console.log('  - All existing school payment records');
  console.log('  - System admins AND school admins for each payment');
  console.log('='.repeat(60));
  console.log('✅ Safe to run - only ADDS notifications, does not modify existing data\n');

  try {
    // Get all system admins
    const systemAdminUsers = await db
      .select({ userId: users.id })
      .from(users)
      .innerJoin(systemAdmins, eq(users.linkedId, systemAdmins.id))
      .where(eq(users.role, 'system_admin'));

    if (systemAdminUsers.length === 0) {
      console.log('⚠️  No system admins found, skipping payment notifications\n');
      return { created: 0, skipped: 0 };
    }

    // Get all payment records with school info
    const allPayments = await db
      .select({
        paymentId: schoolPaymentRecords.id,
        schoolId: schoolPaymentRecords.schoolId,
        schoolName: schools.name,
        paymentAmount: schoolPaymentRecords.paymentAmount,
        paymentFrequency: schoolPaymentRecords.paymentFrequency,
        paymentType: schoolPaymentRecords.paymentType,
        studentLimitBefore: schoolPaymentRecords.studentLimitBefore,
        studentLimitAfter: schoolPaymentRecords.studentLimitAfter,
        oldFrequency: schoolPaymentRecords.oldFrequency,
        newFrequency: schoolPaymentRecords.newFrequency,
      })
      .from(schoolPaymentRecords)
      .innerJoin(schools, eq(schoolPaymentRecords.schoolId, schools.id))
      .orderBy(schoolPaymentRecords.recordedAt);

    console.log(`📋 Found ${allPayments.length} payment record(s) to process\n`);

    if (allPayments.length === 0) {
      console.log('ℹ️  No payment records found, skipping\n');
      return { created: 0, skipped: 0 };
    }

    let totalCreated = 0;
    let totalSkipped = 0;

    for (const payment of allPayments) {
      try {
        // Get school admins for this school
        const schoolAdminUsers = await db
          .select({ userId: users.id })
          .from(users)
          .innerJoin(schoolAdmins, eq(users.linkedId, schoolAdmins.id))
          .where(eq(schoolAdmins.schoolId, payment.schoolId));

        const allRecipients = [...systemAdminUsers, ...schoolAdminUsers];

        // Build notification message based on payment type
        let title = '';
        let message = '';
        let notificationType = 'school_payment_recorded';

        switch (payment.paymentType) {
          case 'renewal':
            title = 'School Subscription Renewed';
            message = `${payment.schoolName}'s ${payment.paymentFrequency} subscription has been renewed for $${payment.paymentAmount}`;
            notificationType = 'school_renewal';
            break;
          case 'student_limit_increase':
            title = 'Student Limit Increased';
            message = `${payment.schoolName}'s student limit has been increased from ${payment.studentLimitBefore} to ${payment.studentLimitAfter} students (Payment: $${payment.paymentAmount})`;
            notificationType = 'school_limit_increase';
            break;
          case 'student_limit_decrease':
            title = 'Student Limit Decreased';
            message = `${payment.schoolName}'s student limit has been decreased from ${payment.studentLimitBefore} to ${payment.studentLimitAfter} students`;
            notificationType = 'school_limit_decrease';
            break;
          case 'frequency_change':
            title = 'Payment Frequency Changed';
            message = `${payment.schoolName}'s payment frequency changed from ${payment.oldFrequency} to ${payment.newFrequency} (Payment: $${payment.paymentAmount})`;
            notificationType = 'school_frequency_change';
            break;
          case 'initial':
          default:
            title = 'School Payment Recorded';
            message = `Payment of $${payment.paymentAmount} (${payment.paymentFrequency}) recorded for ${payment.schoolName}`;
            notificationType = 'school_payment_recorded';
            break;
        }

        let createdForPayment = 0;
        let skippedForPayment = 0;

        for (const recipient of allRecipients) {
          try {
            // Check if notification already exists
            const existing = await db
              .select()
              .from(notifications)
              .where(
                and(
                  eq(notifications.userId, recipient.userId),
                  eq(notifications.entityType, 'school_payment_record'),
                  eq(notifications.entityId, payment.paymentId),
                  eq(notifications.type, notificationType)
                )
              )
              .limit(1);

            if (existing.length > 0) {
              skippedForPayment++;
              continue;
            }

            await storage.createNotification({
              userId: recipient.userId,
              type: notificationType,
              title,
              message,
              entityType: 'school_payment_record',
              entityId: payment.paymentId,
              metadata: JSON.stringify({
                paymentRecordId: payment.paymentId,
                schoolId: payment.schoolId,
                schoolName: payment.schoolName,
                paymentAmount: payment.paymentAmount,
                paymentFrequency: payment.paymentFrequency,
                paymentType: payment.paymentType,
                studentLimitBefore: payment.studentLimitBefore,
                studentLimitAfter: payment.studentLimitAfter,
                oldFrequency: payment.oldFrequency,
                newFrequency: payment.newFrequency,
              }),
            });

            createdForPayment++;
          } catch (e: any) {
            if (e?.message?.includes('duplicate') || e?.code === '23505') {
              skippedForPayment++;
            } else {
              console.error(`Error creating notification for payment ${payment.paymentId}:`, e.message);
              skippedForPayment++;
            }
          }
        }

        totalCreated += createdForPayment;
        totalSkipped += skippedForPayment;

        if (createdForPayment > 0) {
          console.log(`   ${payment.schoolName} (${payment.paymentType}): ${createdForPayment} created, ${skippedForPayment} skipped`);
        }
      } catch (e: any) {
        console.error(`Error processing payment ${payment.paymentId}:`, e.message);
        totalSkipped++;
      }
    }

    console.log(`\n✅ Backfill complete!`);
    console.log(`   Total Created: ${totalCreated} notifications`);
    console.log(`   Total Skipped: ${totalSkipped} (already exist or errors)\n`);

    return { created: totalCreated, skipped: totalSkipped };
  } catch (error) {
    console.error('❌ Backfill error:', error);
    throw error;
  }
}

async function main() {
  console.log('🚀 Starting School Payment Notifications Backfill...\n');

  try {
    const result = await backfillSchoolPaymentNotifications();

    if (result.created > 0) {
      console.log('🎉 Backfill completed successfully!');
      console.log(`📬 ${result.created} notifications created for existing school payments`);
      console.log('✅ System admins and school admins should now see notifications for their payment history');
    } else {
      console.log('ℹ️  No new notifications were created (they may already exist)');
    }

  } catch (error) {
    console.error('❌ Backfill failed:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('backfill-school-payment-notifications.ts')) {
  main()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Script failed:', error);
      process.exit(1);
    });
}

export { backfillSchoolPaymentNotifications };

