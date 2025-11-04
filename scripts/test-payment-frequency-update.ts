import { config } from 'dotenv';
import { db } from '../server/db';
import { schools } from '../shared/schema';
import { eq, sql } from 'drizzle-orm';

config();

async function testPaymentFrequencyUpdate() {
  try {
    console.log('🔍 Testing Payment Frequency Update Logic...\n');

    // Get all schools
    const allSchools = await db.select().from(schools);
    
    console.log(`📊 Found ${allSchools.length} schools\n`);
    
    for (const school of allSchools) {
      console.log(`\n🏫 School: ${school.name}`);
      console.log(`   ID: ${school.id}`);
      console.log(`   Current Frequency: ${school.paymentFrequency}`);
      console.log(`   Last Payment: ${school.lastPaymentDate?.toISOString() || 'N/A'}`);
      console.log(`   Current Expiry: ${school.subscriptionExpiresAt?.toISOString() || 'N/A'}`);
      
      // Test the calculation logic
      if (school.lastPaymentDate && school.paymentFrequency === 'annual') {
        const baseDate = new Date(school.lastPaymentDate);
        const expectedExpiry = new Date(baseDate);
        expectedExpiry.setFullYear(expectedExpiry.getFullYear() + 1);
        
        console.log(`   Expected Expiry (annual): ${expectedExpiry.toISOString()}`);
        
        if (school.subscriptionExpiresAt) {
          const actualExpiry = new Date(school.subscriptionExpiresAt);
          const diffDays = Math.round((actualExpiry.getTime() - expectedExpiry.getTime()) / (1000 * 60 * 60 * 24));
          
          if (Math.abs(diffDays) > 1) {
            console.log(`   ⚠️  MISMATCH! Actual expiry is ${diffDays} days different from expected`);
            console.log(`   💡 This school needs to be updated`);
          } else {
            console.log(`   ✅ Expiry date matches expected calculation`);
          }
        }
      }
      
      if (school.lastPaymentDate && school.paymentFrequency === 'monthly') {
        const baseDate = new Date(school.lastPaymentDate);
        const expectedExpiry = new Date(baseDate);
        expectedExpiry.setMonth(expectedExpiry.getMonth() + 1);
        
        console.log(`   Expected Expiry (monthly): ${expectedExpiry.toISOString()}`);
        
        if (school.subscriptionExpiresAt) {
          const actualExpiry = new Date(school.subscriptionExpiresAt);
          const diffDays = Math.round((actualExpiry.getTime() - expectedExpiry.getTime()) / (1000 * 60 * 60 * 24));
          
          if (Math.abs(diffDays) > 1) {
            console.log(`   ⚠️  MISMATCH! Actual expiry is ${diffDays} days different from expected`);
            console.log(`   💡 This school needs to be updated`);
          } else {
            console.log(`   ✅ Expiry date matches expected calculation`);
          }
        }
      }
    }
    
    // Find XEN ACADEMY specifically
    console.log('\n\n🔎 Checking XEN ACADEMY specifically...\n');
    const xenAcademy = allSchools.find(s => s.name.includes('XEN') || s.name.includes('Xen'));
    
    if (xenAcademy) {
      console.log(`Found: ${xenAcademy.name}`);
      console.log(`   Frequency: ${xenAcademy.paymentFrequency}`);
      console.log(`   Last Payment: ${xenAcademy.lastPaymentDate?.toISOString() || 'N/A'}`);
      console.log(`   Current Expiry: ${xenAcademy.subscriptionExpiresAt?.toISOString() || 'N/A'}`);
      
      if (xenAcademy.lastPaymentDate && xenAcademy.paymentFrequency === 'annual') {
        const baseDate = new Date(xenAcademy.lastPaymentDate);
        const expectedExpiry = new Date(baseDate);
        expectedExpiry.setFullYear(expectedExpiry.getFullYear() + 1);
        console.log(`   Expected Expiry: ${expectedExpiry.toISOString()}`);
        
        if (xenAcademy.subscriptionExpiresAt) {
          const actualExpiry = new Date(xenAcademy.subscriptionExpiresAt);
          const diffDays = Math.round((actualExpiry.getTime() - expectedExpiry.getTime()) / (1000 * 60 * 60 * 24));
          console.log(`   Difference: ${diffDays} days`);
        }
      }
    } else {
      console.log('❌ XEN ACADEMY not found');
    }
    
    console.log('\n✅ Test completed');
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Test failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

testPaymentFrequencyUpdate();

