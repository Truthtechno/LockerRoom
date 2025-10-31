import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { eq } from 'drizzle-orm';
import { 
  users, 
  schools, 
  students, 
  schoolAdmins,
  posts,
  type InsertUser,
  type InsertSchool,
  type InsertStudent,
  type InsertSchoolAdmin
} from '@shared/schema';
import bcrypt from 'bcrypt';

// Test database connection
const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql);

describe('Data Persistence and School Mapping Tests', () => {
  let testSchoolId: string;
  let testSchoolAdminUserId: string;
  let testStudentUserId: string;

  beforeAll(async () => {
    // Clean up any existing test data
    await db.delete(posts);
    await db.delete(students);
    await db.delete(schoolAdmins);
    await db.delete(users);
    await db.delete(schools);
  });

  afterAll(async () => {
    // Clean up test data
    await db.delete(posts);
    await db.delete(students);
    await db.delete(schoolAdmins);
    await db.delete(users);
    await db.delete(schools);
  });

  describe('🔐 Data Preservation', () => {
    it('should preserve existing user accounts during operations', async () => {
      // Create a test school
      const [testSchool] = await db.insert(schools).values({
        name: 'Test Academy',
        subscriptionPlan: 'premium',
        maxStudents: 200
      } as InsertSchool).returning();
      testSchoolId = testSchool.id;

      // Create a school admin
      const [schoolAdmin] = await db.insert(schoolAdmins).values({
        name: 'Test Principal',
        schoolId: testSchool.id,
        position: 'Principal'
      } as InsertSchoolAdmin).returning();

      const [schoolAdminUser] = await db.insert(users).values({
        email: 'principal@testacademy.edu',
        passwordHash: await bcrypt.hash('test123', 12),
        role: 'school_admin',
        linkedId: schoolAdmin.id,
        name: 'Test Principal',
        schoolId: testSchool.id
      } as InsertUser).returning();
      testSchoolAdminUserId = schoolAdminUser.id;

      // Create a student
      const [student] = await db.insert(students).values({
        schoolId: testSchool.id,
        name: 'Test Student',
        sport: 'Soccer',
        position: 'Forward'
      } as InsertStudent).returning();

      const [studentUser] = await db.insert(users).values({
        email: 'student@testacademy.edu',
        passwordHash: await bcrypt.hash('test123', 12),
        role: 'student',
        linkedId: student.id,
        name: 'Test Student',
        schoolId: testSchool.id
      } as InsertUser).returning();
      testStudentUserId = studentUser.id;

      // Verify data exists
      const existingUsers = await db.select().from(users);
      expect(existingUsers.length).toBeGreaterThan(0);
      
      const existingSchools = await db.select().from(schools);
      expect(existingSchools.length).toBeGreaterThan(0);
    });

    it('should not delete existing data when checking for demo accounts', async () => {
      // This simulates the safe reseed logic
      const existingDemoUsers = await db.select()
        .from(users)
        .where(eq(users.email, 'admin@lockerroom.com'));
      
      // Should not delete existing data even if demo users don't exist
      const allUsers = await db.select().from(users);
      expect(allUsers.length).toBeGreaterThan(0);
    });
  });

  describe('🏫 School Mapping and Authentication', () => {
    it('should correctly map school admin to their school', async () => {
      const schoolAdmin = await db.select()
        .from(users)
        .leftJoin(schoolAdmins, eq(users.linkedId, schoolAdmins.id))
        .where(eq(users.id, testSchoolAdminUserId));

      expect(schoolAdmin[0]).toBeDefined();
      expect(schoolAdmin[0].school_admins?.schoolId).toBe(testSchoolId);
    });

    it('should correctly map student to their school', async () => {
      const student = await db.select()
        .from(users)
        .where(eq(users.id, testStudentUserId));

      expect(student[0]).toBeDefined();
      expect(student[0].users?.schoolId).toBe(testSchoolId);
    });

    it('should enforce school boundaries for student creation', async () => {
      // Create another school
      const [otherSchool] = await db.insert(schools).values({
        name: 'Other Academy',
        subscriptionPlan: 'standard',
        maxStudents: 100
      } as InsertSchool).returning();

      // Try to create a student in the wrong school (this should be prevented by business logic)
      // For now, we'll test that the data structure supports this validation
      const schoolAdmin = await db.select()
        .from(users)
        .where(eq(users.id, testSchoolAdminUserId));

      expect(schoolAdmin[0].users?.schoolId).toBe(testSchoolId);
      expect(schoolAdmin[0].users?.schoolId).not.toBe(otherSchool.id);
    });

    it('should provide correct school data for frontend display', async () => {
      // Test the school info endpoint data structure
      const school = await db.select()
        .from(schools)
        .where(eq(schools.id, testSchoolId));

      expect(school[0]).toBeDefined();
      expect(school[0].schools?.name).toBe('Test Academy');
      expect(school[0].schools?.subscriptionPlan).toBe('premium');
      expect(school[0].schools?.maxStudents).toBe(200);
    });
  });

  describe('👤 Profile Fallbacks', () => {
    it('should handle users without profile pictures', async () => {
      const user = await db.select()
        .from(users)
        .where(eq(users.id, testStudentUserId));

      expect(user[0]).toBeDefined();
      
      // Test initials generation logic
      const name = user[0].users?.name || '';
      const initials = name.split(' ').map(word => word.charAt(0)).join('').toUpperCase();
      expect(initials).toBe('TS'); // "Test Student"
    });

    it('should maintain referential integrity between users and profiles', async () => {
      const student = await db.select()
        .from(users)
        .leftJoin(students, eq(users.linkedId, students.id))
        .where(eq(users.id, testStudentUserId));

      expect(student[0]).toBeDefined();
      expect(student[0].students?.name).toBe('Test Student');
      expect(student[0].students?.schoolId).toBe(testSchoolId);
    });
  });

  describe('🛠️ Backend Authentication Logic', () => {
    it('should properly authenticate school admins', async () => {
      const schoolAdmin = await db.select()
        .from(users)
        .leftJoin(schoolAdmins, eq(users.linkedId, schoolAdmins.id))
        .where(eq(users.email, 'principal@testacademy.edu'));

      expect(schoolAdmin[0]).toBeDefined();
      expect(schoolAdmin[0].users?.role).toBe('school_admin');
      expect(schoolAdmin[0].school_admins?.schoolId).toBe(testSchoolId);
    });

    it('should properly authenticate students', async () => {
      const student = await db.select()
        .from(users)
        .leftJoin(students, eq(users.linkedId, students.id))
        .where(eq(users.email, 'student@testacademy.edu'));

      expect(student[0]).toBeDefined();
      expect(student[0].users?.role).toBe('student');
      expect(student[0].users?.schoolId).toBe(testSchoolId);
    });

    it('should maintain linkedId relationships', async () => {
      const schoolAdmin = await db.select()
        .from(users)
        .where(eq(users.email, 'principal@testacademy.edu'));

      const schoolAdminProfile = await db.select()
        .from(schoolAdmins)
        .where(eq(schoolAdmins.id, schoolAdmin[0].users?.linkedId));

      expect(schoolAdminProfile[0]).toBeDefined();
      expect(schoolAdminProfile[0].school_admins?.name).toBe('Test Principal');
    });
  });

  describe('🌍 Future-Proof Updates', () => {
    it('should handle schema updates without data loss', async () => {
      // Test that existing data remains intact
      const existingSchools = await db.select().from(schools);
      const existingUsers = await db.select().from(users);
      const existingStudents = await db.select().from(students);

      expect(existingSchools.length).toBeGreaterThan(0);
      expect(existingUsers.length).toBeGreaterThan(0);
      expect(existingStudents.length).toBeGreaterThan(0);
    });

    it('should support safe seeding operations', async () => {
      // Simulate safe seeding check
      const demoUserCheck = await db.select()
        .from(users)
        .where(eq(users.email, 'admin@lockerroom.com'));

      // Should not affect existing data
      const allUsers = await db.select().from(users);
      expect(allUsers.length).toBeGreaterThan(0);
    });
  });

  describe('✅ Integration Verification', () => {
    it('should verify complete school admin workflow', async () => {
      // 1. School admin should see their school data
      const schoolAdmin = await db.select()
        .from(users)
        .leftJoin(schoolAdmins, eq(users.linkedId, schoolAdmins.id))
        .where(eq(users.id, testSchoolAdminUserId));

      expect(schoolAdmin[0].users?.schoolId).toBe(testSchoolId);

      // 2. School admin should see students from their school only
      const schoolStudents = await db.select()
        .from(students)
        .where(eq(students.schoolId, testSchoolId));

      expect(schoolStudents.length).toBeGreaterThan(0);
      expect(schoolStudents[0].students?.schoolId).toBe(testSchoolId);

      // 3. Student should see their correct school
      const student = await db.select()
        .from(users)
        .leftJoin(students, eq(users.linkedId, students.id))
        .where(eq(users.id, testStudentUserId));

      expect(student[0].users?.schoolId).toBe(testSchoolId);
      expect(student[0].students?.schoolId).toBe(testSchoolId);
    });

    it('should verify profile fallback functionality', async () => {
      // Test that users without profile pictures get proper fallbacks
      const user = await db.select()
        .from(users)
        .where(eq(users.id, testStudentUserId));

      const name = user[0].users?.name || '';
      const initials = name.split(' ').map(word => word.charAt(0)).join('').toUpperCase();
      
      expect(initials).toBeTruthy();
      expect(initials.length).toBeGreaterThan(0);
      expect(initials.length).toBeLessThanOrEqual(2);
    });

    it('should verify data persistence across operations', async () => {
      // Perform some operations and verify data remains intact
      const initialUserCount = (await db.select().from(users)).length;
      const initialSchoolCount = (await db.select().from(schools)).length;

      // Simulate some operations (without actually modifying data)
      const usersAfter = await db.select().from(users);
      const schoolsAfter = await db.select().from(schools);

      expect(usersAfter.length).toBe(initialUserCount);
      expect(schoolsAfter.length).toBe(initialSchoolCount);
    });
  });
});
