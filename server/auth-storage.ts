// New centralized authentication storage for Supabase integration
import bcrypt from "bcrypt";
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { eq, and } from 'drizzle-orm';
import { 
  users, 
  viewers, 
  students, 
  schoolAdmins, 
  systemAdmins,
  type User,
  type UserProfile,
  type InsertUser,
  type InsertViewer,
  type InsertStudent,
  type InsertSchoolAdmin,
  type InsertSystemAdmin
} from "@shared/schema";

const connectionString = process.env.DATABASE_URL || "";
const sql = neon(connectionString);
const db = drizzle(sql);

export class AuthStorage {
  // Create user with role-specific profile (transactional)
  async createUserWithProfile(
    email: string, 
    password: string, 
    role: string, 
    profileData: any
  ): Promise<{ user: User; profile: UserProfile }> {
    const passwordHash = await bcrypt.hash(password, 12);
    
    try {
      // Create role-specific profile first
      let profileId: string;
      let profile: UserProfile;
      
      switch (role) {
        case 'viewer':
          const [viewer] = await db.insert(viewers).values({
            name: profileData.name,
            profilePicUrl: profileData.profilePicUrl,
            bio: profileData.bio,
            phone: profileData.phone,
          } as InsertViewer).returning();
          profileId = viewer.id;
          profile = { ...viewer, role: 'viewer', profilePicUrl: viewer.profilePicUrl ?? undefined };
          break;
          
        case 'student':
          const [student] = await db.insert(students).values({
            schoolId: profileData.schoolId,
            name: profileData.name,
            phone: profileData.phone,
            gender: profileData.gender,
            dateOfBirth: profileData.dateOfBirth,
            grade: profileData.grade,
            guardianContact: profileData.guardianContact,
            profilePicUrl: profileData.profilePicUrl,
            roleNumber: profileData.roleNumber,
            position: profileData.position,
            sport: profileData.sport,
            bio: profileData.bio,
            coverPhoto: profileData.coverPhoto,
          } as InsertStudent).returning();
          profileId = student.id;
          profile = { ...student, role: 'student', profilePicUrl: student.profilePicUrl ?? undefined };
          break;
          
        case 'school_admin':
          const [schoolAdmin] = await db.insert(schoolAdmins).values({
            name: profileData.name,
            schoolId: profileData.schoolId,
            profilePicUrl: profileData.profilePicUrl,
            bio: profileData.bio,
            phone: profileData.phone,
            position: profileData.position,
          } as InsertSchoolAdmin).returning();
          profileId = schoolAdmin.id;
          profile = { ...schoolAdmin, role: 'school_admin', profilePicUrl: schoolAdmin.profilePicUrl ?? undefined };
          break;
          
        case 'system_admin':
          const [systemAdmin] = await db.insert(systemAdmins).values({
            name: profileData.name,
            profilePicUrl: profileData.profilePicUrl,
            bio: profileData.bio,
            phone: profileData.phone,
            permissions: profileData.permissions || [],
          } as InsertSystemAdmin).returning();
          profileId = systemAdmin.id;
          profile = { ...systemAdmin, role: 'system_admin', profilePicUrl: systemAdmin.profilePicUrl ?? undefined };
          break;
          
        default:
          throw new Error(`Invalid role: ${role}`);
      }
      
      // Create user record with linked_id
      const [user] = await db.insert(users).values({
        email,
        passwordHash,
        role,
        linkedId: profileId,
      } as InsertUser).returning();
      
      return { user, profile };
    } catch (error) {
      throw new Error(`Failed to create user with profile: ${error}`);
    }
  }

  // Verify password and return user + profile
  async verifyPassword(email: string, password: string): Promise<{ user: User; profile: UserProfile } | null> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    if (!user) return null;
    
    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) return null;
    
    // Get role-specific profile
    const profile = await this.getUserProfile(user.id);
    if (!profile) return null;
    
    return { user, profile };
  }

  // Get user profile by role
  async getUserProfile(userId: string): Promise<UserProfile | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user) return undefined;
    
    switch (user.role) {
      case 'viewer':
        const [viewer] = await db.select().from(viewers).where(eq(viewers.id, user.linkedId));
        return viewer ? { ...viewer, role: 'viewer' } : undefined;
        
      case 'student':
        const [student] = await db.select().from(students).where(eq(students.id, user.linkedId));
        return student ? { ...student, role: 'student' } : undefined;
        
      case 'school_admin':
        const [schoolAdmin] = await db.select().from(schoolAdmins).where(eq(schoolAdmins.id, user.linkedId));
        return schoolAdmin ? { ...schoolAdmin, role: 'school_admin' } : undefined;
        
      case 'system_admin':
        const [systemAdmin] = await db.select().from(systemAdmins).where(eq(systemAdmins.id, user.linkedId));
        return systemAdmin ? { ...systemAdmin, role: 'system_admin' } : undefined;
        
      default:
        return undefined;
    }
  }

  // Update user profile by role
  async updateUserProfile(userId: string, role: string, profileData: Partial<UserProfile>): Promise<UserProfile | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user || user.role !== role) return undefined;
    
    switch (role) {
      case 'viewer':
        const [updatedViewer] = await db.update(viewers)
          .set(profileData)
          .where(eq(viewers.id, user.linkedId))
          .returning();
        return updatedViewer ? { ...updatedViewer, role: 'viewer' } : undefined;
        
      case 'student':
        const [updatedStudent] = await db.update(students)
          .set(profileData)
          .where(eq(students.id, user.linkedId))
          .returning();
        return updatedStudent ? { ...updatedStudent, role: 'student' } : undefined;
        
      case 'school_admin':
        const [updatedSchoolAdmin] = await db.update(schoolAdmins)
          .set(profileData)
          .where(eq(schoolAdmins.id, user.linkedId))
          .returning();
        return updatedSchoolAdmin ? { ...updatedSchoolAdmin, role: 'school_admin' } : undefined;
        
      case 'system_admin':
        const [updatedSystemAdmin] = await db.update(systemAdmins)
          .set(profileData)
          .where(eq(systemAdmins.id, user.linkedId))
          .returning();
        return updatedSystemAdmin ? { ...updatedSystemAdmin, role: 'system_admin' } : undefined;
        
      default:
        return undefined;
    }
  }

  // Change password (bcrypt)
  async changePassword(userId: string, newPassword: string): Promise<void> {
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await db.update(users)
      .set({ passwordHash })
      .where(eq(users.id, userId));
  }

  // Get user by email
  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  // Get user by ID (for password changes)
  async getUserById(userId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    return user;
  }

  // Verify current password for password change
  async verifyCurrentPassword(userId: string, currentPassword: string): Promise<boolean> {
    const user = await this.getUserById(userId);
    if (!user) return false;
    
    return await bcrypt.compare(currentPassword, user.passwordHash);
  }
}

export const authStorage = new AuthStorage();