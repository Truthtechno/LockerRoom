import 'dotenv/config';
import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcrypt';

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  console.log("🌱 Starting LockerRoom seed...");

  // Clear only system admin for safety (adjust if needed)
  await sql`DELETE FROM system_admins`;
  await sql`DELETE FROM school_admins`;
  await sql`DELETE FROM users WHERE role = 'system_admin'`;
  await sql`DELETE FROM users WHERE role = 'school_admin'`;

  const passwordHash = await bcrypt.hash("SuperSecure123!", 10);

  // Insert user in users table with linked_id as a generated UUID
  const user = await sql`
    INSERT INTO users (email, password_hash, role, linked_id)
    VALUES ('sysadmin@lockerroom.com', ${passwordHash}, 'system_admin', gen_random_uuid())
    RETURNING id, linked_id
  `;

  const userId = user[0].id;
  const linkedId = user[0].linked_id;

  // Insert into system_admins table using the same linked_id, with required name field
  await sql`
    INSERT INTO system_admins (id, name, created_at)
    VALUES (${linkedId}, 'System Admin', NOW())
  `;

  // Insert a school
  const school = await sql`
    INSERT INTO schools (name)
    VALUES ('Default Academy')
    RETURNING id
  `;
  const schoolId = school[0].id;

  // Hash school admin password
  const schoolAdminPassword = await bcrypt.hash('SchoolAdmin123!', 10);

  // Insert school admin user with linked_id as a generated UUID
  const schoolAdminUser = await sql`
    INSERT INTO users (email, password_hash, role, linked_id)
    VALUES ('schooladmin@lockerroom.com', ${schoolAdminPassword}, 'school_admin', gen_random_uuid())
    RETURNING id, linked_id
  `;
  const schoolAdminId = schoolAdminUser[0].id;
  const schoolAdminLinkedId = schoolAdminUser[0].linked_id;

  // Insert into school_admins table using the same linked_id, with required name field
  await sql`
    INSERT INTO school_admins (id, school_id, name, created_at)
    VALUES (${schoolAdminLinkedId}, ${schoolId}, 'Default School Admin', NOW())
  `;

  console.log(`
  ✅ System Admin created:
  Email: sysadmin@lockerroom.com
  Password: SuperSecure123!

  ✅ School Admin created:
  Email: schooladmin@lockerroom.com
  Password: SchoolAdmin123!
  School: Default Academy
  `);

  process.exit(0);
}

main().catch(err => {
  console.error("❌ Seed failed", err);
  process.exit(1);
});