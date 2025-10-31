import "dotenv/config";
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { eq } from 'drizzle-orm';
import { users, systemAdmins, schools } from './shared/schema';
import bcrypt from 'bcrypt';

const sql = neon(process.env.DATABASE_URL);
const db = drizzle(sql);

async function seed() {
  try {
    console.log('🌱 Starting database seeding...');

    // Check if system admin already exists
    const existingAdmin = await db.select().from(users).where(eq(users.email, 'sysadmin@lockerroom.com'));
    
    if (existingAdmin.length > 0) {
      console.log('✅ System admin already exists, skipping...');
      return;
    }

    // Create system admin profile
    const [systemAdminProfile] = await db.insert(systemAdmins).values({
      name: 'System Administrator',
      bio: 'Default system administrator for LockerRoom platform',
      permissions: ['all']
    }).returning();

    console.log('👨‍💼 Created system admin profile:', systemAdminProfile.id);

    // Hash the default password
    const passwordHash = await bcrypt.hash('SuperSecure123!', 12);

    // Create system admin user
    const [systemAdminUser] = await db.insert(users).values({
      email: 'sysadmin@lockerroom.com',
      name: 'System Administrator',
      passwordHash,
      role: 'system_admin',
      linkedId: systemAdminProfile.id,
      emailVerified: true,
    }).returning();

    console.log('✅ System admin user created:', systemAdminUser.email);

    // Create a demo school for testing
    const [demoSchool] = await db.insert(schools).values({
      name: 'Demo High School',
      address: '123 Demo Street, Demo City, DC 12345',
      contactEmail: 'admin@demohigh.edu',
      contactPhone: '+1-555-0123',
      subscriptionPlan: 'premium',
      maxStudents: 500
    }).returning();

    console.log('🏫 Created demo school:', demoSchool.name);

    console.log('🎉 Database seeding completed successfully!');
    console.log('📧 System Admin Login: sysadmin@lockerroom.com');
    console.log('🔑 System Admin Password: SuperSecure123!');

  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
}

seed();
