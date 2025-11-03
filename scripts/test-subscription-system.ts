/**
 * Comprehensive Test Script for New Subscription System
 * Tests all aspects of the subscription model implementation
 */

import "dotenv/config";
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  details?: any;
}

const results: TestResult[] = [];

function logTest(name: string, passed: boolean, error?: string, details?: any) {
  results.push({ name, passed, error, details });
  const icon = passed ? '✅' : '❌';
  console.log(`${icon} ${name}`);
  if (error) {
    console.log(`   Error: ${error}`);
  }
  if (details) {
    console.log(`   Details: ${JSON.stringify(details, null, 2)}`);
  }
}

async function testDatabaseSchema() {
  console.log('\n📋 Testing Database Schema...');
  
  try {
    // Check if new columns exist
    const columns = await sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'schools'
      AND column_name IN ('payment_amount', 'payment_frequency', 'subscription_expires_at', 'is_active', 'last_payment_date', 'updated_at')
      ORDER BY column_name
    `;
    
    const requiredColumns = [
      'payment_amount',
      'payment_frequency',
      'subscription_expires_at',
      'is_active',
      'last_payment_date',
      'updated_at'
    ];
    
    const foundColumns = columns.map((c: any) => c.column_name);
    const missingColumns = requiredColumns.filter(col => !foundColumns.includes(col));
    
    if (missingColumns.length > 0) {
      logTest('Database Schema - Required Columns', false, `Missing columns: ${missingColumns.join(', ')}`);
    } else {
      logTest('Database Schema - Required Columns', true, undefined, {
        found: foundColumns,
        types: columns.reduce((acc: any, col: any) => {
          acc[col.column_name] = col.data_type;
          return acc;
        }, {})
      });
    }
    
    // Check indexes
    const indexes = await sql`
      SELECT indexname
      FROM pg_indexes
      WHERE tablename = 'schools'
      AND indexname IN ('idx_schools_is_active', 'idx_schools_subscription_expires_at', 'idx_schools_payment_frequency')
    `;
    
    const foundIndexes = indexes.map((i: any) => i.indexname);
    const requiredIndexes = ['idx_schools_is_active', 'idx_schools_subscription_expires_at', 'idx_schools_payment_frequency'];
    const missingIndexes = requiredIndexes.filter(idx => !foundIndexes.includes(idx));
    
    if (missingIndexes.length > 0) {
      logTest('Database Schema - Indexes', false, `Missing indexes: ${missingIndexes.join(', ')}`);
    } else {
      logTest('Database Schema - Indexes', true, undefined, { found: foundIndexes });
    }
  } catch (error: any) {
    logTest('Database Schema', false, error.message);
  }
}

async function testSchoolData() {
  console.log('\n🏫 Testing School Data...');
  
  try {
    const schools = await sql`
      SELECT 
        id,
        name,
        payment_amount,
        payment_frequency,
        subscription_expires_at,
        is_active,
        last_payment_date,
        created_at
      FROM schools
      ORDER BY created_at
    `;
    
    if (schools.length === 0) {
      logTest('School Data - Schools Exist', false, 'No schools found');
      return;
    }
    
    logTest('School Data - Schools Exist', true, undefined, { count: schools.length });
    
    // Check each school has required fields
    let allValid = true;
    const invalidSchools: any[] = [];
    
    for (const school of schools) {
      const issues: string[] = [];
      
      if (!school.payment_amount || parseFloat(school.payment_amount.toString()) <= 0) {
        issues.push('Invalid payment_amount');
      }
      
      if (!school.payment_frequency || !['monthly', 'annual'].includes(school.payment_frequency)) {
        issues.push('Invalid payment_frequency');
      }
      
      if (!school.subscription_expires_at) {
        issues.push('Missing subscription_expires_at');
      }
      
      if (typeof school.is_active !== 'boolean') {
        issues.push('Invalid is_active');
      }
      
      if (issues.length > 0) {
        allValid = false;
        invalidSchools.push({
          name: school.name,
          issues
        });
      }
    }
    
    if (!allValid) {
      logTest('School Data - Valid Fields', false, 'Some schools have invalid data', invalidSchools);
    } else {
      logTest('School Data - Valid Fields', true);
    }
    
    // Check we have at least one monthly and one annual
    const monthlyCount = schools.filter((s: any) => s.payment_frequency === 'monthly').length;
    const annualCount = schools.filter((s: any) => s.payment_frequency === 'annual').length;
    
    logTest('School Data - Frequency Distribution', 
      monthlyCount > 0 && annualCount > 0,
      monthlyCount === 0 ? 'No monthly subscriptions' : annualCount === 0 ? 'No annual subscriptions' : undefined,
      { monthly: monthlyCount, annual: annualCount }
    );
    
    // Verify expiration dates are in the future for active schools
    const now = new Date();
    let validExpirations = true;
    const expiredActive: any[] = [];
    
    for (const school of schools) {
      if (school.is_active && school.subscription_expires_at) {
        const expiresAt = new Date(school.subscription_expires_at);
        if (expiresAt <= now) {
          validExpirations = false;
          expiredActive.push({
            name: school.name,
            expiresAt: expiresAt.toISOString()
          });
        }
      }
    }
    
    logTest('School Data - Expiration Dates', validExpirations, 
      expiredActive.length > 0 ? 'Active schools with expired subscriptions' : undefined,
      expiredActive.length > 0 ? expiredActive : undefined
    );
    
  } catch (error: any) {
    logTest('School Data', false, error.message);
  }
}

async function testSubscriptionCalculations() {
  console.log('\n💰 Testing Subscription Calculations...');
  
  try {
    const schools = await sql`
      SELECT 
        payment_amount,
        payment_frequency,
        subscription_expires_at,
        is_active,
        created_at
      FROM schools
      WHERE is_active = true
    `;
    
    const now = new Date();
    let monthlyRevenue = 0;
    let activeCount = 0;
    
    for (const school of schools) {
      const expiresAt = new Date(school.subscription_expires_at);
      if (expiresAt > now) {
        activeCount++;
        const amount = parseFloat(school.payment_amount.toString());
        if (school.payment_frequency === 'monthly') {
          monthlyRevenue += amount;
        } else if (school.payment_frequency === 'annual') {
          monthlyRevenue += amount / 12;
        }
      }
    }
    
    logTest('Subscription Calculations - Monthly Revenue', true, undefined, {
      activeSchools: activeCount,
      monthlyRevenue: Math.round(monthlyRevenue * 100) / 100
    });
    
  } catch (error: any) {
    logTest('Subscription Calculations', false, error.message);
  }
}

async function testExpiringSubscriptions() {
  console.log('\n⏰ Testing Expiring Subscriptions Detection...');
  
  try {
    const now = new Date();
    const oneWeekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const oneMonthFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    
    // Find expiring monthly subscriptions (within 7 days)
    const expiringMonthly = await sql`
      SELECT id, name, subscription_expires_at
      FROM schools
      WHERE is_active = true
      AND payment_frequency = 'monthly'
      AND subscription_expires_at IS NOT NULL
      AND subscription_expires_at > ${now}
      AND subscription_expires_at <= ${oneWeekFromNow}
    `;
    
    // Find expiring annual subscriptions (within 30 days)
    const expiringAnnual = await sql`
      SELECT id, name, subscription_expires_at
      FROM schools
      WHERE is_active = true
      AND payment_frequency = 'annual'
      AND subscription_expires_at IS NOT NULL
      AND subscription_expires_at > ${now}
      AND subscription_expires_at <= ${oneMonthFromNow}
    `;
    
    logTest('Expiring Subscriptions - Monthly (within 7 days)', true, undefined, {
      count: expiringMonthly.length,
      schools: expiringMonthly.map((s: any) => ({
        name: s.name,
        expiresAt: new Date(s.subscription_expires_at).toLocaleDateString()
      }))
    });
    
    logTest('Expiring Subscriptions - Annual (within 30 days)', true, undefined, {
      count: expiringAnnual.length,
      schools: expiringAnnual.map((s: any) => ({
        name: s.name,
        expiresAt: new Date(s.subscription_expires_at).toLocaleDateString()
      }))
    });
    
  } catch (error: any) {
    logTest('Expiring Subscriptions Detection', false, error.message);
  }
}

async function testExpiredSubscriptions() {
  console.log('\n🔴 Testing Expired Subscriptions Detection...');
  
  try {
    const now = new Date();
    
    // Find expired but still active subscriptions
    const expiredActive = await sql`
      SELECT id, name, subscription_expires_at, is_active
      FROM schools
      WHERE is_active = true
      AND subscription_expires_at IS NOT NULL
      AND subscription_expires_at <= ${now}
    `;
    
    // Find expired and inactive subscriptions
    const expiredInactive = await sql`
      SELECT id, name, subscription_expires_at, is_active
      FROM schools
      WHERE is_active = false
      AND subscription_expires_at IS NOT NULL
      AND subscription_expires_at <= ${now}
    `;
    
    logTest('Expired Subscriptions - Detection', true, undefined, {
      expiredButActive: expiredActive.length,
      expiredAndInactive: expiredInactive.length,
      totalExpired: expiredActive.length + expiredInactive.length
    });
    
    if (expiredActive.length > 0) {
      logTest('Expired Subscriptions - Auto-Deactivation Needed', false, 
        'Found active schools with expired subscriptions',
        expiredActive.map((s: any) => ({
          name: s.name,
          expiresAt: new Date(s.subscription_expires_at).toLocaleDateString()
        }))
      );
    } else {
      logTest('Expired Subscriptions - Auto-Deactivation Needed', true);
    }
    
  } catch (error: any) {
    logTest('Expired Subscriptions Detection', false, error.message);
  }
}

async function runAllTests() {
  console.log('🧪 Running Comprehensive Subscription System Tests...');
  console.log('='.repeat(60));
  
  await testDatabaseSchema();
  await testSchoolData();
  await testSubscriptionCalculations();
  await testExpiringSubscriptions();
  await testExpiredSubscriptions();
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 Test Summary');
  console.log('='.repeat(60));
  
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const total = results.length;
  
  console.log(`Total Tests: ${total}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%`);
  
  if (failed > 0) {
    console.log('\n❌ Failed Tests:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  - ${r.name}`);
      if (r.error) {
        console.log(`    Error: ${r.error}`);
      }
    });
    process.exit(1);
  } else {
    console.log('\n🎉 All tests passed!');
    process.exit(0);
  }
}

runAllTests();

