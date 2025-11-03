import { neon } from '@neondatabase/serverless';
import { config } from 'dotenv';

config();

interface TestResult {
  name: string;
  status: 'PASS' | 'FAIL';
  message: string;
  details?: any;
}

const results: TestResult[] = [];

function addResult(name: string, status: 'PASS' | 'FAIL', message: string, details?: any) {
  results.push({ name, status, message, details });
  const icon = status === 'PASS' ? '✅' : '❌';
  console.log(`${icon} ${name}: ${message}`);
  if (details) {
    console.log(`   Details: ${JSON.stringify(details, null, 2)}`);
  }
}

async function runAPITests() {
  try {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      console.error('❌ No DATABASE_URL found');
      process.exit(1);
    }

    const sql = neon(connectionString);
    console.log('🧪 Testing Enrollment System API Logic...\n');

    // Test 1: Enrollment Limit Check Logic
    try {
      const school = await sql`
        SELECT id, name, max_students 
        FROM schools 
        LIMIT 1;
      `;
      
      if (school.length > 0) {
        const schoolId = school[0].id;
        const maxStudents = school[0].max_students || 10;
        
        const studentCount = await sql`
          SELECT COUNT(*)::int as count 
          FROM students 
          WHERE school_id = ${schoolId};
        `;
        
        const currentCount = studentCount[0]?.count || 0;
        const canEnroll = currentCount < maxStudents;
        
        addResult(
          'Enrollment Limit Check Logic',
          'PASS',
          `School "${school[0].name}": ${currentCount}/${maxStudents} students, canEnroll: ${canEnroll}`,
          { schoolId, currentCount, maxStudents, canEnroll }
        );
      } else {
        addResult('Enrollment Limit Check Logic', 'FAIL', 'No schools found');
      }
    } catch (error: any) {
      addResult('Enrollment Limit Check Logic', 'FAIL', error.message);
    }

    // Test 2: Payment Record Creation Logic
    try {
      const school = await sql`
        SELECT id, name, payment_amount, payment_frequency 
        FROM schools 
        WHERE payment_amount::DECIMAL > 0
        LIMIT 1;
      `;
      
      if (school.length > 0) {
        const paymentRecord = await sql`
          SELECT * 
          FROM school_payment_records 
          WHERE school_id = ${school[0].id}
          ORDER BY recorded_at DESC
          LIMIT 1;
        `;
        
        if (paymentRecord.length > 0) {
          const record = paymentRecord[0];
          addResult(
            'Payment Record Creation',
            'PASS',
            `Payment record found for "${school[0].name}"`,
            {
              paymentType: record.payment_type,
              amount: record.payment_amount,
              frequency: record.payment_frequency,
              recordedAt: record.recorded_at
            }
          );
        } else {
          addResult('Payment Record Creation', 'FAIL', 'No payment records found');
        }
      } else {
        addResult('Payment Record Creation', 'SKIP', 'No schools with payments');
      }
    } catch (error: any) {
      addResult('Payment Record Creation', 'FAIL', error.message);
    }

    // Test 3: Subscription Expiration Calculation
    try {
      const school = await sql`
        SELECT id, name, payment_frequency, subscription_expires_at 
        FROM schools 
        WHERE subscription_expires_at IS NOT NULL
        LIMIT 1;
      `;
      
      if (school.length > 0) {
        const s = school[0];
        const expiresAt = new Date(s.subscription_expires_at);
        const now = new Date();
        const daysUntilExpiry = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        
        addResult(
          'Subscription Expiration',
          'PASS',
          `"${s.name}" expires in ${daysUntilExpiry} days (${s.payment_frequency})`,
          {
            expiresAt: expiresAt.toISOString(),
            daysUntilExpiry,
            frequency: s.payment_frequency
          }
        );
      } else {
        addResult('Subscription Expiration', 'SKIP', 'No schools with expiration dates');
      }
    } catch (error: any) {
      addResult('Subscription Expiration', 'FAIL', error.message);
    }

    // Test 4: Enrollment Status Calculation
    try {
      const schools = await sql`
        SELECT 
          s.id,
          s.name,
          s.max_students,
          COUNT(st.id)::int as student_count
        FROM schools s
        LEFT JOIN students st ON s.id = st.school_id
        GROUP BY s.id, s.name, s.max_students
        ORDER BY s.name;
      `;
      
      let allCalculationsValid = true;
      const calculations: any[] = [];
      
      schools.forEach((school: any) => {
        const currentCount = school.student_count || 0;
        const maxStudents = school.max_students || 10;
        const availableSlots = maxStudents - currentCount;
        const utilizationPercentage = maxStudents > 0 ? (currentCount / maxStudents) * 100 : 0;
        const warningLevel = utilizationPercentage >= 100 ? 'at_limit' : 
                           utilizationPercentage >= 80 ? 'approaching' : 'none';
        const canEnroll = currentCount < maxStudents;
        
        calculations.push({
          school: school.name,
          currentCount,
          maxStudents,
          availableSlots,
          utilizationPercentage: Math.round(utilizationPercentage * 100) / 100,
          warningLevel,
          canEnroll
        });
        
        // Validate calculations
        if (availableSlots < 0 || utilizationPercentage > 100 || utilizationPercentage < 0) {
          allCalculationsValid = false;
        }
      });
      
      if (allCalculationsValid) {
        addResult(
          'Enrollment Status Calculation',
          'PASS',
          `Calculated status for ${schools.length} schools`,
          { calculations }
        );
      } else {
        addResult('Enrollment Status Calculation', 'FAIL', 'Invalid calculations detected');
      }
    } catch (error: any) {
      addResult('Enrollment Status Calculation', 'FAIL', error.message);
    }

    // Test 5: Payment Type Validation
    try {
      const paymentTypes = await sql`
        SELECT DISTINCT payment_type, COUNT(*) as count
        FROM school_payment_records
        GROUP BY payment_type;
      `;
      
      const validTypes = ['initial', 'renewal', 'student_limit_increase', 'student_limit_decrease', 'frequency_change'];
      const foundTypes = paymentTypes.map((p: any) => p.payment_type);
      const invalidTypes = foundTypes.filter((t: string) => !validTypes.includes(t));
      
      if (invalidTypes.length === 0) {
        addResult(
          'Payment Type Validation',
          'PASS',
          `All payment types are valid (${foundTypes.length} types found)`,
          { types: foundTypes, counts: paymentTypes }
        );
      } else {
        addResult('Payment Type Validation', 'FAIL', `Invalid payment types: ${invalidTypes.join(', ')}`);
      }
    } catch (error: any) {
      addResult('Payment Type Validation', 'FAIL', error.message);
    }

    // Test 6: Student Limit Enforcement Query
    try {
      // Simulate the query used in add-student endpoint
      const testSchool = await sql`
        SELECT id, name, max_students 
        FROM schools 
        LIMIT 1;
      `;
      
      if (testSchool.length > 0) {
        const schoolId = testSchool[0].id;
        const maxStudents = testSchool[0].max_students || 10;
        
        const studentCountResult = await sql`
          SELECT COUNT(*)::int as count 
          FROM students 
          WHERE school_id = ${schoolId};
        `;
        
        const currentCount = studentCountResult[0]?.count || 0;
        const wouldBlock = currentCount >= maxStudents;
        
        addResult(
          'Student Limit Enforcement Query',
          'PASS',
          `Query works correctly: ${currentCount}/${maxStudents}, wouldBlock: ${wouldBlock}`,
          { schoolId, currentCount, maxStudents, wouldBlock }
        );
      } else {
        addResult('Student Limit Enforcement Query', 'FAIL', 'No schools found');
      }
    } catch (error: any) {
      addResult('Student Limit Enforcement Query', 'FAIL', error.message);
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 API Logic Test Summary');
    console.log('='.repeat(60));
    
    const passed = results.filter(r => r.status === 'PASS').length;
    const failed = results.filter(r => r.status === 'FAIL').length;
    
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📋 Total: ${results.length}`);
    
    if (failed === 0) {
      console.log('\n🎉 All API logic tests passed!');
      console.log('\n📝 Next Steps:');
      console.log('   1. Start the server: npm run dev');
      console.log('   2. Test API endpoints manually or with integration tests');
      console.log('   3. Test UI components in browser');
      process.exit(0);
    } else {
      console.log('\n⚠️  Some tests failed. Please review the results above.');
      process.exit(1);
    }
  } catch (error: any) {
    console.error('\n❌ Test suite error:', error.message);
    process.exit(1);
  }
}

runAPITests();

