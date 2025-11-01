#!/usr/bin/env tsx
/**
 * Verification script to check if global announcements are set up correctly
 * Run with: npx tsx scripts/verify-global-announcements.ts
 */

import { db } from '../server/db';
import { posts, schools, students, users } from '../shared/schema';
import { eq, and, or, sql } from 'drizzle-orm';

async function verifyGlobalAnnouncements() {
  console.log('🔍 Verifying Global Announcements...\n');

  try {
    // 1. Get ALL announcements
    const allAnnouncements = await db
      .select()
      .from(posts)
      .where(eq(posts.type, 'announcement'))
      .orderBy(sql`${posts.createdAt} DESC`);

    console.log(`📊 Total announcements in database: ${allAnnouncements.length}\n`);

    // 2. Categorize announcements
    const globalAnnouncements = allAnnouncements.filter(a => a.scope === 'global');
    const schoolAnnouncements = allAnnouncements.filter(a => a.scope === 'school');

    console.log(`🌍 Global announcements: ${globalAnnouncements.length}`);
    globalAnnouncements.forEach(a => {
      console.log(`   - ID: ${a.id}`);
      console.log(`     Title: ${a.title}`);
      console.log(`     Scope: ${a.scope}`);
      console.log(`     SchoolId: ${a.schoolId} (should be NULL)`);
      console.log(`     Broadcast: ${a.broadcast}`);
      console.log(`     Status: ${a.status}`);
      console.log(`     Created: ${a.createdAt}`);
      console.log('');
    });

    console.log(`🏫 School-specific announcements: ${schoolAnnouncements.length}`);
    schoolAnnouncements.slice(0, 5).forEach(a => {
      console.log(`   - ID: ${a.id}`);
      console.log(`     Title: ${a.title}`);
      console.log(`     Scope: ${a.scope}`);
      console.log(`     SchoolId: ${a.schoolId}`);
      console.log(`     Created: ${a.createdAt}`);
      console.log('');
    });

    // 3. Check for problematic global announcements (have schoolId set)
    const problematicGlobal = globalAnnouncements.filter(a => a.schoolId !== null);
    if (problematicGlobal.length > 0) {
      console.log(`❌ PROBLEM: Found ${problematicGlobal.length} global announcement(s) with schoolId set:`);
      problematicGlobal.forEach(a => {
        console.log(`   - ID: ${a.id}, Title: ${a.title}, SchoolId: ${a.schoolId}`);
      });
      console.log(`\n🔧 These need to be fixed! SchoolId should be NULL for global announcements.\n`);
    } else {
      console.log(`✅ All global announcements have schoolId = NULL\n`);
    }

    // 4. Get a test school and student
    const allSchools = await db.select().from(schools).limit(5);
    if (allSchools.length === 0) {
      console.log('❌ No schools found in database');
      return;
    }

    const testSchool = allSchools[0];
    console.log(`🧪 Testing with school: ${testSchool.name} (ID: ${testSchool.id})\n`);

    // 5. Test the actual query used by students
    const studentQuery = await db
      .select()
      .from(posts)
      .where(and(
        eq(posts.type, 'announcement'),
        eq(posts.broadcast, true),
        sql`${posts.status} != 'processing' OR ${posts.status} IS NULL`,
        or(
          and(eq(posts.scope, 'global'), sql`${posts.schoolId} IS NULL`),
          and(eq(posts.scope, 'school'), eq(posts.schoolId, testSchool.id))
        )
      ))
      .orderBy(sql`${posts.createdAt} DESC`)
      .limit(10);

    console.log(`📋 Query results for school ${testSchool.name}:`);
    console.log(`   Found ${studentQuery.length} announcement(s)\n`);

    studentQuery.forEach(a => {
      console.log(`   ✅ ${a.title}`);
      console.log(`      Scope: ${a.scope}, SchoolId: ${a.schoolId}`);
      console.log('');
    });

    // 6. Verify global announcements appear
    const globalInQuery = studentQuery.filter(a => a.scope === 'global');
    console.log(`🌍 Global announcements in query: ${globalInQuery.length}/${globalAnnouncements.length}`);

    if (globalAnnouncements.length > 0 && globalInQuery.length === 0) {
      console.log(`\n❌ CRITICAL ISSUE: Global announcements exist but are NOT appearing in student query!`);
      console.log(`   This means the query is not working correctly.\n`);
    } else if (globalAnnouncements.length > 0 && globalInQuery.length < globalAnnouncements.length) {
      console.log(`\n⚠️  WARNING: Some global announcements are missing from query!`);
      console.log(`   Expected: ${globalAnnouncements.length}, Found: ${globalInQuery.length}\n`);
    } else if (globalAnnouncements.length > 0) {
      console.log(`\n✅ All global announcements are appearing in student queries!\n`);
    }

    // 7. Summary
    console.log('📊 SUMMARY:');
    console.log(`   Total announcements: ${allAnnouncements.length}`);
    console.log(`   Global announcements: ${globalAnnouncements.length}`);
    console.log(`   School-specific announcements: ${schoolAnnouncements.length}`);
    console.log(`   Problematic global (have schoolId): ${problematicGlobal.length}`);
    console.log(`   Global appearing in test query: ${globalInQuery.length}`);

    if (problematicGlobal.length > 0) {
      console.log(`\n🔧 FIX NEEDED: Run this SQL to fix problematic global announcements:`);
      problematicGlobal.forEach(a => {
        console.log(`   UPDATE posts SET school_id = NULL WHERE id = '${a.id}';`);
      });
    }

  } catch (error) {
    console.error('❌ Error verifying announcements:', error);
    throw error;
  }
}

// Run verification
verifyGlobalAnnouncements()
  .then(() => {
    console.log('\n✅ Verification complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Verification failed:', error);
    process.exit(1);
  });

