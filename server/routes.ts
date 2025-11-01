import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { v2 as cloudinary } from "cloudinary";
import { storage } from "./storage";
import { authStorage } from "./auth-storage";
import Stripe from 'stripe';
import { requireAuth, requireSelfByParam, requireScoutAdmin, requireScoutOrAdmin, requireSystemAdmin } from "./middleware/auth";
import uploadRoutes from "./routes/upload";
import xenWatchRoutes from "./routes/xen-watch";
import { registerScoutAdminRoutes } from "./routes/scout-admin";
import { notifyFollowersOfNewPost, notifyScoutAdminsOfNewScout } from "./utils/notification-helpers";
import { 
  insertUserSchema, 
  insertPostSchema, 
  insertPostCommentSchema,
  insertStudentFollowerSchema,
  insertSchoolApplicationSchema,
  insertSystemSettingSchema,
  insertSystemBrandingSchema,
  insertSystemAppearanceSchema,
  insertSystemPaymentSchema,
  insertAdminRoleSchema,
  insertAnalyticsLogSchema,
  insertStudentSchema,
  insertStudentRatingSchema,
  insertSchoolSettingSchema,
  insertNotificationSchema,
  users,
  students,
  schoolAdmins,
  systemAdmins,
  admins,
  viewers,
  posts,
  savedPosts,
  postLikes,
  postComments,
  postViews,
  schools,
  studentFollowers
} from "@shared/schema";
import type { PostWithDetails } from "@shared/schema";
import { eq, desc, sql, and, or, isNull, inArray } from 'drizzle-orm';
import { db } from './db';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Configure multer for file uploads
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
});

// JWT secret
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key-change-in-production';

// Stripe configuration
const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

// Database connection is now handled by ./db.ts

// Self access middleware for backward compatibility
const requireSelfAccess = requireSelfByParam('userId');

// Middleware to check user role
const requireRole = (allowedRoles: string[]) => {
  return (req: any, res: any, next: any) => {
    const userRole = (req as any).auth?.role || req.user?.role;
    if (!userRole || !allowedRoles.includes(userRole)) {
      return res.status(403).json({ 
        error: { 
          code: "insufficient_permissions", 
          message: 'Insufficient permissions' 
        } 
      });
    }
    next();
  };
};

// Input validation and sanitization middleware
const validateInput = (req: any, res: any, next: any) => {
  // Sanitize string inputs to prevent XSS
  const sanitizeString = (str: string) => {
    if (typeof str !== 'string') return str;
    return str
      .replace(/[<>]/g, '') // Remove potential HTML tags
      .trim()
      .substring(0, 1000); // Limit length
  };

  // Sanitize all string fields in body
  if (req.body && typeof req.body === 'object') {
    for (const key in req.body) {
      if (typeof req.body[key] === 'string') {
        req.body[key] = sanitizeString(req.body[key]);
      }
    }
  }

  // Sanitize query parameters
  if (req.query && typeof req.query === 'object') {
    for (const key in req.query) {
      if (typeof req.query[key] === 'string') {
        req.query[key] = sanitizeString(req.query[key]);
      }
    }
  }

  next();
};

// Rate limiting middleware (simple in-memory implementation)
const rateLimitMap = new Map();
const rateLimit = (maxRequests: number, windowMs: number) => {
  return (req: any, res: any, next: any) => {
    // Skip rate limiting entirely in development
    if (process.env.NODE_ENV !== 'production') {
      console.log('🔐 Rate limiting skipped in development for:', req.path);
      return next();
    }
    
    const key = req.ip || req.connection.remoteAddress || 'unknown';
    const now = Date.now();
    const windowStart = now - windowMs;
    
    if (!rateLimitMap.has(key)) {
      rateLimitMap.set(key, []);
    }
    
    const requests = rateLimitMap.get(key);
    const validRequests = requests.filter((time: number) => time > windowStart);
    
    if (validRequests.length >= maxRequests) {
      console.log('🔐 Rate limit exceeded for IP:', key, 'requests:', validRequests.length);
      return res.status(429).json({ 
        error: { 
          code: "rate_limit_exceeded", 
          message: 'Too many requests, please try again later' 
        } 
      });
    }
    
    validRequests.push(now);
    rateLimitMap.set(key, validRequests);
    next();
  };
};

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Apply validation middleware to all routes
  app.use(validateInput);
  
  // Apply rate limiting to auth routes
  app.use("/api/auth", rateLimit(5, 15 * 60 * 1000)); // 5 requests per 15 minutes
  
  // Upload routes
  app.use("/api/upload", uploadRoutes);
  app.use("/api/xen-watch", xenWatchRoutes);

  // Text-only post creation
  app.post("/api/posts", requireAuth, async (req, res) => {
    try {
      const { caption, studentId } = req.body;
      const userId = (req as any).auth?.id;

      if (!caption || !studentId) {
        return res.status(400).json({ error: "Caption and studentId are required" });
      }

      // Verify the student belongs to the authenticated user
      const student = await storage.getStudent(studentId);
      if (!student || student.userId !== userId) {
        return res.status(403).json({ error: "Unauthorized to create post for this student" });
      }

      const post = await storage.insertPost({
        studentId,
        mediaUrl: '', // No media for text-only posts
        mediaType: 'text',
        caption,
        status: 'ready'
      });

      // Create notifications for users who follow this student
      if (post && post.studentId) {
        notifyFollowersOfNewPost(post.id, post.studentId).catch(err => {
          console.error('❌ Failed to notify followers (non-critical):', err);
        });
      }

      // Return the full post with details for optimistic updates
      const postWithDetails = await storage.getPostWithUserContext(post.id, userId);
      res.json(postWithDetails);
    } catch (error: any) {
      console.error('Text post creation error:', error);
      res.status(500).json({ error: error.message || "Failed to create post" });
    }
  });

  // Cloudinary webhook for processing completion
  app.post("/api/webhooks/cloudinary", async (req, res) => {
    try {
      const { notification_type, public_id, resource_type, eager } = req.body;
      
      console.log('🔔 Cloudinary webhook received:', {
        notification_type,
        public_id,
        resource_type,
        eager: eager?.length || 0
      });

      if (notification_type === 'eager') {
        // Find post by cloudinaryPublicId
        const posts = await storage.getPosts();
        const post = posts.find(p => p.cloudinaryPublicId === public_id);
        
        if (post) {
          // Update post status to ready
          await storage.updatePost(post.id, {
            status: 'ready'
          });
          
          // Post is now ready, notify followers
          if (post.studentId) {
            notifyFollowersOfNewPost(post.id, post.studentId).catch(err => {
              console.error('❌ Failed to notify followers after webhook (non-critical):', err);
            });
          }
          
          console.log(`✅ Post ${post.id} marked as ready`);
          
          // Invalidate cache to trigger UI updates
          // This would typically be done through a real-time system like WebSockets
          // For now, we'll just log it
        }
      }
      
      res.status(200).json({ received: true });
    } catch (error) {
      console.error('Cloudinary webhook error:', error);
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  });
  
  // Authentication routes
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      
      console.log('🔐 Login attempt:', { 
        email, 
        hasPassword: !!password, 
        passwordLength: password?.length || 0,
        timestamp: new Date().toISOString()
      });
      
      if (!email || !password) {
        console.log('🔐 Login failed: Missing email or password');
        return res.status(400).json({ 
          error: { 
            code: "missing_fields", 
            message: "Email and password required" 
          } 
        });
      }

      // ===== ADMIN AUTHENTICATION =====
      console.log('🔐 Attempting admin authentication for:', email);
      
      // Try admin OTP verification first (for scout roles and new admins)
      const adminOTPResult = await authStorage.verifyAdminOTP(email, password);
      if (adminOTPResult) {
        const { admin, requiresPasswordReset } = adminOTPResult;

        // For scout roles, find the corresponding user record
        let userId = admin.id;
        let linkedId = admin.id;
        
        if (['scout_admin', 'xen_scout'].includes(admin.role)) {
          const userResult = await db.select({ id: users.id })
            .from(users)
            .where(eq(users.linkedId, admin.id))
            .limit(1);
          
          if (userResult.length > 0) {
            userId = userResult[0].id;
            linkedId = admin.id;
          }
        }

        // Generate JWT token for admin
        const tokenPayload: any = {
          id: userId,
          email: admin.email,
          role: admin.role,
          schoolId: null, // Admins don't have schoolId
          linkedId: linkedId // Use admin ID as linkedId
        };

        const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '7d' });

        console.log('🔐 Admin OTP Login successful:', {
          adminId: admin.id,
          email: admin.email,
          role: admin.role,
          requiresPasswordReset
        });

        return res.json({
          token,
          user: {
            id: userId,
            email: admin.email,
            role: admin.role,
            schoolId: null,
            is_one_time_password: requiresPasswordReset
          },
          profile: {
            id: admin.id,
            name: admin.name,
            email: admin.email,
            role: admin.role,
            profilePicUrl: admin.profilePicUrl,
            xenId: admin.xenId
          },
          requiresPasswordReset
        });
      }

      // Try admin password verification (for system_admin and other roles)
      const adminResult = await authStorage.verifyAdminPassword(email, password);
      if (adminResult) {
        const admin = adminResult;

        // For scout roles, find the corresponding user record
        let userId = admin.id;
        let linkedId = admin.id;
        
        if (['scout_admin', 'xen_scout'].includes(admin.role)) {
          const userResult = await db.select({ id: users.id })
            .from(users)
            .where(eq(users.linkedId, admin.id))
            .limit(1);
          
          if (userResult.length > 0) {
            userId = userResult[0].id;
            linkedId = admin.id;
          }
        }

        // Generate JWT token for admin
        const tokenPayload: any = {
          id: userId,
          email: admin.email,
          role: admin.role,
          schoolId: null, // Admins don't have schoolId
          linkedId: linkedId // Use admin ID as linkedId
        };

        const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '7d' });

        console.log('🔐 Admin password login successful:', {
          adminId: admin.id,
          email: admin.email,
          role: admin.role
        });

        return res.json({
          token,
          user: {
            id: userId,
            email: admin.email,
            role: admin.role,
            schoolId: null,
            is_one_time_password: false
          },
          profile: {
            id: admin.id,
            name: admin.name,
            email: admin.email,
            role: admin.role,
            profilePicUrl: admin.profilePicUrl,
            xenId: admin.xenId
          }
        });
      }

      // ===== REGULAR USER AUTHENTICATION =====
      console.log('🔐 Attempting regular user authentication for:', email);

      // Try OTP verification first (for new students)
      console.log('🔐 Attempting OTP verification for:', email);
      const otpResult = await authStorage.verifyOTP(email, password);
      
      if (otpResult) {
        const { user, profile, requiresPasswordReset } = otpResult;

        // Validate linkedId is present for roles that require it
        const rolesRequiringLinkedId = ['student', 'school_admin', 'system_admin', 'viewer', 'public_viewer'];
        if (rolesRequiringLinkedId.includes(user.role) && !user.linkedId) {
          console.error('🔐 OTP Login failed: Missing linkedId for user:', user.id, 'role:', user.role);
          return res.status(500).json({ 
            error: { 
              code: "missing_linkedId", 
              message: "User profile link is missing. Please contact support." 
            } 
          });
        }

        // Generate JWT token with required fields
        const tokenPayload: any = {
          id: user.id,
          email: user.email,
          role: user.role,
          schoolId: user.schoolId || null,
          linkedId: user.linkedId || null // Include linkedId from database
        };

        const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '7d' });

        console.log('🔐 OTP Login successful:', {
          userId: user.id,
          email: user.email,
          role: user.role,
          requiresPasswordReset,
          schoolId: user.schoolId
        });

        return res.json({
          token,
          user: {
            id: user.id,
            email: user.email,
            role: user.role,
            schoolId: user.schoolId || null,
            is_one_time_password: user.isOneTimePassword || false
          },
          profile,
          requiresPasswordReset
        });
      }

      // Fallback to regular password verification
      console.log('🔐 Attempting regular password verification for:', email);
      const result = await authStorage.verifyPassword(email, password);
      
      if (!result) {
        console.log('🔐 Login failed: Invalid credentials for:', email);
        return res.status(401).json({ 
          error: { 
            code: "invalid_credentials", 
            message: "Invalid credentials" 
          } 
        });
      }

      const { user, profile } = result;
      
      // Validate linkedId is present for roles that require it
      const rolesRequiringLinkedId = ['student', 'school_admin', 'system_admin', 'viewer', 'public_viewer'];
      if (rolesRequiringLinkedId.includes(user.role) && !user.linkedId) {
        console.error('🔐 Login failed: Missing linkedId for user:', user.id, 'role:', user.role);
        return res.status(500).json({ 
          error: { 
            code: "missing_linkedId", 
            message: "User profile link is missing. Please contact support." 
          } 
        });
      }
      
      // Generate JWT token with required fields
      const tokenPayload: any = { 
        id: user.id, 
        email: user.email, 
        role: user.role, 
        schoolId: user.schoolId || null,
        linkedId: user.linkedId || null // Include linkedId from database
      };
      
      const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '7d' });
      
      console.log('🔐 Regular login successful:', { 
        userId: user.id, 
        email: user.email, 
        role: user.role,
        schoolId: user.schoolId
      });
      
      // Return user and profile data separately to avoid ID collision
      res.json({ 
        token,
        user: { 
          id: user.id, 
          email: user.email, 
          role: user.role,
          schoolId: user.schoolId || null,
          is_one_time_password: user.isOneTimePassword || false
        },
        profile
      });
    } catch (error) {
      console.error('🔐 Login error:', error);
      res.status(500).json({ 
        error: { 
          code: "login_failed", 
          message: "Login failed" 
        } 
      });
    }
  });

  // Password reset endpoint for OTP users
  app.post("/api/auth/reset-password", async (req, res) => {
    try {
      const { password } = req.body;
      
      console.log('🔐 Reset password request received:', { 
        hasPassword: !!password, 
        passwordLength: password?.length || 0,
        hasAuthHeader: !!req.headers.authorization 
      });
      
      // Read Authorization header
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        console.log('🔐 Reset password failed: Missing or invalid Authorization header');
        return res.status(401).json({ 
          error: { 
            code: "authentication_required", 
            message: "Authentication required. Please provide a valid token." 
          } 
        });
      }
      
      const token = authHeader.replace('Bearer ', '');
      
      // Verify JWT token
      let decoded: any;
      try {
        decoded = jwt.verify(token, JWT_SECRET);
        console.log('🔐 JWT token verified successfully:', { 
          userId: decoded.id, 
          email: decoded.email, 
          role: decoded.role 
        });
      } catch (error: any) {
        console.log('🔐 JWT verification failed:', error.name, error.message);
        if (error.name === 'TokenExpiredError') {
          return res.status(401).json({ 
            error: { 
              code: "token_expired", 
              message: "Session expired. Please log in again." 
            } 
          });
        } else if (error.name === 'JsonWebTokenError') {
          return res.status(401).json({ 
            error: { 
              code: "invalid_token", 
              message: "Invalid token. Please log in again." 
            } 
          });
        } else {
          return res.status(401).json({ 
            error: { 
              code: "authentication_failed", 
              message: "Authentication failed. Please log in again." 
            } 
          });
        }
      }
      
      // Extract user ID from JWT payload
      const userId = decoded.id;
      if (!userId) {
        console.log('🔐 Reset password failed: Missing user ID in token');
        return res.status(401).json({ 
          error: { 
            code: "invalid_token", 
            message: "Invalid token structure" 
          } 
        });
      }
      
      if (!password) {
        console.log('🔐 Reset password failed: Missing password');
        return res.status(400).json({ 
          error: { 
            code: "missing_fields", 
            message: "Password is required" 
          } 
        });
      }

      if (password.length < 6) {
        console.log('🔐 Reset password failed: Password too short');
        return res.status(400).json({ 
          error: { 
            code: "weak_password", 
            message: "Password must be at least 6 characters long" 
          } 
        });
      }

      console.log('🔐 Attempting password reset for user:', userId, 'role:', decoded.role);

      // Check if this is an admin user
      const isAdminRole = ['system_admin', 'moderator', 'scout_admin', 'xen_scout', 'finance', 'support', 'coach', 'analyst'].includes(decoded.role);
      
      let success = false;
      if (isAdminRole) {
        // Use admin password reset
        success = await authStorage.resetAdminPassword(userId, password);
        console.log('🔐 Admin password reset result:', success);
      } else {
        // Use regular user password reset
        success = await authStorage.resetPassword(userId, password);
        console.log('🔐 User password reset result:', success);
      }
      
      if (!success) {
        console.log('🔐 Reset password failed: Database update failed for user:', userId);
        return res.status(500).json({ 
          error: { 
            code: "reset_failed", 
            message: "Failed to reset password" 
          } 
        });
      }

      console.log('🔐 Password reset completed successfully for user:', userId, 'role:', decoded.role);

      res.json({ 
        ok: true
      });
    } catch (error) {
      console.error('🔐 Password reset error:', error);
      res.status(500).json({ 
        error: { 
          code: "reset_failed", 
          message: "Failed to reset password" 
        } 
      });
    }
  });

  // Forgot password endpoint (no authentication required)
  app.post("/api/auth/forgot-password", async (req, res) => {
    try {
      const { email, newPassword } = req.body;
      
      console.log('🔐 Forgot password request received:', { 
        email, 
        hasNewPassword: !!newPassword, 
        passwordLength: newPassword?.length || 0
      });
      
      if (!email || !newPassword) {
        console.log('🔐 Forgot password failed: Missing email or new password');
        return res.status(400).json({ 
          error: { 
            code: "missing_fields", 
            message: "Email and new password are required" 
          } 
        });
      }

      if (newPassword.length < 6) {
        console.log('🔐 Forgot password failed: Password too short');
        return res.status(400).json({ 
          error: { 
            code: "weak_password", 
            message: "Password must be at least 6 characters long" 
          } 
        });
      }

      // Check if user exists in the users table
      const user = await db.select().from(users).where(eq(users.email, email)).limit(1);
      
      if (user.length === 0) {
        console.log('🔐 Forgot password failed: User not found for email:', email);
        return res.status(404).json({ 
          error: { 
            code: "user_not_found", 
            message: "No account found with this email address" 
          } 
        });
      }

      // Hash the new password
      const passwordHash = await bcrypt.hash(newPassword, 10);
      
      // Update the user's password_hash
      await db.update(users)
        .set({ passwordHash })
        .where(eq(users.id, user[0].id));

      console.log('🔐 Password reset completed successfully for user:', user[0].id, 'email:', email);

      // Fix linkedId if it's broken
      const linkedIdFixed = await authStorage.fixLinkedId(user[0].id);
      if (linkedIdFixed) {
        console.log('🔐 LinkedId fixed during forgot password reset for user:', user[0].id);
      } else {
        console.log('🔐 LinkedId fix failed during forgot password reset for user:', user[0].id, '- user may need manual profile setup');
      }

      res.json({ 
        success: true,
        message: "Password has been reset successfully"
      });
    } catch (error) {
      console.error('🔐 Forgot password error:', error);
      res.status(500).json({ 
        error: { 
          code: "reset_failed", 
          message: "Failed to reset password. Please try again." 
        } 
      });
    }
  });

  // Alias route for register -> signup (for backward compatibility)
  app.post("/api/auth/register", async (req, res) => {
    try {
      const { email, password, name } = req.body;
      
      if (!email || !password || !name) {
        return res.status(400).json({ 
          error: { 
            code: "missing_fields", 
            message: "Email, password, and name are required" 
          } 
        });
      }
      
      const existingUser = await authStorage.getUserByEmail(email);
      
      if (existingUser) {
        return res.status(409).json({ 
          error: { 
            code: "email_taken", 
            message: "Email already registered" 
          } 
        });
      }

      const { user, profile } = await authStorage.createUserWithProfile(
        email, 
        password, 
        'viewer', 
        { name }
      );
      
      // Generate JWT token with schoolId for school admins
      const tokenPayload: any = { 
        id: user.id, 
        email: user.email, 
        role: user.role, 
        linkedId: user.linkedId 
      };
      
      // Add schoolId for school admins
      if (user.role === 'school_admin' && (profile as any).schoolId) {
        tokenPayload.schoolId = (profile as any).schoolId;
      }
      
      const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '7d' });
      
      res.json({ 
        token,
        user: { 
          id: user.id, 
          email: user.email, 
          role: user.role,
          linkedId: user.linkedId
        },
        profile,
        message: "Account created successfully! You can now search and follow student athletes."
      });
    } catch (error) {
      console.error('Register error:', error);
      res.status(400).json({ 
        error: { 
          code: "signup_failed", 
          message: "Registration failed. Please check your information." 
        } 
      });
    }
  });

  // User routes
  // Get current user info with unified profilePicUrl
  app.get("/api/users/me", requireAuth, async (req, res) => {
    try {
      const auth = req.user || (req as any).auth;
      const userId = auth.id;
      const jwtSchoolId = auth.schoolId;
      
      console.log('🔍 /api/users/me - Auth object:', { id: auth.id, role: auth.role, schoolId: auth.schoolId });
      
      // Validate userId before querying
      if (!userId || typeof userId !== 'string') {
        console.error('❌ Invalid userId:', userId);
        return res.status(400).json({ 
          error: { 
            code: "invalid_user_id", 
            message: "Invalid user ID" 
          } 
        });
      }
      
      // Get user data with schoolId from database, with JWT fallback
      let userResult = await db.select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        schoolId: users.schoolId,
        linkedId: users.linkedId, // This maps to linked_id column
        profilePicUrl: users.profilePicUrl
      })
      .from(users)
      .where(eq(users.id, userId));
      
      console.log('🔍 /api/users/me - Database query result:', {
        resultCount: userResult.length,
        userId: userId
      });
      
      // If user not found in users table, check admins table
      if (!userResult || userResult.length === 0) {
        console.log('🔍 User not found in users table, checking admins table...');
        const adminResult = await db.select({
          id: admins.id,
          name: admins.name,
          email: admins.email,
          role: admins.role,
          schoolId: sql`NULL`, // Admins don't have schoolId
          linkedId: sql`NULL`, // Admins don't have linkedId
          profilePicUrl: admins.profilePicUrl
        })
        .from(admins)
        .where(eq(admins.id, userId));
        
        console.log('🔍 /api/users/me - Admin query result:', {
          resultCount: adminResult.length,
          userId: userId
        });
        
        if (!adminResult || adminResult.length === 0) {
          console.error('❌ User not found in database:', userId);
          return res.status(404).json({ 
            error: { 
              code: "user_not_found", 
              message: "User not found" 
            } 
          });
        }
        
        userResult = adminResult;
      }
      
      const user = userResult[0];

      // Use database schoolId if available, otherwise fallback to JWT schoolId
      const finalSchoolId = user.schoolId || jwtSchoolId;
      
      console.log('🔍 /api/users/me - Final schoolId:', { 
        dbSchoolId: user.schoolId, 
        jwtSchoolId: jwtSchoolId, 
        finalSchoolId: finalSchoolId 
      });

      // Get profile picture URL based on role
      let profilePicUrl = null;
      let coverPhoto = null;
      
      // Handle profile picture fetching based on role
      // Order matters: check specific roles first, then general admin roles
      if (user.role === 'system_admin') {
        // System admin profile is in systemAdmins table, linked via linkedId
        const systemAdminResult = await db.select({
          profilePicUrl: systemAdmins.profilePicUrl
        })
        .from(systemAdmins)
        .where(eq(systemAdmins.id, user.linkedId)) // user.linkedId maps to linked_id column
        .limit(1);
        
        if (systemAdminResult[0]) {
          profilePicUrl = systemAdminResult[0].profilePicUrl;
        }
        console.log('🔍 System admin profile picture:', { role: user.role, linkedId: user.linkedId, profilePicUrl });
      } else if (user.role === 'school_admin') {
        // School admin profile is in schoolAdmins table, linked via linkedId
        const adminResult = await db.select({
          profilePicUrl: schoolAdmins.profilePicUrl
        })
        .from(schoolAdmins)
        .where(eq(schoolAdmins.id, user.linkedId)) // user.linkedId maps to linked_id column
        .limit(1);
        
        if (adminResult[0]) {
          profilePicUrl = adminResult[0].profilePicUrl;
        }
        console.log('🔍 School admin profile picture:', { role: user.role, linkedId: user.linkedId, profilePicUrl });
      } else if (user.role === 'student') {
        const studentProfile = await storage.getStudentByUserId(userId);
        profilePicUrl = studentProfile?.profilePicUrl || studentProfile?.profilePic || null;
        coverPhoto = studentProfile?.coverPhoto || null;
        console.log('🔍 Student profile picture:', { role: user.role, profilePicUrl });
      } else if (user.role === 'viewer' || user.role === 'public_viewer') {
        // Viewer profile is in viewers table, linked via linkedId
        const viewerResult = await db.select({
          profilePicUrl: viewers.profilePicUrl
        })
        .from(viewers)
        .where(eq(viewers.id, user.linkedId)) // user.linkedId maps to linked_id column
        .limit(1);
        
        if (viewerResult[0]) {
          profilePicUrl = viewerResult[0].profilePicUrl;
        }
        console.log('🔍 Viewer profile picture:', { role: user.role, linkedId: user.linkedId, profilePicUrl });
      } else if (['scout_admin', 'xen_scout'].includes(user.role)) {
        // Scout roles: profile picture is stored in admins table using linkedId
        const adminResult = await db.select({
          profilePicUrl: admins.profilePicUrl
        })
        .from(admins)
        .where(eq(admins.id, user.linkedId)) // Use linkedId to find admin record
        .limit(1);
        
        if (adminResult[0]) {
          profilePicUrl = adminResult[0].profilePicUrl;
        }
        console.log('🔍 Scout admin profile picture:', { role: user.role, linkedId: user.linkedId, profilePicUrl });
      } else if (['moderator', 'finance', 'support', 'coach', 'analyst'].includes(user.role)) {
        // Other admin roles: get profile picture from admins table using userId
        const adminResult = await db.select({
          profilePicUrl: admins.profilePicUrl
        })
        .from(admins)
        .where(eq(admins.id, userId))
        .limit(1);
        
        if (adminResult[0]) {
          profilePicUrl = adminResult[0].profilePicUrl;
        }
        console.log('🔍 Admin profile picture:', { role: user.role, userId, profilePicUrl });
      } else {
        console.log('⚠️ Unknown role for profile picture:', user.role);
      }

      const responseData = {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        schoolId: finalSchoolId,
        linkedId: user.linkedId,
        profilePicUrl,
        coverPhoto
      };
      
      console.log('✅ /api/users/me - Returning user data:', {
        id: responseData.id,
        role: responseData.role,
        schoolId: responseData.schoolId,
        profilePicUrl: responseData.profilePicUrl
      });

      // Return user data with unified profilePicUrl
      res.json(responseData);
    } catch (error) {
      console.error('❌ Get current user error:', error);
      res.status(500).json({ 
        error: { 
          code: "server_error", 
          message: "Failed to fetch user" 
        } 
      });
    }
  });

  app.get("/api/users/me/:userId", requireAuth, requireSelfAccess, async (req, res) => {
    try {
      const { userId } = req.params;
      const profile = await authStorage.getUserProfile(userId);
      
      if (!profile) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json(profile);
    } catch (error) {
      console.error('Get user profile error:', error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Simple profile update endpoint (no file upload)
  app.put("/api/profile/update", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).auth.id;
      const { fullName, phoneNumber, bio, ...otherData } = req.body;
      
      // Get current user profile to determine role
      const currentProfile = await authStorage.getUserProfile(userId);
      if (!currentProfile) {
        return res.status(404).json({ 
          error: { 
            code: "user_not_found", 
            message: "User not found" 
          } 
        });
      }
      
      // Prepare update data
      let updateData: any = {
        name: fullName,
        phone: phoneNumber,
        bio: bio,
        ...otherData
      };
      
      // Update profile using auth storage
      const updatedProfile = await authStorage.updateUserProfile(userId, currentProfile.role, updateData);
      
      if (!updatedProfile) {
        return res.status(500).json({ 
          error: { 
            code: "update_failed", 
            message: "Failed to update profile" 
          } 
        });
      }

      res.json({
        success: true,
        profile: updatedProfile,
        message: "Profile updated successfully"
      });
    } catch (error) {
      console.error('Update profile error:', error);
      res.status(500).json({ 
        error: { 
          code: "update_failed", 
          message: "Failed to update profile" 
        } 
      });
    }
  });

  // Profile update with photo upload endpoint
  app.put("/api/profile/update-with-photo", requireAuth, upload.single("profilePhoto"), async (req, res) => {
    try {
      const userId = (req as any).auth.id;
      const { fullName, phoneNumber, bio, ...otherData } = req.body;
      
      // Get current user profile to determine role
      const currentProfile = await authStorage.getUserProfile(userId);
      if (!currentProfile) {
        return res.status(404).json({ 
          error: { 
            code: "user_not_found", 
            message: "User not found" 
          } 
        });
      }
      
      // Prepare update data
      let updateData: any = {
        name: fullName,
        phone: phoneNumber,
        bio: bio,
        ...otherData
      };
      
      // Handle profile photo upload to Cloudinary
      if (req.file) {
        // Validate file type
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        if (!allowedTypes.includes(req.file.mimetype)) {
          return res.status(400).json({ 
            error: { 
              code: "invalid_file_type", 
              message: "Only JPEG, PNG, GIF, and WebP images are allowed" 
            } 
          });
        }
        
        // Validate file size (5MB limit)
        const maxSize = 5 * 1024 * 1024; // 5MB
        if (req.file.size > maxSize) {
          return res.status(400).json({ 
            error: { 
              code: "file_too_large", 
              message: "File size must be less than 5MB" 
            } 
          });
        }
        
        const result = await new Promise((resolve, reject) => {
          cloudinary.uploader.upload_stream(
            { 
              resource_type: "image",
              folder: `${currentProfile.role}-profiles`,
              transformation: [
                { width: 400, height: 400, crop: "fill", gravity: "face" },
                { quality: "auto:good" },
                { format: "auto" } // Auto-optimize format
              ],
              eager: [
                { width: 200, height: 200, crop: "fill", quality: "auto:good" },
                { width: 100, height: 100, crop: "fill", quality: "auto:good" }
              ],
              eager_async: true
            },
            (error, result) => {
              if (error) reject(error);
              else resolve(result);
            }
          ).end(req.file!.buffer);
        });

        updateData.profilePicUrl = (result as any).secure_url;
      }
      
      // Update profile using auth storage
      const updatedProfile = await authStorage.updateUserProfile(userId, currentProfile.role, updateData);
      
      if (!updatedProfile) {
        return res.status(500).json({ 
          error: { 
            code: "update_failed", 
            message: "Failed to update profile" 
          } 
        });
      }

      res.json({
        success: true,
        profile: updatedProfile,
        message: "Profile updated successfully"
      });
    } catch (error) {
      console.error('Update profile error:', error);
      res.status(500).json({ 
        error: { 
          code: "update_failed", 
          message: "Failed to update profile" 
        } 
      });
    }
  });

  // Upload user avatar
  app.post("/api/users/me/avatar", requireAuth, upload.single("avatar"), async (req, res) => {
    try {
      const userId = (req as any).auth.id;
      
      if (!req.file) {
        return res.status(400).json({ 
          success: false,
          error: { 
            code: "no_file", 
            message: "No file provided" 
          } 
        });
      }

      // Upload to Cloudinary with square crop
      const result = await new Promise((resolve, reject) => {
        cloudinary.uploader.upload_stream(
          { 
            resource_type: "image",
            folder: "user-avatars",
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

      const profilePicUrl = (result as any).secure_url;
      
      // Get user info for response
      const userInfo = await db.select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        schoolId: users.schoolId
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
      
      if (!userInfo[0]) {
        return res.status(404).json({ 
          success: false,
          error: { 
            code: "user_not_found", 
            message: "User not found" 
          } 
        });
      }
      
      // Always return valid JSON with consistent field names
      res.json({
        success: true,
        profilePicUrl,
        user: {
          id: userInfo[0].id,
          name: userInfo[0].name,
          email: userInfo[0].email,
          role: userInfo[0].role,
          schoolId: userInfo[0].schoolId,
          profilePicUrl: profilePicUrl
        }
      });
    } catch (error) {
      console.error('Upload avatar error:', error);
      res.status(500).json({ 
        success: false,
        error: { 
          code: "upload_failed", 
          message: "Failed to upload avatar" 
        } 
      });
    }
  });

  // Profile picture upload endpoint (for frontend compatibility)
  app.put("/api/profile/picture", requireAuth, upload.single("profilePic"), async (req, res) => {
    try {
      const auth = req.user || (req as any).auth;
      const userId = auth.id;
      const userRole = auth.role;
      const linkedId = auth.linkedId; // This should now be populated from database
      
      console.log('📸 Profile picture upload - req.user object:', {
        userId,
        userRole,
        linkedId,
        hasLinkedId: !!linkedId,
        tokenLength: req.headers.authorization?.length || 0,
        hasFile: !!req.file,
        fileSize: req.file?.size || 0
      });
      
      // Validate linkedId is available
      if (!linkedId) {
        console.error('❌ linkedId is missing from req.user:', auth);
        return res.status(400).json({ 
          success: false,
          error: { 
            code: "missing_linked_id", 
            message: "User linked ID not found" 
          } 
        });
      }
      
      if (!req.file) {
        return res.status(400).json({ 
          success: false,
          error: { 
            code: "no_file", 
            message: "No file provided" 
          } 
        });
      }

      // Upload to Cloudinary with square crop
      const result = await new Promise((resolve, reject) => {
        cloudinary.uploader.upload_stream(
          { 
            resource_type: "image",
            folder: "profile-pictures",
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

      const profilePicUrl = (result as any).secure_url;
      console.log('📸 Cloudinary upload successful:', profilePicUrl);
      
      // Update profile picture based on user role
      let updatedProfile = null;
      let updateQuery = '';
      
      if (userRole === 'student') {
        // For students: users.linked_id = students.id, update students.profile_pic_url WHERE user_id = users.id
        updateQuery = `UPDATE students SET profile_pic_url = ? WHERE user_id = ?`;
        console.log('🔄 Updating students table:', { userId, profilePicUrl, query: updateQuery });
        updatedProfile = await storage.updateStudentByUserId(userId, { profilePicUrl });
        console.log('📸 Student profile updated:', updatedProfile?.id);
      } else {
        // For other roles: users.linked_id = role_table.id, update role_table.profile_pic_url WHERE id = users.linked_id
        if (userRole === 'viewer') {
          updateQuery = `UPDATE viewers SET profile_pic_url = ? WHERE id = ?`;
          console.log('🔄 Updating viewers table:', { linkedId, profilePicUrl, query: updateQuery });
          const [updated] = await db.update(viewers)
            .set({ profilePicUrl })
            .where(eq(viewers.id, linkedId)) // linkedId maps to linked_id column
            .returning();
          updatedProfile = updated;
        } else if (userRole === 'school_admin') {
          updateQuery = `UPDATE school_admins SET profile_pic_url = ? WHERE id = ?`;
          console.log('🔄 Updating school_admins table:', { linkedId, profilePicUrl, query: updateQuery });
          const [updated] = await db.update(schoolAdmins)
            .set({ profilePicUrl })
            .where(eq(schoolAdmins.id, linkedId)) // linkedId maps to linked_id column
            .returning();
          updatedProfile = updated;
        } else if (userRole === 'system_admin') {
          updateQuery = `UPDATE system_admins SET profile_pic_url = ? WHERE id = ?`;
          console.log('🔄 Updating system_admins table:', { linkedId, profilePicUrl, query: updateQuery });
          const [updated] = await db.update(systemAdmins)
            .set({ profilePicUrl })
            .where(eq(systemAdmins.id, linkedId)) // linkedId maps to linked_id column
            .returning();
          updatedProfile = updated;
        }
        console.log('📸 Role profile updated:', updatedProfile?.id);
      }
      
      if (!updatedProfile) {
        console.error('❌ Profile not found for update:', { 
          userId, 
          userRole, 
          linkedId, 
          updateQuery,
          error: 'No rows updated'
        });
        return res.status(404).json({ 
          success: false,
          error: { 
            code: "profile_not_found", 
            message: "Profile record not found" 
          } 
        });
      }
      
      console.log('📸 Profile picture update successful:', {
        userId,
        userRole,
        linkedId,
        profilePicUrl,
        profileId: updatedProfile.id,
        rowsUpdated: 1
      });
      
      // Return success response
      res.json({
        success: true,
        profilePicUrl,
        message: "Profile picture updated successfully"
      });
    } catch (error) {
      console.error('❌ Profile picture upload error:', error);
      res.status(500).json({ 
        success: false,
        error: { 
          code: "upload_failed", 
          message: "Failed to upload profile picture" 
        } 
      });
    }
  });

  // Update current user account information (name, email)
  app.put("/api/users/me", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).auth.id;
      const { name, email } = req.body;
      
      if (!name && !email) {
        return res.status(400).json({ 
          error: { 
            code: "no_updates", 
            message: "No updates provided" 
          } 
        });
      }
      
      const updateData: any = {};
      if (name !== undefined) updateData.name = name;
      if (email !== undefined) updateData.email = email;
      
      const updatedUser = await storage.updateUser(userId, updateData);
      
      if (!updatedUser) {
        return res.status(404).json({ 
          error: { 
            code: "user_not_found", 
            message: "User not found" 
          } 
        });
      }
      
      res.json({
        success: true,
        user: {
          id: updatedUser.id,
          name: updatedUser.name,
          email: updatedUser.email,
          role: updatedUser.role,
          schoolId: updatedUser.schoolId
        }
      });
    } catch (error) {
      console.error('Update user account error:', error);
      res.status(500).json({ 
        error: { 
          code: "update_failed", 
          message: "Failed to update account" 
        } 
      });
    }
  });

  // User profile picture update (FormData) - for file uploads
  app.put("/api/users/:userId", requireAuth, requireSelfAccess, upload.single("profilePic"), async (req, res) => {
    try {
      const { userId } = req.params;
      let updateData = { ...req.body };

      // Handle profile picture upload to Cloudinary for users
      if (req.file) {
        const result = await new Promise((resolve, reject) => {
          cloudinary.uploader.upload_stream(
            { 
              resource_type: "image",
              folder: "user-profiles",
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
      
      const updatedUser = await storage.updateUser(userId, updateData);
      
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json({
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        schoolId: updatedUser.schoolId
      });
    } catch (error) {
      console.error('Update user profile error:', error);
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  // Get all comments for a post
  app.get("/api/posts/:postId/comments", async (req, res) => {
    try {
      const { postId } = req.params;
      const comments = await storage.getPostComments(postId);
      res.json(comments);
    } catch (error) {
      console.error('Get post comments error:', error);
      res.status(500).json({ message: "Failed to fetch comments" });
    }
  });

  // Password change endpoint
  app.post("/api/users/:userId/change-password", requireAuth, requireSelfAccess, async (req, res) => {
    try {
      const { userId } = req.params;
      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({ 
          error: { 
            code: "missing_fields", 
            message: "Both current and new password are required" 
          } 
        });
      }

      // Enhanced password validation to match frontend requirements
      if (newPassword.length < 8) {
        return res.status(400).json({ 
          error: { 
            code: "weak_password", 
            message: "New password must be at least 8 characters long" 
          } 
        });
      }

      // Validate password complexity
      const hasUpperCase = /[A-Z]/.test(newPassword);
      const hasLowerCase = /[a-z]/.test(newPassword);
      const hasNumber = /\d/.test(newPassword);
      const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(newPassword);

      if (!hasUpperCase || !hasLowerCase || !hasNumber || !hasSpecialChar) {
        const missing = [];
        if (!hasUpperCase) missing.push("one uppercase letter");
        if (!hasLowerCase) missing.push("one lowercase letter");
        if (!hasNumber) missing.push("one number");
        if (!hasSpecialChar) missing.push("one special character");
        
        return res.status(400).json({ 
          error: { 
            code: "weak_password", 
            message: `Password must contain ${missing.join(", ")}` 
          } 
        });
      }

      // Verify current password using centralized auth
      const isCurrentPasswordValid = await authStorage.verifyCurrentPassword(userId, currentPassword);
      if (!isCurrentPasswordValid) {
        return res.status(400).json({ 
          error: { 
            code: "invalid_current_password", 
            message: "Current password is incorrect" 
          } 
        });
      }
      
      // Use centralized auth to change password securely
      await authStorage.changePassword(userId, newPassword);

      res.json({ 
        success: true,
        message: "Password updated successfully" 
      });
    } catch (error) {
      console.error('Change password error:', error);
      res.status(500).json({ 
        error: { 
          code: "password_change_failed", 
          message: "Failed to change password" 
        } 
      });
    }
  });

  // Privacy settings endpoint
  app.put("/api/users/:userId/privacy-settings", requireAuth, requireSelfAccess, async (req, res) => {
    try {
      const { userId } = req.params;
      const { profileVisibility, showStats, showContacts, allowDirectMessages } = req.body;
      
      // Update privacy settings in user profile
      const currentProfile = await authStorage.getUserProfile(userId);
      if (!currentProfile) {
        return res.status(404).json({ 
          error: { 
            code: "user_not_found", 
            message: "User not found" 
          } 
        });
      }
      
      const updatedProfile = await authStorage.updateUserProfile(userId, currentProfile.role, {
        profileVisibility,
        showStats,
        showContacts,
        allowDirectMessages
      });
      
      if (!updatedProfile) {
        return res.status(500).json({ 
          error: { 
            code: "update_failed", 
            message: "Failed to update privacy settings" 
          } 
        });
      }

      res.json({
        success: true,
        message: "Privacy settings updated successfully",
        settings: {
          profileVisibility,
          showStats,
          showContacts,
          allowDirectMessages
        }
      });
    } catch (error) {
      console.error('Privacy settings error:', error);
      res.status(500).json({ 
        error: { 
          code: "privacy_update_failed", 
          message: "Failed to update privacy settings" 
        } 
      });
    }
  });

  // Notification settings endpoint
  app.put("/api/users/:userId/notification-settings", requireAuth, requireSelfAccess, async (req, res) => {
    try {
      const { userId } = req.params;
      const { postLikes, postComments, newFollowers, teamUpdates, emailNotifications, pushNotifications } = req.body;
      
      // Update notification settings in user profile
      const currentProfile = await authStorage.getUserProfile(userId);
      if (!currentProfile) {
        return res.status(404).json({ 
          error: { 
            code: "user_not_found", 
            message: "User not found" 
          } 
        });
      }
      
      const updatedProfile = await authStorage.updateUserProfile(userId, currentProfile.role, {
        postLikes,
        postComments,
        newFollowers,
        teamUpdates,
        emailNotifications,
        pushNotifications
      });
      
      if (!updatedProfile) {
        return res.status(500).json({ 
          error: { 
            code: "update_failed", 
            message: "Failed to update notification settings" 
          } 
        });
      }

      res.json({
        success: true,
        message: "Notification settings updated successfully",
        settings: {
          postLikes,
          postComments,
          newFollowers,
          teamUpdates,
          emailNotifications,
          pushNotifications
        }
      });
    } catch (error) {
      console.error('Notification settings error:', error);
      res.status(500).json({ 
        error: { 
          code: "notification_update_failed", 
          message: "Failed to update notification settings" 
        } 
      });
    }
  });

  // Student routes
  app.get("/api/students/profile/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      const studentWithStats = await storage.getStudentWithStats(userId);
      
      if (!studentWithStats) {
        return res.status(404).json({ message: "Student not found" });
      }

      res.json(studentWithStats);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch student profile" });
    }
  });

  app.put("/api/students/profile/:userId", requireAuth, requireSelfAccess, upload.single("profilePic"), async (req, res) => {
    try {
      const { userId } = req.params;
      const authUserId = req.user?.id || (req as any).auth?.id;
      console.log('🔍 /api/students/profile/:userId - Auth User ID:', authUserId, 'Target User ID:', userId);
      const student = await storage.getStudentByUserId(userId);
      
      if (!student) {
        return res.status(404).json({ message: "Student not found" });
      }

      let updateData = { ...req.body };

      // Handle profile picture upload to Cloudinary
      if (req.file) {
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

        updateData.profilePicUrl = (result as any).secure_url;
      }

      const updatedStudent = await storage.updateStudent(student.id, updateData);
      res.json(updatedStudent);
    } catch (error) {
      console.error('Update student profile error:', error);
      res.status(500).json({ message: "Failed to update student profile" });
    }
  });

  // Unified Student Profile Routes (/me endpoints)
  app.get("/api/students/me", requireAuth, async (req, res) => {
    try {
      const userId = req.user?.id || (req as any).auth?.id;
      console.log('🔍 /api/students/me - User ID:', userId);
      
      const studentWithStats = await storage.getStudentWithStats(userId);
      
      if (!studentWithStats) {
        return res.status(404).json({ message: "Student profile not found" });
      }

      // Map DB fields to frontend expected field names
      const responseData = {
        ...studentWithStats,
        profilePic: studentWithStats?.profilePicUrl || studentWithStats?.profilePic,
        coverPhoto: studentWithStats?.coverPhoto
      };

      console.log('📸 Returning profile URLs:', {
        profilePic: responseData.profilePic,
        coverPhoto: responseData.coverPhoto
      });
      res.json(responseData);
    } catch (error) {
      console.error('Get student profile error:', error);
      
      // If it's a database error, try to return basic profile without stats
      if (error.message && error.message.includes('relation') && error.message.includes('does not exist')) {
        console.log('🔧 Database schema issue detected, returning basic profile');
        try {
          const userId = req.user?.id || (req as any).auth?.id;
          const student = await storage.getStudentByUserId(userId);
          if (student) {
            const user = await storage.getUser(userId);
            const school = user?.schoolId ? await storage.getSchool(user.schoolId) : undefined;
            
            return res.json({
              ...student,
              user,
              school,
              postsCount: 0,
              totalLikes: 0,
              totalViews: 0,
              totalSaves: 0,
              totalComments: 0,
              followersCount: 0,
              followingCount: 0,
            });
          }
        } catch (fallbackError) {
          console.error('Fallback profile fetch failed:', fallbackError);
        }
      }
      
      res.status(500).json({ message: "Failed to fetch student profile" });
    }
  });

  app.put("/api/students/me", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).auth.id;
      const { bio, sport, position, roleNumber, profilePicUrl, coverPhoto } = req.body;

      const updates: any = {};
      if (bio !== undefined) updates.bio = bio;
      if (sport !== undefined) updates.sport = sport;
      if (position !== undefined) updates.position = position;
      if (roleNumber !== undefined) updates.role_number = roleNumber;
      if (profilePicUrl !== undefined) updates.profile_pic_url = profilePicUrl;
      if (coverPhoto !== undefined) updates.cover_photo = coverPhoto;

      const updated = await storage.updateStudentByUserId(userId, updates);
      return res.json(updated);
    } catch (err: any) {
      console.error("❌ Update student profile error:", err);
      return res.status(500).json({ message: "Server error, please try again." });
    }
  });

  // Admin profile update endpoint (for scout admins, system admins, etc.)
  app.put("/api/admins/me", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).auth.id;
      const userRole = (req as any).auth.role;
      const linkedId = (req as any).auth.linkedId;
      const { profilePicUrl } = req.body;

      console.log('📤 Updating admin profile:', { userId, userRole, linkedId, profilePicUrl });

      // Only allow scout admins and system admins to update their profiles
      if (userRole !== 'scout_admin' && userRole !== 'system_admin') {
        return res.status(403).json({ 
          error: { 
            code: "unauthorized_role", 
            message: "Only scout admins and system admins can update their profiles" 
          } 
        });
      }

      const updates: any = {};
      if (profilePicUrl !== undefined) updates.profilePicUrl = profilePicUrl;

      // Update the appropriate table based on role
      let updatedAdmin;
      if (userRole === 'system_admin') {
        // For system admins: update systemAdmins table
        console.log('🔄 Updating systemAdmins table:', { linkedId, profilePicUrl });
        updatedAdmin = await db.update(systemAdmins)
          .set(updates)
          .where(eq(systemAdmins.id, linkedId))
          .returning();

        if (!updatedAdmin || updatedAdmin.length === 0) {
          return res.status(404).json({ 
            error: { 
              code: "admin_not_found", 
              message: "System admin profile not found" 
            } 
          });
        }

        console.log('✅ System admin profile updated successfully:', updatedAdmin[0]);
        return res.json({
          success: true,
          admin: {
            id: updatedAdmin[0].id,
            name: updatedAdmin[0].name,
            profilePicUrl: updatedAdmin[0].profilePicUrl
          }
        });
      } else {
        // For scout admins: update admins table
        console.log('🔄 Updating admins table:', { linkedId, profilePicUrl });
        updatedAdmin = await db.update(admins)
          .set(updates)
          .where(eq(admins.id, linkedId))
          .returning();

        if (!updatedAdmin || updatedAdmin.length === 0) {
          return res.status(404).json({ 
            error: { 
              code: "admin_not_found", 
              message: "Admin profile not found" 
            } 
          });
        }

        console.log('✅ Admin profile updated successfully:', updatedAdmin[0]);
        return res.json({
          success: true,
          admin: {
            id: updatedAdmin[0].id,
            name: updatedAdmin[0].name,
            email: updatedAdmin[0].email,
            role: updatedAdmin[0].role,
            profilePicUrl: updatedAdmin[0].profilePicUrl
          }
        });
      }
    } catch (err: any) {
      console.error("❌ Update admin profile error:", err);
      return res.status(500).json({ 
        error: { 
          code: "update_failed", 
          message: "Failed to update admin profile" 
        } 
      });
    }
  });

  app.post("/api/students", requireAuth, async (req, res) => {
    try {
      const userId = req.user?.id || (req as any).auth?.id;
      const authSchoolId = req.user?.schoolId || (req as any).auth?.schoolId;
      const { name, email, schoolId, phone, gender, dateOfBirth, grade, guardianContact, roleNumber, position, sport, bio, profilePic, coverPhoto } = req.body;
      
      console.log('🔍 /api/students - Auth User ID:', userId, 'Auth School ID:', authSchoolId, 'Request School ID:', schoolId);

      console.log(`🎓 Creating student profile for user ${userId}`);

      // Validate required fields
      if (!name || !email) {
        return res.status(400).json({ 
          error: {
            code: 'missing_required_fields',
            message: 'Name and email are required'
          }
        });
      }
      
      // Ensure schoolId comes from authenticated user, not frontend
      if (!authSchoolId) {
        return res.status(400).json({ 
          error: {
            code: 'missing_school_id',
            message: 'Your account must be linked to a school. Please contact your school admin.'
          }
        });
      }
      
      // Use authSchoolId instead of frontend-provided schoolId
      const finalSchoolId = authSchoolId;

      // Check if student profile already exists
      const existingStudent = await storage.getStudentByUserId(userId);
      if (existingStudent) {
        // Return the existing profile instead of throwing an error
        const user = await storage.getUser(userId);
        const school = user?.schoolId ? await storage.getSchool(user.schoolId) : undefined;
        
        return res.json({
          success: true,
          studentId: existingStudent.id,
          profile: {
            ...existingStudent,
            user,
            school,
            postsCount: 0,
            totalLikes: 0,
            totalViews: 0,
            totalSaves: 0,
            totalComments: 0,
            followersCount: 0,
            followingCount: 0,
          },
          message: "Profile already exists"
        });
      }

      // Validate that the school exists
      const school = await storage.getSchool(finalSchoolId);
      if (!school) {
        return res.status(400).json({ 
          error: {
            code: 'school_not_found',
            message: 'School not found'
          }
        });
      }

      // Ensure the user is linked to the correct school
      const user = await storage.getUserProfile(userId);
      if (!user?.schoolId || user.schoolId !== finalSchoolId) {
        return res.status(400).json({ 
          error: {
            code: 'school_mismatch',
            message: 'Your account must be linked to a school. Please contact your school admin.'
          }
        });
      }

      const studentData = {
        userId,
        schoolId: finalSchoolId,
        name,
        email,
        phone,
        gender,
        dateOfBirth,
        grade,
        guardianContact,
        roleNumber,
        position,
        sport,
        bio,
        profilePic: profilePic || null,
        coverPhoto: coverPhoto || null
      };

      console.log(`📝 Creating student with data:`, { userId, schoolId: finalSchoolId, name, email });

      const newStudent = await storage.createStudent(studentData);
      
      // Update the user's schoolId and linkedId in the users table
      await storage.updateUserSchoolLink(userId, newStudent.id, finalSchoolId);
      
      console.log(`✅ Student profile created successfully:`, newStudent.id);
      console.log(`🔗 Updated user ${userId} with schoolId: ${finalSchoolId} and linkedId: ${newStudent.id}`);
      
      res.json({ 
        success: true, 
        studentId: newStudent.id,
        profile: newStudent 
      });
    } catch (error) {
      console.error('Create student profile error:', error);
      res.status(500).json({ 
        error: {
          code: 'server_error',
          message: 'Failed to create student profile'
        }
      });
    }
  });

  app.get("/api/students/me/stats", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).auth.id;
      const student = await storage.getStudentByUserId(userId);
      
      if (!student) {
        return res.status(404).json({ message: "Student profile not found" });
      }

      // Get student stats
      const stats = await storage.getStudentStats(student.id);
      res.json(stats);
    } catch (error) {
      console.error('Get student stats error:', error);
      res.status(500).json({ message: "Failed to fetch student stats" });
    }
  });

  // Post routes
  app.get("/api/posts", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).auth.id;
      const userRole = (req as any).auth.role;
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = parseInt(req.query.offset as string) || 0;
      const schoolId = req.query.schoolId as string;
      const global = req.query.global === 'true';
      const includeAnnouncements = req.query.includeAnnouncements === 'true';
      
      let posts;
      
      // Handle admin-specific filtering
      if ((userRole === 'system_admin' || userRole === 'school_admin') && (schoolId || global)) {
        if (global) {
          // System admin viewing all posts across all schools
          posts = await storage.getPostsWithUserContext(userId, limit, offset, includeAnnouncements);
        } else if (schoolId) {
          // View posts from a specific school
          posts = await storage.getPostsBySchoolWithUserContext(schoolId, userId, limit, offset, includeAnnouncements);
        } else {
          posts = await storage.getPostsWithUserContext(userId, limit, offset, includeAnnouncements);
        }
      } else if (userRole === 'student') {
        // For students, include their own posts plus posts from followed accounts
        const student = await storage.getStudentByUserId(userId);
        if (student) {
          // Get student's own posts with user context
          const ownPosts = await storage.getPostsByStudentWithUserContext(student.id, userId);
          
          // Get posts from followed accounts (simplified - for now just get all posts)
          // TODO: Implement proper following logic
          const allPosts = await storage.getPostsWithUserContext(userId, limit, offset, includeAnnouncements);
          
          // Get announcements for this student
          let announcements = [];
          if (includeAnnouncements) {
            announcements = await storage.getAnnouncementsForUser(userId, userRole, student.schoolId, limit, offset);
          }
          
          // Combine and deduplicate
          const postIds = new Set(ownPosts.map(p => p.id));
          const otherPosts = allPosts.filter(p => !postIds.has(p.id));
          const announcementIds = new Set(announcements.map(a => a.id));
          const nonAnnouncementPosts = otherPosts.filter(p => !announcementIds.has(p.id));
          
          posts = [...announcements, ...ownPosts, ...nonAnnouncementPosts].sort((a, b) => 
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
        } else {
          posts = await storage.getPostsWithUserContext(userId, limit, offset, includeAnnouncements);
        }
      } else {
        // For non-students, get all posts with user context
        posts = await storage.getPostsWithUserContext(userId, limit, offset, includeAnnouncements);
      }
      
      res.json(posts);
    } catch (error) {
      console.error('Get posts error:', error);
      
      // If it's a database schema error, return empty array instead of crashing
      if (error.message && error.message.includes('relation') && error.message.includes('does not exist')) {
        console.log('🔧 Database schema issue detected, returning empty posts array');
        return res.json([]);
      }
      
      res.status(500).json({ message: "Failed to fetch posts" });
    }
  });

  // Dedicated feed endpoint with optimized pagination - Global feed with proper auth
  app.get("/api/posts/feed", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).auth.id;
      const userRole = (req as any).auth.role;
      const limit = Math.min(parseInt(req.query.limit as string) || 12, 20); // Default to 12, cap at 20 for performance
      const offset = parseInt(req.query.offset as string) || 0;
      
      // Add cache-safe headers for better performance
      if (offset === 0) {
        res.setHeader("Cache-Control", "no-store"); // page 0 should never be stale after a post
      } else {
        res.setHeader("Cache-Control", "private, max-age=300"); // Cache subsequent pages for 5 minutes
      }
      res.setHeader("Vary", "Authorization");
      res.setHeader("X-Content-Type-Options", "nosniff");
      
      // Get all posts globally (no school restriction) - TikTok/Instagram style
      let posts = await storage.getPostsWithUserContext(userId, limit, offset);
      
      // Store original posts length to determine hasMore correctly (before merging announcements)
      const originalPostsLength = posts.length;
      
      // Add announcements for students, school admins, and system admins
      // Only load announcements on the first page (offset === 0) to prevent duplicates
      let announcements: PostWithDetails[] = [];
      let schoolId: string | undefined = undefined;
      
      if (offset === 0) {
        if (userRole === 'student') {
          const student = await storage.getStudentByUserId(userId);
          if (student) {
            schoolId = student.schoolId;
            console.log(`📢 FEED: Fetching announcements for student ${userId} in school ${schoolId}`);
            announcements = await storage.getAnnouncementsForUser(userId, userRole, student.schoolId, 5, 0); // Limit announcements
            console.log(`📢 FEED: Storage returned ${announcements.length} announcements`);
            
            // Log each announcement
            announcements.forEach((a: any) => {
              console.log(`   - Announcement: ${a.title}, Scope: ${a.scope}, SchoolId: ${a.schoolId}`);
            });
            
            // Filter to ensure we only show global announcements or announcements for this student's school
            const beforeFilter = announcements.length;
            announcements = (announcements || []).filter(a =>
              (a as any).type === 'announcement' &&
              (
                (a as any).scope === 'global' ||
                ((a as any).scope === 'school' && (a as any).schoolId === schoolId)
              )
            );
            console.log(`📢 FEED: After filter: ${announcements.length} announcements (filtered ${beforeFilter - announcements.length})`);
          } else {
            console.log(`📢 FEED: No student record found for user ${userId}`);
          }
        } else if (userRole === 'school_admin') {
          // School admins can see global announcements and their school's announcements
          schoolId = (req as any).auth.schoolId;
          if (schoolId) {
            announcements = await storage.getAnnouncementsForUser(userId, userRole, schoolId, 5, 0);
          }
        } else if (userRole === 'system_admin') {
          // System admins can see all announcements
          announcements = await storage.getAnnouncementsForUser(userId, userRole, undefined, 5, 0);
        }
      }
      
      // Merge announcements with posts, avoiding duplicates
      if (announcements.length > 0) {
        console.log(`📢 FEED: Merging ${announcements.length} announcement(s) with ${posts.length} post(s)`);
        const announcementIds = new Set(announcements.map(a => a.id));
        const nonAnnouncementPosts = posts.filter(p => !announcementIds.has(p.id));
        
        console.log(`📢 FEED: After filtering duplicates: ${nonAnnouncementPosts.length} posts remain`);
        console.log(`📢 FEED: Final merge: ${announcements.length} announcements + ${nonAnnouncementPosts.length} posts = ${announcements.length + nonAnnouncementPosts.length} total`);
        
        // Prioritize announcements at the top, then sort by creation date
        posts = [...announcements, ...nonAnnouncementPosts].sort((a, b) => {
          // Announcements first, then by creation date
          if (a.isAnnouncement && !b.isAnnouncement) return -1;
          if (!a.isAnnouncement && b.isAnnouncement) return 1;
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
        
        console.log(`📢 FEED: Final sorted posts array has ${posts.length} items`);
        console.log(`📢 FEED: First ${Math.min(3, posts.length)} items:`, posts.slice(0, 3).map(p => ({
          id: p.id,
          title: (p as any).title,
          isAnnouncement: p.isAnnouncement,
          scope: (p as any).scope
        })));
      } else {
        console.log(`📢 FEED: No announcements to merge (announcements.length = 0)`);
      }
      
      // Check if there are more posts available by checking if we got the full requested limit
      // Use originalPostsLength before merging to correctly determine if more posts exist
      const hasMore = originalPostsLength === limit;
      
      // Calculate nextOffset based on original posts offset (not including announcements)
      const nextOffset = offset + originalPostsLength;
      
      // Final safety: if viewer is a student, only show global announcements or their school's announcements
      // NOTE: This should match the same logic in getAnnouncementsForUser - allow global OR school-specific
      if (userRole === 'student' && schoolId) {
        const beforeSafetyFilter = posts.length;
        posts = posts.filter((p: any) => {
          if (p?.type !== 'announcement') return true;
          // Allow global announcements OR school-specific announcements for this student's school
          const isGlobal = p?.scope === 'global';
          const isForMySchool = p?.scope === 'school' && p?.schoolId === schoolId;
          
          if (!isGlobal && !isForMySchool) {
            console.log(`📢 FEED SAFETY FILTER: Removing announcement "${p?.title}" - scope: ${p?.scope}, schoolId: ${p?.schoolId}`);
          }
          
          return isGlobal || isForMySchool;
        });
        console.log(`📢 FEED SAFETY FILTER: Filtered ${beforeSafetyFilter} posts to ${posts.length} (removed ${beforeSafetyFilter - posts.length})`);
      }

      // Return posts with metadata for infinite scroll
      res.json({
        posts,
        hasMore,
        nextOffset
      });
    } catch (error) {
      console.error('Get feed error:', error);
      
      // If it's a database schema error, return empty array instead of crashing
      if (error.message && error.message.includes('relation') && error.message.includes('does not exist')) {
        console.log('🔧 Database schema issue detected, returning empty feed');
        return res.json({ posts: [], hasMore: false, nextOffset: 0 });
      }
      
      res.status(500).json({ message: "Failed to fetch feed" });
    }
  });

  // Admin feed endpoint with filtering capabilities
  app.get("/api/posts/admin-feed", requireAuth, requireRole(['system_admin', 'school_admin']), async (req, res) => {
    try {
      const userId = (req as any).auth.id;
      const userRole = (req as any).auth.role;
      const schoolId = (req as any).auth.schoolId;
      const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);
      const offset = parseInt(req.query.offset as string) || 0;
      const global = req.query.global === 'true';
      const targetSchoolId = req.query.schoolId as string;
      const includeAnnouncements = req.query.includeAnnouncements === 'true';
      
      // Add cache-safe headers
      if (offset === 0) {
        res.setHeader("Cache-Control", "no-store");
      }
      res.setHeader("Vary", "Authorization");
      
      let posts;
      
      if (userRole === 'system_admin') {
        if (global) {
          // System admin viewing all posts across all schools
          posts = await storage.getPostsWithUserContext(userId, limit, offset, includeAnnouncements);
        } else if (targetSchoolId) {
          // System admin viewing posts from a specific school
          posts = await storage.getPostsBySchoolWithUserContext(targetSchoolId, userId, limit, offset, includeAnnouncements);
        } else {
          // Default: all posts
          posts = await storage.getPostsWithUserContext(userId, limit, offset, includeAnnouncements);
        }
      } else if (userRole === 'school_admin') {
        // School admin can only view posts from their school
        if (!schoolId) {
          return res.status(400).json({ error: { code: 'missing_school_id', message: 'School admin not linked to a school' } });
        }
        posts = await storage.getPostsBySchoolWithUserContext(schoolId, userId, limit, offset, includeAnnouncements);
      }
      
      // Return posts with metadata for infinite scroll
      res.json({
        posts,
        hasMore: posts.length === limit,
        nextOffset: offset + posts.length
      });
    } catch (error) {
      console.error('Admin feed error:', error);
      
      if (error.message && error.message.includes('relation') && error.message.includes('does not exist')) {
        console.log('🔧 Database schema issue detected, returning empty feed');
        return res.json({ posts: [], hasMore: false, nextOffset: 0 });
      }
      
      res.status(500).json({ error: { code: 'server_error', message: 'Failed to fetch admin feed' } });
    }
  });

  // School Admin Announcements
  app.post("/api/schools/:schoolId/announcements", requireAuth, requireRole('school_admin'), async (req, res) => {
    try {
      const { schoolId } = req.params;
      const userId = (req as any).auth.id;
      const userRole = req.user.role;
      const userSchoolId = req.user.schoolId;
      
      // Verify school admin can only create announcements for their school
      if (userRole === 'school_admin' && userSchoolId !== schoolId) {
        return res.status(403).json({ 
          error: { 
            code: 'forbidden', 
            message: 'You can only create announcements for your own school' 
          } 
        });
      }
      
      const { title, content, imageUrl, videoUrl, scope = 'school' } = req.body;
      
      if (!title || !content) {
        return res.status(400).json({ 
          error: { 
            code: 'validation_error', 
            message: 'Title and content are required' 
          } 
        });
      }
      
      // Get the admin's user ID for createdByAdminId
      const adminUser = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      const adminId = adminUser[0]?.id;

      if (!adminId) {
        return res.status(404).json({ 
          error: { 
            code: 'user_not_found', 
            message: 'Admin user not found' 
          } 
        });
      }

      // Create announcement as a special post with proper scope handling
      const announcementPost = await db.insert(posts).values({
        studentId: null, // Announcements don't have a student
        mediaUrl: imageUrl || videoUrl || '',
        mediaType: videoUrl ? 'video' : (imageUrl ? 'image' : 'text'),
        caption: content,
        title: title,
        type: 'announcement',
        broadcast: true,
        scope: scope,
        schoolId: schoolId, // Required for school-scoped announcements
        createdByAdminId: adminId,
        status: 'ready'
      }).returning();
      
      res.json({
        success: true,
        announcement: announcementPost[0],
        message: 'Announcement created successfully'
      });
      
    } catch (error) {
      console.error('School announcement creation error:', error);
      res.status(500).json({ 
        error: { 
          code: 'server_error', 
          message: 'Failed to create announcement' 
        } 
      });
    }
  });

  // System Admin Announcements
  app.post("/api/system/announcements", requireAuth, requireRole('system_admin'), async (req, res) => {
    try {
      const { title, content, imageUrl, videoUrl, scope = 'global', targetSchoolId, targetSchoolIds } = req.body;
      
      if (!title || !content) {
        return res.status(400).json({ 
          error: { 
            code: 'validation_error', 
            message: 'Title and content are required' 
          } 
        });
      }
      
      // Handle both old format (single school) and new format (multiple schools)
      // Support targetSchoolIds (array) or targetSchoolId (single string) for backward compatibility
      let schoolIds: string[] = [];
      if (targetSchoolIds && Array.isArray(targetSchoolIds)) {
        schoolIds = targetSchoolIds;
      } else if (targetSchoolId) {
        schoolIds = [targetSchoolId];
      }
      
      if (scope === 'school' && schoolIds.length === 0) {
        return res.status(400).json({ 
          error: { 
            code: 'validation_error', 
            message: 'At least one target school is required when scope is "school". Please select one or more schools.' 
          } 
        });
      }
      
      // Get the admin's user ID for createdByAdminId
      const userId = (req as any).auth.id;
      const adminUser = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      const adminId = adminUser[0]?.id;

      if (!adminId) {
        return res.status(404).json({ 
          error: { 
            code: 'user_not_found', 
            message: 'Admin user not found' 
          } 
        });
      }

      // Validate schools exist if specific schools are targeted
      if (scope === 'school' && schoolIds.length > 0) {
        for (const schoolId of schoolIds) {
          const [school] = await db.select().from(schools).where(eq(schools.id, schoolId)).limit(1);
          if (!school) {
            return res.status(404).json({ 
              error: { 
                code: 'school_not_found', 
                message: `School with ID ${schoolId} not found` 
              } 
            });
          }
        }
      }

      // Create announcement(s)
      // If scope is 'school', create one announcement per selected school
      // If scope is 'global' or 'staff', create a single announcement
      const announcementData = {
        studentId: null,
        mediaUrl: imageUrl || videoUrl || '',
        mediaType: videoUrl ? 'video' : (imageUrl ? 'image' : 'text'),
        caption: content,
        title: title,
        type: 'announcement',
        broadcast: true, // All announcements are broadcast (staff-only is now handled by banners)
        scope: scope,
        createdByAdminId: adminId,
        status: 'ready'
      };

      let createdAnnouncements = [];

      if (scope === 'school') {
        // Create one announcement per school
        for (const schoolId of schoolIds) {
          const [announcement] = await db.insert(posts).values({
            ...announcementData,
            schoolId: schoolId,
          }).returning();
          createdAnnouncements.push(announcement);
        }
      } else {
        // Create single announcement for global or staff scope
        const [announcement] = await db.insert(posts).values({
          ...announcementData,
          schoolId: null,
        }).returning();
        createdAnnouncements.push(announcement);
      }
      
      res.json({
        success: true,
        announcements: createdAnnouncements,
        message: scope === 'school' 
          ? `System announcement created successfully for ${createdAnnouncements.length} school(s)`
          : 'System announcement created successfully'
      });
      
    } catch (error) {
      console.error('System announcement creation error:', error);
      res.status(500).json({ 
        error: { 
          code: 'server_error', 
          message: 'Failed to create system announcement' 
        } 
      });
    }
  });

  // Get announcements for system admin (only announcements they created)
  app.get("/api/system-admin/announcements", requireAuth, requireRole('system_admin'), async (req, res) => {
    try {
      const userId = (req as any).auth.id;
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = parseInt(req.query.offset as string) || 0;
      
      console.log(`📢 Fetching announcements for system admin ${userId}`);
      
      // Only show announcements created by this system admin
      const announcementQuery = await db
        .select()
        .from(posts)
        .where(
          and(
            eq(posts.type, 'announcement'),
            eq(posts.createdByAdminId, userId)
          )
        )
        .orderBy(desc(posts.createdAt))
        .limit(limit)
        .offset(offset);
      
      console.log(`📢 Found ${announcementQuery.length} announcements created by system admin`);
      
      // Build detailed announcement objects similar to getAnnouncementsForUser
      const announcementsWithDetails = [];
      
      for (const announcement of announcementQuery) {
        try {
          // Get admin who created the announcement
          let adminUser;
          if (announcement.createdByAdminId) {
            const adminResult = await db
              .select()
              .from(users)
              .where(eq(users.id, announcement.createdByAdminId))
              .limit(1);
            adminUser = adminResult[0];
          }
          
          if (!adminUser) {
            console.warn(`⚠️ No admin user found for announcement ${announcement.id}`);
            continue;
          }
        
          // Get school info if it's a school-scoped announcement
          let schoolInfo = null;
          if (announcement.schoolId) {
            const schoolResult = await db
              .select()
              .from(schools)
              .where(eq(schools.id, announcement.schoolId))
              .limit(1);
            schoolInfo = schoolResult[0] || null;
          }

          const likes = await db.select().from(postLikes).where(eq(postLikes.postId, announcement.id));
          const comments = await db.select().from(postComments).where(eq(postComments.postId, announcement.id));
          const saves = await db.select().from(savedPosts).where(eq(savedPosts.postId, announcement.id));
          
          // Get view count
          const views = await db.select().from(postViews).where(eq(postViews.postId, announcement.id));

          // Check if current user has liked/saved this announcement
          const userLike = await db.select().from(postLikes).where(
            and(eq(postLikes.postId, announcement.id), eq(postLikes.userId, userId))
          ).limit(1);
          
          const userSave = await db.select().from(savedPosts).where(
            and(eq(savedPosts.postId, announcement.id), eq(savedPosts.userId, userId))
          ).limit(1);

          const effectiveMediaUrl = announcement.mediaUrl || '';
          const effectiveMediaType = announcement.mediaType || 'image';
          const effectiveStatus = announcement.status || 'ready';

          // Determine display name based on who created the announcement
          // System admin announcements always show "XEN SPORTS ARMOURY"
          // School admin announcements show school name
          let displayName: string;
          if (adminUser.role === 'system_admin') {
            displayName = 'XEN SPORTS ARMOURY';
          } else if (announcement.scope === 'school' && schoolInfo) {
            displayName = schoolInfo.name;
          } else {
            displayName = adminUser.name || 'School Administration';
          }

          announcementsWithDetails.push({
            ...announcement,
            student: {
              id: 'announcement',
              userId: adminUser.id,
              name: displayName,
              sport: '',
              position: '',
              roleNumber: '',
              profilePicUrl: adminUser.profilePicUrl,
              isFollowing: false
            },
            likesCount: likes.length,
            commentsCount: comments.length,
            savesCount: saves.length,
            viewCount: views.length,
            isLiked: userLike.length > 0,
            isSaved: userSave.length > 0,
            effectiveMediaUrl,
            effectiveMediaType,
            effectiveStatus,
            isAnnouncement: true,
            announcementScope: announcement.scope,
            announcementSchool: schoolInfo
          });
        } catch (announcementError) {
          console.error(`⚠️ Error processing announcement ${announcement.id}:`, announcementError);
          // Continue with next announcement instead of failing completely
          continue;
        }
      }
      
      console.log(`✅ Returning ${announcementsWithDetails.length} processed announcements`);
      
      res.json({
        success: true,
        announcements: announcementsWithDetails,
        hasMore: announcementsWithDetails.length === limit,
        nextOffset: offset + announcementsWithDetails.length
      });
    } catch (error: any) {
      console.error('❌ Get system announcements error:', error);
      console.error('Error stack:', error?.stack);
      res.status(500).json({ 
        error: { 
          code: 'server_error', 
          message: `Failed to fetch announcements: ${error?.message || 'Unknown error'}` 
        } 
      });
    }
  });

  // Get announcements for school admin (only announcements they created)
  app.get("/api/school-admin/announcements", requireAuth, requireRole('school_admin'), async (req, res) => {
    try {
      const userId = (req as any).auth.id;
      const userSchoolId = (req as any).auth.schoolId;
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = parseInt(req.query.offset as string) || 0;
      
      console.log(`📢 Fetching announcements for school admin ${userId}, school ${userSchoolId}`);
      
      // Only show announcements created by this school admin (not all school announcements)
      const announcementQuery = await db
        .select()
        .from(posts)
        .where(
          and(
            eq(posts.type, 'announcement'),
            eq(posts.createdByAdminId, userId)
          )
        )
        .orderBy(desc(posts.createdAt))
        .limit(limit)
        .offset(offset);
      
      console.log(`📢 Found ${announcementQuery.length} raw announcements from database`);
      
      // Build detailed announcement objects similar to getAnnouncementsForUser
      const announcementsWithDetails = [];
      
      for (const announcement of announcementQuery) {
        try {
          // Get admin who created the announcement (fallback to current user if null)
          let adminUser;
          if (announcement.createdByAdminId) {
            const adminResult = await db
              .select()
              .from(users)
              .where(eq(users.id, announcement.createdByAdminId))
              .limit(1);
            adminUser = adminResult[0];
          }
          
          // Fallback to current user if no admin found (for old announcements without createdByAdminId)
          if (!adminUser) {
            const currentUserResult = await db
              .select()
              .from(users)
              .where(eq(users.id, userId))
              .limit(1);
            adminUser = currentUserResult[0];
          }
          
          if (!adminUser) {
            console.warn(`⚠️ No admin user found for announcement ${announcement.id}`);
            continue;
          }
        
        // Get school info if it's a school-scoped announcement
        let schoolInfo = null;
        if (announcement.schoolId) {
          const schoolResult = await db
            .select()
            .from(schools)
            .where(eq(schools.id, announcement.schoolId))
            .limit(1);
          schoolInfo = schoolResult[0] || null;
        }

        const likes = await db.select().from(postLikes).where(eq(postLikes.postId, announcement.id));
        const comments = await db.select().from(postComments).where(eq(postComments.postId, announcement.id));
        const saves = await db.select().from(savedPosts).where(eq(savedPosts.postId, announcement.id));
        
        // Get view count
        const views = await db.select().from(postViews).where(eq(postViews.postId, announcement.id));

        // Check if current user has liked/saved this announcement
        const userLike = await db.select().from(postLikes).where(
          and(eq(postLikes.postId, announcement.id), eq(postLikes.userId, userId))
        ).limit(1);
        
        const userSave = await db.select().from(savedPosts).where(
          and(eq(savedPosts.postId, announcement.id), eq(savedPosts.userId, userId))
        ).limit(1);

        const effectiveMediaUrl = announcement.mediaUrl || '';
        const effectiveMediaType = announcement.mediaType || 'image';
        const effectiveStatus = announcement.status || 'ready';

        // Determine display name based on who created the announcement
        // System admin announcements always show "XEN SPORTS ARMOURY"
        // School admin announcements show school name
        let displayName: string;
        if (adminUser.role === 'system_admin') {
          displayName = 'XEN SPORTS ARMOURY';
        } else if (announcement.scope === 'school' && schoolInfo) {
          displayName = schoolInfo.name;
        } else {
          displayName = adminUser.name || 'School Administration';
        }

        announcementsWithDetails.push({
          ...announcement,
          student: {
            id: 'announcement',
            userId: adminUser.id,
            name: displayName,
            sport: '',
            position: '',
            roleNumber: '',
            profilePicUrl: adminUser.profilePicUrl,
            isFollowing: false
          },
          likesCount: likes.length,
          commentsCount: comments.length,
          savesCount: saves.length,
          viewCount: views.length,
          isLiked: userLike.length > 0,
          isSaved: userSave.length > 0,
          effectiveMediaUrl,
          effectiveMediaType,
          effectiveStatus,
          isAnnouncement: true,
          announcementScope: announcement.scope,
          announcementSchool: schoolInfo
        });
        } catch (announcementError) {
          console.error(`⚠️ Error processing announcement ${announcement.id}:`, announcementError);
          // Continue with next announcement instead of failing completely
          continue;
        }
      }
      
      console.log(`✅ Returning ${announcementsWithDetails.length} processed announcements`);
      
      res.json({
        success: true,
        announcements: announcementsWithDetails,
        hasMore: announcementsWithDetails.length === limit,
        nextOffset: offset + announcementsWithDetails.length
      });
    } catch (error: any) {
      console.error('❌ Get school announcements error:', error);
      console.error('Error stack:', error?.stack);
      res.status(500).json({ 
        error: { 
          code: 'server_error', 
          message: `Failed to fetch announcements: ${error?.message || 'Unknown error'}` 
        } 
      });
    }
  });

  // Update announcement
  app.put("/api/announcements/:id", requireAuth, requireRole(['system_admin', 'school_admin']), async (req, res) => {
    try {
      const { id } = req.params;
      const userId = (req as any).auth.id;
      const userRole = (req as any).auth.role;
      const userSchoolId = (req as any).auth.schoolId;
      const { title, content, imageUrl, videoUrl, scope } = req.body;
      
      // Get the announcement to check permissions
      const announcement = await db.select().from(posts).where(eq(posts.id, id)).limit(1);
      if (!announcement[0]) {
        return res.status(404).json({ 
          error: { 
            code: 'not_found', 
            message: 'Announcement not found' 
          } 
        });
      }
      
      // Check if user can edit this announcement - must be the creator
      if (announcement[0].createdByAdminId !== userId) {
        return res.status(403).json({ 
          error: { 
            code: 'forbidden', 
            message: 'You can only edit announcements you created' 
          } 
        });
      }
      
      // Determine the scope value and handle schoolId appropriately
      const newScope = scope !== undefined ? scope : announcement[0].scope;
      const isChangingToGlobal = newScope === 'global' && announcement[0].scope !== 'global';
      const isChangingToSchool = newScope === 'school' && announcement[0].scope !== 'school';
      
      console.log(`📢 Updating announcement ${id}:`);
      console.log(`   Current scope: ${announcement[0].scope}, New scope: ${newScope}`);
      console.log(`   Current schoolId: ${announcement[0].schoolId}`);
      console.log(`   Is changing to global: ${isChangingToGlobal}`);
      console.log(`   Is changing to school: ${isChangingToSchool}`);
      
      // CRITICAL FIX: When changing from school-specific to global, we need to:
      // 1. Find ALL related announcements (same admin, created around same time OR same title/caption)
      // 2. Delete ALL school-specific versions
      // 3. Create a SINGLE global announcement
      if (isChangingToGlobal && userRole === 'system_admin') {
        console.log(`📢 Converting school-specific announcement(s) to global...`);
        console.log(`📢 Original announcement: ID=${id}, Title="${announcement[0].title}", CreatedAt=${announcement[0].createdAt}`);
        
        // Use the current or updated title/caption
        const finalTitle = title !== undefined ? title : announcement[0].title;
        const finalCaption = content !== undefined ? content : announcement[0].caption;
        const originalTitle = announcement[0].title;
        const originalCaption = announcement[0].caption;
        
        // Strategy 1: Find by same admin, same original title/caption (handles multi-school case)
        const relatedByContent = await db
          .select()
          .from(posts)
          .where(and(
            eq(posts.type, 'announcement'),
            eq(posts.createdByAdminId, announcement[0].createdByAdminId),
            eq(posts.scope, 'school'),
            eq(posts.title, originalTitle),
            eq(posts.caption, originalCaption)
          ));
        
        console.log(`📢 Found ${relatedByContent.length} announcements with same original title/caption`);
        
        // Strategy 2: Also find by same admin and similar creation time (within 5 minutes)
        // This handles cases where title/content was edited
        const createdAtTime = new Date(announcement[0].createdAt);
        const timeWindowStart = new Date(createdAtTime.getTime() - 5 * 60 * 1000); // 5 minutes before
        const timeWindowEnd = new Date(createdAtTime.getTime() + 5 * 60 * 1000); // 5 minutes after
        
        const relatedByTime = await db
          .select()
          .from(posts)
          .where(and(
            eq(posts.type, 'announcement'),
            eq(posts.createdByAdminId, announcement[0].createdByAdminId),
            eq(posts.scope, 'school'),
            sql`${posts.createdAt} >= ${timeWindowStart.toISOString()}::timestamp`,
            sql`${posts.createdAt} <= ${timeWindowEnd.toISOString()}::timestamp`
          ));
        
        console.log(`📢 Found ${relatedByTime.length} announcements created within 5 minutes`);
        
        // Combine both strategies - get unique IDs
        const allRelatedIds = new Set<string>();
        relatedByContent.forEach(a => allRelatedIds.add(a.id));
        relatedByTime.forEach(a => allRelatedIds.add(a.id));
        allRelatedIds.add(id); // Always include the current one
        
        const idsToDelete = Array.from(allRelatedIds);
        
        console.log(`📢 Total ${idsToDelete.length} announcement(s) to delete: ${idsToDelete.join(', ')}`);
        
        // Delete ALL related school-specific announcements
        if (idsToDelete.length > 0) {
          await db.delete(posts).where(inArray(posts.id, idsToDelete));
          console.log(`📢 ✅ Deleted ${idsToDelete.length} school-specific announcement(s)`);
        }
        
        // Create a NEW global announcement with the updated content
        const globalAnnouncementData = {
          studentId: null,
          mediaUrl: (imageUrl || videoUrl) !== undefined ? (imageUrl || videoUrl || '') : announcement[0].mediaUrl,
          mediaType: videoUrl ? 'video' : (imageUrl ? 'image' : announcement[0].mediaType),
          caption: finalCaption,
          title: finalTitle,
          type: 'announcement',
          broadcast: true,
          scope: 'global',
          schoolId: null, // EXPLICITLY set to null
          createdByAdminId: announcement[0].createdByAdminId,
          status: 'ready'
        };
        
        console.log(`📢 Creating global announcement with data:`, {
          title: globalAnnouncementData.title,
          scope: globalAnnouncementData.scope,
          schoolId: globalAnnouncementData.schoolId
        });
        
        const [newGlobalAnnouncement] = await db.insert(posts).values(globalAnnouncementData).returning();
        console.log(`📢 ✅ Created new global announcement: ${newGlobalAnnouncement.id}`);
        console.log(`📢   Final values - Scope: ${newGlobalAnnouncement.scope}, SchoolId: ${newGlobalAnnouncement.schoolId}`);
        
        // Immediately verify from database
        const verifyFromDb = await db.select().from(posts).where(eq(posts.id, newGlobalAnnouncement.id)).limit(1);
        if (verifyFromDb[0]) {
          console.log(`📢 Database verification - Scope: ${verifyFromDb[0].scope}, SchoolId: ${verifyFromDb[0].schoolId}`);
          if (verifyFromDb[0].scope !== 'global' || verifyFromDb[0].schoolId !== null) {
            console.error(`❌ CRITICAL: Global announcement not set correctly in database!`);
            console.error(`   Expected: scope='global', schoolId=null`);
            console.error(`   Actual: scope='${verifyFromDb[0].scope}', schoolId='${verifyFromDb[0].schoolId}'`);
          }
        }
        
        // Verify it appears in queries for ANY school
        const anySchool = await db.select().from(schools).limit(1);
        const testSchoolId = anySchool.length > 0 ? anySchool[0].id : 'test-school-id';
        
        const testQuery = await db
          .select()
          .from(posts)
          .where(and(
            eq(posts.id, newGlobalAnnouncement.id),
            eq(posts.type, 'announcement'),
            eq(posts.broadcast, true),
            sql`${posts.status} != 'processing' OR ${posts.status} IS NULL`,
            or(
              and(eq(posts.scope, 'global'), sql`${posts.schoolId} IS NULL`),
              and(eq(posts.scope, 'school'), eq(posts.schoolId, testSchoolId))
            )
          ))
          .limit(1);
        
        console.log(`📢 TEST: Query test for school ${testSchoolId} - Found ${testQuery.length} result(s) (should be 1)`);
        
        if (testQuery.length === 0) {
          console.error(`❌ ERROR: New global announcement NOT found in test query!`);
          console.error(`   This means students won't see it. Check database values.`);
        } else {
          console.log(`✅ SUCCESS: New global announcement will appear in all feeds`);
        }
        
        // Return the new global announcement
        return res.json({
          success: true,
          announcement: newGlobalAnnouncement,
          message: `Converted ${idsToDelete.length} school-specific announcement(s) to a single global announcement`
        });
      }
      
      // CRITICAL FIX: When changing from global to school, delete global and create multiple school-specific
      if (isChangingToSchool && userRole === 'system_admin' && req.body.targetSchoolIds) {
        console.log(`📢 Converting global announcement to school-specific...`);
        
        const schoolIds = Array.isArray(req.body.targetSchoolIds) ? req.body.targetSchoolIds : [req.body.targetSchoolId];
        const finalTitle = title !== undefined ? title : announcement[0].title;
        const finalCaption = content !== undefined ? content : announcement[0].caption;
        
        // Delete the global announcement
        await db.delete(posts).where(eq(posts.id, id));
        console.log(`📢 Deleted global announcement ${id}`);
        
        // Create one announcement per selected school
        const createdAnnouncements = [];
        for (const schoolId of schoolIds) {
          const schoolAnnouncementData = {
            studentId: null,
            mediaUrl: (imageUrl || videoUrl) !== undefined ? (imageUrl || videoUrl || '') : announcement[0].mediaUrl,
            mediaType: videoUrl ? 'video' : (imageUrl ? 'image' : announcement[0].mediaType),
            caption: finalCaption,
            title: finalTitle,
            type: 'announcement',
            broadcast: true,
            scope: 'school',
            schoolId: schoolId,
            createdByAdminId: announcement[0].createdByAdminId,
            status: 'ready'
          };
          
          const [newAnnouncement] = await db.insert(posts).values(schoolAnnouncementData).returning();
          createdAnnouncements.push(newAnnouncement);
          console.log(`📢 Created school-specific announcement for school ${schoolId}: ${newAnnouncement.id}`);
        }
        
        console.log(`📢 ✅ Created ${createdAnnouncements.length} school-specific announcement(s)`);
        
        // Return the first created announcement
        return res.json({
          success: true,
          announcement: createdAnnouncements[0],
          message: `Converted global announcement to ${createdAnnouncements.length} school-specific announcement(s)`
        });
      }
      
      // Standard update (no scope change or simple update)
      let updateData: any = {
        title: title !== undefined ? title : announcement[0].title,
        caption: content !== undefined ? content : announcement[0].caption,
        mediaUrl: (imageUrl || videoUrl) !== undefined ? (imageUrl || videoUrl || '') : announcement[0].mediaUrl,
        mediaType: videoUrl ? 'video' : (imageUrl ? 'image' : announcement[0].mediaType),
        scope: newScope
      };
      
      // CRITICAL: When scope is 'global', schoolId MUST be null
      // This handles both: changing TO global AND keeping it global (already global)
      if (newScope === 'global') {
        updateData.schoolId = null; // ALWAYS set to null for global, even if already global
        console.log(`   Setting schoolId to null for global announcement (handles both new and existing global)`);
        
        // If it's already global but schoolId might be set, ensure it's cleared
        if (announcement[0].scope === 'global' && announcement[0].schoolId !== null) {
          console.log(`   ⚠️  WARNING: Announcement is already global but has schoolId=${announcement[0].schoolId}, fixing...`);
        }
      } else if (newScope === 'school') {
        if (userRole === 'school_admin') {
          // School admin always uses their school
          updateData.schoolId = userSchoolId;
          console.log(`   Setting schoolId to ${userSchoolId} for school admin`);
        } else if (announcement[0].schoolId) {
          // Keep existing schoolId if available
          updateData.schoolId = announcement[0].schoolId;
          console.log(`   Keeping existing schoolId: ${announcement[0].schoolId}`);
        }
      }
      
      // Update the announcement
      console.log(`📢 Update data being sent to database:`, JSON.stringify(updateData, null, 2));
      const [updatedAnnouncement] = await db.update(posts)
        .set(updateData)
        .where(eq(posts.id, id))
        .returning();
      
      console.log(`📢 Announcement updated successfully: ${updatedAnnouncement.title} (ID: ${id})`);
      console.log(`📢 Final scope: ${updatedAnnouncement.scope}, Final schoolId: ${updatedAnnouncement.schoolId}`);
      
      // Verify the update worked correctly by re-querying from database
      const verifyQuery = await db.select().from(posts).where(eq(posts.id, id)).limit(1);
      if (verifyQuery.length > 0) {
        const verified = verifyQuery[0];
        console.log(`📢 VERIFIED from database - Scope: ${verified.scope}, SchoolId: ${verified.schoolId}`);
        
        if (verified.scope === 'global' && verified.schoolId !== null) {
          console.error(`⚠️ WARNING: Global announcement still has schoolId in database! Attempting fix...`);
          // Try to fix it - use explicit SQL to ensure null is set
          await db.execute(sql`UPDATE posts SET school_id = NULL WHERE id = ${id}`);
          console.log(`📢 Fixed schoolId to null using SQL`);
          
          // Re-verify
          const reVerify = await db.select().from(posts).where(eq(posts.id, id)).limit(1);
          if (reVerify[0] && reVerify[0].schoolId === null) {
            console.log(`✅ Confirmed: schoolId is now NULL`);
            updatedAnnouncement.schoolId = null; // Update the return value
          } else {
            console.error(`❌ ERROR: schoolId still not NULL after fix!`);
          }
        }
      }
      
      // Test query: Check if announcement would appear for a student from a different school
      if (updatedAnnouncement.scope === 'global') {
        // Get any school ID to test with
        const anySchool = await db.select().from(schools).limit(1);
        const testSchoolId = anySchool.length > 0 ? anySchool[0].id : 'test-school-id';
        
        const testQuery = await db
          .select()
          .from(posts)
          .where(and(
            eq(posts.id, id),
            eq(posts.type, 'announcement'),
            eq(posts.broadcast, true),
            sql`${posts.status} != 'processing' OR ${posts.status} IS NULL`,
            or(
              and(eq(posts.scope, 'global'), sql`${posts.schoolId} IS NULL`),
              and(eq(posts.scope, 'school'), eq(posts.schoolId, testSchoolId))
            )
          ))
          .limit(1);
        console.log(`📢 TEST: Global announcement query test for school ${testSchoolId} - Found ${testQuery.length} result(s) (should be 1)`);
        
        if (testQuery.length === 0) {
          console.error(`❌ ERROR: Global announcement NOT found in query! This means it won't appear in feeds!`);
          const verifyAgain = await db.select().from(posts).where(eq(posts.id, id)).limit(1);
          if (verifyAgain[0]) {
            console.error(`   Current scope: ${verifyAgain[0].scope}, Current schoolId: ${verifyAgain[0].schoolId}`);
          }
        } else {
          console.log(`✅ SUCCESS: Global announcement would appear in feeds for any school`);
        }
      }
      
      // If changing from global to school, verify it won't appear in other schools
      if (updatedAnnouncement.scope === 'school' && updatedAnnouncement.schoolId) {
        // Get a different school ID to test exclusion
        const otherSchools = await db.select().from(schools)
          .where(sql`id != ${updatedAnnouncement.schoolId}`)
          .limit(1);
        
        if (otherSchools.length > 0) {
          const testQuery = await db
            .select()
            .from(posts)
            .where(and(
              eq(posts.id, id),
              eq(posts.type, 'announcement'),
              eq(posts.broadcast, true),
              sql`${posts.status} != 'processing' OR ${posts.status} IS NULL`,
              or(
                and(eq(posts.scope, 'global'), sql`${posts.schoolId} IS NULL`),
                and(eq(posts.scope, 'school'), eq(posts.schoolId, otherSchools[0].id))
              )
            ))
            .limit(1);
          console.log(`📢 TEST: School-scoped announcement should NOT appear in other school ${otherSchools[0].id} - Found ${testQuery.length} result(s) (should be 0)`);
          
          if (testQuery.length > 0 && testQuery[0].scope === 'school' && testQuery[0].schoolId !== otherSchools[0].id) {
            console.log(`✅ Correctly excluded from other school`);
          } else if (testQuery.length === 0) {
            console.log(`✅ Correctly excluded from other school`);
          }
        }
      }
      
      res.json({
        success: true,
        announcement: updatedAnnouncement,
        message: 'Announcement updated successfully'
      });
    } catch (error) {
      console.error('Update announcement error:', error);
      res.status(500).json({ 
        error: { 
          code: 'server_error', 
          message: 'Failed to update announcement' 
        } 
      });
    }
  });

  // TEST/DEBUG ENDPOINT: Verify global announcements appear for students
  app.get("/api/test/announcements/:schoolId", requireAuth, async (req, res) => {
    try {
      const { schoolId } = req.params;
      
      console.log(`🧪 TEST: Checking announcements for school ${schoolId}`);
      
      // Get ALL announcements in database
      const allAnnouncements = await db
        .select()
        .from(posts)
        .where(and(
          eq(posts.type, 'announcement'),
          eq(posts.broadcast, true),
          sql`${posts.status} != 'processing' OR ${posts.status} IS NULL`
        ))
        .orderBy(desc(posts.createdAt));
      
      console.log(`🧪 TEST: Found ${allAnnouncements.length} total announcements in database`);
      
      // Categorize announcements
      const globalAnnouncements = allAnnouncements.filter(a => a.scope === 'global');
      const schoolAnnouncements = allAnnouncements.filter(a => a.scope === 'school');
      const forThisSchool = schoolAnnouncements.filter(a => a.schoolId === schoolId);
      
      console.log(`🧪 TEST: ${globalAnnouncements.length} global announcements`);
      console.log(`🧪 TEST: ${schoolAnnouncements.length} school-specific announcements`);
      console.log(`🧪 TEST: ${forThisSchool.length} for school ${schoolId}`);
      
      // Test the actual query used by storage
      const testQuery = await db
        .select()
        .from(posts)
        .where(and(
          eq(posts.type, 'announcement'),
          eq(posts.broadcast, true),
          sql`${posts.status} != 'processing' OR ${posts.status} IS NULL`,
          or(
            and(eq(posts.scope, 'global'), sql`${posts.schoolId} IS NULL`),
            and(eq(posts.scope, 'school'), eq(posts.schoolId, schoolId))
          )
        ))
        .orderBy(desc(posts.createdAt))
        .limit(20);
      
      console.log(`🧪 TEST: Query returned ${testQuery.length} announcements`);
      
      // Test using storage method
      const userId = (req as any).auth.id;
      const storageResults = await storage.getAnnouncementsForUser(userId, 'student', schoolId, 20, 0);
      
      console.log(`🧪 TEST: Storage method returned ${storageResults.length} announcements`);
      
      res.json({
        success: true,
        schoolId,
        totalAnnouncements: allAnnouncements.length,
        globalAnnouncements: globalAnnouncements.length,
        schoolAnnouncements: schoolAnnouncements.length,
        forThisSchool: forThisSchool.length,
        queryReturned: testQuery.length,
        storageReturned: storageResults.length,
        globalAnnouncementsList: globalAnnouncements.map(a => ({
          id: a.id,
          title: a.title,
          scope: a.scope,
          schoolId: a.schoolId,
          broadcast: a.broadcast,
          createdAt: a.createdAt
        })),
        queryResults: testQuery.map(a => ({
          id: a.id,
          title: a.title,
          scope: a.scope,
          schoolId: a.schoolId,
          createdAt: a.createdAt
        })),
        storageResults: storageResults.map((a: any) => ({
          id: a.id,
          title: a.title,
          scope: a.scope,
          schoolId: a.schoolId,
          createdAt: a.createdAt
        }))
      });
    } catch (error) {
      console.error('🧪 TEST endpoint error:', error);
      res.status(500).json({ 
        error: { 
          code: 'server_error', 
          message: 'Test failed',
          details: error instanceof Error ? error.message : String(error)
        } 
      });
    }
  });

  // Delete announcement
  app.delete("/api/announcements/:id", requireAuth, requireRole(['system_admin', 'school_admin']), async (req, res) => {
    try {
      const { id } = req.params;
      const userId = (req as any).auth.id;
      const userRole = (req as any).auth.role;
      const userSchoolId = (req as any).auth.schoolId;
      
      // Get the announcement to check permissions
      const announcement = await db.select().from(posts).where(eq(posts.id, id)).limit(1);
      if (!announcement[0]) {
        return res.status(404).json({ 
          error: { 
            code: 'not_found', 
            message: 'Announcement not found' 
          } 
        });
      }
      
      // Check if user can delete this announcement - must be the creator
      if (announcement[0].createdByAdminId !== userId) {
        return res.status(403).json({ 
          error: { 
            code: 'forbidden', 
            message: 'You can only delete announcements you created' 
          } 
        });
      }
      
      // Delete the announcement
      await db.delete(posts).where(eq(posts.id, id));
      
      console.log(`📢 Announcement deleted: ${announcement[0].title} (ID: ${id})`);
      
      res.json({
        success: true,
        message: 'Announcement deleted successfully'
      });
    } catch (error) {
      console.error('Delete announcement error:', error);
      res.status(500).json({ 
        error: { 
          code: 'server_error', 
          message: 'Failed to delete announcement' 
        } 
      });
    }
  });

  app.get("/api/posts/student/:studentId", requireAuth, async (req, res) => {
    try {
      const { studentId } = req.params;
      const userId = (req as any).auth.id;
      const limit = parseInt(req.query.limit as string) || 12;
      const offset = parseInt(req.query.offset as string) || 0;
      
      const posts = await storage.getPostsByStudentWithUserContext(studentId, userId, limit, offset);
      res.json(posts);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch student posts" });
    }
  });

  // Get individual post by ID
  app.get("/api/posts/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = (req as any).auth.id;
      
      // Record the view first
      await storage.recordView(id, userId);
      
      const post = await storage.getPostWithUserContext(id, userId);
      
      if (!post) {
        return res.status(404).json({ message: "Post not found" });
      }
      
      res.json(post);
    } catch (error) {
      console.error('Get post error:', error);
      res.status(500).json({ message: "Failed to fetch post" });
    }
  });

  // Record a view for a post
  app.post("/api/posts/:id/view", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = (req as any).auth.id;
      
      await storage.recordView(id, userId);
      
      res.json({ success: true });
    } catch (error) {
      console.error('Record view error:', error);
      res.status(500).json({ message: "Failed to record view" });
    }
  });

  app.post("/api/posts/create", requireAuth, requireRole(['student']), upload.single('mediaFile'), async (req, res) => {
    try {
      const userId = (req as any).auth.id;
      
      // Get student profile for the authenticated user
      const student = await storage.getStudentByUserId(userId);
      if (!student) {
        console.error('Student profile not found for user:', userId);
        return res.status(403).json({ message: "Student profile not found. Please create your profile first." });
      }
      
      const studentId = student.id;
      
      let mediaUrl = '';
      let mediaType = 'text';
      
      // Upload file to Cloudinary if provided
      if (req.file) {
        console.log('Uploading file to Cloudinary:', req.file.originalname);
        
        const result = await new Promise((resolve, reject) => {
          cloudinary.uploader.upload_stream(
            {
              folder: "lockerroom/posts",
              transformation: [
                { width: 1200, crop: "scale" },
                { quality: "auto:good" },
                { fetch_format: "auto" }
              ],
              resource_type: "auto"
            },
            (error, result) => {
              if (error) {
                console.error('Cloudinary upload error:', error);
                reject(error);
              } else {
                resolve(result);
              }
            }
          ).end(req.file.buffer);
        });
        
        mediaUrl = (result as any).secure_url;
        mediaType = (result as any).resource_type === 'video' ? 'video' : 'image';
        console.log('File uploaded successfully:', mediaUrl, 'type:', mediaType);
      }
      
      const postData = insertPostSchema.parse({ 
        studentId,
        caption: req.body.caption || '',
        mediaUrl: mediaUrl,
        mediaType: mediaType
      });
      
      const post = await storage.createPost(postData);
      console.log('Post created successfully:', post.id);
      
      // Create notifications for users who follow this student
      if (post && post.studentId) {
        // Use helper function to notify followers (non-blocking)
        notifyFollowersOfNewPost(post.id, post.studentId).catch(err => {
          console.error('❌ Failed to notify followers (non-critical):', err);
        });
      }
      
      // Return the full post with details
      const postWithDetails = await storage.getPost(post.id);
      res.json({ id: post.id, ...postWithDetails });
    } catch (error) {
      console.error('Create post error:', error);
      res.status(400).json({ message: "Failed to create post" });
    }
  });

  // Interaction routes
  app.post("/api/posts/:postId/like", requireAuth, async (req, res) => {
    try {
      const { postId } = req.params;
      const userId = (req as any).auth.id; // Use authenticated user ID
      
      const like = await storage.likePost({ postId, userId });
      
      // Create notification for post owner when someone likes their post
      try {
        const post = await storage.getPost(postId);
        if (post) {
          let targetUserId: string | null = null;
          
          // Check if this is an announcement created by an admin
          if (post.type === 'announcement' && post.createdByAdminId) {
            // For announcements, notify the admin who created it
            targetUserId = post.createdByAdminId;
          } else if (post.studentId) {
            // For regular posts, notify the student who created it
            const student = await storage.getStudent(post.studentId);
            if (student) {
              targetUserId = student.userId;
            }
          }
          
          // Send notification if we have a target user and it's not the user's own action
          if (targetUserId && targetUserId !== userId) {
            const likerUser = await db.select().from(users).where(eq(users.id, userId)).limit(1);
            if (likerUser[0]) {
              const messageText = post.type === 'announcement' 
                ? `${likerUser[0].name || 'Someone'} liked your announcement`
                : `${likerUser[0].name || 'Someone'} liked your post`;
              
              await storage.createNotification({
                userId: targetUserId,
                type: 'post_like',
                title: 'New Like',
                message: messageText,
                entityType: 'post',
                entityId: postId,
                relatedUserId: userId,
              });
            }
          }
        }
      } catch (notifError) {
        console.error('Error creating like notification:', notifError);
        // Don't fail the like request if notification creation fails
      }
      
      // Get updated post with counts
      const updatedPost = await storage.getPostWithUserContext(postId, userId);
      res.json({
        success: true,
        like,
        likesCount: updatedPost.likesCount,
        isLiked: true
      });
    } catch (error) {
      console.error('Like post error:', error);
      res.status(400).json({ message: "Failed to like post" });
    }
  });

  app.delete("/api/posts/:postId/like", requireAuth, async (req, res) => {
    try {
      const { postId } = req.params;
      const userId = (req as any).auth.id; // Use authenticated user ID
      
      await storage.unlikePost(postId, userId);
      
      // Get updated post with counts
      const updatedPost = await storage.getPostWithUserContext(postId, userId);
      res.json({
        success: true,
        message: "Post unliked",
        likesCount: updatedPost.likesCount,
        isLiked: false
      });
    } catch (error) {
      console.error('Unlike post error:', error);
      res.status(400).json({ message: "Failed to unlike post" });
    }
  });

  // GET comments for a post
  app.get("/api/posts/:postId/comments", async (req, res) => {
    try {
      const { postId } = req.params;
      const limit = req.query.limit === 'all' ? undefined : 20;
      const comments = await storage.getPostComments(postId, limit);
      res.json(comments);
    } catch (error) {
      console.error('Get post comments error:', error);
      res.status(500).json({ message: "Failed to fetch comments" });
    }
  });

  app.post("/api/posts/:postId/comments", requireAuth, async (req, res) => {
    try {
      const { postId } = req.params;
      const commentData = insertPostCommentSchema.parse({ ...req.body, postId, userId: (req as any).auth.id });
      
      const comment = await storage.commentOnPost(commentData);
      
      // Create notification for post owner when someone comments on their post
      try {
        const post = await storage.getPost(postId);
        if (post) {
          let targetUserId: string | null = null;
          
          // Check if this is an announcement created by an admin
          if (post.type === 'announcement' && post.createdByAdminId) {
            // For announcements, notify the admin who created it
            targetUserId = post.createdByAdminId;
          } else if (post.studentId) {
            // For regular posts, notify the student who created it
            const student = await storage.getStudent(post.studentId);
            if (student) {
              targetUserId = student.userId;
            }
          }
          
          // Send notification if we have a target user and it's not the user's own action
          if (targetUserId && targetUserId !== (req as any).auth.id) {
            const commenterUser = await db.select().from(users).where(eq(users.id, (req as any).auth.id)).limit(1);
            if (commenterUser[0]) {
              const commentText = commentData.content.length > 50 
                ? commentData.content.substring(0, 50) + '...' 
                : commentData.content;
              
              const messageText = post.type === 'announcement'
                ? `${commenterUser[0].name || 'Someone'} commented on your announcement: "${commentText}"`
                : `${commenterUser[0].name || 'Someone'} commented: "${commentText}"`;
              
              await storage.createNotification({
                userId: targetUserId,
                type: 'post_comment',
                title: 'New Comment',
                message: messageText,
                entityType: 'post',
                entityId: postId,
                relatedUserId: (req as any).auth.id,
              });
            }
          }
        }
      } catch (notifError) {
        console.error('Error creating comment notification:', notifError);
        // Don't fail the comment request if notification creation fails
      }
      
      // Get updated post with counts
      const updatedPost = await storage.getPostWithUserContext(postId, (req as any).auth.id);
      res.json({
        success: true,
        comment,
        commentsCount: updatedPost.commentsCount
      });
    } catch (error) {
      console.error('Add comment error:', error);
      res.status(400).json({ message: "Failed to add comment" });
    }
  });

  app.post("/api/posts/:postId/save", requireAuth, async (req, res) => {
    try {
      const { postId } = req.params;
      const userId = (req as any).auth.id; // Use authenticated user ID
      
      const save = await storage.savePost({ postId, userId });
      
      // Get updated post with counts
      const updatedPost = await storage.getPostWithUserContext(postId, userId);
      res.json({ 
        success: true,
        message: "Post saved successfully",
        save,
        savesCount: updatedPost.savesCount,
        isSaved: true
      });
    } catch (error) {
      console.error('Save post error:', error);
      res.status(400).json({ 
        error: { 
          code: "save_failed", 
          message: "Failed to save post" 
        } 
      });
    }
  });

  app.delete("/api/posts/:postId/save", requireAuth, async (req, res) => {
    try {
      const { postId } = req.params;
      const userId = (req as any).auth.id; // Use authenticated user ID
      
      await storage.unsavePost(postId, userId);
      
      // Get updated post with counts
      const updatedPost = await storage.getPostWithUserContext(postId, userId);
      res.json({ 
        success: true,
        message: "Post unsaved successfully",
        savesCount: updatedPost.savesCount,
        isSaved: false
      });
    } catch (error) {
      console.error('Unsave post error:', error);
      res.status(400).json({ 
        error: { 
          code: "unsave_failed", 
          message: "Failed to unsave post" 
        } 
      });
    }
  });

  app.get("/api/users/:userId/saved-posts", requireAuth, requireSelfAccess, async (req, res) => {
    try {
      const { userId } = req.params;

      // Get saved posts with basic post data
      const savedPostsData = await db
        .select({
          saved_id: savedPosts.id,
          saved_created_at: savedPosts.createdAt,
          id: posts.id,
          studentId: posts.studentId,
          mediaUrl: posts.mediaUrl,
          mediaType: posts.mediaType,
          caption: posts.caption,
          createdAt: posts.createdAt,
          thumbnailUrl: posts.thumbnailUrl,
          status: posts.status
        })
        .from(savedPosts)
        .innerJoin(posts, eq(savedPosts.postId, posts.id))
        .where(eq(savedPosts.userId, userId))
        .orderBy(desc(savedPosts.createdAt));

      // Transform to PostWithDetails format
      const postsWithDetails = await Promise.all(
        savedPostsData.map(async (postData) => {
          // Get student details
          const student = await db
            .select()
            .from(students)
            .where(eq(students.id, postData.studentId))
            .limit(1);

          if (!student[0]) return null;

          // Get user details for the student
          const user = await db
            .select()
            .from(users)
            .where(eq(users.id, student[0].userId))
            .limit(1);

          if (!user[0]) return null;

          // Get interaction counts
          const likesCount = await db
            .select({ count: sql<number>`count(*)` })
            .from(postLikes)
            .where(eq(postLikes.postId, postData.id));

          const commentsCount = await db
            .select({ count: sql<number>`count(*)` })
            .from(postComments)
            .where(eq(postComments.postId, postData.id));

          const savesCount = await db
            .select({ count: sql<number>`count(*)` })
            .from(savedPosts)
            .where(eq(savedPosts.postId, postData.id));

          // Check if current user has liked/saved this post
          const userLike = await db
            .select()
            .from(postLikes)
            .where(sql`${postLikes.postId} = ${postData.id} AND ${postLikes.userId} = ${userId}`)
            .limit(1);

          const userSave = await db
            .select()
            .from(savedPosts)
            .where(sql`${savedPosts.postId} = ${postData.id} AND ${savedPosts.userId} = ${userId}`)
            .limit(1);

          // Use new fields directly since legacy fields have been migrated
          // Prefer mediaUrl (which contains secure_url from Cloudinary) with fallback
          const effectiveMediaUrl = postData.mediaUrl || '';
          const effectiveMediaType = postData.mediaType || 'image';
          const effectiveStatus = postData.status || 'ready';

          return {
            id: postData.id,
            studentId: postData.studentId,
            mediaUrl: postData.mediaUrl,
            mediaType: postData.mediaType,
            caption: postData.caption,
            createdAt: postData.createdAt,
            thumbnailUrl: postData.thumbnailUrl,
            effectiveMediaUrl,
            effectiveMediaType,
            effectiveStatus,
            student: {
              id: student[0].id,
              userId: student[0].userId,
              name: student[0].name,
              sport: student[0].sport || '',
              position: student[0].position || '',
              roleNumber: student[0].roleNumber || '',
              profilePicUrl: student[0].profilePicUrl
            },
            likesCount: likesCount[0]?.count || 0,
            commentsCount: commentsCount[0]?.count || 0,
            savesCount: savesCount[0]?.count || 0,
            isLiked: userLike.length > 0,
            isSaved: userSave.length > 0
          };
        })
      );

      // Filter out null results and return
      const validPosts = postsWithDetails.filter(post => post !== null);
      res.json(validPosts);
    } catch (err) {
      console.error("Error fetching saved posts:", err);
      res.status(500).json({ error: "Failed to fetch saved posts" });
    }
  });

  app.post("/api/posts/:postId/report", requireAuth, async (req, res) => {
    try {
      const { postId } = req.params;
      const userId = (req as any).auth.id;
      const { reason } = req.body;
      
      const report = await storage.reportPost({ postId, userId, reason });
      res.json({ 
        success: true,
        message: "Post reported successfully",
        report 
      });
    } catch (error) {
      console.error('Report post error:', error);
      res.status(400).json({ 
        error: { 
          code: "report_failed", 
          message: "Failed to report post" 
        } 
      });
    }
  });

  app.delete("/api/posts/:postId", requireAuth, async (req, res) => {
    try {
      const { postId } = req.params;
      const userId = (req as any).auth.id;
      
      await storage.deletePost(postId, userId);
      res.json({ 
        success: true,
        message: "Post deleted successfully" 
      });
    } catch (error) {
      console.error('Delete post error:', error);
      if (error.message === 'Unauthorized to delete this post') {
        res.status(403).json({ 
          error: { 
            code: "unauthorized", 
            message: "You can only delete your own posts" 
          } 
        });
      } else {
        res.status(400).json({ 
          error: { 
            code: "delete_failed", 
            message: "Failed to delete post" 
          } 
        });
      }
    }
  });

  // Cloudinary webhook for upload completion notifications
  app.post("/api/webhooks/cloudinary", async (req, res) => {
    try {
      const { notification_type, public_id, secure_url, eager } = req.body;
      
      console.log('🔔 Cloudinary webhook received:', {
        notification_type,
        public_id,
        secure_url: secure_url ? 'present' : 'missing',
        eager: eager ? 'present' : 'missing'
      });

      if (notification_type === 'upload') {
        // Find post by cloudinary_public_id
        const posts = await storage.getPosts();
        const post = posts.find(p => p.cloudinaryPublicId === public_id);
        
        if (post) {
          // Update post with final URL and mark as ready
          await storage.updatePost(post.id, {
            mediaUrl: secure_url,
            status: 'ready',
            thumbnailUrl: eager?.[0]?.secure_url || ''
          });
          
          console.log(`✅ Post ${post.id} updated with final URL`);
        } else {
          console.log(`⚠️ No post found for public_id: ${public_id}`);
        }
      }

      res.json({ success: true });
    } catch (error) {
      console.error('❌ Cloudinary webhook error:', error);
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  });

  // School routes
  app.get("/api/schools", async (req, res) => {
    try {
      const schools = await storage.getSchools();
      res.json(schools);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch schools" });
    }
  });

  // Get specific school by ID
  app.get("/api/schools/:schoolId", async (req, res) => {
    try {
      const { schoolId } = req.params;
      const school = await storage.getSchool(schoolId);
      if (!school) {
        return res.status(404).json({ message: "School not found" });
      }
      res.json(school);
    } catch (error) {
      console.error("Failed to fetch school:", error);
      res.status(500).json({ message: "Failed to fetch school" });
    }
  });

  app.get("/api/schools/:schoolId/stats", requireAuth, async (req, res) => {
    try {
      const { schoolId } = req.params;
      const period = req.query.period as string;
      const authSchoolId = req.user?.schoolId || (req as any).auth?.schoolId;
      
      // Ensure school admins can only access their own school's stats
      if (authSchoolId && authSchoolId !== schoolId) {
        return res.status(403).json({ 
          error: { 
            code: 'access_denied', 
            message: 'You can only access your own school\'s statistics' 
          } 
        });
      }
      
      const stats = await storage.getSchoolStats(schoolId, period);
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch school stats" });
    }
  });

  app.get("/api/schools/:schoolId/students", requireAuth, async (req, res) => {
    try {
      const { schoolId } = req.params;
      const authSchoolId = req.user?.schoolId || (req as any).auth?.schoolId;
      
      // Ensure school admins can only access their own school's students
      if (authSchoolId && authSchoolId !== schoolId) {
        return res.status(403).json({ 
          error: { 
            code: 'access_denied', 
            message: 'You can only access your own school\'s students' 
          } 
        });
      }
      
      const students = await storage.getStudentsBySchool(schoolId);
      // Join with users table to get email
      const studentsWithEmail = await Promise.all(students.map(async (student) => {
        const [user] = await db.select({ email: users.email }).from(users).where(eq(users.id, student.userId)).limit(1);
        return {
          ...student,
          email: user?.email || ''
        };
      }));
      res.json(studentsWithEmail);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch school students" });
    }
  });

  // Get recent activity for a school
  app.get("/api/schools/:schoolId/recent-activity", requireAuth, async (req, res) => {
    try {
      const { schoolId } = req.params;
      const authSchoolId = req.user?.schoolId || (req as any).auth?.schoolId;
      
      // Ensure school admins can only access their own school's activity
      if (authSchoolId && authSchoolId !== schoolId) {
        return res.status(403).json({ 
          error: { 
            code: 'access_denied', 
            message: 'You can only access your own school\'s activity' 
          } 
        });
      }
      
      const limit = parseInt(req.query.limit as string) || 5;
      const activity = await storage.getSchoolRecentActivity(schoolId, limit);
      res.json(activity);
    } catch (error) {
      console.error("Failed to fetch recent activity:", error);
      res.status(500).json({ message: "Failed to fetch recent activity" });
    }
  });

  // Get top performers for a school
  app.get("/api/schools/:schoolId/top-performers", requireAuth, async (req, res) => {
    try {
      const { schoolId } = req.params;
      const authSchoolId = req.user?.schoolId || (req as any).auth?.schoolId;
      
      // Ensure school admins can only access their own school's performers
      if (authSchoolId && authSchoolId !== schoolId) {
        return res.status(403).json({ 
          error: { 
            code: 'access_denied', 
            message: 'You can only access your own school\'s performers' 
          } 
        });
      }
      
      const limit = parseInt(req.query.limit as string) || 5;
      const performers = await storage.getSchoolTopPerformers(schoolId, limit);
      res.json(performers);
    } catch (error) {
      console.error("Failed to fetch top performers:", error);
      res.status(500).json({ message: "Failed to fetch top performers" });
    }
  });

  // System admin routes
  app.get("/api/system/stats", async (req, res) => {
    try {
      const stats = await storage.getSystemStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch system stats" });
    }
  });

  // Cloudinary file upload
  app.post("/api/upload", requireAuth, upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file provided" });
      }

      // Upload to Cloudinary with transformations
      const result = await new Promise((resolve, reject) => {
        cloudinary.uploader.upload_stream(
          {
            folder: "lockerroom",
            transformation: [
              { width: 800, crop: "scale" },
              { quality: "auto:good" },
              { fetch_format: "auto" }
            ],
            resource_type: "auto"
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        ).end(req.file.buffer);
      });

      res.json({ 
        url: (result as any).secure_url,
        public_id: (result as any).public_id,
        format: (result as any).format,
        resource_type: (result as any).resource_type
      });
    } catch (error) {
      console.error('Upload error:', error);
      res.status(500).json({ message: "Upload failed" });
    }
  });

  // Import and register school admin routes
  const { registerSchoolAdminRoutes } = await import('./routes/school-admin');
  registerSchoolAdminRoutes(app);

  // Import and register system admin routes
  const { registerSystemAdminRoutes } = await import('./routes/system-admin');
  registerSystemAdminRoutes(app);

  // Import and register admin routes
  const { registerAdminRoutes } = await import('./routes/admin');
  registerAdminRoutes(app);

  // Import and register scout admin routes
  registerScoutAdminRoutes(app);

  // Import and register profile routes
  const profileRoutes = await import('./routes/profile');
  app.use(profileRoutes.default);

  // Serve uploads directory (including branding assets) - always available
  const path = await import('path');
  const express = await import('express');
  app.use('/uploads', express.default.static(path.join(process.cwd(), 'uploads')));

  // General user follow/unfollow routes
  app.post("/api/users/:id/follow", requireAuth, async (req, res) => {
    try {
      const { id: targetUserId } = req.params;
      const followerUserId = (req as any).auth.id;
      
      if (!followerUserId) {
        return res.status(400).json({ 
          error: { 
            code: "missing_user_id", 
            message: "User ID required" 
          } 
        });
      }

      if (followerUserId === targetUserId) {
        return res.status(400).json({ 
          error: { 
            code: "cannot_follow_self", 
            message: "Cannot follow yourself" 
          } 
        });
      }

      // Check if already following
      const isAlreadyFollowing = await storage.isFollowing(followerUserId, targetUserId);
      if (isAlreadyFollowing) {
        return res.status(409).json({ 
          error: { 
            code: "already_following", 
            message: "Already following this user" 
          } 
        });
      }

      // Add follow relationship
      await storage.followUser(followerUserId, targetUserId);
      
      res.json({ 
        success: true,
        message: "Successfully followed user",
        isFollowing: true
      });
    } catch (error) {
      console.error('Follow user error:', error);
      res.status(500).json({ 
        error: { 
          code: "follow_failed", 
          message: "Failed to follow user" 
        } 
      });
    }
  });

  app.delete("/api/users/:id/follow", requireAuth, async (req, res) => {
    try {
      const { id: targetUserId } = req.params;
      const followerUserId = (req as any).auth.id;
      
      if (!followerUserId) {
        return res.status(400).json({ 
          error: { 
            code: "missing_user_id", 
            message: "User ID required" 
          } 
        });
      }

      // Remove follow relationship
      await storage.unfollowUser(followerUserId, targetUserId);
      
      res.json({ 
        success: true,
        message: "Successfully unfollowed user",
        isFollowing: false
      });
    } catch (error) {
      console.error('Unfollow user error:', error);
      res.status(500).json({ 
        error: { 
          code: "unfollow_failed", 
          message: "Failed to unfollow user" 
        } 
      });
    }
  });

  // Follow/Unfollow routes
  app.post("/api/students/:studentId/follow", requireAuth, async (req, res) => {
    try {
      const { studentId } = req.params;
      const userId = (req as any).auth.id; // Use authenticated user ID
      
      if (!userId) {
        return res.status(400).json({ 
          error: { 
            code: "missing_user_id", 
            message: "User ID required" 
          } 
        });
      }

      // Get the student's user ID
      const student = await storage.getStudent(studentId);
      if (!student) {
        return res.status(404).json({ 
          error: { 
            code: "student_not_found", 
            message: "Student not found" 
          } 
        });
      }

      // Check if already following
      const isAlreadyFollowing = await storage.isFollowingStudent(userId, studentId);
      if (isAlreadyFollowing) {
        return res.status(400).json({ 
          error: { 
            code: "already_following", 
            message: "Already following this student" 
          } 
        });
      }

      // Insert into studentFollowers table (source of truth for following)
      await storage.followStudent({ followerUserId: userId, studentId });
      
      // Also add to userFollows for consistency
      try {
        await storage.followUser(userId, student.userId);
      } catch (e) {
        // Ignore if already exists
      }
      
      // Create notification for the student being followed
      try {
        const followerUser = await db.select().from(users).where(eq(users.id, userId)).limit(1);
        if (followerUser[0]) {
          console.log(`🔔 Creating follow notification: ${followerUser[0].name} followed student ${student.name}`);
          await storage.createNotification({
            userId: student.userId, // The student being followed receives the notification
            type: 'new_follower',
            title: 'New Follower',
            message: `${followerUser[0].name || 'Someone'} started following you`,
            entityType: 'user',
            entityId: student.userId,
            relatedUserId: userId, // The person who followed
          });
          console.log(`✅ Follow notification created successfully`);
        }
      } catch (notifError: any) {
        console.error('❌ Error creating follow notification:', notifError);
        if (notifError?.message?.includes('does not exist') || notifError?.message?.includes('relation "notifications"')) {
          console.error('⚠️ Notifications table does not exist! Please run the migration: migrations/2025-01-31_notifications_system.sql');
        }
        // Don't fail the follow request if notification creation fails
      }
      
      // Get updated followers count
      const followersCount = await storage.getStudentFollowers(studentId).then(followers => followers.length);
      
      res.json({ 
        success: true,
        message: "Successfully followed student",
        isFollowing: true,
        followersCount
      });
    } catch (error) {
      console.error('Follow error:', error);
      res.status(400).json({ 
        error: { 
          code: "follow_failed", 
          message: "Failed to follow student" 
        } 
      });
    }
  });

  app.delete("/api/students/:studentId/follow", requireAuth, async (req, res) => {
    try {
      const { studentId } = req.params;
      const userId = (req as any).auth.id; // Use authenticated user ID
      
      if (!userId) {
        return res.status(400).json({ 
          error: { 
            code: "missing_user_id", 
            message: "User ID required" 
          } 
        });
      }

      // Get the student record to find the user ID
      const student = await storage.getStudent(studentId);
      if (!student) {
        return res.status(404).json({ 
          error: { 
            code: "student_not_found", 
            message: "Student not found" 
          } 
        });
      }

      const studentUserId = student.userId;

      // Unfollow from both tables to ensure consistency
      // 1. Try unfollowing from studentFollowers table
      try {
        await storage.unfollowStudent(userId, studentId);
      } catch (e) {
        // Ignore if not found in studentFollowers
      }

      // 2. Also unfollow from userFollows table (which is what getFollowing uses)
      try {
        await storage.unfollowUser(userId, studentUserId);
      } catch (e) {
        // Ignore if not found in userFollows
      }
      
      // Get updated followers count
      const followersCount = await storage.getStudentFollowers(studentId).then(followers => followers.length);
      
      res.json({ 
        success: true,
        message: "Successfully unfollowed student",
        isFollowing: false,
        followersCount
      });
    } catch (error) {
      console.error('Unfollow error:', error);
      res.status(400).json({ 
        error: { 
          code: "unfollow_failed", 
          message: "Failed to unfollow student" 
        } 
      });
    }
  });

  app.get("/api/students/:studentId/followers", async (req, res) => {
    try {
      const { studentId } = req.params;
      const followers = await storage.getFollowers(studentId);
      res.json(followers);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch followers" });
    }
  });

  app.get("/api/users/:userId/following", async (req, res) => {
    try {
      const { userId } = req.params;
      
      if (!userId) {
        return res.status(400).json({ message: "User ID is required" });
      }
      
      console.log('📋 Fetching following list for user:', userId);
      const followingStudents = await storage.getFollowing(userId);
      console.log('📋 Found', followingStudents.length, 'students being followed');
      
      // Return empty array if no students are being followed
      if (!followingStudents || followingStudents.length === 0) {
        return res.json([]);
      }
      
      // Enrich the data with user info, school info, and followers count
      const enrichedFollowing = await Promise.all(
        followingStudents.map(async (student) => {
          try {
            // Get user info
            const studentUser = await db.select().from(users).where(eq(users.id, student.userId)).limit(1);
            const user = studentUser[0] || null;
            
            // Get school info
            let school = null;
            if (student.schoolId) {
              const schoolData = await db.select().from(schools).where(eq(schools.id, student.schoolId)).limit(1);
              school = schoolData[0] ? { id: schoolData[0].id, name: schoolData[0].name } : null;
            }
            
            // Get followers count
            const followersResult = await db
              .select({ count: sql<number>`COUNT(*)` })
              .from(studentFollowers)
              .where(eq(studentFollowers.studentId, student.id));
            const followersCount = Number(followersResult[0]?.count || 0);
            
            return {
              id: student.id,
              userId: student.userId,
              name: student.name,
              sport: student.sport || '',
              roleNumber: student.roleNumber || '',
              position: student.position || '',
              profilePicUrl: student.profilePicUrl,
              profilePic: student.profilePic,
              user: user ? {
                id: user.id,
                name: user.name || student.name,
                email: user.email,
              } : {
                id: student.userId,
                name: student.name,
                email: '',
              },
              school: school,
              followersCount: followersCount,
            };
          } catch (studentError) {
            console.error('Error enriching student data:', studentError);
            // Return basic student data even if enrichment fails
            return {
              id: student.id,
              userId: student.userId,
              name: student.name,
              sport: student.sport || '',
              roleNumber: student.roleNumber || '',
              position: student.position || '',
              profilePicUrl: student.profilePicUrl,
              profilePic: student.profilePic,
              user: {
                id: student.userId,
                name: student.name,
                email: '',
              },
              school: null,
              followersCount: 0,
            };
          }
        })
      );
      
      console.log('✅ Returning', enrichedFollowing.length, 'enriched following students');
      res.json(enrichedFollowing);
    } catch (error) {
      console.error('❌ Error fetching following:', error);
      const errorMessage = error instanceof Error ? error.message : "Failed to fetch following";
      res.status(500).json({ 
        message: errorMessage,
        error: process.env.NODE_ENV === 'development' ? String(error) : undefined
      });
    }
  });

  app.get("/api/users/:id/is-following", requireAuth, async (req, res) => {
    try {
      const { id: targetUserId } = req.params;
      const followerUserId = (req as any).auth.id; // Use authenticated user ID
      
      if (!followerUserId) {
        return res.status(400).json({ message: "User ID required" });
      }

      const isFollowing = await storage.isFollowing(followerUserId, targetUserId);
      res.json(isFollowing);
    } catch (error) {
      res.status(500).json({ message: "Failed to check follow status" });
    }
  });

  app.get("/api/students/:studentId/is-following", requireAuth, async (req, res) => {
    try {
      const { studentId } = req.params;
      const userId = (req as any).auth.id; // Use authenticated user ID
      
      if (!userId) {
        return res.status(400).json({ message: "User ID required" });
      }

      const isFollowing = await storage.isFollowing(userId as string, studentId);
      res.json(isFollowing);
    } catch (error) {
      res.status(500).json({ message: "Failed to check follow status" });
    }
  });

  // Notification routes
  app.get("/api/notifications", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).auth.id;
      const { limit, offset, unreadOnly } = req.query;
      
      const options = {
        limit: limit ? parseInt(limit as string) : undefined,
        offset: offset ? parseInt(offset as string) : undefined,
        unreadOnly: unreadOnly === 'true',
      };
      
      console.log(`📬 Fetching notifications for user ${userId}`, options);
      const notifications = await storage.getNotifications(userId, options);
      console.log(`✅ Found ${notifications.length} notifications`);
      res.json(notifications);
    } catch (error: any) {
      console.error('❌ Notifications fetch error:', error);
      // If it's a table doesn't exist error, provide helpful message
      if (error?.message?.includes('does not exist') || error?.message?.includes('relation "notifications"')) {
        return res.status(500).json({ 
          error: { 
            code: "notifications_table_missing", 
            message: "Notifications table not found. Please run the database migration: migrations/2025-01-31_notifications_system.sql"
          } 
        });
      }
      res.status(500).json({ 
        error: { 
          code: "notifications_fetch_failed", 
          message: error?.message || "Failed to fetch notifications" 
        } 
      });
    }
  });

  app.get("/api/notifications/unread-count", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).auth.id;
      const count = await storage.getUnreadNotificationCount(userId);
      res.json({ count });
    } catch (error) {
      console.error('Unread count error:', error);
      res.status(500).json({ 
        error: { 
          code: "unread_count_failed", 
          message: "Failed to get unread count" 
        } 
      });
    }
  });

  app.put("/api/notifications/:notificationId/read", requireAuth, async (req, res) => {
    try {
      const { notificationId } = req.params;
      const userId = (req as any).auth.id;
      
      await storage.markNotificationAsRead(notificationId, userId);
      res.json({ success: true });
    } catch (error) {
      console.error('Mark as read error:', error);
      res.status(500).json({ 
        error: { 
          code: "mark_read_failed", 
          message: "Failed to mark notification as read" 
        } 
      });
    }
  });

  app.put("/api/notifications/read-all", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).auth.id;
      
      await storage.markAllNotificationsAsRead(userId);
      res.json({ success: true });
    } catch (error) {
      console.error('Mark all as read error:', error);
      res.status(500).json({ 
        error: { 
          code: "mark_all_read_failed", 
          message: "Failed to mark all notifications as read" 
        } 
      });
    }
  });

  // Search routes
  app.get("/api/search/students", async (req, res) => {
    try {
      const { q: query, userId } = req.query;
      
      if (!query || typeof query !== 'string') {
        return res.status(400).json({ message: "Search query required" });
      }

      const results = await storage.searchStudents(query, userId as string);
      res.json(results);
    } catch (error) {
      console.error('Search error:', error);
      res.status(500).json({ message: "Search failed" });
    }
  });

  // Public signup route (enhanced from existing register)
  app.post("/api/auth/signup", async (req, res) => {
    try {
      console.log('Signup request body:', req.body);
      const { email, password, name, role = 'viewer', schoolId } = req.body;
      console.log('Parsed signup data:', { email, password, name, role, schoolId });
      
      // Validate required fields
      if (!email || !password || !name) {
        return res.status(400).json({ 
          error: { 
            code: "missing_fields", 
            message: "Email, password, and name are required" 
          } 
        });
      }
      
      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ 
          error: { 
            code: "invalid_email", 
            message: "Please enter a valid email address" 
          } 
        });
      }
      
      // Validate password strength
      if (password.length < 6) {
        return res.status(400).json({ 
          error: { 
            code: "weak_password", 
            message: "Password must be at least 6 characters long" 
          } 
        });
      }
      
      // Check if email already exists
      console.log('Checking if email exists:', email);
      try {
        const existingUser = await authStorage.getUserByEmail(email);
        console.log('Existing user check result:', existingUser);
        if (existingUser) {
          return res.status(409).json({ 
            error: { 
              code: "email_taken", 
              message: "Email already registered" 
            } 
          });
        }
      } catch (error) {
        console.error('Error checking existing user:', error);
        throw error;
      }

      // Create user with profile
      const { user, profile } = await authStorage.createUserWithProfile(
        email, 
        password, 
        role, 
        { name, schoolId }
      );
      
      // Generate OTP for first-time login (for students)
      let otp = null;
      if (role === 'student') {
        otp = Math.floor(100000 + Math.random() * 900000).toString();
        const otpHash = await bcrypt.hash(otp, 10);
        
        // Store OTP in user record
        await db.update(users)
          .set({ otpHash })
          .where(eq(users.id, user.id));
      }
      
      // Generate JWT token with schoolId for school admins
      const tokenPayload: any = { 
        id: user.id, 
        email: user.email, 
        role: user.role, 
        linkedId: user.linkedId 
      };
      
      // Add schoolId for school admins
      if (user.role === 'school_admin' && (profile as any).schoolId) {
        tokenPayload.schoolId = (profile as any).schoolId;
      }
      
      const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '7d' });
      
      // Send welcome email (dummy service)
      console.log(`📧 Welcome email sent to ${email}`);
      console.log(`Welcome to LockerRoom, ${name}!`);
      if (role === 'student' && otp) {
        console.log(`Your one-time password is: ${otp}`);
      }
      
      res.json({ 
        token,
        user: { 
          id: user.id, 
          name: user.name,
          email: user.email, 
          role: user.role,
          linkedId: user.linkedId
        },
        profile,
        otp: otp, // Return OTP for students
        message: role === 'student' 
          ? `Account created successfully! Your one-time password is: ${otp}`
          : "Account created successfully! You can now search and follow student athletes."
      });
    } catch (error) {
      console.error('Signup error:', error);
      console.error('Error details:', error.message);
      console.error('Error stack:', error.stack);
      res.status(400).json({ 
        error: { 
          code: "signup_failed", 
          message: `Registration failed: ${error.message}` 
        } 
      });
    }
  });

  // Admin School Application Routes
  app.get("/api/admin/school-applications", requireAuth, requireRole(['system_admin', 'school_admin']), async (req, res) => {
    try {
      const applications = await storage.getSchoolApplications();
      res.json(applications);
    } catch (error) {
      console.error('Get school applications error:', error);
      res.status(500).json({ message: "Failed to fetch school applications" });
    }
  });

  app.post("/api/admin/school-applications", requireAuth, requireRole(['system_admin']), async (req, res) => {
    try {
      const applicationData = insertSchoolApplicationSchema.parse(req.body);
      const application = await storage.createSchoolApplication(applicationData);
      res.json(application);
    } catch (error) {
      console.error('Create school application error:', error);
      res.status(400).json({ message: "Failed to create school application" });
    }
  });

  app.post("/api/admin/school-applications/:id/approve", requireAuth, requireRole(['system_admin']), async (req, res) => {
    try {
      const { id } = req.params;
      const { reviewerId } = req.body;
      
      if (!reviewerId) {
        return res.status(400).json({ message: "Reviewer ID required" });
      }

      const school = await storage.approveSchoolApplication(id, reviewerId);
      if (!school) {
        return res.status(404).json({ message: "School application not found" });
      }

      res.json({ school, message: "School application approved successfully" });
    } catch (error) {
      console.error('Approve school application error:', error);
      res.status(500).json({ message: "Failed to approve application" });
    }
  });

  app.post("/api/admin/school-applications/:id/reject", requireAuth, requireRole(['system_admin']), async (req, res) => {
    try {
      const { id } = req.params;
      const { reviewerId, notes } = req.body;
      
      if (!reviewerId) {
        return res.status(400).json({ message: "Reviewer ID required" });
      }

      const application = await storage.rejectSchoolApplication(id, reviewerId, notes);
      if (!application) {
        return res.status(404).json({ message: "School application not found" });
      }

      res.json({ application, message: "School application rejected" });
    } catch (error) {
      console.error('Reject school application error:', error);
      res.status(500).json({ message: "Failed to reject application" });
    }
  });

  // Admin System Settings Routes
  app.get("/api/admin/system-settings", requireAuth, requireRole(['system_admin']), async (req, res) => {
    try {
      const settings = await storage.getSystemSettings();
      res.json(settings);
    } catch (error) {
      console.error('Get system settings error:', error);
      res.status(500).json({ message: "Failed to fetch system settings" });
    }
  });

  app.post("/api/admin/system-settings", requireAuth, requireRole(['system_admin']), async (req, res) => {
    try {
      const settingData = insertSystemSettingSchema.parse(req.body);
      const setting = await storage.createOrUpdateSystemSetting(settingData);
      res.json(setting);
    } catch (error) {
      console.error('Update system setting error:', error);
      res.status(400).json({ message: "Failed to update system setting" });
    }
  });

  app.delete("/api/admin/system-settings/:key", requireAuth, requireRole(['system_admin']), async (req, res) => {
    try {
      const { key } = req.params;
      await storage.deleteSystemSetting(key);
      res.json({ message: "System setting deleted successfully" });
    } catch (error) {
      console.error('Delete system setting error:', error);
      res.status(500).json({ message: "Failed to delete system setting" });
    }
  });

  // System Configuration Routes - Branding, Appearance, Payment
  // Public endpoint - branding info should be visible to all users
  app.get("/api/admin/system-config/branding", async (req, res) => {
    try {
      const branding = await storage.getSystemBranding();
      console.log('📖 GET /api/admin/system-config/branding - Fetched from DB:', JSON.stringify(branding, null, 2));
      
      // CRITICAL: Verify logo and favicon files actually exist before returning URLs
      // If file was deleted but DB still has URL, clear it
      const fs = await import('fs/promises');
      const path = await import('path');
      
      let verifiedLogoUrl = branding?.logoUrl || undefined;
      let verifiedFaviconUrl = branding?.faviconUrl || undefined;
      
      // Verify logo file exists - if file is missing but DB has URL, update DB
      if (verifiedLogoUrl) {
        try {
          let logoPath: string;
          if (verifiedLogoUrl.startsWith('/uploads/')) {
            logoPath = path.join(process.cwd(), verifiedLogoUrl.substring(1));
          } else if (verifiedLogoUrl.startsWith('uploads/')) {
            logoPath = path.join(process.cwd(), verifiedLogoUrl);
          } else if (path.isAbsolute(verifiedLogoUrl)) {
            logoPath = verifiedLogoUrl;
          } else {
            logoPath = path.join(process.cwd(), verifiedLogoUrl);
          }
          
          const fileExists = await fs.access(logoPath).then(() => true).catch(() => false);
          if (!fileExists) {
            console.log('⚠️ Logo file does not exist, clearing logoUrl from DB:', verifiedLogoUrl);
            // CRITICAL: Update database to clear the logoUrl since file doesn't exist
            await storage.updateSystemBranding({
              logoUrl: null,
              updatedBy: 'system',
            });
            verifiedLogoUrl = undefined;
          }
        } catch (error) {
          console.warn('⚠️ Error checking logo file:', error);
          verifiedLogoUrl = undefined;
        }
      }
      
      // Verify favicon file exists - if file is missing but DB has URL, update DB
      if (verifiedFaviconUrl) {
        try {
          let faviconPath: string;
          if (verifiedFaviconUrl.startsWith('/uploads/')) {
            faviconPath = path.join(process.cwd(), verifiedFaviconUrl.substring(1));
          } else if (verifiedFaviconUrl.startsWith('uploads/')) {
            faviconPath = path.join(process.cwd(), verifiedFaviconUrl);
          } else if (path.isAbsolute(verifiedFaviconUrl)) {
            faviconPath = verifiedFaviconUrl;
          } else {
            faviconPath = path.join(process.cwd(), verifiedFaviconUrl);
          }
          
          const fileExists = await fs.access(faviconPath).then(() => true).catch(() => false);
          if (!fileExists) {
            console.log('⚠️ Favicon file does not exist, clearing faviconUrl from DB:', verifiedFaviconUrl);
            // CRITICAL: Update database to clear the faviconUrl since file doesn't exist
            await storage.updateSystemBranding({
              faviconUrl: null,
              updatedBy: 'system',
            });
            verifiedFaviconUrl = undefined;
          }
        } catch (error) {
          console.warn('⚠️ Error checking favicon file:', error);
          verifiedFaviconUrl = undefined;
        }
      }
      
      // Normalize null values to undefined for JSON response
      const normalizedBranding = branding ? {
        ...branding,
        logoUrl: verifiedLogoUrl || undefined,
        faviconUrl: verifiedFaviconUrl || undefined,
      } : {};
      
      console.log('📖 GET /api/admin/system-config/branding - Returning verified and normalized:', JSON.stringify(normalizedBranding, null, 2));
      
      // Return the normalized branding object or empty object if none exists
      res.json(normalizedBranding);
    } catch (error) {
      console.error('❌ Get system branding error:', error);
      res.status(500).json({ 
        message: "Failed to fetch system branding",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  app.put("/api/admin/system-config/branding", requireAuth, requireRole(['system_admin']), async (req, res) => {
    try {
      const userId = (req as any).auth?.id || 'system';
      console.log('📝 PUT /api/admin/system-config/branding - Received request:', {
        userId,
        body: JSON.stringify(req.body, null, 2),
        bodyKeys: Object.keys(req.body || {})
      });
      
      // Get existing branding to check what files need to be deleted
      const existingBranding = await storage.getSystemBranding();
      const fs = await import('fs/promises');
      const path = await import('path');
      
      // CRITICAL: Delete logo file if logoUrl is being cleared
      // Check if logoUrl is explicitly in the request body and is null/undefined/empty
      console.log('🔍 Checking if logo should be deleted:');
      console.log('   logoUrl in req.body:', 'logoUrl' in req.body);
      console.log('   req.body.logoUrl value:', req.body.logoUrl);
      console.log('   req.body.logoUrl type:', typeof req.body.logoUrl);
      console.log('   existingBranding?.logoUrl:', existingBranding?.logoUrl);
      console.log('   Full req.body keys:', Object.keys(req.body));
      
      // CRITICAL: logoUrl can be null (explicitly cleared) or undefined (not in body)
      // null means "clear this field", undefined means "don't change this field"
      const isLogoBeingCleared = 'logoUrl' in req.body && (
        req.body.logoUrl === null ||  // Explicitly cleared (sent as null)
        req.body.logoUrl === undefined || 
        req.body.logoUrl === '' ||
        (typeof req.body.logoUrl === 'string' && req.body.logoUrl.trim() === '')
      );
      
      console.log('   isLogoBeingCleared:', isLogoBeingCleared);
      
      if (existingBranding?.logoUrl && isLogoBeingCleared) {
        // Extract filename from URL path
        const logoUrl = existingBranding.logoUrl;
        
        // Handle both absolute paths and relative paths
        // logoUrl might be like: /uploads/branding/logo.png or /uploads/branding/logo.jpg
        let logoPath: string;
        
        if (logoUrl.startsWith('/uploads/')) {
          // Relative path from project root
          logoPath = path.join(process.cwd(), logoUrl.substring(1)); // Remove leading slash
        } else if (logoUrl.startsWith('uploads/')) {
          // No leading slash
          logoPath = path.join(process.cwd(), logoUrl);
        } else if (path.isAbsolute(logoUrl)) {
          // Absolute path
          logoPath = logoUrl;
        } else {
          // Assume it's relative to project root
          logoPath = path.join(process.cwd(), logoUrl);
        }
        
        console.log('🗑️ Attempting to delete logo file:');
        console.log('   Original logoUrl:', logoUrl);
        console.log('   Resolved path:', logoPath);
        console.log('   Current working directory:', process.cwd());
        
        // Check if file exists before trying to delete
        try {
          const fileExists = await fs.access(logoPath).then(() => true).catch(() => false);
          console.log('   File exists check result:', fileExists);
          
          if (fileExists) {
            await fs.unlink(logoPath);
            console.log('✅ Successfully deleted logo file:', logoPath);
          } else {
            console.log('⚠️ Logo file does not exist at path:', logoPath);
            // Try alternative paths in case of path mismatch
            const alternativePaths = [
              path.join(process.cwd(), 'uploads', 'branding', 'logo.png'),
              path.join(process.cwd(), 'uploads', 'branding', 'logo.jpg'),
              path.join(process.cwd(), 'uploads', 'branding', 'logo.svg'),
            ];
            
            for (const altPath of alternativePaths) {
              const altExists = await fs.access(altPath).then(() => true).catch(() => false);
              if (altExists) {
                console.log('   Found logo at alternative path, deleting:', altPath);
                await fs.unlink(altPath);
                console.log('✅ Deleted logo from alternative path:', altPath);
                break;
              }
            }
          }
        } catch (error: any) {
          // File might not exist, log but don't fail
          if (error.code === 'ENOENT') {
            console.log('⚠️ Logo file does not exist (already deleted?):', logoPath);
          } else {
            console.error('❌ Could not delete logo file:', logoPath, error.message);
            console.error('   Error code:', error.code);
          }
        }
      } else {
        console.log('⚠️ Logo deletion skipped:');
        console.log('   - existingBranding?.logoUrl:', existingBranding?.logoUrl);
        console.log('   - isLogoBeingCleared:', isLogoBeingCleared);
      }
      
      // CRITICAL: Delete favicon file if faviconUrl is being cleared
      const isFaviconBeingCleared = 'faviconUrl' in req.body && (
        req.body.faviconUrl === undefined || 
        req.body.faviconUrl === null || 
        req.body.faviconUrl === '' ||
        (typeof req.body.faviconUrl === 'string' && req.body.faviconUrl.trim() === '')
      );
      
      if (existingBranding?.faviconUrl && isFaviconBeingCleared) {
        const faviconUrl = existingBranding.faviconUrl;
        const faviconPath = faviconUrl.startsWith('/') 
          ? path.join(process.cwd(), faviconUrl.substring(1))
          : path.join(process.cwd(), faviconUrl);
        
        console.log('🗑️ Attempting to delete favicon file:', faviconPath);
        console.log('🗑️ Original faviconUrl:', faviconUrl);
        
        try {
          await fs.unlink(faviconPath);
          console.log('✅ Successfully deleted favicon file:', faviconPath);
        } catch (error: any) {
          if (error.code === 'ENOENT') {
            console.log('⚠️ Favicon file does not exist (already deleted?):', faviconPath);
          } else {
            console.error('❌ Could not delete favicon file:', faviconPath, error.message);
          }
        }
      }
      
      // Ensure we have all required fields and validate the data
      const updateData = {
        ...req.body,
        updatedBy: userId,
      };
      
      console.log('📝 Calling storage.updateSystemBranding with:', JSON.stringify(updateData, null, 2));
      
      const branding = await storage.updateSystemBranding(updateData);
      
      console.log('✅ PUT /api/admin/system-config/branding - Successfully updated:', JSON.stringify(branding, null, 2));
      
      // CRITICAL: Normalize null values to undefined for JSON response
      // This ensures frontend receives undefined (not null) which is easier to check
      const normalizedBranding = {
        ...branding,
        logoUrl: branding.logoUrl || undefined,
        faviconUrl: branding.faviconUrl || undefined,
      };
      
      console.log('✅ PUT /api/admin/system-config/branding - Returning normalized branding:', JSON.stringify(normalizedBranding, null, 2));
      
      // Return the normalized branding
      res.json(normalizedBranding);
    } catch (error) {
      console.error('❌ PUT /api/admin/system-config/branding - Error:', error);
      console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      res.status(500).json({ 
        message: "Failed to update system branding",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Local branding asset upload endpoint (logo, favicon)
  app.post("/api/admin/system-config/branding/upload", requireAuth, requireRole(['system_admin']), upload.single("file"), async (req, res) => {
    try {
      console.log('📤 POST /api/admin/system-config/branding/upload - Upload request received');
      console.log('📤 Request body:', req.body);
      console.log('📤 File info:', req.file ? {
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size
      } : 'No file');

      if (!req.file) {
        console.error('❌ No file provided in request');
        return res.status(400).json({ error: "No file provided" });
      }

      const { type } = req.body; // 'logo' or 'favicon'
      if (!type || !['logo', 'favicon'].includes(type)) {
        console.error('❌ Invalid type:', type);
        return res.status(400).json({ error: "Invalid type. Must be 'logo' or 'favicon'" });
      }

      const fs = await import('fs/promises');
      const path = await import('path');
      
      // Create branding directory if it doesn't exist
      const brandingDir = path.join(process.cwd(), 'uploads', 'branding');
      await fs.mkdir(brandingDir, { recursive: true });
      console.log('📁 Branding directory ensured:', brandingDir);

      // Determine file extension from original file or mime type
      const originalExt = path.extname(req.file.originalname) || 
        (req.file.mimetype.includes('png') ? '.png' : 
         req.file.mimetype.includes('svg') ? '.svg' : 
         req.file.mimetype.includes('ico') ? '.ico' : 
         req.file.mimetype.includes('jpeg') || req.file.mimetype.includes('jpg') ? '.jpg' : '.png');

      // Use consistent filenames: logo.png, favicon.ico
      const filename = type === 'favicon' 
        ? `favicon${originalExt === '.ico' ? '.ico' : '.png'}` 
        : `logo${originalExt}`;
      const filePath = path.join(brandingDir, filename);

      console.log('💾 Saving file:', { filename, filePath, size: req.file.size });

      // Save file locally
      await fs.writeFile(filePath, req.file.buffer);
      
      // Verify file was written
      const stats = await fs.stat(filePath);
      console.log('✅ File saved successfully:', { filePath, size: stats.size });
      
      // Return local URL path
      const url = `/uploads/branding/${filename}`;
      
      console.log(`✅ Branding ${type} upload complete:`, { url, filePath, size: req.file.size });

      res.json({
        url,
        secure_url: url, // For compatibility with existing code
        public_id: filename,
        type,
      });
    } catch (error) {
      console.error('❌ Branding upload error:', error);
      console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      res.status(500).json({ 
        error: error instanceof Error ? error.message : "Failed to upload branding asset"
      });
    }
  });

  app.get("/api/admin/system-config/appearance", requireAuth, requireRole(['system_admin']), async (req, res) => {
    try {
      const appearance = await storage.getSystemAppearance();
      res.json(appearance || {});
    } catch (error) {
      console.error('Get system appearance error:', error);
      res.status(500).json({ message: "Failed to fetch system appearance" });
    }
  });

  app.put("/api/admin/system-config/appearance", requireAuth, requireRole(['system_admin']), async (req, res) => {
    try {
      const userId = (req as any).auth?.id || 'system';
      const appearance = await storage.updateSystemAppearance({
        ...req.body,
        updatedBy: userId,
      });
      res.json(appearance);
    } catch (error) {
      console.error('Update system appearance error:', error);
      res.status(500).json({ message: "Failed to update system appearance" });
    }
  });

  app.get("/api/admin/system-config/payment", requireAuth, requireRole(['system_admin']), async (req, res) => {
    try {
      const payment = await storage.getSystemPayment();
      res.json(payment || {});
    } catch (error) {
      console.error('Get system payment error:', error);
      res.status(500).json({ message: "Failed to fetch system payment config" });
    }
  });

  app.put("/api/admin/system-config/payment", requireAuth, requireRole(['system_admin']), async (req, res) => {
    try {
      const userId = (req as any).auth?.id || 'system';
      const payment = await storage.updateSystemPayment({
        ...req.body,
        updatedBy: userId,
      });
      res.json(payment);
    } catch (error) {
      console.error('Update system payment error:', error);
      res.status(500).json({ message: "Failed to update system payment config" });
    }
  });

  // Admin Role Management Routes
  app.get("/api/admin/roles", requireAuth, requireRole(['system_admin']), async (req, res) => {
    try {
      const roles = await storage.getAdminRoles();
      res.json(roles);
    } catch (error) {
      console.error('Get admin roles error:', error);
      res.status(500).json({ message: "Failed to fetch admin roles" });
    }
  });

  app.post("/api/admin/roles", requireAuth, requireRole(['system_admin']), async (req, res) => {
    try {
      const roleData = insertAdminRoleSchema.parse(req.body);
      const role = await storage.createAdminRole(roleData);
      res.json(role);
    } catch (error) {
      console.error('Create admin role error:', error);
      res.status(400).json({ message: "Failed to create admin role" });
    }
  });

  app.put("/api/admin/roles/:userId", requireAuth, requireRole(['system_admin']), async (req, res) => {
    try {
      const { userId } = req.params;
      const updateData = req.body;
      const role = await storage.updateAdminRole(userId, updateData);
      
      if (!role) {
        return res.status(404).json({ message: "Admin role not found" });
      }

      res.json(role);
    } catch (error) {
      console.error('Update admin role error:', error);
      res.status(500).json({ message: "Failed to update admin role" });
    }
  });

  app.delete("/api/admin/roles/:userId", requireAuth, requireRole(['system_admin']), async (req, res) => {
    try {
      const { userId } = req.params;
      await storage.deleteAdminRole(userId);
      res.json({ message: "Admin role deleted successfully" });
    } catch (error) {
      console.error('Delete admin role error:', error);
      res.status(500).json({ message: "Failed to delete admin role" });
    }
  });

  // Analytics Routes
  app.post("/api/analytics/log", async (req, res) => {
    try {
      const logData = insertAnalyticsLogSchema.parse(req.body);
      const log = await storage.logAnalyticsEvent(logData);
      res.json(log);
    } catch (error) {
      console.error('Log analytics event error:', error);
      res.status(400).json({ message: "Failed to log analytics event" });
    }
  });

  app.get("/api/analytics/logs", async (req, res) => {
    try {
      const { eventType, limit } = req.query;
      const logs = await storage.getAnalyticsLogs(
        eventType as string, 
        limit ? parseInt(limit as string) : undefined
      );
      res.json(logs);
    } catch (error) {
      console.error('Get analytics logs error:', error);
      res.status(500).json({ message: "Failed to fetch analytics logs" });
    }
  });

  app.get("/api/analytics/stats", async (req, res) => {
    try {
      const stats = await storage.getAnalyticsStats();
      res.json(stats);
    } catch (error) {
      console.error('Get analytics stats error:', error);
      res.status(500).json({ message: "Failed to fetch analytics stats" });
    }
  });

  // Student analytics endpoints
  app.get("/api/students/:studentId/analytics", async (req, res) => {
    try {
      const { studentId } = req.params;
      
      // Get student posts and engagement data
      const posts = await storage.getPostsByStudent(studentId);
      const totalPosts = posts.length;
      
      // Calculate monthly engagement data for the last 6 months
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const now = new Date();
      const monthlyData = [];
      
      for (let i = 5; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthName = monthNames[date.getMonth()];
        const year = date.getFullYear();
        
        // Filter posts for this month
        const monthPosts = posts.filter(post => {
          const postDate = new Date(post.createdAt);
          return postDate.getMonth() === date.getMonth() && postDate.getFullYear() === year;
        });
        
        // Calculate totals for this month
        const monthLikes = monthPosts.reduce((sum, post) => sum + (post.likesCount || 0), 0);
        const monthComments = monthPosts.reduce((sum, post) => sum + (post.commentsCount || 0), 0);
        const monthSaves = monthPosts.reduce((sum, post) => sum + (post.savesCount || 0), 0);
        
        monthlyData.push({
          month: monthName,
          posts: monthPosts.length,
          likes: monthLikes,
          comments: monthComments,
          saves: monthSaves
        });
      }

      // Get student profile for total stats
      const studentStats = await storage.getStudentWithStats(studentId);
      
      res.json({
        monthlyEngagement: monthlyData,
        totalStats: {
          posts: totalPosts,
          likes: studentStats?.totalLikes || 0,
          comments: studentStats?.totalComments || 0,
          saves: studentStats?.totalSaves || 0,
          views: studentStats?.totalViews || 0,
          followers: studentStats?.followersCount || 0
        }
      });
    } catch (error) {
      console.error('Get student analytics error:', error);
      res.status(500).json({ message: "Failed to fetch student analytics" });
    }
  });

  app.get("/api/students/:studentId/performance", async (req, res) => {
    try {
      const { studentId } = req.params;
      
      // Mock sports performance data based on student's sport
      const student = await storage.getStudentById(studentId);
      if (!student) {
        return res.status(404).json({ message: "Student not found" });
      }

      // Generate realistic performance data based on student's sport
      const sportsSkills = {
        'Soccer': [
          { skill: 'Dribbling', score: Math.floor(Math.random() * 30) + 70, target: 90 },
          { skill: 'Passing', score: Math.floor(Math.random() * 30) + 70, target: 88 },
          { skill: 'Shooting', score: Math.floor(Math.random() * 30) + 70, target: 85 },
          { skill: 'Defense', score: Math.floor(Math.random() * 30) + 70, target: 80 },
          { skill: 'Speed', score: Math.floor(Math.random() * 30) + 70, target: 90 },
          { skill: 'Teamwork', score: Math.floor(Math.random() * 30) + 80, target: 95 }
        ],
        'Basketball': [
          { skill: 'Shooting', score: Math.floor(Math.random() * 30) + 70, target: 90 },
          { skill: 'Dribbling', score: Math.floor(Math.random() * 30) + 70, target: 85 },
          { skill: 'Defense', score: Math.floor(Math.random() * 30) + 70, target: 88 },
          { skill: 'Rebounding', score: Math.floor(Math.random() * 30) + 70, target: 82 },
          { skill: 'Passing', score: Math.floor(Math.random() * 30) + 70, target: 85 },
          { skill: 'Free Throws', score: Math.floor(Math.random() * 30) + 70, target: 95 }
        ]
      };

      const skills = sportsSkills[student.sport as keyof typeof sportsSkills] || sportsSkills['Soccer'];
      
      // Generate monthly goals data
      const monthlyGoals = [];
      for (let i = 5; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const monthName = monthNames[date.getMonth()];
        
        const totalGoals = Math.floor(Math.random() * 5) + 8; // 8-12 goals
        const completed = Math.floor(Math.random() * totalGoals) + Math.floor(totalGoals * 0.6); // 60-100% completion
        
        monthlyGoals.push({
          month: monthName,
          completed: Math.min(completed, totalGoals),
          total: totalGoals
        });
      }

      res.json({
        sportsPerformance: skills,
        monthlyGoals: monthlyGoals,
        overallRating: Math.floor(Math.random() * 20) + 80 // 80-100 rating
      });
    } catch (error) {
      console.error('Get student performance error:', error);
      res.status(500).json({ message: "Failed to fetch student performance data" });
    }
  });

  // School Admin Student Management Routes
  app.get("/api/schools/:schoolId/students", async (req, res) => {
    try {
      const { schoolId } = req.params;
      const students = await storage.getStudentsBySchool(schoolId);
      res.json(students);
    } catch (error) {
      console.error('Get school students error:', error);
      res.status(500).json({ message: "Failed to fetch school students" });
    }
  });

  app.post("/api/schools/:schoolId/students", requireAuth, requireRole(['school_admin']), upload.single("profilePic"), async (req, res) => {
    try {
      const { schoolId } = req.params;
      const authUserId = req.user?.id || (req as any).auth?.id;
      const authSchoolId = req.user?.schoolId || (req as any).auth?.schoolId;
      
      console.log('🔍 /api/schools/:schoolId/students - Auth User ID:', authUserId, 'Auth School ID:', authSchoolId, 'Param School ID:', schoolId);
      
      // Ensure schoolId comes from authenticated user, not URL params
      if (!authSchoolId) {
        return res.status(400).json({ 
          error: {
            code: 'missing_school_id',
            message: 'Your account must be linked to a school. Please contact your school admin.'
          }
        });
      }
      
      // Enforce school boundary - admin can only create students in their own school
      if (authSchoolId !== schoolId) {
        return res.status(403).json({ 
          error: {
            code: 'school_mismatch',
            message: 'Your account must be linked to a school. Please contact your school admin.'
          }
        });
      }
      
      // First check for duplicate email in users
      const existingUser = await storage.getUserByEmail(req.body.email);
      if (existingUser) {
        return res.status(400).json({ message: "User with this email already exists" });
      }

      // Handle profile picture upload to Cloudinary
      let profilePicUrl = null;
      if (req.file) {
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
      }

      // Create user first
      const userData = insertUserSchema.parse({
        name: req.body.name,
        email: req.body.email,
        password: await bcrypt.hash("TempPassword123!", 10), // Temporary password
        role: "student",
        schoolId: schoolId,
      });

      const user = await storage.createUser(userData);

      // Create student record with userId
      const studentData = insertStudentSchema.parse({
        userId: user.id,
        schoolId: schoolId,
        name: req.body.name,
        email: req.body.email,
        phone: req.body.phone || null,
        gender: req.body.gender || null,
        dateOfBirth: req.body.dateOfBirth || null,
        grade: req.body.grade || null,
        guardianContact: req.body.guardianContact || null,
        profilePicUrl: profilePicUrl,
        roleNumber: req.body.roleNumber || null,
        position: req.body.position || null,
        sport: req.body.sport || null,
        bio: req.body.bio || null,
      });

      const student = await storage.createStudent(studentData);
      
      // Update the user's linkedId to point to the student profile
      await db.update(users)
        .set({ 
          linkedId: student.id, 
          schoolId: schoolId 
        })
        .where(eq(users.id, user.id));
      
      console.log(`✅ Student created successfully:`, student.id);
      console.log(`🔗 Updated user ${user.id} with linkedId: ${student.id} and schoolId: ${schoolId}`);
      
      // Log analytics event
      await storage.logAnalyticsEvent({
        eventType: "student_created",
        entityId: student.id,
        entityType: "student",
        metadata: JSON.stringify({ schoolId }),
      });

      res.json(student);
    } catch (error) {
      console.error('Create student error:', error);
      res.status(400).json({ message: "Failed to create student" });
    }
  });

  app.get("/api/students/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const currentUserId = (req as any).auth?.id;
      
      const student = await storage.getStudentWithStatsById(id);
      if (!student) {
        return res.status(404).json({ message: "Student not found" });
      }
      
      // Check if current user is following this student
      let isFollowing = false;
      if (currentUserId && currentUserId !== student.userId) {
        isFollowing = await storage.isFollowingStudent(currentUserId, id);
      }
      
      res.json({
        ...student,
        isFollowing
      });
    } catch (error) {
      console.error('Get student error:', error);
      res.status(500).json({ message: "Failed to fetch student" });
    }
  });

  app.put("/api/students/:id", upload.single("profilePic"), async (req, res) => {
    try {
      const { id } = req.params;
      let updates = req.body;

      // Handle profile picture upload to Cloudinary
      if (req.file) {
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

        updates.profilePicUrl = (result as any).secure_url;
      }

      const student = await storage.updateStudent(id, updates);
      if (!student) {
        return res.status(404).json({ message: "Student not found" });
      }
      res.json(student);
    } catch (error) {
      console.error('Update student error:', error);
      res.status(500).json({ message: "Failed to update student" });
    }
  });

  app.delete("/api/students/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteStudent(id);
      res.json({ message: "Student deleted successfully" });
    } catch (error) {
      console.error('Delete student error:', error);
      res.status(500).json({ message: "Failed to delete student" });
    }
  });

  app.get("/api/schools/:schoolId/students/search", async (req, res) => {
    try {
      const { schoolId } = req.params;
      const { q: query } = req.query;
      
      if (!query || typeof query !== 'string') {
        return res.status(400).json({ message: "Search query required" });
      }

      const students = await storage.searchSchoolStudents(schoolId, query);
      // Join with users table to get email
      const studentsWithEmail = await Promise.all(students.map(async (student) => {
        const [user] = await db.select({ email: users.email }).from(users).where(eq(users.id, student.userId)).limit(1);
        return {
          ...student,
          email: user?.email || ''
        };
      }));
      res.json(studentsWithEmail);
    } catch (error) {
      console.error('Search school students error:', error);
      res.status(500).json({ message: "Search failed" });
    }
  });

  // Student Stats endpoint for admins
  app.get("/api/students/:studentId/stats", async (req, res) => {
    try {
      const { studentId } = req.params;
      
      // Verify student exists
      const student = await storage.getStudent(studentId);
      if (!student) {
        return res.status(404).json({ message: "Student not found" });
      }
      
      // Get student posts - query directly from database to avoid filtering issues
      const studentPosts = await db.select().from(posts).where(eq(posts.studentId, studentId));
      const postsCount = studentPosts.length;
      
      // Calculate engagement metrics
      let totalLikes = 0;
      let totalComments = 0;
      let totalSaves = 0;
      let totalViews = 0;
      
      for (const post of studentPosts) {
        try {
          const likes = await db.select().from(postLikes).where(eq(postLikes.postId, post.id));
          const comments = await db.select().from(postComments).where(eq(postComments.postId, post.id));
          const saves = await db.select().from(savedPosts).where(eq(savedPosts.postId, post.id));
          const views = await db.select().from(postViews).where(eq(postViews.postId, post.id));
          
          totalLikes += likes.length;
          totalComments += comments.length;
          totalSaves += saves.length;
          totalViews += views.length || Math.max(10, likes.length * 5 + comments.length * 3 + saves.length * 2);
        } catch (postError) {
          console.error(`Error calculating stats for post ${post.id}:`, postError);
          // Continue with other posts even if one fails
        }
      }
      
      // Get followers count
      let followersCount = 0;
      try {
        const followersResult = await db
          .select({ count: sql<number>`COUNT(*)` })
          .from(studentFollowers)
          .where(eq(studentFollowers.studentId, studentId));
        followersCount = Number(followersResult[0]?.count || 0);
      } catch (error) {
        console.error('Error getting followers count:', error);
        // Continue with 0 followers if query fails
      }
      
      // Calculate active post days (unique days with posts)
      const postDays = new Set<string>();
      studentPosts.forEach(post => {
        try {
          const postDate = new Date(post.createdAt);
          const dateStr = postDate.toISOString().split('T')[0];
          postDays.add(dateStr);
        } catch (error) {
          // Skip invalid dates
        }
      });
      const activePostDays = postDays.size;
      
      // Calculate total engagement (likes + comments + saves)
      const totalEngagement = totalLikes + totalComments + totalSaves;
      
      res.json({
        posts: postsCount,
        followers: followersCount,
        likes: totalLikes,
        comments: totalComments,
        saves: totalSaves,
        views: totalViews,
        engagement: totalEngagement,
        activePostDays: activePostDays
      });
    } catch (error) {
      console.error('Get student stats error:', error);
      res.status(500).json({ message: "Failed to fetch student stats", error: error instanceof Error ? error.message : String(error) });
    }
  });

  // Student Rating Routes
  app.get("/api/students/:studentId/ratings", async (req, res) => {
    try {
      const { studentId } = req.params;
      const ratings = await storage.getStudentRatings(studentId);
      const averageRating = await storage.getAverageRating(studentId);
      res.json({ ratings, averageRating });
    } catch (error) {
      console.error('Get student ratings error:', error);
      res.status(500).json({ message: "Failed to fetch student ratings" });
    }
  });

  app.post("/api/students/:studentId/ratings", requireAuth, async (req, res) => {
    try {
      const { studentId } = req.params;
      
      // TODO: Get the current user from session/auth
      // For now, using a placeholder - in real app this would come from authenticated user
      // Remove header-based identity spoofing - all identity from server-side auth
      
      const ratingData = insertStudentRatingSchema.parse({
        ...req.body,
        studentId,
        raterId: (req as any).auth.id // Use authenticated user's ID as rater
      });

      const rating = await storage.createStudentRating(ratingData);
      res.json(rating);
    } catch (error) {
      console.error('Create student rating error:', error);
      res.status(400).json({ message: "Failed to create student rating" });
    }
  });

  app.put("/api/ratings/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      
      const rating = await storage.updateStudentRating(id, updates);
      if (!rating) {
        return res.status(404).json({ message: "Rating not found" });
      }
      res.json(rating);
    } catch (error) {
      console.error('Update student rating error:', error);
      res.status(500).json({ message: "Failed to update student rating" });
    }
  });

  app.delete("/api/ratings/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteStudentRating(id);
      res.json({ message: "Rating deleted successfully" });
    } catch (error) {
      console.error('Delete student rating error:', error);
      res.status(500).json({ message: "Failed to delete student rating" });
    }
  });

  // School Settings Routes
  app.get("/api/schools/:schoolId/settings", async (req, res) => {
    try {
      const { schoolId } = req.params;
      const settings = await storage.getSchoolSettings(schoolId);
      res.json(settings);
    } catch (error) {
      console.error('Get school settings error:', error);
      res.status(500).json({ message: "Failed to fetch school settings" });
    }
  });

  app.post("/api/schools/:schoolId/settings", async (req, res) => {
    try {
      const { schoolId } = req.params;
      const settingData = insertSchoolSettingSchema.parse({
        ...req.body,
        schoolId,
      });

      const setting = await storage.createOrUpdateSchoolSetting(settingData);
      res.json(setting);
    } catch (error) {
      console.error('Update school setting error:', error);
      res.status(400).json({ message: "Failed to update school setting" });
    }
  });

  app.delete("/api/schools/:schoolId/settings/:key", async (req, res) => {
    try {
      const { schoolId, key } = req.params;
      await storage.deleteSchoolSetting(schoolId, key);
      res.json({ message: "School setting deleted successfully" });
    } catch (error) {
      console.error('Delete school setting error:', error);
      res.status(500).json({ message: "Failed to delete school setting" });
    }
  });

  // Enhanced school stats for analytics
  app.get("/api/schools/:schoolId/analytics", requireAuth, async (req, res) => {
    try {
      const { schoolId } = req.params;
      const authSchoolId = req.user?.schoolId || (req as any).auth?.schoolId;
      
      // Ensure school admins can only access their own school's analytics
      if (authSchoolId && authSchoolId !== schoolId) {
        return res.status(403).json({ 
          error: { 
            code: 'access_denied', 
            message: 'You can only access your own school\'s analytics' 
          } 
        });
      }
      
      const students = await storage.getStudentsBySchool(schoolId);
      const studentIds = students.map(s => s.id);
      const totalStudents = students.length;
      
      // Get student engagement statistics instead of ratings
      const engagementStats = await Promise.all(
        students.map(async (student) => {
          // Get student posts
          const studentPosts = await db
            .select()
            .from(posts)
            .where(
              and(
                eq(posts.studentId, student.id),
                sql`${posts.type} != 'announcement' OR ${posts.type} IS NULL`
              )
            );
          
          let totalEngagement = 0;
          let totalLikes = 0;
          let totalComments = 0;
          let totalViews = 0;
          let totalFollowers = 0;
          
          for (const post of studentPosts) {
            const likes = await db.select().from(postLikes).where(eq(postLikes.postId, post.id));
            const comments = await db.select().from(postComments).where(eq(postComments.postId, post.id));
            const views = await db.select().from(postViews).where(eq(postViews.postId, post.id));
            
            totalLikes += likes.length;
            totalComments += comments.length;
            totalViews += views.length;
            totalEngagement += likes.length + comments.length + views.length;
          }
          
          // Get followers count
          const followers = await db
            .select()
            .from(studentFollowers)
            .where(eq(studentFollowers.studentId, student.id));
          totalFollowers = followers.length;
          
          // Calculate engagement score (normalized 0-100)
          // Based on: posts count, engagement per post, followers, and consistency
          const avgEngagementPerPost = studentPosts.length > 0 
            ? totalEngagement / studentPosts.length 
            : 0;
          
          // Score calculation: 
          // - Base score from engagement per post (0-50 points)
          // - Posts count bonus (up to 20 points)
          // - Followers bonus (up to 20 points)
          // - Views bonus (up to 10 points)
          const engagementScore = Math.min(100, Math.round(
            Math.min(50, avgEngagementPerPost * 5) + // Engagement quality (0-50)
            Math.min(20, studentPosts.length * 2) + // Post activity (0-20)
            Math.min(20, totalFollowers * 1.5) + // Social reach (0-20)
            Math.min(10, totalViews / 10) // Visibility (0-10)
          ));
          
          return {
            studentId: student.id,
            totalPosts: studentPosts.length,
            totalEngagement,
            totalLikes,
            totalComments,
            totalViews,
            totalFollowers,
            engagementScore,
            avgEngagementPerPost: Math.round(avgEngagementPerPost * 10) / 10
          };
        })
      );

      // Calculate average engagement metrics
      const studentsWithPosts = engagementStats.filter(stat => stat.totalPosts > 0);
      const averageEngagementPerStudent = studentsWithPosts.length > 0
        ? Math.round((engagementStats.reduce((sum, stat) => sum + stat.totalEngagement, 0) / studentsWithPosts.length) * 10) / 10
        : 0;
      
      const averageEngagementScore = engagementStats.length > 0
        ? Math.round((engagementStats.reduce((sum, stat) => sum + stat.engagementScore, 0) / engagementStats.length) * 10) / 10
        : 0;

      // Grade distribution
      const gradeDistribution = students.reduce((acc, student) => {
        const grade = student.grade || 'Unknown';
        acc[grade] = (acc[grade] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // Gender distribution  
      const genderDistribution = students.reduce((acc, student) => {
        const gender = student.gender || 'Not specified';
        acc[gender] = (acc[gender] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      res.json({
        totalStudents,
        averageEngagementPerStudent,
        averageEngagementScore,
        gradeDistribution,
        genderDistribution,
        engagementStats: engagementStats.filter(stat => stat.totalPosts > 0).sort((a, b) => b.totalEngagement - a.totalEngagement),
      });
    } catch (error) {
      console.error('Get school analytics error:', error);
      res.status(500).json({ message: "Failed to fetch school analytics" });
    }
  });

  // Get engagement trends
  app.get("/api/schools/:schoolId/analytics/engagement-trends", requireAuth, async (req, res) => {
    try {
      const { schoolId } = req.params;
      const period = (req.query.period as string) || 'week';
      const authSchoolId = req.user?.schoolId || (req as any).auth?.schoolId;
      
      if (authSchoolId && authSchoolId !== schoolId) {
        return res.status(403).json({ 
          error: { code: 'access_denied', message: 'Access denied' } 
        });
      }
      
      const trends = await storage.getSchoolEngagementTrends(schoolId, period);
      res.json(trends);
    } catch (error) {
      console.error('Get engagement trends error:', error);
      res.status(500).json({ message: "Failed to fetch engagement trends" });
    }
  });

  // Get post trends
  app.get("/api/schools/:schoolId/analytics/post-trends", requireAuth, async (req, res) => {
    try {
      const { schoolId } = req.params;
      const period = (req.query.period as string) || 'week';
      const authSchoolId = req.user?.schoolId || (req as any).auth?.schoolId;
      
      if (authSchoolId && authSchoolId !== schoolId) {
        return res.status(403).json({ 
          error: { code: 'access_denied', message: 'Access denied' } 
        });
      }
      
      const trends = await storage.getSchoolPostTrends(schoolId, period);
      res.json(trends);
    } catch (error) {
      console.error('Get post trends error:', error);
      res.status(500).json({ message: "Failed to fetch post trends" });
    }
  });

  // Get post analytics
  app.get("/api/schools/:schoolId/analytics/posts", requireAuth, async (req, res) => {
    try {
      const { schoolId } = req.params;
      const limit = parseInt(req.query.limit as string) || 10;
      const authSchoolId = req.user?.schoolId || (req as any).auth?.schoolId;
      
      if (authSchoolId && authSchoolId !== schoolId) {
        return res.status(403).json({ 
          error: { code: 'access_denied', message: 'Access denied' } 
        });
      }
      
      const analytics = await storage.getSchoolPostAnalytics(schoolId, limit);
      res.json(analytics);
    } catch (error) {
      console.error('Get post analytics error:', error);
      res.status(500).json({ message: "Failed to fetch post analytics" });
    }
  });

  // Get student engagement metrics
  app.get("/api/schools/:schoolId/analytics/student-engagement", requireAuth, async (req, res) => {
    try {
      const { schoolId } = req.params;
      const period = (req.query.period as string) || 'month';
      const authSchoolId = req.user?.schoolId || (req as any).auth?.schoolId;
      
      if (authSchoolId && authSchoolId !== schoolId) {
        return res.status(403).json({ 
          error: { code: 'access_denied', message: 'Access denied' } 
        });
      }
      
      const engagement = await storage.getSchoolStudentEngagement(schoolId, period);
      res.json(engagement);
    } catch (error) {
      console.error('Get student engagement error:', error);
      res.status(500).json({ message: "Failed to fetch student engagement" });
    }
  });

  // Get sport analytics
  app.get("/api/schools/:schoolId/analytics/sports", requireAuth, async (req, res) => {
    try {
      const { schoolId } = req.params;
      const authSchoolId = req.user?.schoolId || (req as any).auth?.schoolId;
      
      if (authSchoolId && authSchoolId !== schoolId) {
        return res.status(403).json({ 
          error: { code: 'access_denied', message: 'Access denied' } 
        });
      }
      
      const analytics = await storage.getSchoolSportAnalytics(schoolId);
      res.json(analytics);
    } catch (error) {
      console.error('Get sport analytics error:', error);
      res.status(500).json({ message: "Failed to fetch sport analytics" });
    }
  });

  // Test database connection
  app.get("/api/test-db", async (req, res) => {
    try {
      const result = await db.select().from(users).limit(1);
      res.json({ status: "ok", users: result });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Test auth storage
  app.get("/api/test-auth", async (req, res) => {
    try {
      const result = await authStorage.getUserByEmail("admin@lockerroom.com");
      res.json({ status: "ok", user: result });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Test student insert
  app.post("/api/test-student", async (req, res) => {
    try {
      const [student] = await db.insert(students).values({
        schoolId: "5c477cc8-86d3-4d45-b0ed-b78f83bd46fe",
        name: "Test Student",
        phone: null,
        gender: null,
        dateOfBirth: null,
        grade: null,
        guardianContact: null,
        profilePicUrl: null,
        roleNumber: null,
        position: null,
        sport: null,
        bio: null,
        coverPhoto: null,
      }).returning();
      res.json({ status: "ok", student });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Test auth storage createUserWithProfile
  app.post("/api/test-auth-create", async (req, res) => {
    try {
      const result = await authStorage.createUserWithProfile(
        "test@example.com",
        "password123",
        "student",
        { name: "Test Student", schoolId: "5c477cc8-86d3-4d45-b0ed-b78f83bd46fe" }
      );
      res.json({ status: "ok", result });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });


  // Payment intent creation (Stripe or mock)
  app.post("/api/xen-watch/pay-intent", requireAuth, async (req, res) => {
    try {
      const { submissionId } = req.body;
      
      // Get payment configuration from database
      const paymentConfig = await storage.getSystemPayment();
      const mockModeEnabled = paymentConfig?.mockModeEnabled !== false;
      const provider = paymentConfig?.provider || 'none';
      
      // If mock mode is enabled, return mock response
      if (mockModeEnabled) {
        res.json({ mock: true });
        return;
      }
      
      // If provider is none or not configured, use mock mode
      if (provider === 'none') {
        res.json({ mock: true });
        return;
      }
      
      // Stripe integration
      if (provider === 'stripe' && stripe) {
        try {
          const amount = paymentConfig?.xenScoutPriceCents || 1000;
          const currency = paymentConfig?.currency || 'usd';
          
          const paymentIntent = await stripe.paymentIntents.create({
            amount,
            currency,
            metadata: {
              submissionId,
              studentId: (req as any).auth.id
            }
          });
          
          res.json({ 
            clientSecret: paymentIntent.client_secret,
            mock: false
          });
        } catch (stripeError) {
          console.error('Stripe error:', stripeError);
          res.status(500).json({ error: { message: 'Payment processing error' } });
        }
      } else if (provider === 'stripe' && !stripe) {
        // Stripe not configured, fall back to mock
        res.json({ mock: true });
      } else if (provider === 'paypal') {
        // PayPal integration would go here
        // For now, return error indicating PayPal is not yet implemented
        res.status(501).json({ error: { message: 'PayPal integration not yet implemented' } });
      } else {
        // Unknown provider, use mock mode
        res.json({ mock: true });
      }
    } catch (error) {
      console.error('Error creating payment intent:', error);
      res.status(500).json({ error: { message: 'Failed to create payment intent' } });
    }
  });

  // Mark submission as paid (dev fallback)
  app.post("/api/xen-watch/mark-paid", requireAuth, async (req, res) => {
    try {
      const { submissionId, provider = 'mock', intentId = 'mock_intent' } = req.body;
      
      await storage.markSubmissionPaid(submissionId, provider, intentId);
      res.json({ success: true });
    } catch (error) {
      console.error('Error marking submission as paid:', error);
      res.status(500).json({ error: { message: 'Failed to mark submission as paid' } });
    }
  });

  // Student's submissions
  app.get("/api/xen-watch/my-submissions", requireAuth, async (req, res) => {
    try {
      const studentId = (req as any).auth.id;
      const submissions = await storage.listMySubmissions(studentId);
      res.json({ submissions });
    } catch (error) {
      console.error('Error fetching submissions:', error);
      res.status(500).json({ error: { message: 'Failed to fetch submissions' } });
    }
  });

  // Scouts - list submissions
  app.get("/api/xen-watch/submissions", requireAuth, requireScoutOrAdmin, async (req, res) => {
    try {
      const { assignedTo = 'all', status } = req.query;
      const scoutId = (req as any).auth.linkedId; // This should be the scout profile ID
      
      const submissions = await storage.listSubmissionsForScouts({
        assignedTo: assignedTo as 'me' | 'all',
        status: status as string,
        scoutId
      });
      
      res.json({ submissions });
    } catch (error) {
      console.error('Error fetching submissions for scouts:', error);
      res.status(500).json({ error: { message: 'Failed to fetch submissions' } });
    }
  });

  // Get specific submission with details
  app.get("/api/xen-watch/submissions/:id", requireAuth, requireScoutOrAdmin, async (req, res) => {
    try {
      const submission = await storage.getSubmissionWithJoins(req.params.id);
      if (!submission) {
        return res.status(404).json({ error: { message: 'Submission not found' } });
      }
      res.json({ submission });
    } catch (error) {
      console.error('Error fetching submission:', error);
      res.status(500).json({ error: { message: 'Failed to fetch submission' } });
    }
  });

  // Add review to submission
  app.post("/api/xen-watch/submissions/:id/reviews", requireAuth, requireScoutOrAdmin, async (req, res) => {
    try {
      const { rating, comment } = req.body;
      const scoutId = (req as any).auth.linkedId;
      
      if (rating < 1 || rating > 5) {
        return res.status(400).json({ error: { message: 'Rating must be between 1 and 5' } });
      }
      
      const review = await storage.addReview({
        submissionId: req.params.id,
        scoutId,
        rating,
        comment
      });
      
      res.json({ review });
    } catch (error) {
      console.error('Error adding review:', error);
      res.status(500).json({ error: { message: 'Failed to add review' } });
    }
  });

  // Scout Admin - create Scout Admin (System Admin only)
  app.post("/api/admin/scout-admins", requireAuth, requireSystemAdmin, async (req, res) => {
    try {
      const { name, email, xenId, profilePicUrl } = req.body;
      
      const result = await storage.createScoutAdmin({
        name,
        email,
        xenId,
        profilePicUrl
      });
      
      res.json({ user: result.user, profile: result.profile });
    } catch (error) {
      console.error('Error creating Scout Admin:', error);
      res.status(500).json({ error: { message: 'Failed to create Scout Admin' } });
    }
  });

  // Scout Admin - create Scout
  app.post("/api/admin/scouts", requireAuth, requireScoutAdmin, async (req, res) => {
    try {
      const { name, email, xenId, profilePicUrl } = req.body;
      
      const result = await storage.createScout({
        name,
        email,
        xenId,
        profilePicUrl
      });
      
      res.json({ user: result.user, profile: result.profile });
    } catch (error) {
      console.error('Error creating Scout:', error);
      res.status(500).json({ error: { message: 'Failed to create Scout' } });
    }
  });

  // Get available scouts
  app.get("/api/admin/scouts", requireAuth, async (req, res) => {
    try {
      const scouts = await storage.getScoutProfiles();
      res.json({ scouts });
    } catch (error) {
      console.error('Error fetching scouts:', error);
      res.status(500).json({ error: { message: 'Failed to fetch scouts' } });
    }
  });

  // Assign submission to scout
  app.patch("/api/xen-watch/submissions/:id/assign", requireAuth, requireScoutAdmin, async (req, res) => {
    try {
      const { scoutProfileId } = req.body;
      
      if (scoutProfileId === 'auto') {
        // TODO: Implement auto-assignment logic
        return res.status(400).json({ error: { message: 'Auto-assignment not yet implemented' } });
      }
      
      await storage.assignSubmission(req.params.id, scoutProfileId);
      res.json({ success: true });
    } catch (error) {
      console.error('Error assigning submission:', error);
      res.status(500).json({ error: { message: 'Failed to assign submission' } });
    }
  });

  // Send final feedback
  app.post("/api/xen-watch/submissions/:id/final-feedback", requireAuth, requireScoutAdmin, async (req, res) => {
    try {
      const { message } = req.body;
      const adminUserId = (req as any).auth.id;
      
      const feedback = await storage.sendFinalFeedback({
        submissionId: req.params.id,
        adminUserId,
        message
      });
      
      res.json({ feedback });
    } catch (error) {
      console.error('Error sending final feedback:', error);
      res.status(500).json({ error: { message: 'Failed to send feedback' } });
    }
  });

  // Analytics overview
  app.get("/api/xen-watch/analytics/overview", requireAuth, requireScoutAdmin, async (req, res) => {
    try {
      const analytics = await storage.getXenWatchAnalytics();
      res.json(analytics);
    } catch (error) {
      console.error('Error fetching analytics:', error);
      res.status(500).json({ error: { message: 'Failed to fetch analytics' } });
    }
  });

  // GET /api/scouts/count - Get total number of scouts
  app.get("/api/scouts/count", requireAuth, requireScoutAdmin, async (req, res) => {
    try {
      const count = await storage.getScoutsCount();
      res.json({ totalScouts: count });
    } catch (error) {
      console.error('Error fetching scouts count:', error);
      res.status(500).json({ error: { message: 'Failed to fetch scouts count' } });
    }
  });

  // GET /api/scouts/analytics - Get detailed scout analytics and CRM data
  app.get("/api/scouts/analytics", requireAuth, requireScoutAdmin, async (req, res) => {
    try {
      const timeFilter = req.query.timeFilter as string || 'all';
      const analytics = await storage.getScoutAnalytics(timeFilter);
      res.json(analytics);
    } catch (error) {
      console.error('Error fetching scout analytics:', error);
      res.status(500).json({ error: { message: 'Failed to fetch scout analytics' } });
    }
  });

  // GET /api/scouts/detailed - Get detailed scout profiles with performance metrics
  app.get("/api/scouts/detailed", requireAuth, requireScoutAdmin, async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const search = req.query.search as string || '';
      const scouts = await storage.getDetailedScoutProfiles({ page, limit, search });
      res.json(scouts);
    } catch (error) {
      console.error('Error fetching detailed scouts:', error);
      res.status(500).json({ error: { message: 'Failed to fetch detailed scouts' } });
    }
  });

  // POST /api/scouts/create-sample-data - Create sample data for testing (Scout Admin only)
  app.post("/api/scouts/create-sample-data", requireAuth, requireScoutAdmin, async (req, res) => {
    try {
      const result = await storage.createSampleScoutData();
      res.json({ 
        success: true, 
        message: 'Sample data created successfully',
        data: result
      });
    } catch (error) {
      console.error('Error creating sample data:', error);
      res.status(500).json({ error: { message: 'Failed to create sample data' } });
    }
  });

  // Stripe webhook for payment confirmation
  app.post("/api/webhooks/stripe", async (req, res) => {
    if (!stripe) {
      return res.status(400).json({ error: { message: 'Stripe not configured' } });
    }

    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!sig || !webhookSecret) {
      return res.status(400).json({ error: { message: 'Missing webhook signature or secret' } });
    }

    let event;

    try {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      return res.status(400).json({ error: { message: 'Invalid signature' } });
    }

    // Handle the event
    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object;
      const { submissionId } = paymentIntent.metadata;

      if (submissionId) {
        try {
          await storage.markSubmissionPaid(
            submissionId, 
            'stripe', 
            paymentIntent.id
          );
          console.log(`Payment succeeded for submission ${submissionId}`);
        } catch (error) {
          console.error('Error marking submission as paid:', error);
        }
      }
    }

    res.json({ received: true });
  });

  // Test getUserByEmail
  app.get("/api/test-get-user/:email", async (req, res) => {
    try {
      const result = await authStorage.getUserByEmail(req.params.email);
      res.json({ status: "ok", user: result });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
