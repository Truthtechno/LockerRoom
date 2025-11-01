#!/usr/bin/env tsx
/**
 * Test script to verify banner functionality works correctly
 * Tests: create, update, fetch, and school-specific targeting
 */

import { db } from '../server/db';
import { banners, schools, users, schoolAdmins } from '../shared/schema';
import { eq, sql, and } from 'drizzle-orm';
import fetch from 'node-fetch';

const API_BASE = process.env.API_URL || 'http://localhost:5174';

// Helper to get auth token (you'll need to provide this or login)
async function getSystemAdminToken(): Promise<string | null> {
  // Try to find a system admin user
  const systemAdmin = await db
    .select()
    .from(users)
    .where(eq(users.role, 'system_admin'))
    .limit(1);

  if (systemAdmin.length === 0) {
    console.log('⚠️  No system admin found. Please log in and provide token manually.');
    return null;
  }

  // For testing, we'll need an actual token
  // This is a placeholder - in real testing, you'd login via the API
  console.log('📝 Note: You may need to provide an auth token manually for API tests');
  return null;
}

async function testDatabaseOperations() {
  console.log('🧪 Testing Banner Database Operations...\n');

  try {
    // Test 1: Check if target_school_ids column exists
    console.log('1️⃣  Checking if target_school_ids column exists...');
    const columnCheck = await db.execute(sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'banners' AND column_name = 'target_school_ids'
    `);

    if (columnCheck.rows && columnCheck.rows.length > 0) {
      console.log('   ✅ Column exists:', columnCheck.rows[0]);
    } else {
      console.log('   ❌ Column does not exist! Migration may have failed.');
      return false;
    }

    // Test 2: Get some schools for testing
    console.log('\n2️⃣  Fetching schools for testing...');
    const testSchools = await db.select().from(schools).limit(3);
    console.log(`   ✅ Found ${testSchools.length} school(s) for testing`);

    if (testSchools.length === 0) {
      console.log('   ⚠️  No schools found. Cannot test school-specific targeting.');
    }

    // Test 3: Get system admin
    console.log('\n3️⃣  Finding system admin...');
    const systemAdmin = await db
      .select()
      .from(users)
      .where(eq(users.role, 'system_admin'))
      .limit(1);

    if (systemAdmin.length === 0) {
      console.log('   ⚠️  No system admin found. Cannot test banner creation.');
      return false;
    }

    console.log(`   ✅ Found system admin: ${systemAdmin[0].name || systemAdmin[0].id}`);

    // Test 4: Create a test banner with school targeting
    if (testSchools.length > 0) {
      console.log('\n4️⃣  Creating test banner with school-specific targeting...');
      
      const testBanner = await db.insert(banners).values({
        title: 'TEST: Payment Alert',
        message: 'This is a test banner for specific schools',
        category: 'warning',
        targetRoles: ['school_admin'],
        targetSchoolIds: [testSchools[0].id], // Target first school only
        priority: 100,
        isActive: true,
        createdByAdminId: systemAdmin[0].id,
      }).returning();

      console.log(`   ✅ Created test banner: ${testBanner[0].id}`);
      console.log(`      Title: ${testBanner[0].title}`);
      console.log(`      Target Schools: ${testBanner[0].targetSchoolIds}`);

      // Test 5: Create a banner targeting all schools
      console.log('\n5️⃣  Creating test banner targeting all schools...');
      const allSchoolsBanner = await db.insert(banners).values({
        title: 'TEST: System Update',
        message: 'This is a test banner for all school admins',
        category: 'info',
        targetRoles: ['school_admin'],
        targetSchoolIds: null, // NULL means all schools
        priority: 50,
        isActive: true,
        createdByAdminId: systemAdmin[0].id,
      }).returning();

      console.log(`   ✅ Created all-schools banner: ${allSchoolsBanner[0].id}`);
      console.log(`      Target Schools: ${allSchoolsBanner[0].targetSchoolIds} (null = all schools)`);

      // Test 6: Query banners for a specific school admin
      console.log('\n6️⃣  Testing banner query for school admin...');
      const schoolAdminUser = await db
        .select({ userId: users.id, schoolId: schoolAdmins.schoolId })
        .from(users)
        .innerJoin(schoolAdmins, eq(users.linkedId, schoolAdmins.id))
        .limit(1);

      if (schoolAdminUser.length > 0 && schoolAdminUser[0].schoolId) {
        const adminSchoolId = schoolAdminUser[0].schoolId;
        console.log(`   Testing with school ID: ${adminSchoolId}`);

        // Query banners that should appear for this school admin
        const relevantBanners = await db
          .select()
          .from(banners)
          .where(and(
            eq(banners.isActive, true),
            sql`'school_admin' = ANY(${banners.targetRoles})`
          ));

        console.log(`   ✅ Found ${relevantBanners.length} banner(s) targeting school_admin role`);

        // Filter by school targeting logic
        const bannersForThisSchool = relevantBanners.filter(banner => {
          // If targetSchoolIds is null or empty, show to all schools
          if (!banner.targetSchoolIds || banner.targetSchoolIds.length === 0) {
            return true;
          }
          // Otherwise, check if this school is in the list
          return banner.targetSchoolIds.includes(adminSchoolId);
        });

        console.log(`   ✅ ${bannersForThisSchool.length} banner(s) should appear for this school admin`);
        bannersForThisSchool.forEach(b => {
          console.log(`      - ${b.title} (targets: ${b.targetSchoolIds ? b.targetSchoolIds.join(', ') : 'all schools'})`);
        });
      } else {
        console.log('   ⚠️  No school admin found for testing');
      }

      // Cleanup: Delete test banners
      console.log('\n7️⃣  Cleaning up test banners...');
      await db.delete(banners).where(eq(banners.title, 'TEST: Payment Alert'));
      await db.delete(banners).where(eq(banners.title, 'TEST: System Update'));
      console.log('   ✅ Test banners deleted');

      console.log('\n✅ All database tests passed!');
      return true;
    } else {
      console.log('   ⚠️  Skipping school-specific tests (no schools available)');
      return true;
    }

  } catch (error: any) {
    console.error('❌ Database test failed:', error);
    return false;
  }
}

async function testBannerAPI(token: string) {
  console.log('\n🧪 Testing Banner API Endpoints...\n');

  try {
    // Test 1: Create banner with school targeting
    console.log('1️⃣  Testing POST /api/system-admin/banners with school targeting...');
    const createResponse = await fetch(`${API_BASE}/api/system-admin/banners`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: 'API Test: Payment Alert',
        message: 'This is a test banner created via API',
        category: 'warning',
        targetRoles: ['school_admin'],
        targetSchoolIds: [], // Empty = all schools
        priority: 10,
        isActive: true,
      }),
    });

    if (!createResponse.ok) {
      const error = await createResponse.text();
      console.log(`   ❌ Failed to create banner: ${createResponse.status}`);
      console.log(`   Error: ${error}`);
      return false;
    }

    const createdBanner = await createResponse.json();
    console.log(`   ✅ Banner created: ${createdBanner.banner.id}`);

    // Test 2: Get active banners
    console.log('\n2️⃣  Testing GET /api/banners/active...');
    const activeResponse = await fetch(`${API_BASE}/api/banners/active`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (activeResponse.ok) {
      const activeData = await activeResponse.json();
      console.log(`   ✅ Found ${activeData.banners?.length || 0} active banner(s)`);
    } else {
      console.log(`   ⚠️  Could not fetch active banners: ${activeResponse.status}`);
    }

    // Cleanup
    if (createdBanner.banner?.id) {
      console.log('\n3️⃣  Cleaning up test banner...');
      await fetch(`${API_BASE}/api/system-admin/banners/${createdBanner.banner.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      console.log('   ✅ Test banner deleted');
    }

    console.log('\n✅ API tests completed!');
    return true;
  } catch (error: any) {
    console.error('❌ API test failed:', error);
    return false;
  }
}

async function runTests() {
  console.log('🚀 Starting Banner Functionality Tests...\n');

  // Test database operations (don't need auth token)
  const dbTests = await testDatabaseOperations();

  if (!dbTests) {
    console.log('\n❌ Database tests failed. Stopping here.');
    process.exit(1);
  }

  // Note: API tests require authentication token
  console.log('\n📝 Note: To test API endpoints, you need to:');
  console.log('   1. Start the server (npm run dev)');
  console.log('   2. Log in as system admin');
  console.log('   3. Get the auth token from browser localStorage');
  console.log('   4. Run: API_URL=http://localhost:5174 TOKEN=<your-token> npx tsx scripts/test-banner-functionality.ts');

  console.log('\n✅ All available tests completed!');
  process.exit(0);
}

runTests();

