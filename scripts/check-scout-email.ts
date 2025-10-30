#!/usr/bin/env tsx

import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  console.log('Checking all users with scout@xen.com email...\n');
  
  const users = await sql`
    SELECT id, email, role, name, xen_id, linked_id 
    FROM users 
    WHERE email = 'scout@xen.com'
  `;
  
  console.log('Users found:');
  console.log(JSON.stringify(users, null, 2));
  
  console.log('\nChecking admins table...');
  const admins = await sql`
    SELECT id, email, role, name, xen_id 
    FROM admins 
    WHERE email = 'scout@xen.com'
  `;
  
  console.log('Admins found:');
  console.log(JSON.stringify(admins, null, 2));
}

main().catch(console.error);
