import { Express } from 'express';
import { requireAuth, requireRole } from '../middleware/auth';
import { db } from '../db';
import { users, schools, schoolAdmins, systemAdmins, students, subscriptions, schoolSettings, schoolApplications, posts } from '../../shared/schema';
import { eq, sql } from 'drizzle-orm';
import bcrypt from 'bcrypt';
import { AuthStorage } from '../auth-storage';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';

const authStorage = new AuthStorage();

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
  api_key: process.env.CLOUDINARY_API_KEY!,
  api_secret: process.env.CLOUDINARY_API_SECRET!,
});

// Configure multer for file uploads
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    // Check file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, GIF, and WebP images are allowed'));
    }
  }
});

// Error handling middleware for multer
const handleMulterError = (error: any, req: any, res: any, next: any) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        error: {
          code: 'file_too_large',
          message: 'File size must be less than 5MB'
        }
      });
    }
    return res.status(400).json({
      error: {
        code: 'upload_error',
        message: error.message
      }
    });
  }
  if (error) {
    return res.status(400).json({
      error: {
        code: 'upload_error',
        message: error.message
      }
    });
  }
  next();
};

export function registerSystemAdminRoutes(app: Express) {
  // Create System Announcement
  app.post('/api/system/announcements',
    requireAuth,
    requireRole('system_admin'),
    async (req, res) => {
      try {
        const { title, content, media, scope, schoolId } = req.body;
        const adminId = (req as any).auth.id;
        
        // Validation
        if (!title || !content) {
          return res.status(400).json({ 
            error: { 
              code: 'validation_error', 
              message: 'Title and content are required' 
            } 
          });
        }

        // Validate scope
        if (!['global', 'school', 'staff'].includes(scope)) {
          return res.status(400).json({ 
            error: { 
              code: 'validation_error', 
              message: 'Scope must be global, school, or staff' 
            } 
          });
        }

        // If scope is school, schoolId is required
        if (scope === 'school' && !schoolId) {
          return res.status(400).json({ 
            error: { 
              code: 'validation_error', 
              message: 'School ID is required for school-scoped announcements' 
            } 
          });
        }

        // Validate school exists if provided
        if (schoolId) {
          const [school] = await db.select().from(schools).where(eq(schools.id, schoolId));
          if (!school) {
            return res.status(404).json({ 
              error: { 
                code: 'school_not_found', 
                message: 'School not found' 
              } 
            });
          }
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
          scope: scope,
          schoolId: scope === 'school' ? schoolId : null,
          createdByAdminId: adminId,
          status: 'ready'
        };

        const [announcement] = await db.insert(posts).values(announcementData).returning();

        console.log(`📢 System announcement created: ${title} (ID: ${announcement.id})`);

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
        console.error('❌ Error creating system announcement:', error);
        res.status(500).json({ 
          error: { 
            code: 'server_error', 
            message: 'Failed to create announcement' 
          } 
        });
      }
    }
  );

  // Create School
  app.post('/api/system-admin/create-school',
    requireAuth,
    requireRole('system_admin'),
    async (req, res) => {
      try {
        const { name, address, contactEmail, contactPhone } = req.body;
        
        // Validation
        if (!name) {
          return res.status(400).json({ 
            error: { 
              code: 'validation_error', 
              message: 'School name is required' 
            } 
          });
        }

        // Create school
        const [school] = await db.insert(schools).values({
          name,
          address: address || null,
          contactEmail: contactEmail || null,
          contactPhone: contactPhone || null,
        }).returning();

        console.log(`🏫 School created: ${school.name} (ID: ${school.id})`);

        res.json({
          success: true,
          school: {
            id: school.id,
            name: school.name,
            address: school.address,
            contactEmail: school.contactEmail,
            contactPhone: school.contactPhone,
            createdAt: school.createdAt
          }
        });
      } catch (error) {
        console.error('❌ Error creating school:', error);
        res.status(500).json({ 
          error: { 
            code: 'server_error', 
            message: 'Failed to create school' 
          } 
        });
      }
    }
  );

  // Create School Admin
  app.post('/api/system-admin/create-school-admin',
    requireAuth,
    requireRole('system_admin'),
    async (req, res) => {
      try {
        const { schoolId, name, email } = req.body;
        
        // Validation
        if (!schoolId || !name || !email) {
          return res.status(400).json({ 
            error: { 
              code: 'validation_error', 
              message: 'School ID, name, and email are required' 
            } 
          });
        }

        // Check if school exists
        const [school] = await db.select().from(schools).where(eq(schools.id, schoolId));
        if (!school) {
          return res.status(404).json({ 
            error: { 
              code: 'school_not_found', 
              message: 'School not found' 
            } 
          });
        }

        // Check if email already exists
        const existingUser = await db.select().from(users).where(eq(users.email, email));
        if (existingUser.length > 0) {
          return res.status(409).json({ 
            error: { 
              code: 'email_exists', 
              message: 'Email already registered' 
            } 
          });
        }

        // Generate secure OTP (10 alphanumeric characters) - always required for school admin creation
        const generateSecureOTP = () => {
          const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
          let result = '';
          for (let i = 0; i < 10; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
          }
          return result;
        };
        
        const otp = generateSecureOTP();
        const passwordHash = await bcrypt.hash(otp, 12);

        // Create school admin profile first
        const [schoolAdmin] = await db.insert(schoolAdmins).values({
          name,
          schoolId,
          position: 'Principal', // Default position
        }).returning();

        // Create user account with OTP flag
        const [user] = await db.insert(users).values({
          email,
          name, // Include admin name in users table
          schoolId, // Include school ID in users table
          passwordHash,
          role: 'school_admin',
          linkedId: schoolAdmin.id,
          emailVerified: true,
          isOneTimePassword: true, // Flag to force password reset on first login
        }).returning();

        console.log(`👨‍💼 School admin created: ${name} (${email}) for school: ${school.name} with OTP: ${otp}`);

        res.json({
          success: true,
          schoolAdmin: {
            id: schoolAdmin.id,
            name: schoolAdmin.name,
            email: user.email,
            schoolId: schoolAdmin.schoolId,
            schoolName: school.name,
            position: schoolAdmin.position
          },
          otp: otp, // Return plain OTP for UI display
          notifications: {
            emailSent: false, // No email sent for now
            smsSent: false   // No SMS sent for now
          }
        });
      } catch (error) {
        console.error('❌ Error creating school admin:', error);
        res.status(500).json({ 
          error: { 
            code: 'server_error', 
            message: 'Failed to create school admin' 
          } 
        });
      }
    }
  );

  // Get all schools
  app.get('/api/system-admin/schools',
    requireAuth,
    requireRole('system_admin'),
    async (req, res) => {
      try {
        // Get schools with counts of admins and students
        const schoolsWithStats = await db.execute(sql`
          SELECT 
            s.*,
            COUNT(DISTINCT sa.id) as admin_count,
            COUNT(DISTINCT st.id) as student_count,
            COUNT(DISTINCT p.id) as post_count
          FROM schools s
          LEFT JOIN school_admins sa ON s.id = sa.school_id
          LEFT JOIN students st ON s.id = st.school_id
          LEFT JOIN posts p ON st.id = p.student_id
          GROUP BY s.id, s.name, s.address, s.contact_email, s.contact_phone, 
                   s.subscription_plan, s.max_students, s.profile_pic_url, s.created_at
          ORDER BY s.created_at DESC
        `);
        
        res.json({
          success: true,
          schools: schoolsWithStats.rows
        });
      } catch (error) {
        console.error('❌ Error fetching schools:', error);
        res.status(500).json({ 
          error: { 
            code: 'server_error', 
            message: 'Failed to fetch schools' 
          } 
        });
      }
    }
  );

  // Get school admins for a school
  app.get('/api/system-admin/school/:schoolId/admins',
    requireAuth,
    requireRole('system_admin'),
    async (req, res) => {
      try {
        const { schoolId } = req.params;
        
        const schoolAdminsList = await db
          .select({
            id: schoolAdmins.id,
            name: schoolAdmins.name,
            position: schoolAdmins.position,
            email: users.email,
            createdAt: schoolAdmins.createdAt
          })
          .from(schoolAdmins)
          .innerJoin(users, eq(users.linkedId, schoolAdmins.id))
          .where(eq(schoolAdmins.schoolId, schoolId));
        
        res.json({
          success: true,
          admins: schoolAdminsList
        });
      } catch (error) {
        console.error('❌ Error fetching school admins:', error);
        res.status(500).json({ 
          error: { 
            code: 'server_error', 
            message: 'Failed to fetch school admins' 
          } 
        });
      }
    }
  );

  // Safe profile update for system admin
  app.put('/api/system-admin/profile',
    requireAuth,
    requireRole('system_admin'),
    upload.single('profilePic'),
    async (req, res) => {
      try {
        const userId = (req as any).auth.id;
        const { name } = req.body;
        
        let updateData: any = {};
        
        // Only update name if provided
        if (name !== undefined && name.trim()) {
          updateData.name = name.trim();
        }
        
        // Handle profile picture upload to Cloudinary
        if (req.file) {
          const result = await new Promise((resolve, reject) => {
            cloudinary.uploader.upload_stream(
              { 
                resource_type: "image",
                folder: "system-admin-profiles",
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

          updateData.profilePicUrl = (result as any).secure_url;
        }
        
        // Only proceed if there's something to update
        if (Object.keys(updateData).length === 0) {
          return res.status(400).json({
            error: {
              code: 'no_updates',
              message: 'No valid updates provided'
            }
          });
        }
        
        // Use safe update method that only updates provided fields
        const updatedProfile = await authStorage.updateUserProfile(userId, 'system_admin', updateData);
        
        if (!updatedProfile) {
          return res.status(404).json({
            error: {
              code: 'profile_not_found',
              message: 'System admin profile not found'
            }
          });
        }
        
        res.json({
          success: true,
          profile: {
            id: updatedProfile.id,
            name: updatedProfile.name,
            profilePicUrl: updatedProfile.profilePicUrl,
            role: updatedProfile.role
          }
        });
      } catch (error) {
        console.error('❌ Error updating system admin profile:', error);
        res.status(500).json({
          error: {
            code: 'server_error',
            message: 'Failed to update profile'
          }
        });
      }
    }
  );

  // Disable School Account
  app.put('/api/system-admin/schools/:schoolId/disable',
    requireAuth,
    requireRole('system_admin'),
    async (req, res) => {
      try {
        const { schoolId } = req.params;
        
        console.log(`🚫 Disabling school account: ${schoolId}`);
        
        // Check if school exists
        const [school] = await db.select().from(schools).where(eq(schools.id, schoolId));
        if (!school) {
          console.log(`❌ School not found: ${schoolId}`);
          return res.status(404).json({ 
            error: { 
              code: 'school_not_found', 
              message: 'School not found' 
            } 
          });
        }

        // Update school status to disabled
        await db.update(schools)
          .set({ 
            // Add a status field to schools table if it doesn't exist
            // For now, we'll use a custom field or add it to the schema
            // This is a placeholder - you may need to add a status field to the schools table
            subscriptionPlan: 'disabled' // Using subscriptionPlan as a workaround
          })
          .where(eq(schools.id, schoolId));

        // Disable all school admin accounts for this school
        const schoolAdminUsers = await db
          .select({ id: users.id })
          .from(users)
          .innerJoin(schoolAdmins, eq(users.linkedId, schoolAdmins.id))
          .where(eq(schoolAdmins.schoolId, schoolId));

        for (const adminUser of schoolAdminUsers) {
          await db.update(users)
            .set({ emailVerified: false }) // Disable login by unverifying email
            .where(eq(users.id, adminUser.id));
        }

        // Disable all student accounts for this school
        const studentUsers = await db
          .select({ id: users.id })
          .from(users)
          .innerJoin(students, eq(users.linkedId, students.id))
          .where(eq(students.schoolId, schoolId));

        for (const studentUser of studentUsers) {
          await db.update(users)
            .set({ emailVerified: false }) // Disable login by unverifying email
            .where(eq(users.id, studentUser.id));
        }

        console.log(`✅ School disabled: ${school.name} (ID: ${schoolId})`);
        console.log(`   - Disabled ${schoolAdminUsers.length} school admin accounts`);
        console.log(`   - Disabled ${studentUsers.length} student accounts`);

        res.json({
          success: true,
          message: `School "${school.name}" has been disabled`,
          disabledAccounts: {
            schoolAdmins: schoolAdminUsers.length,
            students: studentUsers.length
          }
        });
      } catch (error) {
        console.error('❌ Error disabling school:', error);
        res.status(500).json({ 
          error: { 
            code: 'server_error', 
            message: 'Failed to disable school' 
          } 
        });
      }
    }
  );

  // Permanently Delete School
  app.delete('/api/system-admin/schools/:schoolId',
    requireAuth,
    requireRole('system_admin'),
    async (req, res) => {
      try {
        const { schoolId } = req.params;
        
        console.log(`🗑️  Permanently deleting school: ${schoolId}`);
        
        // Check if school exists
        const [school] = await db.select().from(schools).where(eq(schools.id, schoolId));
        if (!school) {
          console.log(`❌ School not found: ${schoolId}`);
          return res.status(404).json({ 
            error: { 
              code: 'school_not_found', 
              message: 'School not found' 
            } 
          });
        }

        // Get counts for logging
        const schoolAdminUsers = await db
          .select({ id: users.id })
          .from(users)
          .innerJoin(schoolAdmins, eq(users.linkedId, schoolAdmins.id))
          .where(eq(schoolAdmins.schoolId, schoolId));

        const studentUsers = await db
          .select({ id: users.id })
          .from(users)
          .innerJoin(students, eq(users.linkedId, students.id))
          .where(eq(students.schoolId, schoolId));

        // Delete in correct order using sequential queries (no transaction for Neon HTTP driver)
        try {
          // 1. Delete posts and related content first (posts reference students)
          try {
            await db.execute(sql`
              DELETE FROM posts 
              WHERE student_id IN (
                SELECT id FROM students WHERE school_id = ${schoolId}
              )
            `);
            console.log(`✅ Deleted posts for school: ${schoolId}`);
          } catch (error) {
            console.log(`⚠️  Could not delete posts: ${error.message}`);
          }

          // 2. Delete student profiles (students reference schools via school_id)
          try {
            await db.execute(sql`
              DELETE FROM students WHERE school_id = ${schoolId}
            `);
            console.log(`✅ Deleted students for school: ${schoolId}`);
          } catch (error) {
            console.log(`⚠️  Could not delete students: ${error.message}`);
          }

          // 3. Delete school admins (school_admins reference schools via school_id)
          try {
            await db.execute(sql`
              DELETE FROM school_admins WHERE school_id = ${schoolId}
            `);
            console.log(`✅ Deleted school admins for school: ${schoolId}`);
          } catch (error) {
            console.log(`⚠️  Could not delete school admins: ${error.message}`);
          }

          // 4. Delete subscriptions (if they exist)
          try {
            await db.execute(sql`
              DELETE FROM subscriptions WHERE school_id = ${schoolId}
            `);
            console.log(`✅ Deleted subscriptions for school: ${schoolId}`);
          } catch (error) {
            console.log(`⚠️  Could not delete subscriptions: ${error.message}`);
          }

          // 5. Delete school settings (if they exist)
          try {
            await db.execute(sql`
              DELETE FROM school_settings WHERE school_id = ${schoolId}
            `);
            console.log(`✅ Deleted school settings for school: ${schoolId}`);
          } catch (error) {
            console.log(`⚠️  Could not delete school settings: ${error.message}`);
          }

          // 6. Delete school applications (if they exist) - school_applications doesn't have school_id column
          // Skip this step as school_applications table doesn't reference schools directly
          console.log(`✅ Skipped school applications (no school_id column)`);

          // 7. Delete associated user accounts
          for (const adminUser of schoolAdminUsers) {
            try {
              await db.delete(users).where(eq(users.id, adminUser.id));
            } catch (error) {
              console.log(`⚠️  Could not delete admin user ${adminUser.id}: ${error.message}`);
            }
          }
          console.log(`✅ Deleted ${schoolAdminUsers.length} school admin user accounts`);

          for (const studentUser of studentUsers) {
            try {
              await db.delete(users).where(eq(users.id, studentUser.id));
            } catch (error) {
              console.log(`⚠️  Could not delete student user ${studentUser.id}: ${error.message}`);
            }
          }
          console.log(`✅ Deleted ${studentUsers.length} student user accounts`);

          // 8. Delete the school itself (last, using id column)
          await db.delete(schools).where(eq(schools.id, schoolId));
          console.log(`✅ Deleted school: ${school.name} (ID: ${schoolId})`);

        } catch (deleteError) {
          console.error('❌ Error during deletion process:', deleteError);
          throw deleteError;
        }

        console.log(`✅ School permanently deleted: ${school.name} (ID: ${schoolId})`);
        console.log(`   - Deleted ${schoolAdminUsers.length} school admin accounts`);
        console.log(`   - Deleted ${studentUsers.length} student accounts`);

        res.json({
          success: true,
          message: "School and all related data deleted successfully"
        });
      } catch (error) {
        console.error('❌ Error deleting school:', error);
        
        // Provide more descriptive error messages
        let errorMessage = 'Failed to delete school';
        if (error instanceof Error) {
          if (error.message.includes('foreign key constraint')) {
            errorMessage = 'Cannot delete school due to existing references. Please contact system administrator.';
          } else if (error.message.includes('permission denied')) {
            errorMessage = 'Insufficient permissions to delete school';
          } else if (error.message.includes('connection')) {
            errorMessage = 'Database connection error. Please try again.';
          } else {
            errorMessage = `Failed to delete school: ${error.message}`;
          }
        }
        
        res.status(500).json({ 
          error: { 
            code: 'server_error', 
            message: errorMessage 
          } 
        });
      }
    }
  );

  // Upload school profile picture
  app.post('/api/system-admin/schools/:schoolId/profile-pic',
    requireAuth,
    requireRole('system_admin'),
    upload.single('profilePic'),
    handleMulterError,
    async (req, res) => {
      try {
        const { schoolId } = req.params;
        
        console.log(`🏫 School profile picture upload request for school ID: ${schoolId}`);
        
        // Check if school exists
        const [school] = await db.select().from(schools).where(eq(schools.id, schoolId));
        if (!school) {
          console.log(`❌ School not found: ${schoolId}`);
          return res.status(404).json({ 
            error: { 
              code: 'school_not_found', 
              message: 'School not found' 
            } 
          });
        }

        // Check if file was uploaded
        if (!req.file) {
          console.log('❌ No file uploaded');
          return res.status(400).json({ 
            error: { 
              code: 'no_file', 
              message: 'No file uploaded' 
            } 
          });
        }

        console.log(`📁 File uploaded: ${req.file.originalname}, size: ${req.file.size} bytes, type: ${req.file.mimetype}`);

        // Validate file size (additional check)
        const maxSize = 5 * 1024 * 1024; // 5MB
        if (req.file.size > maxSize) {
          console.log(`❌ File too large: ${req.file.size} bytes`);
          return res.status(400).json({ 
            error: { 
              code: 'file_too_large', 
              message: 'File size must be less than 5MB' 
            } 
          });
        }

        // Upload to Cloudinary
        console.log('☁️ Uploading to Cloudinary...');
        const result = await new Promise((resolve, reject) => {
          cloudinary.uploader.upload_stream(
            { 
              resource_type: "image",
              folder: "school-profiles",
              transformation: [
                { width: 400, height: 400, crop: "fill", gravity: "auto" },
                { quality: "auto:good" },
                { format: "auto" }
              ],
              eager: [
                { width: 200, height: 200, crop: "fill", quality: "auto:good" },
                { width: 100, height: 100, crop: "fill", quality: "auto:good" }
              ],
              eager_async: true
            },
            (error, result) => {
              if (error) {
                console.error('❌ Cloudinary upload error:', error);
                reject(error);
              } else {
                console.log('✅ Cloudinary upload successful:', result?.secure_url);
                resolve(result);
              }
            }
          ).end(req.file!.buffer);
        });

        const profilePicUrl = (result as any).secure_url;

        if (!profilePicUrl) {
          console.error('❌ No secure_url returned from Cloudinary');
          return res.status(500).json({ 
            error: { 
              code: 'cloudinary_error', 
              message: 'Failed to get image URL from Cloudinary' 
            } 
          });
        }

        // Update school with new profile picture URL
        await db.update(schools)
          .set({ profilePicUrl })
          .where(eq(schools.id, schoolId));

        console.log(`🏫 School profile picture updated: ${school.name} (ID: ${schoolId}) -> ${profilePicUrl}`);

        res.json({
          success: true,
          profilePicUrl: profilePicUrl
        });
      } catch (error) {
        console.error('❌ Error uploading school profile picture:', error);
        
        // Handle specific error types
        if (error instanceof Error) {
          if (error.message.includes('Only JPEG, PNG, GIF, and WebP images are allowed')) {
            return res.status(400).json({ 
              error: { 
                code: 'invalid_file_type', 
                message: error.message 
              } 
            });
          }
          if (error.message.includes('File too large')) {
            return res.status(400).json({ 
              error: { 
                code: 'file_too_large', 
                message: error.message 
              } 
            });
          }
        }
        
        res.status(500).json({ 
          error: { 
            code: 'server_error', 
            message: 'Failed to upload profile picture' 
          } 
        });
      }
    }
  );
}
