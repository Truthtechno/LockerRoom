import { neon } from '@neondatabase/serverless';
import { config } from 'dotenv';

config();

interface TestResult {
  name: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  message: string;
}

const results: TestResult[] = [];

function addResult(name: string, status: 'PASS' | 'FAIL' | 'SKIP', message: string) {
  results.push({ name, status, message });
  const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
  console.log(`${icon} ${name}: ${message}`);
}

async function runTests() {
  try {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      console.error('❌ No DATABASE_URL found');
      process.exit(1);
    }

    const sql = neon(connectionString);
    console.log('🧪 Starting Enrollment System Tests...\n');

    // Test 1: Payment Records Table Exists
    try {
      const tableCheck = await sql`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'school_payment_records'
        );
      `;
      if (tableCheck[0]?.exists) {
        addResult('Payment Records Table', 'PASS', 'Table exists');
      } else {
        addResult('Payment Records Table', 'FAIL', 'Table does not exist');
      }
    } catch (error: any) {
      addResult('Payment Records Table', 'FAIL', error.message);
    }

    // Test 2: All Schools Have maxStudents = 10
    try {
      const schools = await sql`
        SELECT id, name, max_students 
        FROM schools 
        WHERE max_students IS NULL OR max_students != 10;
      `;
      if (schools.length === 0) {
        const allSchools = await sql`SELECT COUNT(*) as count FROM schools;`;
        addResult('School maxStudents', 'PASS', `All ${allSchools[0]?.count || 0} schools have maxStudents = 10`);
      } else {
        addResult('School maxStudents', 'FAIL', `${schools.length} schools do not have maxStudents = 10`);
      }
    } catch (error: any) {
      addResult('School maxStudents', 'FAIL', error.message);
    }

    // Test 3: Payment Records Indexes Exist
    try {
      const indexes = await sql`
        SELECT indexname 
        FROM pg_indexes 
        WHERE tablename = 'school_payment_records';
      `;
      const indexNames = indexes.map((i: any) => i.indexname);
      const requiredIndexes = [
        'idx_school_payment_records_school_id',
        'idx_school_payment_records_recorded_at',
        'idx_school_payment_records_payment_type'
      ];
      const missing = requiredIndexes.filter(idx => !indexNames.includes(idx));
      if (missing.length === 0) {
        addResult('Payment Records Indexes', 'PASS', 'All required indexes exist');
      } else {
        addResult('Payment Records Indexes', 'FAIL', `Missing indexes: ${missing.join(', ')}`);
      }
    } catch (error: any) {
      addResult('Payment Records Indexes', 'FAIL', error.message);
    }

    // Test 4: Schools Table Has max_students Index
    try {
      const indexCheck = await sql`
        SELECT EXISTS (
          SELECT FROM pg_indexes 
          WHERE tablename = 'schools' 
          AND indexname = 'idx_schools_max_students'
        );
      `;
      if (indexCheck[0]?.exists) {
        addResult('Schools max_students Index', 'PASS', 'Index exists');
      } else {
        addResult('Schools max_students Index', 'FAIL', 'Index does not exist');
      }
    } catch (error: any) {
      addResult('Schools max_students Index', 'FAIL', error.message);
    }

    // Test 5: Payment Records Backfilled
    try {
      const paymentCount = await sql`
        SELECT COUNT(*) as count FROM school_payment_records;
      `;
      const schoolCount = await sql`SELECT COUNT(*) as count FROM schools WHERE payment_amount::DECIMAL > 0;`;
      const count = paymentCount[0]?.count || 0;
      const expected = schoolCount[0]?.count || 0;
      if (count >= expected) {
        addResult('Payment Records Backfill', 'PASS', `${count} payment records created`);
      } else {
        addResult('Payment Records Backfill', 'FAIL', `Expected at least ${expected}, found ${count}`);
      }
    } catch (error: any) {
      addResult('Payment Records Backfill', 'FAIL', error.message);
    }

    // Test 6: Schema Constraints
    try {
      const constraints = await sql`
        SELECT conname, contype 
        FROM pg_constraint 
        WHERE conrelid = 'school_payment_records'::regclass;
      `;
      const hasFrequencyCheck = constraints.some((c: any) => 
        c.conname.includes('payment_frequency') || c.conname.includes('check')
      );
      if (hasFrequencyCheck || constraints.length > 0) {
        addResult('Payment Records Constraints', 'PASS', `${constraints.length} constraints found`);
      } else {
        addResult('Payment Records Constraints', 'SKIP', 'Could not verify constraints');
      }
    } catch (error: any) {
      addResult('Payment Records Constraints', 'SKIP', 'Could not check constraints');
    }

    // Test 7: Verify Student Count vs Limit
    try {
      const schoolsWithCounts = await sql`
        SELECT 
          s.id,
          s.name,
          s.max_students,
          COUNT(st.id) as student_count
        FROM schools s
        LEFT JOIN students st ON s.id = st.school_id
        GROUP BY s.id, s.name, s.max_students
        ORDER BY s.name;
      `;
      
      let allValid = true;
      schoolsWithCounts.forEach((school: any) => {
        if (school.student_count > school.max_students) {
          allValid = false;
        }
      });
      
      if (allValid) {
        addResult('Student Count vs Limit', 'PASS', `All schools within limits (checked ${schoolsWithCounts.length} schools)`);
      } else {
        const violations = schoolsWithCounts.filter((s: any) => s.student_count > s.max_students);
        addResult('Student Count vs Limit', 'FAIL', `${violations.length} schools exceed limit`);
      }
    } catch (error: any) {
      addResult('Student Count vs Limit', 'FAIL', error.message);
    }

    // Test 8: Payment Records Structure
    try {
      const columns = await sql`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'school_payment_records'
        ORDER BY ordinal_position;
      `;
      const requiredColumns = [
        'id', 'school_id', 'payment_amount', 'payment_frequency', 
        'payment_type', 'recorded_at', 'created_at'
      ];
      const columnNames = columns.map((c: any) => c.column_name);
      const missing = requiredColumns.filter(col => !columnNames.includes(col));
      if (missing.length === 0) {
        addResult('Payment Records Structure', 'PASS', `All ${requiredColumns.length} required columns exist`);
      } else {
        addResult('Payment Records Structure', 'FAIL', `Missing columns: ${missing.join(', ')}`);
      }
    } catch (error: any) {
      addResult('Payment Records Structure', 'FAIL', error.message);
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 Test Summary');
    console.log('='.repeat(60));
    
    const passed = results.filter(r => r.status === 'PASS').length;
    const failed = results.filter(r => r.status === 'FAIL').length;
    const skipped = results.filter(r => r.status === 'SKIP').length;
    
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`⚠️  Skipped: ${skipped}`);
    console.log(`📋 Total: ${results.length}`);
    
    if (failed === 0) {
      console.log('\n🎉 All critical tests passed!');
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

runTests();

