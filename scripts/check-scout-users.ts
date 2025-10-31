#!/usr/bin/env tsx

import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  console.log('Checking scout users in database...\n');
  
  const scouts = await sql`
    SELECT id, email, role, linked_id, name, xen_id, profile_pic_url 
    FROM users 
    WHERE email IN ('scout@xen.com', 'scoutadmin@xen.com')
  `;
  
  console.log('Scout users found:');
  console.log(JSON.stringify(scouts, null, 2));
}

main().catch(console.error);
