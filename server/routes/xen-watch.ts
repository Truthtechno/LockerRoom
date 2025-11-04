import express from "express";
import { eq, and, desc, sql, inArray } from "drizzle-orm";
import { db } from "../db";
import { 
  submissions, 
  submissionReviews, 
  submissionFinalFeedback,
  paymentTransactions,
  users,
  admins,
  scoutProfiles,
  students,
  schools,
  insertSubmissionSchema,
  insertSubmissionReviewSchema,
  insertSubmissionFinalFeedbackSchema,
  type SubmissionDB,
  type SubmissionReviewDB,
  type SubmissionFinalFeedbackDB
} from "@shared/schema";
import { requireAuth, requireRoles } from "../middleware/auth";
import { notifyScoutsOfNewSubmission, notifyScoutsOfReviewUpdate, notifyScoutsOfSubmissionFinalized, notifyStudentOfSubmission, notifyStudentOfSubmissionFeedback } from "../utils/notification-helpers";

const router = express.Router();
// POST /api/xen-watch/submissions - Create new submission (student only)
router.post("/submissions", requireAuth, requireRoles(['student']), async (req, res) => {
    try {
      const auth = (req as any).auth;
      const { videoUrl, thumbUrl, notes, promoCode, transactionId } = req.body;

      if (!videoUrl) {
        return res.status(400).json({ 
          error: { 
            code: "validation_error", 
            message: "Video URL is required" 
          } 
        });
      }

      // If transactionId is provided, verify the payment transaction is completed
      if (transactionId) {
        const [transaction] = await db
          .select()
          .from(paymentTransactions)
          .where(and(
            eq(paymentTransactions.id, transactionId),
            eq(paymentTransactions.userId, auth.id),
            eq(paymentTransactions.type, 'xen_watch')
          ));

        if (!transaction) {
          return res.status(400).json({ 
            error: { 
              code: "validation_error", 
              message: "Invalid payment transaction" 
            } 
          });
        }

        if (transaction.status !== 'completed') {
          return res.status(400).json({ 
            error: { 
              code: "validation_error", 
              message: "Payment transaction is not completed" 
            } 
          });
        }
      }

      // Validate input
      const submissionData = {
        studentId: auth.id, // Use the user ID, not the linked student profile ID
        videoUrl,
        thumbUrl: thumbUrl || null,
        notes: notes || null,
        promoCode: promoCode || null,
        status: 'in_review' as const
      };

      const validatedData = insertSubmissionSchema.parse(submissionData);

      // Create submission
      const [submission] = await db.insert(submissions).values(validatedData).returning();

      // Get all scouts (xen_scout and scout_admin roles)
      const scouts = await db
        .select({ id: users.id })
        .from(users)
        .where(inArray(users.role, ['xen_scout', 'scout_admin']));

      // Create placeholder reviews for all scouts
      if (scouts.length > 0) {
        const reviewPlaceholders = scouts.map(scout => ({
          submissionId: submission.id,
          scoutId: scout.id,
          rating: null,
          notes: null,
          isSubmitted: false
        }));

        await db.insert(submissionReviews).values(reviewPlaceholders);
      }

      // Notify all scouts and scout admins about the new submission
      notifyScoutsOfNewSubmission(submission.id, submission.studentId).catch(err => {
        console.error('❌ Failed to notify scouts (non-critical):', err);
      });

      // Notify the student that their submission was received
      notifyStudentOfSubmission(submission.id, submission.studentId).catch(err => {
        console.error('❌ Failed to notify student (non-critical):', err);
      });

      res.json({ submission });
    } catch (error) {
      console.error("Error creating submission:", error);
      res.status(500).json({ 
        error: { 
          code: "internal_error", 
          message: "Failed to create submission" 
        } 
      });
    }
  });

  // GET /api/xen-watch/submissions/me - Get student's submissions
  router.get("/submissions/me", requireAuth, requireRoles(['student']), async (req, res) => {
    try {
      const auth = (req as any).auth;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const offset = (page - 1) * limit;

      // Get submissions with review progress and final feedback
      // Note: submissions.studentId references users.id directly, not students.id
      const submissionsData = await db
        .select({
          submission: submissions,
          finalFeedback: submissionFinalFeedback,
          totalScouts: sql<number>`COUNT(DISTINCT ${submissionReviews.scoutId})`,
          submittedCount: sql<number>`COUNT(CASE WHEN ${submissionReviews.isSubmitted} = true THEN 1 END)`
        })
        .from(submissions)
        .leftJoin(submissionFinalFeedback, eq(submissions.id, submissionFinalFeedback.submissionId))
        .leftJoin(submissionReviews, eq(submissions.id, submissionReviews.submissionId))
        .where(eq(submissions.studentId, auth.id))
        .groupBy(submissions.id, submissionFinalFeedback.id)
        .orderBy(desc(submissions.createdAt))
        .limit(limit)
        .offset(offset);

      // Get student info separately (auth.id is the user ID, not student ID)
      const [studentInfo] = await db
        .select({
          id: students.id,
          name: students.name,
          position: students.position,
          schoolId: students.schoolId,
          phone: students.phone,
          height: students.height,
          weight: students.weight,
          school: {
            id: schools.id,
            name: schools.name
          }
        })
        .from(students)
        .leftJoin(schools, eq(students.schoolId, schools.id))
        .where(eq(students.userId, auth.id));


      // Get total count
      const [{ count }] = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(submissions)
        .where(eq(submissions.studentId, auth.id));

      // Get individual scout reviews for each submission (only submitted reviews for privacy)
      const submissionIds = submissionsData.map(row => row.submission.id);
      const scoutReviews = submissionIds.length > 0 ? await db
        .select({
          id: submissionReviews.id,
          submissionId: submissionReviews.submissionId,
          scoutId: submissionReviews.scoutId,
          rating: submissionReviews.rating,
          notes: submissionReviews.notes,
          isSubmitted: submissionReviews.isSubmitted,
          createdAt: submissionReviews.createdAt,
          scout: {
            id: users.id,
            name: users.name,
            role: users.role
          }
        })
        .from(submissionReviews)
        .leftJoin(users, eq(submissionReviews.scoutId, users.id))
        .where(
          and(
            inArray(submissionReviews.submissionId, submissionIds),
            eq(submissionReviews.isSubmitted, true) // Only fetch submitted reviews for privacy
          )
        )
        .orderBy(submissionReviews.createdAt) : [];

      // Group reviews by submission ID
      const reviewsBySubmission = scoutReviews.reduce((acc, review) => {
        if (!acc[review.submissionId]) {
          acc[review.submissionId] = [];
        }
        acc[review.submissionId].push(review);
        return acc;
      }, {} as Record<string, typeof scoutReviews>);

      const result = submissionsData.map(row => ({
        ...row.submission,
        student: studentInfo ? {
          id: studentInfo.id,
          name: studentInfo.name,
          position: studentInfo.position,
          schoolId: studentInfo.schoolId,
          school: studentInfo.school
        } : null,
        finalFeedback: row.finalFeedback,
        reviewProgress: {
          totalScouts: row.totalScouts,
          submittedCount: row.submittedCount
        },
        reviews: reviewsBySubmission[row.submission.id] || []
      }));

      res.json({ 
        submissions: result,
        student: studentInfo ? {
          id: studentInfo.id,
          name: studentInfo.name,
          position: studentInfo.position,
          schoolId: studentInfo.schoolId,
          school: studentInfo.school
        } : null,
        pagination: {
          page,
          limit,
          total: count,
          totalPages: Math.ceil(count / limit)
        }
      });
    } catch (error) {
      console.error("Error fetching submissions:", error);
      res.status(500).json({ 
        error: { 
          code: "internal_error", 
          message: "Failed to fetch submissions" 
        } 
      });
    }
  });

  // GET /api/xen-watch/submissions/:id - Get specific submission
  router.get("/submissions/:id", requireAuth, async (req, res) => {
    try {
      const auth = (req as any).auth;
      const { id } = req.params;

      const [submission] = await db
        .select()
        .from(submissions)
        .where(eq(submissions.id, id));

      if (!submission) {
        return res.status(404).json({ 
          error: { 
            code: "not_found", 
            message: "Submission not found" 
          } 
        });
      }

      // Check access permissions
      const isOwner = submission.studentId === auth.id;
      const isStaff = ['xen_scout', 'scout_admin', 'system_admin'].includes(auth.role);

      if (!isOwner && !isStaff) {
        return res.status(403).json({ 
          error: { 
            code: "insufficient_permissions", 
            message: "Insufficient permissions" 
          } 
        });
      }

      if (isOwner) {
        // Student can only see their own submission metadata
        const [finalFeedback] = await db
          .select()
          .from(submissionFinalFeedback)
          .where(eq(submissionFinalFeedback.submissionId, id));

        res.json({ 
          submission: {
            ...submission,
            finalFeedback
          }
        });
      } else {
        // Staff can see submission with all reviews
        const reviews = await db
          .select({
            review: submissionReviews,
            scout: {
              id: users.id,
              name: users.name,
              profilePicUrl: users.profilePicUrl
            }
          })
          .from(submissionReviews)
          .leftJoin(users, eq(submissionReviews.scoutId, users.id))
          .where(eq(submissionReviews.submissionId, id));

        const [finalFeedback] = await db
          .select()
          .from(submissionFinalFeedback)
          .where(eq(submissionFinalFeedback.submissionId, id));

        res.json({ 
          submission: {
            ...submission,
            reviews: reviews.map(r => ({
              ...r.review,
              scout: r.scout
            })),
            finalFeedback
          }
        });
      }
    } catch (error) {
      console.error("Error fetching submission:", error);
      res.status(500).json({ 
        error: { 
          code: "internal_error", 
          message: "Failed to fetch submission" 
        } 
      });
    }
  });

  // GET /api/xen-watch/admin/submissions - Get all submissions with all reviews (scout_admin only)
  router.get("/admin/submissions", requireAuth, requireRoles(['scout_admin']), async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = (page - 1) * limit;

      // Get all submissions with student and school info
      const allSubmissions = await db
        .select({
          submission: submissions,
        student: {
          id: students.id,
          name: students.name,
          profilePicUrl: students.profilePicUrl,
          roleNumber: students.roleNumber,
          position: students.position,
          schoolId: students.schoolId,
          phone: students.phone,
          height: students.height,
          weight: students.weight
        },
          school: {
            id: schools.id,
            name: schools.name
          }
        })
        .from(submissions)
        .leftJoin(students, eq(submissions.studentId, students.userId))
        .leftJoin(schools, eq(students.schoolId, schools.id))
        .orderBy(desc(submissions.createdAt))
        .limit(limit)
        .offset(offset);

      // Get total count
      const [{ count }] = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(submissions);

      // For each submission, get all reviews from all scouts
      const result = await Promise.all(allSubmissions.map(async (row) => {
        // Get all reviews for this submission
        const allReviews = await db
          .select({
            review: submissionReviews,
            scout: {
              id: users.id,
              name: users.name,
              xenId: users.xenId,
              profilePicUrl: users.profilePicUrl
            }
          })
          .from(submissionReviews)
          .leftJoin(users, eq(submissionReviews.scoutId, users.id))
          .where(eq(submissionReviews.submissionId, row.submission.id))
          .orderBy(desc(submissionReviews.createdAt));

        // Get final feedback if exists
        const finalFeedback = await db
          .select()
          .from(submissionFinalFeedback)
          .where(eq(submissionFinalFeedback.submissionId, row.submission.id))
          .limit(1);

        return {
          ...row.submission,
          student: {
            ...row.student,
            school: row.school
          },
          allReviews: allReviews.map(r => ({
            ...r.review,
            scout: r.scout
          })),
          finalFeedback: finalFeedback[0] || null
        };
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
      console.error("Error fetching admin submissions:", error);
      res.status(500).json({ 
        error: { 
          code: "internal_error", 
          message: "Failed to fetch admin submissions" 
        } 
      });
    }
  });

  // GET /api/xen-watch/scout/review-queue - Get scout's review queue with all reviews
  router.get("/scout/review-queue", requireAuth, requireRoles(['xen_scout', 'scout_admin']), async (req, res) => {
    try {
      const auth = (req as any).auth;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const offset = (page - 1) * limit;

      // Get submissions assigned to this scout
      const reviewQueue = await db
        .select({
          submission: submissions,
          review: submissionReviews,
        student: {
          id: students.id,
          name: students.name,
          profilePicUrl: students.profilePicUrl,
          roleNumber: students.roleNumber,
          position: students.position,
          schoolId: students.schoolId,
          phone: students.phone,
          height: students.height,
          weight: students.weight
        },
          school: {
            id: schools.id,
            name: schools.name
          }
        })
        .from(submissionReviews)
        .leftJoin(submissions, eq(submissionReviews.submissionId, submissions.id))
        .leftJoin(students, eq(submissions.studentId, students.userId))
        .leftJoin(schools, eq(students.schoolId, schools.id))
        .where(eq(submissionReviews.scoutId, auth.id))
        .orderBy(desc(submissions.createdAt))
        .limit(limit)
        .offset(offset);

      // Get total count
      const [{ count }] = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(submissionReviews)
        .where(eq(submissionReviews.scoutId, auth.id));

      // For each submission, get all reviews from all scouts
      const result = await Promise.all(reviewQueue.map(async (row) => {
        // Get all reviews for this submission
        const allReviews = await db
          .select({
            review: submissionReviews,
            scout: {
              id: users.id,
              name: users.name,
              xenId: users.xenId,
              profilePicUrl: users.profilePicUrl
            }
          })
          .from(submissionReviews)
          .leftJoin(users, eq(submissionReviews.scoutId, users.id))
          .where(eq(submissionReviews.submissionId, row.submission.id))
          .orderBy(desc(submissionReviews.createdAt));

        return {
          ...row.submission,
          review: row.review, // Current scout's review
          student: {
            ...row.student,
            school: row.school
          },
          allReviews: allReviews.map(r => ({
            ...r.review,
            scout: r.scout
          }))
        };
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
      console.error("Error fetching review queue:", error);
      res.status(500).json({ 
        error: { 
          code: "internal_error", 
          message: "Failed to fetch review queue" 
        } 
      });
    }
  });

  // POST /api/xen-watch/reviews/:submissionId - Create/update review
  router.post("/reviews/:submissionId", requireAuth, requireRoles(['xen_scout', 'scout_admin']), async (req, res) => {
    try {
      const auth = (req as any).auth;
      const { submissionId } = req.params;
      const { rating, notes, isSubmitted } = req.body;

      // Validate rating if provided
      if (rating !== null && rating !== undefined) {
        if (rating < 1 || rating > 5) {
          return res.status(400).json({ 
            error: { 
              code: "validation_error", 
              message: "Rating must be between 1 and 5" 
            } 
          });
        }
      }

      const reviewData = {
        submissionId,
        scoutId: auth.id,
        rating: rating || null,
        notes: notes || null,
        isSubmitted: isSubmitted || false
      };

      const validatedData = insertSubmissionReviewSchema.parse(reviewData);

      // Upsert review
      const [review] = await db
        .insert(submissionReviews)
        .values(validatedData)
        .onConflictDoUpdate({
          target: [submissionReviews.submissionId, submissionReviews.scoutId],
          set: {
            rating: validatedData.rating,
            notes: validatedData.notes,
            isSubmitted: validatedData.isSubmitted,
            updatedAt: sql`NOW()`
          }
        })
        .returning();

      // Notify other scouts when a review is submitted
      if (review.isSubmitted) {
        notifyScoutsOfReviewUpdate(submissionId, auth.id, true).catch(err => {
          console.error('❌ Failed to notify scouts of review (non-critical):', err);
        });
      }

      res.json({ review });
    } catch (error) {
      console.error("Error creating/updating review:", error);
      res.status(500).json({ 
        error: { 
          code: "internal_error", 
          message: "Failed to create/update review" 
        } 
      });
    }
  });

  // GET /api/xen-watch/reviews/:submissionId - Get all reviews for submission
  router.get("/reviews/:submissionId", requireAuth, requireRoles(['xen_scout', 'scout_admin', 'system_admin']), async (req, res) => {
    try {
      const { submissionId } = req.params;

      const reviews = await db
        .select({
          review: submissionReviews,
          scout: {
            id: users.id,
            name: users.name,
            xenId: users.xenId,
            profilePicUrl: users.profilePicUrl
          }
        })
        .from(submissionReviews)
        .leftJoin(users, eq(submissionReviews.scoutId, users.id))
        .where(eq(submissionReviews.submissionId, submissionId))
        .orderBy(desc(submissionReviews.updatedAt));

      const result = reviews.map(row => ({
        ...row.review,
        scout: row.scout
      }));

      res.json({ reviews: result });
    } catch (error) {
      console.error("Error fetching reviews:", error);
      res.status(500).json({ 
        error: { 
          code: "internal_error", 
          message: "Failed to fetch reviews" 
        } 
      });
    }
  });

  // POST /api/xen-watch/finalize/:submissionId - Publish final feedback (scout_admin and system_admin only)
  router.post("/finalize/:submissionId", requireAuth, requireRoles(['scout_admin', 'system_admin']), async (req, res) => {
    try {
      const auth = (req as any).auth;
      const { submissionId } = req.params;

      // First, get all submitted reviews for this submission
      const submittedReviews = await db
        .select()
        .from(submissionReviews)
        .where(and(
          eq(submissionReviews.submissionId, submissionId),
          eq(submissionReviews.isSubmitted, true)
        ));

      if (submittedReviews.length === 0) {
        return res.status(400).json({ 
          error: { 
            code: "validation_error", 
            message: "Cannot finalize submission without any submitted reviews" 
          } 
        });
      }

      // Calculate average rating from submitted reviews
      const ratingsWithValues = submittedReviews.filter(r => r.rating !== null && r.rating !== undefined);
      const averageRating = ratingsWithValues.length > 0 
        ? ratingsWithValues.reduce((sum, r) => sum + (r.rating || 0), 0) / ratingsWithValues.length
        : null;

      // Create summary from all submitted reviews
      const reviewNotes = submittedReviews
        .filter(r => r.notes && r.notes.trim())
        .map(r => r.notes.trim())
        .filter(notes => notes.length > 0)
        .join(' | ');

      const feedbackData = {
        submissionId,
        adminId: auth.id,
        finalRating: averageRating ? Math.round(averageRating) : null, // Round to integer for schema compliance
        summary: reviewNotes || 'No detailed feedback provided by scouts.'
      };

      const validatedData = insertSubmissionFinalFeedbackSchema.parse(feedbackData);

      // Upsert final feedback
      const [finalFeedback] = await db
        .insert(submissionFinalFeedback)
        .values(validatedData)
        .onConflictDoUpdate({
          target: submissionFinalFeedback.submissionId,
          set: {
            finalRating: validatedData.finalRating,
            summary: validatedData.summary,
            publishedAt: sql`NOW()`
          }
        })
        .returning();

      // Update submission status to finalized
      const [updatedSubmission] = await db
        .update(submissions)
        .set({ 
          status: 'finalized',
          updatedAt: sql`NOW()`
        })
        .where(eq(submissions.id, submissionId))
        .returning();

      console.log('✅ Finalization completed:', {
        submissionId,
        status: updatedSubmission?.status,
        finalRating: validatedData.finalRating,
        totalReviews: submittedReviews.length
      });

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
        finalFeedback,
        submission: updatedSubmission,
        aggregatedData: {
          totalReviews: submittedReviews.length,
          averageRating: averageRating,
          reviewCount: ratingsWithValues.length
        }
      });
    } catch (error) {
      console.error("Error finalizing submission:", error);
      res.status(500).json({ 
        error: { 
          code: "internal_error", 
          message: "Failed to finalize submission" 
        } 
      });
    }
  });

  // GET /api/scouts/detailed - Get detailed scout profiles with analytics
  router.get("/scouts/detailed", requireAuth, requireRoles(['scout_admin']), async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = (page - 1) * limit;
      const search = req.query.search as string;

      // Get scouts from scout_profiles table
      let scoutsQuery = db
        .select({
          id: scoutProfiles.id,
          name: scoutProfiles.name,
          email: users.email,
          xenId: scoutProfiles.xenId,
          profilePicUrl: scoutProfiles.profilePicUrl,
          createdAt: scoutProfiles.createdAt,
          role: users.role
        })
        .from(scoutProfiles)
        .leftJoin(users, sql`${users.id}::text = ${scoutProfiles.userId}::text`);

      // Apply search filter
      if (search) {
        scoutsQuery = scoutsQuery.where(
          sql`${scoutProfiles.name} ILIKE ${`%${search}%`} OR ${users.email} ILIKE ${`%${search}%`} OR ${scoutProfiles.xenId} ILIKE ${`%${search}%`}`
        );
      }

      const scouts = await scoutsQuery
        .orderBy(desc(scoutProfiles.createdAt))
        .limit(limit)
        .offset(offset);

      // Get total count
      const [{ count }] = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(scoutProfiles);

      // Get analytics for each scout
      const scoutsWithAnalytics = await Promise.all(scouts.map(async (scout) => {
        // Get review statistics for this scout with proper null handling
        const reviewStats = await db
          .select({
            totalReviews: sql<number>`COUNT(*)`,
            completedReviews: sql<number>`COUNT(*) FILTER (WHERE is_submitted = true)`,
            avgRating: sql<number>`COALESCE(AVG(rating) FILTER (WHERE rating IS NOT NULL), 0)`,
            highQuality: sql<number>`COUNT(*) FILTER (WHERE rating >= 4)`,
            lowQuality: sql<number>`COUNT(*) FILTER (WHERE rating <= 2)`
          })
          .from(submissionReviews)
          .where(eq(submissionReviews.scoutId, scout.id));

        // Get submission statistics - count submissions this scout has reviewed
        const submissionStats = await db
          .select({
            totalSubmissions: sql<number>`COUNT(DISTINCT s.id)`,
            finalizedSubmissions: sql<number>`COUNT(DISTINCT s.id) FILTER (WHERE s.status = 'finalized')`
          })
          .from(submissions)
          .leftJoin(submissionReviews, eq(submissions.id, submissionReviews.submissionId))
          .where(eq(submissionReviews.scoutId, scout.id));

        const stats = reviewStats[0] || {};
        const subStats = submissionStats[0] || {};

        // Calculate metrics with proper division by zero handling
        const totalAssignments = stats.totalReviews || 0;
        const completedReviews = stats.completedReviews || 0;
        const completionRate = totalAssignments > 0 ? Math.round((completedReviews / totalAssignments) * 100) : 0;
        const qualityScore = completedReviews > 0 ? Math.round(((stats.highQuality || 0) / completedReviews) * 100) : 0;
        const consistencyScore = 85; // Placeholder - would need more complex calculation
        
        console.log(`Scout ${scout.id} metrics:`, {
          totalAssignments,
          completedReviews,
          completionRate,
          qualityScore,
          highQuality: stats.highQuality
        });

        return {
          ...scout,
          total_assignments: totalAssignments,
          completed_reviews: completedReviews,
          avg_rating: stats.avgRating || 0,
          high_quality_reviews: stats.highQuality || 0,
          low_quality_reviews: stats.lowQuality || 0,
          pending_reviews: totalAssignments - completedReviews,
          completionRate: Math.round(completionRate),
          qualityScore: Math.round(qualityScore),
          consistencyScore: Math.round(consistencyScore),
          performanceTrend: 'improving' as const, // Placeholder
          recent_activity_7d: 0, // Placeholder
          recent_activity_30d: 0 // Placeholder
        };
      }));

      res.json({
        scouts: scoutsWithAnalytics,
        pagination: {
          page,
          limit,
          total: count,
          totalPages: Math.ceil(count / limit)
        }
      });
    } catch (error) {
      console.error("Error fetching detailed scouts:", error);
      res.status(500).json({ 
        error: { 
          code: "internal_error", 
          message: "Failed to fetch detailed scouts" 
        } 
      });
    }
  });

  // GET /api/xen-watch/admin/dashboard - Get admin dashboard metrics
  router.get("/admin/dashboard", requireAuth, requireRoles(['scout_admin']), async (req, res) => {
    try {
      // Get submission counts by status
      const submissionStats = await db
        .select({
          status: submissions.status,
          count: sql<number>`COUNT(*)`
        })
        .from(submissions)
        .groupBy(submissions.status);

      // Get total submissions (unique submissions, not review records)
      const [{ totalSubmissions }] = await db
        .select({ totalSubmissions: sql<number>`COUNT(DISTINCT id)` })
        .from(submissions);

      // Get reviews statistics with proper null handling
      const reviewStats = await db
        .select({
          totalReviews: sql<number>`COUNT(*)`,
          submittedReviews: sql<number>`COUNT(*) FILTER (WHERE is_submitted = true)`,
          avgRating: sql<number>`COALESCE(AVG(rating) FILTER (WHERE rating IS NOT NULL), 0)`
        })
        .from(submissionReviews);

      // Get scout statistics from scout_profiles table
      const scoutStats = await db
        .select({
          totalScouts: sql<number>`COUNT(*)`
        })
        .from(scoutProfiles);

      const totalScouts = parseInt(scoutStats[0]?.totalScouts?.toString() || '0');
      console.log('🔢 Admin dashboard scout count:', totalScouts);

      // Calculate metrics
      const stats = {
        totalSubmissions,
        pendingReview: submissionStats.find(s => s.status === 'in_review')?.count || 0,
        readyToFinalize: submissionStats.find(s => s.status === 'in_review')?.count || 0, // Same as pending for now
        finalized: submissionStats.find(s => s.status === 'finalized')?.count || 0,
        rejected: submissionStats.find(s => s.status === 'rejected')?.count || 0,
        totalAssigned: totalSubmissions, // All submissions are assigned to scouts
        totalScouts: totalScouts,
        totalReviews: reviewStats[0]?.totalReviews || 0,
        submittedReviews: reviewStats[0]?.submittedReviews || 0,
        avgRating: reviewStats[0]?.avgRating || 0
      };

      res.json(stats);
    } catch (error) {
      console.error("Error fetching admin dashboard:", error);
      res.status(500).json({ 
        error: { 
          code: "internal_error", 
          message: "Failed to fetch admin dashboard" 
        } 
      });
    }
  });

  // GET /api/xen-watch/final/:submissionId - Get final feedback (student owner)
  router.get("/final/:submissionId", requireAuth, requireRoles(['student']), async (req, res) => {
    try {
      const auth = (req as any).auth;
      const { submissionId } = req.params;

      // Verify ownership
      const [submission] = await db
        .select()
        .from(submissions)
        .where(and(
          eq(submissions.id, submissionId),
          eq(submissions.studentId, auth.id)
        ));

      if (!submission) {
        return res.status(404).json({ 
          error: { 
            code: "not_found", 
            message: "Submission not found" 
          } 
        });
      }

      const [finalFeedback] = await db
        .select()
        .from(submissionFinalFeedback)
        .where(eq(submissionFinalFeedback.submissionId, submissionId));

      res.json({ finalFeedback });
    } catch (error) {
      console.error("Error fetching final feedback:", error);
      res.status(500).json({ 
        error: { 
          code: "internal_error", 
          message: "Failed to fetch final feedback" 
        } 
      });
    }
  });

  // GET /api/xen-watch/admin/submissions - Get all submissions for admin finalization
  router.get("/admin/submissions", requireAuth, requireRoles(['scout_admin', 'system_admin']), async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = (page - 1) * limit;

      // Get all submissions with reviews and student info
      const submissionsData = await db
        .select({
          submission: submissions,
        student: {
          id: students.id,
          name: students.name,
          profilePicUrl: students.profilePicUrl,
          roleNumber: students.roleNumber,
          position: students.position,
          schoolId: students.schoolId,
          phone: students.phone,
          height: students.height,
          weight: students.weight
        },
          school: {
            id: schools.id,
            name: schools.name
          }
        })
        .from(submissions)
        .leftJoin(students, eq(submissions.studentId, students.userId))
        .leftJoin(schools, eq(students.schoolId, schools.id))
        .orderBy(desc(submissions.createdAt))
        .limit(limit)
        .offset(offset);

      // Get total count
      const [{ count }] = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(submissions);

      // For each submission, get all reviews from all scouts
      const result = await Promise.all(submissionsData.map(async (row) => {
        // Get all reviews for this submission
        const allReviews = await db
          .select({
            review: submissionReviews,
            scout: {
              id: users.id,
              name: users.name,
              xenId: users.xenId,
              profilePicUrl: users.profilePicUrl
            }
          })
          .from(submissionReviews)
          .leftJoin(users, eq(submissionReviews.scoutId, users.id))
          .where(eq(submissionReviews.submissionId, row.submission.id))
          .orderBy(desc(submissionReviews.updatedAt));

        // Get final feedback if exists
        const [finalFeedback] = await db
          .select()
          .from(submissionFinalFeedback)
          .where(eq(submissionFinalFeedback.submissionId, row.submission.id));

        return {
          ...row.submission,
          student: {
            ...row.student,
            school: row.school
          },
          reviews: allReviews.map(r => ({
            ...r.review,
            scout: r.scout
          })),
          finalFeedback
        };
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
      console.error("Error fetching admin submissions:", error);
      res.status(500).json({ 
        error: { 
          code: "internal_error", 
          message: "Failed to fetch admin submissions" 
        } 
      });
    }
  });

export default router;
