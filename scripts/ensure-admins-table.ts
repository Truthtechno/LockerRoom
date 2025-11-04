#!/usr/bin/env tsx

/**
 * Script to ensure the admins table exists and backfill existing admin data
 * This ensures data persistence after server restarts
 */

import 'dotenv/config';
import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'fs';
import { join } from 'path';

const sql = neon(process.env.DATABASE_URL!);

async function ensureAdminsTable() {
  console.log('🔧 Ensuring admins table exists...');
  
  try {
    // Read the migration file
    const migrationPath = join(process.cwd(), 'migrations', '2025-01-28_admins_table.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf-8');
    
    console.log('📝 Executing admins table migration...');
    
    // Split by semicolon and execute each statement
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    for (const statement of statements) {
      if (statement.trim()) {
        try {
          await sql(statement);
        } catch (error: any) {
          // If table/index already exists, that's fine
          if (error.message?.includes('already exists') || error.code === '42P07' || error.code === '23505') {
            // Continue
          } else {
            throw error;
          }
        }
      }
    }
    
    console.log('✅ Admins table migration completed');
  } catch (error: any) {
    // If table already exists, that's fine
    if (error.message?.includes('already exists') || error.code === '42P07') {
      console.log('✅ Admins table already exists');
    } else {
      console.error('❌ Error ensuring admins table:', error);
      throw error;
    }
  }
}

async function backfillAdminsFromUsers() {
  console.log('🔄 Backfilling admins from users table...');
  
  try {
    // Get all users with admin roles that don't exist in admins table
    const adminRoles = ['system_admin', 'scout_admin', 'xen_scout', 'moderator', 'finance', 'support', 'coach', 'analyst'];
    
    const usersToBackfill = await sql`
      SELECT 
        u.id,
        u.name,
        u.email,
        u.role,
        u.xen_id,
        u.profile_pic_url,
        u.otp,
        u.created_at
      FROM users u
      WHERE u.role = ANY(${adminRoles})
        AND NOT EXISTS (
          SELECT 1 FROM admins a WHERE LOWER(a.email) = LOWER(u.email)
        )
    `;
    
    if (usersToBackfill.length === 0) {
      console.log('✅ No admins to backfill - all admins already exist in admins table');
      return;
    }
    
    console.log(`📊 Found ${usersToBackfill.length} admins in users table that need to be backfilled`);
    
    // Insert each admin into the admins table
    for (const user of usersToBackfill) {
      try {
        await sql`
          INSERT INTO admins (id, name, email, role, profile_pic_url, xen_id, otp, created_at)
          VALUES (
            ${user.id},
            ${user.name || 'Unknown'},
            ${user.email},
            ${user.role},
            ${user.profile_pic_url || null},
            ${user.xen_id || null},
            ${user.otp || null},
            ${user.created_at || new Date()}
          )
          ON CONFLICT (email) DO NOTHING
        `;
        
        // Update the user's linkedId to point to the admin record (if it doesn't already)
        await sql`
          UPDATE users
          SET linked_id = ${user.id}
          WHERE id = ${user.id} AND (linked_id IS NULL OR linked_id = '')
        `;
        
        console.log(`✅ Backfilled admin: ${user.email} (${user.role})`);
      } catch (error: any) {
        if (error.message?.includes('unique constraint') || error.code === '23505') {
          console.log(`⚠️ Admin ${user.email} already exists in admins table, skipping`);
        } else {
          console.error(`❌ Error backfilling admin ${user.email}:`, error);
        }
      }
    }
    
    console.log(`✅ Backfilled ${usersToBackfill.length} admins from users table`);
  } catch (error) {
    console.error('❌ Error backfilling admins:', error);
    throw error;
  }
}

async function main() {
  console.log('🚀 Starting admins table setup and backfill...');
  
  try {
    // Step 1: Ensure admins table exists
    await ensureAdminsTable();
    
    // Step 2: Backfill existing admins from users table
    await backfillAdminsFromUsers();
    
    console.log('🎉 Admins table setup completed successfully!');
  } catch (error) {
    console.error('❌ Failed to setup admins table:', error);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { ensureAdminsTable, backfillAdminsFromUsers };

