import { db } from '../server/db';
import { schools, schoolAdmins, users, systemAdmins, notifications, paymentTransactions, students } from '@shared/schema';
import { eq, and, sql } from 'drizzle-orm';
import { storage } from '../server/storage';

/**
 * Backfill script to create system admin notifications for:
 * - Existing schools
 * - Existing school admins
 * - Existing XEN scouts
 * - Existing scout admins
 * - Existing XEN Watch payment transactions
 * 
 * This will create notifications for all system admins for historical data
 */

async function backfillSchoolNotifications() {
  console.log('🏫 Backfilling school creation notifications...\n');

  try {
    // Get all system admins
    const systemAdminUsers = await db
      .select({ userId: users.id })
      .from(users)
      .innerJoin(systemAdmins, eq(users.linkedId, systemAdmins.id))
      .where(eq(users.role, 'system_admin'));

    if (systemAdminUsers.length === 0) {
      console.log('⚠️  No system admins found, skipping school notifications\n');
      return { created: 0, skipped: 0 };
    }

    // Get all schools
    const allSchools = await db
      .select()
      .from(schools)
      .orderBy(schools.createdAt);

    console.log(`📋 Found ${allSchools.length} school(s) to process`);

    let createdCount = 0;
    let skippedCount = 0;

    for (const school of allSchools) {
      for (const admin of systemAdminUsers) {
        try {
          // Check if notification already exists
          const existing = await db
            .select()
            .from(notifications)
            .where(
              and(
                eq(notifications.userId, admin.userId),
                eq(notifications.entityType, 'school'),
                eq(notifications.entityId, school.id),
                eq(notifications.type, 'school_created')
              )
            )
            .limit(1);

          if (existing.length > 0) {
            skippedCount++;
            continue;
          }

          await storage.createNotification({
            userId: admin.userId,
            type: 'school_created',
            title: 'New School Created',
            message: `A new school "${school.name}" has been added to the platform`,
            entityType: 'school',
            entityId: school.id,
            metadata: JSON.stringify({
              schoolId: school.id,
              schoolName: school.name,
            }),
          });

          createdCount++;
        } catch (e: any) {
          if (e?.message?.includes('duplicate') || e?.code === '23505') {
            skippedCount++;
          } else {
            console.error(`Error creating notification for school ${school.id}:`, e.message);
            skippedCount++;
          }
        }
      }
    }

    console.log(`   Created: ${createdCount}, Skipped: ${skippedCount}\n`);
    return { created: createdCount, skipped: skippedCount };
  } catch (error) {
    console.error('❌ Error backfilling school notifications:', error);
    return { created: 0, skipped: 0 };
  }
}

async function backfillSchoolAdminNotifications() {
  console.log('👨‍💼 Backfilling school admin creation notifications...\n');

  try {
    // Get all system admins
    const systemAdminUsers = await db
      .select({ userId: users.id })
      .from(users)
      .innerJoin(systemAdmins, eq(users.linkedId, systemAdmins.id))
      .where(eq(users.role, 'system_admin'));

    if (systemAdminUsers.length === 0) {
      console.log('⚠️  No system admins found, skipping school admin notifications\n');
      return { created: 0, skipped: 0 };
    }

    // Get all school admins with their school info
    const allSchoolAdmins = await db
      .select({
        adminId: schoolAdmins.id,
        adminName: schoolAdmins.name,
        schoolId: schoolAdmins.schoolId,
        schoolName: schools.name,
        userId: users.id,
      })
      .from(schoolAdmins)
      .innerJoin(schools, eq(schoolAdmins.schoolId, schools.id))
      .innerJoin(users, eq(users.linkedId, schoolAdmins.id))
      .orderBy(schoolAdmins.createdAt);

    console.log(`📋 Found ${allSchoolAdmins.length} school admin(s) to process`);

    let createdCount = 0;
    let skippedCount = 0;

    for (const schoolAdmin of allSchoolAdmins) {
      for (const admin of systemAdminUsers) {
        try {
          // Check if notification already exists
          const existing = await db
            .select()
            .from(notifications)
            .where(
              and(
                eq(notifications.userId, admin.userId),
                eq(notifications.entityType, 'user'),
                eq(notifications.entityId, schoolAdmin.userId),
                eq(notifications.type, 'school_admin_created')
              )
            )
            .limit(1);

          if (existing.length > 0) {
            skippedCount++;
            continue;
          }

          await storage.createNotification({
            userId: admin.userId,
            type: 'school_admin_created',
            title: 'New School Admin Created',
            message: `${schoolAdmin.adminName} has been added as an admin for ${schoolAdmin.schoolName}`,
            entityType: 'user',
            entityId: schoolAdmin.userId,
            metadata: JSON.stringify({
              schoolAdminId: schoolAdmin.adminId,
              schoolAdminName: schoolAdmin.adminName,
              schoolId: schoolAdmin.schoolId,
              schoolName: schoolAdmin.schoolName,
            }),
          });

          createdCount++;
        } catch (e: any) {
          if (e?.message?.includes('duplicate') || e?.code === '23505') {
            skippedCount++;
          } else {
            console.error(`Error creating notification for school admin ${schoolAdmin.adminId}:`, e.message);
            skippedCount++;
          }
        }
      }
    }

    console.log(`   Created: ${createdCount}, Skipped: ${skippedCount}\n`);
    return { created: createdCount, skipped: skippedCount };
  } catch (error) {
    console.error('❌ Error backfilling school admin notifications:', error);
    return { created: 0, skipped: 0 };
  }
}

async function backfillXenScoutNotifications() {
  console.log('🎯 Backfilling XEN scout creation notifications...\n');

  try {
    // Get all system admins
    const systemAdminUsers = await db
      .select({ userId: users.id })
      .from(users)
      .innerJoin(systemAdmins, eq(users.linkedId, systemAdmins.id))
      .where(eq(users.role, 'system_admin'));

    if (systemAdminUsers.length === 0) {
      console.log('⚠️  No system admins found, skipping XEN scout notifications\n');
      return { created: 0, skipped: 0 };
    }

    // Get all XEN scouts
    const allXenScouts = await db
      .select({
        id: users.id,
        name: users.name,
        xenId: users.xenId,
      })
      .from(users)
      .where(eq(users.role, 'xen_scout'))
      .orderBy(users.createdAt);

    console.log(`📋 Found ${allXenScouts.length} XEN scout(s) to process`);

    let createdCount = 0;
    let skippedCount = 0;

    for (const scout of allXenScouts) {
      if (!scout.xenId) {
        skippedCount++;
        continue;
      }

      for (const admin of systemAdminUsers) {
        try {
          // Check if notification already exists
          const existing = await db
            .select()
            .from(notifications)
            .where(
              and(
                eq(notifications.userId, admin.userId),
                eq(notifications.entityType, 'user'),
                eq(notifications.entityId, scout.id),
                eq(notifications.type, 'xen_scout_created')
              )
            )
            .limit(1);

          if (existing.length > 0) {
            skippedCount++;
            continue;
          }

          await storage.createNotification({
            userId: admin.userId,
            type: 'xen_scout_created',
            title: 'New XEN Scout Created',
            message: `A new XEN Scout ${scout.name || 'Unknown'} (${scout.xenId}) has been added to the platform`,
            entityType: 'user',
            entityId: scout.id,
            relatedUserId: scout.id,
            metadata: JSON.stringify({
              scoutUserId: scout.id,
              scoutName: scout.name,
              xenId: scout.xenId,
            }),
          });

          createdCount++;
        } catch (e: any) {
          if (e?.message?.includes('duplicate') || e?.code === '23505') {
            skippedCount++;
          } else {
            console.error(`Error creating notification for XEN scout ${scout.id}:`, e.message);
            skippedCount++;
          }
        }
      }
    }

    console.log(`   Created: ${createdCount}, Skipped: ${skippedCount}\n`);
    return { created: createdCount, skipped: skippedCount };
  } catch (error) {
    console.error('❌ Error backfilling XEN scout notifications:', error);
    return { created: 0, skipped: 0 };
  }
}

async function backfillScoutAdminNotifications() {
  console.log('🛡️  Backfilling scout admin creation notifications...\n');

  try {
    // Get all system admins
    const systemAdminUsers = await db
      .select({ userId: users.id })
      .from(users)
      .innerJoin(systemAdmins, eq(users.linkedId, systemAdmins.id))
      .where(eq(users.role, 'system_admin'));

    if (systemAdminUsers.length === 0) {
      console.log('⚠️  No system admins found, skipping scout admin notifications\n');
      return { created: 0, skipped: 0 };
    }

    // Get all scout admins
    const allScoutAdmins = await db
      .select({
        id: users.id,
        name: users.name,
        xenId: users.xenId,
      })
      .from(users)
      .where(eq(users.role, 'scout_admin'))
      .orderBy(users.createdAt);

    console.log(`📋 Found ${allScoutAdmins.length} scout admin(s) to process`);

    let createdCount = 0;
    let skippedCount = 0;

    for (const scoutAdmin of allScoutAdmins) {
      if (!scoutAdmin.xenId) {
        skippedCount++;
        continue;
      }

      for (const admin of systemAdminUsers) {
        try {
          // Check if notification already exists
          const existing = await db
            .select()
            .from(notifications)
            .where(
              and(
                eq(notifications.userId, admin.userId),
                eq(notifications.entityType, 'user'),
                eq(notifications.entityId, scoutAdmin.id),
                eq(notifications.type, 'scout_admin_created')
              )
            )
            .limit(1);

          if (existing.length > 0) {
            skippedCount++;
            continue;
          }

          await storage.createNotification({
            userId: admin.userId,
            type: 'scout_admin_created',
            title: 'New Scout Admin Created',
            message: `A new Scout Admin ${scoutAdmin.name || 'Unknown'} (${scoutAdmin.xenId}) has been added to the platform`,
            entityType: 'user',
            entityId: scoutAdmin.id,
            relatedUserId: scoutAdmin.id,
            metadata: JSON.stringify({
              scoutAdminUserId: scoutAdmin.id,
              scoutAdminName: scoutAdmin.name,
              xenId: scoutAdmin.xenId,
            }),
          });

          createdCount++;
        } catch (e: any) {
          if (e?.message?.includes('duplicate') || e?.code === '23505') {
            skippedCount++;
          } else {
            console.error(`Error creating notification for scout admin ${scoutAdmin.id}:`, e.message);
            skippedCount++;
          }
        }
      }
    }

    console.log(`   Created: ${createdCount}, Skipped: ${skippedCount}\n`);
    return { created: createdCount, skipped: skippedCount };
  } catch (error) {
    console.error('❌ Error backfilling scout admin notifications:', error);
    return { created: 0, skipped: 0 };
  }
}

async function backfillXenWatchPaymentNotifications() {
  console.log('💳 Backfilling XEN Watch payment notifications...\n');

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

    // Get all completed XEN Watch payment transactions
    const allPayments = await db
      .select()
      .from(paymentTransactions)
      .where(
        and(
          eq(paymentTransactions.type, 'xen_watch'),
          eq(paymentTransactions.status, 'completed')
        )
      )
      .orderBy(paymentTransactions.createdAt);

    console.log(`📋 Found ${allPayments.length} XEN Watch payment(s) to process`);

    let createdCount = 0;
    let skippedCount = 0;

    for (const payment of allPayments) {
      // Get student info
      const studentInfo = await db
        .select()
        .from(students)
        .where(eq(students.userId, payment.userId))
        .limit(1);

      if (studentInfo.length === 0) {
        skippedCount++;
        continue;
      }

      const student = studentInfo[0];
      const amount = (payment.amountCents / 100).toFixed(2);
      const currencySymbol = payment.currency.toUpperCase() === 'USD' ? '$' : payment.currency.toUpperCase();

      for (const admin of systemAdminUsers) {
        try {
          // Check if notification already exists
          const existing = await db
            .select()
            .from(notifications)
            .where(
              and(
                eq(notifications.userId, admin.userId),
                eq(notifications.entityType, 'payment_transaction'),
                eq(notifications.entityId, payment.id),
                eq(notifications.type, 'xen_watch_payment')
              )
            )
            .limit(1);

          if (existing.length > 0) {
            skippedCount++;
            continue;
          }

          await storage.createNotification({
            userId: admin.userId,
            type: 'xen_watch_payment',
            title: 'XEN Watch Payment Received',
            message: `${student.name} made a payment of ${currencySymbol}${amount} for XEN Watch submission`,
            entityType: 'payment_transaction',
            entityId: payment.id,
            relatedUserId: payment.userId,
            metadata: JSON.stringify({
              transactionId: payment.id,
              studentId: payment.userId,
              studentName: student.name,
              amountCents: payment.amountCents,
              amount,
              currency: payment.currency,
            }),
          });

          createdCount++;
        } catch (e: any) {
          if (e?.message?.includes('duplicate') || e?.code === '23505') {
            skippedCount++;
          } else {
            console.error(`Error creating notification for payment ${payment.id}:`, e.message);
            skippedCount++;
          }
        }
      }
    }

    console.log(`   Created: ${createdCount}, Skipped: ${skippedCount}\n`);
    return { created: createdCount, skipped: skippedCount };
  } catch (error) {
    console.error('❌ Error backfilling payment notifications:', error);
    return { created: 0, skipped: 0 };
  }
}

async function main() {
  console.log('🚀 Starting System Admin Notifications Backfill...\n');
  console.log('='.repeat(60));
  console.log('This script will create notifications for system admins for:');
  console.log('  - All existing schools');
  console.log('  - All existing school admins');
  console.log('  - All existing XEN scouts');
  console.log('  - All existing scout admins');
  console.log('  - All completed XEN Watch payments');
  console.log('='.repeat(60));
  console.log('✅ Safe to run - only ADDS notifications, does not modify existing data\n');

  try {
    const results = {
      schools: { created: 0, skipped: 0 },
      schoolAdmins: { created: 0, skipped: 0 },
      xenScouts: { created: 0, skipped: 0 },
      scoutAdmins: { created: 0, skipped: 0 },
      payments: { created: 0, skipped: 0 },
    };

    // Backfill each type
    results.schools = await backfillSchoolNotifications();
    results.schoolAdmins = await backfillSchoolAdminNotifications();
    results.xenScouts = await backfillXenScoutNotifications();
    results.scoutAdmins = await backfillScoutAdminNotifications();
    results.payments = await backfillXenWatchPaymentNotifications();

    // Summary
    console.log('='.repeat(60));
    console.log('📊 Backfill Summary:');
    console.log('='.repeat(60));
    console.log(`🏫 Schools:        ${results.schools.created} created, ${results.schools.skipped} skipped`);
    console.log(`👨‍💼 School Admins:  ${results.schoolAdmins.created} created, ${results.schoolAdmins.skipped} skipped`);
    console.log(`🎯 XEN Scouts:      ${results.xenScouts.created} created, ${results.xenScouts.skipped} skipped`);
    console.log(`🛡️  Scout Admins:   ${results.scoutAdmins.created} created, ${results.scoutAdmins.skipped} skipped`);
    console.log(`💳 Payments:        ${results.payments.created} created, ${results.payments.skipped} skipped`);
    console.log('='.repeat(60));

    const totalCreated = results.schools.created + results.schoolAdmins.created + 
                        results.xenScouts.created + results.scoutAdmins.created + 
                        results.payments.created;
    const totalSkipped = results.schools.skipped + results.schoolAdmins.skipped + 
                        results.xenScouts.skipped + results.scoutAdmins.skipped + 
                        results.payments.skipped;

    console.log(`\n✅ Total: ${totalCreated} notifications created, ${totalSkipped} skipped`);
    console.log('🎉 Backfill completed successfully!\n');

  } catch (error) {
    console.error('❌ Backfill failed:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('backfill-system-admin-notifications.ts')) {
  main()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Script failed:', error);
      process.exit(1);
    });
}

export { 
  backfillSchoolNotifications,
  backfillSchoolAdminNotifications,
  backfillXenScoutNotifications,
  backfillScoutAdminNotifications,
  backfillXenWatchPaymentNotifications
};

