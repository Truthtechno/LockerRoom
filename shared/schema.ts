import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, boolean, unique, decimal, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Central users table for authentication
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("viewer"), // system_admin, school_admin, student, viewer, scout_admin, xen_scout
  // NOTE: Role values use "school_admin" and "student" for database compatibility.
  // In UI, always use getRoleDisplayName() to display: "Academy Admin" and "Player"
  linkedId: varchar("linked_id").notNull(), // References role-specific table
  name: text("name"), // User's display name
  schoolId: varchar("school_id"), // School ID for students and school admins
  emailVerified: boolean("email_verified").default(false),
  isOneTimePassword: boolean("is_one_time_password").default(false), // Flag for OTP users
  xenId: text("xen_id"), // XEN ID for scouts (e.g., XSA-25###)
  otp: text("otp"), // One-time password for scouts (legacy - use otpHash instead)
  profilePicUrl: text("profile_pic_url"), // Profile picture URL
  isFrozen: boolean("is_frozen").default(false), // Flag for frozen/disabled accounts
  createdAt: timestamp("created_at").default(sql`now()`).notNull(),
  // Email authentication fields
  emailVerificationToken: text("email_verification_token"), // Token for email verification
  emailVerificationTokenExpiresAt: timestamp("email_verification_token_expires_at"), // Expiration time for verification token
  passwordResetToken: text("password_reset_token"), // Token for password reset
  passwordResetTokenExpiresAt: timestamp("password_reset_token_expires_at"), // Expiration time for reset token
  otpHash: text("otp_hash"), // Hashed OTP (separate from password_hash)
  otpExpiresAt: timestamp("otp_expires_at"), // Expiration time for OTP
  lastEmailSentAt: timestamp("last_email_sent_at"), // Rate limiting for email sends
});

// Role-specific profile tables
export const viewers = pgTable("viewers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  profilePicUrl: text("profile_pic_url"),
  bio: text("bio"),
  phone: text("phone"),
  createdAt: timestamp("created_at").default(sql`now()`).notNull(),
});

/**
 * Academy Admins table (database table name: "school_admins" for backward compatibility)
 * 
 * IMPORTANT: All user-facing text MUST use "Academy Admin" terminology.
 * This table is named "school_admins" for database compatibility only.
 * 
 * When displaying this role in the UI:
 * - Use getRoleDisplayName() from @/lib/role-display
 * - Example: getRoleDisplayName("school_admin") returns "Academy Admin"
 * 
 * See DEVELOPER_GUIDELINES.md for full terminology standards.
 */
export const schoolAdmins = pgTable("school_admins", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  schoolId: varchar("school_id").notNull(),
  profilePicUrl: text("profile_pic_url"),
  bio: text("bio"),
  phone: text("phone"),
  position: text("position"), // Principal, Vice Principal, etc.
  createdAt: timestamp("created_at").default(sql`now()`).notNull(),
});

export const systemAdmins = pgTable("system_admins", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  profilePicUrl: text("profile_pic_url"),
  bio: text("bio"),
  phone: text("phone"),
  permissions: text("permissions").array().notNull().default(sql`'{}'`),
  createdAt: timestamp("created_at").default(sql`now()`).notNull(),
});

/**
 * Academies table (database table name: "schools" for backward compatibility)
 * 
 * IMPORTANT: All user-facing text MUST use "Academy" terminology.
 * This table is named "schools" for database compatibility only.
 * 
 * When displaying data from this table in the UI:
 * - Use "Academy" (not "School") in all labels, messages, and text
 * - Example: <Label>Academy Name</Label>
 * - Example: toast({ title: "Academy Created" })
 * 
 * See DEVELOPER_GUIDELINES.md for full terminology standards.
 */
export const schools = pgTable("schools", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  address: text("address"),
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  // Subscription fields
  paymentAmount: decimal("payment_amount", { precision: 10, scale: 2 }).notNull().default("0.00"), // Amount paid
  paymentFrequency: text("payment_frequency").notNull().default("monthly"), // monthly, annual
  subscriptionExpiresAt: timestamp("subscription_expires_at"), // When subscription expires
  isActive: boolean("is_active").notNull().default(true), // Active status (false if expired/not renewed)
  lastPaymentDate: timestamp("last_payment_date"), // When last payment was recorded
  maxStudents: integer("max_students").notNull().default(100),
  profilePicUrl: text("profile_pic_url"), // Cloudinary URL for school profile picture
  createdAt: timestamp("created_at").default(sql`now()`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`now()`).notNull(),
});

/**
 * Players table (database table name: "students" for backward compatibility)
 * 
 * IMPORTANT: All user-facing text MUST use "Player" terminology.
 * This table is named "students" for database compatibility only.
 * 
 * When displaying data from this table in the UI:
 * - Use "Player" (not "Student") in all labels, messages, and text
 * - Example: <Label>Player Name</Label>
 * - Example: toast({ title: "Player Added Successfully" })
 * 
 * See DEVELOPER_GUIDELINES.md for full terminology standards.
 */
export const students = pgTable("students", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(), // Foreign key to users table
  schoolId: varchar("school_id").notNull(),
  name: text("name").notNull(),
  phone: text("phone"),
  gender: text("gender"), // male, female, other
  dateOfBirth: text("date_of_birth"),
  grade: text("grade"), // class/grade level
  guardianContact: text("guardian_contact"),
  profilePicUrl: text("profile_pic_url"), // Cloudinary URL
  // Sport-related fields
  roleNumber: text("role_number"),
  position: text("position"),
  sport: text("sport"),
  profilePic: text("profile_pic"), // Keep for backward compatibility
  bio: text("bio"),
  coverPhoto: text("cover_photo"),
  // Physical attributes
  height: text("height"), // Stored in cm as a number string
  weight: text("weight"), // Stored in kg as a number string
  createdAt: timestamp("created_at").default(sql`now()`).notNull(),
});

export const posts = pgTable("posts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  studentId: varchar("student_id"), // Nullable for announcements
  mediaUrl: text("media_url"), // Nullable for text-only announcements
  mediaType: text("media_type"), // Nullable for text-only announcements
  caption: text("caption"),
  status: text("status").notNull().default("ready"), // ready, processing, failed
  cloudinaryPublicId: text("cloudinary_public_id"), // For video streaming
  thumbnailUrl: text("thumbnail_url"), // For video thumbnails
  // Announcement-specific fields
  type: text("type").notNull().default("post"), // post, announcement
  title: text("title"), // For announcements
  broadcast: boolean("broadcast").default(false), // Whether to show to target audience
  scope: text("scope").default("school"), // school, global, staff
  schoolId: varchar("school_id"), // Required for school-scoped announcements
  createdByAdminId: varchar("created_by_admin_id"), // Admin who created the announcement
  createdAt: timestamp("created_at").default(sql`now()`).notNull(),
});

export const postLikes = pgTable("post_likes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  postId: varchar("post_id").notNull(),
  userId: varchar("user_id").notNull(),
  createdAt: timestamp("created_at").default(sql`now()`).notNull(),
});

export const postComments = pgTable("post_comments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  postId: varchar("post_id").notNull(),
  userId: varchar("user_id").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").default(sql`now()`).notNull(),
});

export const postViews = pgTable("post_views", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  postId: varchar("post_id").notNull(),
  userId: varchar("user_id").notNull(),
  viewedAt: timestamp("viewed_at").default(sql`now()`).notNull(),
}, (table) => [
  unique("post_views_post_id_user_id_unique").on(table.postId, table.userId),
]);

export const savedPosts = pgTable("saved_posts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  postId: varchar("post_id").notNull(),
  userId: varchar("user_id").notNull(),
  createdAt: timestamp("created_at").default(sql`now()`).notNull(),
});

export const reportedPosts = pgTable("reported_posts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  postId: varchar("post_id").notNull(),
  userId: varchar("user_id").notNull(),
  reason: text("reason"),
  createdAt: timestamp("created_at").default(sql`now()`).notNull(),
});

export const subscriptions = pgTable("subscriptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  schoolId: varchar("school_id").notNull(),
  planType: text("plan_type").notNull(),
  expiryDate: timestamp("expiry_date").notNull(),
  createdAt: timestamp("created_at").default(sql`now()`).notNull(),
});

export const studentFollowers = pgTable("student_followers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  followerUserId: varchar("follower_user_id").notNull(), // User who is following
  studentId: varchar("student_id").notNull(), // Student being followed
  createdAt: timestamp("created_at").default(sql`now()`).notNull(),
});

// General user follows table for user-to-user following
export const userFollows = pgTable("user_follows", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  followerId: varchar("follower_id").notNull(), // User who is following
  followingId: varchar("following_id").notNull(), // User being followed
  createdAt: timestamp("created_at").default(sql`now()`).notNull(),
});

export const schoolApplications = pgTable("school_applications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  schoolName: text("school_name").notNull(),
  contactEmail: text("contact_email").notNull(),
  contactName: text("contact_name").notNull(),
  phone: text("phone"),
  address: text("address"),
  city: text("city"),
  state: text("state"),
  zipCode: text("zip_code"),
  expectedStudents: integer("expected_students").default(100),
  planType: text("plan_type").notNull().default("standard"), // standard, premium
  status: text("status").notNull().default("pending"), // pending, approved, rejected
  notes: text("notes"),
  reviewedBy: varchar("reviewed_by"),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").default(sql`now()`).notNull(),
});

export const systemSettings = pgTable("system_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  category: text("category").notNull().default("general"), // general, theme, features, email
  description: text("description"),
  updatedBy: varchar("updated_by").notNull(),
  updatedAt: timestamp("updated_at").default(sql`now()`).notNull(),
});

// System Branding Configuration
export const systemBranding = pgTable("system_branding", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().default("LockerRoom"),
  logoUrl: text("logo_url"),
  faviconUrl: text("favicon_url"),
  companyName: text("company_name"),
  companyAddress: text("company_address"),
  companyCity: text("company_city"),
  companyState: text("company_state"),
  companyZip: text("company_zip"),
  companyCountry: text("company_country"),
  companyDescription: text("company_description"),
  companyLogoUrl: text("company_logo_url"),
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  websiteUrl: text("website_url"),
  socialFacebook: text("social_facebook"),
  socialTwitter: text("social_twitter"),
  socialInstagram: text("social_instagram"),
  socialTiktok: text("social_tiktok"),
  updatedBy: varchar("updated_by").notNull(),
  updatedAt: timestamp("updated_at").default(sql`now()`).notNull(),
});

// System Appearance Configuration  
export const systemAppearance = pgTable("system_appearance", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`).unique(),
  themeMode: text("theme_mode").notNull().default("auto"), // auto, light, dark
  lightModePrimaryColor: text("light_mode_primary_color").notNull().default("#FFD700"),
  lightModeSecondaryColor: text("light_mode_secondary_color").notNull().default("#000000"),
  lightModeAccentColor: text("light_mode_accent_color").notNull().default("#FFFFFF"),
  lightModeBackground: text("light_mode_background").notNull().default("#FFFFFF"),
  lightModeForeground: text("light_mode_foreground").notNull().default("#0A0A0A"),
  lightModeMuted: text("light_mode_muted").notNull().default("#F4F4F5"),
  lightModeBorder: text("light_mode_border").notNull().default("#E4E4E7"),
  darkModePrimaryColor: text("dark_mode_primary_color").notNull().default("#FFD700"),
  darkModeSecondaryColor: text("dark_mode_secondary_color").notNull().default("#FFFFFF"),
  darkModeAccentColor: text("dark_mode_accent_color").notNull().default("#000000"),
  darkModeBackground: text("dark_mode_background").notNull().default("#0A0A0A"),
  darkModeForeground: text("dark_mode_foreground").notNull().default("#FAFAFA"),
  darkModeMuted: text("dark_mode_muted").notNull().default("#27272A"),
  darkModeBorder: text("dark_mode_border").notNull().default("#3F3F46"),
  fontFamily: text("font_family").default("Inter"),
  fontSizeBase: text("font_size_base").default("1rem"),
  updatedBy: varchar("updated_by").notNull(),
  updatedAt: timestamp("updated_at").default(sql`now()`).notNull(),
});

// System Payment Configuration
export const systemPayment = pgTable("system_payment", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`).unique(),
  mockModeEnabled: boolean("mock_mode_enabled").notNull().default(true),
  provider: text("provider").notNull().default("none"), // stripe, paypal, none
  // Stripe configuration
  stripePublishableKey: text("stripe_publishable_key"),
  stripeSecretKeyEncrypted: text("stripe_secret_key_encrypted"),
  stripeWebhookSecretEncrypted: text("stripe_webhook_secret_encrypted"),
  // PayPal configuration
  paypalClientId: text("paypal_client_id"),
  paypalClientSecretEncrypted: text("paypal_client_secret_encrypted"),
  paypalMode: text("paypal_mode").default("sandbox"), // sandbox, live
  // General payment settings
  currency: text("currency").notNull().default("USD"),
  // New decimal columns for actual currency amounts
  xenScoutPrice: decimal("xen_scout_price", { precision: 10, scale: 2 }).default("10.00"),
  scoutAiPrice: decimal("scout_ai_price", { precision: 10, scale: 2 }).default("10.00"),
  // Legacy cent columns (kept for backward compatibility during migration)
  xenScoutPriceCents: integer("xen_scout_price_cents"),
  scoutAiPriceCents: integer("scout_ai_price_cents"),
  enableSubscriptions: boolean("enable_subscriptions").notNull().default(false),
  subscriptionMonthlyPrice: decimal("subscription_monthly_price", { precision: 10, scale: 2 }),
  subscriptionYearlyPrice: decimal("subscription_yearly_price", { precision: 10, scale: 2 }),
  // Legacy subscription cent columns
  subscriptionMonthlyPriceCents: integer("subscription_monthly_price_cents"),
  subscriptionYearlyPriceCents: integer("subscription_yearly_price_cents"),
  updatedBy: varchar("updated_by").notNull(),
  updatedAt: timestamp("updated_at").default(sql`now()`).notNull(),
});

// Payment Transactions
export const paymentTransactions = pgTable("payment_transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`).unique(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // 'xen_watch', 'scout_ai'
  amountCents: integer("amount_cents").notNull(),
  currency: text("currency").notNull().default("USD"),
  status: text("status").notNull().default("pending"), // 'pending', 'completed', 'failed', 'refunded'
  provider: text("provider").notNull().default("mock"), // 'mock', 'stripe', 'paypal'
  providerTransactionId: text("provider_transaction_id"), // Transaction ID from payment provider
  metadata: text("metadata"), // JSON string with additional data (video URL, submission ID, etc.)
  createdAt: timestamp("created_at").default(sql`now()`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`now()`).notNull(),
});

// School Payment Records - Audit trail for school payments
export const schoolPaymentRecords = pgTable("school_payment_records", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  schoolId: varchar("school_id").notNull().references(() => schools.id, { onDelete: "cascade" }),
  paymentAmount: decimal("payment_amount", { precision: 10, scale: 2 }).notNull(),
  paymentFrequency: text("payment_frequency").notNull(), // 'monthly', 'annual'
  paymentType: text("payment_type").notNull(), // 'initial', 'renewal', 'student_limit_increase', 'student_limit_decrease', 'frequency_change'
  studentLimitBefore: integer("student_limit_before"),
  studentLimitAfter: integer("student_limit_after"),
  oldFrequency: text("old_frequency"),
  newFrequency: text("new_frequency"),
  notes: text("notes"),
  recordedBy: varchar("recorded_by").references(() => users.id),
  recordedAt: timestamp("recorded_at").default(sql`now()`).notNull(),
  subscriptionExpiresAt: timestamp("subscription_expires_at"),
  createdAt: timestamp("created_at").default(sql`now()`).notNull(),
});

export const adminRoles = pgTable("admin_roles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  role: text("role").notNull(), // super_admin, system_admin, moderator
  permissions: text("permissions").array().notNull().default(sql`'{}'`), // JSON array of permissions
  assignedBy: varchar("assigned_by").notNull(),
  createdAt: timestamp("created_at").default(sql`now()`).notNull(),
});

export const analyticsLogs = pgTable("analytics_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  eventType: text("event_type").notNull(), // user_signup, post_created, school_onboarded, etc.
  entityId: varchar("entity_id"), // ID of the related entity
  entityType: text("entity_type"), // user, post, school, etc.
  metadata: text("metadata"), // JSON string with additional data
  timestamp: timestamp("timestamp").default(sql`now()`).notNull(),
});

export const studentRatings = pgTable("student_ratings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  studentId: varchar("student_id").notNull(),
  rating: integer("rating").notNull(), // 1-5 scale
  comments: text("comments"),
  category: text("category").default("overall"), // overall, academic, athletic, behavior
  ratedBy: varchar("rated_by").notNull(), // Admin/teacher who gave the rating
  createdAt: timestamp("created_at").default(sql`now()`).notNull(),
});

export const schoolSettings = pgTable("school_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  schoolId: varchar("school_id").notNull(),
  key: text("key").notNull(),
  value: text("value").notNull(),
  category: text("category").notNull().default("general"), // general, grades, staff
  updatedBy: varchar("updated_by").notNull(),
  updatedAt: timestamp("updated_at").default(sql`now()`).notNull(),
});

// Admins table - main source of truth for admin authentication/roles
export const admins = pgTable("admins", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  role: text("role").notNull(),
  profilePicUrl: text("profile_pic_url"),
  xenId: text("xen_id"),
  otp: text("otp"),
  createdAt: timestamp("created_at").default(sql`now()`).notNull(),
});

// XEN Watch Tables - New refactored structure
export const scoutProfiles = pgTable("scout_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().unique(),
  xenId: text("xen_id").notNull().unique(),
  name: text("name").notNull(),
  profilePicUrl: text("profile_pic_url"),
  createdAt: timestamp("created_at").default(sql`now()`).notNull(),
});

// New submissions table - one per student upload
export const submissions = pgTable("submissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  studentId: varchar("student_id").notNull(),
  videoUrl: text("video_url").notNull(),
  thumbUrl: text("thumb_url"),
  notes: text("notes"),
  promoCode: text("promo_code"),
  status: text("status").notNull().default("in_review"), // 'in_review' | 'finalized' | 'rejected'
  createdAt: timestamp("created_at").default(sql`now()`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`now()`).notNull(),
});

// Submission reviews - one per scout per submission
export const submissionReviews = pgTable("submission_reviews", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  submissionId: varchar("submission_id").notNull(),
  scoutId: varchar("scout_id").notNull(),
  rating: integer("rating"), // 1-5, nullable for draft reviews
  notes: text("notes"),
  isSubmitted: boolean("is_submitted").notNull().default(false),
  createdAt: timestamp("created_at").default(sql`now()`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`now()`).notNull(),
});

// Final admin decision returned to student
export const submissionFinalFeedback = pgTable("submission_final_feedback", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  submissionId: varchar("submission_id").notNull().unique(),
  adminId: varchar("admin_id").notNull(),
  finalRating: integer("final_rating"), // 1-5, nullable
  summary: text("summary"),
  publishedAt: timestamp("published_at").default(sql`now()`).notNull(),
});

// Legacy XEN Watch tables - keep for backward compatibility
export const xenWatchSubmissions = pgTable("xen_watch_submissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  studentId: varchar("student_id").notNull(),
  schoolId: varchar("school_id"),
  postId: varchar("post_id"),
  mediaUrl: text("media_url"),
  mediaPublicId: text("media_public_id"),
  caption: text("caption"),
  amountCents: integer("amount_cents").notNull().default(1000),
  currency: text("currency").notNull().default("USD"),
  paymentProvider: text("payment_provider"),
  paymentIntentId: text("payment_intent_id"),
  paidAt: timestamp("paid_at"),
  status: text("status").notNull().default("pending_payment"), // pending_payment, paid, assigned, in_review, reviewed, feedback_sent, canceled, refunded
  selectedScoutId: varchar("selected_scout_id"),
  createdAt: timestamp("created_at").default(sql`now()`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`now()`).notNull(),
});

export const xenWatchReviews = pgTable("xen_watch_reviews", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  submissionId: varchar("submission_id").notNull(),
  scoutId: varchar("scout_id").notNull(),
  rating: integer("rating").notNull(), // 1-5
  comment: text("comment"),
  createdAt: timestamp("created_at").default(sql`now()`).notNull(),
});

export const xenWatchFeedback = pgTable("xen_watch_feedback", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  submissionId: varchar("submission_id").notNull().unique(),
  adminUserId: varchar("admin_user_id").notNull(),
  message: text("message").notNull(),
  sentAt: timestamp("sent_at").default(sql`now()`).notNull(),
});

// Notifications table for role-based notification system
export const notifications = pgTable("notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(), // User who receives the notification
  type: varchar("type").notNull(), // Notification type
  title: text("title").notNull(),
  message: text("message").notNull(),
  entityType: varchar("entity_type"), // post, user, submission, announcement, etc.
  entityId: varchar("entity_id"), // ID of the related entity
  relatedUserId: varchar("related_user_id"), // User who triggered the notification
  metadata: text("metadata"), // Additional JSON data
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at").default(sql`now()`).notNull(),
});

// Banners table for dashboard-level communications
export const banners = pgTable("banners", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  message: text("message").notNull(),
  category: text("category").notNull().default("info"), // info, warning, success, error, announcement
  targetRoles: text("target_roles").array().notNull().default(sql`'{}'`), // Array of roles: scout_admin, school_admin, xen_scout, xen_watch
  targetSchoolIds: text("target_school_ids").array(), // Array of school IDs (only applies when school_admin is in target_roles). NULL means all schools.
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  isActive: boolean("is_active").default(true),
  priority: integer("priority").default(0), // Higher priority shown first
  createdByAdminId: varchar("created_by_admin_id").notNull(), // References users(id)
  createdAt: timestamp("created_at").default(sql`now()`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`now()`).notNull(),
});

// Evaluation Forms System Tables
export const evaluationFormTemplates = pgTable("evaluation_form_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  status: text("status").notNull().default("draft"), // 'draft', 'active', 'archived'
  createdBy: varchar("created_by").notNull(), // References users(id)
  createdAt: timestamp("created_at").default(sql`now()`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`now()`).notNull(),
  publishedAt: timestamp("published_at"), // When form was published to scouts
  version: integer("version").default(1), // For form versioning
});

export const evaluationFormFields = pgTable("evaluation_form_fields", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  formTemplateId: varchar("form_template_id").notNull(), // References evaluation_form_templates(id)
  fieldType: text("field_type").notNull(), // 'short_text', 'paragraph', 'star_rating', 'multiple_choice', 'multiple_selection', 'number', 'date', 'dropdown'
  label: text("label").notNull(),
  placeholder: text("placeholder"),
  helpText: text("help_text"),
  required: boolean("required").default(false),
  orderIndex: integer("order_index").notNull(), // For field ordering
  options: jsonb("options"), // For multiple_choice/multiple_selection/dropdown: [{"value": "option1", "label": "Option 1"}]
  validationRules: jsonb("validation_rules"), // For min/max length, numeric ranges, etc.
  createdAt: timestamp("created_at").default(sql`now()`).notNull(),
});

export const evaluationSubmissions = pgTable("evaluation_submissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  formTemplateId: varchar("form_template_id").notNull(), // References evaluation_form_templates(id)
  submittedBy: varchar("submitted_by").notNull(), // References users(id) - Scout who submitted
  studentId: varchar("student_id"), // References students(id) - Nullable if student not in system
  // Student info (for manual entries or snapshot at submission time)
  studentName: text("student_name"),
  studentProfilePicUrl: text("student_profile_pic_url"),
  studentPosition: text("student_position"),
  studentHeight: text("student_height"),
  studentWeight: text("student_weight"),
  studentRoleNumber: text("student_role_number"),
  studentSport: text("student_sport"),
  studentSchoolId: varchar("student_school_id"), // References schools(id)
  studentSchoolName: text("student_school_name"),
  // Submission metadata
  status: text("status").default("draft"), // 'draft', 'submitted'
  submittedAt: timestamp("submitted_at"),
  createdAt: timestamp("created_at").default(sql`now()`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`now()`).notNull(),
});

export const evaluationSubmissionResponses = pgTable("evaluation_submission_responses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  submissionId: varchar("submission_id").notNull(), // References evaluation_submissions(id)
  fieldId: varchar("field_id").notNull(), // References evaluation_form_fields(id)
  responseValue: text("response_value"), // JSON string for complex types (arrays, objects)
  createdAt: timestamp("created_at").default(sql`now()`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`now()`).notNull(),
}, (table) => [
  unique("evaluation_submission_responses_submission_field_unique").on(table.submissionId, table.fieldId),
]);

export const evaluationFormAccess = pgTable("evaluation_form_access", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  formTemplateId: varchar("form_template_id").notNull(), // References evaluation_form_templates(id)
  role: text("role").notNull(), // 'scout_admin', 'xen_scout', or specific user IDs
  grantedAt: timestamp("granted_at").default(sql`now()`).notNull(),
  grantedBy: varchar("granted_by"), // References users(id)
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export const insertViewerSchema = createInsertSchema(viewers).omit({
  id: true,
  createdAt: true,
});

export const insertSchoolAdminSchema = createInsertSchema(schoolAdmins).omit({
  id: true,
  createdAt: true,
});

export const insertSystemAdminSchema = createInsertSchema(systemAdmins).omit({
  id: true,
  createdAt: true,
});

export const insertSchoolSchema = createInsertSchema(schools).omit({
  id: true,
  createdAt: true,
});

export const insertStudentSchema = createInsertSchema(students).omit({
  id: true,
  createdAt: true,
});

export const insertPostSchema = createInsertSchema(posts).omit({
  id: true,
  createdAt: true,
});

export const insertPostLikeSchema = createInsertSchema(postLikes).omit({
  id: true,
  createdAt: true,
});

export const insertPostCommentSchema = createInsertSchema(postComments).omit({
  id: true,
  createdAt: true,
});

export const insertPostViewSchema = createInsertSchema(postViews).omit({
  id: true,
  viewedAt: true,
});

export const insertSavedPostSchema = createInsertSchema(savedPosts).omit({
  id: true,
  createdAt: true,
});

export const insertReportedPostSchema = createInsertSchema(reportedPosts).omit({
  id: true,
  createdAt: true,
});

export const insertStudentFollowerSchema = createInsertSchema(studentFollowers).omit({
  id: true,
  createdAt: true,
});

export const insertUserFollowSchema = createInsertSchema(userFollows).omit({
  id: true,
  createdAt: true,
});

export const insertSchoolApplicationSchema = createInsertSchema(schoolApplications).omit({
  id: true,
  createdAt: true,
  reviewedAt: true,
});

export const insertSystemSettingSchema = createInsertSchema(systemSettings).omit({
  id: true,
  updatedAt: true,
});

export const insertSystemBrandingSchema = createInsertSchema(systemBranding).omit({
  id: true,
  updatedAt: true,
});

export const insertSystemAppearanceSchema = createInsertSchema(systemAppearance).omit({
  id: true,
  updatedAt: true,
});

export const insertSystemPaymentSchema = createInsertSchema(systemPayment).omit({
  id: true,
  updatedAt: true,
});

export const insertPaymentTransactionSchema = createInsertSchema(paymentTransactions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAdminRoleSchema = createInsertSchema(adminRoles).omit({
  id: true,
  createdAt: true,
});

export const insertAnalyticsLogSchema = createInsertSchema(analyticsLogs).omit({
  id: true,
  timestamp: true,
});

export const insertStudentRatingSchema = createInsertSchema(studentRatings).omit({
  id: true,
  createdAt: true,
});

export const insertSchoolSettingSchema = createInsertSchema(schoolSettings).omit({
  id: true,
  updatedAt: true,
});

// Admins Insert Schema
export const insertAdminSchema = createInsertSchema(admins).omit({
  id: true,
  createdAt: true,
});

// New XEN Watch Insert Schemas
export const insertSubmissionSchema = createInsertSchema(submissions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSubmissionReviewSchema = createInsertSchema(submissionReviews).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSubmissionFinalFeedbackSchema = createInsertSchema(submissionFinalFeedback).omit({
  id: true,
  publishedAt: true,
});

// Legacy XEN Watch Insert Schemas
export const insertScoutProfileSchema = createInsertSchema(scoutProfiles).omit({
  id: true,
  createdAt: true,
});

export const insertXenWatchSubmissionSchema = createInsertSchema(xenWatchSubmissions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertXenWatchReviewSchema = createInsertSchema(xenWatchReviews).omit({
  id: true,
  createdAt: true,
});

export const insertXenWatchFeedbackSchema = createInsertSchema(xenWatchFeedback).omit({
  id: true,
  sentAt: true,
});

// Notifications Insert Schema
export const insertNotificationSchema = createInsertSchema(notifications).omit({
  id: true,
  createdAt: true,
});

export const insertBannerSchema = createInsertSchema(banners).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Evaluation Forms Insert Schemas
export const insertEvaluationFormTemplateSchema = createInsertSchema(evaluationFormTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertEvaluationFormFieldSchema = createInsertSchema(evaluationFormFields).omit({
  id: true,
  createdAt: true,
});

export const insertEvaluationSubmissionSchema = createInsertSchema(evaluationSubmissions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertEvaluationSubmissionResponseSchema = createInsertSchema(evaluationSubmissionResponses).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertEvaluationFormAccessSchema = createInsertSchema(evaluationFormAccess).omit({
  id: true,
  grantedAt: true,
});

// Types
export type User = typeof users.$inferSelect;
export type Viewer = typeof viewers.$inferSelect;
export type SchoolAdmin = typeof schoolAdmins.$inferSelect;
export type SystemAdmin = typeof systemAdmins.$inferSelect;
export type School = typeof schools.$inferSelect;
export type Student = typeof students.$inferSelect;
export type Post = typeof posts.$inferSelect;
export type PostLike = typeof postLikes.$inferSelect;
export type PostComment = typeof postComments.$inferSelect;
export type PostView = typeof postViews.$inferSelect;
export type SavedPost = typeof savedPosts.$inferSelect;
export type ReportedPost = typeof reportedPosts.$inferSelect;
export type StudentFollower = typeof studentFollowers.$inferSelect;
export type UserFollow = typeof userFollows.$inferSelect;
export type SchoolApplication = typeof schoolApplications.$inferSelect;
export type SystemSetting = typeof systemSettings.$inferSelect;
export type SystemBranding = typeof systemBranding.$inferSelect;
export type SystemAppearance = typeof systemAppearance.$inferSelect;
export type SystemPayment = typeof systemPayment.$inferSelect;
export type PaymentTransaction = typeof paymentTransactions.$inferSelect;
export type AdminRole = typeof adminRoles.$inferSelect;
export type AnalyticsLog = typeof analyticsLogs.$inferSelect;
export type StudentRating = typeof studentRatings.$inferSelect;
export type SchoolSetting = typeof schoolSettings.$inferSelect;

// Admins Drizzle Types
export type AdminDB = typeof admins.$inferSelect;

// New XEN Watch Drizzle Types
export type SubmissionDB = typeof submissions.$inferSelect;
export type SubmissionReviewDB = typeof submissionReviews.$inferSelect;
export type SubmissionFinalFeedbackDB = typeof submissionFinalFeedback.$inferSelect;

// Legacy XEN Watch Drizzle Types
export type ScoutProfileDB = typeof scoutProfiles.$inferSelect;
export type XenWatchSubmissionDB = typeof xenWatchSubmissions.$inferSelect;
export type XenWatchReviewDB = typeof xenWatchReviews.$inferSelect;
export type XenWatchFeedbackDB = typeof xenWatchFeedback.$inferSelect;
export type NotificationDB = typeof notifications.$inferSelect;
export type BannerDB = typeof banners.$inferSelect;

// Evaluation Forms Types
export type EvaluationFormTemplateDB = typeof evaluationFormTemplates.$inferSelect;
export type EvaluationFormFieldDB = typeof evaluationFormFields.$inferSelect;
export type EvaluationSubmissionDB = typeof evaluationSubmissions.$inferSelect;
export type EvaluationSubmissionResponseDB = typeof evaluationSubmissionResponses.$inferSelect;
export type EvaluationFormAccessDB = typeof evaluationFormAccess.$inferSelect;

export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertViewer = z.infer<typeof insertViewerSchema>;
export type InsertSchoolAdmin = z.infer<typeof insertSchoolAdminSchema>;
export type InsertSystemAdmin = z.infer<typeof insertSystemAdminSchema>;
export type InsertSchool = z.infer<typeof insertSchoolSchema>;
export type InsertStudent = z.infer<typeof insertStudentSchema>;
export type InsertPost = z.infer<typeof insertPostSchema>;
export type InsertPostLike = z.infer<typeof insertPostLikeSchema>;
export type InsertPostComment = z.infer<typeof insertPostCommentSchema>;
export type InsertPostView = z.infer<typeof insertPostViewSchema>;
export type InsertSavedPost = z.infer<typeof insertSavedPostSchema>;
export type InsertReportedPost = z.infer<typeof insertReportedPostSchema>;
export type InsertStudentFollower = z.infer<typeof insertStudentFollowerSchema>;
export type InsertUserFollow = z.infer<typeof insertUserFollowSchema>;
export type InsertSchoolApplication = z.infer<typeof insertSchoolApplicationSchema>;
export type InsertSystemSetting = z.infer<typeof insertSystemSettingSchema>;
export type InsertSystemBranding = z.infer<typeof insertSystemBrandingSchema>;
export type InsertSystemAppearance = z.infer<typeof insertSystemAppearanceSchema>;
export type InsertSystemPayment = z.infer<typeof insertSystemPaymentSchema>;
export type InsertPaymentTransaction = z.infer<typeof insertPaymentTransactionSchema>;
export type InsertAdminRole = z.infer<typeof insertAdminRoleSchema>;
export type InsertAnalyticsLog = z.infer<typeof insertAnalyticsLogSchema>;
export type InsertStudentRating = z.infer<typeof insertStudentRatingSchema>;
export type InsertSchoolSetting = z.infer<typeof insertSchoolSettingSchema>;

// Admins Insert Types
export type InsertAdmin = z.infer<typeof insertAdminSchema>;

// New XEN Watch Insert Types
export type InsertSubmission = z.infer<typeof insertSubmissionSchema>;
export type InsertSubmissionReview = z.infer<typeof insertSubmissionReviewSchema>;
export type InsertSubmissionFinalFeedback = z.infer<typeof insertSubmissionFinalFeedbackSchema>;

// Legacy XEN Watch Insert Types
export type InsertScoutProfile = z.infer<typeof insertScoutProfileSchema>;
export type InsertXenWatchSubmission = z.infer<typeof insertXenWatchSubmissionSchema>;
export type InsertXenWatchReview = z.infer<typeof insertXenWatchReviewSchema>;
export type InsertXenWatchFeedback = z.infer<typeof insertXenWatchFeedbackSchema>;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type InsertBanner = z.infer<typeof insertBannerSchema>;

// Evaluation Forms Insert Types
export type InsertEvaluationFormTemplate = z.infer<typeof insertEvaluationFormTemplateSchema>;
export type InsertEvaluationFormField = z.infer<typeof insertEvaluationFormFieldSchema>;
export type InsertEvaluationSubmission = z.infer<typeof insertEvaluationSubmissionSchema>;
export type InsertEvaluationSubmissionResponse = z.infer<typeof insertEvaluationSubmissionResponseSchema>;
export type InsertEvaluationFormAccess = z.infer<typeof insertEvaluationFormAccessSchema>;

// Extended types for joins  
export type PostCommentWithUser = PostComment & {
  user: User;
};

// Profile union type for role-based operations
export type UserProfile = {
  id: string;
  name: string;
  profilePicUrl?: string;
  bio?: string;
  phone?: string;
  role: string;
  // Role-specific fields will be included based on role
};

export type PostWithDetails = Post & {
  student: {
    id: string;
    userId: string;
    name: string;
    sport: string;
    position: string;
    roleNumber: string;
    profilePicUrl: string | null;
    isFollowing?: boolean;
  };
  likesCount: number;
  commentsCount: number;
  savesCount: number;
  viewCount: number;
  isLiked: boolean;
  isSaved: boolean;
  // Effective fields for media handling
  effectiveMediaUrl: string;
  effectiveMediaType: string;
  effectiveStatus: string;
  // Announcement-specific fields
  isAnnouncement?: boolean;
  announcementScope?: string;
  announcementSchool?: School | null;
};

export type StudentWithStats = Student & {
  school?: School;
  postsCount: number;
  totalLikes: number;
  totalViews: number;
  totalSaves: number;
  totalComments: number;
  followersCount: number;
  followingCount: number;
  isFollowing?: boolean;
};

export type StudentSearchResult = Student & {
  user: User;
  school?: School;
  followersCount: number;
  isFollowing?: boolean;
};

// New XEN Watch Types
export type Submission = {
  id: string;
  studentId: string;
  videoUrl: string;
  thumbUrl?: string | null;
  notes?: string | null;
  promoCode?: string | null;
  status: 'in_review' | 'finalized' | 'rejected';
  createdAt: string;
  updatedAt: string;
};

export type SubmissionReview = {
  id: string;
  submissionId: string;
  scoutId: string;
  rating?: number | null; // 1-5, nullable for draft reviews
  notes?: string | null;
  isSubmitted: boolean;
  createdAt: string;
  updatedAt: string;
};

export type SubmissionFinalFeedback = {
  id: string;
  submissionId: string;
  adminId: string;
  finalRating?: number | null; // 1-5, nullable
  summary?: string | null;
  publishedAt: string;
};

// Extended types for joins
export type SubmissionWithDetails = Submission & {
  student: {
    id: string;
    name: string;
    profilePicUrl?: string | null;
  };
  finalFeedback?: SubmissionFinalFeedback | null;
  reviewProgress: {
    totalScouts: number;
    submittedCount: number;
  };
};

// Type for student's own submissions (with student object including school info)
export type StudentSubmission = Submission & {
  student: {
    id: string;
    name: string;
    position?: string | null;
    schoolId?: string | null;
    school?: {
      id: string;
      name: string;
    } | null;
  };
  finalFeedback?: SubmissionFinalFeedback | null;
  reviewProgress: {
    totalScouts: number;
    submittedCount: number;
  };
  reviews: Array<{
    id: string;
    submissionId: string;
    scoutId: string;
    rating?: number | null;
    notes?: string | null;
    isSubmitted: boolean;
    createdAt: string;
    scout: {
      id: string;
      name: string;
      role: string;
    };
  }>;
};

// Type for the API response that includes student info
export type StudentSubmissionsResponse = {
  submissions: StudentSubmission[];
  student: {
    id: string;
    name: string;
    position?: string | null;
    schoolId?: string | null;
    school?: {
      id: string;
      name: string;
    } | null;
  } | null;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type SubmissionReviewWithScout = SubmissionReview & {
  scout: {
    id: string;
    name: string;
    xenId: string;
    profilePicUrl?: string | null;
  };
};

export type SubmissionWithReviews = Submission & {
  reviews: SubmissionReviewWithScout[];
  finalFeedback?: SubmissionFinalFeedback | null;
  student: {
    id: string;
    name: string;
    profilePicUrl?: string | null;
  };
};

// Legacy XEN Watch Types
export type ScoutProfile = {
  id: string;
  userId: string;
  xenId: string;
  name: string;
  profilePicUrl?: string | null;
  createdAt: string;
};

export type XenWatchSubmission = {
  id: string;
  studentId: string;
  schoolId?: string | null;
  postId?: string | null;
  mediaUrl?: string | null;
  mediaPublicId?: string | null;
  caption?: string | null;
  amountCents: number; // default 1000
  currency: 'USD';
  paymentProvider?: string | null;
  paymentIntentId?: string | null;
  paidAt?: string | null;
  status: 'pending_payment'|'paid'|'assigned'|'in_review'|'reviewed'|'feedback_sent'|'canceled'|'refunded';
  selectedScoutId?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type XenWatchReview = {
  id: string;
  submissionId: string;
  scoutId: string;
  rating: number; // 1..5
  comment?: string | null;
  createdAt: string;
};

export type XenWatchFeedback = {
  id: string;
  submissionId: string;
  adminUserId: string;
  message: string;
  sentAt: string;
};

export type XenWatchStatsRow = {
  studentId: string;
  schoolId: string | null;
  totalSubmissions: number;
  avgRating: number | null;
};

// Unified role definitions for the LockerRoom application
export type Role =
  | "system_admin"   // top-level (replaces super_admin)
  | "moderator"
  | "scout_admin"
  | "xen_scout"
  | "finance"
  | "support"
  | "coach"
  | "analyst"
  | "school_admin"
  | "student"
  | "viewer";
