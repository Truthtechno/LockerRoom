import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default("viewer"), // system_admin, school_admin, student, viewer
  schoolId: varchar("school_id"),
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
  userId: varchar("user_id").notNull(),
  roleNumber: text("role_number"),
  dateOfBirth: text("date_of_birth"),
  position: text("position"),
  sport: text("sport"),
  profilePic: text("profile_pic"),
  bio: text("bio"),
  coverPhoto: text("cover_photo"),
});

export const posts = pgTable("posts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  studentId: varchar("student_id").notNull(),
  mediaUrl: text("media_url").notNull(),
  mediaType: text("media_type").notNull(), // image, video
  caption: text("caption"),
  createdAt: timestamp("created_at").default(sql`now()`).notNull(),
});

export const likes = pgTable("likes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  postId: varchar("post_id").notNull(),
  userId: varchar("user_id").notNull(),
  createdAt: timestamp("created_at").default(sql`now()`).notNull(),
});

export const comments = pgTable("comments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  postId: varchar("post_id").notNull(),
  userId: varchar("user_id").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").default(sql`now()`).notNull(),
});

export const saves = pgTable("saves", {
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

export const follows = pgTable("follows", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  followerId: varchar("follower_id").notNull(), // User who is following
  followingId: varchar("following_id").notNull(), // Student being followed
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

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export const insertSchoolSchema = createInsertSchema(schools).omit({
  id: true,
  createdAt: true,
});

export const insertStudentSchema = createInsertSchema(students).omit({
  id: true,
});

export const insertPostSchema = createInsertSchema(posts).omit({
  id: true,
  createdAt: true,
});

export const insertLikeSchema = createInsertSchema(likes).omit({
  id: true,
  createdAt: true,
});

export const insertCommentSchema = createInsertSchema(comments).omit({
  id: true,
  createdAt: true,
});

export const insertSaveSchema = createInsertSchema(saves).omit({
  id: true,
  createdAt: true,
});

export const insertFollowSchema = createInsertSchema(follows).omit({
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

// Types
export type User = typeof users.$inferSelect;
export type School = typeof schools.$inferSelect;
export type Student = typeof students.$inferSelect;
export type Post = typeof posts.$inferSelect;
export type Like = typeof likes.$inferSelect;
export type Comment = typeof comments.$inferSelect;
export type Save = typeof saves.$inferSelect;
export type Follow = typeof follows.$inferSelect;
export type SchoolApplication = typeof schoolApplications.$inferSelect;
export type SystemSetting = typeof systemSettings.$inferSelect;
export type AdminRole = typeof adminRoles.$inferSelect;
export type AnalyticsLog = typeof analyticsLogs.$inferSelect;

export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertSchool = z.infer<typeof insertSchoolSchema>;
export type InsertStudent = z.infer<typeof insertStudentSchema>;
export type InsertPost = z.infer<typeof insertPostSchema>;
export type InsertLike = z.infer<typeof insertLikeSchema>;
export type InsertComment = z.infer<typeof insertCommentSchema>;
export type InsertSave = z.infer<typeof insertSaveSchema>;
export type InsertFollow = z.infer<typeof insertFollowSchema>;
export type InsertSchoolApplication = z.infer<typeof insertSchoolApplicationSchema>;
export type InsertSystemSetting = z.infer<typeof insertSystemSettingSchema>;
export type InsertAdminRole = z.infer<typeof insertAdminRoleSchema>;
export type InsertAnalyticsLog = z.infer<typeof insertAnalyticsLogSchema>;

// Extended types for joins
export type PostWithDetails = Post & {
  student: Student & { user: User };
  likes: Like[];
  comments: (Comment & { user: User })[];
  saves: Save[];
  likesCount: number;
  commentsCount: number;
  savesCount: number;
  viewsCount: number;
  isLiked?: boolean;
  isSaved?: boolean;
};

export type StudentWithStats = Student & {
  user: User;
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
