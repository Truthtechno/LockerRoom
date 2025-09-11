import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Central users table for authentication
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("viewer"), // system_admin, school_admin, student, viewer
  linkedId: varchar("linked_id").notNull(), // References role-specific table
  createdAt: timestamp("created_at").default(sql`now()`).notNull(),
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

export const schools = pgTable("schools", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  subscriptionPlan: text("subscription_plan").notNull().default("standard"), // standard, premium
  maxStudents: integer("max_students").notNull().default(100),
  createdAt: timestamp("created_at").default(sql`now()`).notNull(),
});

export const students = pgTable("students", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
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
  createdAt: timestamp("created_at").default(sql`now()`).notNull(),
});

export const posts = pgTable("posts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  studentId: varchar("student_id").notNull(),
  mediaUrl: text("media_url").notNull(),
  mediaType: text("media_type").notNull(), // image, video
  caption: text("caption"),
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

export const savedPosts = pgTable("saved_posts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  postId: varchar("post_id").notNull(),
  userId: varchar("user_id").notNull(),
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

export const insertSavedPostSchema = createInsertSchema(savedPosts).omit({
  id: true,
  createdAt: true,
});

export const insertStudentFollowerSchema = createInsertSchema(studentFollowers).omit({
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
export type SavedPost = typeof savedPosts.$inferSelect;
export type StudentFollower = typeof studentFollowers.$inferSelect;
export type SchoolApplication = typeof schoolApplications.$inferSelect;
export type SystemSetting = typeof systemSettings.$inferSelect;
export type AdminRole = typeof adminRoles.$inferSelect;
export type AnalyticsLog = typeof analyticsLogs.$inferSelect;
export type StudentRating = typeof studentRatings.$inferSelect;
export type SchoolSetting = typeof schoolSettings.$inferSelect;

export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertViewer = z.infer<typeof insertViewerSchema>;
export type InsertSchoolAdmin = z.infer<typeof insertSchoolAdminSchema>;
export type InsertSystemAdmin = z.infer<typeof insertSystemAdminSchema>;
export type InsertSchool = z.infer<typeof insertSchoolSchema>;
export type InsertStudent = z.infer<typeof insertStudentSchema>;
export type InsertPost = z.infer<typeof insertPostSchema>;
export type InsertPostLike = z.infer<typeof insertPostLikeSchema>;
export type InsertPostComment = z.infer<typeof insertPostCommentSchema>;
export type InsertSavedPost = z.infer<typeof insertSavedPostSchema>;
export type InsertStudentFollower = z.infer<typeof insertStudentFollowerSchema>;
export type InsertSchoolApplication = z.infer<typeof insertSchoolApplicationSchema>;
export type InsertSystemSetting = z.infer<typeof insertSystemSettingSchema>;
export type InsertAdminRole = z.infer<typeof insertAdminRoleSchema>;
export type InsertAnalyticsLog = z.infer<typeof insertAnalyticsLogSchema>;
export type InsertStudentRating = z.infer<typeof insertStudentRatingSchema>;
export type InsertSchoolSetting = z.infer<typeof insertSchoolSettingSchema>;

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
  student: Student;
  likes: PostLike[];
  comments: PostCommentWithUser[];
  saves: SavedPost[];
  likesCount: number;
  commentsCount: number;
  savesCount: number;
  viewsCount: number;
  isLiked?: boolean;
  isSaved?: boolean;
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
  school?: School;
  followersCount: number;
  isFollowing?: boolean;
};
