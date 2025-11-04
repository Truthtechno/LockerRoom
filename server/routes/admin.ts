import { Express } from 'express';
import { requireAuth, requireRole, requireRoles } from '../middleware/auth';
import { db } from '../db';
import { users, admins, scoutProfiles, systemAdmins, submissionReviews, Role } from '../../shared/schema';
import { eq, sql, inArray } from 'drizzle-orm';
import bcrypt from 'bcrypt';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';

// Helper function to check if role requires OTP
function requiresOTP(role: Role): boolean {
  return role === 'scout_admin' || role === 'xen_scout';
}

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

export function registerAdminRoutes(app: Express) {
  // Create Administrator (any role)
  app.post('/api/admin/create-admin',
    requireAuth,
    requireRoles(['system_admin']),
    upload.single('profilePic'),
    handleMulterError,
    async (req, res) => {
      try {
        const { name, email, role, xenId, otp } = req.body;
        
        // Validation
        if (!name || !email || !role) {
          return res.status(400).json({ 
            error: { 
              code: 'validation_error', 
              message: 'Name, email, and role are required' 
            } 
          });
        }

        // Validate role
        const validRoles: Role[] = ['system_admin', 'moderator', 'scout_admin', 'xen_scout', 'finance', 'support', 'coach', 'analyst'];
        if (!validRoles.includes(role as Role)) {
          return res.status(400).json({ 
            error: { 
              code: 'validation_error', 
              message: 'Invalid role specified' 
            } 
          });
        }

        // For scout roles, require xenId and otp
        if (requiresOTP(role as Role) && (!xenId || !otp)) {
          return res.status(400).json({ 
            error: { 
              code: 'validation_error', 
              message: 'XEN ID and OTP are required for scout roles' 
            } 
          });
        }

        // Check if email already exists in admins table
        const existingAdmin = await db.select().from(admins).where(eq(admins.email, email)).limit(1);
        if (existingAdmin.length > 0) {
          return res.status(400).json({
            error: {
              code: 'email_exists',
              message: 'An admin with this email already exists'
            }
          });
        }

        // Check if XEN ID already exists (for scout roles)
        if (xenId) {
          const existingXenId = await db.select().from(admins).where(eq(admins.xenId, xenId)).limit(1);
          if (existingXenId.length > 0) {
            return res.status(400).json({
              error: {
                code: 'xen_id_exists',
                message: 'An admin with this XEN ID already exists'
              }
            });
          }
        }

        // Upload profile picture to Cloudinary if provided
        let profilePicUrl = null;
        if (req.file) {
          try {
            const result = await new Promise((resolve, reject) => {
              cloudinary.uploader.upload_stream(
                {
                  resource_type: 'image',
                  folder: 'admin-profiles',
                  transformation: [
                    { width: 400, height: 400, crop: 'fill', gravity: 'face' }
                  ]
                },
                (error, result) => {
                  if (error) reject(error);
                  else resolve(result);
                }
              ).end(req.file.buffer);
            });
            profilePicUrl = (result as any).secure_url;
          } catch (error) {
            console.error('Cloudinary upload error:', error);
            return res.status(500).json({
              error: {
                code: 'upload_failed',
                message: 'Failed to upload profile picture'
              }
            });
          }
        }

        // Create admin in admins table
        const [newAdmin] = await db.insert(admins).values({
          name,
          email,
          role: role as Role,
          profilePicUrl,
          xenId: xenId || null,
          otp: otp || null,
        }).returning();

        // Create corresponding user record for authentication and reviews
        const passwordHash = await bcrypt.hash(otp || 'defaultpassword', 10);
        const [newUser] = await db.insert(users).values({
          name,
          email,
          passwordHash,
          role: role as Role,
          profilePicUrl,
          schoolId: null, // Admins don't belong to schools
          linkedId: newAdmin.id, // Link to admin record
          isOneTimePassword: !!otp, // Mark as OTP if otp is provided
          xenId: xenId || null,
        }).returning();

        // If role is scout_admin or xen_scout, create linked scout profile
        let scoutProfile = null;
        if (requiresOTP(role as Role)) {
          try {
            const [scout] = await db.insert(scoutProfiles).values({
              userId: newUser.id, // Use the actual user ID
              xenId: xenId!,
              name: newAdmin.name,
              profilePicUrl: newAdmin.profilePicUrl,
            }).returning();
            scoutProfile = scout;
          } catch (error) {
            console.error('Failed to create scout profile:', error);
            // If scout profile creation fails, clean up both records
            await db.delete(users).where(eq(users.id, newUser.id));
            await db.delete(admins).where(eq(admins.id, newAdmin.id));
            return res.status(500).json({
              error: {
                code: 'scout_profile_failed',
                message: 'Failed to create scout profile'
              }
            });
          }
        }

        console.log(`🎯 Administrator created: ${newAdmin.name} (Role: ${newAdmin.role})`);

        // Notify scout admins if a new scout was created
        if ((role === 'scout_admin' || role === 'xen_scout') && scoutProfile) {
          const { notifyScoutAdminsOfNewScout } = await import('../utils/notification-helpers');
          notifyScoutAdminsOfNewScout(newUser.id, newUser.name).catch(err => {
            console.error('❌ Failed to notify scout admins (non-critical):', err);
          });
        }

        // Notify system admins about new scouts/admins
        const { notifySystemAdminsOfNewXenScout, notifySystemAdminsOfNewScoutAdmin } = await import('../utils/notification-helpers');
        if (role === 'xen_scout' && xenId) {
          notifySystemAdminsOfNewXenScout(newUser.id, newUser.name, xenId).catch(err => {
            console.error('❌ Failed to notify system admins of new xen scout (non-critical):', err);
          });
        } else if (role === 'scout_admin' && xenId) {
          notifySystemAdminsOfNewScoutAdmin(newUser.id, newUser.name, xenId).catch(err => {
            console.error('❌ Failed to notify system admins of new scout admin (non-critical):', err);
          });
        }

        res.json({
          success: true,
          admin: {
            id: newAdmin.id,
            name: newAdmin.name,
            email: newAdmin.email,
            role: newAdmin.role,
            xenId: newAdmin.xenId,
            profilePicUrl: newAdmin.profilePicUrl,
            createdAt: newAdmin.createdAt,
          },
          user: {
            id: newUser.id,
            name: newUser.name,
            email: newUser.email,
            role: newUser.role,
            linkedId: newUser.linkedId,
          },
          scout: scoutProfile ? {
            id: scoutProfile.id,
            xenId: scoutProfile.xenId,
            otp: scoutProfile.otp,
          } : null,
          otp: otp || null,
          message: "Administrator created successfully"
        });

      } catch (error) {
        console.error('Create admin error:', error);
        res.status(500).json({
          error: {
            code: 'create_failed',
            message: 'Failed to create administrator'
          }
        });
      }
    }
  );

  // Create Scout Admin (legacy route for backward compatibility)
  app.post('/api/admin/create-scout',
    requireAuth,
    requireRoles(['scout_admin']),
    upload.single('profilePic'),
    handleMulterError,
    async (req, res) => {
      try {
        const { name, email, role, xenId, otp } = req.body;
        
        // Validation
        if (!name || !email || !xenId || !otp) {
          return res.status(400).json({ 
            error: { 
              code: 'validation_error', 
              message: 'Name, email, XEN ID, and OTP are required' 
            } 
          });
        }

        // Check if email already exists
        const existingUser = await db.select().from(users).where(eq(users.email, email)).limit(1);
        if (existingUser.length > 0) {
          return res.status(400).json({
            error: {
              code: 'email_exists',
              message: 'A user with this email already exists'
            }
          });
        }

        // Check if XEN ID already exists
        const existingXenId = await db.select().from(users).where(eq(users.xenId, xenId)).limit(1);
        if (existingXenId.length > 0) {
          return res.status(400).json({
            error: {
              code: 'xen_id_exists',
              message: 'A user with this XEN ID already exists'
            }
          });
        }

        // Upload profile picture to Cloudinary if provided
        let profilePicUrl = null;
        if (req.file) {
          try {
            const result = await new Promise((resolve, reject) => {
              cloudinary.uploader.upload_stream(
                {
                  resource_type: 'image',
                  folder: 'scout-profiles',
                  transformation: [
                    { width: 400, height: 400, crop: 'fill', gravity: 'face' }
                  ]
                },
                (error, result) => {
                  if (error) reject(error);
                  else resolve(result);
                }
              ).end(req.file.buffer);
            });
            profilePicUrl = (result as any).secure_url;
          } catch (error) {
            console.error('Cloudinary upload error:', error);
            return res.status(500).json({
              error: {
                code: 'upload_failed',
                message: 'Failed to upload profile picture'
              }
            });
          }
        }

        // Hash the OTP as password
        const passwordHash = await bcrypt.hash(otp, 10);

        // Create user
        const [newUser] = await db.insert(users).values({
          email,
          passwordHash,
          role: role || 'xen_scout',
          linkedId: '', // Will be set after profile creation
          name,
          xenId,
          otp,
          profilePicUrl,
          isOneTimePassword: true,
          emailVerified: false,
        }).returning();

        // Create scout profile
        const [scoutProfile] = await db.insert(scoutProfiles).values({
          userId: newUser.id,
          xenId,
          name,
          profilePicUrl,
        }).returning();

        // Update linkedId to point to the scout profile
        await db.update(users)
          .set({ linkedId: scoutProfile.id })
          .where(eq(users.id, newUser.id));

        console.log(`🎯 Scout Admin created: ${newUser.name} (XEN ID: ${newUser.xenId})`);

        res.json({
          success: true,
          scout: {
            id: newUser.id,
            name: newUser.name,
            email: newUser.email,
            role: newUser.role,
            xenId: newUser.xenId,
            profilePicUrl: newUser.profilePicUrl,
            createdAt: newUser.createdAt,
          },
          otp: otp,
          message: "Scout Admin created successfully with temporary password"
        });

      } catch (error) {
        console.error('Create scout admin error:', error);
        res.status(500).json({
          error: {
            code: 'create_failed',
            message: 'Failed to create scout admin'
          }
        });
      }
    }
  );

  // Get All Administrators List
  app.get('/api/scout-admins',
    requireAuth,
    requireRoles(['system_admin']),
    async (req, res) => {
      try {
        // Get all admins from the admins table with user status
        let adminsFromTable: any[] = [];
        try {
          adminsFromTable = await db.select({
            admin: admins,
            user: {
              id: users.id,
              isFrozen: users.isFrozen,
            }
          })
          .from(admins)
          .leftJoin(users, eq(users.linkedId, admins.id));
          console.log(`📊 Admin Management: Found ${adminsFromTable.length} admins in admins table`);
        } catch (tableError: any) {
          // If admins table doesn't exist, log warning but continue
          if (tableError.message?.includes('does not exist') || tableError.message?.includes('relation') || tableError.code === '42P01') {
            console.warn('⚠️ Admins table may not exist. Run migration: npm run migrate or check database schema.');
          } else {
            throw tableError;
          }
        }

        // Get all admin/scout roles from users table (for scouts created by scout admins)
        // These are admin roles that should be counted: system_admin, scout_admin, xen_scout, moderator, finance, support, coach, analyst
        const adminRoles = ['system_admin', 'scout_admin', 'xen_scout', 'moderator', 'finance', 'support', 'coach', 'analyst'];
        const usersWithAdminRoles = await db.select({
          id: users.id,
          name: users.name,
          email: users.email,
          role: users.role,
          xenId: users.xenId,
          profilePicUrl: users.profilePicUrl,
          createdAt: users.createdAt,
          isFrozen: users.isFrozen,
        })
        .from(users)
        .where(inArray(users.role, adminRoles));
        
        console.log(`📊 Admin Management: Found ${usersWithAdminRoles.length} users with admin roles`);

        // Create a map of emails from admins table to avoid duplicates
        const adminsMap = new Map<string, any>();
        adminsFromTable.forEach(({ admin, user }) => {
          adminsMap.set(admin.email.toLowerCase(), {
            id: admin.id,
            name: admin.name,
            email: admin.email,
            role: admin.role,
            xenId: admin.xenId,
            profilePicUrl: admin.profilePicUrl,
            createdAt: admin.createdAt,
            isFrozen: user?.isFrozen || false,
          });
        });

        // Add users that don't exist in admins table (by email)
        usersWithAdminRoles.forEach(user => {
          const emailKey = user.email.toLowerCase();
          if (!adminsMap.has(emailKey)) {
            // This user exists in users table but not in admins table
            // Add it to the list
            adminsMap.set(emailKey, {
              id: user.id,
              name: user.name,
              email: user.email,
              role: user.role,
              xenId: user.xenId,
              profilePicUrl: user.profilePicUrl,
              createdAt: user.createdAt,
              isFrozen: user.isFrozen || false,
            });
          }
        });

        // Convert map back to array and sort by creation date
        const allAdmins = Array.from(adminsMap.values()).sort((a, b) => 
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );

        console.log(`📊 Admin Management: Found ${allAdmins.length} total admins (${adminsFromTable.length} from admins table, ${usersWithAdminRoles.length} from users table, ${allAdmins.length - adminsFromTable.length} unique from users)`);

        res.json(allAdmins);
      } catch (error) {
        console.error('❌ Get administrators error:', error);
        console.error('Error details:', error instanceof Error ? error.stack : error);
        res.status(500).json({
          error: {
            code: 'fetch_failed',
            message: 'Failed to fetch administrators',
            details: error instanceof Error ? error.message : String(error)
          }
        });
      }
    }
  );

  // Disable/Enable Admin Account
  app.put('/api/admin/:adminId/disable',
    requireAuth,
    requireRoles(['system_admin']),
    async (req, res) => {
      try {
        const { adminId } = req.params;
        
        console.log(`🚫 Disabling admin account: ${adminId}`);
        
        // Find admin in admins table
        const [admin] = await db.select().from(admins).where(eq(admins.id, adminId));
        
        // Also check users table in case admin was created by scout admin
        const [user] = await db.select().from(users)
          .where(eq(users.id, adminId));
        
        if (!admin && !user) {
          return res.status(404).json({ 
            error: { 
              code: 'admin_not_found', 
              message: 'Admin not found' 
            } 
          });
        }

        // Find the corresponding user record if admin exists in admins table
        let userToDisable = user;
        if (admin) {
          const [linkedUser] = await db.select().from(users)
            .where(eq(users.linkedId, admin.id))
            .limit(1);
          if (linkedUser) {
            userToDisable = linkedUser;
          }
        }

        if (!userToDisable) {
          return res.status(404).json({ 
            error: { 
              code: 'user_not_found', 
              message: 'User account not found for this admin' 
            } 
          });
        }

        // Prevent disabling self
        const currentUser = (req as any).user;
        if (currentUser?.id === userToDisable.id) {
          return res.status(400).json({ 
            error: { 
              code: 'cannot_disable_self', 
              message: 'You cannot disable your own account' 
            } 
          });
        }

        // Freeze the user account
        await db.update(users)
          .set({ 
            isFrozen: true,
          })
          .where(eq(users.id, userToDisable.id));

        console.log(`✅ Admin disabled: ${userToDisable.name} (${userToDisable.email})`);

        res.json({
          success: true,
          message: `Admin account "${userToDisable.name}" has been disabled. They will not be able to log in.`
        });
      } catch (error) {
        console.error('Error disabling admin:', error);
        res.status(500).json({
          error: {
            code: 'disable_failed',
            message: 'Failed to disable admin account'
          }
        });
      }
    }
  );

  // Enable Admin Account
  app.put('/api/admin/:adminId/enable',
    requireAuth,
    requireRoles(['system_admin']),
    async (req, res) => {
      try {
        const { adminId } = req.params;
        
        console.log(`✅ Enabling admin account: ${adminId}`);
        
        // Find admin in admins table
        const [admin] = await db.select().from(admins).where(eq(admins.id, adminId));
        
        // Also check users table in case admin was created by scout admin
        const [user] = await db.select().from(users)
          .where(eq(users.id, adminId));
        
        if (!admin && !user) {
          return res.status(404).json({ 
            error: { 
              code: 'admin_not_found', 
              message: 'Admin not found' 
            } 
          });
        }

        // Find the corresponding user record if admin exists in admins table
        let userToEnable = user;
        if (admin) {
          const [linkedUser] = await db.select().from(users)
            .where(eq(users.linkedId, admin.id))
            .limit(1);
          if (linkedUser) {
            userToEnable = linkedUser;
          }
        }

        if (!userToEnable) {
          return res.status(404).json({ 
            error: { 
              code: 'user_not_found', 
              message: 'User account not found for this admin' 
            } 
          });
        }

        // Unfreeze the user account
        await db.update(users)
          .set({ 
            isFrozen: false,
          })
          .where(eq(users.id, userToEnable.id));

        console.log(`✅ Admin enabled: ${userToEnable.name} (${userToEnable.email})`);

        res.json({
          success: true,
          message: `Admin account "${userToEnable.name}" has been enabled. They can now log in again.`
        });
      } catch (error) {
        console.error('Error enabling admin:', error);
        res.status(500).json({
          error: {
            code: 'enable_failed',
            message: 'Failed to enable admin account'
          }
        });
      }
    }
  );

  // Delete Admin Account
  app.delete('/api/admin/:adminId',
    requireAuth,
    requireRoles(['system_admin']),
    async (req, res) => {
      try {
        const { adminId } = req.params;
        
        console.log(`🗑️ Deleting admin account: ${adminId}`);
        
        // Find admin in admins table
        const [admin] = await db.select().from(admins).where(eq(admins.id, adminId));
        
        // Also check users table in case admin was created by scout admin
        const [user] = await db.select().from(users)
          .where(eq(users.id, adminId));
        
        if (!admin && !user) {
          return res.status(404).json({ 
            error: { 
              code: 'admin_not_found', 
              message: 'Admin not found' 
            } 
          });
        }

        // Find the corresponding user record
        let userToDelete = user;
        if (admin) {
          const [linkedUser] = await db.select().from(users)
            .where(eq(users.linkedId, admin.id))
            .limit(1);
          if (linkedUser) {
            userToDelete = linkedUser;
          }
        }

        // Prevent deleting self
        const currentUser = (req as any).user;
        if (userToDelete && currentUser?.id === userToDelete.id) {
          return res.status(400).json({ 
            error: { 
              code: 'cannot_delete_self', 
              message: 'You cannot delete your own account' 
            } 
          });
        }

        const adminName = userToDelete?.name || admin?.name || 'Unknown';
        const adminEmail = userToDelete?.email || admin?.email || 'Unknown';

        // Delete submission reviews if it's a scout
        if (userToDelete && (userToDelete.role === 'xen_scout' || userToDelete.role === 'scout_admin')) {
          await db.delete(submissionReviews)
            .where(eq(submissionReviews.scoutId, userToDelete.id));
          
          // Delete scout profile if exists
          const [scoutProfile] = await db.select().from(scoutProfiles)
            .where(eq(scoutProfiles.userId, userToDelete.id))
            .limit(1);
          
          if (scoutProfile) {
            await db.delete(scoutProfiles).where(eq(scoutProfiles.id, scoutProfile.id));
          }
        }

        // Delete user account
        if (userToDelete) {
          await db.delete(users).where(eq(users.id, userToDelete.id));
        }

        // Delete admin record if exists
        if (admin) {
          await db.delete(admins).where(eq(admins.id, admin.id));
        }

        console.log(`✅ Admin deleted: ${adminName} (${adminEmail})`);

        res.json({
          success: true,
          message: `Admin account "${adminName}" has been permanently deleted.`
        });
      } catch (error) {
        console.error('Error deleting admin:', error);
        res.status(500).json({
          error: {
            code: 'delete_failed',
            message: 'Failed to delete admin account'
          }
        });
      }
    }
  );
}
