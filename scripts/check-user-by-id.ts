#!/usr/bin/env tsx

import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  const userId = process.argv[2];
  if (!userId) {
    console.log('Usage: npx tsx check-user-by-id.ts <user-id>');
    return;
  }
  
  console.log(`Checking user ID: ${userId}\n`);
  
  const user = await sql`
    SELECT id, email, role, linked_id, name, xen_id, profile_pic_url 
    FROM users 
    WHERE id = ${userId}
  `;
  
  console.log('User found:');
  console.log(JSON.stringify(user, null, 2));
}

main().catch(console.error);
