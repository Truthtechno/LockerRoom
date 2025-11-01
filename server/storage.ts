import { 
  type User, 
  type InsertUser,
  type Viewer,
  type InsertViewer,
  type SchoolAdmin,
  type InsertSchoolAdmin,
  type SystemAdmin,
  type InsertSystemAdmin,
  type School, 
  type InsertSchool,
  type Student,
  type InsertStudent,
  type Post,
  type InsertPost,
  type PostLike,
  type InsertPostLike,
  type PostComment,
  type InsertPostComment,
  type PostView,
  type InsertPostView,
  type PostCommentWithUser,
  type SavedPost,
  type InsertSavedPost,
  type ReportedPost,
  type InsertReportedPost,
  type StudentFollower,
  type InsertStudentFollower,
  type UserFollow,
  type InsertUserFollow,
  type SchoolApplication,
  type InsertSchoolApplication,
  type SystemSetting,
  type InsertSystemSetting,
  type SystemBranding,
  type InsertSystemBranding,
  type SystemAppearance,
  type InsertSystemAppearance,
  type SystemPayment,
  type InsertSystemPayment,
  type AdminRole,
  type InsertAdminRole,
  type AnalyticsLog,
  type InsertAnalyticsLog,
  type StudentRating,
  type InsertStudentRating,
  type SchoolSetting,
  type InsertSchoolSetting,
  type PostWithDetails,
  type StudentWithStats,
  type NotificationDB,
  type InsertNotification,
  type StudentSearchResult,
  type UserProfile,
  // XEN Watch types
  type ScoutProfile,
  type XenWatchSubmission,
  type XenWatchReview,
  type XenWatchFeedback,
  type XenWatchStatsRow,
  type InsertScoutProfile,
  type InsertXenWatchSubmission,
  type InsertXenWatchReview,
  type InsertXenWatchFeedback,
  users,
  viewers,
  schoolAdmins,
  systemAdmins,
  admins,
  schools,
  students,
  posts,
  postLikes,
  postComments,
  postViews,
  savedPosts,
  reportedPosts,
  studentFollowers,
  userFollows,
  schoolApplications,
  systemSettings,
  systemBranding,
  systemAppearance,
  systemPayment,
  adminRoles,
  analyticsLogs,
  studentRatings,
  schoolSettings,
  // XEN Watch tables
  scoutProfiles,
  xenWatchSubmissions,
  xenWatchReviews,
  xenWatchFeedback,
  // Notifications
  notifications
} from "@shared/schema";
import { randomUUID } from "crypto";
import bcrypt from "bcrypt";
import { db } from './db';
import { eq, desc, sql, and, or, inArray } from 'drizzle-orm';

// Helper function to safely get post views with fallback
async function getPostViews(postId: string): Promise<PostView[]> {
  try {
    return await db.select().from(postViews).where(eq(postViews.postId, postId));
  } catch (error) {
    console.warn(`⚠️ Failed to query post_views for post ${postId}:`, error);
    // Return empty array as fallback - posts should still display even if views can't be recorded
    return [];
  }
}

// Helper function to safely record a post view with fallback
async function recordPostView(postId: string, userId: string): Promise<void> {
  try {
    await db.insert(postViews).values({
      postId,
      userId,
    }).onConflictDoNothing();
  } catch (error) {
    console.warn(`⚠️ Failed to record view for post ${postId} by user ${userId}:`, error);
    // Silently fail - view recording is not critical for post display
  }
}

export interface IStorage {
  // Authentication operations
  getUserByEmail(email: string): Promise<User | undefined>;
  createUserWithProfile(email: string, password: string, role: string, profileData: any): Promise<{ user: User; profile: UserProfile }>;
  verifyPassword(email: string, password: string): Promise<{ user: User; profile: UserProfile } | null>;
  changePassword(userId: string, newPassword: string): Promise<void>;
  
  // Profile operations (role-based)
  getUserProfile(userId: string): Promise<UserProfile | undefined>;
  updateUserProfile(userId: string, role: string, profileData: Partial<UserProfile>): Promise<UserProfile | undefined>;
  
  // School operations
  getSchool(id: string): Promise<School | undefined>;
  getSchools(): Promise<School[]>;
  createSchool(school: InsertSchool): Promise<School>;
  updateSchool(id: string, school: Partial<School>): Promise<School | undefined>;
  
  // Student operations
  getStudent(id: string): Promise<Student | undefined>;
  getStudentByUserId(userId: string): Promise<Student | undefined>;
  getStudentsBySchool(schoolId: string): Promise<Student[]>;
  getStudentByEmail(email: string): Promise<Student | undefined>;
  createStudent(student: InsertStudent): Promise<Student>;
  updateStudent(id: string, student: Partial<Student>): Promise<Student | undefined>;
  updateStudentByUserId(userId: string, student: Partial<Student>): Promise<Student | undefined>;
  deleteStudent(id: string): Promise<void>;
  searchSchoolStudents(schoolId: string, query: string): Promise<Student[]>;
  getStudentWithStats(userId: string): Promise<StudentWithStats | undefined>;
  getStudentWithStatsById(studentId: string): Promise<StudentWithStats | undefined>;
  getStudentStats(studentId: string): Promise<any>;
  
  // Post operations
  getPost(id: string): Promise<Post | undefined>;
  getPosts(limit?: number, offset?: number): Promise<PostWithDetails[]>;
  getPostsByStudent(studentId: string): Promise<PostWithDetails[]>;
  getPostsWithUserContext(userId: string, limit?: number, offset?: number, includeAnnouncements?: boolean): Promise<PostWithDetails[]>;
  getPostsByStudentWithUserContext(studentId: string, userId: string, limit?: number, offset?: number): Promise<PostWithDetails[]>;
  getPostsBySchoolWithUserContext(schoolId: string, userId: string, limit?: number, offset?: number, includeAnnouncements?: boolean): Promise<PostWithDetails[]>;
  getAnnouncementsForUser(userId: string, userRole: string, schoolId?: string, limit?: number, offset?: number): Promise<PostWithDetails[]>;
  createPost(post: InsertPost): Promise<Post>;
  insertPost(post: InsertPost): Promise<Post>;
  updatePost(postId: string, updates: Partial<Post>): Promise<Post | undefined>;
  
  // Interaction operations
  likePost(like: InsertPostLike): Promise<PostLike>;
  unlikePost(postId: string, userId: string): Promise<void>;
  commentOnPost(comment: InsertPostComment): Promise<PostComment>;
  getPostComments(postId: string): Promise<PostCommentWithUser[]>;
  getPostWithUserContext(postId: string, userId: string): Promise<PostWithDetails>;
  recordView(postId: string, userId: string): Promise<void>;
  savePost(save: InsertSavedPost): Promise<SavedPost>;
  unsavePost(postId: string, userId: string): Promise<void>;
  getUserSavedPosts(userId: string): Promise<PostWithDetails[]>;
  reportPost(report: InsertReportedPost): Promise<ReportedPost>;
  deletePost(postId: string, userId: string): Promise<void>;
  
  // Follow operations
  followStudent(follow: InsertStudentFollower): Promise<StudentFollower>;
  unfollowStudent(followerUserId: string, studentId: string): Promise<void>;
  getStudentFollowers(studentId: string): Promise<UserProfile[]>;
  getUserFollowing(userId: string): Promise<Student[]>;
  isFollowingStudent(followerUserId: string, studentId: string): Promise<boolean>;
  getFollowStatusesForStudents(followerUserId: string, studentIds: string[]): Promise<Map<string, boolean>>;
  searchStudents(query: string, currentUserId?: string): Promise<StudentSearchResult[]>;
  
  // General user follow operations
  followUser(followerId: string, followingId: string): Promise<void>;
  unfollowUser(followerId: string, followingId: string): Promise<void>;
  isFollowing(followerUserId: string, targetUserId: string): Promise<boolean>;
  
  // Stats operations
  getSchoolStats(schoolId: string, period?: string): Promise<any>;
  getSystemStats(): Promise<any>;
  getSchoolRecentActivity(schoolId: string, limit?: number): Promise<any[]>;
  getSchoolTopPerformers(schoolId: string, limit?: number): Promise<any[]>;
  getSchoolEngagementTrends(schoolId: string, period?: string): Promise<any[]>;
  getSchoolPostTrends(schoolId: string, period?: string): Promise<any[]>;
  getSchoolPostAnalytics(schoolId: string, limit?: number): Promise<any>;
  getSchoolStudentEngagement(schoolId: string, period?: string): Promise<any>;
  getSchoolSportAnalytics(schoolId: string): Promise<any>;
  
  // School application operations
  getSchoolApplications(): Promise<SchoolApplication[]>;
  getSchoolApplication(id: string): Promise<SchoolApplication | undefined>;
  createSchoolApplication(application: InsertSchoolApplication): Promise<SchoolApplication>;
  updateSchoolApplication(id: string, application: Partial<SchoolApplication>): Promise<SchoolApplication | undefined>;
  approveSchoolApplication(id: string, reviewerId: string): Promise<School | undefined>;
  rejectSchoolApplication(id: string, reviewerId: string, notes?: string): Promise<SchoolApplication | undefined>;
  
  // System settings operations
  getSystemSettings(): Promise<SystemSetting[]>;
  getSystemSetting(key: string): Promise<SystemSetting | undefined>;
  createOrUpdateSystemSetting(setting: InsertSystemSetting): Promise<SystemSetting>;
  deleteSystemSetting(key: string): Promise<void>;
  
  // System configuration operations
  getSystemBranding(): Promise<SystemBranding | undefined>;
  updateSystemBranding(branding: Partial<InsertSystemBranding>): Promise<SystemBranding>;
  getSystemAppearance(): Promise<SystemAppearance | undefined>;
  updateSystemAppearance(appearance: Partial<InsertSystemAppearance>): Promise<SystemAppearance>;
  getSystemPayment(): Promise<SystemPayment | undefined>;
  updateSystemPayment(payment: Partial<InsertSystemPayment>): Promise<SystemPayment>;
  
  // Admin role operations
  getAdminRoles(): Promise<AdminRole[]>;
  getAdminRole(userId: string): Promise<AdminRole | undefined>;
  createAdminRole(role: InsertAdminRole): Promise<AdminRole>;
  updateAdminRole(userId: string, role: Partial<AdminRole>): Promise<AdminRole | undefined>;
  deleteAdminRole(userId: string): Promise<void>;
  
  // Analytics operations
  logAnalyticsEvent(log: InsertAnalyticsLog): Promise<AnalyticsLog>;
  getAnalyticsLogs(eventType?: string, limit?: number): Promise<AnalyticsLog[]>;
  getAnalyticsStats(): Promise<any>;

  // Student Rating operations
  getStudentRatings(studentId: string): Promise<StudentRating[]>;
  getStudentRating(id: string): Promise<StudentRating | undefined>;
  createStudentRating(rating: InsertStudentRating): Promise<StudentRating>;
  updateStudentRating(id: string, rating: Partial<StudentRating>): Promise<StudentRating | undefined>;
  deleteStudentRating(id: string): Promise<void>;
  getAverageRating(studentId: string): Promise<number>;

  // School Setting operations
  getSchoolSettings(schoolId: string): Promise<SchoolSetting[]>;
  getSchoolSetting(schoolId: string, key: string): Promise<SchoolSetting | undefined>;
  createOrUpdateSchoolSetting(setting: InsertSchoolSetting): Promise<SchoolSetting>;
  deleteSchoolSetting(schoolId: string, key: string): Promise<void>;
  
  // XEN Watch operations
  createScoutAdmin(userInput: { name: string; email: string; xenId: string; profilePicUrl?: string }): Promise<{ user: User; profile: any }>;
  createScout(userInput: { name: string; email: string; xenId: string; profilePicUrl?: string }): Promise<{ user: User; profile: any }>;
  createXenWatchSubmission(data: { studentId: string; postId?: string; mediaUrl?: string; mediaPublicId?: string; caption?: string; selectedScoutId?: string }): Promise<any>;
  markSubmissionPaid(submissionId: string, provider: string, intentId: string): Promise<void>;
  assignSubmission(submissionId: string, scoutProfileId: string): Promise<void>;
  addReview(data: { submissionId: string; scoutId: string; rating: number; comment?: string }): Promise<any>;
  sendFinalFeedback(data: { submissionId: string; adminUserId: string; message: string }): Promise<any>;
  listMySubmissions(studentId: string): Promise<any[]>;
  listSubmissionsForScouts(params: { assignedTo?: 'me' | 'all'; status?: string; scoutId?: string }): Promise<any[]>;
  getSubmissionWithJoins(id: string): Promise<any>;
  getScoutProfiles(): Promise<any[]>;
  refreshXenWatchStats(): Promise<void>;
  getXenWatchAnalytics(): Promise<any>;
  
  // Scout management operations
  getScoutsCount(): Promise<number>;
  getScoutAnalytics(timeFilter: string): Promise<any>;
  getDetailedScoutProfiles(options: { page: number; limit: number; search?: string }): Promise<any>;
  createSampleScoutData(): Promise<any>;
  
  // Notification operations
  createNotification(notification: InsertNotification): Promise<NotificationDB>;
  getNotifications(userId: string, options?: { limit?: number; offset?: number; unreadOnly?: boolean }): Promise<NotificationDB[]>;
  markNotificationAsRead(notificationId: string, userId: string): Promise<void>;
  markAllNotificationsAsRead(userId: string): Promise<void>;
  getUnreadNotificationCount(userId: string): Promise<number>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User> = new Map();
  private schools: Map<string, School> = new Map();
  private students: Map<string, Student> = new Map();
  private posts: Map<string, Post> = new Map();
  private likes: Map<string, Like> = new Map();
  private comments: Map<string, Comment> = new Map();
  private views: Map<string, PostView> = new Map();
  private saves: Map<string, Save> = new Map();
  private reports: Map<string, Report> = new Map();
  private follows: Map<string, Follow> = new Map();
  private userFollows: Map<string, UserFollow> = new Map();
  private schoolApplications: Map<string, SchoolApplication> = new Map();
  private systemSettings: Map<string, SystemSetting> = new Map();
  private adminRoles: Map<string, AdminRole> = new Map();
  private analyticsLogs: Map<string, AnalyticsLog> = new Map();
  private studentRatings: Map<string, StudentRating> = new Map();
  private schoolSettings: Map<string, SchoolSetting> = new Map();

  constructor() {
    this.initializeDemoData();
  }

  private initializeDemoData() {
    // Create demo soccer academy
    const schoolId = randomUUID();
    const school: School = {
      id: schoolId,
      name: "Elite Soccer Academy",
      subscriptionPlan: "premium",
      maxStudents: 500,
      createdAt: new Date(),
    };
    this.schools.set(schoolId, school);

    // Create demo users
    const systemAdminId = randomUUID();
    const systemAdmin: User = {
      id: systemAdminId,
      name: "James Wilson",
      email: "admin@lockerroom.com",
      password: "Admin123!",
      role: "system_admin",
      schoolId: null,
      createdAt: new Date(),
    };
    this.users.set(systemAdminId, systemAdmin);

    const schoolAdminId = randomUUID();
    const schoolAdmin: User = {
      id: schoolAdminId,
      name: "Coach Maria Santos",
      email: "school@lockerroom.com",
      password: "School123!",
      role: "school_admin",
      schoolId: schoolId,
      createdAt: new Date(),
    };
    this.users.set(schoolAdminId, schoolAdmin);

    const studentUserId = randomUUID();
    const studentUser: User = {
      id: studentUserId,
      name: "Diego Rodriguez",
      email: "student@lockerroom.com",
      password: "Student123!",
      role: "student",
      schoolId: schoolId,
      createdAt: new Date(),
    };
    this.users.set(studentUserId, studentUser);

    const viewerId = randomUUID();
    const viewer: User = {
      id: viewerId,
      name: "John Viewer",
      email: "viewer@lockerroom.com",
      password: "Viewer123!",
      role: "viewer",
      schoolId: null,
      createdAt: new Date(),
    };
    this.users.set(viewerId, viewer);

    // Create demo student profile
    const studentId = randomUUID();
    const student: Student = {
      id: studentId,
      userId: studentUserId,
      roleNumber: "10",
      dateOfBirth: "2006-03-15",
      position: "Attacking Midfielder",
      sport: "Soccer",
      profilePic: "https://images.unsplash.com/photo-1594736797933-d0281ba35a95?auto=format&fit=crop&w=400&h=400",
      bio: "⚽ Attacking Midfielder | Team Captain | Regional Champions 2024\n📍 Elite Soccer Academy\n🎯 \"Skill and passion combined create magic\"\n📧 Contact: diego@elitesoccer.edu",
      coverPhoto: "https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=1920&h=400",
    };
    this.students.set(studentId, student);

    // Create additional students for demo
    const students = [
      {
        userId: randomUUID(),
        name: "Sofia Martinez",
        email: "sofia@elitesoccer.edu",
        roleNumber: "9",
        sport: "Soccer",
        position: "Striker"
      },
      {
        userId: randomUUID(),
        name: "Lucas Silva",
        email: "lucas@elitesoccer.edu",
        roleNumber: "4",
        sport: "Soccer",
        position: "Defender"
      }
    ];

    students.forEach(data => {
      const user: User = {
        id: data.userId,
        name: data.name,
        email: data.email,
        password: "Demo123!",
        role: "student",
        schoolId: schoolId,
        createdAt: new Date(),
      };
      this.users.set(data.userId, user);

      const student: Student = {
        id: randomUUID(),
        userId: data.userId,
        roleNumber: data.roleNumber,
        dateOfBirth: "2006-01-01",
        position: data.position,
        sport: data.sport,
        profilePic: "https://images.unsplash.com/photo-1551698618-1dfe5d97d256?auto=format&fit=crop&w=400&h=400",
        bio: `${data.sport} player at Elite Soccer Academy`,
        coverPhoto: "https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=1920&h=400",
      };
      this.students.set(student.id, student);
    });

    // Create demo posts
    const demoPosts = [
      {
        studentId: studentId,
        mediaUrl: "https://images.unsplash.com/photo-1579952363873-27d3bfad9c0d?auto=format&fit=crop&w=800&h=600",
        mediaType: "image",
        caption: "Amazing match last night! ⚽ Scored the winning goal in the 89th minute. Nothing beats that feeling when hard work pays off! #Soccer #GameWinner #EliteSoccerAcademy"
      },
      {
        studentId: students[0].userId, // Sofia
        mediaUrl: "https://images.unsplash.com/photo-1560272564-c83b66b1ad12?auto=format&fit=crop&w=800&h=600",
        mediaType: "image",
        caption: "Training hard every day 💪 Working on my finishing in the box. Coach Santos says precision is key! #SoccerLife #Training #NeverGiveUp"
      },
      {
        studentId: students[1].userId, // Lucas
        mediaUrl: "https://images.unsplash.com/photo-1551698618-1dfe5d97d256?auto=format&fit=crop&w=800&h=600",
        mediaType: "image",
        caption: "Clean sheet today! 🥅 Defense worked perfectly as a unit. So proud of how far we've come this season. #Soccer #TeamWork #Defense"
      },
      {
        studentId: studentId,
        mediaUrl: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?auto=format&fit=crop&w=800&h=600",
        mediaType: "image",
        caption: "Highlight reel from yesterday's practice 🎥 Working on my passing and vision. Thanks to Coach Santos for the extra training! #Soccer #Skills #Dedication"
      },
      {
        studentId: students[0].userId, // Sofia
        mediaUrl: "https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=800&h=600",
        mediaType: "image",
        caption: "Team celebration after our big win! 🎉 Chemistry on and off the field is what makes us strong. Love this team! #TeamBonding #Soccer #Family"
      }
    ];

    demoPosts.forEach(postData => {
      const postId = randomUUID();
      const post: Post = {
        id: postId,
        studentId: postData.studentId,
        mediaUrl: postData.mediaUrl,
        mediaType: postData.mediaType,
        caption: postData.caption,
        createdAt: new Date(Date.now() - Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000)), // Random time within last week
      };
      this.posts.set(postId, post);

      // Add some demo likes and comments
      const numLikes = Math.floor(Math.random() * 50) + 10;
      const numComments = Math.floor(Math.random() * 8) + 1;
      
      for (let i = 0; i < numLikes; i++) {
        const likeId = randomUUID();
        const like: Like = {
          id: likeId,
          postId: postId,
          userId: Math.random() > 0.5 ? viewerId : schoolAdminId,
          createdAt: new Date(),
        };
        this.postLikes.set(likeId, like);
      }

      for (let i = 0; i < numComments; i++) {
        const commentId = randomUUID();
        const comments = [
          "Great goal! ⚽🔥",
          "Keep it up! You're doing amazing",
          "So proud of you!",
          "This is why you're the best player on the team",
          "Can't wait to see you play next match",
          "Your hard work is paying off!",
          "Inspiring performance! 👏",
          "Way to go! Keep pushing yourself",
          "Beautiful technique! 🙌",
          "That touch was incredible!"
        ];
        const comment: Comment = {
          id: commentId,
          postId: postId,
          userId: Math.random() > 0.5 ? viewerId : schoolAdminId,
          content: comments[Math.floor(Math.random() * comments.length)],
          createdAt: new Date(),
        };
        this.postComments.set(commentId, comment);
      }
    });
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.email === email);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const saltRounds = 10;
    
    
    // Hash the password before creating the user
    const hashedPassword = await bcrypt.hash(insertUser.password, saltRounds);
    
    const id = randomUUID();
    const { password, ...userWithoutPassword } = insertUser; // Exclude original password
    const user: User = { 
      ...userWithoutPassword, 
      id,
      role: insertUser.role || "viewer",
      schoolId: insertUser.schoolId || null,
      password: hashedPassword, // Use the hashed password
      createdAt: new Date()
    };
    
    this.users.set(id, user);
    return user;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    
    const updatedUser = { ...user, ...updates };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  async getSchool(id: string): Promise<School | undefined> {
    return this.schools.get(id);
  }

  async getSchools(): Promise<School[]> {
    return Array.from(this.schools.values());
  }

  async createSchool(insertSchool: InsertSchool): Promise<School> {
    const id = randomUUID();
    const school: School = { 
      ...insertSchool, 
      id,
      subscriptionPlan: insertSchool.subscriptionPlan || "standard",
      maxStudents: insertSchool.maxStudents || 100,
      createdAt: new Date()
    };
    this.schools.set(id, school);
    return school;
  }

  async updateSchool(id: string, updates: Partial<School>): Promise<School | undefined> {
    const school = this.schools.get(id);
    if (!school) return undefined;
    
    const updatedSchool = { ...school, ...updates };
    this.schools.set(id, updatedSchool);
    return updatedSchool;
  }

  async getStudent(id: string): Promise<Student | undefined> {
    return this.students.get(id);
  }

  async getStudentByUserId(userId: string): Promise<Student | undefined> {
    return Array.from(this.students.values()).find(student => student.userId === userId);
  }

  async getStudentsBySchool(schoolId: string): Promise<Student[]> {
    const schoolUsers = Array.from(this.users.values()).filter(user => user.schoolId === schoolId);
    return Array.from(this.students.values()).filter(student => 
      schoolUsers.some(user => user.id === student.userId)
    );
  }

  async getStudentByEmail(email: string): Promise<Student | undefined> {
    const user = await this.getUserByEmail(email);
    if (!user) return undefined;
    return this.getStudentByUserId(user.id);
  }

  async deleteStudent(id: string): Promise<void> {
    this.students.delete(id);
  }

  async searchSchoolStudents(schoolId: string, query: string): Promise<Student[]> {
    const schoolStudents = await this.getStudentsBySchool(schoolId);
    const searchTerm = query.toLowerCase();
    
    return schoolStudents.filter(student => {
      const user = this.users.get(student.userId);
      if (!user) return false;
      
      const searchableText = `${user.name} ${student.sport || ''} ${student.position || ''} ${student.roleNumber || ''}`.toLowerCase();
      return searchableText.includes(searchTerm);
    });
  }

  async createStudent(insertStudent: InsertStudent): Promise<Student> {
    const id = randomUUID();
    const student: Student = { 
      ...insertStudent, 
      id,
      roleNumber: insertStudent.roleNumber || null,
      dateOfBirth: insertStudent.dateOfBirth || null,
      position: insertStudent.position || null,
      sport: insertStudent.sport || null,
      profilePic: insertStudent.profilePic || null,
      bio: insertStudent.bio || null,
      coverPhoto: insertStudent.coverPhoto || null
    };
    this.students.set(id, student);
    return student;
  }

  async updateStudent(id: string, updates: Partial<Student>): Promise<Student | undefined> {
    const student = this.students.get(id);
    if (!student) return undefined;
    
    const updatedStudent = { ...student, ...updates };
    this.students.set(id, updatedStudent);
    return updatedStudent;
  }

  async updateStudentByUserId(userId: string, updates: any): Promise<Student | undefined> {
    if (!userId) throw new Error("No userId provided");
    if (!updates || Object.keys(updates).length === 0) return null;
    
    const student = Array.from(this.students.values()).find(s => s.userId === userId);
    if (!student) return undefined;
    
    // Map the updates to match the in-memory structure
    const mappedUpdates: any = {};
    if (updates.bio !== undefined) mappedUpdates.bio = updates.bio;
    if (updates.sport !== undefined) mappedUpdates.sport = updates.sport;
    if (updates.position !== undefined) mappedUpdates.position = updates.position;
    if (updates.role_number !== undefined) mappedUpdates.roleNumber = updates.role_number;
    if (updates.profile_pic_url !== undefined) mappedUpdates.profilePicUrl = updates.profile_pic_url;
    if (updates.cover_photo !== undefined) mappedUpdates.coverPhoto = updates.cover_photo;
    
    const updatedStudent = { ...student, ...mappedUpdates };
    this.students.set(student.id, updatedStudent);
    return updatedStudent;
  }

  async getStudentWithStats(userId: string): Promise<StudentWithStats | undefined> {
    const student = await this.getStudentByUserId(userId);
    if (!student) return undefined;

    const user = await this.getUser(userId);
    if (!user) return undefined;

    const school = user.schoolId ? await this.getSchool(user.schoolId) : undefined;
    
    const studentPosts = Array.from(this.posts.values()).filter(post => post.studentId === student.id);
    const postsCount = studentPosts.length;
    
    // Skip expensive stats calculations for profile views
    const totalLikes = 0;
    const totalViews = 0;
    const totalSaves = 0;
    const totalComments = 0;
    const followersCount = 0;
    const followingCount = 0;

    return {
      ...student,
      user,
      school,
      postsCount,
      totalLikes,
      totalViews,
      totalSaves,
      totalComments,
      followersCount,
      followingCount,
    };
  }

  async getStudentWithStatsById(studentId: string): Promise<StudentWithStats | undefined> {
    const student = await this.getStudent(studentId);
    if (!student) return undefined;

    const user = await this.getUser(student.userId);
    if (!user) return undefined;

    const school = user.schoolId ? await this.getSchool(user.schoolId) : undefined;
    
    const studentPosts = Array.from(this.posts.values()).filter(post => post.studentId === student.id);
    const postsCount = studentPosts.length;
    
    // Skip expensive stats calculations for profile views
    const totalLikes = 0;
    const totalViews = 0;
    const totalSaves = 0;
    const totalComments = 0;
    const followersCount = 0;
    const followingCount = 0;

    return {
      ...student,
      user,
      school,
      postsCount,
      totalLikes,
      totalViews,
      totalSaves,
      totalComments,
      followersCount,
      followingCount,
    };
  }

  async getStudentStats(studentId: string): Promise<any> {
    const student = await this.getStudent(studentId);
    if (!student) return null;

    const studentPosts = Array.from(this.posts.values()).filter(post => post.studentId === student.id);
    const postsCount = studentPosts.length;
    
    let totalLikes = 0;
    let totalViews = 0;
    let totalSaves = 0;
    let totalComments = 0;

    studentPosts.forEach(post => {
      const postLikes = Array.from(this.postLikes.values()).filter(like => like.postId === post.id);
      const postComments = Array.from(this.postComments.values()).filter(comment => comment.postId === post.id);
      const postSaves = Array.from(this.savedPosts.values()).filter(save => save.postId === post.id);
      
      totalLikes += postLikes.length;
      totalComments += postComments.length;
      totalSaves += postSaves.length;
      totalViews += Math.floor(Math.random() * 1000) + 100; // Mock views
    });

    // Generate mock weekly activity and monthly performance
    const weeklyActivity = Array.from({ length: 7 }, (_, i) => ({
      day: new Date(Date.now() - (6 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      posts: Math.floor(Math.random() * 3),
      likes: Math.floor(Math.random() * 20),
      comments: Math.floor(Math.random() * 5)
    }));

    const monthlyPerformance = Array.from({ length: 12 }, (_, i) => ({
      month: new Date(2024, i, 1).toLocaleString('default', { month: 'short' }),
      posts: Math.floor(Math.random() * 10),
      likes: Math.floor(Math.random() * 100),
      comments: Math.floor(Math.random() * 25),
      views: Math.floor(Math.random() * 1000)
    }));

    // Get top performing posts (by engagement) - mock data for MemStorage
    const topPosts = studentPosts.slice(0, 5).map((post, index) => {
      const postLikes = Array.from(this.postLikes.values()).filter(like => like.postId === post.id);
      const postComments = Array.from(this.postComments.values()).filter(comment => comment.postId === post.id);
      const postSaves = Array.from(this.savedPosts.values()).filter(save => save.postId === post.id);
      
      const engagement = postLikes.length + postComments.length + postSaves.length;
      const calculatedViews = Math.max(10, postLikes.length * 5 + postComments.length * 3 + postSaves.length * 2);
      
      return {
        id: post.id,
        caption: post.caption,
        title: post.title || 'Untitled Post',
        mediaUrl: post.mediaUrl,
        thumbnailUrl: post.mediaUrl,
        mediaType: post.mediaType,
        views: calculatedViews,
        likes: postLikes.length,
        comments: postComments.length,
        saves: postSaves.length,
        engagement: engagement + calculatedViews,
        createdAt: post.createdAt
      };
    });

    // Generate mock milestones
    const milestones = [];
    
    if (totalViews >= 100) {
      milestones.push({
        id: 'first-100-views',
        title: 'First 100 Views',
        description: 'Reached 100 total post views',
        icon: 'eye',
        date: new Date().toISOString().split('T')[0]
      });
    }
    
    if (topPosts.length > 0) {
      milestones.push({
        id: 'most-liked-post',
        title: 'Most Liked Post',
        description: `"${topPosts[0].title}" with ${Math.floor(Math.random() * 50) + 10} likes`,
        icon: 'heart',
        date: new Date().toISOString().split('T')[0]
      });
    }
    
    if (postsCount >= 5) {
      milestones.push({
        id: 'consistency-badge',
        title: 'Consistency Champion',
        description: `Posted ${postsCount} times total`,
        icon: 'calendar',
        date: new Date().toISOString().split('T')[0]
      });
    }

    return {
      postsCount,
      totalLikes,
      totalComments,
      totalSaves,
      totalViews,
      weeklyActivity,
      monthlyEngagement: monthlyPerformance,
      topPosts,
      milestones
    };
  }

  async getPost(id: string): Promise<Post | undefined> {
    return this.posts.get(id);
  }

  async getPosts(): Promise<PostWithDetails[]> {
    const posts = Array.from(this.posts.values()).sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );
    
    return Promise.all(posts.map(async (post) => {
      const student = this.students.get(post.studentId);
      const user = student ? this.users.get(student.userId) : undefined;
      const likes = Array.from(this.postLikes.values()).filter(like => like.postId === post.id);
      const comments = Array.from(this.postComments.values()).filter(comment => comment.postId === post.id);
      const saves = Array.from(this.savedPosts.values()).filter(save => save.postId === post.id);
      
      const commentsWithUsers = await Promise.all(comments.map(async (comment) => {
        const commentUser = this.users.get(comment.userId);
        return { ...comment, user: commentUser! };
      }));

      return {
        ...post,
        student: { ...student!, user: user! },
        likes,
        comments: commentsWithUsers,
        saves,
        likesCount: likes.length,
        commentsCount: comments.length,
        savesCount: saves.length,
        viewsCount: Math.floor(Math.random() * 2000) + 100,
      };
    }));
  }

  async getPostsByStudent(studentId: string): Promise<PostWithDetails[]> {
    const allPosts = await this.getPosts();
    return allPosts.filter(post => post.studentId === studentId);
  }

  async createPost(insertPost: InsertPost): Promise<Post> {
    const id = randomUUID();
    const post: Post = { 
      ...insertPost, 
      id,
      caption: insertPost.caption || null,
      createdAt: new Date()
    };
    this.posts.set(id, post);
    return post;
  }

  async insertPost(insertPost: InsertPost): Promise<Post> {
    return this.createPost(insertPost);
  }

  async updatePost(postId: string, updates: Partial<Post>): Promise<Post | undefined> {
    const existingPost = this.posts.get(postId);
    if (!existingPost) return undefined;
    
    const updatedPost = { ...existingPost, ...updates };
    this.posts.set(postId, updatedPost);
    return updatedPost;
  }

  async likePost(insertLike: InsertLike): Promise<Like> {
    const id = randomUUID();
    const like: Like = { 
      ...insertLike, 
      id,
      createdAt: new Date()
    };
    this.postLikes.set(id, like);
    return like;
  }

  async unlikePost(postId: string, userId: string): Promise<void> {
    const like = Array.from(this.postLikes.values()).find(
      like => like.postId === postId && like.userId === userId
    );
    if (like) {
      this.postLikes.delete(like.id);
    }
  }

  async commentOnPost(insertComment: InsertComment): Promise<Comment> {
    const id = randomUUID();
    const comment: Comment = { 
      ...insertComment, 
      id,
      createdAt: new Date()
    };
    this.postComments.set(id, comment);
    return comment;
  }

  async getPostComments(postId: string): Promise<CommentWithUser[]> {
    const comments = Array.from(this.postComments.values())
      .filter(comment => comment.postId === postId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    
    // Enrich comments with user data
    const commentsWithUsers: CommentWithUser[] = [];
    for (const comment of comments) {
      const user = this.users.get(comment.userId);
      if (user) {
        commentsWithUsers.push({
          ...comment,
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            password: user.password,
            role: user.role,
            schoolId: user.schoolId,
            createdAt: user.createdAt,
            profilePicUrl: user.profilePicUrl
          }
        });
      }
    }
    
    return commentsWithUsers;
  }

  async recordView(postId: string, userId: string): Promise<void> {
    // Check if this view already exists (unique constraint)
    const existingView = Array.from(this.views.values()).find(
      view => view.postId === postId && view.userId === userId
    );
    
    if (!existingView) {
      const id = randomUUID();
      const view: PostView = {
        id,
        postId,
        userId,
        viewedAt: new Date(),
      };
      this.views.set(id, view);
    }
  }

  async getPostWithUserContext(postId: string, userId: string): Promise<PostWithDetails> {
    const post = this.posts.get(postId);
    if (!post) throw new Error('Post not found');

    const student = this.students.get(post.studentId);
    if (!student) throw new Error('Student not found');

    const user = this.users.get(student.userId);
    if (!user) throw new Error('User not found');

    // Get likes, comments, saves, and views for this post
    const likes = Array.from(this.postLikes.values()).filter(like => like.postId === postId);
    const comments = Array.from(this.postComments.values()).filter(comment => comment.postId === postId);
    const saves = Array.from(this.savedPosts.values()).filter(save => save.postId === postId);
    const views = Array.from(this.views.values()).filter(view => view.postId === postId);

    // Check if current user has liked/saved this post
    const userLike = likes.find(like => like.userId === userId);
    const userSave = saves.find(save => save.userId === userId);

    // Enrich comments with user data
    const commentsWithUsers: CommentWithUser[] = [];
    for (const comment of comments) {
      const commentUser = this.users.get(comment.userId);
      if (commentUser) {
        commentsWithUsers.push({
          ...comment,
          user: {
            id: commentUser.id,
            name: commentUser.name || 'Anonymous',
            profilePicUrl: commentUser.profilePicUrl || null
          }
        });
      }
    }

    return {
      ...post,
      student: {
        id: student.id,
        userId: student.userId,
        name: student.name,
        sport: student.sport || '',
        position: student.position || '',
        roleNumber: student.roleNumber || '',
        profilePicUrl: student.profilePicUrl || student.profilePic || null
      },
      likesCount: likes.length,
      commentsCount: comments.length,
      savesCount: saves.length,
      viewCount: views.length,
      isLiked: !!userLike,
      isSaved: !!userSave,
    };
  }

  async savePost(insertSave: InsertSave): Promise<Save> {
    const id = randomUUID();
    const save: Save = { 
      ...insertSave, 
      id,
      createdAt: new Date()
    };
    this.savedPosts.set(id, save);
    return save;
  }

  async unsavePost(postId: string, userId: string): Promise<void> {
    const save = Array.from(this.savedPosts.values()).find(
      save => save.postId === postId && save.userId === userId
    );
    if (save) {
      this.savedPosts.delete(save.id);
    }
  }

  async getUserSavedPosts(userId: string): Promise<PostWithDetails[]> {
    const savedPostIds = Array.from(this.savedPosts.values())
      .filter(save => save.userId === userId)
      .map(save => save.postId);
    
    const posts: PostWithDetails[] = [];
    for (const postId of savedPostIds) {
      const post = this.posts.get(postId);
      if (post) {
        const details = await this.getPostDetails(post);
        posts.push(details);
      }
    }
    
    // Sort by creation date, newest first
    return posts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async reportPost(insertReport: InsertReportedPost): Promise<ReportedPost> {
    const id = randomUUID();
    const report: ReportedPost = { 
      ...insertReport, 
      id,
      createdAt: new Date()
    };
    this.reports.set(id, report);
    return report;
  }

  async deletePost(postId: string, userId: string): Promise<void> {
    const post = this.posts.get(postId);
    if (!post) return;
    
    // Check if user owns the post
    const student = this.students.get(post.studentId);
    if (!student || student.userId !== userId) {
      throw new Error('Unauthorized to delete this post');
    }
    
    // Delete related data
    Array.from(this.postLikes.values())
      .filter(like => like.postId === postId)
      .forEach(like => this.postLikes.delete(like.id));
    
    Array.from(this.postComments.values())
      .filter(comment => comment.postId === postId)
      .forEach(comment => this.postComments.delete(comment.id));
    
    Array.from(this.savedPosts.values())
      .filter(save => save.postId === postId)
      .forEach(save => this.savedPosts.delete(save.id));
    
    Array.from(this.reports.values())
      .filter(report => report.postId === postId)
      .forEach(report => this.reports.delete(report.id));
    
    // Delete the post
    this.posts.delete(postId);
  }

  async getSchoolStats(schoolId: string): Promise<any> {
    const schoolStudents = await this.getStudentsBySchool(schoolId);
    const studentIds = schoolStudents.map(s => s.id);
    const schoolPosts = Array.from(this.posts.values()).filter(post => 
      studentIds.includes(post.studentId)
    );
    
    let totalLikes = 0;
    let totalComments = 0;
    let totalSaves = 0;

    schoolPosts.forEach(post => {
      totalLikes += Array.from(this.postLikes.values()).filter(like => like.postId === post.id).length;
      totalComments += Array.from(this.postComments.values()).filter(comment => comment.postId === post.id).length;
      totalSaves += Array.from(this.savedPosts.values()).filter(save => save.postId === post.id).length;
    });

    return {
      totalStudents: schoolStudents.length,
      totalPosts: schoolPosts.length,
      totalEngagement: totalLikes + totalComments + totalSaves,
      activeSports: Array.from(new Set(schoolStudents.map(s => s.sport).filter(Boolean))).length,
    };
  }

  async getSystemStats(): Promise<any> {
    const schools = this.schools.size;
    const students = Array.from(this.users.values()).filter(user => user.role === "student").length;
    const posts = this.posts.size;
    const premiumSchools = Array.from(this.schools.values()).filter(school => school.subscriptionPlan === "premium").length;
    const standardSchools = Array.from(this.schools.values()).filter(school => school.subscriptionPlan === "standard").length;
    
    const monthlyRevenue = (premiumSchools * 150) + (standardSchools * 75);

    return {
      totalSchools: schools,
      activeStudents: students,
      contentUploads: posts,
      monthlyRevenue,
      premiumSchools,
      standardSchools,
    };
  }

  async getSchoolRecentActivity(schoolId: string, limit: number = 5): Promise<any[]> {
    const schoolStudents = await this.getStudentsBySchool(schoolId);
    const studentIds = schoolStudents.map(s => s.id);
    
    // Get all posts from school students, sorted by creation date
    const schoolPosts = Array.from(this.posts.values())
      .filter(post => studentIds.includes(post.studentId))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);

    const activity = [];
    for (const post of schoolPosts) {
      const student = schoolStudents.find(s => s.id === post.studentId);
      const user = student ? Array.from(this.users.values()).find(u => u.id === student.userId) : null;
      
      if (student && user) {
        const likes = Array.from(this.postLikes.values()).filter(like => like.postId === post.id).length;
        const comments = Array.from(this.postComments.values()).filter(comment => comment.postId === post.id).length;
        const engagement = likes + comments;

        activity.push({
          id: post.id,
          studentId: student.id,
          studentName: user.name,
          studentProfilePic: student.profilePicUrl || user.profilePicUrl,
          sport: student.sport,
          postType: post.mediaType || 'image',
          content: post.content,
          mediaUrl: post.mediaUrl,
          createdAt: post.createdAt,
          engagement: engagement,
          likes: likes,
          comments: comments
        });
      }
    }

    return activity;
  }

  async getSchoolTopPerformers(schoolId: string, limit: number = 5): Promise<any[]> {
    const schoolStudents = await this.getStudentsBySchool(schoolId);
    
    const performers = [];
    for (const student of schoolStudents) {
      const user = Array.from(this.users.values()).find(u => u.id === student.userId);
      if (!user) continue;

      const studentPosts = Array.from(this.posts.values()).filter(post => post.studentId === student.id);
      
      let totalEngagement = 0;
      for (const post of studentPosts) {
        const likes = Array.from(this.postLikes.values()).filter(like => like.postId === post.id).length;
        const comments = Array.from(this.postComments.values()).filter(comment => comment.postId === post.id).length;
        totalEngagement += likes + comments;
      }

      performers.push({
        studentId: student.id,
        studentName: user.name,
        studentProfilePic: student.profilePicUrl || user.profilePicUrl,
        sport: student.sport,
        totalEngagement: totalEngagement,
        postsCount: studentPosts.length,
        mediaUrl: studentPosts.length > 0 ? studentPosts[0].mediaUrl : null
      });
    }

    // Sort by engagement and return top performers
    return performers
      .sort((a, b) => b.totalEngagement - a.totalEngagement)
      .slice(0, limit);
  }

  async followStudent(insertFollow: InsertFollow): Promise<Follow> {
    const id = randomUUID();
    const follow: Follow = { 
      ...insertFollow, 
      id,
      createdAt: new Date()
    };
    this.studentFollowers.set(id, follow);
    return follow;
  }

  async unfollowStudent(followerId: string, followingId: string): Promise<void> {
    const follow = Array.from(this.studentFollowers.values()).find(
      follow => follow.followerUserId === followerId && follow.studentId === followingId
    );
    if (follow) {
      this.studentFollowers.delete(follow.id);
    }
  }

  async isFollowingStudent(followerUserId: string, studentId: string): Promise<boolean> {
    const follow = Array.from(this.studentFollowers.values()).find(
      follow => follow.followerUserId === followerUserId && follow.studentId === studentId
    );
    return !!follow;
  }

  async getFollowStatusesForStudents(followerUserId: string, studentIds: string[]): Promise<Map<string, boolean>> {
    const followMap = new Map<string, boolean>();
    studentIds.forEach(id => followMap.set(id, false)); // Initialize all as false
    
    const follows = Array.from(this.studentFollowers.values()).filter(
      follow => follow.followerUserId === followerUserId && studentIds.includes(follow.studentId)
    );
    
    follows.forEach(follow => followMap.set(follow.studentId, true));
    return followMap;
  }

  async getFollowers(studentId: string): Promise<User[]> {
    const followRecords = Array.from(this.studentFollowers.values()).filter(follow => follow.studentId === studentId);
    return followRecords.map(follow => this.users.get(follow.followerUserId)!).filter(Boolean);
  }

  async getFollowing(userId: string): Promise<Student[]> {
    const followRecords = Array.from(this.studentFollowers.values()).filter(follow => follow.followerUserId === userId);
    return followRecords.map(follow => 
      Array.from(this.students.values()).find(student => student.id === follow.studentId)
    ).filter(Boolean) as Student[];
  }

  async isFollowing(followerId: string, followingId: string): Promise<boolean> {
    return Array.from(this.studentFollowers.values()).some(
      follow => follow.followerUserId === followerId && follow.studentId === followingId
    );
  }

  async searchStudents(query: string, currentUserId?: string): Promise<StudentSearchResult[]> {
    const searchTerm = query.toLowerCase();
    const results: StudentSearchResult[] = [];

    for (const student of this.students.values()) {
      const user = this.users.get(student.userId);
      if (!user) continue;

      // Search in name, sport, position
      const searchableText = `${user.name} ${student.sport || ''} ${student.position || ''}`.toLowerCase();
      if (searchableText.includes(searchTerm)) {
        const school = user.schoolId ? this.schools.get(user.schoolId) : undefined;
        const followersCount = Array.from(this.studentFollowers.values()).filter(follow => follow.studentId === student.id).length;
        const isFollowing = currentUserId ? await this.isFollowing(currentUserId, student.id) : false;

        results.push({
          ...student,
          user,
          school,
          followersCount,
          isFollowing,
        });
      }
    }

    return results.sort((a, b) => b.followersCount - a.followersCount); // Sort by popularity
  }


  // School application operations (stub implementations)
  async getSchoolApplications(): Promise<SchoolApplication[]> {
    return Array.from(this.schoolApplications.values());
  }

  async getSchoolApplication(id: string): Promise<SchoolApplication | undefined> {
    return this.schoolApplications.get(id);
  }

  async createSchoolApplication(application: InsertSchoolApplication): Promise<SchoolApplication> {
    const id = randomUUID();
    const newApplication: SchoolApplication = {
      id,
      ...application,
      status: "pending",
      reviewedBy: null,
      reviewedAt: null,
      createdAt: new Date(),
    };
    this.schoolApplications.set(id, newApplication);
    return newApplication;
  }

  async updateSchoolApplication(id: string, application: Partial<SchoolApplication>): Promise<SchoolApplication | undefined> {
    const existing = this.schoolApplications.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...application };
    this.schoolApplications.set(id, updated);
    return updated;
  }

  async approveSchoolApplication(id: string, reviewerId: string): Promise<School | undefined> {
    const application = this.schoolApplications.get(id);
    if (!application) return undefined;
    
    const school = await this.createSchool({
      name: application.schoolName,
      subscriptionPlan: application.planType as "standard" | "premium",
      maxStudents: application.expectedStudents || 100,
    });
    
    await this.updateSchoolApplication(id, {
      status: "approved",
      reviewedBy: reviewerId,
      reviewedAt: new Date(),
    });
    
    return school;
  }

  async rejectSchoolApplication(id: string, reviewerId: string, notes?: string): Promise<SchoolApplication | undefined> {
    return await this.updateSchoolApplication(id, {
      status: "rejected",
      reviewedBy: reviewerId,
      reviewedAt: new Date(),
      notes: notes,
    });
  }

  // System settings operations (stub implementations)
  async getSystemSettings(): Promise<SystemSetting[]> {
    return Array.from(this.systemSettings.values());
  }

  async getSystemSetting(key: string): Promise<SystemSetting | undefined> {
    return Array.from(this.systemSettings.values()).find(s => s.key === key);
  }

  async createOrUpdateSystemSetting(setting: InsertSystemSetting): Promise<SystemSetting> {
    const existing = Array.from(this.systemSettings.values()).find(s => s.key === setting.key);
    if (existing) {
      const updated = { ...existing, ...setting, updatedAt: new Date() };
      this.systemSettings.set(existing.id, updated);
      return updated;
    } else {
      const id = randomUUID();
      const newSetting: SystemSetting = {
        id,
        ...setting,
        updatedAt: new Date(),
      };
      this.systemSettings.set(id, newSetting);
      return newSetting;
    }
  }

  async deleteSystemSetting(key: string): Promise<void> {
    const setting = Array.from(this.systemSettings.values()).find(s => s.key === key);
    if (setting) {
      this.systemSettings.delete(setting.id);
    }
  }

  // Admin role operations (stub implementations)
  async getAdminRoles(): Promise<AdminRole[]> {
    return Array.from(this.adminRoles.values());
  }

  async getAdminRole(userId: string): Promise<AdminRole | undefined> {
    return Array.from(this.adminRoles.values()).find(r => r.userId === userId);
  }

  async createAdminRole(role: InsertAdminRole): Promise<AdminRole> {
    const id = randomUUID();
    const newRole: AdminRole = {
      id,
      ...role,
      createdAt: new Date(),
    };
    this.adminRoles.set(id, newRole);
    return newRole;
  }

  async updateAdminRole(userId: string, role: Partial<AdminRole>): Promise<AdminRole | undefined> {
    const existing = Array.from(this.adminRoles.values()).find(r => r.userId === userId);
    if (!existing) return undefined;
    const updated = { ...existing, ...role };
    this.adminRoles.set(existing.id, updated);
    return updated;
  }

  async deleteAdminRole(userId: string): Promise<void> {
    const role = Array.from(this.adminRoles.values()).find(r => r.userId === userId);
    if (role) {
      this.adminRoles.delete(role.id);
    }
  }

  // Analytics operations (stub implementations)
  async logAnalyticsEvent(log: InsertAnalyticsLog): Promise<AnalyticsLog> {
    const id = randomUUID();
    const newLog: AnalyticsLog = {
      id,
      ...log,
      timestamp: new Date(),
    };
    this.analyticsLogs.set(id, newLog);
    return newLog;
  }

  async getAnalyticsLogs(eventType?: string, limit?: number): Promise<AnalyticsLog[]> {
    const logs = Array.from(this.analyticsLogs.values());
    const filtered = eventType ? logs.filter(l => l.eventType === eventType) : logs;
    const sorted = filtered.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    return limit ? sorted.slice(0, limit) : sorted;
  }

  async getAnalyticsStats(): Promise<any> {
    const logs = Array.from(this.analyticsLogs.values());
    const userSignups = logs.filter(l => l.eventType === "user_signup").length;
    const postCreated = logs.filter(l => l.eventType === "post_created").length;
    const schoolOnboarded = logs.filter(l => l.eventType === "school_onboarded").length;
    
    return {
      userSignups,
      postCreated,
      schoolOnboarded,
      totalEvents: logs.length,
    };
  }

  // Student Rating operations
  async getStudentRatings(studentId: string): Promise<StudentRating[]> {
    return Array.from(this.studentRatings.values()).filter(rating => rating.studentId === studentId);
  }

  async getStudentRating(id: string): Promise<StudentRating | undefined> {
    return this.studentRatings.get(id);
  }

  async createStudentRating(rating: InsertStudentRating): Promise<StudentRating> {
    const id = randomUUID();
    const newRating: StudentRating = {
      id,
      ...rating,
      createdAt: new Date(),
    };
    this.studentRatings.set(id, newRating);
    return newRating;
  }

  async updateStudentRating(id: string, rating: Partial<StudentRating>): Promise<StudentRating | undefined> {
    const existing = this.studentRatings.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...rating };
    this.studentRatings.set(id, updated);
    return updated;
  }

  async deleteStudentRating(id: string): Promise<void> {
    this.studentRatings.delete(id);
  }

  async getAverageRating(studentId: string): Promise<number> {
    const ratings = await this.getStudentRatings(studentId);
    if (ratings.length === 0) return 0;
    const sum = ratings.reduce((acc, rating) => acc + rating.rating, 0);
    return sum / ratings.length;
  }

  // School Setting operations
  async getSchoolSettings(schoolId: string): Promise<SchoolSetting[]> {
    return Array.from(this.schoolSettings.values()).filter(setting => setting.schoolId === schoolId);
  }

  async getSchoolSetting(schoolId: string, key: string): Promise<SchoolSetting | undefined> {
    return Array.from(this.schoolSettings.values()).find(setting => 
      setting.schoolId === schoolId && setting.key === key
    );
  }

  async createOrUpdateSchoolSetting(setting: InsertSchoolSetting): Promise<SchoolSetting> {
    const existing = await this.getSchoolSetting(setting.schoolId, setting.key);
    if (existing) {
      const updated = { ...existing, ...setting, updatedAt: new Date() };
      this.schoolSettings.set(existing.id, updated);
      return updated;
    } else {
      const id = randomUUID();
      const newSetting: SchoolSetting = {
        id,
        ...setting,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.schoolSettings.set(id, newSetting);
      return newSetting;
    }
  }

  async deleteSchoolSetting(schoolId: string, key: string): Promise<void> {
    const setting = await this.getSchoolSetting(schoolId, key);
    if (setting) {
      this.schoolSettings.delete(setting.id);
    }
  }

  // Helper method for getPostDetails
  private async getPostDetails(post: Post): Promise<PostWithDetails> {
    const student = this.students.get(post.studentId);
    const user = student ? this.users.get(student.userId) : undefined;
    const likes = Array.from(this.postLikes.values()).filter(like => like.postId === post.id);
    const comments = Array.from(this.postComments.values()).filter(comment => comment.postId === post.id);
    const saves = Array.from(this.savedPosts.values()).filter(save => save.postId === post.id);
    
    const commentsWithUsers = await Promise.all(comments.map(async (comment) => {
      const commentUser = this.users.get(comment.userId);
      return { ...comment, user: commentUser! };
    }));

    return {
      ...post,
      student: { ...student!, user: user! },
      likes,
      comments: commentsWithUsers,
      saves,
      likesCount: likes.length,
      commentsCount: comments.length,
      savesCount: saves.length,
      viewsCount: Math.floor(Math.random() * 2000) + 100,
    };
  }

  // General user follow operations
  async followUser(followerId: string, followingId: string): Promise<void> {
    const id = randomUUID();
    const follow: UserFollow = {
      id,
      followerId,
      followingId,
      createdAt: new Date(),
    };
    this.userFollows.set(id, follow);
  }

  async unfollowUser(followerId: string, followingId: string): Promise<void> {
    const follow = Array.from(this.userFollows.values()).find(
      f => f.followerId === followerId && f.followingId === followingId
    );
    if (follow) {
      this.userFollows.delete(follow.id);
    }
  }


  // XEN Watch stub implementations (MemStorage)
  async createScoutAdmin(userInput: { name: string; email: string; xenId: string; profilePicUrl?: string }): Promise<{ user: User; profile: any }> {
    throw new Error('XEN Watch features require PostgreSQL');
  }

  async createScout(userInput: { name: string; email: string; xenId: string; profilePicUrl?: string }): Promise<{ user: User; profile: any }> {
    throw new Error('XEN Watch features require PostgreSQL');
  }

  async createXenWatchSubmission(data: { studentId: string; postId?: string; mediaUrl?: string; mediaPublicId?: string; caption?: string; selectedScoutId?: string }): Promise<any> {
    throw new Error('XEN Watch features require PostgreSQL');
  }

  async markSubmissionPaid(submissionId: string, provider: string, intentId: string): Promise<void> {
    throw new Error('XEN Watch features require PostgreSQL');
  }

  async assignSubmission(submissionId: string, scoutProfileId: string): Promise<void> {
    throw new Error('XEN Watch features require PostgreSQL');
  }

  async addReview(data: { submissionId: string; scoutId: string; rating: number; comment?: string }): Promise<any> {
    throw new Error('XEN Watch features require PostgreSQL');
  }

  async sendFinalFeedback(data: { submissionId: string; adminUserId: string; message: string }): Promise<any> {
    throw new Error('XEN Watch features require PostgreSQL');
  }

  async listMySubmissions(studentId: string): Promise<any[]> {
    throw new Error('XEN Watch features require PostgreSQL');
  }

  async listSubmissionsForScouts(params: { assignedTo?: 'me' | 'all'; status?: string; scoutId?: string }): Promise<any[]> {
    throw new Error('XEN Watch features require PostgreSQL');
  }

  async getSubmissionWithJoins(id: string): Promise<any> {
    throw new Error('XEN Watch features require PostgreSQL');
  }

  async getScoutProfiles(): Promise<any[]> {
    throw new Error('XEN Watch features require PostgreSQL');
  }

  async refreshXenWatchStats(): Promise<void> {
    throw new Error('XEN Watch features require PostgreSQL');
  }

  async getXenWatchAnalytics(): Promise<any> {
    throw new Error('XEN Watch features require PostgreSQL');
  }

  async getScoutsCount(): Promise<number> {
    throw new Error('Scout management features require PostgreSQL');
  }

  async getScoutAnalytics(timeFilter: string): Promise<any> {
    throw new Error('Scout management features require PostgreSQL');
  }

  async getDetailedScoutProfiles(options: { page: number; limit: number; search?: string }): Promise<any> {
    throw new Error('Scout management features require PostgreSQL');
  }

  async createSampleScoutData(): Promise<any> {
    throw new Error('Sample data creation requires PostgreSQL');
  }

}

// Database connection is now handled by ./db.ts
let isDbConnected = true; // Assume connected since we're using centralized db


export class PostgresStorage implements IStorage {
  constructor() {
    if (isDbConnected) {
      this.initializeDemoData();
    }
  }

  private async initializeDemoData() {
    try {
      // Check if demo data already exists
      const existingUsers = await db.select().from(users).limit(1);
      if (existingUsers.length > 0) {
        return; // Demo data already exists
      }

      // Create demo school
      const [school] = await db.insert(schools).values({
        name: "Elite Soccer Academy",
        subscriptionPlan: "premium",
        maxStudents: 500,
      }).returning();

      // Create demo users
      const demoUsers = [
        {
          name: "James Wilson",
          email: "admin@lockerroom.com",
          password: "Admin123!",
          role: "system_admin",
          schoolId: null,
        },
        {
          name: "Coach Maria Santos",
          email: "school@lockerroom.com",
          password: "School123!",
          role: "school_admin",
          schoolId: school.id,
        },
        {
          name: "Diego Rodriguez",
          email: "student@lockerroom.com",
          password: "Student123!",
          role: "student",
          schoolId: school.id,
        },
        {
          name: "John Viewer",
          email: "viewer@lockerroom.com",
          password: "Viewer123!",
          role: "viewer",
          schoolId: null,
        },
      ];

      const createdUsers = await db.insert(users).values(demoUsers).returning();
      const studentUser = createdUsers.find(u => u.role === "student")!;

      // Create demo student profile
      await db.insert(students).values({
        userId: studentUser.id,
        roleNumber: "10",
        dateOfBirth: "2006-03-15",
        position: "Attacking Midfielder",
        sport: "Soccer",
        profilePic: "https://images.unsplash.com/photo-1594736797933-d0281ba35a95?auto=format&fit=crop&w=400&h=400",
        bio: "⚽ Attacking Midfielder | Team Captain | Regional Champions 2024\n📍 Elite Soccer Academy\n🎯 \"Skill and passion combined create magic\"\n📧 Contact: diego@elitesoccer.edu",
        coverPhoto: "https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=1920&h=400",
      });

      // Create additional demo students
      const additionalUsers = [
        {
          name: "Sofia Martinez",
          email: "sofia@elitesoccer.edu",
          password: "Demo123!",
          role: "student",
          schoolId: school.id,
        },
        {
          name: "Lucas Silva",
          email: "lucas@elitesoccer.edu",
          password: "Demo123!",
          role: "student",
          schoolId: school.id,
        },
      ];

      const additionalCreatedUsers = await db.insert(users).values(additionalUsers).returning();
      
      const additionalStudents = [
        {
          userId: additionalCreatedUsers[0].id,
          roleNumber: "9",
          dateOfBirth: "2006-01-01",
          position: "Striker",
          sport: "Soccer",
          profilePic: "https://images.unsplash.com/photo-1551698618-1dfe5d97d256?auto=format&fit=crop&w=400&h=400",
          bio: "Soccer striker at Elite Soccer Academy",
          coverPhoto: "https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=1920&h=400",
        },
        {
          userId: additionalCreatedUsers[1].id,
          roleNumber: "4",
          dateOfBirth: "2006-01-01",
          position: "Defender",
          sport: "Soccer",
          profilePic: "https://images.unsplash.com/photo-1594736797933-d0281ba35a95?auto=format&fit=crop&w=400&h=400",
          bio: "Soccer defender at Elite Soccer Academy",
          coverPhoto: "https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=1920&h=400",
        },
      ];

      await db.insert(students).values(additionalStudents);
    } catch (error) {
      console.error('Error initializing demo data:', error);
    }
  }

  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0];
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
    return result[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const saltRounds = 10;
    
    
    // Hash the password before inserting into database
    const hashedPassword = await bcrypt.hash(insertUser.password, saltRounds);
    
    const { password, ...userWithoutPassword } = insertUser;
    const userData = {
      ...userWithoutPassword,
      password: hashedPassword
    };
    
    const [user] = await db.insert(users).values(userData).returning();
    return user;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    const [user] = await db.update(users).set(updates).where(eq(users.id, id)).returning();
    return user;
  }

  async getSchool(id: string): Promise<School | undefined> {
    const result = await db.select().from(schools).where(eq(schools.id, id)).limit(1);
    return result[0];
  }

  async getSchools(): Promise<School[]> {
    return await db.select().from(schools);
  }

  async createSchool(insertSchool: InsertSchool): Promise<School> {
    const [school] = await db.insert(schools).values(insertSchool).returning();
    return school;
  }

  async updateSchool(id: string, updates: Partial<School>): Promise<School | undefined> {
    const [school] = await db.update(schools).set(updates).where(eq(schools.id, id)).returning();
    return school;
  }

  async getStudent(id: string): Promise<Student | undefined> {
    const result = await db.select().from(students).where(eq(students.id, id)).limit(1);
    return result[0];
  }

  async getStudentByUserId(userId: string): Promise<Student | undefined> {
    if (!isDbConnected) return undefined;
    
    // Direct query using userId field in students table
    const result = await db.select().from(students).where(eq(students.userId, userId)).limit(1);
    return result[0];
  }

  async getStudentsBySchool(schoolId: string): Promise<Student[]> {
    if (!isDbConnected) return [];
    const result = await db.select().from(students).where(eq(students.schoolId, schoolId));
    return result;
  }

  async createStudent(insertStudent: InsertStudent): Promise<Student> {
    const [student] = await db.insert(students).values(insertStudent).returning();
    return student;
  }

  async updateStudent(id: string, updates: Partial<Student>): Promise<Student | undefined> {
    const [student] = await db.update(students).set(updates).where(eq(students.id, id)).returning();
    return student;
  }

  async updateStudentByUserId(userId: string, updates: any): Promise<Student | undefined> {
    if (!userId) throw new Error("No userId provided");
    if (!updates || Object.keys(updates).length === 0) return null;

    // Using Drizzle ORM style with safe field mapping:
    const [student] = await db
      .update(students)
      .set({
        ...(updates.bio !== undefined ? { bio: updates.bio } : {}),
        ...(updates.sport !== undefined ? { sport: updates.sport } : {}),
        ...(updates.position !== undefined ? { position: updates.position } : {}),
        ...(updates.role_number !== undefined ? { roleNumber: updates.role_number } : {}),
        ...(updates.profile_pic_url !== undefined ? { profilePicUrl: updates.profile_pic_url } : {}),
        ...(updates.cover_photo !== undefined ? { coverPhoto: updates.cover_photo } : {}),
      })
      .where(eq(students.userId, userId))
      .returning();

    return student;
  }

  async getStudentWithStats(userId: string): Promise<StudentWithStats | undefined> {
    const student = await this.getStudentByUserId(userId);
    if (!student) return undefined;

    const user = await this.getUser(userId);
    if (!user) return undefined;

    const school = user.schoolId ? await this.getSchool(user.schoolId) : undefined;
    
    const studentPosts = await db.select().from(posts).where(eq(posts.studentId, student.id));
    const postsCount = studentPosts.length;
    
    // Skip expensive stats calculations for profile views
    const totalLikes = 0;
    const totalViews = 0;
    const totalSaves = 0;
    const totalComments = 0;
    const followersCount = [];
    const followingCount = [];

    return {
      ...student,
      user,
      school,
      postsCount,
      totalLikes,
      totalViews,
      totalSaves,
      totalComments,
      followersCount: followersCount.length,
      followingCount: followingCount.length,
    };
  }

  async getStudentWithStatsById(studentId: string): Promise<StudentWithStats | undefined> {
    if (!isDbConnected) return undefined;
    
    const student = await this.getStudent(studentId);
    if (!student) return undefined;

    const user = await this.getUser(student.userId);
    if (!user) return undefined;

    const school = user.schoolId ? await this.getSchool(user.schoolId) : undefined;
    
    const studentPosts = await db.select().from(posts).where(eq(posts.studentId, student.id));
    const postsCount = studentPosts.length;
    
    // Skip expensive stats calculations for profile views
    const totalLikes = 0;
    const totalViews = 0;
    const totalSaves = 0;
    const totalComments = 0;
    const followersCount = [];
    const followingCount = [];

    return {
      ...student,
      user,
      school,
      postsCount,
      totalLikes,
      totalViews,
      totalSaves,
      totalComments,
      followersCount: followersCount.length,
      followingCount: followingCount.length,
    };
  }

  async getStudentStats(studentId: string): Promise<any> {
    const student = await this.getStudent(studentId);
    if (!student) return null;

    const studentPosts = await db.select().from(posts).where(eq(posts.studentId, student.id));
    const postsCount = studentPosts.length;
    
    let totalLikes = 0;
    let totalViews = 0;
    let totalSaves = 0;
    let totalComments = 0;

    // Calculate real engagement metrics
    for (const post of studentPosts) {
      const likes = await db.select().from(postLikes).where(eq(postLikes.postId, post.id));
      const comments = await db.select().from(postComments).where(eq(postComments.postId, post.id));
      const saves = await db.select().from(savedPosts).where(eq(savedPosts.postId, post.id));
      const views = await getPostViews(post.id);
      
      totalLikes += likes.length;
      totalComments += comments.length;
      totalSaves += saves.length;
      // For now, use a simple calculation for views - could be enhanced with actual view tracking
      totalViews += Math.max(10, likes.length * 5 + comments.length * 3 + saves.length * 2);
    }

    // Generate real weekly activity based on actual post dates
    const weeklyActivity = [];
    const today = new Date();
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      // Count posts created on this day
      const dayPosts = studentPosts.filter(post => 
        post.createdAt.toISOString().split('T')[0] === dateStr
      );
      
      // Count likes and comments for posts created on this day
      let dayLikes = 0;
      let dayComments = 0;
      
      for (const post of dayPosts) {
        const likes = await db.select().from(postLikes).where(eq(postLikes.postId, post.id));
        const comments = await db.select().from(postComments).where(eq(postComments.postId, post.id));
        dayLikes += likes.length;
        dayComments += comments.length;
      }
      
      weeklyActivity.push({
        day: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()],
        posts: dayPosts.length,
        likes: dayLikes,
        comments: dayComments
      });
    }

    // Generate monthly performance based on actual data
    const monthlyPerformance = [];
    const currentYear = new Date().getFullYear();
    
    for (let month = 0; month < 12; month++) {
      const monthStart = new Date(currentYear, month, 1);
      const monthEnd = new Date(currentYear, month + 1, 0);
      
      // Count posts created in this month
      const monthPosts = studentPosts.filter(post => 
        post.createdAt >= monthStart && post.createdAt <= monthEnd
      );
      
      // Count likes and comments for posts created in this month
      let monthLikes = 0;
      let monthComments = 0;
      let monthViews = 0;
      
      for (const post of monthPosts) {
        const likes = await db.select().from(postLikes).where(eq(postLikes.postId, post.id));
        const comments = await db.select().from(postComments).where(eq(postComments.postId, post.id));
        monthLikes += likes.length;
        monthComments += comments.length;
        monthViews += Math.max(10, likes.length * 5 + comments.length * 3);
      }
      
      monthlyPerformance.push({
        month: monthStart.toLocaleString('default', { month: 'short' }),
        posts: monthPosts.length,
        likes: monthLikes,
        comments: monthComments,
        views: monthViews
      });
    }

    // Get top performing posts (by engagement)
    const topPosts = [];
    for (const post of studentPosts) {
      const likes = await db.select().from(postLikes).where(eq(postLikes.postId, post.id));
      const comments = await db.select().from(postComments).where(eq(postComments.postId, post.id));
      const saves = await db.select().from(savedPosts).where(eq(savedPosts.postId, post.id));
      const views = await getPostViews(post.id);
      
      const engagement = likes.length + comments.length + saves.length;
      const calculatedViews = Math.max(10, likes.length * 5 + comments.length * 3 + saves.length * 2);
      
      topPosts.push({
        id: post.id,
        caption: post.caption,
        title: post.title || 'Untitled Post',
        mediaUrl: post.mediaUrl,
        thumbnailUrl: post.mediaUrl, // Use same as mediaUrl for now
        mediaType: post.mediaType,
        views: calculatedViews,
        likes: likes.length,
        comments: comments.length,
        saves: saves.length,
        engagement: engagement + calculatedViews,
        createdAt: post.createdAt
      });
    }
    
    // Sort by engagement and take top 5
    topPosts.sort((a, b) => b.engagement - a.engagement);
    const top5Posts = topPosts.slice(0, 5);

    // Generate milestones based on actual data
    const milestones = [];
    
    // First 100 views milestone
    if (totalViews >= 100) {
      milestones.push({
        id: 'first-100-views',
        title: 'First 100 Views',
        description: 'Reached 100 total post views',
        icon: 'eye',
        date: new Date().toISOString().split('T')[0]
      });
    }
    
    // Most liked post milestone
    const mostLikedPost = topPosts.reduce((max, post) => {
      const postLikes = studentPosts.find(p => p.id === post.id);
      return postLikes && post.engagement > max.engagement ? post : max;
    }, topPosts[0]);
    
    if (mostLikedPost) {
      const mostLikedPostLikes = await db.select().from(postLikes).where(eq(postLikes.postId, mostLikedPost.id));
      milestones.push({
        id: 'most-liked-post',
        title: 'Most Liked Post',
        description: `"${mostLikedPost.title}" with ${mostLikedPostLikes.length} likes`,
        icon: 'heart',
        date: mostLikedPost.createdAt?.toISOString().split('T')[0] || new Date().toISOString().split('T')[0]
      });
    }
    
    // Consistency milestone (5 posts in a week)
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const recentPosts = studentPosts.filter(post => post.createdAt >= weekAgo);
    
    if (recentPosts.length >= 5) {
      milestones.push({
        id: 'consistency-badge',
        title: 'Consistency Champion',
        description: `Posted ${recentPosts.length} times in the last week`,
        icon: 'calendar',
        date: new Date().toISOString().split('T')[0]
      });
    }

    return {
      postsCount,
      totalLikes,
      totalComments,
      totalSaves,
      totalViews,
      weeklyActivity,
      monthlyEngagement: monthlyPerformance,
      topPosts: top5Posts,
      milestones
    };
  }

  async getPost(id: string): Promise<Post | undefined> {
    const result = await db.select().from(posts).where(eq(posts.id, id)).limit(1);
    return result[0];
  }

  async getPosts(): Promise<PostWithDetails[]> {
    // Get all posts - don't filter by status to include legacy posts
    const allPosts = await db.select().from(posts).orderBy(desc(posts.createdAt));
    
    const postsWithDetails: PostWithDetails[] = [];
    
    for (const post of allPosts) {
      // Skip only posts that are explicitly in processing state (not legacy posts)
      if (post.status === 'processing') {
        continue; // Skip posts that are currently being processed
      }

      const student = await db.select().from(students).where(eq(students.id, post.studentId)).limit(1);
      if (!student[0]) continue;
      
      const likes = await db.select().from(postLikes).where(eq(postLikes.postId, post.id));
      const comments = await db.select().from(postComments).where(eq(postComments.postId, post.id));
      const saves = await db.select().from(savedPosts).where(eq(savedPosts.postId, post.id));
      const views = await getPostViews(post.id);

      // Use new fields directly since legacy fields have been migrated
      // Prefer mediaUrl (which contains secure_url from Cloudinary) with fallback
      const effectiveMediaUrl = post.mediaUrl || '';
      const effectiveMediaType = post.mediaType || 'image';
      const effectiveStatus = post.status || 'ready';

      // Add warning for null media_url
      if (!effectiveMediaUrl) {
        console.warn(`⚠️ Post ${post.id} has no media URL`);
      }

      // Only include posts that have some content
      if (!effectiveMediaUrl && !post.caption) {
        continue; // Skip posts with no content
      }

      postsWithDetails.push({
        ...post,
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
          profilePicUrl: student[0].profilePicUrl || student[0].profilePic || null
        },
        likesCount: likes.length,
        commentsCount: comments.length,
        savesCount: saves.length,
        isLiked: false, // Will be set based on current user
        isSaved: false, // Will be set based on current user
      });
    }
    
    return postsWithDetails;
  }

  async getAnnouncementsForUser(userId: string, userRole: string, schoolId?: string, limit: number = 20, offset: number = 0): Promise<PostWithDetails[]> {
    // Build query for announcements based on user role and scope
    let announcementQuery;
    
    if (userRole === 'system_admin' || userRole === 'scout_admin' || userRole === 'xen_scout') {
      // System admin can see all announcements
      announcementQuery = await db
        .select()
        .from(posts)
        .where(and(
          eq(posts.type, 'announcement'),
          eq(posts.broadcast, true),
          sql`${posts.status} != 'processing' OR ${posts.status} IS NULL`
        ))
        .orderBy(desc(posts.createdAt))
        .limit(limit)
        .offset(offset);
    } else if (userRole === 'school_admin') {
      // School admin can see global announcements and their school's announcements
      announcementQuery = await db
        .select()
        .from(posts)
        .where(and(
          eq(posts.type, 'announcement'),
          eq(posts.broadcast, true),
          sql`${posts.status} != 'processing' OR ${posts.status} IS NULL`,
          or(
            eq(posts.scope, 'global'),
            and(eq(posts.scope, 'school'), eq(posts.schoolId, schoolId))
          )
        ))
        .orderBy(desc(posts.createdAt))
        .limit(limit)
        .offset(offset);
    } else if (userRole === 'student') {
      // Students should only see announcements from their own school
      if (!schoolId) {
        return [];
      }
      announcementQuery = await db
        .select()
        .from(posts)
        .where(and(
          eq(posts.type, 'announcement'),
          eq(posts.broadcast, true),
          sql`${posts.status} != 'processing' OR ${posts.status} IS NULL`,
          and(eq(posts.scope, 'school'), eq(posts.schoolId, schoolId))
        ))
        .orderBy(desc(posts.createdAt))
        .limit(limit)
        .offset(offset);
    } else {
      // Other roles see no announcements
      return [];
    }

    const announcementsWithDetails: PostWithDetails[] = [];
    
    for (const announcement of announcementQuery) {
      // Get admin who created the announcement
      const adminResult = await db
        .select({
          user: users
        })
        .from(users)
        .where(eq(users.id, announcement.createdByAdminId))
        .limit(1);
      
      if (!adminResult[0]) continue;
      
      const { user: adminUser } = adminResult[0];
      
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
      const views = await getPostViews(announcement.id);

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

      // For school announcements, use school name; for global announcements, use platform name
      const displayName = announcement.scope === 'school' && schoolInfo 
        ? schoolInfo.name 
        : (announcement.scope === 'global' ? 'XEN Sports Platform' : adminUser.name || 'Admin');

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
    }

    return announcementsWithDetails;
  }

  async getPostsWithUserContext(userId: string, limit: number = 20, offset: number = 0, includeAnnouncements: boolean = false): Promise<PostWithDetails[]> {
    // Optimized query using JOINs to reduce N+1 problem
    const studentPostsWhereConditions = [
      sql`${posts.status} != 'processing' OR ${posts.status} IS NULL`,
      sql`${posts.studentId} IS NOT NULL`,
      sql`${posts.type} != 'announcement' OR ${posts.type} IS NULL`
    ];
    
    // Get posts with student and user data in a single query
    const postsWithStudentData = await db
      .select({
        post: posts,
        student: students,
        user: users
      })
      .from(posts)
      .innerJoin(students, eq(posts.studentId, students.id))
      .innerJoin(users, eq(students.userId, users.id))
      .where(and(...studentPostsWhereConditions))
      .orderBy(desc(posts.createdAt))
      .limit(limit)
      .offset(offset);

    if (postsWithStudentData.length === 0) {
      return [];
    }

    // Get all post IDs for batch queries
    const postIds = postsWithStudentData.map(row => row.post.id);
    
    // Batch query for all likes, comments, saves, and views
    const [allLikes, allComments, allSaves, allViews, userLikes, userSaves, followStatuses] = await Promise.all([
      // All likes for these posts
      db.select().from(postLikes).where(inArray(postLikes.postId, postIds)),
      // All comments for these posts  
      db.select().from(postComments).where(inArray(postComments.postId, postIds)),
      // All saves for these posts
      db.select().from(savedPosts).where(inArray(savedPosts.postId, postIds)),
      // All views for these posts
      db.select().from(postViews).where(inArray(postViews.postId, postIds)),
      // User's likes for these posts
      db.select().from(postLikes).where(
        and(inArray(postLikes.postId, postIds), eq(postLikes.userId, userId))
      ),
      // User's saves for these posts
      db.select().from(savedPosts).where(
        and(inArray(savedPosts.postId, postIds), eq(savedPosts.userId, userId))
      ),
      // Follow statuses for all students
      this.getFollowStatusesForStudents(userId, postsWithStudentData.map(row => row.student.id))
    ]);

    // Create lookup maps for O(1) access
    const likesMap = new Map<string, any[]>();
    const commentsMap = new Map<string, any[]>();
    const savesMap = new Map<string, any[]>();
    const viewsMap = new Map<string, any[]>();
    const userLikesSet = new Set(userLikes.map(like => like.postId));
    const userSavesSet = new Set(userSaves.map(save => save.postId));

    // Populate maps
    allLikes.forEach(like => {
      if (!likesMap.has(like.postId)) likesMap.set(like.postId, []);
      likesMap.get(like.postId)!.push(like);
    });
    
    allComments.forEach(comment => {
      if (!commentsMap.has(comment.postId)) commentsMap.set(comment.postId, []);
      commentsMap.get(comment.postId)!.push(comment);
    });
    
    allSaves.forEach(save => {
      if (!savesMap.has(save.postId)) savesMap.set(save.postId, []);
      savesMap.get(save.postId)!.push(save);
    });
    
    allViews.forEach(view => {
      if (!viewsMap.has(view.postId)) viewsMap.set(view.postId, []);
      viewsMap.get(view.postId)!.push(view);
    });

    const postsWithDetails: PostWithDetails[] = [];

    for (const { post, student, user } of postsWithStudentData) {
      // Use new fields directly since legacy fields have been migrated
      const effectiveMediaUrl = post.mediaUrl || '';
      const effectiveMediaType = post.mediaType || 'image';
      const effectiveStatus = post.status || 'ready';

      // Only include posts that have some content
      if (!effectiveMediaUrl && !post.caption) {
        continue; // Skip posts with no content
      }

      const likes = likesMap.get(post.id) || [];
      const comments = commentsMap.get(post.id) || [];
      const saves = savesMap.get(post.id) || [];
      const views = viewsMap.get(post.id) || [];
      const isFollowing = followStatuses.get(student.id) || false;

      postsWithDetails.push({
        ...post,
        effectiveMediaUrl,
        effectiveMediaType,
        effectiveStatus,
        student: {
          id: student.id,
          userId: student.userId,
          name: user.name || student.name || 'Unknown Student',
          sport: student.sport || '',
          position: student.position || '',
          roleNumber: student.roleNumber || '',
          profilePicUrl: student.profilePicUrl || student.profilePic || null,
          isFollowing
        },
        likesCount: likes.length,
        commentsCount: comments.length,
        savesCount: saves.length,
        viewCount: views.length,
        isLiked: userLikesSet.has(post.id),
        isSaved: userSavesSet.has(post.id),
      });
    }
    
    // If announcements are requested, get them separately and merge
    if (includeAnnouncements) {
      // Determine viewer role and school to correctly scope announcements
      let viewerRole: string = 'student';
      let viewerSchoolId: string | undefined = undefined;

      try {
        const viewer = await db
          .select()
          .from(users)
          .where(eq(users.id, userId))
          .limit(1);
        if (viewer[0]) {
          viewerRole = (viewer[0] as any).role || viewerRole;
          viewerSchoolId = (viewer[0] as any).schoolId || undefined;
        }
      } catch (_) {
        // Fallback silently to defaults if user lookup fails
      }

      const announcements = await this.getAnnouncementsForUser(
        userId,
        viewerRole,
        viewerRole === 'student' || viewerRole === 'school_admin' ? viewerSchoolId : undefined,
        limit,
        offset
      );
      postsWithDetails.push(...announcements);
    }
    
    // Sort by creation date
    postsWithDetails.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    return postsWithDetails;
  }

  async getPostsBySchoolWithUserContext(schoolId: string, userId: string, limit: number = 20, offset: number = 0, includeAnnouncements: boolean = false): Promise<PostWithDetails[]> {
    const postsWithDetails: PostWithDetails[] = [];
    
    // First, get regular student posts from this school
    const studentPostsQuery = await db
      .select({
        post: posts,
        student: students,
        user: users
      })
      .from(posts)
      .innerJoin(students, eq(posts.studentId, students.id))
      .innerJoin(users, eq(students.userId, users.id))
      .where(
        and(
          sql`${posts.status} != 'processing' OR ${posts.status} IS NULL`,
          eq(users.schoolId, schoolId),
          sql`${posts.type} != 'announcement' OR ${posts.type} IS NULL`
        )
      )
      .orderBy(desc(posts.createdAt))
      .limit(limit)
      .offset(offset);

    for (const row of studentPostsQuery) {
      const { post, student, user } = row;
      
      const likes = await db.select().from(postLikes).where(eq(postLikes.postId, post.id));
      const comments = await db.select().from(postComments).where(eq(postComments.postId, post.id));
      const saves = await db.select().from(savedPosts).where(eq(savedPosts.postId, post.id));
      const views = await getPostViews(post.id);

      // Check if current user has liked/saved this post
      const userLike = await db.select().from(postLikes).where(
        and(eq(postLikes.postId, post.id), eq(postLikes.userId, userId))
      ).limit(1);
      
      const userSave = await db.select().from(savedPosts).where(
        and(eq(savedPosts.postId, post.id), eq(savedPosts.userId, userId))
      ).limit(1);

      // Use new fields directly since legacy fields have been migrated
      const effectiveMediaUrl = post.mediaUrl || '';
      const effectiveMediaType = post.mediaType || 'image';
      const effectiveStatus = post.status || 'ready';

      // Only include posts that have some content
      if (!effectiveMediaUrl && !post.caption) {
        continue; // Skip posts with no content
      }

      // Check if current user is following this student
      const isFollowing = await this.isFollowingStudent(userId, student.id);

      postsWithDetails.push({
        ...post,
        effectiveMediaUrl,
        effectiveMediaType,
        effectiveStatus,
        student: {
          id: student.id,
          userId: student.userId,
          name: user.name || student.name || 'Unknown Student',
          sport: student.sport || '',
          position: student.position || '',
          roleNumber: student.roleNumber || '',
          profilePicUrl: student.profilePicUrl || student.profilePic || null,
          isFollowing
        },
        likesCount: likes.length,
        commentsCount: comments.length,
        savesCount: saves.length,
        viewCount: views.length,
        isLiked: userLike.length > 0,
        isSaved: userSave.length > 0,
      });
    }
    
    // If announcements are requested, get them separately and merge
    if (includeAnnouncements) {
      const announcements = await this.getAnnouncementsForUser(userId, 'school_admin', schoolId, limit, offset);
      postsWithDetails.push(...announcements);
    }
    
    // Sort by creation date
    postsWithDetails.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    return postsWithDetails;
  }

  async getPostsByStudent(studentId: string): Promise<PostWithDetails[]> {
    const allPosts = await this.getPosts();
    return allPosts.filter(post => post.studentId === studentId);
  }

  async getPostsByStudentWithUserContext(studentId: string, userId: string, limit?: number, offset?: number): Promise<PostWithDetails[]> {
    // Get all posts for the specific student
    const studentPosts = await db.select().from(posts)
      .where(eq(posts.studentId, studentId))
      .orderBy(desc(posts.createdAt));
    
    const postsWithDetails: PostWithDetails[] = [];
    
    for (const post of studentPosts) {
      // Skip only posts that are explicitly in processing state (not legacy posts)
      if (post.status === 'processing') {
        continue; // Skip posts that are currently being processed
      }

      // Get student with user information
      const studentResult = await db
        .select({
          student: students,
          user: users
        })
        .from(students)
        .innerJoin(users, eq(students.userId, users.id))
        .where(eq(students.id, post.studentId))
        .limit(1);
      
      if (!studentResult[0]) continue;
      
      const { student, user } = studentResult[0];
      
      const likes = await db.select().from(postLikes).where(eq(postLikes.postId, post.id));
      const comments = await db.select().from(postComments).where(eq(postComments.postId, post.id));
      const saves = await db.select().from(savedPosts).where(eq(savedPosts.postId, post.id));
      const views = await getPostViews(post.id);

      // Check if current user has liked/saved this post
      const userLike = await db.select().from(postLikes).where(
        and(eq(postLikes.postId, post.id), eq(postLikes.userId, userId))
      ).limit(1);
      
      const userSave = await db.select().from(savedPosts).where(
        and(eq(savedPosts.postId, post.id), eq(savedPosts.userId, userId))
      ).limit(1);

      // Use new fields directly since legacy fields have been migrated
      // Prefer mediaUrl (which contains secure_url from Cloudinary) with fallback
      const effectiveMediaUrl = post.mediaUrl || '';
      const effectiveMediaType = post.mediaType || 'image';
      const effectiveStatus = post.status || 'ready';

      // Add warning for null media_url
      if (!effectiveMediaUrl) {
        console.warn(`⚠️ Post ${post.id} has no media URL`);
      }

      // Only include posts that have some content
      if (!effectiveMediaUrl && !post.caption) {
        continue; // Skip posts with no content
      }

      // Check if current user is following this student
      const isFollowing = await this.isFollowingStudent(userId, student.id);

      postsWithDetails.push({
        ...post,
        effectiveMediaUrl,
        effectiveMediaType,
        effectiveStatus,
        student: {
          id: student.id,
          userId: student.userId,
          name: user.name || student.name || 'Unknown Student',
          sport: student.sport || '',
          position: student.position || '',
          roleNumber: student.roleNumber || '',
          profilePicUrl: student.profilePicUrl || student.profilePic || null,
          isFollowing
        },
        likesCount: likes.length,
        commentsCount: comments.length,
        savesCount: saves.length,
        viewCount: views.length,
        isLiked: userLike.length > 0,
        isSaved: userSave.length > 0,
      });
    }
    
    // Apply pagination if specified
    if (limit && offset !== undefined) {
      return postsWithDetails.slice(offset, offset + limit);
    }
    
    return postsWithDetails;
  }

  async createPost(insertPost: InsertPost): Promise<Post> {
    const [post] = await db.insert(posts).values(insertPost).returning();
    return post;
  }

  async insertPost(insertPost: InsertPost): Promise<Post> {
    return this.createPost(insertPost);
  }

  async updatePost(postId: string, updates: Partial<Post>): Promise<Post | undefined> {
    const [updatedPost] = await db.update(posts)
      .set(updates)
      .where(eq(posts.id, postId))
      .returning();
    return updatedPost;
  }

  async likePost(insertLike: InsertPostLike): Promise<PostLike> {
    const [like] = await db.insert(postLikes).values(insertLike).returning();
    return like;
  }

  async unlikePost(postId: string, userId: string): Promise<void> {
    await db.delete(postLikes).where(sql`${postLikes.postId} = ${postId} AND ${postLikes.userId} = ${userId}`);
  }

  async commentOnPost(insertComment: InsertPostComment): Promise<PostComment> {
    const [comment] = await db.insert(postComments).values(insertComment).returning();
    return comment;
  }

  async getPostComments(postId: string): Promise<PostCommentWithUser[]> {
    if (!isDbConnected) return [];
    
    // First get comments for the post
    const comments = await db.select().from(postComments)
      .where(eq(postComments.postId, postId))
      .orderBy(postComments.createdAt);
    
    // Then enrich each comment with user data
    const commentsWithUsers: PostCommentWithUser[] = [];
    for (const comment of comments) {
      const userResult = await db.select().from(users)
        .where(eq(users.id, comment.userId))
        .limit(1);
      
      if (userResult[0]) {
        const user = userResult[0];
        let profilePicUrl = user.profilePicUrl; // Default to users table profilePicUrl
        
        // Fetch profile picture from role-specific table if needed
        if (user.role === 'school_admin' && user.linkedId) {
          const adminResult = await db.select({ profilePicUrl: schoolAdmins.profilePicUrl })
            .from(schoolAdmins)
            .where(eq(schoolAdmins.id, user.linkedId))
            .limit(1);
          if (adminResult[0]?.profilePicUrl) {
            profilePicUrl = adminResult[0].profilePicUrl;
          }
        } else if (user.role === 'system_admin' && user.linkedId) {
          const adminResult = await db.select({ profilePicUrl: systemAdmins.profilePicUrl })
            .from(systemAdmins)
            .where(eq(systemAdmins.id, user.linkedId))
            .limit(1);
          if (adminResult[0]?.profilePicUrl) {
            profilePicUrl = adminResult[0].profilePicUrl;
          }
        } else if ((user.role === 'viewer' || user.role === 'public_viewer') && user.linkedId) {
          const viewerResult = await db.select({ profilePicUrl: viewers.profilePicUrl })
            .from(viewers)
            .where(eq(viewers.id, user.linkedId))
            .limit(1);
          if (viewerResult[0]?.profilePicUrl) {
            profilePicUrl = viewerResult[0].profilePicUrl;
          }
        } else if (user.role === 'student' && user.linkedId) {
          // Students might have profilePicUrl in students table
          const studentResult = await db.select({ profilePicUrl: students.profilePicUrl })
            .from(students)
            .where(eq(students.id, user.linkedId))
            .limit(1);
          if (studentResult[0]?.profilePicUrl) {
            profilePicUrl = studentResult[0].profilePicUrl;
          }
        } else if (user.role === 'scout_admin' || user.role === 'xen_scout') {
          // Scout roles: check multiple possible locations for profile picture
          // 1. Check scoutProfiles table using linkedId
          if (user.linkedId) {
            const scoutProfileResult = await db.select({ profilePicUrl: scoutProfiles.profilePicUrl })
              .from(scoutProfiles)
              .where(eq(scoutProfiles.id, user.linkedId))
              .limit(1);
            if (scoutProfileResult[0]?.profilePicUrl) {
              profilePicUrl = scoutProfileResult[0].profilePicUrl;
            } else {
              // 2. Check admins table using linkedId
              const adminResultById = await db.select({ profilePicUrl: admins.profilePicUrl })
                .from(admins)
                .where(eq(admins.id, user.linkedId))
                .limit(1);
              if (adminResultById[0]?.profilePicUrl) {
                profilePicUrl = adminResultById[0].profilePicUrl;
              }
            }
          }
          // 3. Fallback: Check admins table using user email if still not found
          if (!profilePicUrl && user.email) {
            const adminResultByEmail = await db.select({ profilePicUrl: admins.profilePicUrl })
              .from(admins)
              .where(eq(admins.email, user.email))
              .limit(1);
            if (adminResultByEmail[0]?.profilePicUrl) {
              profilePicUrl = adminResultByEmail[0].profilePicUrl;
            }
          }
        } else if (['moderator', 'finance', 'support', 'coach', 'analyst'].includes(user.role)) {
          // Other admin roles: check admins table using userId or linkedId
          const adminResult = await db.select({ profilePicUrl: admins.profilePicUrl })
            .from(admins)
            .where(eq(admins.id, user.linkedId || user.id))
            .limit(1);
          if (adminResult[0]?.profilePicUrl) {
            profilePicUrl = adminResult[0].profilePicUrl;
          }
        }
        
        // Create user object with the correct profilePicUrl
        commentsWithUsers.push({
          ...comment,
          user: {
            ...user,
            profilePicUrl: profilePicUrl
          }
        });
      }
    }
    
    return commentsWithUsers;
  }

  async getPostWithUserContext(postId: string, userId: string): Promise<PostWithDetails> {
    if (!isDbConnected) throw new Error('Database not connected');
    
    // Get the post
    const postResult = await db.select().from(posts)
      .where(eq(posts.id, postId))
      .limit(1);
    
    if (postResult.length === 0) throw new Error('Post not found');
    const post = postResult[0];

    let student: any = null;
    let user: any = null;
    let school: any = null;

    // Handle announcements vs regular posts
    if (post.type === 'announcement') {
      // For announcements, get admin user info
      const adminUserResult = await db.select().from(users)
        .where(eq(users.id, post.createdByAdminId))
        .limit(1);
      
      if (adminUserResult.length === 0) throw new Error('Admin user not found');
      user = adminUserResult[0];

      // Get school info if applicable
      if (post.schoolId) {
        const schoolResult = await db.select().from(schools)
          .where(eq(schools.id, post.schoolId))
          .limit(1);
        school = schoolResult[0] || null;
      }

      // Create a mock student object for announcements
      student = {
        id: 'announcement',
        userId: user.id,
        name: user.name || 'Admin',
        sport: '',
        position: '',
        roleNumber: '',
        profilePicUrl: user.profilePicUrl,
        isFollowing: false
      };
    } else {
      // For regular posts, get student and user info
      const studentResult = await db.select().from(students)
        .where(eq(students.id, post.studentId))
        .limit(1);
      
      if (studentResult.length === 0) throw new Error('Student not found');
      student = studentResult[0];

      const userResult = await db.select().from(users)
        .where(eq(users.id, student.userId))
        .limit(1);
      
      if (userResult.length === 0) throw new Error('User not found');
      user = userResult[0];
    }

    // Get likes, comments, saves, and views for this post
    const likes = await db.select().from(postLikes)
      .where(eq(postLikes.postId, postId));
    
    const comments = await db.select().from(postComments)
      .where(eq(postComments.postId, postId));
    
    const saves = await db.select().from(savedPosts)
      .where(eq(savedPosts.postId, postId));
    
    const views = await getPostViews(postId);

    // Check if current user has liked/saved this post
    const userLike = likes.find(like => like.userId === userId);
    const userSave = saves.find(save => save.userId === userId);

    // Enrich comments with user data
    const commentsWithUsers: PostCommentWithUser[] = [];
    for (const comment of comments) {
      const commentUserResult = await db.select().from(users)
        .where(eq(users.id, comment.userId))
        .limit(1);
      
      if (commentUserResult[0]) {
        commentsWithUsers.push({
          ...comment,
          user: commentUserResult[0]
        });
      }
    }

    // Use new fields directly since legacy fields have been migrated
    const effectiveMediaUrl = post.mediaUrl || '';
    const effectiveMediaType = post.mediaType || 'image';
    const effectiveStatus = post.status || 'ready';

    return {
      ...post,
      effectiveMediaUrl,
      effectiveMediaType,
      effectiveStatus,
      student: {
        id: student.id,
        userId: student.userId,
        name: student.name,
        sport: student.sport || '',
        position: student.position || '',
        roleNumber: student.roleNumber || '',
        profilePicUrl: student.profilePicUrl || student.profilePic || null
      },
      likesCount: likes.length,
      commentsCount: comments.length,
      savesCount: saves.length,
      viewCount: views.length,
      isLiked: !!userLike,
      isSaved: !!userSave,
      // Add announcement-specific fields
      isAnnouncement: post.type === 'announcement',
      announcementScope: post.type === 'announcement' ? post.scope : undefined,
      announcementSchool: post.type === 'announcement' ? school : undefined,
    };
  }

  async recordView(postId: string, userId: string): Promise<void> {
    if (!isDbConnected) return;
    
    await recordPostView(postId, userId);
  }

  async savePost(insertSave: InsertSavedPost): Promise<SavedPost> {
    const [save] = await db.insert(savedPosts).values(insertSave).returning();
    return save;
  }

  async unsavePost(postId: string, userId: string): Promise<void> {
    await db.delete(savedPosts).where(sql`${savedPosts.postId} = ${postId} AND ${savedPosts.userId} = ${userId}`);
  }

  async getUserSavedPosts(userId: string): Promise<PostWithDetails[]> {
    if (!isDbConnected) return [];
    
    const userSaves = await db.select().from(savedPosts).where(eq(savedPosts.userId, userId));
    const savedPostIds = userSaves.map(save => save.postId);
    
    if (savedPostIds.length === 0) return [];
    
    const savedPosts = await db.select().from(posts).where(inArray(posts.id, savedPostIds));
    
    const postsWithDetails: PostWithDetails[] = [];
    
    for (const post of savedPosts) {
      const student = await db.select().from(students).where(eq(students.id, post.studentId)).limit(1);
      if (!student[0]) continue;
      
      const user = await db.select().from(users).where(eq(users.id, student[0].userId)).limit(1);
      if (!user[0]) continue;
      
      const likes = await db.select().from(postLikes).where(eq(postLikes.postId, post.id));
      const comments = await db.select().from(postComments).where(eq(postComments.postId, post.id));
      const saves = await db.select().from(savedPosts).where(eq(savedPosts.postId, post.id));
      const views = await getPostViews(post.id);
      
      // Use new fields directly since legacy fields have been migrated
      // Prefer mediaUrl (which contains secure_url from Cloudinary) with fallback
      const effectiveMediaUrl = post.mediaUrl || '';
      const effectiveMediaType = post.mediaType || 'image';
      const effectiveStatus = post.status || 'ready';

      // Check if current user has liked/saved this post
      const userLike = likes.find(like => like.userId === userId);
      const userSave = saves.find(save => save.userId === userId);

      postsWithDetails.push({
        ...post,
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
          profilePicUrl: student[0].profilePicUrl || student[0].profilePic || null
        },
        likesCount: likes.length,
        commentsCount: comments.length,
        savesCount: saves.length,
        isLiked: !!userLike,
        isSaved: !!userSave,
      });
    }
    
    return postsWithDetails.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async reportPost(insertReport: InsertReportedPost): Promise<ReportedPost> {
    if (!isDbConnected) throw new Error("Database not connected");
    const [report] = await db.insert(reportedPosts).values(insertReport).returning();
    return report;
  }

  async deletePost(postId: string, userId: string): Promise<void> {
    if (!isDbConnected) throw new Error("Database not connected");
    
    // Check if user owns the post
    const post = await db.select().from(posts).where(eq(posts.id, postId)).limit(1);
    if (!post[0]) throw new Error('Post not found');
    
    const student = await db.select().from(students).where(eq(students.id, post[0].studentId)).limit(1);
    if (!student[0] || student[0].userId !== userId) {
      throw new Error('Unauthorized to delete this post');
    }
    
    // Delete related data
    await db.delete(postLikes).where(eq(postLikes.postId, postId));
    await db.delete(postComments).where(eq(postComments.postId, postId));
    await db.delete(savedPosts).where(eq(savedPosts.postId, postId));
    
    // Safely delete from reported_posts table if it exists
    try {
      await db.delete(reportedPosts).where(eq(reportedPosts.postId, postId));
    } catch (error: any) {
      // If table doesn't exist, log warning but continue
      if (error.message?.includes('relation "reported_posts" does not exist')) {
        console.warn('⚠️ reported_posts table does not exist, skipping deletion');
      } else {
        throw error; // Re-throw other errors
      }
    }
    
    // Delete from Cloudinary if we have a public ID
    if (post[0].cloudinaryPublicId) {
      try {
        const cloudinary = await import('./cloudinary');
        await cloudinary.default.uploader.destroy(post[0].cloudinaryPublicId, {
          resource_type: post[0].mediaType === 'video' ? 'video' : 'image'
        });
        console.log(`✅ Deleted media from Cloudinary: ${post[0].cloudinaryPublicId}`);
      } catch (error: any) {
        console.warn('⚠️ Failed to delete from Cloudinary:', error.message);
        // Don't fail the entire operation if Cloudinary deletion fails
      }
    }
    
    // Delete the post
    await db.delete(posts).where(eq(posts.id, postId));
  }

  async getSchoolStats(schoolId: string, period?: string): Promise<any> {
    const schoolStudents = await this.getStudentsBySchool(schoolId);
    const studentIds = schoolStudents.map(s => s.id);
    
    if (studentIds.length === 0) {
      return {
        totalStudents: 0,
        totalPosts: 0,
        totalEngagement: 0,
        activeSports: 0,
        previousPeriodPosts: 0,
        previousPeriodEngagement: 0,
      };
    }
    
    // Calculate time period for comparison
    const now = new Date();
    let startDate: Date | null = null;
    let previousStartDate: Date | null = null;
    
    if (period) {
      switch (period) {
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          previousStartDate = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          previousStartDate = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
          break;
      }
    }
    
    // Only count student posts, exclude announcements
    let schoolPosts;
    if (startDate) {
      schoolPosts = await db
        .select()
        .from(posts)
        .where(
          and(
            inArray(posts.studentId, studentIds),
            sql`${posts.type} != 'announcement' OR ${posts.type} IS NULL`,
            sql`${posts.createdAt} >= ${startDate}`
          )
        );
    } else {
      schoolPosts = await db
        .select()
        .from(posts)
        .where(
          and(
            inArray(posts.studentId, studentIds),
            sql`${posts.type} != 'announcement' OR ${posts.type} IS NULL`
          )
        );
    }
    
    // Get previous period posts for comparison
    let previousPeriodPosts: any[] = [];
    if (previousStartDate && startDate) {
      previousPeriodPosts = await db
        .select()
        .from(posts)
        .where(
          and(
            inArray(posts.studentId, studentIds),
            sql`${posts.type} != 'announcement' OR ${posts.type} IS NULL`,
            sql`${posts.createdAt} >= ${previousStartDate}`,
            sql`${posts.createdAt} < ${startDate}`
          )
        );
    }
    
    let totalLikes = 0;
    let totalComments = 0;
    let totalSaves = 0;
    let previousPeriodLikes = 0;
    let previousPeriodComments = 0;
    let previousPeriodSaves = 0;

    for (const post of schoolPosts) {
      const likes = await db.select().from(postLikes).where(eq(postLikes.postId, post.id));
      const comments = await db.select().from(postComments).where(eq(postComments.postId, post.id));
      const saves = await db.select().from(savedPosts).where(eq(savedPosts.postId, post.id));
      
      totalLikes += likes.length;
      totalComments += comments.length;
      totalSaves += saves.length;
    }

    for (const post of previousPeriodPosts) {
      const likes = await db.select().from(postLikes).where(eq(postLikes.postId, post.id));
      const comments = await db.select().from(postComments).where(eq(postComments.postId, post.id));
      const saves = await db.select().from(savedPosts).where(eq(savedPosts.postId, post.id));
      
      previousPeriodLikes += likes.length;
      previousPeriodComments += comments.length;
      previousPeriodSaves += saves.length;
    }

    return {
      totalStudents: schoolStudents.length,
      totalPosts: schoolPosts.length,
      totalEngagement: totalLikes + totalComments + totalSaves,
      activeSports: Array.from(new Set(schoolStudents.map(s => s.sport).filter(Boolean))).length,
      previousPeriodPosts: previousPeriodPosts.length,
      previousPeriodEngagement: previousPeriodLikes + previousPeriodComments + previousPeriodSaves,
    };
  }

  async getSystemStats(): Promise<any> {
    const allSchools = await db.select().from(schools);
    const allUsers = await db.select().from(users);
    // Only count student posts, exclude announcements
    const allPosts = await db
      .select()
      .from(posts)
      .where(sql`${posts.type} != 'announcement' OR ${posts.type} IS NULL`);
    
    const students = allUsers.filter(user => user.role === "student").length;
    const premiumSchools = allSchools.filter(school => school.subscriptionPlan === "premium").length;
    const standardSchools = allSchools.filter(school => school.subscriptionPlan === "standard").length;
    
    const monthlyRevenue = (premiumSchools * 150) + (standardSchools * 75);

    return {
      totalSchools: allSchools.length,
      activeStudents: students,
      contentUploads: allPosts.length,
      monthlyRevenue,
      premiumSchools,
      standardSchools,
    };
  }

  async getSchoolRecentActivity(schoolId: string, limit: number = 5): Promise<any[]> {
    if (!isDbConnected) throw new Error("Database not connected");
    
    const schoolStudents = await this.getStudentsBySchool(schoolId);
    const studentIds = schoolStudents.map(s => s.id);
    
    if (studentIds.length === 0) return [];

    // Get recent posts from school students (exclude announcements)
    const schoolPosts = await db
      .select()
      .from(posts)
      .where(
        and(
          inArray(posts.studentId, studentIds),
          sql`${posts.type} != 'announcement' OR ${posts.type} IS NULL`
        )
      )
      .orderBy(desc(posts.createdAt))
      .limit(limit);

    const activity = [];
    for (const post of schoolPosts) {
      const student = schoolStudents.find(s => s.id === post.studentId);
      const user = student ? await this.getUser(student.userId) : null;
      
      if (student && user) {
        const likes = await db.select().from(postLikes).where(eq(postLikes.postId, post.id));
        const comments = await db.select().from(postComments).where(eq(postComments.postId, post.id));
        const engagement = likes.length + comments.length;

        activity.push({
          id: post.id,
          studentId: student.id,
          studentName: user.name,
          studentProfilePic: student.profilePicUrl || user.profilePicUrl,
          sport: student.sport,
          postType: post.mediaType || 'image',
          content: post.content,
          mediaUrl: post.mediaUrl,
          createdAt: post.createdAt,
          engagement: engagement,
          likes: likes.length,
          comments: comments.length
        });
      }
    }

    return activity;
  }

  async getSchoolTopPerformers(schoolId: string, limit: number = 5): Promise<any[]> {
    if (!isDbConnected) throw new Error("Database not connected");
    
    const schoolStudents = await this.getStudentsBySchool(schoolId);
    
    const performers = [];
    for (const student of schoolStudents) {
      const user = await this.getUser(student.userId);
      if (!user) continue;

      // Only count student posts, exclude announcements
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
      for (const post of studentPosts) {
        const likes = await db.select().from(postLikes).where(eq(postLikes.postId, post.id));
        const comments = await db.select().from(postComments).where(eq(postComments.postId, post.id));
        totalEngagement += likes.length + comments.length;
      }

      performers.push({
        studentId: student.id,
        studentName: user.name,
        studentProfilePic: student.profilePicUrl || user.profilePicUrl,
        sport: student.sport,
        totalEngagement: totalEngagement,
        postsCount: studentPosts.length,
        mediaUrl: studentPosts.length > 0 ? studentPosts[0].mediaUrl : null
      });
    }

    // Sort by engagement and return top performers
    return performers
      .sort((a, b) => b.totalEngagement - a.totalEngagement)
      .slice(0, limit);
  }

  async getSchoolEngagementTrends(schoolId: string, period: string = 'week'): Promise<any[]> {
    if (!isDbConnected) throw new Error("Database not connected");
    
    const schoolStudents = await this.getStudentsBySchool(schoolId);
    const studentIds = schoolStudents.map(s => s.id);
    
    if (studentIds.length === 0) return [];

    const now = new Date();
    let startDate: Date | null = null;
    let interval: string;
    
    switch (period) {
      case 'day':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        interval = 'hour';
        break;
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        interval = 'day';
        break;
      case 'month':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        interval = 'day';
        break;
      case 'all':
        startDate = null; // No date filter - get all data
        interval = 'day';
        break;
      default:
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        interval = 'day';
    }

    // Get all posts in the period
    let schoolPosts;
    if (startDate) {
      schoolPosts = await db
        .select()
        .from(posts)
        .where(
          and(
            inArray(posts.studentId, studentIds),
            sql`${posts.type} != 'announcement' OR ${posts.type} IS NULL`,
            sql`${posts.createdAt} >= ${startDate}`
          )
        )
        .orderBy(posts.createdAt);
    } else {
      // No date filter - get all posts
      schoolPosts = await db
        .select()
        .from(posts)
        .where(
          and(
            inArray(posts.studentId, studentIds),
            sql`${posts.type} != 'announcement' OR ${posts.type} IS NULL`
          )
        )
        .orderBy(posts.createdAt);
    }

    // Group by time interval and calculate engagement
    const trends: Record<string, { date: string; engagement: number; posts: number }> = {};
    
    for (const post of schoolPosts) {
      const postDate = new Date(post.createdAt);
      let key: string;
      
      if (interval === 'hour') {
        key = postDate.toISOString().slice(0, 13) + ':00';
      } else {
        key = postDate.toISOString().slice(0, 10);
      }
      
      if (!trends[key]) {
        trends[key] = { date: key, engagement: 0, posts: 0 };
      }
      
      trends[key].posts += 1;
      
      // Calculate engagement for this post
      const likes = await db.select().from(postLikes).where(eq(postLikes.postId, post.id));
      const comments = await db.select().from(postComments).where(eq(postComments.postId, post.id));
      const saves = await db.select().from(savedPosts).where(eq(savedPosts.postId, post.id));
      const views = await getPostViews(post.id);
      
      trends[key].engagement += likes.length + comments.length + saves.length + views.length;
    }
    
    return Object.values(trends).sort((a, b) => a.date.localeCompare(b.date));
  }

  async getSchoolPostTrends(schoolId: string, period: string = 'week'): Promise<any[]> {
    if (!isDbConnected) throw new Error("Database not connected");
    
    const schoolStudents = await this.getStudentsBySchool(schoolId);
    const studentIds = schoolStudents.map(s => s.id);
    
    if (studentIds.length === 0) return [];

    const now = new Date();
    let startDate: Date | null = null;
    let interval: string;
    
    switch (period) {
      case 'day':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        interval = 'hour';
        break;
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        interval = 'day';
        break;
      case 'month':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        interval = 'day';
        break;
      case 'all':
        startDate = null; // No date filter - get all data
        interval = 'day';
        break;
      default:
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        interval = 'day';
    }

    let schoolPosts;
    if (startDate) {
      schoolPosts = await db
        .select()
        .from(posts)
        .where(
          and(
            inArray(posts.studentId, studentIds),
            sql`${posts.type} != 'announcement' OR ${posts.type} IS NULL`,
            sql`${posts.createdAt} >= ${startDate}`
          )
        )
        .orderBy(posts.createdAt);
    } else {
      // No date filter - get all posts
      schoolPosts = await db
        .select()
        .from(posts)
        .where(
          and(
            inArray(posts.studentId, studentIds),
            sql`${posts.type} != 'announcement' OR ${posts.type} IS NULL`
          )
        )
        .orderBy(posts.createdAt);
    }

    const trends: Record<string, { date: string; posts: number; images: number; videos: number }> = {};
    
    for (const post of schoolPosts) {
      const postDate = new Date(post.createdAt);
      let key: string;
      
      if (interval === 'hour') {
        key = postDate.toISOString().slice(0, 13) + ':00';
      } else {
        key = postDate.toISOString().slice(0, 10);
      }
      
      if (!trends[key]) {
        trends[key] = { date: key, posts: 0, images: 0, videos: 0 };
      }
      
      trends[key].posts += 1;
      if (post.mediaType === 'video') {
        trends[key].videos += 1;
      } else {
        trends[key].images += 1;
      }
    }
    
    return Object.values(trends).sort((a, b) => a.date.localeCompare(b.date));
  }

  async getSchoolPostAnalytics(schoolId: string, limit: number = 10): Promise<any> {
    if (!isDbConnected) throw new Error("Database not connected");
    
    const schoolStudents = await this.getStudentsBySchool(schoolId);
    const studentIds = schoolStudents.map(s => s.id);
    
    if (studentIds.length === 0) {
      return {
        topPosts: [],
        engagementBreakdown: { likes: 0, comments: 0, saves: 0, views: 0 },
        contentMix: { images: 0, videos: 0 }
      };
    }

    const schoolPosts = await db
      .select()
      .from(posts)
      .where(
        and(
          inArray(posts.studentId, studentIds),
          sql`${posts.type} != 'announcement' OR ${posts.type} IS NULL`
        )
      )
      .orderBy(desc(posts.createdAt))
      .limit(100);

    const topPosts = [];
    let totalLikes = 0;
    let totalComments = 0;
    let totalSaves = 0;
    let totalViews = 0;
    let imageCount = 0;
    let videoCount = 0;

    for (const post of schoolPosts) {
      const likes = await db.select().from(postLikes).where(eq(postLikes.postId, post.id));
      const comments = await db.select().from(postComments).where(eq(postComments.postId, post.id));
      const saves = await db.select().from(savedPosts).where(eq(savedPosts.postId, post.id));
      const views = await getPostViews(post.id);
      
      const student = schoolStudents.find(s => s.id === post.studentId);
      const user = student ? await this.getUser(student.userId) : null;
      
      const engagement = likes.length + comments.length + saves.length + views.length;
      
      totalLikes += likes.length;
      totalComments += comments.length;
      totalSaves += saves.length;
      totalViews += views.length;
      
      if (post.mediaType === 'video') {
        videoCount += 1;
      } else {
        imageCount += 1;
      }

      if (user && student) {
        topPosts.push({
          id: post.id,
          studentId: student.id,
          studentName: user.name,
          studentProfilePic: student.profilePicUrl || user.profilePicUrl,
          sport: student.sport,
          mediaUrl: post.mediaUrl,
          mediaType: post.mediaType || 'image',
          caption: post.caption,
          createdAt: post.createdAt,
          likes: likes.length,
          comments: comments.length,
          saves: saves.length,
          views: views.length,
          engagement: engagement
        });
      }
    }

    topPosts.sort((a, b) => b.engagement - a.engagement);

    return {
      topPosts: topPosts.slice(0, limit),
      engagementBreakdown: {
        likes: totalLikes,
        comments: totalComments,
        saves: totalSaves,
        views: totalViews,
        total: totalLikes + totalComments + totalSaves + totalViews
      },
      contentMix: {
        images: imageCount,
        videos: videoCount,
        total: imageCount + videoCount
      }
    };
  }

  async getSchoolStudentEngagement(schoolId: string, period: string = 'month'): Promise<any> {
    if (!isDbConnected) throw new Error("Database not connected");
    
    const schoolStudents = await this.getStudentsBySchool(schoolId);
    const studentIds = schoolStudents.map(s => s.id);
    
    if (studentIds.length === 0) {
      return {
        activeStudents: 0,
        activePercentage: 0,
        engagementDistribution: [],
        activityByDay: []
      };
    }

    const now = new Date();
    let startDate: Date | null = null;
    
    switch (period) {
      case 'day':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case 'all':
        startDate = null; // No date filter
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    const activeStudentsSet = new Set<string>();
    const engagementByStudent: Record<string, number> = {};
    const activityByDay: Record<string, number> = {};

    // Initialize activityByDay for the period
    if (startDate) {
      const daysDiff = Math.ceil((now.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000));
      for (let i = 0; i < daysDiff; i++) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + i);
        const dayKey = date.toISOString().slice(0, 10);
        activityByDay[dayKey] = 0;
      }
    }

    let schoolPosts;
    if (startDate) {
      schoolPosts = await db
        .select()
        .from(posts)
        .where(
          and(
            inArray(posts.studentId, studentIds),
            sql`${posts.type} != 'announcement' OR ${posts.type} IS NULL`,
            sql`${posts.createdAt} >= ${startDate}`
          )
        );
    } else {
      // No date filter - get all posts
      schoolPosts = await db
        .select()
        .from(posts)
        .where(
          and(
            inArray(posts.studentId, studentIds),
            sql`${posts.type} != 'announcement' OR ${posts.type} IS NULL`
          )
        );
    }

    for (const post of schoolPosts) {
      activeStudentsSet.add(post.studentId || '');
      
      if (!engagementByStudent[post.studentId || '']) {
        engagementByStudent[post.studentId || ''] = 0;
      }

      const likes = await db.select().from(postLikes).where(eq(postLikes.postId, post.id));
      const comments = await db.select().from(postComments).where(eq(postComments.postId, post.id));
      const saves = await db.select().from(savedPosts).where(eq(savedPosts.postId, post.id));
      const views = await getPostViews(post.id);
      
      const engagement = likes.length + comments.length + saves.length + views.length;
      engagementByStudent[post.studentId || ''] += engagement;

      // Track activity by day
      const postDate = new Date(post.createdAt);
      const dayKey = postDate.toISOString().slice(0, 10);
      if (activityByDay[dayKey] !== undefined) {
        activityByDay[dayKey] += 1;
      }
    }

    // Create engagement distribution buckets
    const engagementValues = Object.values(engagementByStudent);
    const buckets = { low: 0, medium: 0, high: 0, veryHigh: 0 };
    
    engagementValues.forEach(eng => {
      if (eng < 10) buckets.low++;
      else if (eng < 50) buckets.medium++;
      else if (eng < 100) buckets.high++;
      else buckets.veryHigh++;
    });

    return {
      activeStudents: activeStudentsSet.size,
      activePercentage: (activeStudentsSet.size / studentIds.length) * 100,
      engagementDistribution: [
        { level: 'Low (0-9)', count: buckets.low },
        { level: 'Medium (10-49)', count: buckets.medium },
        { level: 'High (50-99)', count: buckets.high },
        { level: 'Very High (100+)', count: buckets.veryHigh }
      ],
      activityByDay: Object.entries(activityByDay).map(([date, count]) => ({ date, posts: count }))
        .sort((a, b) => a.date.localeCompare(b.date))
    };
  }

  async getSchoolSportAnalytics(schoolId: string): Promise<any> {
    if (!isDbConnected) throw new Error("Database not connected");
    
    const schoolStudents = await this.getStudentsBySchool(schoolId);
    const studentIds = schoolStudents.map(s => s.id);
    
    if (studentIds.length === 0) {
      return {
        sports: [],
        sportEngagement: [],
        sportPostCounts: []
      };
    }

    const sportStats: Record<string, { students: number; posts: number; engagement: number }> = {};

    // Initialize sport stats
    schoolStudents.forEach(student => {
      const sport = student.sport || 'No Sport';
      if (!sportStats[sport]) {
        sportStats[sport] = { students: 0, posts: 0, engagement: 0 };
      }
      sportStats[sport].students += 1;
    });

    const schoolPosts = await db
      .select()
      .from(posts)
      .where(
        and(
          inArray(posts.studentId, studentIds),
          sql`${posts.type} != 'announcement' OR ${posts.type} IS NULL`
        )
      );

    for (const post of schoolPosts) {
      const student = schoolStudents.find(s => s.id === post.studentId);
      const sport = student?.sport || 'No Sport';
      
      if (!sportStats[sport]) {
        sportStats[sport] = { students: 0, posts: 0, engagement: 0 };
      }
      
      sportStats[sport].posts += 1;

      const likes = await db.select().from(postLikes).where(eq(postLikes.postId, post.id));
      const comments = await db.select().from(postComments).where(eq(postComments.postId, post.id));
      const saves = await db.select().from(savedPosts).where(eq(savedPosts.postId, post.id));
      const views = await getPostViews(post.id);
      
      sportStats[sport].engagement += likes.length + comments.length + saves.length + views.length;
    }

    const sports = Object.keys(sportStats);
    
    return {
      sports: sports.map(sport => ({
        name: sport,
        students: sportStats[sport].students,
        posts: sportStats[sport].posts,
        engagement: sportStats[sport].engagement,
        avgEngagementPerPost: sportStats[sport].posts > 0 
          ? Math.round((sportStats[sport].engagement / sportStats[sport].posts) * 10) / 10 
          : 0
      })).sort((a, b) => b.engagement - a.engagement),
      sportEngagement: sports.map(sport => ({
        name: sport,
        engagement: sportStats[sport].engagement
      })).sort((a, b) => b.engagement - a.engagement),
      sportPostCounts: sports.map(sport => ({
        name: sport,
        posts: sportStats[sport].posts
      })).sort((a, b) => b.posts - a.posts)
    };
  }

  async followStudent(insertFollow: InsertStudentFollower): Promise<StudentFollower> {
    if (!isDbConnected) throw new Error('Database not connected');
    const [follow] = await db.insert(studentFollowers).values(insertFollow).returning();
    return follow;
  }

  async unfollowStudent(followerUserId: string, studentId: string): Promise<void> {
    if (!isDbConnected) throw new Error('Database not connected');
    await db.delete(studentFollowers)
      .where(sql`${studentFollowers.followerUserId} = ${followerUserId} AND ${studentFollowers.studentId} = ${studentId}`);
  }

  async getStudentFollowers(studentId: string): Promise<UserProfile[]> {
    if (!isDbConnected) throw new Error('Database not connected');
    const result = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        password: users.passwordHash,
        role: users.role,
        schoolId: users.schoolId,
        createdAt: users.createdAt,
      })
      .from(studentFollowers)
      .innerJoin(users, eq(studentFollowers.followerUserId, users.id))
      .where(eq(studentFollowers.studentId, studentId));
    return result;
  }

  async getUserFollowing(userId: string): Promise<Student[]> {
    if (!isDbConnected) throw new Error('Database not connected');
    const result = await db
      .select({
        id: students.id,
        userId: students.userId,
        schoolId: students.schoolId,
        name: students.name,
        phone: students.phone,
        gender: students.gender,
        dateOfBirth: students.dateOfBirth,
        grade: students.grade,
        guardianContact: students.guardianContact,
        profilePicUrl: students.profilePicUrl,
        roleNumber: students.roleNumber,
        position: students.position,
        sport: students.sport,
        profilePic: students.profilePic,
        bio: students.bio,
        coverPhoto: students.coverPhoto,
        createdAt: students.createdAt,
      })
      .from(studentFollowers)
      .innerJoin(students, eq(studentFollowers.studentId, students.id))
      .where(eq(studentFollowers.followerUserId, userId));
    return result;
  }

  async isFollowingStudent(followerUserId: string, studentId: string): Promise<boolean> {
    if (!isDbConnected) throw new Error('Database not connected');
    const result = await db
      .select({ id: studentFollowers.id })
      .from(studentFollowers)
      .where(sql`${studentFollowers.followerUserId} = ${followerUserId} AND ${studentFollowers.studentId} = ${studentId}`)
      .limit(1);
    return result.length > 0;
  }

  // Optimized method to get follow statuses for multiple students at once
  async getFollowStatusesForStudents(followerUserId: string, studentIds: string[]): Promise<Map<string, boolean>> {
    if (!isDbConnected) throw new Error('Database not connected');
    if (studentIds.length === 0) return new Map();
    
    const result = await db
      .select()
      .from(studentFollowers)
      .where(
        and(
          eq(studentFollowers.followerUserId, followerUserId),
          inArray(studentFollowers.studentId, studentIds)
        )
      );
    
    const followMap = new Map<string, boolean>();
    studentIds.forEach(id => followMap.set(id, false)); // Initialize all as false
    result.forEach(follow => followMap.set(follow.studentId, true)); // Set followed ones to true
    
    return followMap;
  }

  async searchStudents(query: string, currentUserId?: string): Promise<StudentSearchResult[]> {
    if (!isDbConnected) throw new Error('Database not connected');
    const searchTerm = `%${query.toLowerCase()}%`;
    
    const result = await db
      .select({
        student: students,
        user: users,
        school: schools,
        followersCount: sql<number>`COUNT(${studentFollowers.id})`.as('followersCount'),
      })
      .from(students)
      .innerJoin(users, eq(students.userId, users.id))
      .leftJoin(schools, eq(users.schoolId, schools.id))
      .leftJoin(studentFollowers, eq(studentFollowers.studentId, students.id))
      .where(
        sql`LOWER(${users.name}) LIKE ${searchTerm} OR 
            LOWER(${students.sport}) LIKE ${searchTerm} OR 
            LOWER(${students.position}) LIKE ${searchTerm}`
      )
      .groupBy(students.id, users.id, schools.id)
      .orderBy(sql`COUNT(${studentFollowers.id}) DESC`);

    // Check if current user is following each student
    const resultsWithFollowStatus = await Promise.all(
      result.map(async (row) => {
        const isFollowing = currentUserId ? 
          await this.isFollowingStudent(currentUserId, row.student.id) : false;
        
        return {
          ...row.student,
          user: row.user,
          school: row.school || undefined,
          followersCount: row.followersCount,
          isFollowing,
        };
      })
    );

    return resultsWithFollowStatus;
  }

  // School application operations
  async getSchoolApplications(): Promise<SchoolApplication[]> {
    if (!isDbConnected) return [];
    return await db.select().from(schoolApplications).orderBy(desc(schoolApplications.createdAt));
  }

  async getSchoolApplication(id: string): Promise<SchoolApplication | undefined> {
    if (!isDbConnected) return undefined;
    const result = await db.select().from(schoolApplications).where(eq(schoolApplications.id, id));
    return result[0];
  }

  async createSchoolApplication(application: InsertSchoolApplication): Promise<SchoolApplication> {
    if (!isDbConnected) throw new Error("Database not connected");
    const [created] = await db.insert(schoolApplications).values(application).returning();
    return created;
  }

  async updateSchoolApplication(id: string, application: Partial<SchoolApplication>): Promise<SchoolApplication | undefined> {
    if (!isDbConnected) return undefined;
    const [updated] = await db.update(schoolApplications)
      .set(application)
      .where(eq(schoolApplications.id, id))
      .returning();
    return updated;
  }

  async approveSchoolApplication(id: string, reviewerId: string): Promise<School | undefined> {
    if (!isDbConnected) return undefined;
    
    const application = await this.getSchoolApplication(id);
    if (!application) return undefined;
    
    // Create the school
    const [school] = await db.insert(schools).values({
      name: application.schoolName,
      subscriptionPlan: application.planType as "standard" | "premium",
      maxStudents: application.expectedStudents || 100,
    }).returning();
    
    // Update application status
    await this.updateSchoolApplication(id, {
      status: "approved",
      reviewedBy: reviewerId,
      reviewedAt: new Date(),
    });
    
    // Log analytics
    await this.logAnalyticsEvent({
      eventType: "school_onboarded",
      entityId: school.id,
      entityType: "school",
      metadata: JSON.stringify({ approvedBy: reviewerId }),
    });
    
    return school;
  }

  async rejectSchoolApplication(id: string, reviewerId: string, notes?: string): Promise<SchoolApplication | undefined> {
    return await this.updateSchoolApplication(id, {
      status: "rejected",
      reviewedBy: reviewerId,
      reviewedAt: new Date(),
      notes: notes,
    });
  }

  // System settings operations
  async getSystemSettings(): Promise<SystemSetting[]> {
    if (!isDbConnected) return [];
    return await db.select().from(systemSettings).orderBy(systemSettings.category, systemSettings.key);
  }

  async getSystemSetting(key: string): Promise<SystemSetting | undefined> {
    if (!isDbConnected) return undefined;
    const result = await db.select().from(systemSettings).where(eq(systemSettings.key, key));
    return result[0];
  }

  async createOrUpdateSystemSetting(setting: InsertSystemSetting): Promise<SystemSetting> {
    if (!isDbConnected) throw new Error("Database not connected");
    
    const existing = await this.getSystemSetting(setting.key);
    if (existing) {
      const [updated] = await db.update(systemSettings)
        .set({ ...setting, updatedAt: new Date() })
        .where(eq(systemSettings.key, setting.key))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(systemSettings).values(setting).returning();
      return created;
    }
  }

  async deleteSystemSetting(key: string): Promise<void> {
    if (!isDbConnected) return;
    await db.delete(systemSettings).where(eq(systemSettings.key, key));
  }

  // System configuration operations
  async getSystemBranding(): Promise<SystemBranding | undefined> {
    if (!isDbConnected) return undefined;
    const result = await db.select().from(systemBranding).limit(1);
    return result[0];
  }

  async updateSystemBranding(branding: Partial<InsertSystemBranding>): Promise<SystemBranding> {
    if (!isDbConnected) throw new Error("Database not connected");
    
    const existing = await this.getSystemBranding();
    if (existing) {
      const [updated] = await db.update(systemBranding)
        .set({ ...branding, updatedAt: new Date() })
        .where(eq(systemBranding.id, existing.id))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(systemBranding).values({
        ...branding,
        updatedBy: 'system',
      } as InsertSystemBranding).returning();
      return created;
    }
  }

  async getSystemAppearance(): Promise<SystemAppearance | undefined> {
    if (!isDbConnected) return undefined;
    const result = await db.select().from(systemAppearance).limit(1);
    return result[0];
  }

  async updateSystemAppearance(appearance: Partial<InsertSystemAppearance>): Promise<SystemAppearance> {
    if (!isDbConnected) throw new Error("Database not connected");
    
    const existing = await this.getSystemAppearance();
    if (existing) {
      const [updated] = await db.update(systemAppearance)
        .set({ ...appearance, updatedAt: new Date() })
        .where(eq(systemAppearance.id, existing.id))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(systemAppearance).values({
        ...appearance,
        updatedBy: 'system',
      } as InsertSystemAppearance).returning();
      return created;
    }
  }

  async getSystemPayment(): Promise<SystemPayment | undefined> {
    if (!isDbConnected) return undefined;
    const result = await db.select().from(systemPayment).limit(1);
    return result[0];
  }

  async updateSystemPayment(payment: Partial<InsertSystemPayment>): Promise<SystemPayment> {
    if (!isDbConnected) throw new Error("Database not connected");
    
    const existing = await this.getSystemPayment();
    if (existing) {
      const [updated] = await db.update(systemPayment)
        .set({ ...payment, updatedAt: new Date() })
        .where(eq(systemPayment.id, existing.id))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(systemPayment).values({
        ...payment,
        updatedBy: 'system',
      } as InsertSystemPayment).returning();
      return created;
    }
  }

  // Admin role operations
  async getAdminRoles(): Promise<AdminRole[]> {
    if (!isDbConnected) return [];
    return await db.select().from(adminRoles).orderBy(desc(adminRoles.createdAt));
  }

  async getAdminRole(userId: string): Promise<AdminRole | undefined> {
    if (!isDbConnected) return undefined;
    const result = await db.select().from(adminRoles).where(eq(adminRoles.userId, userId));
    return result[0];
  }

  async createAdminRole(role: InsertAdminRole): Promise<AdminRole> {
    if (!isDbConnected) throw new Error("Database not connected");
    const [created] = await db.insert(adminRoles).values(role).returning();
    return created;
  }

  async updateAdminRole(userId: string, role: Partial<AdminRole>): Promise<AdminRole | undefined> {
    if (!isDbConnected) return undefined;
    const [updated] = await db.update(adminRoles)
      .set(role)
      .where(eq(adminRoles.userId, userId))
      .returning();
    return updated;
  }

  async deleteAdminRole(userId: string): Promise<void> {
    if (!isDbConnected) return;
    await db.delete(adminRoles).where(eq(adminRoles.userId, userId));
  }

  // Analytics operations
  async logAnalyticsEvent(log: InsertAnalyticsLog): Promise<AnalyticsLog> {
    if (!isDbConnected) throw new Error("Database not connected");
    const [created] = await db.insert(analyticsLogs).values(log).returning();
    return created;
  }

  async getAnalyticsLogs(eventType?: string, limit?: number): Promise<AnalyticsLog[]> {
    if (!isDbConnected) return [];
    
    let query = db.select().from(analyticsLogs);
    
    if (eventType) {
      query = query.where(eq(analyticsLogs.eventType, eventType));
    }
    
    query = query.orderBy(desc(analyticsLogs.timestamp));
    
    if (limit) {
      query = query.limit(limit);
    }
    
    return await query;
  }

  async getAnalyticsStats(): Promise<any> {
    if (!isDbConnected) return { userSignups: 0, postCreated: 0, schoolOnboarded: 0, totalEvents: 0 };
    
    const logs = await db.select().from(analyticsLogs);
    const userSignups = logs.filter(l => l.eventType === "user_signup").length;
    const postCreated = logs.filter(l => l.eventType === "post_created").length;
    const schoolOnboarded = logs.filter(l => l.eventType === "school_onboarded").length;
    
    return {
      userSignups,
      postCreated,
      schoolOnboarded,
      totalEvents: logs.length,
    };
  }

  // Additional student operations for school admin
  async getStudentByEmail(email: string): Promise<Student | undefined> {
    if (!isDbConnected) return undefined;
    const result = await db.select().from(students).where(eq(students.email, email));
    return result[0];
  }

  async deleteStudent(id: string): Promise<void> {
    if (!isDbConnected) return;
    await db.delete(students).where(eq(students.id, id));
  }

  async searchSchoolStudents(schoolId: string, query: string): Promise<Student[]> {
    if (!isDbConnected) return [];
    
    const searchTerm = `%${query.toLowerCase()}%`;
    return await db.select().from(students)
      .where(and(
        eq(students.schoolId, schoolId),
        or(
          sql`LOWER(${students.name}) LIKE ${searchTerm}`,
          sql`LOWER(${students.email}) LIKE ${searchTerm}`,
          sql`LOWER(${students.grade}) LIKE ${searchTerm}`,
          sql`LOWER(${students.roleNumber}) LIKE ${searchTerm}`
        )
      ));
  }

  // Student Rating operations
  async getStudentRatings(studentId: string): Promise<StudentRating[]> {
    if (!isDbConnected) return [];
    return await db.select().from(studentRatings)
      .where(eq(studentRatings.studentId, studentId))
      .orderBy(desc(studentRatings.createdAt));
  }

  async getStudentRating(id: string): Promise<StudentRating | undefined> {
    if (!isDbConnected) return undefined;
    const result = await db.select().from(studentRatings).where(eq(studentRatings.id, id));
    return result[0];
  }

  async createStudentRating(rating: InsertStudentRating): Promise<StudentRating> {
    if (!isDbConnected) throw new Error("Database not connected");
    const [created] = await db.insert(studentRatings).values(rating).returning();
    return created;
  }

  async updateStudentRating(id: string, rating: Partial<StudentRating>): Promise<StudentRating | undefined> {
    if (!isDbConnected) return undefined;
    const [updated] = await db.update(studentRatings)
      .set(rating)
      .where(eq(studentRatings.id, id))
      .returning();
    return updated;
  }

  async deleteStudentRating(id: string): Promise<void> {
    if (!isDbConnected) return;
    await db.delete(studentRatings).where(eq(studentRatings.id, id));
  }

  async getAverageRating(studentId: string): Promise<number> {
    if (!isDbConnected) return 0;
    
    const ratings = await this.getStudentRatings(studentId);
    if (ratings.length === 0) return 0;
    
    const sum = ratings.reduce((acc, rating) => acc + rating.rating, 0);
    return sum / ratings.length;
  }

  // School Setting operations
  async getSchoolSettings(schoolId: string): Promise<SchoolSetting[]> {
    if (!isDbConnected) return [];
    return await db.select().from(schoolSettings)
      .where(eq(schoolSettings.schoolId, schoolId))
      .orderBy(schoolSettings.category, schoolSettings.key);
  }

  async getSchoolSetting(schoolId: string, key: string): Promise<SchoolSetting | undefined> {
    if (!isDbConnected) return undefined;
    const result = await db.select().from(schoolSettings)
      .where(and(eq(schoolSettings.schoolId, schoolId), eq(schoolSettings.key, key)));
    return result[0];
  }

  async createOrUpdateSchoolSetting(setting: InsertSchoolSetting): Promise<SchoolSetting> {
    if (!isDbConnected) throw new Error("Database not connected");
    
    const existing = await this.getSchoolSetting(setting.schoolId, setting.key);
    if (existing) {
      const [updated] = await db.update(schoolSettings)
        .set({ ...setting, updatedAt: new Date() })
        .where(and(eq(schoolSettings.schoolId, setting.schoolId), eq(schoolSettings.key, setting.key)))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(schoolSettings).values(setting).returning();
      return created;
    }
  }

  async deleteSchoolSetting(schoolId: string, key: string): Promise<void> {
    if (!isDbConnected) return;
    await db.delete(schoolSettings)
      .where(and(eq(schoolSettings.schoolId, schoolId), eq(schoolSettings.key, key)));
  }

  // Update user's school link and linked ID
  async updateUserSchoolLink(userId: string, linkedId: string, schoolId: string): Promise<void> {
    if (!isDbConnected) return;
    await db.update(users)
      .set({ 
        linkedId: linkedId, // This maps to linked_id column
        schoolId: schoolId 
      })
      .where(eq(users.id, userId));
  }

  // General user follow operations
  async followUser(followerId: string, followingId: string): Promise<void> {
    if (!isDbConnected) throw new Error("Database not connected");
    
    await db.insert(userFollows).values({
      followerId,
      followingId,
    });
  }

  async unfollowUser(followerId: string, followingId: string): Promise<void> {
    if (!isDbConnected) throw new Error("Database not connected");
    
    await db.delete(userFollows)
      .where(and(
        eq(userFollows.followerId, followerId),
        eq(userFollows.followingId, followingId)
      ));
  }

  async isFollowing(followerUserId: string, targetUserId: string): Promise<boolean> {
    if (!isDbConnected) throw new Error("Database not connected");
    
    const result = await db.select()
      .from(userFollows)
      .where(and(
        eq(userFollows.followerId, followerUserId),
        eq(userFollows.followingId, targetUserId)
      ))
      .limit(1);
    
    return result.length > 0;
  }

  async getFollowing(userId: string): Promise<Student[]> {
    if (!isDbConnected) throw new Error("Database not connected");
    
    // Query from studentFollowers table which is the source of truth
    // This ensures consistency with isFollowingStudent checks
    const result = await db
      .select({
        id: students.id,
        userId: students.userId,
        schoolId: students.schoolId,
        name: students.name,
        phone: students.phone,
        gender: students.gender,
        dateOfBirth: students.dateOfBirth,
        grade: students.grade,
        guardianContact: students.guardianContact,
        profilePicUrl: students.profilePicUrl,
        roleNumber: students.roleNumber,
        position: students.position,
        sport: students.sport,
        profilePic: students.profilePic,
        bio: students.bio,
        coverPhoto: students.coverPhoto,
        createdAt: students.createdAt,
      })
      .from(studentFollowers)
      .innerJoin(students, eq(studentFollowers.studentId, students.id))
      .where(eq(studentFollowers.followerUserId, userId));
    
    return result;
  }

  // XEN Watch implementations
  async createScoutAdmin(userInput: { name: string; email: string; xenId: string; profilePicUrl?: string }): Promise<{ user: User; profile: any }> {
    const hashedPassword = await bcrypt.hash('temp-password', 10);
    const userId = randomUUID();
    
    // Create user with scout_admin role
    const user = await db.insert(users).values({
      id: userId,
      email: userInput.email,
      passwordHash: hashedPassword,
      role: 'scout_admin',
      linkedId: userId, // For scout profiles, linkedId points to the scout profile
      name: userInput.name,
      emailVerified: false,
      isOneTimePassword: true
    }).returning();
    
    // Create scout profile
    const profile = await db.insert(scoutProfiles).values({
      userId,
      xenId: userInput.xenId,
      name: userInput.name,
      profilePicUrl: userInput.profilePicUrl
    }).returning();
    
    return { user: user[0], profile: profile[0] };
  }

  async createScout(userInput: { name: string; email: string; xenId: string; profilePicUrl?: string }): Promise<{ user: User; profile: any }> {
    const hashedPassword = await bcrypt.hash('temp-password', 10);
    const userId = randomUUID();
    
    // Create user with xen_scout role
    const user = await db.insert(users).values({
      id: userId,
      email: userInput.email,
      passwordHash: hashedPassword,
      role: 'xen_scout',
      linkedId: userId,
      name: userInput.name,
      emailVerified: false,
      isOneTimePassword: true
    }).returning();
    
    // Create scout profile
    const profile = await db.insert(scoutProfiles).values({
      userId,
      xenId: userInput.xenId,
      name: userInput.name,
      profilePicUrl: userInput.profilePicUrl
    }).returning();
    
    return { user: user[0], profile: profile[0] };
  }

  async createXenWatchSubmission(data: { studentId: string; postId?: string; mediaUrl?: string; mediaPublicId?: string; caption?: string; selectedScoutId?: string }): Promise<any> {
    // Get student's school ID
    const student = await db.select().from(students).where(eq(students.userId, data.studentId)).limit(1);
    const schoolId = student[0]?.schoolId || null;
    
    const submission = await db.insert(xenWatchSubmissions).values({
      studentId: data.studentId,
      schoolId,
      postId: data.postId,
      mediaUrl: data.mediaUrl,
      mediaPublicId: data.mediaPublicId,
      caption: data.caption,
      selectedScoutId: data.selectedScoutId,
      status: 'pending_payment'
    }).returning();
    
    return submission[0];
  }

  async markSubmissionPaid(submissionId: string, provider: string, intentId: string): Promise<void> {
    await db.update(xenWatchSubmissions)
      .set({
        status: 'paid',
        paymentProvider: provider,
        paymentIntentId: intentId,
        paidAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(xenWatchSubmissions.id, submissionId));
  }

  async assignSubmission(submissionId: string, scoutProfileId: string): Promise<void> {
    await db.update(xenWatchSubmissions)
      .set({
        status: 'assigned',
        selectedScoutId: scoutProfileId,
        updatedAt: new Date()
      })
      .where(eq(xenWatchSubmissions.id, submissionId));
  }

  async addReview(data: { submissionId: string; scoutId: string; rating: number; comment?: string }): Promise<any> {
    // Check if this is the first review to set status to 'in_review'
    const existingReviews = await db.select()
      .from(xenWatchReviews)
      .where(eq(xenWatchReviews.submissionId, data.submissionId));
    
    const review = await db.insert(xenWatchReviews).values({
      submissionId: data.submissionId,
      scoutId: data.scoutId,
      rating: data.rating,
      comment: data.comment
    }).returning();
    
    // If first review, set status to 'in_review'
    if (existingReviews.length === 0) {
      await db.update(xenWatchSubmissions)
        .set({
          status: 'in_review',
          updatedAt: new Date()
        })
        .where(eq(xenWatchSubmissions.id, data.submissionId));
    } else {
      // If not first review, set to 'reviewed'
      await db.update(xenWatchSubmissions)
        .set({
          status: 'reviewed',
          updatedAt: new Date()
        })
        .where(eq(xenWatchSubmissions.id, data.submissionId));
    }
    
    return review[0];
  }

  async sendFinalFeedback(data: { submissionId: string; adminUserId: string; message: string }): Promise<any> {
    const feedback = await db.insert(xenWatchFeedback).values({
      submissionId: data.submissionId,
      adminUserId: data.adminUserId,
      message: data.message
    }).returning();
    
    // Update submission status
    await db.update(xenWatchSubmissions)
      .set({
        status: 'feedback_sent',
        updatedAt: new Date()
      })
      .where(eq(xenWatchSubmissions.id, data.submissionId));
    
    return feedback[0];
  }

  async listMySubmissions(studentId: string): Promise<any[]> {
    const submissions = await db.select()
      .from(xenWatchSubmissions)
      .where(eq(xenWatchSubmissions.studentId, studentId))
      .orderBy(desc(xenWatchSubmissions.createdAt));
    
    return submissions;
  }

  async listSubmissionsForScouts(params: { assignedTo?: 'me' | 'all'; status?: string; scoutId?: string }): Promise<any[]> {
    let query = db.select()
      .from(xenWatchSubmissions)
      .orderBy(desc(xenWatchSubmissions.createdAt));
    
    const conditions = [];
    
    if (params.assignedTo === 'me' && params.scoutId) {
      conditions.push(eq(xenWatchSubmissions.selectedScoutId, params.scoutId));
    }
    
    if (params.status) {
      conditions.push(eq(xenWatchSubmissions.status, params.status));
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }
    
    const submissions = await query;
    return submissions;
  }

  async getSubmissionWithJoins(id: string): Promise<any> {
    const submission = await db.select()
      .from(xenWatchSubmissions)
      .leftJoin(students, eq(xenWatchSubmissions.studentId, students.userId))
      .leftJoin(schools, eq(xenWatchSubmissions.schoolId, schools.id))
      .leftJoin(posts, eq(xenWatchSubmissions.postId, posts.id))
      .leftJoin(scoutProfiles, eq(xenWatchSubmissions.selectedScoutId, scoutProfiles.id))
      .leftJoin(xenWatchFeedback, eq(xenWatchSubmissions.id, xenWatchFeedback.submissionId))
      .where(eq(xenWatchSubmissions.id, id))
      .limit(1);
    
    return submission[0];
  }

  async getScoutProfiles(): Promise<any[]> {
    const profiles = await db.select()
      .from(scoutProfiles)
      .leftJoin(users, eq(scoutProfiles.userId, users.id))
      .orderBy(scoutProfiles.name);
    
    return profiles;
  }

  async refreshXenWatchStats(): Promise<void> {
    try {
      await db.execute(sql`REFRESH MATERIALIZED VIEW CONCURRENTLY xen_watch_stats`);
    } catch (error) {
      console.log('XEN Watch materialized view not found, skipping refresh');
    }
  }

  async getXenWatchAnalytics(): Promise<any> {
    try {
      // Use the new submissions and submission_reviews tables instead of old XEN Watch tables
      
      // Get totals from submissions table with COALESCE for null handling
      const totals = await db.execute(sql`
        SELECT 
          COUNT(DISTINCT s.id) as total_submissions,
          COUNT(DISTINCT s.id) FILTER (WHERE s.status = 'finalized') as finalized,
          COUNT(DISTINCT s.id) FILTER (WHERE s.status = 'in_review') as in_review,
          COUNT(DISTINCT s.id) FILTER (WHERE s.status = 'rejected') as rejected,
          COALESCE(AVG(sr.rating) FILTER (WHERE sr.rating IS NOT NULL), 0) as avg_rating
        FROM submissions s
        LEFT JOIN submission_reviews sr ON sr.submission_id::text = s.id::text AND sr.is_submitted = true
      `);
      
      // Get scout count from scout_profiles table (main scout data source)
      let totalScouts = 0;
      try {
        console.log('🔍 About to execute scout count query...');
        const scoutCount = await db.execute(sql`
          SELECT COUNT(*) as count
          FROM scout_profiles
        `);
        
        console.log('🔢 Scout count raw result:', scoutCount);
        console.log('🔢 Scout count rows:', scoutCount.rows);
        console.log('🔢 Scout count first row:', scoutCount.rows?.[0]);
        
        totalScouts = parseInt(scoutCount.rows?.[0]?.count || '0');
        console.log('🔢 Scout count from scout_profiles:', totalScouts);
      } catch (error) {
        console.error('❌ Error getting scout count:', error);
        totalScouts = 0;
      }
      
      // Get top students based on submission reviews with proper null handling
      const topStudents = await db.execute(sql`
        SELECT 
          s.student_id,
          COALESCE(st.name, 'Unknown Student') as name,
          COALESCE(AVG(sr.rating) FILTER (WHERE sr.rating IS NOT NULL), 0) as avg_rating,
          COUNT(DISTINCT s.id) as total_submissions
        FROM submissions s
        LEFT JOIN submission_reviews sr ON sr.submission_id::text = s.id::text AND sr.is_submitted = true
        LEFT JOIN students st ON st.user_id::text = s.student_id::text
        WHERE sr.rating IS NOT NULL
        GROUP BY s.student_id, st.name
        HAVING AVG(sr.rating) IS NOT NULL
        ORDER BY avg_rating DESC, total_submissions DESC
        LIMIT 10
      `);
      
      // Get top schools based on submission reviews with proper null handling
      const topSchools = await db.execute(sql`
        SELECT 
          st.school_id,
          COALESCE(sc.name, 'Unknown School') as name,
          COALESCE(AVG(sr.rating) FILTER (WHERE sr.rating IS NOT NULL), 0) as avg_rating,
          COUNT(DISTINCT s.id) as total_submissions
        FROM submissions s
        LEFT JOIN submission_reviews sr ON sr.submission_id::text = s.id::text AND sr.is_submitted = true
        LEFT JOIN students st ON st.user_id::text = s.student_id::text
        LEFT JOIN schools sc ON sc.id::text = st.school_id::text
        WHERE sr.rating IS NOT NULL
        GROUP BY st.school_id, sc.name
        HAVING AVG(sr.rating) IS NOT NULL
        ORDER BY avg_rating DESC, total_submissions DESC
        LIMIT 10
      `);

      return {
        totals: {
          total_submissions: parseInt(totals.rows?.[0]?.total_submissions || '0'),
          paid: parseInt(totals.rows?.[0]?.finalized || '0'), // Map finalized to paid for compatibility
          reviewed: parseInt(totals.rows?.[0]?.in_review || '0'),
          feedback_sent: parseInt(totals.rows?.[0]?.finalized || '0'), // Map finalized to feedback_sent
          avg_rating: parseFloat(totals.rows?.[0]?.avg_rating || '0'),
          total_scouts: totalScouts
        },
        topStudents: (topStudents.rows || []).map(row => ({
          student_id: row.student_id,
          name: row.name || 'Unknown Student',
          avg_rating: parseFloat(row.avg_rating || '0'),
          total_submissions: parseInt(row.total_submissions || '0')
        })),
        topSchools: (topSchools.rows || []).map(row => ({
          school_id: row.school_id,
          name: row.name || 'Unknown School',
          avg_rating: parseFloat(row.avg_rating || '0'),
          total_submissions: parseInt(row.total_submissions || '0')
        }))
      };
    } catch (error) {
      console.error('Error in getXenWatchAnalytics:', error);
      // Return empty data if there's any error
      return {
        totals: {
          total_submissions: 0,
          paid: 0,
          reviewed: 0,
          feedback_sent: 0,
          avg_rating: 0,
          total_scouts: 0
        },
        topStudents: [],
        topSchools: []
      };
    }
  }

  async getScoutsCount(): Promise<number> {
    const result = await db.execute(sql`
      SELECT COUNT(*) as count 
      FROM users 
      WHERE role IN ('xen_scout', 'scout_admin')
    `);
    const count = parseInt(result.rows[0]?.count || '0');
    console.log('🔢 Scout count query result:', count, 'scouts found');
    return count;
  }

  async getScoutAnalytics(timeFilter: string): Promise<any> {
    try {
      console.log('🔍 Getting scout analytics with time filter:', timeFilter);
      console.log('🔍 Starting scout analytics function...');
      
      // Build time filter condition - simplified for now
      let timeCondition = sql`1=1`;
      console.log('🔍 Time filter condition set to 1=1');

      // Get scout performance analytics from scout_profiles table (minimal query)
      console.log('🔍 About to execute scout stats query...');
      const scoutStats = await db.execute(sql`
        SELECT 
          sp.id,
          sp.name,
          u.email,
          sp.xen_id,
          sp.profile_pic_url,
          sp.created_at,
          u.role,
          0 as total_assignments,
          0 as completed_reviews,
          0 as avg_rating,
          0 as high_quality_reviews,
          0 as low_quality_reviews,
          0 as pending_reviews,
          NULL as first_review_date,
          NULL as last_activity,
          0 as recent_activity_7d,
          0 as recent_activity_30d,
          0 as completion_rate,
          0 as quality_score
        FROM scout_profiles sp
        LEFT JOIN users u ON u.id = sp.user_id::varchar
        ORDER BY sp.created_at DESC
      `);

      if (!scoutStats.rows || scoutStats.rows.length === 0) {
        console.log('No scout stats found, checking scout_profiles table...');
        const testQuery = await db.execute(sql`SELECT COUNT(*) as count FROM scout_profiles`);
        console.log('Scout_profiles count:', testQuery[0]?.count);
      }

      // Get submission analytics - simplified query with proper null handling
      const submissionStats = await db.execute(sql`
        SELECT 
          COUNT(*) as total_submissions,
          COUNT(CASE WHEN status = 'in_review' THEN 1 END) as in_review,
          COUNT(CASE WHEN status = 'finalized' THEN 1 END) as finalized,
          COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected,
          0 as avg_final_rating
        FROM submissions s
      `);

      // Get revenue analytics - calculate based on actual submission data ($10 per submission)
      let revenueStats = { total_paid_submissions: 0, total_revenue: 0, avg_submission_value: 10.00 };
      
      // Calculate revenue based on all submissions (since each submission is worth $10)
      try {
        const revenueResult = await db.execute(sql`
          SELECT 
            COUNT(*) as total_submissions,
            COUNT(*) * 10.0 as total_revenue
          FROM submissions
        `);
        
        if (revenueResult.rows && revenueResult.rows[0]) {
          const totalSubmissions = parseInt(revenueResult.rows[0].total_submissions || '0');
          const totalRevenue = parseFloat(revenueResult.rows[0].total_revenue || '0');
          
          revenueStats = {
            total_paid_submissions: totalSubmissions,
            total_revenue: totalRevenue,
            avg_submission_value: 10.00
          };
        }
      } catch (revenueError) {
        console.log('Error calculating revenue from submissions table:', revenueError);
        
        // Fallback: try legacy xen_watch_submissions table
        try {
          const legacyRevenueResult = await db.execute(sql`
            SELECT 
              COUNT(*) as total_paid_submissions,
              COALESCE(SUM(amount_cents) / 100.0, 0) as total_revenue,
              COALESCE(AVG(amount_cents / 100.0), 10.0) as avg_submission_value
            FROM xen_watch_submissions
            WHERE status IN ('paid', 'reviewed', 'feedback_sent') AND paid_at IS NOT NULL
          `);
          revenueStats = legacyRevenueResult.rows?.[0] || revenueStats;
        } catch (legacyError) {
          console.log('Legacy revenue table not found or accessible, using default values');
        }
      }

      // Check if we have actual scouts in the database (scout_profiles table)
      const scoutsCount = await db.execute(sql`
        SELECT COUNT(*) as count FROM scout_profiles
      `);
      
      const hasRealScouts = (scoutsCount.rows?.[0]?.count || scoutsCount[0]?.count) > 0;
      
      // If we have real scouts but no analytics data, return basic scout info instead of empty arrays
      if (hasRealScouts && (!scoutStats.rows || scoutStats.rows.length === 0)) {
        console.log('Real scouts exist but no analytics data found, returning basic scout info');
        
        // Get basic scout info from scout_profiles table
        const basicScoutStats = await db.execute(sql`
          SELECT 
            sp.id,
            COALESCE(sp.name, 'Unnamed Scout') as name,
            u.email,
            sp.xen_id,
            sp.profile_pic_url,
            sp.created_at,
            u.role,
            0 as total_assignments,
            0 as completed_reviews,
            0 as avg_rating,
            0 as high_quality_reviews,
            0 as low_quality_reviews,
            0 as pending_reviews,
            NULL as first_review_date,
            NULL as last_activity,
            0 as recent_activity_7d,
            0 as recent_activity_30d,
            0 as completion_rate,
            0 as quality_score
          FROM scout_profiles sp
          LEFT JOIN users u ON u.id = sp.user_id::varchar
        `);
        
        return {
          scoutStats: basicScoutStats,
          submissionStats: submissionStats[0] || {
            total_submissions: 0,
            in_review: 0,
            finalized: 0,
            rejected: 0,
            avg_final_rating: 0
          },
          revenueStats,
          timeFilter
        };
      }
      
      // Only return sample data if there are no scouts at all
      if (!hasRealScouts) {
        console.log('No real scouts found, returning sample analytics data for demonstration');
        return {
          scoutStats: [
            {
              id: 'sample-scout-1',
              name: 'Alex Johnson',
              email: 'alex.johnson@xen.com',
              xen_id: 'XSA-25001',
              profile_pic_url: null,
              created_at: '2024-09-01T10:00:00Z',
              role: 'xen_scout',
              total_assignments: 15,
              completed_reviews: 12,
              avg_rating: 4.2,
              high_quality_reviews: 8,
              low_quality_reviews: 1,
              pending_reviews: 3,
              first_review_date: '2024-09-01T10:00:00Z',
              last_activity: '2024-09-25T08:30:00Z',
              recent_activity_7d: 3,
              recent_activity_30d: 12,
              completion_rate: 80,
              quality_score: 67
            },
            {
              id: 'sample-scout-2',
              name: 'Sarah Chen',
              email: 'sarah.chen@xen.com',
              xen_id: 'XSA-25002',
              profile_pic_url: null,
              created_at: '2024-09-02T14:15:00Z',
              role: 'xen_scout',
              total_assignments: 22,
              completed_reviews: 18,
              avg_rating: 4.5,
              high_quality_reviews: 14,
              low_quality_reviews: 2,
              pending_reviews: 4,
              first_review_date: '2024-09-02T14:15:00Z',
              last_activity: '2024-09-24T16:45:00Z',
              recent_activity_7d: 5,
              recent_activity_30d: 18,
              completion_rate: 82,
              quality_score: 78
            },
            {
              id: 'sample-scout-3',
              name: 'Mike Rodriguez',
              email: 'mike.rodriguez@xen.com',
              xen_id: 'XSA-25003',
              profile_pic_url: null,
              created_at: '2024-09-10T09:20:00Z',
              role: 'scout_admin',
              total_assignments: 8,
              completed_reviews: 6,
              avg_rating: 3.8,
              high_quality_reviews: 4,
              low_quality_reviews: 1,
              pending_reviews: 2,
              first_review_date: '2024-09-10T09:20:00Z',
              last_activity: '2024-09-23T11:10:00Z',
              recent_activity_7d: 2,
              recent_activity_30d: 6,
              completion_rate: 75,
              quality_score: 67
            }
          ],
          submissionStats: {
            total_submissions: 45,
            in_review: 12,
            finalized: 28,
            rejected: 5,
            avg_final_rating: 4.1
          },
          revenueStats: {
            total_paid_submissions: 28,
            total_revenue: 280.00,
            avg_submission_value: 10.00
          },
          timeFilter
        };
      }

      const finalScoutStats = Array.isArray(scoutStats) ? scoutStats : (scoutStats.rows || []);
      
      return {
        scoutStats: finalScoutStats,
        submissionStats: Array.isArray(submissionStats) ? submissionStats[0] : (submissionStats.rows?.[0] || {
          total_submissions: 0,
          in_review: 0,
          finalized: 0,
          rejected: 0,
          avg_final_rating: 0
        }),
        revenueStats,
        timeFilter
      };
    } catch (error) {
      console.error('Error in getScoutAnalytics:', error);
      // Return empty data structure on error
      return {
        scoutStats: [],
        submissionStats: {
          total_submissions: 0,
          in_review: 0,
          finalized: 0,
          rejected: 0,
          avg_final_rating: 0
        },
        revenueStats: {
          total_paid_submissions: 0,
          total_revenue: 0,
          avg_submission_value: 0
        },
        timeFilter
      };
    }
  }

  async getDetailedScoutProfiles(options: { page: number; limit: number; search?: string }): Promise<any> {
    const { page, limit, search } = options;
    const offset = (page - 1) * limit;

    // Build search condition
    let searchCondition = sql`1=1`;
    if (search && search.trim()) {
      const searchTerm = `%${search.trim().toLowerCase()}%`;
      searchCondition = sql`(LOWER(u.name) LIKE ${searchTerm} OR LOWER(u.xen_id) LIKE ${searchTerm} OR LOWER(u.email) LIKE ${searchTerm})`;
    }

    // Optimized single query to get all scout data with analytics
    const scouts = await db.execute(sql`
      SELECT 
        u.id,
        COALESCE(u.name, 'Unnamed Scout') as name,
        u.email,
        u.xen_id,
        u.profile_pic_url,
        u.created_at,
        u.role,
        COALESCE(COUNT(DISTINCT sr.submission_id), 0) as total_assignments,
        COALESCE(COUNT(DISTINCT CASE WHEN sr.is_submitted = true THEN sr.submission_id END), 0) as completed_reviews,
        COALESCE(AVG(CASE WHEN sr.is_submitted = true AND sr.rating IS NOT NULL THEN sr.rating END), 0) as avg_rating,
        COALESCE(COUNT(DISTINCT CASE WHEN sr.is_submitted = true AND sr.rating >= 4 THEN sr.submission_id END), 0) as high_quality_reviews,
        COALESCE(COUNT(DISTINCT CASE WHEN sr.is_submitted = true AND sr.rating <= 2 THEN sr.submission_id END), 0) as low_quality_reviews,
        COALESCE(COUNT(DISTINCT CASE WHEN sr.is_submitted = false THEN sr.submission_id END), 0) as pending_reviews,
        MIN(CASE WHEN sr.is_submitted = true THEN sr.created_at END) as first_review_date,
        MAX(CASE WHEN sr.is_submitted = true THEN sr.updated_at END) as last_activity,
        COALESCE(COUNT(DISTINCT CASE WHEN sr.is_submitted = true AND sr.updated_at >= NOW() - INTERVAL '7 days' THEN sr.submission_id END), 0) as recent_activity_7d,
        COALESCE(COUNT(DISTINCT CASE WHEN sr.is_submitted = true AND sr.updated_at >= NOW() - INTERVAL '30 days' THEN sr.submission_id END), 0) as recent_activity_30d,
        COALESCE(STDDEV(CASE WHEN sr.is_submitted = true AND sr.rating IS NOT NULL THEN sr.rating END), 0) as rating_stddev,
        COALESCE(COUNT(CASE WHEN sr.is_submitted = true AND sr.rating IS NOT NULL THEN 1 END), 0) as rating_count,
        COALESCE(AVG(CASE WHEN sr.is_submitted = true AND sr.updated_at >= NOW() - INTERVAL '7 days' AND sr.rating IS NOT NULL THEN sr.rating END), 0) as recent_avg,
        COALESCE(AVG(CASE WHEN sr.is_submitted = true AND sr.updated_at < NOW() - INTERVAL '7 days' AND sr.updated_at >= NOW() - INTERVAL '30 days' AND sr.rating IS NOT NULL THEN sr.rating END), 0) as previous_avg
      FROM users u
      LEFT JOIN submission_reviews sr ON sr.scout_id = u.id
      WHERE u.role IN ('xen_scout', 'scout_admin') AND ${searchCondition}
      GROUP BY u.id, COALESCE(u.name, 'Unnamed Scout'), u.email, u.xen_id, u.profile_pic_url, u.created_at, u.role
      ORDER BY u.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `);

    // Get total count for pagination
    const countResult = await db.execute(sql`
      SELECT COUNT(DISTINCT u.id) as count
      FROM users u
      WHERE u.role IN ('xen_scout', 'scout_admin') AND ${searchCondition}
    `);
    const count = countResult.rows[0]?.count || '0';

    // Calculate metrics for all scouts in a single pass (no additional queries)
    const scoutsWithMetrics = scouts.rows.map((scout) => {
      const stddev = parseFloat(scout.rating_stddev || '0');
      const ratingCount = parseInt(scout.rating_count || '0');
      const consistencyScore = ratingCount > 1 ? Math.max(0, 100 - (stddev * 20)) : 100;

      const recentAvg = parseFloat(scout.recent_avg || '0');
      const previousAvg = parseFloat(scout.previous_avg || '0');
      const performanceTrend = recentAvg > previousAvg ? 'improving' : recentAvg < previousAvg ? 'declining' : 'stable';

      return {
        ...scout,
        consistencyScore: Math.round(consistencyScore),
        performanceTrend,
        completionRate: scout.total_assignments > 0 ? Math.round((scout.completed_reviews / scout.total_assignments) * 100) : 0,
        qualityScore: scout.completed_reviews > 0 ? Math.round((scout.high_quality_reviews / scout.completed_reviews) * 100) : 0
      };
    });

    return {
      scouts: scoutsWithMetrics,
      pagination: {
        page,
        limit,
        total: parseInt(count),
        totalPages: Math.ceil(parseInt(count) / limit)
      }
    };
  }

  async createSampleScoutData(): Promise<any> {
    try {
      const bcrypt = require('bcrypt');
      const { randomUUID } = require('crypto');
      
      // Create sample scouts
      const sampleScouts = [
        { name: 'Alex Johnson', email: 'alex.johnson@example.com', xenId: 'XSA-25001' },
        { name: 'Sarah Chen', email: 'sarah.chen@example.com', xenId: 'XSA-25002' },
        { name: 'Mike Rodriguez', email: 'mike.rodriguez@example.com', xenId: 'XSA-25003' }
      ];

      const createdScouts = [];
      for (const scout of sampleScouts) {
        const hashedPassword = await bcrypt.hash('temp-password', 10);
        const userId = randomUUID();
        
        const user = await db.insert(users).values({
          id: userId,
          email: scout.email,
          passwordHash: hashedPassword,
          role: 'xen_scout',
          linkedId: userId,
          name: scout.name,
          xenId: scout.xenId,
          createdAt: new Date()
        }).returning();

        createdScouts.push(user[0]);
      }

      // Create sample submissions
      const sampleSubmissions = [];
      for (let i = 0; i < 10; i++) {
        const submissionId = randomUUID();
        const studentId = randomUUID(); // Mock student ID
        
        const submission = await db.insert(submissions).values({
          id: submissionId,
          studentId: studentId,
          videoUrl: `https://example.com/video-${i + 1}.mp4`,
          thumbUrl: `https://example.com/thumb-${i + 1}.jpg`,
          notes: `Sample submission ${i + 1} - $5 submission fee`,
          status: i < 6 ? 'finalized' : (i < 8 ? 'in_review' : 'rejected'),
          createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000), // Random date within last 30 days
          updatedAt: new Date()
        }).returning();

        sampleSubmissions.push(submission[0]);
      }

      // Create sample reviews
      const createdReviews = [];
      for (const submission of sampleSubmissions) {
        for (const scout of createdScouts) {
          const reviewId = randomUUID();
          const rating = Math.floor(Math.random() * 5) + 1; // Random rating 1-5
          
          const review = await db.insert(submissionReviews).values({
            id: reviewId,
            submissionId: submission.id,
            scoutId: scout.id,
            rating: rating,
            notes: `Review from ${scout.name} for submission ${submission.id}`,
            isSubmitted: true,
            createdAt: new Date(),
            updatedAt: new Date()
          }).returning();

          createdReviews.push(review[0]);
        }
      }

      return {
        scouts: createdScouts,
        submissions: sampleSubmissions,
        reviews: createdReviews,
        message: `Created ${createdScouts.length} scouts, ${sampleSubmissions.length} submissions, and ${createdReviews.length} reviews`
      };
    } catch (error) {
      console.error('Error creating sample data:', error);
      throw error;
    }
  }

  // Notification operations
  async createNotification(notification: InsertNotification): Promise<NotificationDB> {
    if (!isDbConnected) throw new Error("Database not connected");
    
    const result = await db.insert(notifications).values({
      userId: notification.userId,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      entityType: notification.entityType || null,
      entityId: notification.entityId || null,
      relatedUserId: notification.relatedUserId || null,
      metadata: notification.metadata || null,
      isRead: notification.isRead || false,
    }).returning();
    
    return result[0];
  }

  async getNotifications(userId: string, options?: { limit?: number; offset?: number; unreadOnly?: boolean }): Promise<any[]> {
    if (!isDbConnected) throw new Error("Database not connected");
    
    const limit = options?.limit || 50;
    const offset = options?.offset || 0;
    const unreadOnly = options?.unreadOnly || false;
    
    let whereCondition = eq(notifications.userId, userId);
    
    if (unreadOnly) {
      whereCondition = and(
        eq(notifications.userId, userId),
        eq(notifications.isRead, false)
      ) as any;
    }
    
    // Get notifications with related user info (for follower notifications)
    const result = await db
      .select({
        id: notifications.id,
        userId: notifications.userId,
        type: notifications.type,
        title: notifications.title,
        message: notifications.message,
        entityType: notifications.entityType,
        entityId: notifications.entityId,
        relatedUserId: notifications.relatedUserId,
        metadata: notifications.metadata,
        isRead: notifications.isRead,
        createdAt: notifications.createdAt,
        relatedUser: {
          id: users.id,
          name: users.name,
          email: users.email,
          role: users.role,
          profilePicUrl: users.profilePicUrl,
        }
      })
      .from(notifications)
      .leftJoin(users, eq(notifications.relatedUserId, users.id))
      .where(whereCondition)
      .orderBy(desc(notifications.createdAt))
      .limit(limit)
      .offset(offset);
    
    // Transform to match expected format
    return result.map(row => ({
      id: row.id,
      userId: row.userId,
      type: row.type,
      title: row.title,
      message: row.message,
      entityType: row.entityType,
      entityId: row.entityId,
      relatedUserId: row.relatedUserId,
      metadata: row.metadata,
      isRead: row.isRead,
      createdAt: row.createdAt,
      relatedUser: row.relatedUser?.id ? {
        id: row.relatedUser.id,
        name: row.relatedUser.name,
        profilePicUrl: row.relatedUser.profilePicUrl,
        role: row.relatedUser.role,
      } : null,
    }));
  }

  async markNotificationAsRead(notificationId: string, userId: string): Promise<void> {
    if (!isDbConnected) throw new Error("Database not connected");
    
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(and(
        eq(notifications.id, notificationId),
        eq(notifications.userId, userId)
      ));
  }

  async markAllNotificationsAsRead(userId: string): Promise<void> {
    if (!isDbConnected) throw new Error("Database not connected");
    
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(and(
        eq(notifications.userId, userId),
        eq(notifications.isRead, false)
      ));
  }

  async getUnreadNotificationCount(userId: string): Promise<number> {
    if (!isDbConnected) throw new Error("Database not connected");
    
    const result = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(notifications)
      .where(and(
        eq(notifications.userId, userId),
        eq(notifications.isRead, false)
      ));
    
    return Number(result[0]?.count || 0);
  }
}

// Use PostgreSQL storage for admin features
export const storage = isDbConnected ? new PostgresStorage() : new MemStorage();

// MemStorage class is already exported above

// Upload buffer helper function for profile pictures
export async function uploadBuffer(buf: Buffer, key: string): Promise<string> {
  // For development, save to local uploads directory
  if (process.env.NODE_ENV !== 'production') {
    const fs = await import('fs/promises');
    const path = await import('path');
    
    const uploadsDir = path.join(process.cwd(), 'uploads');
    await fs.mkdir(uploadsDir, { recursive: true });
    const filePath = path.join(uploadsDir, `${key}.jpg`);
    await fs.writeFile(filePath, buf);
    
    // Return local URL for development
    return `/uploads/${key}.jpg`;
  }
  
  // For production, you would integrate with your cloud storage service here
  // Example for Cloudinary, AWS S3, etc.
  throw new Error('Production upload not implemented yet');
}
