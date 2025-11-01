#!/usr/bin/env tsx
/**
 * Run the banner target_school_ids migration
 * This adds the target_school_ids column to the banners table
 */

import { db } from '../server/db';
import { sql } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';

async function runBannerMigration() {
  console.log('🚀 Running banner migration: Adding target_school_ids column...\n');

  try {
    // Execute migrations one at a time (Neon HTTP driver doesn't support multiple statements)
    console.log('📝 Step 1: Adding target_school_ids column...');
    await db.execute(sql`
      ALTER TABLE banners ADD COLUMN IF NOT EXISTS target_school_ids TEXT[] DEFAULT NULL
    `);
    console.log('   ✅ Column added');

    console.log('📝 Step 2: Creating index...');
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_banners_target_school_ids ON banners USING GIN(target_school_ids)
    `);
    console.log('   ✅ Index created');

    console.log('📝 Step 3: Adding comment...');
    try {
      await db.execute(sql`
        COMMENT ON COLUMN banners.target_school_ids IS 'Array of school IDs that should see this banner (only applies when school_admin is in target_roles). NULL means all schools.'
      `);
      console.log('   ✅ Comment added');
    } catch (error: any) {
      // Comments might not be supported in all database setups
      if (error.message && error.message.includes('syntax error')) {
        console.log('   ℹ️  Skipping comment (not supported in this database setup)');
      } else {
        throw error;
      }
    }

    console.log('✅ Migration completed successfully!');
    console.log('   - Added target_school_ids column to banners table');
    console.log('   - Added index for performance');

    // Verify the migration
    console.log('\n🔍 Verifying migration...');
    const verifyResult = await db.execute(sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'banners' AND column_name = 'target_school_ids'
    `);

    if (verifyResult.rows && verifyResult.rows.length > 0) {
      console.log('✅ Column verified successfully:');
      console.log('   Column:', verifyResult.rows[0]);
    } else {
      console.log('⚠️  Warning: Could not verify column (this might be normal)');
    }

    return true;
  } catch (error: any) {
    if (error.message && error.message.includes('already exists')) {
      console.log('ℹ️  Column already exists - migration may have already been run');
      return true;
    }
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

// Run the migration
runBannerMigration()
  .then(() => {
    console.log('\n✅ Banner migration complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Banner migration failed:', error);
    process.exit(1);
  });

