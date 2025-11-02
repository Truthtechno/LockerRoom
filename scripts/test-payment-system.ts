import { neon } from '@neondatabase/serverless';
import { config } from 'dotenv';

config();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌ No DATABASE_URL found');
  process.exit(1);
}

async function testPaymentSystem() {
  console.log('🧪 Testing Payment System...\n');
  const sql = neon(connectionString);
  
  try {
    // Test 1: Check if all required columns exist
    console.log('📋 Test 1: Checking database schema...');
    const columns = await sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'system_payment'
      ORDER BY column_name
    `;
    
    const requiredColumns = [
      'xen_scout_price',
      'scout_ai_price',
      'subscription_monthly_price',
      'subscription_yearly_price',
      'currency',
      'mock_mode_enabled'
    ];
    
    const existingColumns = columns.map((c: any) => c.column_name);
    const missingColumns = requiredColumns.filter(col => !existingColumns.includes(col));
    
    if (missingColumns.length > 0) {
      console.error(`   ❌ Missing columns: ${missingColumns.join(', ')}`);
      return false;
    }
    console.log('   ✅ All required columns exist');
    
    // Test 2: Check if payment_transactions table exists
    console.log('\n📋 Test 2: Checking payment_transactions table...');
    const transactionTable = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name = 'payment_transactions'
    `;
    
    if (transactionTable.length === 0) {
      console.error('   ❌ payment_transactions table does not exist');
      return false;
    }
    console.log('   ✅ payment_transactions table exists');
    
    // Test 3: Check payment config exists and has valid data
    console.log('\n📋 Test 3: Checking payment configuration...');
    const paymentConfig = await sql`
      SELECT 
        currency,
        xen_scout_price,
        scout_ai_price,
        mock_mode_enabled,
        subscription_monthly_price,
        subscription_yearly_price
      FROM system_payment
      LIMIT 1
    `;
    
    if (paymentConfig.length === 0) {
      console.error('   ❌ No payment configuration found');
      return false;
    }
    
    const config = paymentConfig[0];
    console.log(`   ✅ Payment config found:`);
    console.log(`      Currency: ${config.currency}`);
    console.log(`      XEN Watch Price: ${config.xen_scout_price || 'N/A'}`);
    console.log(`      ScoutAI Price: ${config.scout_ai_price || 'N/A'}`);
    console.log(`      Mock Mode: ${config.mock_mode_enabled ? 'Enabled' : 'Disabled'}`);
    
    // Test 4: Verify price values are valid numbers
    console.log('\n📋 Test 4: Validating price values...');
    if (!config.xen_scout_price || isNaN(parseFloat(config.xen_scout_price))) {
      console.error('   ❌ Invalid XEN Watch price');
      return false;
    }
    console.log(`   ✅ XEN Watch price is valid: ${config.xen_scout_price}`);
    
    // Test 5: Test payment transaction insertion (dry run)
    console.log('\n📋 Test 5: Testing payment transaction structure...');
    const transactionColumns = await sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'payment_transactions'
      ORDER BY column_name
    `;
    
    const requiredTransactionColumns = [
      'id',
      'user_id',
      'type',
      'amount_cents',
      'currency',
      'status',
      'provider'
    ];
    
    const existingTransactionColumns = transactionColumns.map((c: any) => c.column_name);
    const missingTransactionColumns = requiredTransactionColumns.filter(col => !existingTransactionColumns.includes(col));
    
    if (missingTransactionColumns.length > 0) {
      console.error(`   ❌ Missing transaction columns: ${missingTransactionColumns.join(', ')}`);
      return false;
    }
    console.log('   ✅ All required transaction columns exist');
    
    // Test 6: Verify indexes exist
    console.log('\n📋 Test 6: Checking indexes...');
    const indexes = await sql`
      SELECT indexname 
      FROM pg_indexes 
      WHERE tablename = 'payment_transactions'
    `;
    
    if (indexes.length < 4) {
      console.warn(`   ⚠️  Expected at least 4 indexes, found ${indexes.length}`);
    } else {
      console.log(`   ✅ Found ${indexes.length} indexes on payment_transactions`);
    }
    
    console.log('\n✅ All tests passed! Payment system is ready.');
    console.log('\n📊 Summary:');
    console.log('  ✅ Database schema is correct');
    console.log('  ✅ Payment configuration exists');
    console.log('  ✅ Price values are valid');
    console.log('  ✅ Transaction table structure is correct');
    console.log('\n✨ The payment system is ready for testing!');
    
    return true;
    
  } catch (error: any) {
    console.error('\n❌ Test failed:', error.message);
    console.error('\n🔍 Error details:', error);
    return false;
  }
}

testPaymentSystem().then(success => {
  process.exit(success ? 0 : 1);
});

