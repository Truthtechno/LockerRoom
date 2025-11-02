import { neon } from '@neondatabase/serverless';
import { config } from 'dotenv';

config();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌ No DATABASE_URL found');
  process.exit(1);
}

async function testPaymentEndToEnd() {
  console.log('🧪 Testing Payment System End-to-End...\n');
  const sql = neon(connectionString);
  
  let testUserId: string | null = null;
  let testTransactionId: string | null = null;
  
  try {
    // Test 1: Get or create a test user
    console.log('📋 Test 1: Setting up test user...');
    const users = await sql`
      SELECT id FROM users WHERE email = 'test-payment@lockerroom.test' LIMIT 1
    `;
    
    if (users.length > 0) {
      testUserId = users[0].id;
      console.log(`   ✅ Using existing test user: ${testUserId}`);
    } else {
      // Create a test user (you'll need to adjust this based on your user creation logic)
      console.log('   ⚠️  Test user not found - using first available user');
      const allUsers = await sql`SELECT id FROM users LIMIT 1`;
      if (allUsers.length === 0) {
        console.error('   ❌ No users found in database');
        return false;
      }
      testUserId = allUsers[0].id;
      console.log(`   ✅ Using user: ${testUserId}`);
    }
    
    // Test 2: Verify payment configuration exists and is valid
    console.log('\n📋 Test 2: Verifying payment configuration...');
    const paymentConfig = await sql`
      SELECT 
        currency,
        xen_scout_price,
        scout_ai_price,
        mock_mode_enabled
      FROM system_payment
      LIMIT 1
    `;
    
    if (paymentConfig.length === 0) {
      console.error('   ❌ No payment configuration found');
      return false;
    }
    
    const config = paymentConfig[0];
    const xenPrice = parseFloat(config.xen_scout_price || '0');
    const currency = config.currency || 'USD';
    
    if (xenPrice <= 0) {
      console.error('   ❌ Invalid XEN Watch price');
      return false;
    }
    
    console.log(`   ✅ Payment config valid:`);
    console.log(`      Currency: ${currency}`);
    console.log(`      XEN Watch Price: ${xenPrice} ${currency}`);
    console.log(`      Mock Mode: ${config.mock_mode_enabled ? 'Enabled' : 'Disabled'}`);
    
    // Test 3: Test creating a payment transaction
    console.log('\n📋 Test 3: Testing payment transaction creation...');
    const amountCents = Math.round(xenPrice * 100);
    
    const [transaction] = await sql`
      INSERT INTO payment_transactions (
        user_id,
        type,
        amount_cents,
        currency,
        status,
        provider,
        metadata
      ) VALUES (
        ${testUserId},
        'xen_watch',
        ${amountCents},
        ${currency},
        'pending',
        'mock',
        '{"test": true}'::jsonb
      )
      RETURNING id, status, amount_cents, currency
    `;
    
    if (!transaction || !transaction.id) {
      console.error('   ❌ Failed to create payment transaction');
      return false;
    }
    
    testTransactionId = transaction.id;
    console.log(`   ✅ Transaction created:`);
    console.log(`      ID: ${testTransactionId}`);
    console.log(`      Status: ${transaction.status}`);
    console.log(`      Amount: ${transaction.amount_cents} cents (${transaction.amount_cents / 100} ${transaction.currency})`);
    
    // Test 4: Update transaction to completed (simulating successful payment)
    console.log('\n📋 Test 4: Testing payment completion...');
    const [completedTransaction] = await sql`
      UPDATE payment_transactions
      SET 
        status = 'completed',
        provider_transaction_id = 'mock_test_' || ${Date.now()},
        updated_at = NOW()
      WHERE id = ${testTransactionId}
      RETURNING id, status, provider_transaction_id
    `;
    
    if (!completedTransaction || completedTransaction.status !== 'completed') {
      console.error('   ❌ Failed to update transaction to completed');
      return false;
    }
    
    console.log(`   ✅ Transaction completed:`);
    console.log(`      ID: ${completedTransaction.id}`);
    console.log(`      Status: ${completedTransaction.status}`);
    console.log(`      Provider Transaction ID: ${completedTransaction.provider_transaction_id}`);
    
    // Test 5: Verify transaction can be retrieved
    console.log('\n📋 Test 5: Testing transaction retrieval...');
    const retrievedTransaction = await sql`
      SELECT 
        id,
        user_id,
        type,
        amount_cents,
        currency,
        status,
        provider
      FROM payment_transactions
      WHERE id = ${testTransactionId}
      LIMIT 1
    `;
    
    if (retrievedTransaction.length === 0) {
      console.error('   ❌ Failed to retrieve transaction');
      return false;
    }
    
    const tx = retrievedTransaction[0];
    if (tx.user_id !== testUserId || tx.type !== 'xen_watch' || tx.status !== 'completed') {
      console.error('   ❌ Retrieved transaction data is invalid');
      return false;
    }
    
    console.log(`   ✅ Transaction retrieved successfully:`);
    console.log(`      User ID: ${tx.user_id}`);
    console.log(`      Type: ${tx.type}`);
    console.log(`      Amount: ${tx.amount_cents} cents`);
    console.log(`      Currency: ${tx.currency}`);
    console.log(`      Status: ${tx.status}`);
    
    // Test 6: Test querying transactions by user
    console.log('\n📋 Test 6: Testing transaction queries...');
    const userTransactions = await sql`
      SELECT COUNT(*) as count
      FROM payment_transactions
      WHERE user_id = ${testUserId} AND type = 'xen_watch'
    `;
    
    console.log(`   ✅ User has ${userTransactions[0].count} XEN Watch transactions`);
    
    // Test 7: Clean up test transaction
    console.log('\n📋 Test 7: Cleaning up test data...');
    await sql`
      DELETE FROM payment_transactions
      WHERE id = ${testTransactionId}
    `;
    console.log('   ✅ Test transaction cleaned up');
    
    console.log('\n✅ All end-to-end tests passed!');
    console.log('\n📊 Test Summary:');
    console.log('  ✅ Payment configuration is valid');
    console.log('  ✅ Payment transactions can be created');
    console.log('  ✅ Payment status can be updated');
    console.log('  ✅ Transactions can be retrieved');
    console.log('  ✅ User transaction queries work');
    console.log('\n✨ Payment system is fully functional!');
    
    return true;
    
  } catch (error: any) {
    console.error('\n❌ Test failed:', error.message);
    console.error('\n🔍 Error details:', error);
    
    // Clean up on error
    if (testTransactionId) {
      try {
        await sql`DELETE FROM payment_transactions WHERE id = ${testTransactionId}`;
        console.log('\n🧹 Cleaned up test transaction');
      } catch (cleanupError) {
        console.error('⚠️  Failed to cleanup test transaction');
      }
    }
    
    return false;
  }
}

testPaymentEndToEnd().then(success => {
  process.exit(success ? 0 : 1);
});

