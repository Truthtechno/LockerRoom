import { Express } from 'express';
import { requireAuth, requireRole } from '../middleware/auth';
import { db } from '../db';
import { users, schools, schoolAdmins, systemAdmins, students, subscriptions, schoolSettings, schoolApplications, posts, studentFollowers, banners } from '../../shared/schema';
import { eq, sql, and } from 'drizzle-orm';
import bcrypt from 'bcrypt';
import { AuthStorage } from '../auth-storage';
import { storage } from '../storage';
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
  // Note: System announcements endpoint is handled in routes.ts
  // to support multi-school functionality

  // Create School
  app.post('/api/system-admin/create-school',
    requireAuth,
    requireRole('system_admin'),
    async (req, res) => {
      try {
        const { name, address, contactEmail, contactPhone, paymentAmount, paymentFrequency } = req.body;
        
        // Validation
        if (!name) {
          return res.status(400).json({ 
            error: { 
              code: 'validation_error', 
              message: 'School name is required' 
            } 
          });
        }

        if (!paymentAmount || parseFloat(paymentAmount) <= 0) {
          return res.status(400).json({ 
            error: { 
              code: 'validation_error', 
              message: 'Valid payment amount is required' 
            } 
          });
        }

        if (!paymentFrequency || !['monthly', 'annual'].includes(paymentFrequency)) {
          return res.status(400).json({ 
            error: { 
              code: 'validation_error', 
              message: 'Payment frequency must be monthly or annual' 
            } 
          });
        }

        // Calculate expiration date based on frequency
        const now = new Date();
        const expirationDate = new Date(now);
        if (paymentFrequency === 'monthly') {
          expirationDate.setMonth(expirationDate.getMonth() + 1);
        } else if (paymentFrequency === 'annual') {
          expirationDate.setFullYear(expirationDate.getFullYear() + 1);
        }

        // Create school with payment information
        const [school] = await db.insert(schools).values({
          name,
          address: address || null,
          contactEmail: contactEmail || null,
          contactPhone: contactPhone || null,
          paymentAmount: paymentAmount.toString(),
          paymentFrequency: paymentFrequency,
          subscriptionExpiresAt: expirationDate,
          isActive: true,
          lastPaymentDate: now,
        }).returning();

        console.log(`🏫 School created: ${school.name} (ID: ${school.id}) - Payment: $${paymentAmount} ${paymentFrequency}`);

        res.json({
          success: true,
          school: {
            id: school.id,
            name: school.name,
            address: school.address,
            contactEmail: school.contactEmail,
            contactPhone: school.contactPhone,
            paymentAmount: school.paymentAmount,
            paymentFrequency: school.paymentFrequency,
            subscriptionExpiresAt: school.subscriptionExpiresAt,
            isActive: school.isActive,
            lastPaymentDate: school.lastPaymentDate,
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

        // Auto-follow all existing students in the school
        try {
          const schoolStudents = await db.select()
            .from(students)
            .where(eq(students.schoolId, schoolId));
          
          let followCount = 0;
          for (const student of schoolStudents) {
            try {
              // Check if already following to avoid duplicates
              const existingFollow = await db.select()
                .from(studentFollowers)
                .where(
                  sql`${studentFollowers.followerUserId} = ${user.id} AND ${studentFollowers.studentId} = ${student.id}`
                )
                .limit(1);
              
              if (existingFollow.length === 0) {
                await storage.followStudent({
                  followerUserId: user.id,
                  studentId: student.id,
                });
                followCount++;
              }
            } catch (followError) {
              console.error(`Error auto-following student ${student.id}:`, followError);
              // Continue with other students even if one fails
            }
          }
          
          if (followCount > 0) {
            console.log(`✅ Auto-followed ${followCount} students in school ${school.name}`);
          }
        } catch (autoFollowError) {
          console.error('⚠️ Error during auto-follow process (non-critical):', autoFollowError);
          // Don't fail school admin creation if auto-follow fails
        }

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
                   s.payment_amount, s.payment_frequency, s.subscription_expires_at,
                   s.is_active, s.last_payment_date, s.max_students, s.profile_pic_url,
                   s.created_at, s.updated_at
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
            isActive: false,
            updatedAt: new Date(),
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

  // Enable School Account
  app.put('/api/system-admin/schools/:schoolId/enable',
    requireAuth,
    requireRole('system_admin'),
    async (req, res) => {
      try {
        const { schoolId } = req.params;
        
        console.log(`✅ Enabling school account: ${schoolId}`);
        
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

        // Update school status to enabled
        await db.update(schools)
          .set({ 
            isActive: true,
            updatedAt: new Date(),
          })
          .where(eq(schools.id, schoolId));

        // Re-enable all school admin accounts for this school
        const schoolAdminUsers = await db
          .select({ id: users.id })
          .from(users)
          .innerJoin(schoolAdmins, eq(users.linkedId, schoolAdmins.id))
          .where(eq(schoolAdmins.schoolId, schoolId));

        for (const adminUser of schoolAdminUsers) {
          await db.update(users)
            .set({ emailVerified: true }) // Re-enable login by verifying email
            .where(eq(users.id, adminUser.id));
        }

        // Re-enable all student accounts for this school
        const studentUsers = await db
          .select({ id: users.id })
          .from(users)
          .innerJoin(students, eq(users.linkedId, students.id))
          .where(eq(students.schoolId, schoolId));

        for (const studentUser of studentUsers) {
          await db.update(users)
            .set({ emailVerified: true }) // Re-enable login by verifying email
            .where(eq(users.id, studentUser.id));
        }

        console.log(`✅ School enabled: ${school.name} (ID: ${schoolId})`);
        console.log(`   - Enabled ${schoolAdminUsers.length} school admin accounts`);
        console.log(`   - Enabled ${studentUsers.length} student accounts`);

        res.json({
          success: true,
          message: `School "${school.name}" has been enabled`,
          enabledAccounts: {
            schoolAdmins: schoolAdminUsers.length,
            students: studentUsers.length
          }
        });
      } catch (error) {
        console.error('❌ Error enabling school:', error);
        res.status(500).json({ 
          error: { 
            code: 'server_error', 
            message: 'Failed to enable school' 
          } 
        });
      }
    }
  );

  // Renew School Subscription
  app.post('/api/system-admin/schools/:schoolId/renew',
    requireAuth,
    requireRole('system_admin'),
    async (req, res) => {
      try {
        const { schoolId } = req.params;
        const { paymentAmount, paymentFrequency } = req.body;
        
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

        // Validation
        if (!paymentAmount || parseFloat(paymentAmount) <= 0) {
          return res.status(400).json({ 
            error: { 
              code: 'validation_error', 
              message: 'Valid payment amount is required' 
            } 
          });
        }

        if (!paymentFrequency || !['monthly', 'annual'].includes(paymentFrequency)) {
          return res.status(400).json({ 
            error: { 
              code: 'validation_error', 
              message: 'Payment frequency must be monthly or annual' 
            } 
          });
        }

        // Calculate new expiration date
        const now = new Date();
        const expirationDate = new Date(now);
        
        // If subscription hasn't expired yet, extend from current expiration date
        // Otherwise, start from now
        const baseDate = (school.subscriptionExpiresAt && new Date(school.subscriptionExpiresAt) > now) 
          ? new Date(school.subscriptionExpiresAt)
          : now;

        if (paymentFrequency === 'monthly') {
          expirationDate.setTime(baseDate.getTime());
          expirationDate.setMonth(expirationDate.getMonth() + 1);
        } else if (paymentFrequency === 'annual') {
          expirationDate.setTime(baseDate.getTime());
          expirationDate.setFullYear(expirationDate.getFullYear() + 1);
        }

        // Update school subscription
        const [updatedSchool] = await db.update(schools)
          .set({
            paymentAmount: paymentAmount.toString(),
            paymentFrequency: paymentFrequency,
            subscriptionExpiresAt: expirationDate,
            isActive: true,
            lastPaymentDate: now,
            updatedAt: now,
          })
          .where(eq(schools.id, schoolId))
          .returning();

        // Re-enable school admin and student accounts if they were disabled
        const schoolAdminUsers = await db
          .select({ id: users.id })
          .from(users)
          .innerJoin(schoolAdmins, eq(users.linkedId, schoolAdmins.id))
          .where(eq(schoolAdmins.schoolId, schoolId));

        for (const adminUser of schoolAdminUsers) {
          await db.update(users)
            .set({ emailVerified: true })
            .where(eq(users.id, adminUser.id));
        }

        const studentUsers = await db
          .select({ id: users.id })
          .from(users)
          .innerJoin(students, eq(users.linkedId, students.id))
          .where(eq(students.schoolId, schoolId));

        for (const studentUser of studentUsers) {
          await db.update(users)
            .set({ emailVerified: true })
            .where(eq(users.id, studentUser.id));
        }

        console.log(`✅ School subscription renewed: ${updatedSchool.name} (ID: ${schoolId}) - Payment: $${paymentAmount} ${paymentFrequency}`);

        res.json({
          success: true,
          school: {
            id: updatedSchool.id,
            name: updatedSchool.name,
            paymentAmount: updatedSchool.paymentAmount,
            paymentFrequency: updatedSchool.paymentFrequency,
            subscriptionExpiresAt: updatedSchool.subscriptionExpiresAt,
            isActive: updatedSchool.isActive,
            lastPaymentDate: updatedSchool.lastPaymentDate,
          }
        });
      } catch (error) {
        console.error('❌ Error renewing school subscription:', error);
        res.status(500).json({ 
          error: { 
            code: 'server_error', 
            message: 'Failed to renew school subscription' 
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

  // ========== BANNERS API ENDPOINTS ==========
  
  // Get all banners (system admin only)
  app.get('/api/system-admin/banners',
    requireAuth,
    requireRole('system_admin'),
    async (req, res) => {
      try {
        const bannersList = await db
          .select()
          .from(banners)
          .orderBy(sql`${banners.priority} DESC, ${banners.createdAt} DESC`);
        
        res.json({
          success: true,
          banners: bannersList
        });
      } catch (error) {
        console.error('❌ Error fetching banners:', error);
        res.status(500).json({ 
          error: { 
            code: 'server_error', 
            message: 'Failed to fetch banners' 
          } 
        });
      }
    }
  );

  // Get active banners for current user's role (public endpoint for dashboards)
  app.get('/api/banners/active',
    requireAuth,
    async (req, res) => {
      try {
        const userRole = (req as any).auth.role;
        const currentTime = new Date();
        
        // Get active banners for this role
        // Query banners where:
        // 1. is_active = true
        // 2. Current time is within start_date and end_date range (or dates are null)
        // 3. User's role is in the target_roles array
        const allBanners = await db
          .select()
          .from(banners)
          .where(eq(banners.isActive, true));
        
        // Get user's school ID if they are a school admin
        let userSchoolId: string | null = null;
        if (userRole === 'school_admin') {
          userSchoolId = (req as any).auth.schoolId || null;
        }

        // Filter banners based on date range, role, and school targeting
        const activeBanners = allBanners.filter(banner => {
          // Check date range
          if (banner.startDate && new Date(banner.startDate) > currentTime) {
            return false;
          }
          if (banner.endDate && new Date(banner.endDate) < currentTime) {
            return false;
          }
          
          // Check if user role matches banner target roles
          // For XEN Watch page, allow if user is a student/viewer and banner targets 'xen_watch'
          // For other roles, check if user role is in target roles
          let shouldShow = false;
          
          if (banner.targetRoles && banner.targetRoles.includes('xen_watch')) {
            // XEN Watch banners should show to students and viewers
            if (userRole === 'student' || userRole === 'viewer') {
              shouldShow = true;
            }
          }
          
          if (!shouldShow && banner.targetRoles && banner.targetRoles.includes(userRole)) {
            shouldShow = true;
          }
          
          if (!shouldShow) {
            return false;
          }
          
          // If user is a school admin and banner targets school_admin, check school targeting
          if (userRole === 'school_admin' && banner.targetRoles.includes('school_admin')) {
            // If banner has specific school IDs, user's school must be in the list
            if (banner.targetSchoolIds && banner.targetSchoolIds.length > 0) {
              if (!userSchoolId || !banner.targetSchoolIds.includes(userSchoolId)) {
                return false; // Banner is targeted to specific schools, and user's school is not in the list
              }
            }
            // If banner.targetSchoolIds is null or empty array, it means all schools, so show it
          }
          
          return true;
        });
        
        // Sort by priority (desc) and creation date (desc)
        activeBanners.sort((a, b) => {
          if (a.priority !== b.priority) {
            return (b.priority || 0) - (a.priority || 0);
          }
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
        
        res.json({
          success: true,
          banners: activeBanners
        });
      } catch (error) {
        console.error('❌ Error fetching active banners:', error);
        res.status(500).json({ 
          error: { 
            code: 'server_error', 
            message: 'Failed to fetch active banners' 
          } 
        });
      }
    }
  );

  // Get single banner
  app.get('/api/system-admin/banners/:id',
    requireAuth,
    requireRole('system_admin'),
    async (req, res) => {
      try {
        const { id } = req.params;
        
        const [banner] = await db
          .select()
          .from(banners)
          .where(eq(banners.id, id))
          .limit(1);
        
        if (!banner) {
          return res.status(404).json({ 
            error: { 
              code: 'not_found', 
              message: 'Banner not found' 
            } 
          });
        }
        
        res.json({
          success: true,
          banner
        });
      } catch (error) {
        console.error('❌ Error fetching banner:', error);
        res.status(500).json({ 
          error: { 
            code: 'server_error', 
            message: 'Failed to fetch banner' 
          } 
        });
      }
    }
  );

  // Create banner
  app.post('/api/system-admin/banners',
    requireAuth,
    requireRole('system_admin'),
    async (req, res) => {
      try {
        const adminId = (req as any).auth.id;
        const { title, message, category, targetRoles, targetSchoolIds, startDate, endDate, priority, isActive } = req.body;
        
        // Validation
        if (!title || !message) {
          return res.status(400).json({ 
            error: { 
              code: 'validation_error', 
              message: 'Title and message are required' 
            } 
          });
        }

        if (!category || !['info', 'warning', 'success', 'error', 'announcement'].includes(category)) {
          return res.status(400).json({ 
            error: { 
              code: 'validation_error', 
              message: 'Valid category is required (info, warning, success, error, announcement)' 
            } 
          });
        }

        if (!targetRoles || !Array.isArray(targetRoles) || targetRoles.length === 0) {
          return res.status(400).json({ 
            error: { 
              code: 'validation_error', 
              message: 'At least one target role is required' 
            } 
          });
        }

        // Validate roles
        const validRoles = ['scout_admin', 'school_admin', 'xen_scout', 'xen_watch'];
        const invalidRoles = targetRoles.filter((role: string) => !validRoles.includes(role));
        if (invalidRoles.length > 0) {
          return res.status(400).json({ 
            error: { 
              code: 'validation_error', 
              message: `Invalid roles: ${invalidRoles.join(', ')}` 
            } 
          });
        }

        // Parse dates if provided
        const parsedStartDate = startDate ? new Date(startDate) : null;
        const parsedEndDate = endDate ? new Date(endDate) : null;

        // Validate date range
        if (parsedStartDate && parsedEndDate && parsedStartDate >= parsedEndDate) {
          return res.status(400).json({ 
            error: { 
              code: 'validation_error', 
              message: 'End date must be after start date' 
            } 
          });
        }

        // Validate targetSchoolIds if school_admin is in targetRoles
        let parsedTargetSchoolIds: string[] | null = null;
        if (targetRoles.includes('school_admin')) {
          if (targetSchoolIds && Array.isArray(targetSchoolIds) && targetSchoolIds.length > 0) {
            parsedTargetSchoolIds = targetSchoolIds;
          }
          // If targetSchoolIds is null/undefined or empty array, it means all schools (NULL in DB)
        }

        // Create banner
        const [newBanner] = await db.insert(banners).values({
          title,
          message,
          category,
          targetRoles: targetRoles,
          targetSchoolIds: parsedTargetSchoolIds,
          startDate: parsedStartDate,
          endDate: parsedEndDate,
          priority: priority || 0,
          isActive: isActive !== undefined ? isActive : true,
          createdByAdminId: adminId,
        }).returning();

        console.log(`📢 Banner created: ${title} (ID: ${newBanner.id})`);

        res.json({
          success: true,
          banner: newBanner
        });
      } catch (error) {
        console.error('❌ Error creating banner:', error);
        res.status(500).json({ 
          error: { 
            code: 'server_error', 
            message: 'Failed to create banner' 
          } 
        });
      }
    }
  );

  // Update banner
  app.put('/api/system-admin/banners/:id',
    requireAuth,
    requireRole('system_admin'),
    async (req, res) => {
      try {
        const { id } = req.params;
        const { title, message, category, targetRoles, targetSchoolIds, startDate, endDate, priority, isActive } = req.body;
        
        // Check if banner exists
        const [existingBanner] = await db
          .select()
          .from(banners)
          .where(eq(banners.id, id))
          .limit(1);
        
        if (!existingBanner) {
          return res.status(404).json({ 
            error: { 
              code: 'not_found', 
              message: 'Banner not found' 
            } 
          });
        }

        // Validation
        if (category && !['info', 'warning', 'success', 'error', 'announcement'].includes(category)) {
          return res.status(400).json({ 
            error: { 
              code: 'validation_error', 
              message: 'Invalid category' 
            } 
          });
        }

        if (targetRoles && (!Array.isArray(targetRoles) || targetRoles.length === 0)) {
          return res.status(400).json({ 
            error: { 
              code: 'validation_error', 
              message: 'At least one target role is required' 
            } 
          });
        }

        // Validate roles if provided
        if (targetRoles) {
          const validRoles = ['scout_admin', 'school_admin', 'xen_scout', 'xen_watch'];
          const invalidRoles = targetRoles.filter((role: string) => !validRoles.includes(role));
          if (invalidRoles.length > 0) {
            return res.status(400).json({ 
              error: { 
                code: 'validation_error', 
                message: `Invalid roles: ${invalidRoles.join(', ')}` 
              } 
            });
          }
        }

        // Parse dates if provided
        const parsedStartDate = startDate !== undefined ? (startDate ? new Date(startDate) : null) : existingBanner.startDate;
        const parsedEndDate = endDate !== undefined ? (endDate ? new Date(endDate) : null) : existingBanner.endDate;

        // Validate date range
        if (parsedStartDate && parsedEndDate && parsedStartDate >= parsedEndDate) {
          return res.status(400).json({ 
            error: { 
              code: 'validation_error', 
              message: 'End date must be after start date' 
            } 
          });
        }

        // Handle targetSchoolIds if school_admin is in targetRoles
        let parsedTargetSchoolIds: string[] | null = undefined;
        const finalTargetRoles = targetRoles !== undefined ? targetRoles : existingBanner.targetRoles;
        if (finalTargetRoles.includes('school_admin')) {
          if (targetSchoolIds !== undefined) {
            if (targetSchoolIds && Array.isArray(targetSchoolIds) && targetSchoolIds.length > 0) {
              parsedTargetSchoolIds = targetSchoolIds;
            } else {
              parsedTargetSchoolIds = null; // Empty array or null means all schools
            }
          } else {
            // Keep existing value if not provided
            parsedTargetSchoolIds = existingBanner.targetSchoolIds;
          }
        } else {
          // If school_admin is not in targetRoles, clear targetSchoolIds
          parsedTargetSchoolIds = null;
        }

        // Update banner
        const updateData: any = {
          title: title !== undefined ? title : existingBanner.title,
          message: message !== undefined ? message : existingBanner.message,
          category: category !== undefined ? category : existingBanner.category,
          targetRoles: finalTargetRoles,
          startDate: parsedStartDate,
          endDate: parsedEndDate,
          priority: priority !== undefined ? priority : existingBanner.priority,
          isActive: isActive !== undefined ? isActive : existingBanner.isActive,
          updatedAt: sql`now()`,
        };

        // Only update targetSchoolIds if it changed or school_admin role changed
        if (parsedTargetSchoolIds !== undefined) {
          updateData.targetSchoolIds = parsedTargetSchoolIds;
        }

        const [updatedBanner] = await db.update(banners)
          .set(updateData)
          .where(eq(banners.id, id))
          .returning();

        console.log(`📢 Banner updated: ${updatedBanner.title} (ID: ${id})`);

        res.json({
          success: true,
          banner: updatedBanner
        });
      } catch (error) {
        console.error('❌ Error updating banner:', error);
        res.status(500).json({ 
          error: { 
            code: 'server_error', 
            message: 'Failed to update banner' 
          } 
        });
      }
    }
  );

  // Delete banner
  app.delete('/api/system-admin/banners/:id',
    requireAuth,
    requireRole('system_admin'),
    async (req, res) => {
      try {
        const { id } = req.params;
        
        // Check if banner exists
        const [existingBanner] = await db
          .select()
          .from(banners)
          .where(eq(banners.id, id))
          .limit(1);
        
        if (!existingBanner) {
          return res.status(404).json({ 
            error: { 
              code: 'not_found', 
              message: 'Banner not found' 
            } 
          });
        }

        // Delete banner
        await db.delete(banners).where(eq(banners.id, id));

        console.log(`🗑️ Banner deleted: ${existingBanner.title} (ID: ${id})`);

        res.json({
          success: true,
          message: 'Banner deleted successfully'
        });
      } catch (error) {
        console.error('❌ Error deleting banner:', error);
        res.status(500).json({ 
          error: { 
            code: 'server_error', 
            message: 'Failed to delete banner' 
          } 
        });
      }
    }
  );
}
