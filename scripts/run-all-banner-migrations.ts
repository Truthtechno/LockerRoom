#!/usr/bin/env tsx
/**
 * Run all banner-related migrations in order
 * 1. Create banners table (if not exists)
 * 2. Add target_school_ids column
 */

import { db } from '../server/db';
import { sql } from 'drizzle-orm';

async function runBannersTableMigration() {
  console.log('📝 Step 1: Creating banners table (if not exists)...\n');

  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS banners (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        category TEXT NOT NULL CHECK (category IN ('info', 'warning', 'success', 'error', 'announcement')),
        target_roles TEXT[] NOT NULL DEFAULT '{}',
        start_date TIMESTAMP,
        end_date TIMESTAMP,
        is_active BOOLEAN DEFAULT true,
        priority INTEGER DEFAULT 0,
        created_by_admin_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT now() NOT NULL,
        updated_at TIMESTAMP DEFAULT now() NOT NULL
      )
    `);
    console.log('   ✅ Banners table created/verified');

    // Create indexes
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_banners_target_roles ON banners USING GIN(target_roles)
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_banners_is_active ON banners(is_active)
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_banners_dates ON banners(start_date, end_date)
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_banners_priority ON banners(priority DESC)
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_banners_created_by ON banners(created_by_admin_id)
    `);
    console.log('   ✅ Indexes created');
    return true;
  } catch (error: any) {
    if (error.message && error.message.includes('already exists')) {
      console.log('   ℹ️  Banners table already exists');
      return true;
    }
    throw error;
  }
}

async function runTargetSchoolsMigration() {
  console.log('\n📝 Step 2: Adding target_school_ids column...\n');

  try {
    await db.execute(sql`
      ALTER TABLE banners ADD COLUMN IF NOT EXISTS target_school_ids TEXT[] DEFAULT NULL
    `);
    console.log('   ✅ Column added');

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_banners_target_school_ids ON banners USING GIN(target_school_ids)
    `);
    console.log('   ✅ Index created');
    return true;
  } catch (error: any) {
    if (error.message && error.message.includes('already exists')) {
      console.log('   ℹ️  Column already exists');
      return true;
    }
    throw error;
  }
}

async function verifyMigration() {
  console.log('\n🔍 Verifying migration...\n');

  try {
    // Check if table exists
    const tableCheck = await db.execute(sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name = 'banners'
    `);

    if (!tableCheck.rows || tableCheck.rows.length === 0) {
      console.log('   ❌ Banners table does not exist!');
      return false;
    }
    console.log('   ✅ Banners table exists');

    // Check if target_school_ids column exists
    const columnCheck = await db.execute(sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'banners' AND column_name = 'target_school_ids'
    `);

    if (columnCheck.rows && columnCheck.rows.length > 0) {
      console.log('   ✅ target_school_ids column exists');
      console.log('      Type:', columnCheck.rows[0].data_type);
      console.log('      Nullable:', columnCheck.rows[0].is_nullable);
      return true;
    } else {
      console.log('   ❌ target_school_ids column does not exist!');
      return false;
    }
  } catch (error: any) {
    console.error('   ❌ Verification failed:', error.message);
    return false;
  }
}

async function runAllMigrations() {
  console.log('🚀 Running All Banner Migrations...\n');

  try {
    const step1 = await runBannersTableMigration();
    if (!step1) {
      throw new Error('Failed to create banners table');
    }

    const step2 = await runTargetSchoolsMigration();
    if (!step2) {
      throw new Error('Failed to add target_school_ids column');
    }

    const verified = await verifyMigration();
    if (!verified) {
      throw new Error('Migration verification failed');
    }

    console.log('\n✅ All banner migrations completed successfully!');
    return true;
  } catch (error: any) {
    console.error('\n❌ Migration failed:', error.message);
    throw error;
  }
}

runAllMigrations()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Migration process failed:', error);
    process.exit(1);
  });

