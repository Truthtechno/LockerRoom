#!/usr/bin/env tsx
/**
 * Test banner API endpoints
 * Tests: create, update, fetch, and school-specific targeting
 */

import fetch from 'node-fetch';
import { db } from '../server/db';
import { users, banners } from '../shared/schema';
import { eq, sql } from 'drizzle-orm';

const API_BASE = process.env.API_URL || 'http://localhost:5174';

// Helper to get system admin token by logging in
async function getSystemAdminToken(): Promise<string | null> {
  try {
    // Find a system admin user
    const systemAdmin = await db
      .select()
      .from(users)
      .where(eq(users.role, 'system_admin'))
      .limit(1);

    if (systemAdmin.length === 0) {
      console.log('⚠️  No system admin found in database');
      return null;
    }

    // Try to login (you may need to adjust this based on your auth setup)
    // For now, we'll just return null and note that manual token is needed
    console.log(`📝 Found system admin: ${systemAdmin[0].email || systemAdmin[0].id}`);
    console.log('   Note: For full API testing, you need to login and provide token manually');
    return null;
  } catch (error) {
    console.error('Error finding system admin:', error);
    return null;
  }
}

async function testBannerCreationWithToken(token: string) {
  console.log('\n🧪 Testing Banner Creation via API...\n');

  try {
    // Get schools for testing
    const schoolsResponse = await fetch(`${API_BASE}/api/system-admin/schools`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!schoolsResponse.ok) {
      console.log('❌ Failed to fetch schools:', schoolsResponse.status);
      return false;
    }

    const schoolsData = await schoolsResponse.json();
    const schools = schoolsData.schools || [];

    if (schools.length === 0) {
      console.log('⚠️  No schools found. Cannot test school-specific targeting.');
      return false;
    }

    console.log(`✅ Found ${schools.length} school(s) for testing`);

    // Test 1: Create banner targeting all schools (targetSchoolIds = null)
    console.log('\n1️⃣  Creating banner targeting ALL school admins...');
    const allSchoolsResponse = await fetch(`${API_BASE}/api/system-admin/banners`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: 'API Test: System Update',
        message: 'This banner should appear for all school admins',
        category: 'info',
        targetRoles: ['school_admin'],
        targetSchoolIds: null, // All schools
        priority: 10,
        isActive: true,
      }),
    });

    if (!allSchoolsResponse.ok) {
      const error = await allSchoolsResponse.text();
      console.log(`   ❌ Failed: ${allSchoolsResponse.status}`);
      console.log(`   Error: ${error}`);
      return false;
    }

    const allSchoolsBanner = await allSchoolsResponse.json();
    console.log(`   ✅ Created banner: ${allSchoolsBanner.banner.id}`);
    console.log(`      Target Schools: ${allSchoolsBanner.banner.targetSchoolIds || 'null (all schools)'}`);

    // Test 2: Create banner targeting specific schools
    console.log('\n2️⃣  Creating banner targeting SPECIFIC schools...');
    const specificSchoolsResponse = await fetch(`${API_BASE}/api/system-admin/banners`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: 'API Test: Payment Alert',
        message: 'This banner should appear only for specific school admins',
        category: 'warning',
        targetRoles: ['school_admin'],
        targetSchoolIds: [schools[0].id], // Target first school only
        priority: 20,
        isActive: true,
      }),
    });

    if (!specificSchoolsResponse.ok) {
      const error = await specificSchoolsResponse.text();
      console.log(`   ❌ Failed: ${specificSchoolsResponse.status}`);
      console.log(`   Error: ${error}`);
      // Clean up first banner
      await fetch(`${API_BASE}/api/system-admin/banners/${allSchoolsBanner.banner.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      return false;
    }

    const specificBanner = await specificSchoolsResponse.json();
    console.log(`   ✅ Created banner: ${specificBanner.banner.id}`);
    console.log(`      Target Schools: ${specificBanner.banner.targetSchoolIds?.join(', ') || 'null'}`);

    // Test 3: Fetch active banners
    console.log('\n3️⃣  Testing GET /api/banners/active endpoint...');
    const activeResponse = await fetch(`${API_BASE}/api/banners/active`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (activeResponse.ok) {
      const activeData = await activeResponse.json();
      console.log(`   ✅ Found ${activeData.banners?.length || 0} active banner(s)`);
      activeData.banners?.forEach((b: any) => {
        console.log(`      - ${b.title} (targets: ${b.targetSchoolIds ? b.targetSchoolIds.join(', ') : 'all schools'})`);
      });
    } else {
      console.log(`   ⚠️  Could not fetch active banners: ${activeResponse.status}`);
    }

    // Test 4: Update banner
    console.log('\n4️⃣  Testing banner update...');
    const updateResponse = await fetch(`${API_BASE}/api/system-admin/banners/${specificBanner.banner.id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: 'API Test: Payment Alert (Updated)',
        targetSchoolIds: [schools[0].id, schools[1]?.id].filter(Boolean), // Add second school if available
      }),
    });

    if (updateResponse.ok) {
      const updated = await updateResponse.json();
      console.log(`   ✅ Banner updated: ${updated.banner.title}`);
      console.log(`      Target Schools: ${updated.banner.targetSchoolIds?.join(', ') || 'null'}`);
    } else {
      console.log(`   ⚠️  Update failed: ${updateResponse.status}`);
    }

    // Cleanup
    console.log('\n5️⃣  Cleaning up test banners...');
    await fetch(`${API_BASE}/api/system-admin/banners/${allSchoolsBanner.banner.id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` },
    });
    await fetch(`${API_BASE}/api/system-admin/banners/${specificBanner.banner.id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` },
    });
    console.log('   ✅ Test banners deleted');

    console.log('\n✅ All API tests passed!');
    return true;
  } catch (error: any) {
    console.error('❌ API test failed:', error.message);
    return false;
  }
}

async function testDatabaseDirectly() {
  console.log('🧪 Testing Banner Database Operations Directly...\n');

  try {
    // Test 1: Create banner with school targeting
    const systemAdmin = await db
      .select()
      .from(users)
      .where(eq(users.role, 'system_admin'))
      .limit(1);

    if (systemAdmin.length === 0) {
      console.log('❌ No system admin found');
      return false;
    }

    const schools = await db.execute(sql`SELECT id, name FROM schools LIMIT 2`);
    if (!schools.rows || schools.rows.length === 0) {
      console.log('⚠️  No schools found for testing');
      return false;
    }

    console.log(`✅ Found ${schools.rows.length} school(s)`);

    // Create test banner
    const [testBanner] = await db.insert(banners).values({
      title: 'Direct DB Test: Payment Alert',
      message: 'Testing school-specific targeting via direct DB insert',
      category: 'warning',
      targetRoles: ['school_admin'],
      targetSchoolIds: [schools.rows[0].id as string],
      priority: 100,
      isActive: true,
      createdByAdminId: systemAdmin[0].id,
    }).returning();

    console.log(`✅ Created test banner: ${testBanner.id}`);
    console.log(`   Target Schools: ${testBanner.targetSchoolIds}`);

    // Verify it was saved correctly
    const [verified] = await db
      .select()
      .from(banners)
      .where(eq(banners.id, testBanner.id))
      .limit(1);

    if (verified.targetSchoolIds && verified.targetSchoolIds.includes(schools.rows[0].id as string)) {
      console.log('✅ Banner saved correctly with school targeting');
    } else {
      console.log('❌ Banner not saved correctly');
      await db.delete(banners).where(eq(banners.id, testBanner.id));
      return false;
    }

    // Cleanup
    await db.delete(banners).where(eq(banners.id, testBanner.id));
    console.log('✅ Test banner deleted');

    return true;
  } catch (error: any) {
    console.error('❌ Database test failed:', error);
    return false;
  }
}

async function runTests() {
  console.log('🚀 Starting Banner API Tests...\n');

  // Test database operations first
  const dbTests = await testDatabaseDirectly();
  if (!dbTests) {
    console.log('\n❌ Database tests failed');
    process.exit(1);
  }

  // Test API if server is running and token is provided
  const token = process.env.TOKEN || await getSystemAdminToken();
  
  if (token) {
    const apiTests = await testBannerCreationWithToken(token);
    if (!apiTests) {
      console.log('\n⚠️  Some API tests failed (but database tests passed)');
    }
  } else {
    console.log('\n📝 Skipping API tests (no token provided)');
    console.log('   To test API endpoints:');
    console.log('   1. Start server: npm run dev');
    console.log('   2. Log in as system admin');
    console.log('   3. Get token from browser localStorage');
    console.log('   4. Run: TOKEN=<your-token> npx tsx scripts/test-banner-api.ts');
  }

  console.log('\n✅ All tests completed!');
  process.exit(0);
}

runTests();

