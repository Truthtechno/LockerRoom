/**
 * Comprehensive test script to diagnose Platform Analytics revenue display issues
 * Tests: Payment records, revenue calculations, API responses
 */

import { db } from '../server/db';
import { schools, schoolPaymentRecords } from '../shared/schema';
import { eq, sql, desc, and } from 'drizzle-orm';

async function testPlatformAnalyticsRevenue() {
  console.log('🔍 Starting comprehensive Platform Analytics revenue diagnostic...\n');

  try {
    // 1. Check all payment records
    console.log('1️⃣ CHECKING ALL PAYMENT RECORDS:');
    console.log('='.repeat(60));
    const allPayments = await db
      .select()
      .from(schoolPaymentRecords)
      .orderBy(desc(schoolPaymentRecords.recordedAt));

    console.log(`Total payment records: ${allPayments.length}\n`);
    
    if (allPayments.length === 0) {
      console.log('⚠️  No payment records found in database!\n');
    } else {
      allPayments.forEach((payment, index) => {
        console.log(`Payment ${index + 1}:`);
        console.log(`  ID: ${payment.id}`);
        console.log(`  School ID: ${payment.schoolId}`);
        console.log(`  Amount: $${payment.paymentAmount}`);
        console.log(`  Frequency: ${payment.paymentFrequency}`);
        console.log(`  Type: ${payment.paymentType}`);
        console.log(`  Recorded At: ${payment.recordedAt}`);
        console.log(`  Subscription Expires At: ${payment.subscriptionExpiresAt || 'N/A'}`);
        console.log('');
      });
    }

    // 2. Check active schools
    console.log('2️⃣ CHECKING ACTIVE SCHOOLS:');
    console.log('='.repeat(60));
    const now = new Date();
    const activeSchools = await db
      .select()
      .from(schools)
      .where(
        and(
          eq(schools.isActive, true),
          sql`${schools.subscriptionExpiresAt} IS NOT NULL`,
          sql`${schools.subscriptionExpiresAt} > ${now}`
        )
      );

    console.log(`Active schools: ${activeSchools.length}\n`);
    for (let index = 0; index < activeSchools.length; index++) {
      const school = activeSchools[index];
      console.log(`School ${index + 1}:`);
      console.log(`  ID: ${school.id}`);
      console.log(`  Name: ${school.name}`);
      console.log(`  Payment Amount: $${school.paymentAmount || 'N/A'}`);
      console.log(`  Payment Frequency: ${school.paymentFrequency || 'N/A'}`);
      console.log(`  Subscription Expires: ${school.subscriptionExpiresAt}`);
      
      // Get latest payment for this school
      const latestPaymentForSchool = await db
        .select()
        .from(schoolPaymentRecords)
        .where(eq(schoolPaymentRecords.schoolId, school.id))
        .orderBy(desc(schoolPaymentRecords.recordedAt))
        .limit(1);
      
      if (latestPaymentForSchool.length > 0) {
        console.log(`  Latest Payment Record: $${latestPaymentForSchool[0].paymentAmount} (${latestPaymentForSchool[0].paymentFrequency})`);
      } else {
        console.log(`  Latest Payment Record: NONE`);
      }
      console.log('');
    }

    // 3. Calculate MRR manually
    console.log('3️⃣ CALCULATING MRR/ARR MANUALLY:');
    console.log('='.repeat(60));
    let mrr = 0;
    let monthlyCount = 0;
    let annualCount = 0;
    let oneTimeCount = 0;
    let monthlyRevenue = 0;
    let annualRevenue = 0;
    let oneTimeRevenue = 0;

    for (const school of activeSchools) {
      const latestPayments = await db
        .select({
          paymentAmount: schoolPaymentRecords.paymentAmount,
          paymentFrequency: schoolPaymentRecords.paymentFrequency,
        })
        .from(schoolPaymentRecords)
        .where(eq(schoolPaymentRecords.schoolId, school.id))
        .orderBy(desc(schoolPaymentRecords.recordedAt))
        .limit(1);

      if (latestPayments.length > 0) {
        const payment = latestPayments[0];
        const amount = parseFloat(payment.paymentAmount?.toString() || "0");
        
        if (payment.paymentFrequency === "monthly") {
          monthlyCount++;
          monthlyRevenue += amount;
          mrr += amount;
        } else if (payment.paymentFrequency === "annual") {
          annualCount++;
          annualRevenue += amount;
          mrr += amount / 12;
        } else if (payment.paymentFrequency === "one-time") {
          oneTimeCount++;
          oneTimeRevenue += amount;
        }
      } else {
        // Fallback
        const amount = parseFloat(school.paymentAmount?.toString() || "0");
        if (school.paymentFrequency === "monthly") {
          monthlyCount++;
          monthlyRevenue += amount;
          mrr += amount;
        } else if (school.paymentFrequency === "annual") {
          annualCount++;
          annualRevenue += amount;
          mrr += amount / 12;
        }
      }
    }

    const arr = mrr * 12;

    console.log(`Monthly Schools: ${monthlyCount}`);
    console.log(`Monthly Revenue: $${monthlyRevenue.toFixed(2)}`);
    console.log(`Annual Schools: ${annualCount}`);
    console.log(`Annual Revenue: $${annualRevenue.toFixed(2)} (${(annualRevenue / 12).toFixed(2)}/mo)`);
    console.log(`One-Time Schools: ${oneTimeCount}`);
    console.log(`One-Time Revenue: $${oneTimeRevenue.toFixed(2)}`);
    console.log(`\nCalculated MRR: $${mrr.toFixed(2)}`);
    console.log(`Calculated ARR: $${arr.toFixed(2)}\n`);

    // 4. Check revenue in last 30 days
    console.log('4️⃣ CHECKING REVENUE IN LAST 30 DAYS:');
    console.log('='.repeat(60));
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentPayments = await db
      .select({
        paymentAmount: schoolPaymentRecords.paymentAmount,
        paymentFrequency: schoolPaymentRecords.paymentFrequency,
        recordedAt: schoolPaymentRecords.recordedAt,
      })
      .from(schoolPaymentRecords)
      .where(sql`${schoolPaymentRecords.recordedAt} >= ${thirtyDaysAgo}`);

    let recentRevenue = 0;
    recentPayments.forEach(p => {
      const amount = parseFloat(p.paymentAmount?.toString() || "0");
      recentRevenue += amount;
    });

    console.log(`Payments in last 30 days: ${recentPayments.length}`);
    console.log(`Total revenue (last 30 days): $${recentRevenue.toFixed(2)}\n`);

    // 5. Test the actual storage method
    console.log('5️⃣ TESTING STORAGE.getPlatformRevenueAnalytics():');
    console.log('='.repeat(60));
    
    // Import storage dynamically
    const { PostgresStorage } = await import('../server/storage');
    const storage = new PostgresStorage();
    
    const analytics = await storage.getPlatformRevenueAnalytics('year');
    console.log('API Response:');
    console.log(JSON.stringify(analytics, null, 2));
    console.log('');

    // Summary
    console.log('📊 SUMMARY:');
    console.log('='.repeat(60));
    console.log(`✅ Total Payment Records: ${allPayments.length}`);
    console.log(`✅ Active Schools: ${activeSchools.length}`);
    console.log(`✅ Calculated MRR: $${mrr.toFixed(2)}`);
    console.log(`✅ Calculated ARR: $${arr.toFixed(2)}`);
    console.log(`✅ API MRR: $${analytics.mrr}`);
    console.log(`✅ API ARR: $${analytics.arr}`);
    console.log(`✅ API Monthly Count: ${analytics.byFrequency?.monthly?.count || 0}`);
    console.log(`✅ API Annual Count: ${analytics.byFrequency?.annual?.count || 0}`);
    console.log(`✅ API One-Time Count: ${analytics.byFrequency?.['one-time']?.count || 0}`);

    if (Math.abs(mrr - analytics.mrr) > 0.01) {
      console.log(`\n⚠️  MISMATCH: Calculated MRR (${mrr.toFixed(2)}) != API MRR (${analytics.mrr})`);
    } else {
      console.log(`\n✅ MRR values match!`);
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error during diagnostic:', error);
    process.exit(1);
  }
}

testPlatformAnalyticsRevenue();

