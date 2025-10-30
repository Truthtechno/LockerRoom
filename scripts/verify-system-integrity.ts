#!/usr/bin/env tsx

/**
 * System Integrity Verification Script
 * 
 * This script runs comprehensive checks to verify system data integrity
 * after a reset and seeding operation. It ensures:
 * - System admins are preserved
 * - School-student linkages are correct
 * - No cross-linking between schools
 * - All relationships are properly maintained
 * 
 * Usage:
 *   npm run verify-system-integrity
 *   or
 *   tsx scripts/verify-system-integrity.ts
 */

import { db } from '../server/db';
import { 
  users, 
  schools, 
  schoolAdmins, 
  students, 
  posts,
  analyticsLogs 
} from '../shared/schema';
import { eq, sql } from 'drizzle-orm';

interface VerificationResult {
  test: string;
  status: 'PASS' | 'FAIL' | 'WARN';
  message: string;
  details?: any;
}

async function verifySystemIntegrity() {
  console.log('🔍 Starting system integrity verification...');
  
  const results: VerificationResult[] = [];
  
  try {
    // Test 1: Verify system admins are preserved
    console.log('\n1️⃣ Checking system admin preservation...');
    const systemAdmins = await db.select().from(users).where(eq(users.role, 'system_admin'));
    
    if (systemAdmins.length > 0) {
      results.push({
        test: 'System Admin Preservation',
        status: 'PASS',
        message: `Found ${systemAdmins.length} system admin account(s) preserved`,
        details: systemAdmins.map(admin => ({
          id: admin.id,
          name: admin.name,
          email: admin.email
        }))
      });
      console.log(`✅ System admins preserved: ${systemAdmins.length}`);
    } else {
      results.push({
        test: 'System Admin Preservation',
        status: 'FAIL',
        message: 'No system admin accounts found - this may indicate a problem with the reset'
      });
      console.log('❌ No system admin accounts found');
    }

    // Test 2: Verify test schools exist
    console.log('\n2️⃣ Checking test schools...');
    const testSchools = await db.select().from(schools).where(sql`id IN ('test-school-a', 'test-school-b')`);
    
    if (testSchools.length === 2) {
      results.push({
        test: 'Test Schools Creation',
        status: 'PASS',
        message: 'Both test schools created successfully',
        details: testSchools.map(school => ({
          id: school.id,
          name: school.name,
          subscriptionPlan: school.subscriptionPlan
        }))
      });
      console.log('✅ Test schools created successfully');
    } else {
      results.push({
        test: 'Test Schools Creation',
        status: 'FAIL',
        message: `Expected 2 test schools, found ${testSchools.length}`,
        details: testSchools.map(school => school.name)
      });
      console.log(`❌ Expected 2 test schools, found ${testSchools.length}`);
    }

    // Test 3: Verify school admins are properly linked
    console.log('\n3️⃣ Checking school admin linkages...');
    const schoolAdminLinkages = await db.execute(sql`
      SELECT 
        sa.name as admin_name,
        sa.school_id as admin_school_id,
        u.school_id as user_school_id,
        s.name as school_name,
        CASE 
          WHEN sa.school_id = u.school_id THEN 'CORRECT'
          ELSE 'ERROR: MISMATCH'
        END as linkage_status
      FROM school_admins sa
      INNER JOIN users u ON sa.id = u.linked_id
      INNER JOIN schools s ON sa.school_id = s.id
      WHERE sa.school_id IN ('test-school-a', 'test-school-b')
      ORDER BY sa.school_id
    `);

    const adminLinkageErrors = schoolAdminLinkages.rows.filter((row: any) => row.linkage_status.includes('ERROR'));
    
    if (adminLinkageErrors.length === 0) {
      results.push({
        test: 'School Admin Linkages',
        status: 'PASS',
        message: 'All school admins properly linked to their schools',
        details: schoolAdminLinkages.rows.map((row: any) => ({
          admin: row.admin_name,
          school: row.school_name,
          status: row.linkage_status
        }))
      });
      console.log('✅ School admin linkages are correct');
    } else {
      results.push({
        test: 'School Admin Linkages',
        status: 'FAIL',
        message: `${adminLinkageErrors.length} school admin linkage error(s) found`,
        details: adminLinkageErrors.map((row: any) => ({
          admin: row.admin_name,
          adminSchool: row.admin_school_id,
          userSchool: row.user_school_id
        }))
      });
      console.log(`❌ Found ${adminLinkageErrors.length} school admin linkage errors`);
    }

    // Test 4: Verify student-school linkages
    console.log('\n4️⃣ Checking student-school linkages...');
    const studentLinkages = await db.execute(sql`
      SELECT 
        st.name as student_name,
        st.school_id as student_school_id,
        u.school_id as user_school_id,
        s.name as school_name,
        CASE 
          WHEN st.school_id = u.school_id THEN 'CORRECT'
          ELSE 'ERROR: MISMATCH'
        END as linkage_status
      FROM students st
      INNER JOIN users u ON st.user_id = u.id
      INNER JOIN schools s ON st.school_id = s.id
      WHERE st.school_id IN ('test-school-a', 'test-school-b')
      ORDER BY st.school_id, st.name
    `);

    const studentLinkageErrors = studentLinkages.rows.filter((row: any) => row.linkage_status.includes('ERROR'));
    
    if (studentLinkageErrors.length === 0) {
      results.push({
        test: 'Student-School Linkages',
        status: 'PASS',
        message: 'All students properly linked to their schools',
        details: studentLinkages.rows.map((row: any) => ({
          student: row.student_name,
          school: row.school_name,
          status: row.linkage_status
        }))
      });
      console.log('✅ Student-school linkages are correct');
    } else {
      results.push({
        test: 'Student-School Linkages',
        status: 'FAIL',
        message: `${studentLinkageErrors.length} student linkage error(s) found`,
        details: studentLinkageErrors.map((row: any) => ({
          student: row.student_name,
          studentSchool: row.student_school_id,
          userSchool: row.user_school_id
        }))
      });
      console.log(`❌ Found ${studentLinkageErrors.length} student linkage errors`);
    }

    // Test 5: Verify no cross-linking between schools
    console.log('\n5️⃣ Checking for cross-linking between schools...');
    const crossLinkCheck = await db.execute(sql`
      SELECT 
        'School A Students in School B' as test_type,
        COUNT(*) as count
      FROM students st
      INNER JOIN users u ON st.user_id = u.id
      WHERE st.school_id = 'test-school-a' AND u.school_id = 'test-school-b'
      
      UNION ALL
      
      SELECT 
        'School B Students in School A' as test_type,
        COUNT(*) as count
      FROM students st
      INNER JOIN users u ON st.user_id = u.id
      WHERE st.school_id = 'test-school-b' AND u.school_id = 'test-school-a'
    `);

    const totalCrossLinks = crossLinkCheck.rows.reduce((sum: number, row: any) => sum + parseInt(row.count), 0);
    
    if (totalCrossLinks === 0) {
      results.push({
        test: 'Cross-School Linkage Prevention',
        status: 'PASS',
        message: 'No cross-linking between schools detected'
      });
      console.log('✅ No cross-linking between schools detected');
    } else {
      results.push({
        test: 'Cross-School Linkage Prevention',
        status: 'FAIL',
        message: `${totalCrossLinks} cross-linking error(s) found`,
        details: crossLinkCheck.rows.map((row: any) => ({
          type: row.test_type,
          count: row.count
        }))
      });
      console.log(`❌ Found ${totalCrossLinks} cross-linking errors`);
    }

    // Test 6: Verify school isolation (students from School A should not appear under School B)
    console.log('\n6️⃣ Checking school isolation...');
    const schoolIsolationCheck = await db.execute(sql`
      SELECT 
        s.name as school_name,
        COUNT(st.id) as student_count,
        COUNT(sa.id) as admin_count
      FROM schools s
      LEFT JOIN students st ON s.id = st.school_id
      LEFT JOIN school_admins sa ON s.id = sa.school_id
      WHERE s.id IN ('test-school-a', 'test-school-b')
      GROUP BY s.id, s.name
      ORDER BY s.name
    `);

    const expectedStudentCounts = { 'Test Academy A': 3, 'Test Academy B': 3 };
    const expectedAdminCounts = { 'Test Academy A': 1, 'Test Academy B': 1 };
    
    let isolationErrors = 0;
    const isolationDetails: any[] = [];
    
    for (const row of schoolIsolationCheck.rows) {
      const school = row as any;
      const expectedStudents = expectedStudentCounts[school.school_name as keyof typeof expectedStudentCounts] || 0;
      const expectedAdmins = expectedAdminCounts[school.school_name as keyof typeof expectedAdminCounts] || 0;
      
      const studentMatch = school.student_count === expectedStudents;
      const adminMatch = school.admin_count === expectedAdmins;
      
      if (!studentMatch || !adminMatch) {
        isolationErrors++;
      }
      
      isolationDetails.push({
        school: school.school_name,
        students: { actual: school.student_count, expected: expectedStudents, match: studentMatch },
        admins: { actual: school.admin_count, expected: expectedAdmins, match: adminMatch }
      });
    }

    if (isolationErrors === 0) {
      results.push({
        test: 'School Isolation',
        status: 'PASS',
        message: 'All schools have correct student and admin counts',
        details: isolationDetails
      });
      console.log('✅ School isolation verified - correct counts for all schools');
    } else {
      results.push({
        test: 'School Isolation',
        status: 'FAIL',
        message: `${isolationErrors} school(s) have incorrect student/admin counts`,
        details: isolationDetails
      });
      console.log(`❌ Found ${isolationErrors} school isolation errors`);
    }

    // Test 7: Verify data consistency
    console.log('\n7️⃣ Checking data consistency...');
    const consistencyCheck = await db.execute(sql`
      SELECT 
        'Orphaned Students' as issue_type,
        COUNT(*) as count
      FROM students st
      LEFT JOIN schools s ON st.school_id = s.id
      WHERE s.id IS NULL
      
      UNION ALL
      
      SELECT 
        'Orphaned School Admins' as issue_type,
        COUNT(*) as count
      FROM school_admins sa
      LEFT JOIN schools s ON sa.school_id = s.id
      WHERE s.id IS NULL
      
      UNION ALL
      
      SELECT 
        'Students without Users' as issue_type,
        COUNT(*) as count
      FROM students st
      LEFT JOIN users u ON st.user_id = u.id
      WHERE u.id IS NULL
    `);

    const totalConsistencyIssues = consistencyCheck.rows.reduce((sum: number, row: any) => sum + parseInt(row.count), 0);
    
    if (totalConsistencyIssues === 0) {
      results.push({
        test: 'Data Consistency',
        status: 'PASS',
        message: 'No orphaned records or consistency issues found'
      });
      console.log('✅ Data consistency verified - no orphaned records');
    } else {
      results.push({
        test: 'Data Consistency',
        status: 'FAIL',
        message: `${totalConsistencyIssues} consistency issue(s) found`,
        details: consistencyCheck.rows.map((row: any) => ({
          issue: row.issue_type,
          count: row.count
        }))
      });
      console.log(`❌ Found ${totalConsistencyIssues} consistency issues`);
    }

    // Generate summary report
    console.log('\n📊 VERIFICATION SUMMARY');
    console.log('========================');
    
    const passedTests = results.filter(r => r.status === 'PASS').length;
    const failedTests = results.filter(r => r.status === 'FAIL').length;
    const warningTests = results.filter(r => r.status === 'WARN').length;
    
    console.log(`Total Tests: ${results.length}`);
    console.log(`✅ Passed: ${passedTests}`);
    console.log(`❌ Failed: ${failedTests}`);
    console.log(`⚠️ Warnings: ${warningTests}`);
    
    console.log('\n📋 Detailed Results:');
    results.forEach((result, index) => {
      const icon = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : '⚠️';
      console.log(`${index + 1}. ${icon} ${result.test}: ${result.message}`);
      if (result.details && result.details.length > 0) {
        console.log(`   Details: ${JSON.stringify(result.details, null, 2)}`);
      }
    });

    // Log verification results
    await db.insert(analyticsLogs).values({
      eventType: 'system_integrity_verification',
      entityType: 'system',
      metadata: JSON.stringify({
        totalTests: results.length,
        passedTests,
        failedTests,
        warningTests,
        overallStatus: failedTests === 0 ? 'PASS' : 'FAIL',
        results: results.map(r => ({
          test: r.test,
          status: r.status,
          message: r.message
        })),
        timestamp: new Date().toISOString()
      })
    });

    if (failedTests === 0) {
      console.log('\n🎉 ALL VERIFICATION TESTS PASSED!');
      console.log('System integrity is verified and ready for use.');
    } else {
      console.log('\n⚠️ SOME VERIFICATION TESTS FAILED!');
      console.log('Please review the failed tests and fix any issues before proceeding.');
    }

    return failedTests === 0;

  } catch (error) {
    console.error('❌ Error during verification:', error);
    
    // Log the error
    await db.insert(analyticsLogs).values({
      eventType: 'system_integrity_verification_error',
      entityType: 'system',
      metadata: JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      })
    });
    
    return false;
  }
}

// ESM-safe entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  verifySystemIntegrity()
    .then((success) => {
      console.log('\n🏁 Verification script completed');
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error('\n💥 Verification script failed:', error);
      process.exit(1);
    });
}

export { verifySystemIntegrity };
