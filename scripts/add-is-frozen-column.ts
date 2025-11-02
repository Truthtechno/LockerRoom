import { db } from '../server/db';
import { sql } from 'drizzle-orm';

async function addIsFrozenColumn() {
  try {
    console.log('🚀 Adding is_frozen column to users table...');
    
    // Add is_frozen column
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_frozen BOOLEAN DEFAULT false;`);
    console.log('✅ Added is_frozen column');
    
    // Add index for efficient frozen account queries
    try {
      await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_users_is_frozen ON users(is_frozen) WHERE is_frozen = true;`);
      console.log('✅ Added index for is_frozen');
    } catch (error: any) {
      if (error.message.includes('already exists')) {
        console.log('ℹ️  Index for is_frozen already exists');
      } else {
        throw error;
      }
    }
    
    console.log('🎉 Migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Error adding is_frozen column:', error);
    throw error;
  }
}

addIsFrozenColumn()
  .then(() => {
    console.log('✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });

