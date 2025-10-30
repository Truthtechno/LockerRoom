import { db } from '../server/db';
import { sql } from 'drizzle-orm';

async function addScoutFields() {
  try {
    console.log('🚀 Adding scout fields to users table...');
    
    // Add new columns to users table
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS xen_id TEXT;`);
    console.log('✅ Added xen_id column');
    
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS otp TEXT;`);
    console.log('✅ Added otp column');
    
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_pic_url TEXT;`);
    console.log('✅ Added profile_pic_url column');
    
    // Add unique constraint for xen_id
    try {
      await db.execute(sql`ALTER TABLE users ADD CONSTRAINT users_xen_id_unique UNIQUE (xen_id);`);
      console.log('✅ Added unique constraint for xen_id');
    } catch (error: any) {
      if (error.message.includes('already exists')) {
        console.log('ℹ️  Unique constraint for xen_id already exists');
      } else {
        throw error;
      }
    }
    
    console.log('🎉 Scout fields added successfully!');
    
  } catch (error) {
    console.error('❌ Error adding scout fields:', error);
    throw error;
  }
}

addScoutFields()
  .then(() => {
    console.log('✅ Migration completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  });
