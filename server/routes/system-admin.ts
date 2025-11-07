import { Express } from 'express';
import { requireAuth, requireRole } from '../middleware/auth';
import { db } from '../db';
import { users, schools, schoolAdmins, systemAdmins, students, subscriptions, schoolSettings, schoolApplications, posts, studentFollowers, banners, schoolPaymentRecords } from '../../shared/schema';
import { eq, sql, and } from 'drizzle-orm';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
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
        const { name, address, contactEmail, contactPhone, paymentAmount, paymentFrequency, maxStudents } = req.body;
        const auth = (req as any).auth;
        
        // Validation
        if (!name) {
          return res.status(400).json({ 
            error: { 
              code: 'validation_error', 
              message: 'School name is required' 
            } 
          });
        }

        if (paymentAmount === undefined || paymentAmount === null || paymentAmount === '') {
          return res.status(400).json({ 
            error: { 
              code: 'validation_error', 
              message: 'Payment amount is required' 
            } 
          });
        }
        
        const amount = parseFloat(paymentAmount);
        if (isNaN(amount) || amount < 0) {
          return res.status(400).json({ 
            error: { 
              code: 'validation_error', 
              message: 'Payment amount must be a valid number greater than or equal to 0' 
            } 
          });
        }

        if (!paymentFrequency || !['monthly', 'annual', 'one-time'].includes(paymentFrequency)) {
          return res.status(400).json({ 
            error: { 
              code: 'validation_error', 
              message: 'Payment frequency must be monthly, annual, or one-time' 
            } 
          });
        }

        // Validate maxStudents
        const studentLimit = maxStudents ? parseInt(maxStudents, 10) : 10; // Default to 10
        if (isNaN(studentLimit) || studentLimit < 1 || studentLimit > 10000) {
          return res.status(400).json({ 
            error: { 
              code: 'validation_error', 
              message: 'Student limit must be between 1 and 10,000' 
            } 
          });
        }

        // Calculate expiration date based on frequency
        const now = new Date();
        let expirationDate: Date | null = null;
        if (paymentFrequency === 'monthly') {
          expirationDate = new Date(now);
          expirationDate.setMonth(expirationDate.getMonth() + 1);
        } else if (paymentFrequency === 'annual') {
          expirationDate = new Date(now);
          expirationDate.setFullYear(expirationDate.getFullYear() + 1);
        } else if (paymentFrequency === 'one-time') {
          // One-time payments don't have an expiration date
          expirationDate = null;
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
          maxStudents: studentLimit,
        }).returning();

        // Create initial payment record
        await db.insert(schoolPaymentRecords).values({
          schoolId: school.id,
          paymentAmount: paymentAmount.toString(),
          paymentFrequency: paymentFrequency,
          paymentType: 'initial',
          studentLimitAfter: studentLimit,
          recordedBy: auth.id,
          recordedAt: now,
          subscriptionExpiresAt: expirationDate,
          notes: 'Initial payment - School creation',
        });

        console.log(`🏫 School created: ${school.name} (ID: ${school.id}) - Payment: $${paymentAmount} ${paymentFrequency}`);

        // Notify system admins about the new school
        const { notifySystemAdminsOfNewSchool } = await import('../utils/notification-helpers');
        notifySystemAdminsOfNewSchool(school.id, school.name).catch(err => {
          console.error('❌ Failed to notify system admins of new school (non-critical):', err);
        });

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
            maxStudents: school.maxStudents,
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

        // Generate secure OTP (6-digit numeric for consistency with student OTPs)
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const otpHash = await bcrypt.hash(otp, 10);
        const otpExpiresAt = new Date();
        otpExpiresAt.setMinutes(otpExpiresAt.getMinutes() + 30); // 30 minutes expiration
        
        // Generate initial password hash (will be replaced on first login)
        const initialPassword = crypto.randomUUID();
        const passwordHash = await bcrypt.hash(initialPassword, 12);

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
          emailVerified: true, // School admins created by system admin are pre-verified
          isOneTimePassword: true, // Flag to force password reset on first login
          otpHash: otpHash,
          otpExpiresAt: otpExpiresAt
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

        // Send welcome email with OTP to school admin
        const { sendSchoolAdminAccountEmail } = await import("../email");
        const emailResult = await sendSchoolAdminAccountEmail(
          email,
          name,
          otp,
          school.name
        );
        
        if (!emailResult.success) {
          console.error('📧 Failed to send school admin account email:', emailResult.error);
          // Don't fail school admin creation if email fails, but log it
        } else {
          console.log(`📧 Welcome email with OTP sent to school admin: ${email}`);
        }

        console.log(`👨‍💼 School admin created: ${name} (${email}) for school: ${school.name}`);

        // Notify system admins about the new school admin
        const { notifySystemAdminsOfNewSchoolAdmin } = await import('../utils/notification-helpers');
        notifySystemAdminsOfNewSchoolAdmin(user.id, name, school.id, school.name).catch(err => {
          console.error('❌ Failed to notify system admins of new school admin (non-critical):', err);
        });

        res.json({
          success: true,
          message: 'School admin created successfully. A welcome email with login instructions has been sent to the admin.',
          schoolAdmin: {
            id: schoolAdmin.id,
            name: schoolAdmin.name,
            email: user.email,
            schoolId: schoolAdmin.schoolId,
            schoolName: school.name,
            position: schoolAdmin.position
          }
          // OTP removed from response for security - sent via email instead
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
        // Get schools with counts of admins and students, and most recent payment date
        const schoolsWithStats = await db.execute(sql`
          SELECT 
            s.id,
            s.name,
            s.address,
            s.contact_email,
            s.contact_phone,
            s.payment_amount,
            s.payment_frequency,
            s.subscription_expires_at,
            s.is_active,
            COALESCE(
              MAX(CASE WHEN spr.payment_type IN ('initial', 'renewal') THEN spr.recorded_at END),
              s.last_payment_date
            ) as last_payment_date,
            s.max_students,
            s.profile_pic_url,
            s.created_at,
            s.updated_at,
            COUNT(DISTINCT sa.id) as admin_count,
            COUNT(DISTINCT st.id) as student_count,
            COUNT(DISTINCT p.id) as post_count
          FROM schools s
          LEFT JOIN school_admins sa ON s.id = sa.school_id
          LEFT JOIN students st ON s.id = st.school_id
          LEFT JOIN posts p ON st.id = p.student_id
          LEFT JOIN school_payment_records spr ON s.id = spr.school_id 
            AND spr.payment_type IN ('initial', 'renewal')
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

  // Conditional multer middleware - only process multipart/form-data
  const conditionalMulter = (req: any, res: any, next: any) => {
    const contentType = req.headers['content-type'] || '';
    if (contentType.includes('multipart/form-data')) {
      return upload.single('profilePic')(req, res, next);
    }
    // Skip multer for JSON requests
    next();
  };

  // Safe profile update for system admin
  app.put('/api/system-admin/profile',
    requireAuth,
    requireRole('system_admin'),
    conditionalMulter,
    async (req, res) => {
      try {
        let userId = (req as any).auth?.id;
        let linkedId = (req as any).auth?.linkedId;
        const userRole = (req as any).auth?.role;
        const userEmail = (req as any).auth?.email;
        
        console.log('📤 System admin profile update request:', {
          userId,
          linkedId,
          userRole,
          userEmail,
          contentType: req.headers['content-type'],
          hasFile: !!req.file,
          bodyKeys: Object.keys(req.body || {})
        });
        
        if (!userId) {
          console.error('❌ No userId in auth object');
          return res.status(401).json({
            error: {
              code: 'unauthorized',
              message: 'User ID not found in authentication token. Please log out and log back in.'
            }
          });
        }
        
        // Verify user exists in database - JWT might have stale userId
        // Use let instead of const to allow reassignment in fallback path
        let userInDb = await db.select({
          id: users.id,
          email: users.email,
          role: users.role,
          linkedId: users.linkedId
        })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
        
        // Ensure userInDb is always set - fix fallback path
        if (!userInDb || userInDb.length === 0) {
          console.warn('⚠️ User from JWT not found in database, trying to find by email:', { 
            jwtUserId: userId, 
            email: userEmail 
          });
          
          // Fallback: try to find user by email if userId doesn't exist
          if (userEmail) {
            const [userByEmail] = await db.select({
              id: users.id,
              email: users.email,
              role: users.role,
              linkedId: users.linkedId
            })
            .from(users)
            .where(eq(users.email, userEmail))
            .limit(1);
            
            if (userByEmail && userByEmail.role === 'system_admin') {
              console.log('✅ Found user by email, using correct userId:', {
                oldUserId: userId,
                newUserId: userByEmail.id,
                email: userByEmail.email
              });
              // CRITICAL: Set userInDb to array with userByEmail so it's available later
              userInDb = [userByEmail];
              userId = userByEmail.id;
              linkedId = userByEmail.linkedId;
            } else {
              console.error('❌ User not found by email or role mismatch:', { 
                email: userEmail, 
                found: !!userByEmail,
                role: userByEmail?.role 
              });
              return res.status(401).json({
                error: {
                  code: 'invalid_token',
                  message: 'Your session token is invalid. Please log out and log back in to refresh your session.'
                }
              });
            }
          } else {
            console.error('❌ Cannot lookup user - no email in JWT');
            return res.status(401).json({
              error: {
                code: 'invalid_token',
                message: 'Your session token is invalid. Please log out and log back in to refresh your session.'
              }
            });
          }
        }
        
        // Verify userInDb is set and extract first element
        if (!userInDb || userInDb.length === 0) {
          console.error('❌ User not found after fallback');
          return res.status(401).json({
            error: {
              code: 'user_not_found',
              message: 'User not found in database'
            }
          });
        }
        
        const currentUser = userInDb[0];
        
        // Verify role matches (currentUser is guaranteed to be set at this point)
        if (currentUser.role !== 'system_admin') {
          console.error('❌ User role mismatch:', { 
            userId: currentUser.id, 
            role: currentUser.role, 
            expected: 'system_admin' 
          });
          return res.status(403).json({
            error: {
              code: 'forbidden',
              message: 'You do not have permission to update system admin profiles'
            }
          });
        }
        
        // Use the linkedId from database (more reliable than JWT)
        linkedId = currentUser.linkedId;
        console.log('✅ User verified in database:', {
          userId: currentUser.id,
          email: currentUser.email,
          linkedId: currentUser.linkedId
        });
        
        // Parse body - handle both JSON and form-data
        let name: string | undefined;
        let profilePicUrl: string | undefined;
        
        if (req.headers['content-type']?.includes('application/json')) {
          // JSON body
          const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
          name = body.name;
          profilePicUrl = body.profilePicUrl;
        } else {
          // Form data
          name = req.body.name;
          profilePicUrl = req.body.profilePicUrl;
        }
        
        console.log('📋 Parsed update data:', { name, profilePicUrl, hasFile: !!req.file });
        
        let updateData: any = {};
        
        // Only update name if provided
        if (name !== undefined && name !== null && name.trim()) {
          updateData.name = name.trim();
        }
        
        // Handle profile picture URL from JSON body (already uploaded to Cloudinary)
        if (profilePicUrl !== undefined && profilePicUrl !== null) {
          updateData.profilePicUrl = profilePicUrl;
        }
        
        // Handle profile picture upload to Cloudinary via file upload
        if (req.file) {
          console.log('📁 Processing file upload to Cloudinary');
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
          console.log('✅ File uploaded to Cloudinary:', updateData.profilePicUrl);
        }
        
        // Only proceed if there's something to update
        if (Object.keys(updateData).length === 0) {
          console.warn('⚠️ No updates provided');
          return res.status(400).json({
            error: {
              code: 'no_updates',
              message: 'No valid updates provided'
            }
          });
        }
        
        console.log('💾 Updating system admin profile with data:', updateData);
        
        // Use safe update method that only updates provided fields
        const updatedProfile = await authStorage.updateUserProfile(userId, 'system_admin', updateData);
        
        if (!updatedProfile) {
          console.error('❌ System admin profile update returned null/undefined:', {
            userId,
            linkedId,
            updateData
          });
          return res.status(404).json({
            error: {
              code: 'profile_not_found',
              message: 'System admin profile not found. Please ensure your account is properly configured.'
            }
          });
        }
        
        console.log('✅ System admin profile updated successfully:', {
            id: updatedProfile.id,
            name: updatedProfile.name,
          hasProfilePic: !!updatedProfile.profilePicUrl
        });
        
        // Also update the users table profilePicUrl and name if provided (for consistency)
        const userUpdates: any = {};
        if (updateData.profilePicUrl) {
          userUpdates.profilePicUrl = updateData.profilePicUrl;
        }
        if (updateData.name) {
          userUpdates.name = updateData.name;
        }
        
        if (Object.keys(userUpdates).length > 0) {
          await db.update(users)
            .set(userUpdates)
            .where(eq(users.id, userId));
          console.log('✅ Updated users table with profile data');
        }
        
        // CRITICAL: Invalidate Redis cache BEFORE returning response
        // This ensures the next /api/users/me request gets fresh data immediately
        try {
          const { cacheInvalidate } = await import('../cache');
          await cacheInvalidate(`user:${userId}`);
          console.log('✅ Invalidated user cache:', `user:${userId}`);
          
          // Also invalidate any pattern-based caches (if Redis supports it)
          try {
            const { cacheInvalidatePattern } = await import('../cache');
            await cacheInvalidatePattern(`user:${userId}*`);
            console.log('✅ Invalidated user cache pattern');
          } catch (patternError) {
            // Pattern invalidation might not be supported, that's okay
            console.log('ℹ️ Pattern-based cache invalidation not available');
          }
        } catch (cacheError) {
          console.warn('⚠️ Failed to invalidate cache (non-critical):', cacheError);
          // Don't fail the request if cache invalidation fails, but log it
        }
        
        // Return response in same format as school-admin for consistency
        // This matches what the client expects: { id, name, email, profilePicUrl }
        // Use currentUser.email (guaranteed to be set at this point)
        const response = {
          id: userId,
          name: updatedProfile.name,
          email: currentUser.email,
          profilePicUrl: updatedProfile.profilePicUrl,
          role: 'system_admin'
        };
        
        console.log('✅ Returning profile update response:', {
          id: response.id,
          email: response.email,
          profilePicUrl: response.profilePicUrl
        });
        
        res.json(response);
      } catch (error: any) {
        console.error('❌ Error updating system admin profile:', {
          error: error.message,
          stack: error.stack,
          userId: (req as any).auth?.id
        });
        res.status(500).json({
          error: {
            code: 'server_error',
            message: error.message || 'Failed to update profile'
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

  // Record Payment (separate from renewal)
  app.post('/api/system-admin/schools/:schoolId/payments',
    requireAuth,
    requireRole('system_admin'),
    async (req, res) => {
      try {
        const { schoolId } = req.params;
        const { paymentAmount, paymentFrequency, paymentType, studentLimitBefore, studentLimitAfter, oldFrequency, newFrequency, notes } = req.body;
        const auth = (req as any).auth;
        
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
        if (paymentAmount === undefined || paymentAmount === null || paymentAmount === '') {
          return res.status(400).json({ 
            error: { 
              code: 'validation_error', 
              message: 'Payment amount is required' 
            } 
          });
        }
        
        const amount = parseFloat(paymentAmount);
        if (isNaN(amount) || amount < 0) {
          return res.status(400).json({ 
            error: { 
              code: 'validation_error', 
              message: 'Payment amount must be a valid number greater than or equal to 0' 
            } 
          });
        }

        if (!paymentFrequency || !['monthly', 'annual', 'one-time'].includes(paymentFrequency)) {
          return res.status(400).json({ 
            error: { 
              code: 'validation_error', 
              message: 'Payment frequency must be monthly, annual, or one-time' 
            } 
          });
        }

        if (!paymentType || !['initial', 'renewal', 'student_limit_increase', 'student_limit_decrease', 'frequency_change'].includes(paymentType)) {
          return res.status(400).json({ 
            error: { 
              code: 'validation_error', 
              message: 'Valid payment type is required' 
            } 
          });
        }

        // Create payment record
        const now = new Date();
        const [paymentRecord] = await db.insert(schoolPaymentRecords).values({
          schoolId: schoolId,
          paymentAmount: paymentAmount.toString(),
          paymentFrequency: paymentFrequency,
          paymentType: paymentType,
          studentLimitBefore: studentLimitBefore ? parseInt(studentLimitBefore, 10) : null,
          studentLimitAfter: studentLimitAfter ? parseInt(studentLimitAfter, 10) : null,
          oldFrequency: oldFrequency || null,
          newFrequency: newFrequency || null,
          notes: notes || null,
          recordedBy: auth.id,
          recordedAt: now,
        }).returning();

        // If this is a limit change, update school's maxStudents
        if (paymentType === 'student_limit_increase' || paymentType === 'student_limit_decrease') {
          if (studentLimitAfter) {
            // Check current enrollment doesn't exceed new limit
            const studentCountResult = await db
              .select({ count: sql<number>`count(*)::int` })
              .from(students)
              .where(eq(students.schoolId, schoolId));
            
            const currentStudentCount = studentCountResult[0]?.count || 0;
            if (currentStudentCount > studentLimitAfter) {
              return res.status(400).json({ 
                error: { 
                  code: 'validation_error', 
                  message: `Cannot decrease limit below current enrollment (${currentStudentCount} students)` 
                } 
              });
            }

            await db.update(schools)
              .set({ 
                maxStudents: studentLimitAfter,
                updatedAt: now,
              })
              .where(eq(schools.id, schoolId));
          }
        }

        // If this is a frequency change, update school's payment frequency
        if (paymentType === 'frequency_change' && newFrequency) {
          await db.update(schools)
            .set({ 
              paymentFrequency: newFrequency,
              paymentAmount: paymentAmount.toString(),
              updatedAt: now,
            })
            .where(eq(schools.id, schoolId));
        }

        // Update school's last_payment_date for initial and renewal payments
        if (paymentType === 'initial' || paymentType === 'renewal') {
          await db.update(schools)
            .set({ 
              lastPaymentDate: now,
              paymentAmount: paymentAmount.toString(),
              updatedAt: now,
            })
            .where(eq(schools.id, schoolId));
          console.log(`📅 Updated school's last_payment_date to ${now.toISOString()} for payment type: ${paymentType}`);
        }

        // Notify system admins and school admins about the payment
        const { notifySchoolPaymentRecorded } = await import('../utils/notification-helpers');
        notifySchoolPaymentRecorded(
          paymentRecord.id,
          schoolId,
          school.name,
          paymentAmount.toString(),
          paymentFrequency,
          paymentType,
          studentLimitBefore ? parseInt(studentLimitBefore, 10) : null,
          studentLimitAfter ? parseInt(studentLimitAfter, 10) : null,
          oldFrequency || null,
          newFrequency || null
        ).catch(err => {
          console.error('❌ Failed to notify about school payment (non-critical):', err);
        });

        res.json({
          success: true,
          paymentRecord: {
            id: paymentRecord.id,
            schoolId: paymentRecord.schoolId,
            paymentAmount: paymentRecord.paymentAmount,
            paymentFrequency: paymentRecord.paymentFrequency,
            paymentType: paymentRecord.paymentType,
            recordedAt: paymentRecord.recordedAt,
          }
        });
      } catch (error) {
        console.error('❌ Error recording payment:', error);
        res.status(500).json({ 
          error: { 
            code: 'server_error', 
            message: 'Failed to record payment' 
          } 
        });
      }
    }
  );

  // Get Payment History
  app.get('/api/system-admin/schools/:schoolId/payments',
    requireAuth,
    requireRole('system_admin'),
    async (req, res) => {
      try {
        const { schoolId } = req.params;
        
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

        const paymentHistory = await db
          .select({
            id: schoolPaymentRecords.id,
            paymentAmount: schoolPaymentRecords.paymentAmount,
            paymentFrequency: schoolPaymentRecords.paymentFrequency,
            paymentType: schoolPaymentRecords.paymentType,
            studentLimitBefore: schoolPaymentRecords.studentLimitBefore,
            studentLimitAfter: schoolPaymentRecords.studentLimitAfter,
            oldFrequency: schoolPaymentRecords.oldFrequency,
            newFrequency: schoolPaymentRecords.newFrequency,
            notes: schoolPaymentRecords.notes,
            recordedBy: schoolPaymentRecords.recordedBy,
            recordedAt: schoolPaymentRecords.recordedAt,
            subscriptionExpiresAt: schoolPaymentRecords.subscriptionExpiresAt,
          })
          .from(schoolPaymentRecords)
          .where(eq(schoolPaymentRecords.schoolId, schoolId))
          .orderBy(sql`${schoolPaymentRecords.recordedAt} DESC`);

        // Get recorded by user names
        const paymentHistoryWithUsers = await Promise.all(
          paymentHistory.map(async (payment) => {
            if (payment.recordedBy) {
              const [user] = await db.select({ name: users.name }).from(users).where(eq(users.id, payment.recordedBy)).limit(1);
              return { ...payment, recordedByName: user?.name || 'Unknown' };
            }
            return { ...payment, recordedByName: 'System' };
          })
        );

        res.json({
          success: true,
          payments: paymentHistoryWithUsers,
        });
      } catch (error) {
        console.error('❌ Error fetching payment history:', error);
        res.status(500).json({ 
          error: { 
            code: 'server_error', 
            message: 'Failed to fetch payment history' 
          } 
        });
      }
    }
  );

  // Renew Subscription (separated from payment recording)
  app.post('/api/system-admin/schools/:schoolId/renew',
    requireAuth,
    requireRole('system_admin'),
    async (req, res) => {
      try {
        const { schoolId } = req.params;
        const { renewalDate } = req.body;
        
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

        // Calculate new expiration date from renewal date (not from existing expiration)
        const now = new Date();
        const renewalDateTime = renewalDate ? new Date(renewalDate) : now;
        const expirationDate = new Date(renewalDateTime);
        
        const paymentFrequency = school.paymentFrequency || 'monthly';
        if (paymentFrequency === 'monthly') {
          expirationDate.setMonth(expirationDate.getMonth() + 1);
        } else if (paymentFrequency === 'annual') {
          expirationDate.setFullYear(expirationDate.getFullYear() + 1);
        } else if (paymentFrequency === 'one-time') {
          // One-time payments don't renew - they have no expiration
          return res.status(400).json({ 
            error: { 
              code: 'validation_error', 
              message: 'Cannot renew one-time payment subscriptions. One-time payments do not expire.' 
            } 
          });
        }

        // Update school subscription
        const [updatedSchool] = await db.update(schools)
          .set({
            subscriptionExpiresAt: expirationDate,
            isActive: true,
            lastPaymentDate: renewalDateTime,
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

        console.log(`✅ School subscription renewed: ${updatedSchool.name} (ID: ${schoolId}) - Expires: ${expirationDate.toISOString()}`);

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

  // Get School Details
  app.get('/api/system-admin/schools/:schoolId',
    requireAuth,
    requireRole('system_admin'),
    async (req, res) => {
      try {
        const { schoolId } = req.params;
        
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

        // Get student count
        const studentCountResult = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(students)
          .where(eq(students.schoolId, schoolId));
        const studentCount = studentCountResult[0]?.count || 0;

        // Get admin count
        const adminCountResult = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(schoolAdmins)
          .where(eq(schoolAdmins.schoolId, schoolId));
        const adminCount = adminCountResult[0]?.count || 0;

        // Get post count
        const postCountResult = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(posts)
          .innerJoin(students, eq(posts.studentId, students.id))
          .where(eq(students.schoolId, schoolId));
        const postCount = postCountResult[0]?.count || 0;

        res.json({
          success: true,
          school: {
            ...school,
            studentCount,
            adminCount,
            postCount,
          }
        });
      } catch (error) {
        console.error('❌ Error fetching school details:', error);
        res.status(500).json({ 
          error: { 
            code: 'server_error', 
            message: 'Failed to fetch school details' 
          } 
        });
      }
    }
  );

  // Update School Information
  app.put('/api/system-admin/schools/:schoolId',
    requireAuth,
    requireRole('system_admin'),
    async (req, res) => {
      try {
        const { schoolId } = req.params;
        const { name, address, contactEmail, contactPhone, paymentFrequency } = req.body;
        const auth = (req as any).auth;
        
        console.log(`📝 Update School Request - ID: ${schoolId}, paymentFrequency: ${paymentFrequency}, body:`, JSON.stringify(req.body));
        
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
        
        console.log(`📊 Current school data - Name: ${school.name}, Frequency: ${school.paymentFrequency}, LastPayment: ${school.lastPaymentDate?.toISOString() || 'N/A'}, CurrentExpiry: ${school.subscriptionExpiresAt?.toISOString() || 'N/A'}`);

        // Validate payment frequency if provided
        if (paymentFrequency !== undefined && !['monthly', 'annual', 'one-time'].includes(paymentFrequency)) {
          return res.status(400).json({ 
            error: { 
              code: 'validation_error', 
              message: 'Payment frequency must be monthly, annual, or one-time' 
            } 
          });
        }

        // Check if payment frequency is changing
        const oldFrequency = school.paymentFrequency;
        const frequencyChanged = paymentFrequency !== undefined && paymentFrequency !== oldFrequency;
        
        // Determine the effective frequency to use for calculations
        const effectiveFrequency = paymentFrequency !== undefined ? paymentFrequency : oldFrequency;

        // Update only allowed fields
        const now = new Date();
        const updateData: any = {
          updatedAt: now,
        };
        
        if (name !== undefined) updateData.name = name;
        if (address !== undefined) updateData.address = address || null;
        if (contactEmail !== undefined) updateData.contactEmail = contactEmail || null;
        if (contactPhone !== undefined) updateData.contactPhone = contactPhone || null;
        if (paymentFrequency !== undefined) updateData.paymentFrequency = paymentFrequency;

        // Recalculate expiration date if payment frequency is being explicitly updated
        // This ensures expiration dates are correct even if frequency was set before this fix
        const shouldRecalculate = paymentFrequency !== undefined && effectiveFrequency;
        
        console.log(`🔍 Recalculation check - paymentFrequency: ${paymentFrequency}, effectiveFrequency: ${effectiveFrequency}, shouldRecalculate: ${shouldRecalculate}`);
        
        if (shouldRecalculate) {
          let newExpirationDate: Date | null = null;
          
          // Use last payment date as base if available, otherwise use current date
          // If changing from monthly to annual, we want to extend from last payment, not reset
          const baseDate = school.lastPaymentDate ? new Date(school.lastPaymentDate) : now;
          
          console.log(`📅 Base date calculation - lastPaymentDate: ${school.lastPaymentDate?.toISOString() || 'N/A'}, using: ${baseDate.toISOString()}`);
          
          if (effectiveFrequency === 'monthly') {
            newExpirationDate = new Date(baseDate);
            newExpirationDate.setMonth(newExpirationDate.getMonth() + 1);
            console.log(`📅 Monthly calculation: ${baseDate.toISOString()} + 1 month = ${newExpirationDate.toISOString()}`);
          } else if (effectiveFrequency === 'annual') {
            newExpirationDate = new Date(baseDate);
            newExpirationDate.setFullYear(newExpirationDate.getFullYear() + 1);
            console.log(`📅 Annual calculation: ${baseDate.toISOString()} + 1 year = ${newExpirationDate.toISOString()}`);
          } else if (effectiveFrequency === 'one-time') {
            // One-time payments don't have an expiration date
            newExpirationDate = null;
            console.log(`📅 One-time payment - no expiration date`);
          }
          
          updateData.subscriptionExpiresAt = newExpirationDate;
          console.log(`🔄 Recalculating expiration date for ${school.name}: ${oldFrequency} → ${effectiveFrequency}, base date: ${baseDate.toISOString()}, new expiry: ${newExpirationDate?.toISOString() || 'N/A'}`);
          console.log(`💾 Update data before save:`, JSON.stringify(updateData, null, 2));
        } else {
          console.log(`⚠️ Not recalculating - paymentFrequency: ${paymentFrequency}, effectiveFrequency: ${effectiveFrequency}`);
        }

        console.log(`💾 About to update database with:`, JSON.stringify(updateData, (key, value) => {
          if (value instanceof Date) return value.toISOString();
          return value;
        }, 2));
        
        const [updatedSchool] = await db.update(schools)
          .set(updateData)
          .where(eq(schools.id, schoolId))
          .returning();

        console.log(`✅ School updated: ${updatedSchool.name} (ID: ${schoolId})`);
        console.log(`   - Payment frequency: ${updatedSchool.paymentFrequency} (was: ${school.paymentFrequency})`);
        console.log(`   - Expires: ${updatedSchool.subscriptionExpiresAt?.toISOString() || 'N/A'} (was: ${school.subscriptionExpiresAt?.toISOString() || 'N/A'})`);
        console.log(`   - Last Payment: ${updatedSchool.lastPaymentDate?.toISOString() || 'N/A'}`);

        // If payment frequency changed, create a payment record for audit trail
        // Note: This creates a frequency_change record, but for actual payments,
        // system admins should use the "Record Payment" feature to create initial/renewal records
        if (frequencyChanged && oldFrequency && paymentFrequency) {
          try {
            const [paymentRecord] = await db.insert(schoolPaymentRecords).values({
              schoolId: schoolId,
              paymentAmount: school.paymentAmount || '0.00',
              paymentFrequency: paymentFrequency,
              paymentType: 'frequency_change',
              oldFrequency: oldFrequency,
              newFrequency: paymentFrequency,
              notes: `Payment frequency changed from ${oldFrequency} to ${paymentFrequency} via Update School Information`,
              recordedBy: auth.id,
              recordedAt: now,
            }).returning();
            
            // Note: We don't update last_payment_date here because frequency_change
            // doesn't represent a new payment. If a payment was made, it should be
            // recorded as 'initial' or 'renewal' through the payment recording feature.

            // Notify system admins and school admins about the frequency change
            const { notifySchoolPaymentRecorded } = await import('../utils/notification-helpers');
            notifySchoolPaymentRecorded(
              paymentRecord.id,
              schoolId,
              school.name,
              school.paymentAmount || '0.00',
              paymentFrequency,
              'frequency_change',
              null, // studentLimitBefore
              null, // studentLimitAfter
              oldFrequency,
              paymentFrequency
            ).catch(err => {
              console.error('❌ Failed to notify about frequency change (non-critical):', err);
            });
          } catch (error) {
            console.error('❌ Error creating payment record for frequency change (non-critical):', error);
            // Don't fail the request if payment record creation fails
          }
        }

        res.json({
          success: true,
          school: updatedSchool,
        });
      } catch (error) {
        console.error('❌ Error updating school:', error);
        res.status(500).json({ 
          error: { 
            code: 'server_error', 
            message: 'Failed to update school' 
          } 
        });
      }
    }
  );

  // Get School Admins
  app.get('/api/system-admin/schools/:schoolId/admins',
    requireAuth,
    requireRole('system_admin'),
    async (req, res) => {
      try {
        const { schoolId } = req.params;
        
        const admins = await db
          .select({
            adminId: schoolAdmins.id,
            userId: users.id,
            name: users.name,
            email: users.email,
            createdAt: users.createdAt,
          })
          .from(schoolAdmins)
          .innerJoin(users, eq(users.linkedId, schoolAdmins.id))
          .where(eq(schoolAdmins.schoolId, schoolId))
          .orderBy(sql`${users.name} ASC`);

        res.json({
          success: true,
          admins,
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

  // Get School Students
  app.get('/api/system-admin/schools/:schoolId/students',
    requireAuth,
    requireRole('system_admin'),
    async (req, res) => {
      try {
        const { schoolId } = req.params;
        const { search, sortBy = 'name', sortOrder = 'asc' } = req.query;
        
        let query = db
          .select({
            studentId: students.id,
            userId: users.id,
            name: users.name,
            email: users.email,
            phone: students.phone,
            sport: students.sport,
            position: students.position,
            roleNumber: students.roleNumber,
            gender: students.gender,
            bio: students.bio,
            profilePicUrl: students.profilePicUrl,
            height: students.height,
            weight: students.weight,
            createdAt: users.createdAt,
          })
          .from(students)
          .innerJoin(users, eq(users.linkedId, students.id))
          .where(eq(students.schoolId, schoolId));

        // Add search filter if provided
        if (search && typeof search === 'string') {
          query = query.where(
            sql`${users.name} ILIKE ${`%${search}%`} OR ${users.email} ILIKE ${`%${search}%`}`
          ) as any;
        }

        // Add sorting
        const orderBy = sortOrder === 'desc' ? sql`${users.name} DESC` : sql`${users.name} ASC`;
        const studentsList = await query.orderBy(orderBy);

        // Debug: Log first student to verify roleNumber is being returned
        if (studentsList.length > 0) {
          console.log('📊 Sample student data from query:', JSON.stringify(studentsList[0], null, 2));
          console.log('📊 roleNumber value:', studentsList[0].roleNumber);
          console.log('📊 roleNumber type:', typeof studentsList[0].roleNumber);
          console.log('📊 roleNumber === null?', studentsList[0].roleNumber === null);
          console.log('📊 roleNumber === undefined?', studentsList[0].roleNumber === undefined);
        }

        // Ensure roleNumber is explicitly included in response
        const normalizedStudents = studentsList.map(student => ({
          ...student,
          roleNumber: student.roleNumber || null, // Explicitly set to null if falsy
        }));

        console.log('📊 First normalized student:', JSON.stringify(normalizedStudents[0] || {}, null, 2));

        res.json({
          success: true,
          students: normalizedStudents,
        });
      } catch (error) {
        console.error('❌ Error fetching school students:', error);
        res.status(500).json({ 
          error: { 
            code: 'server_error', 
            message: 'Failed to fetch school students' 
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
