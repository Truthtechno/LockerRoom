/**
 * Test script to diagnose Xen Watch revenue tracking issues
 */

import { db } from '../server/db';
import { paymentTransactions } from '../shared/schema';
import { sql, and, eq } from 'drizzle-orm';

async function testXenWatchRevenue() {
  console.log('🔍 Testing Xen Watch Revenue Tracking...\n');

  try {
    // 1. Check all payment transactions
    console.log('1️⃣ CHECKING ALL PAYMENT TRANSACTIONS:');
    console.log('='.repeat(60));
    const allTransactions = await db
      .select()
      .from(paymentTransactions)
      .orderBy(sql`${paymentTransactions.createdAt} DESC`);

    console.log(`Total payment transactions: ${allTransactions.length}\n`);
    
    if (allTransactions.length === 0) {
      console.log('⚠️  No payment transactions found!\n');
    } else {
      allTransactions.forEach((tx, index) => {
        console.log(`Transaction ${index + 1}:`);
        console.log(`  ID: ${tx.id}`);
        console.log(`  User ID: ${tx.userId}`);
        console.log(`  Type: ${tx.type}`);
        console.log(`  Amount (cents): ${tx.amountCents}`);
        console.log(`  Amount (dollars): $${(tx.amountCents / 100).toFixed(2)}`);
        console.log(`  Status: ${tx.status}`);
        console.log(`  Created At: ${tx.createdAt}`);
        console.log('');
      });
    }

    // 2. Check Xen Watch specific transactions
    console.log('2️⃣ CHECKING XEN WATCH TRANSACTIONS:');
    console.log('='.repeat(60));
    const xenWatchTransactions = await db
      .select()
      .from(paymentTransactions)
      .where(
        and(
          sql`${paymentTransactions.type} = 'xen_watch'`,
          sql`${paymentTransactions.status} = 'completed'`
        )
      );

    console.log(`Xen Watch completed transactions: ${xenWatchTransactions.length}\n`);
    
    if (xenWatchTransactions.length === 0) {
      console.log('⚠️  No completed Xen Watch transactions found!\n');
      console.log('Checking all Xen Watch transactions (any status)...\n');
      
      const allXenWatch = await db
        .select()
        .from(paymentTransactions)
        .where(sql`${paymentTransactions.type} = 'xen_watch'`);
      
      console.log(`Total Xen Watch transactions (all statuses): ${allXenWatch.length}`);
      allXenWatch.forEach((tx, index) => {
        console.log(`  ${index + 1}. Status: ${tx.status}, Amount: $${(tx.amountCents / 100).toFixed(2)}, Created: ${tx.createdAt}`);
      });
      console.log('');
    } else {
      let totalRevenue = 0;
      xenWatchTransactions.forEach((tx, index) => {
        const amount = tx.amountCents / 100;
        totalRevenue += amount;
        console.log(`Transaction ${index + 1}:`);
        console.log(`  Amount: $${amount.toFixed(2)}`);
        console.log(`  Created: ${tx.createdAt}`);
        console.log(`  User ID: ${tx.userId}`);
        console.log('');
      });
      console.log(`Total Xen Watch Revenue: $${totalRevenue.toFixed(2)}\n`);
    }

    // 3. Check last 30 days
    console.log('3️⃣ CHECKING LAST 30 DAYS:');
    console.log('='.repeat(60));
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const last30Days = await db
      .select()
      .from(paymentTransactions)
      .where(
        and(
          sql`${paymentTransactions.type} = 'xen_watch'`,
          sql`${paymentTransactions.status} = 'completed'`,
          sql`${paymentTransactions.createdAt} >= ${thirtyDaysAgo}`
        )
      );

    let revenue30d = 0;
    last30Days.forEach(tx => {
      revenue30d += tx.amountCents / 100;
    });

    console.log(`Transactions in last 30 days: ${last30Days.length}`);
    console.log(`Revenue in last 30 days: $${revenue30d.toFixed(2)}\n`);

    // 4. Test the actual API calculation
    console.log('4️⃣ TESTING API CALCULATION:');
    console.log('='.repeat(60));
    
    const xenWatchRevenue30d = await db
      .select({
        total: sql<number>`COALESCE(SUM(${paymentTransactions.amountCents}) / 100.0, 0)`,
      })
      .from(paymentTransactions)
      .where(
        and(
          sql`${paymentTransactions.type} = 'xen_watch'`,
          sql`${paymentTransactions.status} = 'completed'`,
          sql`${paymentTransactions.createdAt} >= ${thirtyDaysAgo}`
        )
      );

    const xenWatchTotalRevenue = await db
      .select({
        total: sql<number>`COALESCE(SUM(${paymentTransactions.amountCents}) / 100.0, 0)`,
      })
      .from(paymentTransactions)
      .where(
        and(
          sql`${paymentTransactions.type} = 'xen_watch'`,
          sql`${paymentTransactions.status} = 'completed'`
        )
      );

    const xenWatchCountResult = await db
      .select({
        count: sql<number>`COUNT(*)`,
      })
      .from(paymentTransactions)
      .where(
        and(
          sql`${paymentTransactions.type} = 'xen_watch'`,
          sql`${paymentTransactions.status} = 'completed'`
        )
      );

    const revenueLast30d = Number(xenWatchRevenue30d[0]?.total || 0);
    const totalRevenue = Number(xenWatchTotalRevenue[0]?.total || 0);
    const count = Number(xenWatchCountResult[0]?.count || 0);

    console.log(`API Calculated Total Revenue: $${totalRevenue.toFixed(2)}`);
    console.log(`API Calculated Last 30 Days: $${revenueLast30d.toFixed(2)}`);
    console.log(`API Calculated Total Submissions: ${count}\n`);

    // 5. Check if the storage method returns correct data
    console.log('5️⃣ TESTING STORAGE METHOD:');
    console.log('='.repeat(60));
    
    const { PostgresStorage } = await import('../server/storage');
    const storage = new PostgresStorage();
    
    const analytics = await storage.getPlatformRevenueAnalytics('year');
    console.log('Xen Watch data from API:');
    console.log(JSON.stringify(analytics.xenWatch, null, 2));

    console.log('\n📊 SUMMARY:');
    console.log('='.repeat(60));
    console.log(`✅ Total Payment Transactions: ${allTransactions.length}`);
    console.log(`✅ Xen Watch Completed Transactions: ${xenWatchTransactions.length}`);
    console.log(`✅ Total Xen Watch Revenue: $${totalRevenue.toFixed(2)}`);
    console.log(`✅ Last 30 Days Revenue: $${revenueLast30d.toFixed(2)}`);
    console.log(`✅ API Total Revenue: $${analytics.xenWatch?.totalRevenue || 0}`);
    console.log(`✅ API Last 30 Days: $${analytics.xenWatch?.last30Days || 0}`);
    console.log(`✅ API Total Submissions: ${analytics.xenWatch?.totalSubmissions || 0}`);

    if (xenWatchTransactions.length > 0 && (analytics.xenWatch?.totalRevenue === 0 || analytics.xenWatch?.last30Days === 0)) {
      console.log('\n⚠️  ISSUE DETECTED: Data exists but API returns zero!');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error during diagnostic:', error);
    process.exit(1);
  }
}

testXenWatchRevenue();

