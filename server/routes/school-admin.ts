import { Express } from 'express';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { users, students, schoolAdmins, schools, posts, studentFollowers } from '@shared/schema';
import { eq, sql } from 'drizzle-orm';
import { requireAuth, requireRole } from '../middleware/auth';
import { db } from '../db';
import { storage } from '../storage';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';

// Configure multer for file uploads
const upload = multer({ storage: multer.memoryStorage() });

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export function registerSchoolAdminRoutes(app: Express) {
  // Get Enrollment Status
  app.get('/api/school-admin/enrollment-status',
    requireAuth,
    requireRole('school_admin'),
    async (req, res) => {
      try {
        const caller = (req as any).auth;
        const schoolId = caller.schoolId;
  
        if (!schoolId) {
          return res.status(400).json({ 
            error: { 
              code: 'missing_school_id', 
              message: 'You are not linked to a school.' 
            } 
          });
        }

        // Get school
        const [school] = await db.select().from(schools).where(eq(schools.id, schoolId));
        if (!school) {
          return res.status(404).json({ 
            error: { 
              code: 'school_not_found', 
              message: 'School not found' 
            } 
          });
        }

        // Get current student count
        const studentCountResult = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(students)
          .where(eq(students.schoolId, schoolId));
        
        const currentCount = studentCountResult[0]?.count || 0;
        const maxStudents = school.maxStudents || 10;
        const availableSlots = maxStudents - currentCount;
        const utilizationPercentage = maxStudents > 0 ? (currentCount / maxStudents) * 100 : 0;
        
        // Determine warning level
        let warningLevel: 'none' | 'approaching' | 'at_limit' = 'none';
        if (utilizationPercentage >= 100) {
          warningLevel = 'at_limit';
        } else if (utilizationPercentage >= 80) {
          warningLevel = 'approaching';
        }

        res.json({
          success: true,
          enrollmentStatus: {
            currentCount,
            maxStudents,
            availableSlots,
            utilizationPercentage: Math.round(utilizationPercentage * 100) / 100,
            warningLevel,
            canEnroll: currentCount < maxStudents,
          }
        });
      } catch (error) {
        console.error('❌ Error fetching enrollment status:', error);
        res.status(500).json({ 
          error: { 
            code: 'server_error', 
            message: 'Failed to fetch enrollment status' 
          } 
        });
      }
    }
  );

  // Create School Announcement
  app.post('/api/schools/:schoolId/announcements',
    requireAuth,
    requireRole('school_admin'),
    async (req, res) => {
      try {
        const { schoolId } = req.params;
        const { title, content, media } = req.body;
        const adminId = (req as any).auth.id;
        const adminSchoolId = (req as any).auth.schoolId;
        
        // Validate admin belongs to this school
        if (adminSchoolId !== schoolId) {
          return res.status(403).json({ 
            error: { 
              code: 'unauthorized', 
              message: 'You can only create announcements for your own school' 
            } 
          });
        }
        
        // Validation
        if (!title || !content) {
          return res.status(400).json({ 
            error: { 
              code: 'validation_error', 
              message: 'Title and content are required' 
            } 
          });
        }

        // Validate school exists
        const [school] = await db.select().from(schools).where(eq(schools.id, schoolId));
        if (!school) {
          return res.status(404).json({ 
            error: { 
              code: 'school_not_found', 
              message: 'School not found' 
            } 
          });
        }

        // Create announcement post
        const announcementData = {
          studentId: null, // Announcements don't have a student
          mediaUrl: media?.url || null,
          mediaType: media?.type || null,
          caption: content,
          title: title,
          type: 'announcement',
          broadcast: true,
          scope: 'school',
          schoolId: schoolId,
          createdByAdminId: adminId,
          status: 'ready'
        };

        const [announcement] = await db.insert(posts).values(announcementData).returning();

        console.log(`📢 School announcement created: ${title} for school ${school.name} (ID: ${announcement.id})`);

        res.json({
          success: true,
          announcement: {
            id: announcement.id,
            title: announcement.title,
            content: announcement.caption,
            media: media ? {
              type: media.type,
              url: media.url,
              publicId: media.publicId
            } : null,
            scope: announcement.scope,
            schoolId: announcement.schoolId,
            createdAt: announcement.createdAt
          }
        });
      } catch (error) {
        console.error('❌ Error creating school announcement:', error);
        res.status(500).json({ 
          error: { 
            code: 'server_error', 
            message: 'Failed to create announcement' 
          } 
        });
      }
    }
  );
  app.post('/api/school-admin/add-student',
    requireAuth,
    requireRole('school_admin'),
    upload.single('profilePic'),
    async (req, res) => {
      try {
        const caller = (req as any).auth;
        const schoolId = caller.schoolId; // from JWT when the admin logs in
  
        // Check if schoolId is present in JWT
        if (!schoolId) {
          console.error("❌ School ID missing from JWT token for school admin:", caller);
          return res.status(400).json({ 
            error: { 
              code: 'missing_school_id', 
              message: 'You are not linked to a school. Please log out and log back in with a valid school admin account.' 
            } 
          });
        }

        // Validate that the school exists
        const [school] = await db.select().from(schools).where(eq(schools.id, schoolId));
        if (!school) {
          console.error("❌ School not found for schoolId:", schoolId);
          return res.status(400).json({ 
            error: { 
              code: 'school_not_found', 
              message: 'The school you are linked to no longer exists. Please contact system admin.' 
            } 
          });
        }

        // Additional validation: Ensure any schoolId in request body matches admin's schoolId
        if (req.body.schoolId && req.body.schoolId !== schoolId) {
          console.error("❌ School ID mismatch: Admin schoolId:", schoolId, "Request schoolId:", req.body.schoolId);
          return res.status(403).json({ 
            error: { 
              code: 'school_id_mismatch', 
              message: 'You can only create students for your own school.' 
            } 
          });
        }

        console.log('✅ School validation passed:', school.name, 'ID:', schoolId);
  
        // Check enrollment limit
        const studentCountResult = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(students)
          .where(eq(students.schoolId, schoolId));
        
        const currentStudentCount = studentCountResult[0]?.count || 0;
        const maxStudents = school.maxStudents || 10;
        
        if (currentStudentCount >= maxStudents) {
          return res.status(403).json({ 
            error: { 
              code: 'enrollment_limit_reached', 
              message: `Student enrollment limit reached (${currentStudentCount}/${maxStudents}). Please contact system admin to increase capacity.` 
            } 
          });
        }
  
        const { name, email, phone, sport, position, bio, grade, gender, dateOfBirth, guardianContact, roleNumber } = req.body;
        
        // Enhanced validation - only require name, email, and schoolId
        if (!email || !name) {
          return res.status(400).json({ 
            error: { 
              code: 'validation_error', 
              message: 'Name and email are required' 
            } 
          });
        }
  
        // Check for existing email
        const existing = await db.select().from(users).where(eq(users.email, email));
        if (existing.length) {
          return res.status(409).json({ 
            error: { 
              code: 'email_taken', 
              message: 'Email already registered' 
            } 
          });
        }
  
        // Generate secure OTP (8-10 alphanumeric characters)
        const generateSecureOTP = () => {
          const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
          let result = '';
          for (let i = 0; i < 10; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
          }
          return result;
        };
        
        const otp = generateSecureOTP();
        const hash = await bcrypt.hash(otp, 12); // Increased salt rounds for security
  
        // Check if student with this email already exists
        const existingUser = await db.select().from(users).where(eq(users.email, email));
        if (existingUser.length > 0) {
          return res.status(409).json({
            error: {
              code: 'student_already_exists',
              message: 'Email already exists'
            }
          });
        }

        // Handle profile picture upload to Cloudinary
        let profilePicUrl = null;
        if (req.file) {
          try {
            const result = await new Promise((resolve, reject) => {
              cloudinary.uploader.upload_stream(
                { 
                  resource_type: "image",
                  folder: "student-profiles",
                  transformation: [
                    { width: 400, height: 400, crop: "fill", gravity: "face" }
                  ]
                },
                (error, result) => {
                  if (error) reject(error);
                  else resolve(result);
                }
              ).end(req.file!.buffer);
            });

            profilePicUrl = (result as any).secure_url;
            console.log('✅ Profile picture uploaded:', profilePicUrl);
          } catch (uploadError) {
            console.error('❌ Profile picture upload error:', uploadError);
            return res.status(500).json({
              error: {
                code: 'upload_error',
                message: 'Failed to upload profile picture'
              }
            });
          }
        }

        // Step 1: Create user with temporary linkedId (using temp UUID to satisfy NOT NULL constraint)
        console.log('📝 Step 1: Creating user for student:', email, 'with schoolId:', schoolId);
        const tempStudentId = crypto.randomUUID();
        
        const [userRow] = await db.insert(users).values({
          email,
          name, // Include student name in users table
          schoolId, // Include school ID in users table
          role: 'student',
          passwordHash: hash,
          linkedId: tempStudentId, // Temporary ID, will be updated in step 3
          emailVerified: false,
          isOneTimePassword: true // Flag to force password reset on first login
        }).returning();
        
        console.log('✅ Step 1 completed: User created with ID:', userRow.id, 'and schoolId:', userRow.schoolId);

        // Step 2: Create student profile linked to the user
        console.log('📝 Step 2: Creating student profile for user:', userRow.id);
        const [studentRow] = await db.insert(students).values({
          userId: userRow.id, // Link to user
          schoolId, // CRITICAL: Include schoolId in students table
          name,
          phone: phone || null,
          sport: sport || null,
          position: position || null,
          bio: bio || null,
          grade: grade || null,
          gender: gender || null,
          dateOfBirth: dateOfBirth || null,
          guardianContact: guardianContact || null,
          roleNumber: roleNumber || null,
          profilePicUrl: profilePicUrl // Set the uploaded profile picture
        }).returning();
        
        console.log('✅ Step 2 completed: Student created with ID:', studentRow.id, 'and schoolId:', schoolId);

        // Step 3: Update user's linkedId to point to the student profile
        console.log('📝 Step 3: Updating user linkedId to point to student:', studentRow.id);
        await db.update(users)
          .set({ linkedId: studentRow.id })
          .where(eq(users.id, userRow.id));
          
        console.log('✅ Step 3 completed: User linkedId updated successfully');
  
        // Log school assignment event for transparency and debugging
        try {
          await db.execute(sql`
            INSERT INTO analytics_logs (event_type, entity_type, entity_id, metadata, timestamp)
            VALUES (
              'student_school_assignment',
              'student',
              ${studentRow.id},
              ${JSON.stringify({
                studentId: studentRow.id,
                userId: userRow.id,
                schoolId: schoolId,
                schoolName: school.name,
                studentName: name,
                email: email,
                assignedBy: (req as any).auth.id,
                assignedByRole: 'school_admin'
              })},
              NOW()
            )
          `);
          console.log('📊 School assignment event logged successfully');
        } catch (logError) {
          console.error('⚠️ Failed to log school assignment event:', logError);
          // Don't fail the student creation if logging fails
        }
  
        // Auto-follow this student by the school admin who created them
        try {
          const schoolAdminUserId = (req as any).auth.id;
          
          // Check if already following to avoid duplicates
          const existingFollow = await db.select()
            .from(studentFollowers)
            .where(
              sql`${studentFollowers.followerUserId} = ${schoolAdminUserId} AND ${studentFollowers.studentId} = ${studentRow.id}`
            )
            .limit(1);
          
          if (existingFollow.length === 0) {
            await storage.followStudent({
              followerUserId: schoolAdminUserId,
              studentId: studentRow.id,
            });
            console.log(`✅ School admin auto-followed new student: ${name}`);
          }
        } catch (autoFollowError) {
          console.error('⚠️ Error during auto-follow process (non-critical):', autoFollowError);
          // Don't fail student creation if auto-follow fails
        }

        // Log OTP generation (no email/SMS sent for now)
        console.log(`🎓 Student created: ${name} (${email}) with OTP: ${otp}`);
        console.log(`📝 OTP will be displayed in admin UI for secure sharing`);
        console.log(`🔗 User ${userRow.id} linked to student ${studentRow.id}`);
        console.log('🎉 Student creation completed successfully!', {
          studentId: studentRow.id,
          userId: userRow.id,
          schoolId: schoolId,
          schoolName: school.name,
          studentName: name,
          email: email
        });
  
        // Return success response with OTP
        return res.json({
          success: true,
          message: 'Student added successfully',
          student: {
            id: studentRow.id,
            userId: userRow.id,
            email,
            name,
            phone: phone || null,
            schoolId,
            profilePicUrl: profilePicUrl // Include the uploaded profile picture URL
          },
          oneTimePassword: otp // Return plain OTP for admin display
        });
        
      } catch (error) {
        console.error('Add student error:', error);
        return res.status(500).json({
          error: {
            code: 'server_error',
            message: 'Failed to add student. Please try again.'
          }
        });
      }
    }
  );

  // Get school admin profile
  app.get('/api/school-admin/profile',
    requireAuth,
    requireRole('school_admin'),
    async (req, res) => {
      try {
        const userId = (req as any).auth.id;
        
        // Get user info
        const userInfo = await db.select().from(users).where(eq(users.id, userId)).limit(1);
        if (!userInfo.length) {
          return res.status(404).json({ 
            error: { 
              code: 'user_not_found', 
              message: 'User not found' 
            } 
          });
        }

        // Get school admin info
        const adminInfo = await db.select().from(schoolAdmins).where(eq(schoolAdmins.id, userInfo[0].linkedId)).limit(1);
        
        res.json({
          id: userInfo[0].id,
          name: userInfo[0].name,
          email: userInfo[0].email,
          profilePicUrl: userInfo[0].profilePicUrl,
          schoolId: userInfo[0].schoolId,
          position: adminInfo.length ? adminInfo[0].position : null,
          createdAt: userInfo[0].createdAt
        });
      } catch (error) {
        console.error('❌ Error fetching school admin profile:', error);
        res.status(500).json({ 
          error: { 
            code: 'server_error', 
            message: 'Failed to fetch profile' 
          } 
        });
      }
    }
  );

  // Update school admin profile
  app.put('/api/school-admin/profile',
    requireAuth,
    requireRole('school_admin'),
    async (req, res) => {
      try {
        const userId = (req as any).auth.id;
        const linkedId = (req as any).auth.linkedId;
        const { name, profilePicUrl } = req.body;

        // Update the school admin profile
        const adminUpdates: any = {};
        if (name !== undefined) adminUpdates.name = name;
        if (profilePicUrl !== undefined) adminUpdates.profilePicUrl = profilePicUrl;

        const [updatedAdmin] = await db.update(schoolAdmins)
          .set(adminUpdates)
          .where(eq(schoolAdmins.id, linkedId))
          .returning();

        // Also update the users table name if provided
        if (name !== undefined) {
          await db.update(users)
            .set({ name })
            .where(eq(users.id, userId));
        }

        res.json({
          id: userId,
          name: updatedAdmin.name,
          email: (req as any).auth.email,
          profilePicUrl: updatedAdmin.profilePicUrl,
          schoolId: updatedAdmin.schoolId
        });
      } catch (error) {
        console.error('❌ Error updating school admin profile:', error);
        res.status(500).json({ 
          error: { 
            code: 'server_error', 
            message: 'Failed to update profile' 
          } 
        });
      }
    }
  );

  // Change school admin password
  app.put('/api/school-admin/change-password',
    requireAuth,
    requireRole('school_admin'),
    async (req, res) => {
      try {
        const userId = (req as any).auth.id;
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
          return res.status(400).json({ 
            error: { 
              code: 'validation_error', 
              message: 'Current password and new password are required' 
            } 
          });
        }

        if (newPassword.length < 8) {
          return res.status(400).json({ 
            error: { 
              code: 'validation_error', 
              message: 'New password must be at least 8 characters long' 
            } 
          });
        }

        // Get current user
        const userInfo = await db.select().from(users).where(eq(users.id, userId)).limit(1);
        if (!userInfo.length) {
          return res.status(404).json({ 
            error: { 
              code: 'user_not_found', 
              message: 'User not found' 
            } 
          });
        }

        // Verify current password
        const isCurrentPasswordValid = await bcrypt.compare(currentPassword, userInfo[0].passwordHash);
        if (!isCurrentPasswordValid) {
          return res.status(400).json({ 
            error: { 
              code: 'invalid_password', 
              message: 'Current password is incorrect' 
            } 
          });
        }

        // Hash new password
        const newPasswordHash = await bcrypt.hash(newPassword, 12);

        // Update password
        await db.update(users)
          .set({ passwordHash: newPasswordHash })
          .where(eq(users.id, userId));

        res.json({
          success: true,
          message: 'Password changed successfully'
        });
      } catch (error) {
        console.error('❌ Error changing school admin password:', error);
        res.status(500).json({ 
          error: { 
            code: 'server_error', 
            message: 'Failed to change password' 
          } 
        });
      }
    }
  );
}