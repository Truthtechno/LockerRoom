import { Express } from 'express';
import { requireAuth, requireRole } from '../middleware/auth';
import { db } from '../db';
import { users, submissions, submissionReviews, submissionFinalFeedback, students } from '../../shared/schema';
import { eq, sql, desc } from 'drizzle-orm';
import bcrypt from 'bcrypt';
import { AuthStorage } from '../auth-storage';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { notifyScoutAdminsOfNewScout, notifyScoutsOfSubmissionFinalized, notifyStudentOfSubmissionFeedback } from '../utils/notification-helpers';

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

export function registerScoutAdminRoutes(app: Express) {
  // Create Scout
  app.post('/api/scout-admin/create-scout',
    requireAuth,
    requireRole('scout_admin'),
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

        // Update linkedId to point to the user's own ID
        await db.update(users)
          .set({ linkedId: newUser.id })
          .where(eq(users.id, newUser.id));

        // Assign new scout to all existing submissions
        try {
          const existingSubmissions = await db
            .select({ id: submissions.id })
            .from(submissions)
            .where(eq(submissions.status, 'in_review'));

          if (existingSubmissions.length > 0) {
            const reviewPlaceholders = existingSubmissions.map(submission => ({
              submissionId: submission.id,
              scoutId: newUser.id,
              rating: null,
              notes: null,
              isSubmitted: false
            }));

            await db.insert(submissionReviews).values(reviewPlaceholders);
            console.log(`📝 Assigned ${existingSubmissions.length} existing submissions to new scout`);
          }
        } catch (error) {
          console.error('Error assigning existing submissions to new scout:', error);
          // Don't fail the scout creation if assignment fails
        }

        console.log(`🎯 Scout created: ${newUser.name} (XEN ID: ${newUser.xenId})`);

        // Notify scout admins about the new scout
        notifyScoutAdminsOfNewScout(newUser.id, newUser.name).catch(err => {
          console.error('❌ Failed to notify scout admins (non-critical):', err);
        });

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
          message: "Scout created successfully with temporary password"
        });

      } catch (error) {
        console.error('Create scout error:', error);
        res.status(500).json({
          error: {
            code: 'create_failed',
            message: 'Failed to create scout'
          }
        });
      }
    }
  );

  // Get Scouts List - All scouts can see other scouts
  app.get('/api/scouts',
    requireAuth,
    requireRole(['scout_admin', 'xen_scout']),
    async (req, res) => {
      try {
        const scouts = await db.select({
          id: users.id,
          name: users.name,
          email: users.email,
          role: users.role,
          xenId: users.xenId,
          profilePicUrl: users.profilePicUrl,
          createdAt: users.createdAt,
        }).from(users).where(eq(users.role, 'xen_scout'));

        res.json(scouts);
      } catch (error) {
        console.error('Get scouts error:', error);
        res.status(500).json({
          error: {
            code: 'fetch_failed',
            message: 'Failed to fetch scouts'
          }
        });
      }
    }
  );

  // Get Scout Submissions - All scouts see all pending submissions
  app.get('/api/scouts/my-submissions',
    requireAuth,
    requireRole(['scout_admin', 'xen_scout']),
    async (req, res) => {
      try {
        const auth = (req as any).auth;
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const offset = (page - 1) * limit;

        // Get submissions assigned to this scout with review status
        const submissionsData = await db
          .select({
            submission: submissions,
            review: submissionReviews,
            student: {
              id: students.id,
              name: students.name,
              profilePicUrl: students.profilePicUrl
            }
          })
          .from(submissionReviews)
          .leftJoin(submissions, eq(submissionReviews.submissionId, submissions.id))
          .leftJoin(students, eq(submissions.studentId, students.userId))
          .where(eq(submissionReviews.scoutId, auth.id))
          .orderBy(desc(submissions.createdAt))
          .limit(limit)
          .offset(offset);

        // Get total count
        const [{ count }] = await db
          .select({ count: sql<number>`COUNT(*)` })
          .from(submissionReviews)
          .where(eq(submissionReviews.scoutId, auth.id));

        const result = submissionsData.map(row => ({
          ...row.submission,
          review: row.review,
          student: row.student
        }));

        res.json({ 
          submissions: result,
          pagination: {
            page,
            limit,
            total: count,
            totalPages: Math.ceil(count / limit)
          }
        });
      } catch (error) {
        console.error('Get submissions error:', error);
        res.status(500).json({
          error: {
            code: 'fetch_failed',
            message: 'Failed to fetch submissions'
          }
        });
      }
    }
  );

  // Scout Admin Dashboard - Get all submissions with filtering and analytics
  app.get('/api/scout-admin/dashboard',
    requireAuth,
    requireRole('scout_admin'),
    async (req, res) => {
      try {
        const auth = (req as any).auth;
        const timeFilter = req.query.timeFilter as string || 'all'; // all, 7d, 30d, 6m, 1y
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;
        const offset = (page - 1) * limit;

        // Build time filter condition
        let timeCondition = sql`1=1`;
        const now = new Date();
        switch (timeFilter) {
          case '7d':
            timeCondition = sql`${submissions.createdAt} >= ${new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)}`;
            break;
          case '30d':
            timeCondition = sql`${submissions.createdAt} >= ${new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)}`;
            break;
          case '6m':
            timeCondition = sql`${submissions.createdAt} >= ${new Date(now.getTime() - 6 * 30 * 24 * 60 * 60 * 1000)}`;
            break;
          case '1y':
            timeCondition = sql`${submissions.createdAt} >= ${new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)}`;
            break;
        }

        // Get submissions with reviews and student info
        const submissionsData = await db
          .select({
            submission: submissions,
            student: {
              id: students.id,
              name: students.name,
              profilePicUrl: students.profilePicUrl
            },
            totalReviews: sql<number>`COUNT(DISTINCT ${submissionReviews.scoutId})`,
            submittedReviews: sql<number>`COUNT(CASE WHEN ${submissionReviews.isSubmitted} = true THEN 1 END)`,
            avgRating: sql<number>`AVG(CASE WHEN ${submissionReviews.isSubmitted} = true THEN ${submissionReviews.rating} END)`
          })
          .from(submissions)
          .leftJoin(students, eq(submissions.studentId, students.userId))
          .leftJoin(submissionReviews, eq(submissions.id, submissionReviews.submissionId))
          .where(timeCondition)
          .groupBy(submissions.id, students.id)
          .orderBy(desc(submissions.createdAt))
          .limit(limit)
          .offset(offset);

        // Get analytics
        const analytics = await db
          .select({
            totalSubmissions: sql<number>`COUNT(*)`,
            inReviewSubmissions: sql<number>`COUNT(CASE WHEN ${submissions.status} = 'in_review' THEN 1 END)`,
            finalizedSubmissions: sql<number>`COUNT(CASE WHEN ${submissions.status} = 'finalized' THEN 1 END)`,
            rejectedSubmissions: sql<number>`COUNT(CASE WHEN ${submissions.status} = 'rejected' THEN 1 END)`,
            totalReviews: sql<number>`COUNT(DISTINCT ${submissionReviews.id})`,
            submittedReviews: sql<number>`COUNT(CASE WHEN ${submissionReviews.isSubmitted} = true THEN 1 END)`,
            avgRating: sql<number>`AVG(CASE WHEN ${submissionReviews.isSubmitted} = true THEN ${submissionReviews.rating} END)`
          })
          .from(submissions)
          .leftJoin(submissionReviews, eq(submissions.id, submissionReviews.submissionId))
          .where(timeCondition);

        // Get total count for pagination
        const [{ count }] = await db
          .select({ count: sql<number>`COUNT(*)` })
          .from(submissions)
          .where(timeCondition);

        const result = submissionsData.map(row => ({
          ...row.submission,
          student: row.student,
          reviewProgress: {
            totalScouts: row.totalReviews,
            submittedCount: row.submittedReviews,
            avgRating: row.avgRating
          }
        }));

        res.json({
          submissions: result,
          analytics: analytics[0],
          pagination: {
            page,
            limit,
            total: count,
            totalPages: Math.ceil(count / limit)
          }
        });
      } catch (error) {
        console.error('Get scout admin dashboard error:', error);
        res.status(500).json({
          error: {
            code: 'fetch_failed',
            message: 'Failed to fetch dashboard data'
          }
        });
      }
    }
  );

  // Scout Admin Finalize Submission
  app.post('/api/scout-admin/finalize/:submissionId',
    requireAuth,
    requireRole('scout_admin'),
    async (req, res) => {
      try {
        const auth = (req as any).auth;
        const { submissionId } = req.params;
        const { finalRating, summary } = req.body;

        // Validate final rating if provided
        if (finalRating !== null && finalRating !== undefined) {
          if (finalRating < 1 || finalRating > 5) {
            return res.status(400).json({ 
              error: { 
                code: "validation_error", 
                message: "Final rating must be between 1 and 5" 
              } 
            });
          }
        }

        // Create final feedback
        const [finalFeedback] = await db.insert(submissionFinalFeedback).values({
          submissionId,
          adminId: auth.id,
          finalRating: finalRating || null,
          summary: summary || null
        }).returning();

        // Update submission status to finalized
        const [updatedSubmission] = await db
          .update(submissions)
          .set({ 
            status: 'finalized',
            updatedAt: sql`NOW()`
          })
          .where(eq(submissions.id, submissionId))
          .returning();

        // Notify all scouts that the submission has been finalized
        notifyScoutsOfSubmissionFinalized(submissionId).catch(err => {
          console.error('❌ Failed to notify scouts of finalization (non-critical):', err);
        });

        // Notify the student that their feedback is ready
        if (updatedSubmission?.studentId) {
          notifyStudentOfSubmissionFeedback(submissionId, updatedSubmission.studentId).catch(err => {
            console.error('❌ Failed to notify student of feedback (non-critical):', err);
          });
        }

        res.json({ 
          success: true,
          finalFeedback 
        });
      } catch (error) {
        console.error('Error finalizing submission:', error);
        res.status(500).json({ 
          error: { 
            code: "internal_error", 
            message: "Failed to finalize submission" 
          } 
        });
      }
    }
  );
}
