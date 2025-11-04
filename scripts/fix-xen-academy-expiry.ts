import { config } from 'dotenv';
import { db } from '../server/db';
import { schools } from '../shared/schema';
import { eq, sql } from 'drizzle-orm';

config();

async function fixXenAcademyExpiry() {
  try {
    console.log('🔧 Fixing XEN ACADEMY expiry date...\n');

    // Find XEN ACADEMY
    const xenAcademy = await db.select().from(schools).where(sql`name ILIKE '%XEN%'`).limit(1);
    
    if (xenAcademy.length === 0) {
      console.log('❌ XEN ACADEMY not found');
      process.exit(1);
    }
    
    const school = xenAcademy[0];
    console.log(`📊 Current data:`);
    console.log(`   Name: ${school.name}`);
    console.log(`   Frequency: ${school.paymentFrequency}`);
    console.log(`   Last Payment: ${school.lastPaymentDate?.toISOString() || 'N/A'}`);
    console.log(`   Current Expiry: ${school.subscriptionExpiresAt?.toISOString() || 'N/A'}`);
    
    if (school.lastPaymentDate && school.paymentFrequency === 'annual') {
      const baseDate = new Date(school.lastPaymentDate);
      const newExpiry = new Date(baseDate);
      newExpiry.setFullYear(newExpiry.getFullYear() + 1);
      
      console.log(`\n📅 Calculating new expiry:`);
      console.log(`   Base date: ${baseDate.toISOString()}`);
      console.log(`   New expiry: ${newExpiry.toISOString()}`);
      
      // Update the school
      const [updated] = await db.update(schools)
        .set({
          subscriptionExpiresAt: newExpiry,
          updatedAt: new Date(),
        })
        .where(eq(schools.id, school.id))
        .returning();
      
      console.log(`\n✅ Updated successfully!`);
      console.log(`   New expiry: ${updated.subscriptionExpiresAt?.toISOString() || 'N/A'}`);
    } else {
      console.log('⚠️ School does not have required data to fix');
    }
    
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Fix failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

fixXenAcademyExpiry();

