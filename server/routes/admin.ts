import { Express } from 'express';
import { requireAuth, requireRole, requireRoles } from '../middleware/auth';
import { db } from '../db';
import { users, admins, scoutProfiles, systemAdmins, Role } from '../../shared/schema';
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
        // Get all admins from the admins table
        const allAdmins = await db.select({
          id: admins.id,
          name: admins.name,
          email: admins.email,
          role: admins.role,
          xenId: admins.xenId,
          profilePicUrl: admins.profilePicUrl,
          createdAt: admins.createdAt,
        }).from(admins);

        res.json(allAdmins);
      } catch (error) {
        console.error('Get administrators error:', error);
        res.status(500).json({
          error: {
            code: 'fetch_failed',
            message: 'Failed to fetch administrators'
          }
        });
      }
    }
  );
}
