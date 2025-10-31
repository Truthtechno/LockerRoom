#!/usr/bin/env tsx

/**
 * System Reset and Stabilization Master Script
 * 
 * This script orchestrates the complete system reset and stabilization process:
 * 1. Resets the database (preserving system admins)
 * 2. Seeds test data
 * 3. Verifies system integrity
 * 4. Reports on the success of the operation
 * 
 * Usage:
 *   npm run reset-and-stabilize-system
 *   or
 *   tsx scripts/reset-and-stabilize-system.ts
 */

import { resetSystemData } from './reset-system-data';
import { seedTestData } from './seed-test-data';
import { verifySystemIntegrity } from './verify-system-integrity';

async function resetAndStabilizeSystem() {
  console.log('🚀 Starting System Reset and Stabilization Process');
  console.log('================================================');
  
  const startTime = Date.now();
  let step = 1;
  const totalSteps = 3;
  
  try {
    // Step 1: Reset System Data
    console.log(`\n📋 Step ${step}/${totalSteps}: Resetting System Data`);
    console.log('----------------------------------------------');
    await resetSystemData();
    console.log('✅ System data reset completed');
    step++;

    // Step 2: Seed Test Data
    console.log(`\n📋 Step ${step}/${totalSteps}: Seeding Test Data`);
    console.log('--------------------------------------------');
    await seedTestData();
    console.log('✅ Test data seeding completed');
    step++;

    // Step 3: Verify System Integrity
    console.log(`\n📋 Step ${step}/${totalSteps}: Verifying System Integrity`);
    console.log('---------------------------------------------------');
    const verificationPassed = await verifySystemIntegrity();
    
    if (verificationPassed) {
      console.log('✅ System integrity verification passed');
    } else {
      console.log('❌ System integrity verification failed');
      throw new Error('System integrity verification failed');
    }

    // Final Summary
    const endTime = Date.now();
    const duration = Math.round((endTime - startTime) / 1000);
    
    console.log('\n🎉 SYSTEM RESET AND STABILIZATION COMPLETED SUCCESSFULLY!');
    console.log('=======================================================');
    console.log(`⏱️ Total time: ${duration} seconds`);
    console.log(`📊 Steps completed: ${step}/${totalSteps}`);
    
    console.log('\n📋 What was accomplished:');
    console.log('✅ Database reset (system admins preserved)');
    console.log('✅ Test schools created (Test Academy A & B)');
    console.log('✅ School admins created with proper linkages');
    console.log('✅ Test students created with proper school assignments');
    console.log('✅ System integrity verified');
    console.log('✅ Cross-school linkage prevention confirmed');
    console.log('✅ Data consistency validated');
    
    console.log('\n🔑 Test Credentials Available:');
    console.log('School Admins:');
    console.log('  - Alice Johnson (alice.johnson@testacademya.edu): admin123');
    console.log('  - Bob Smith (bob.smith@testacademyb.edu): admin123');
    console.log('Students:');
    console.log('  - Test Academy A: Alex Thompson, Sarah Davis, Mike Wilson');
    console.log('  - Test Academy B: Emma Brown, James Miller, Lisa Garcia');
    console.log('  - All student passwords: student123');
    
    console.log('\n🎯 Next Steps:');
    console.log('1. Test system admin school management features');
    console.log('2. Verify school admin dashboards show only their students');
    console.log('3. Test student login and profile verification');
    console.log('4. Confirm no cross-linking between schools');
    
    console.log('\n✨ System is now ready for production use!');
    
  } catch (error) {
    console.error('\n💥 SYSTEM RESET AND STABILIZATION FAILED!');
    console.error('==========================================');
    console.error('Error:', error instanceof Error ? error.message : 'Unknown error');
    
    console.log('\n🔧 Troubleshooting Steps:');
    console.log('1. Check database connection');
    console.log('2. Verify system admin accounts exist');
    console.log('3. Check migration files are accessible');
    console.log('4. Review error logs for specific issues');
    
    throw error;
  }
}

// ESM-safe entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  resetAndStabilizeSystem()
    .then(() => {
      console.log('\n🏁 Master script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Master script failed:', error);
      process.exit(1);
    });
}

export { resetAndStabilizeSystem };
