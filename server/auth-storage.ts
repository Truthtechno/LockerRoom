// New centralized authentication storage for Supabase integration
import bcrypt from "bcrypt";
import { db } from './db';
import { eq, and } from 'drizzle-orm';
import { 
  users, 
  viewers, 
  students, 
  schoolAdmins, 
  systemAdmins,
  scoutProfiles,
  admins,
  schools,
  type User,
  type UserProfile,
  type InsertUser,
  type InsertViewer,
  type InsertStudent,
  type InsertSchoolAdmin,
  type InsertSystemAdmin,
  type AdminDB
} from "@shared/schema";

// Database connection is now handled by ./db.ts

export class AuthStorage {
  // Create user with role-specific profile (transactional)
  async createUserWithProfile(
    email: string, 
    password: string, 
    role: string, 
    profileData: any
  ): Promise<{ user: User; profile: UserProfile }> {
    console.log('Creating user with profile:', { email, role, profileData });
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
          console.log('Creating student profile with data:', {
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
          });
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
          console.log('Student created:', student);
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
      
      // Create user record with linked_id and schoolId
      const [user] = await db.insert(users).values({
        email,
        passwordHash,
        role,
        linkedId: profileId, // This maps to linked_id column
        name: profileData.name, // Store name in users table
        schoolId: profileData.schoolId || null, // Set schoolId for school admins and students
      } as InsertUser).returning();
      
      return { user, profile };
    } catch (error) {
      throw new Error(`Failed to create user with profile: ${error}`);
    }
  }

  // Verify password and return user + profile
  async verifyPassword(email: string, password: string): Promise<{ user: User; profile: UserProfile } | null> {
    const [user] = await db.select({
      id: users.id,
      email: users.email,
      passwordHash: users.passwordHash,
      role: users.role,
      linkedId: users.linkedId, // This maps to linked_id column
      name: users.name,
      schoolId: users.schoolId,
      emailVerified: users.emailVerified,
      isOneTimePassword: users.isOneTimePassword,
      isFrozen: users.isFrozen,
      createdAt: users.createdAt,
      // Get schoolId from school_admins table for school_admin role
      schoolIdFromProfile: schoolAdmins.schoolId
    })
    .from(users)
    .leftJoin(schoolAdmins, eq(users.linkedId, schoolAdmins.id)) // linkedId maps to linked_id column
    .where(eq(users.email, email));
    
    if (!user) {
      console.log('🔐 Password verification failed: User not found for email:', email);
      return null;
    }

    // Check if account is frozen - throw error instead of returning null
    // so it can be caught and handled properly by login endpoint
    if (user.isFrozen) {
      console.log('🔐 Login blocked: Account is frozen for user:', user.id, 'email:', email);
      throw new Error('ACCOUNT_DEACTIVATED');
    }
    
    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      console.log('🔐 Password verification failed: Invalid password for user:', user.id, 'email:', email);
      return null;
    }
    
    console.log('🔐 Password verification successful for user:', user.id, 'email:', email, 'role:', user.role);
    
    // Use schoolId from profile if user is school_admin, otherwise use users.schoolId
    const finalSchoolId = user.role === 'school_admin' ? user.schoolIdFromProfile : user.schoolId;
    
    // Check if school is disabled (for school_admin and student roles)
    if ((user.role === 'school_admin' || user.role === 'student') && finalSchoolId) {
      const [school] = await db.select({ isActive: schools.isActive, name: schools.name })
        .from(schools)
        .where(eq(schools.id, finalSchoolId));
      
      if (school && !school.isActive) {
        console.log(`🔐 Login blocked: School "${school.name}" (ID: ${finalSchoolId}) is disabled for user:`, user.id, 'email:', email);
        throw new Error('SCHOOL_DEACTIVATED'); // Special error code for disabled school
      }
    }
    
    const userWithSchoolId = {
      ...user,
      schoolId: finalSchoolId
    };
    
    // Get role-specific profile
    let profile = await this.getUserProfile(user.id);
    
    // Check if linkedId is valid - if not, try to fix it
    const rolesRequiringLinkedId = ['student', 'school_admin', 'system_admin', 'viewer', 'public_viewer'];
    if (rolesRequiringLinkedId.includes(user.role) && !profile) {
      console.log('🔐 Profile not found for user:', user.id, 'role:', user.role, 'linkedId:', user.linkedId);
      console.log('🔐 Attempting to fix broken linkedId reference...');
      
      // Try to fix the linkedId
      const fixed = await this.fixLinkedId(user.id);
      if (fixed) {
        console.log('🔐 Successfully fixed linkedId for user:', user.id);
        // Re-fetch user and profile after fix
        const [updatedUser] = await db.select().from(users).where(eq(users.id, user.id));
        if (updatedUser) {
          userWithSchoolId.schoolId = user.role === 'school_admin' ? user.schoolIdFromProfile : updatedUser.schoolId;
          userWithSchoolId.linkedId = updatedUser.linkedId;
          profile = await this.getUserProfile(user.id);
        }
      }
      
      // If still no profile after fix attempt, handle it
      if (!profile) {
        console.log('🔐 Failed to fix linkedId for user:', user.id, 'allowing login with minimal profile');
        
        // For students, we need schoolId - if missing, we can't proceed
        if (user.role === 'student' && !user.schoolId && !finalSchoolId) {
          console.log('🔐 Student login failed: missing schoolId and cannot create profile');
          return null;
        }
        
        // Create a minimal profile object for users without profiles
        const minimalProfile: UserProfile = {
          id: user.id,
          name: user.name || 'User',
          email: user.email,
          role: user.role,
          schoolId: finalSchoolId,
          profilePicUrl: null,
          bio: null,
          phone: null
        };
        
        // Get updated user with potentially fixed linkedId
        const [updatedUser] = await db.select().from(users).where(eq(users.id, user.id));
        if (updatedUser) {
          userWithSchoolId.linkedId = updatedUser.linkedId || user.linkedId;
        }
        
        return { user: userWithSchoolId, profile: minimalProfile };
      }
    }
    // Handle case where profile is still not found after fix attempt (for roles not requiring linkedId)
    if (!profile && !rolesRequiringLinkedId.includes(user.role)) {
      console.log('🔐 Profile not found for user:', user.id, 'role:', user.role, 'linkedId:', user.linkedId);
      console.log('🔐 Allowing login without profile - user will need to complete profile setup');
      
      // Create a minimal profile object for users without profiles
      const minimalProfile: UserProfile = {
        id: user.id,
        name: user.name || 'User',
        email: user.email,
        role: user.role,
        schoolId: finalSchoolId,
        profilePicUrl: null,
        bio: null,
        phone: null
      };
      
      return { user: userWithSchoolId, profile: minimalProfile };
    }
    
    console.log('🔐 Profile found for user:', user.id, 'profileId:', profile.id);
    return { user: userWithSchoolId, profile };
  }

  // Verify OTP and return user + profile (for first-time login)
  async verifyOTP(email: string, otp: string): Promise<{ user: User; profile: UserProfile; requiresPasswordReset: boolean } | null> {
    try {
      const [user] = await db.select({
        id: users.id,
        email: users.email,
        passwordHash: users.passwordHash,
        role: users.role,
        linkedId: users.linkedId, // This maps to linked_id column
        name: users.name,
        schoolId: users.schoolId,
        emailVerified: users.emailVerified,
        isOneTimePassword: users.isOneTimePassword,
        isFrozen: users.isFrozen,
        createdAt: users.createdAt,
        // Get schoolId from school_admins table for school_admin role
        schoolIdFromProfile: schoolAdmins.schoolId
      })
      .from(users)
      .leftJoin(schoolAdmins, eq(users.linkedId, schoolAdmins.id)) // linkedId maps to linked_id column
      .where(eq(users.email, email));
      
      if (!user) {
        console.log('🔐 OTP verification failed: User not found for email:', email);
        return null;
      }

      // Check if account is frozen - throw error instead of returning null
      // so it can be caught and handled properly by login endpoint
      if (user.isFrozen) {
        console.log('🔐 Login blocked: Account is frozen for user:', user.id, 'email:', email);
        throw new Error('ACCOUNT_DEACTIVATED');
      }
      
      // Verify the provided OTP/password against the stored hash
      const isValid = await bcrypt.compare(otp, user.passwordHash);
      if (!isValid) {
        console.log('🔐 OTP verification failed: Invalid OTP/password for user:', user.id);
        return null;
      }
      
      // Use schoolId from profile if user is school_admin, otherwise use users.schoolId
      const finalSchoolId = user.role === 'school_admin' ? user.schoolIdFromProfile : user.schoolId;
      
      const userWithSchoolId = {
        ...user,
        schoolId: finalSchoolId
      };
      
      // Get role-specific profile
      let profile = await this.getUserProfile(user.id);
      
      // Check if linkedId is valid - if not, try to fix it
      const rolesRequiringLinkedId = ['student', 'school_admin', 'system_admin', 'viewer', 'public_viewer'];
      if (rolesRequiringLinkedId.includes(user.role) && !profile) {
        console.log('🔐 OTP verification: Profile not found for user:', user.id, 'role:', user.role, 'linkedId:', user.linkedId);
        console.log('🔐 Attempting to fix broken linkedId reference...');
        
        // Try to fix the linkedId
        const fixed = await this.fixLinkedId(user.id);
        if (fixed) {
          console.log('🔐 Successfully fixed linkedId for user:', user.id);
          // Re-fetch user and profile after fix
          const [updatedUser] = await db.select().from(users).where(eq(users.id, user.id));
          if (updatedUser) {
            userWithSchoolId.schoolId = user.role === 'school_admin' ? user.schoolIdFromProfile : updatedUser.schoolId;
            userWithSchoolId.linkedId = updatedUser.linkedId;
            profile = await this.getUserProfile(user.id);
          }
        }
        
        // If still no profile after fix attempt, handle it
        if (!profile) {
          console.log('🔐 Failed to fix linkedId for user:', user.id, 'allowing OTP login with minimal profile');
          
          // For students, we need schoolId - if missing, we can't proceed
          if (user.role === 'student' && !user.schoolId && !finalSchoolId) {
            console.log('🔐 Student OTP login failed: missing schoolId and cannot create profile');
            return null;
          }
          
          // Create a minimal profile object for users without profiles
          const minimalProfile: UserProfile = {
            id: user.id,
            name: user.name || 'User',
            email: user.email,
            role: user.role,
            schoolId: finalSchoolId,
            profilePicUrl: null,
            bio: null,
            phone: null
          };
          
          // Get updated user with potentially fixed linkedId
          const [updatedUser] = await db.select().from(users).where(eq(users.id, user.id));
          if (updatedUser) {
            userWithSchoolId.linkedId = updatedUser.linkedId || user.linkedId;
          }
          
          return { user: userWithSchoolId, profile: minimalProfile, requiresPasswordReset: user.isOneTimePassword || false };
        }
      }
      // Handle case where profile is still not found after fix attempt (for roles not requiring linkedId)
      if (!profile && !rolesRequiringLinkedId.includes(user.role)) {
        console.log('🔐 OTP verification: Profile not found for user:', user.id, 'role:', user.role, 'linkedId:', user.linkedId);
        console.log('🔐 Allowing OTP login without profile - user will need to complete profile setup');
        
        // Create a minimal profile object for users without profiles
        const minimalProfile: UserProfile = {
          id: user.id,
          name: user.name || 'User',
          email: user.email,
          role: user.role,
          schoolId: finalSchoolId,
          profilePicUrl: null,
          bio: null,
          phone: null
        };
        
        return { user: userWithSchoolId, profile: minimalProfile, requiresPasswordReset: user.isOneTimePassword || false };
      }

      // For scout roles, allow login even without school association
      if ((user.role === 'scout_admin' || user.role === 'xen_scout') && !finalSchoolId) {
        console.log('🔐 Scout role login allowed without school association:', user.role);
      }
      
      console.log('🔐 OTP verification successful for user:', user.id, 'OTP flag:', user.isOneTimePassword, 'schoolId:', finalSchoolId);
      
      return { 
        user: userWithSchoolId, 
        profile, 
        requiresPasswordReset: user.isOneTimePassword || false 
      };
    } catch (error) {
      console.error('🔐 OTP verification error:', error);
      return null;
    }
  }

  // Fix broken linkedId references by creating or finding the correct profile
  async fixLinkedId(userId: string): Promise<boolean> {
    try {
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      if (!user) {
        console.log('🔐 Fix linkedId failed: User not found:', userId);
        return false;
      }

      console.log('🔐 Checking linkedId for user:', userId, 'role:', user.role, 'current linkedId:', user.linkedId);

      // Check if current linkedId is valid
      const currentProfile = await this.getUserProfile(userId);
      if (currentProfile) {
        console.log('🔐 LinkedId is already valid for user:', userId);
        return true;
      }

      console.log('🔐 LinkedId is broken for user:', userId, 'attempting to fix...');

      // Try to find or create the correct profile based on role
      let newLinkedId: string | null = null;

      switch (user.role) {
        case 'viewer':
        case 'public_viewer':
          // Try to find existing viewer profile by email or create new one
          const [existingViewer] = await db.select().from(viewers).where(eq(viewers.name, user.name || 'User'));
          if (existingViewer) {
            newLinkedId = existingViewer.id;
            console.log('🔐 Found existing viewer profile:', existingViewer.id);
          } else {
            // Create new viewer profile
            const [newViewer] = await db.insert(viewers).values({
              name: user.name || 'User',
              profilePicUrl: null,
              bio: null,
              phone: null
            }).returning();
            newLinkedId = newViewer.id;
            console.log('🔐 Created new viewer profile:', newViewer.id);
          }
          break;

        case 'student':
          // For students, we need schoolId - if missing, we can't create a valid profile
          if (!user.schoolId) {
            console.log('🔐 Cannot fix student linkedId: missing schoolId for user:', userId);
            return false;
          }
          
          // Try to find existing student profile
          const [existingStudent] = await db.select().from(students).where(
            and(eq(students.userId, userId), eq(students.schoolId, user.schoolId))
          );
          if (existingStudent) {
            newLinkedId = existingStudent.id;
            console.log('🔐 Found existing student profile:', existingStudent.id);
          } else {
            // Create new student profile
            const [newStudent] = await db.insert(students).values({
              userId: userId,
              schoolId: user.schoolId,
              name: user.name || 'Student',
              phone: null,
              gender: null,
              dateOfBirth: null,
              grade: null,
              guardianContact: null,
              profilePicUrl: null,
              roleNumber: null,
              position: null,
              sport: null,
              profilePic: null,
              bio: null,
              coverPhoto: null
            }).returning();
            newLinkedId = newStudent.id;
            console.log('🔐 Created new student profile:', newStudent.id);
          }
          break;

        case 'school_admin':
          // For school admins, we need schoolId - if missing, we can't create a valid profile
          if (!user.schoolId) {
            console.log('🔐 Cannot fix school_admin linkedId: missing schoolId for user:', userId);
            return false;
          }
          
          // Try to find existing school admin profile
          const [existingSchoolAdmin] = await db.select().from(schoolAdmins).where(
            and(eq(schoolAdmins.schoolId, user.schoolId), eq(schoolAdmins.name, user.name || 'Admin'))
          );
          if (existingSchoolAdmin) {
            newLinkedId = existingSchoolAdmin.id;
            console.log('🔐 Found existing school admin profile:', existingSchoolAdmin.id);
          } else {
            // Create new school admin profile
            const [newSchoolAdmin] = await db.insert(schoolAdmins).values({
              name: user.name || 'School Admin',
              schoolId: user.schoolId,
              profilePicUrl: null,
              bio: null,
              phone: null,
              position: null
            }).returning();
            newLinkedId = newSchoolAdmin.id;
            console.log('🔐 Created new school admin profile:', newSchoolAdmin.id);
          }
          break;

        case 'system_admin':
          // Try to find existing system admin profile
          const [existingSystemAdmin] = await db.select().from(systemAdmins).where(eq(systemAdmins.name, user.name || 'System Admin'));
          if (existingSystemAdmin) {
            newLinkedId = existingSystemAdmin.id;
            console.log('🔐 Found existing system admin profile:', existingSystemAdmin.id);
          } else {
            // Create new system admin profile
            const [newSystemAdmin] = await db.insert(systemAdmins).values({
              name: user.name || 'System Admin',
              profilePicUrl: null,
              bio: null,
              phone: null,
              permissions: []
            }).returning();
            newLinkedId = newSystemAdmin.id;
            console.log('🔐 Created new system admin profile:', newSystemAdmin.id);
          }
          break;

        case 'scout_admin':
        case 'xen_scout':
          // For scouts, try to find in admins table first
          const [existingAdmin] = await db.select().from(admins).where(eq(admins.email, user.email));
          if (existingAdmin) {
            newLinkedId = existingAdmin.id;
            console.log('🔐 Found existing admin record for scout:', existingAdmin.id);
          } else {
            console.log('🔐 Cannot fix scout linkedId: no admin record found for user:', userId);
            return false;
          }
          break;

        default:
          console.log('🔐 Cannot fix linkedId: unknown role:', user.role);
          return false;
      }

      if (newLinkedId) {
        // Update the user's linkedId
        await db.update(users)
          .set({ linkedId: newLinkedId })
          .where(eq(users.id, userId));
        
        console.log('🔐 Successfully fixed linkedId for user:', userId, 'new linkedId:', newLinkedId);
        return true;
      }

      return false;
    } catch (error) {
      console.error('🔐 Error fixing linkedId for user:', userId, 'Error:', error);
      return false;
    }
  }

  // Reset password for OTP users
  async resetPassword(userId: string, newPassword: string): Promise<boolean> {
    try {
      console.log('🔐 Starting password reset for user:', userId);
      
      // Hash the new password
      const passwordHash = await bcrypt.hash(newPassword, 12);
      console.log('🔐 Password hashed successfully for user:', userId);
      
      // Update user record
      const result = await db.update(users)
        .set({ 
          passwordHash,
          isOneTimePassword: false, // Clear OTP flag
          emailVerified: true // Optionally set email as verified
        })
        .where(eq(users.id, userId))
        .returning({ id: users.id, email: users.email });
      
      if (result.length === 0) {
        console.error('🔐 Password reset failed: User not found:', userId);
        return false;
      }
      
      console.log('🔐 Password reset successful for user:', userId, 'email:', result[0].email);
      
      // Fix linkedId if it's broken
      const linkedIdFixed = await this.fixLinkedId(userId);
      if (linkedIdFixed) {
        console.log('🔐 LinkedId fixed during password reset for user:', userId);
      } else {
        console.log('🔐 LinkedId fix failed during password reset for user:', userId, '- user may need manual profile setup');
      }
      
      return true;
    } catch (error) {
      console.error('🔐 Password reset error for user:', userId, 'Error:', error);
      return false;
    }
  }

  // Get user profile by role
  async getUserProfile(userId: string): Promise<UserProfile | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user) return undefined;
    
    switch (user.role) {
      case 'viewer':
      case 'public_viewer':
        const [viewer] = await db.select().from(viewers).where(eq(viewers.id, user.linkedId)); // linkedId maps to linked_id column
        return viewer ? { ...viewer, role: user.role, name: user.name, schoolId: user.schoolId } : undefined;
        
      case 'student':
        const [student] = await db.select().from(students).where(eq(students.id, user.linkedId)); // linkedId maps to linked_id column
        return student ? { ...student, role: 'student', name: user.name, schoolId: user.schoolId } : undefined;
        
      case 'school_admin':
        const [schoolAdmin] = await db.select().from(schoolAdmins).where(eq(schoolAdmins.id, user.linkedId)); // linkedId maps to linked_id column
        return schoolAdmin ? { ...schoolAdmin, role: 'school_admin', name: user.name, schoolId: user.schoolId } : undefined;
        
      case 'system_admin':
        const [systemAdmin] = await db.select().from(systemAdmins).where(eq(systemAdmins.id, user.linkedId)); // linkedId maps to linked_id column
        return systemAdmin ? { ...systemAdmin, role: 'system_admin', name: user.name, schoolId: user.schoolId } : undefined;
        
      case 'scout_admin':
      case 'xen_scout':
        // For scouts, try to find scout profile first, then fall back to admin record
        const [scoutProfile] = await db.select().from(scoutProfiles).where(eq(scoutProfiles.id, user.linkedId));
        if (scoutProfile) {
          return { ...scoutProfile, role: user.role, name: user.name, schoolId: user.schoolId };
        }
        
        // Fallback: look up in admins table by user email
        const [adminRecord] = await db.select().from(admins).where(eq(admins.email, user.email));
        if (adminRecord) {
          return { 
            id: adminRecord.id,
            name: adminRecord.name,
            email: adminRecord.email,
            role: user.role,
            profilePicUrl: adminRecord.profilePicUrl,
            xenId: adminRecord.xenId,
            schoolId: user.schoolId
          };
        }
        
        return undefined;
        
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

  // Get user by email with schoolId for school admins
  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select({
      id: users.id,
      email: users.email,
      passwordHash: users.passwordHash,
      role: users.role,
      linkedId: users.linkedId, // This maps to linked_id column
      name: users.name,
      schoolId: users.schoolId,
      emailVerified: users.emailVerified,
      isOneTimePassword: users.isOneTimePassword,
      createdAt: users.createdAt,
      // Get schoolId from school_admins table for school_admin role
      schoolIdFromProfile: schoolAdmins.schoolId
    })
    .from(users)
    .leftJoin(schoolAdmins, eq(users.linkedId, schoolAdmins.id)) // linkedId maps to linked_id column
    .where(eq(users.email, email));
    
    if (!user) return undefined;
    
    // Use schoolId from profile if user is school_admin, otherwise use users.schoolId
    const finalSchoolId = user.role === 'school_admin' ? user.schoolIdFromProfile : user.schoolId;
    
    return {
      ...user,
      schoolId: finalSchoolId
    };
  }

  // Get user by ID (for password changes) with schoolId for school admins
  async getUserById(userId: string): Promise<User | undefined> {
    const [user] = await db.select({
      id: users.id,
      email: users.email,
      passwordHash: users.passwordHash,
      role: users.role,
      linkedId: users.linkedId, // This maps to linked_id column
      name: users.name,
      schoolId: users.schoolId,
      emailVerified: users.emailVerified,
      isOneTimePassword: users.isOneTimePassword,
      createdAt: users.createdAt,
      // Get schoolId from school_admins table for school_admin role
      schoolIdFromProfile: schoolAdmins.schoolId
    })
    .from(users)
    .leftJoin(schoolAdmins, eq(users.linkedId, schoolAdmins.id)) // linkedId maps to linked_id column
    .where(eq(users.id, userId));
    
    if (!user) return undefined;
    
    // Use schoolId from profile if user is school_admin, otherwise use users.schoolId
    const finalSchoolId = user.role === 'school_admin' ? user.schoolIdFromProfile : user.schoolId;
    
    return {
      ...user,
      schoolId: finalSchoolId
    };
  }

  // Verify current password for password change
  async verifyCurrentPassword(userId: string, currentPassword: string): Promise<boolean> {
    const user = await this.getUserById(userId);
    if (!user) return false;
    
    return await bcrypt.compare(currentPassword, user.passwordHash);
  }

  // ===== ADMIN AUTHENTICATION METHODS =====
  
  // Get admin by email
  async getAdminByEmail(email: string): Promise<AdminDB | undefined> {
    const [admin] = await db.select().from(admins).where(eq(admins.email, email));
    return admin;
  }

  // Verify admin OTP (for scout roles)
  async verifyAdminOTP(email: string, otp: string): Promise<{ admin: AdminDB; requiresPasswordReset: boolean } | null> {
    try {
      const admin = await this.getAdminByEmail(email);
      if (!admin) {
        console.log('🔐 Admin OTP verification failed: Admin not found for email:', email);
        return null;
      }

      // Check if the linked user account is frozen
      const [linkedUser] = await db.select({ isFrozen: users.isFrozen })
        .from(users)
        .where(eq(users.linkedId, admin.id))
        .limit(1);
      
      // Also check if user exists with same email (for admin accounts created directly in users table)
      const [userByEmail] = await db.select({ isFrozen: users.isFrozen })
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      const isFrozen = linkedUser?.isFrozen || userByEmail?.isFrozen || false;
      
      if (isFrozen) {
        console.log('🔐 Admin OTP login blocked: Account is frozen for admin:', admin.id, 'email:', email);
        throw new Error('ACCOUNT_DEACTIVATED');
      }

      // For scout roles, check if OTP matches
      if ((admin.role === 'scout_admin' || admin.role === 'xen_scout') && admin.otp) {
        if (admin.otp === otp) {
          console.log('🔐 Admin OTP verification successful for:', admin.id);
          
          // Clear OTP after successful verification
          await db.update(admins)
            .set({ otp: null })
            .where(eq(admins.id, admin.id));
          
          return { admin, requiresPasswordReset: true };
        } else {
          console.log('🔐 Admin OTP verification failed: Invalid OTP for admin:', admin.id);
          return null;
        }
      }

      // For non-scout roles, allow OTP as temporary password
      if (admin.otp && admin.otp === otp) {
        console.log('🔐 Admin OTP verification successful for non-scout role:', admin.id);
        
        // Clear OTP after successful verification
        await db.update(admins)
          .set({ otp: null })
          .where(eq(admins.id, admin.id));
        
        return { admin, requiresPasswordReset: true };
      }

      console.log('🔐 Admin OTP verification failed: No valid OTP for admin:', admin.id);
      return null;
    } catch (error) {
      // Re-throw ACCOUNT_DEACTIVATED error to be handled by login endpoint
      if (error instanceof Error && error.message === 'ACCOUNT_DEACTIVATED') {
        throw error;
      }
      console.error('🔐 Admin OTP verification error:', error);
      return null;
    }
  }

  // Verify admin password (for system_admin and other roles with passwords)
  async verifyAdminPassword(email: string, password: string): Promise<AdminDB | null> {
    try {
      const admin = await this.getAdminByEmail(email);
      if (!admin) {
        console.log('🔐 Admin password verification failed: Admin not found for email:', email);
        return null;
      }

      // Check if the linked user account is frozen
      const [linkedUser] = await db.select({ isFrozen: users.isFrozen })
        .from(users)
        .where(eq(users.linkedId, admin.id))
        .limit(1);
      
      // Also check if user exists with same email (for admin accounts created directly in users table)
      const [userByEmail] = await db.select({ isFrozen: users.isFrozen })
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      const isFrozen = linkedUser?.isFrozen || userByEmail?.isFrozen || false;
      
      if (isFrozen) {
        console.log('🔐 Admin password login blocked: Account is frozen for admin:', admin.id, 'email:', email);
        throw new Error('ACCOUNT_DEACTIVATED');
      }

      // Check if there's a corresponding user record with password
      const [user] = await db.select().from(users).where(eq(users.email, email));
      if (user && user.passwordHash) {
        // Double-check frozen status on the actual user record being used
        if (user.isFrozen) {
          console.log('🔐 Admin password login blocked: User account is frozen (second check) for admin:', admin.id, 'email:', email);
          throw new Error('ACCOUNT_DEACTIVATED');
        }
        
        const isValid = await bcrypt.compare(password, user.passwordHash);
        if (isValid) {
          console.log('🔐 Admin password verification successful for:', admin.id);
          return admin;
        }
      }
      
      // Fallback: check if password matches a stored OTP
      if (admin.otp && admin.otp === password) {
        console.log('🔐 Admin OTP verification successful for:', admin.id);
        
        // Clear OTP after successful verification
        await db.update(admins)
          .set({ otp: null })
          .where(eq(admins.id, admin.id));
        
        return admin;
      }

      console.log('🔐 Admin password verification failed: Invalid password for admin:', admin.id);
      return null;
    } catch (error) {
      // Re-throw ACCOUNT_DEACTIVATED error to be handled by login endpoint
      if (error instanceof Error && error.message === 'ACCOUNT_DEACTIVATED') {
        throw error;
      }
      console.error('🔐 Admin password verification error:', error);
      return null;
    }
  }

  // Reset admin password (create user record if needed)
  async resetAdminPassword(adminId: string, newPassword: string): Promise<boolean> {
    try {
      console.log('🔐 Starting admin password reset for admin:', adminId);
      
      // Hash the new password
      const passwordHash = await bcrypt.hash(newPassword, 12);
      console.log('🔐 Password hashed successfully for admin:', adminId);
      
      // Get admin details
      const [admin] = await db.select().from(admins).where(eq(admins.id, adminId));
      if (!admin) {
        console.error('🔐 Admin password reset failed: Admin not found:', adminId);
        return false;
      }
      
      // Check if user record exists
      const [existingUser] = await db.select().from(users).where(eq(users.email, admin.email));
      
      if (existingUser) {
        // Update existing user record
        await db.update(users)
          .set({ 
            passwordHash,
            isOneTimePassword: false,
            emailVerified: true
          })
          .where(eq(users.id, existingUser.id));
      } else {
        // Create new user record for admin
        await db.insert(users).values({
          email: admin.email,
          passwordHash,
          role: admin.role,
          linkedId: admin.id, // Link to admin record
          name: admin.name,
          schoolId: null,
          emailVerified: true,
          isOneTimePassword: false,
        });
      }
      
      console.log('🔐 Admin password reset successful for admin:', adminId, 'email:', admin.email);
      return true;
    } catch (error) {
      console.error('🔐 Admin password reset error for admin:', adminId, 'Error:', error);
      return false;
    }
  }
}

export const authStorage = new AuthStorage();