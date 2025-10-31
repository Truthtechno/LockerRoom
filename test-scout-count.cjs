const { neon } = require('@neondatabase/serverless');
const { drizzle } = require('drizzle-orm/neon-http');
const { sql } = require('drizzle-orm');
const { randomUUID } = require('crypto');
const bcrypt = require('bcrypt');

// Database connection - same as in server/db.ts
const sqlConnection = neon(process.env.DATABASE_URL);
const db = drizzle(sqlConnection);

async function createTestScout() {
  try {
    const scoutId = randomUUID();
    const hashedPassword = await bcrypt.hash('testpassword123', 10);
    
    // Insert test scout
    await db.execute(sql`
      INSERT INTO users (id, name, email, password_hash, role, linked_id, created_at)
      VALUES (${scoutId}, ${'Test Scout'}, ${'testscout@example.com'}, ${hashedPassword}, ${'xen_scout'}, ${scoutId}, ${new Date()})
    `);
    
    console.log('✅ Test scout created successfully with ID:', scoutId);
    
    // Check all users in the database
    const allUsers = await db.execute(sql`
      SELECT id, name, email, role, created_at 
      FROM users 
      ORDER BY created_at DESC
      LIMIT 10
    `);
    
    console.log('✅ All users in database (last 10):', allUsers);
    
    // Check all users with scout roles
    const allScouts = await db.execute(sql`
      SELECT id, name, email, role, created_at 
      FROM users 
      WHERE role IN ('xen_scout', 'scout_admin')
      ORDER BY created_at DESC
    `);
    
    console.log('✅ All scouts in database:', allScouts);
    
    // Test the count query
    const result = await db.execute(sql`
      SELECT COUNT(*) as count 
      FROM users 
      WHERE role IN ('xen_scout', 'scout_admin')
    `);
    
    console.log('✅ Scout count query result:', result);
    console.log('✅ Total scouts found:', result.rows[0]?.count || 'undefined');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

createTestScout();
