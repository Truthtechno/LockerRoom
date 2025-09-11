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
  type PostCommentWithUser,
  type SavedPost,
  type InsertSavedPost,
  type StudentFollower,
  type InsertStudentFollower,
  type SchoolApplication,
  type InsertSchoolApplication,
  type SystemSetting,
  type InsertSystemSetting,
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
  type StudentSearchResult,
  type UserProfile,
  users,
  viewers,
  schoolAdmins,
  systemAdmins,
  schools,
  students,
  posts,
  postLikes,
  postComments,
  savedPosts,
  studentFollowers,
  schoolApplications,
  systemSettings,
  adminRoles,
  analyticsLogs,
  studentRatings,
  schoolSettings
} from "@shared/schema";
import { randomUUID } from "crypto";
import bcrypt from "bcrypt";
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { eq, desc, sql, and, or, inArray } from 'drizzle-orm';

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
  deleteStudent(id: string): Promise<void>;
  searchSchoolStudents(schoolId: string, query: string): Promise<Student[]>;
  getStudentWithStats(userId: string): Promise<StudentWithStats | undefined>;
  
  // Post operations
  getPost(id: string): Promise<Post | undefined>;
  getPosts(): Promise<PostWithDetails[]>;
  getPostsByStudent(studentId: string): Promise<PostWithDetails[]>;
  createPost(post: InsertPost): Promise<Post>;
  
  // Interaction operations
  likePost(like: InsertPostLike): Promise<PostLike>;
  unlikePost(postId: string, userId: string): Promise<void>;
  commentOnPost(comment: InsertPostComment): Promise<PostComment>;
  getPostComments(postId: string): Promise<PostCommentWithUser[]>;
  savePost(save: InsertSavedPost): Promise<SavedPost>;
  unsavePost(postId: string, userId: string): Promise<void>;
  getUserSavedPosts(userId: string): Promise<PostWithDetails[]>;
  
  // Follow operations
  followStudent(follow: InsertStudentFollower): Promise<StudentFollower>;
  unfollowStudent(followerUserId: string, studentId: string): Promise<void>;
  getStudentFollowers(studentId: string): Promise<UserProfile[]>;
  getUserFollowing(userId: string): Promise<Student[]>;
  isFollowingStudent(followerUserId: string, studentId: string): Promise<boolean>;
  searchStudents(query: string, currentUserId?: string): Promise<StudentSearchResult[]>;
  
  // Stats operations
  getSchoolStats(schoolId: string): Promise<any>;
  getSystemStats(): Promise<any>;
  
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
}

export class MemStorage implements IStorage {
  private users: Map<string, User> = new Map();
  private schools: Map<string, School> = new Map();
  private students: Map<string, Student> = new Map();
  private posts: Map<string, Post> = new Map();
  private likes: Map<string, Like> = new Map();
  private comments: Map<string, Comment> = new Map();
  private saves: Map<string, Save> = new Map();
  private follows: Map<string, Follow> = new Map();
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
        this.likes.set(likeId, like);
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
        this.comments.set(commentId, comment);
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

  async getStudentWithStats(userId: string): Promise<StudentWithStats | undefined> {
    const student = await this.getStudentByUserId(userId);
    if (!student) return undefined;

    const user = await this.getUser(userId);
    if (!user) return undefined;

    const school = user.schoolId ? await this.getSchool(user.schoolId) : undefined;
    
    const studentPosts = Array.from(this.posts.values()).filter(post => post.studentId === student.id);
    const postsCount = studentPosts.length;
    
    let totalLikes = 0;
    let totalViews = 0;
    let totalSaves = 0;
    let totalComments = 0;

    studentPosts.forEach(post => {
      const postLikes = Array.from(this.likes.values()).filter(like => like.postId === post.id);
      const postComments = Array.from(this.comments.values()).filter(comment => comment.postId === post.id);
      const postSaves = Array.from(this.saves.values()).filter(save => save.postId === post.id);
      
      totalLikes += postLikes.length;
      totalComments += postComments.length;
      totalSaves += postSaves.length;
      totalViews += Math.floor(Math.random() * 1000) + 100; // Mock views
    });

    const followersCount = Array.from(this.follows.values()).filter(follow => follow.followingId === student.id).length;
    const followingCount = Array.from(this.follows.values()).filter(follow => follow.followerId === userId).length;

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
      const likes = Array.from(this.likes.values()).filter(like => like.postId === post.id);
      const comments = Array.from(this.comments.values()).filter(comment => comment.postId === post.id);
      const saves = Array.from(this.saves.values()).filter(save => save.postId === post.id);
      
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

  async likePost(insertLike: InsertLike): Promise<Like> {
    const id = randomUUID();
    const like: Like = { 
      ...insertLike, 
      id,
      createdAt: new Date()
    };
    this.likes.set(id, like);
    return like;
  }

  async unlikePost(postId: string, userId: string): Promise<void> {
    const like = Array.from(this.likes.values()).find(
      like => like.postId === postId && like.userId === userId
    );
    if (like) {
      this.likes.delete(like.id);
    }
  }

  async commentOnPost(insertComment: InsertComment): Promise<Comment> {
    const id = randomUUID();
    const comment: Comment = { 
      ...insertComment, 
      id,
      createdAt: new Date()
    };
    this.comments.set(id, comment);
    return comment;
  }

  async getPostComments(postId: string): Promise<CommentWithUser[]> {
    const comments = Array.from(this.comments.values())
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

  async savePost(insertSave: InsertSave): Promise<Save> {
    const id = randomUUID();
    const save: Save = { 
      ...insertSave, 
      id,
      createdAt: new Date()
    };
    this.saves.set(id, save);
    return save;
  }

  async unsavePost(postId: string, userId: string): Promise<void> {
    const save = Array.from(this.saves.values()).find(
      save => save.postId === postId && save.userId === userId
    );
    if (save) {
      this.saves.delete(save.id);
    }
  }

  async getUserSavedPosts(userId: string): Promise<PostWithDetails[]> {
    const savedPostIds = Array.from(this.saves.values())
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
      totalLikes += Array.from(this.likes.values()).filter(like => like.postId === post.id).length;
      totalComments += Array.from(this.comments.values()).filter(comment => comment.postId === post.id).length;
      totalSaves += Array.from(this.saves.values()).filter(save => save.postId === post.id).length;
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

  async followStudent(insertFollow: InsertFollow): Promise<Follow> {
    const id = randomUUID();
    const follow: Follow = { 
      ...insertFollow, 
      id,
      createdAt: new Date()
    };
    this.follows.set(id, follow);
    return follow;
  }

  async unfollowStudent(followerId: string, followingId: string): Promise<void> {
    const follow = Array.from(this.follows.values()).find(
      follow => follow.followerId === followerId && follow.followingId === followingId
    );
    if (follow) {
      this.follows.delete(follow.id);
    }
  }

  async getFollowers(studentId: string): Promise<User[]> {
    const followRecords = Array.from(this.follows.values()).filter(follow => follow.followingId === studentId);
    return followRecords.map(follow => this.users.get(follow.followerId)!).filter(Boolean);
  }

  async getFollowing(userId: string): Promise<Student[]> {
    const followRecords = Array.from(this.follows.values()).filter(follow => follow.followerId === userId);
    return followRecords.map(follow => 
      Array.from(this.students.values()).find(student => student.id === follow.followingId)
    ).filter(Boolean) as Student[];
  }

  async isFollowing(followerId: string, followingId: string): Promise<boolean> {
    return Array.from(this.follows.values()).some(
      follow => follow.followerId === followerId && follow.followingId === followingId
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
        const followersCount = Array.from(this.follows.values()).filter(follow => follow.followingId === student.id).length;
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
    const likes = Array.from(this.likes.values()).filter(like => like.postId === post.id);
    const comments = Array.from(this.comments.values()).filter(comment => comment.postId === post.id);
    const saves = Array.from(this.saves.values()).filter(save => save.postId === post.id);
    
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
}

// Create database connection
let db: any = null;
let isDbConnected = false;

try {
  const sql_client = neon(process.env.DATABASE_URL!);
  db = drizzle(sql_client);
  isDbConnected = true;
} catch (error) {
  console.warn('Database connection failed, falling back to memory storage:', error);
  isDbConnected = false;
}


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

  async getStudentWithStats(userId: string): Promise<StudentWithStats | undefined> {
    const student = await this.getStudentByUserId(userId);
    if (!student) return undefined;

    const user = await this.getUser(userId);
    if (!user) return undefined;

    const school = user.schoolId ? await this.getSchool(user.schoolId) : undefined;
    
    const studentPosts = await db.select().from(posts).where(eq(posts.studentId, student.id));
    const postsCount = studentPosts.length;
    
    let totalLikes = 0;
    let totalViews = 0;
    let totalSaves = 0;
    let totalComments = 0;

    for (const post of studentPosts) {
      const postLikes = await db.select().from(likes).where(eq(likes.postId, post.id));
      const postComments = await db.select().from(comments).where(eq(comments.postId, post.id));
      const postSaves = await db.select().from(saves).where(eq(saves.postId, post.id));
      
      totalLikes += postLikes.length;
      totalComments += postComments.length;
      totalSaves += postSaves.length;
      totalViews += Math.floor(Math.random() * 1000) + 100; // Mock views
    }

    return {
      ...student,
      user,
      school,
      postsCount,
      totalLikes,
      totalViews,
      totalSaves,
      totalComments,
    };
  }

  async getPost(id: string): Promise<Post | undefined> {
    const result = await db.select().from(posts).where(eq(posts.id, id)).limit(1);
    return result[0];
  }

  async getPosts(): Promise<PostWithDetails[]> {
    const allPosts = await db.select().from(posts).orderBy(desc(posts.createdAt));
    
    const postsWithDetails: PostWithDetails[] = [];
    
    for (const post of allPosts) {
      const student = await db.select().from(students).where(eq(students.id, post.studentId)).limit(1);
      if (!student[0]) continue;
      
      const user = await db.select().from(users).where(eq(users.id, student[0].userId)).limit(1);
      if (!user[0]) continue;
      
      const postLikes = await db.select().from(likes).where(eq(likes.postId, post.id));
      const postComments = await db.select().from(comments).where(eq(comments.postId, post.id));
      const postSaves = await db.select().from(saves).where(eq(saves.postId, post.id));
      
      const commentsWithUsers = [];
      for (const comment of postComments) {
        const commentUser = await db.select().from(users).where(eq(users.id, comment.userId)).limit(1);
        if (commentUser[0]) {
          commentsWithUsers.push({ ...comment, user: commentUser[0] });
        }
      }

      postsWithDetails.push({
        ...post,
        student: { ...student[0], user: user[0] },
        likes: postLikes,
        comments: commentsWithUsers,
        saves: postSaves,
        likesCount: postLikes.length,
        commentsCount: postComments.length,
        savesCount: postSaves.length,
        viewsCount: Math.floor(Math.random() * 2000) + 100,
      });
    }
    
    return postsWithDetails;
  }

  async getPostsByStudent(studentId: string): Promise<PostWithDetails[]> {
    const allPosts = await this.getPosts();
    return allPosts.filter(post => post.studentId === studentId);
  }

  async createPost(insertPost: InsertPost): Promise<Post> {
    const [post] = await db.insert(posts).values(insertPost).returning();
    return post;
  }

  async likePost(insertLike: InsertLike): Promise<Like> {
    const [like] = await db.insert(likes).values(insertLike).returning();
    return like;
  }

  async unlikePost(postId: string, userId: string): Promise<void> {
    await db.delete(likes).where(sql`${likes.postId} = ${postId} AND ${likes.userId} = ${userId}`);
  }

  async commentOnPost(insertComment: InsertComment): Promise<Comment> {
    const [comment] = await db.insert(comments).values(insertComment).returning();
    return comment;
  }

  async getPostComments(postId: string): Promise<CommentWithUser[]> {
    if (!isDbConnected) return [];
    
    // First get comments for the post
    const postComments = await db.select().from(comments)
      .where(eq(comments.postId, postId))
      .orderBy(comments.createdAt);
    
    // Then enrich each comment with user data
    const commentsWithUsers: CommentWithUser[] = [];
    for (const comment of postComments) {
      const userResult = await db.select().from(users)
        .where(eq(users.id, comment.userId))
        .limit(1);
      
      if (userResult[0]) {
        commentsWithUsers.push({
          ...comment,
          user: userResult[0]
        });
      }
    }
    
    return commentsWithUsers;
  }

  async savePost(insertSave: InsertSave): Promise<Save> {
    const [save] = await db.insert(saves).values(insertSave).returning();
    return save;
  }

  async unsavePost(postId: string, userId: string): Promise<void> {
    await db.delete(saves).where(sql`${saves.postId} = ${postId} AND ${saves.userId} = ${userId}`);
  }

  async getUserSavedPosts(userId: string): Promise<PostWithDetails[]> {
    if (!isDbConnected) return [];
    
    const userSaves = await db.select().from(saves).where(eq(saves.userId, userId));
    const savedPostIds = userSaves.map(save => save.postId);
    
    if (savedPostIds.length === 0) return [];
    
    const savedPosts = await db.select().from(posts).where(inArray(posts.id, savedPostIds));
    
    const postsWithDetails: PostWithDetails[] = [];
    
    for (const post of savedPosts) {
      const student = await db.select().from(students).where(eq(students.id, post.studentId)).limit(1);
      if (!student[0]) continue;
      
      const user = await db.select().from(users).where(eq(users.id, student[0].userId)).limit(1);
      if (!user[0]) continue;
      
      const postLikes = await db.select().from(likes).where(eq(likes.postId, post.id));
      const postComments = await db.select().from(comments).where(eq(comments.postId, post.id));
      const postSaves = await db.select().from(saves).where(eq(saves.postId, post.id));
      
      const commentsWithUsers = [];
      for (const comment of postComments) {
        const commentUser = await db.select().from(users).where(eq(users.id, comment.userId)).limit(1);
        if (commentUser[0]) {
          commentsWithUsers.push({ ...comment, user: commentUser[0] });
        }
      }

      postsWithDetails.push({
        ...post,
        student: { ...student[0], user: user[0] },
        likes: postLikes,
        comments: commentsWithUsers,
        saves: postSaves,
        likesCount: postLikes.length,
        commentsCount: postComments.length,
        savesCount: postSaves.length,
        viewsCount: Math.floor(Math.random() * 2000) + 100,
      });
    }
    
    return postsWithDetails.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getSchoolStats(schoolId: string): Promise<any> {
    const schoolStudents = await this.getStudentsBySchool(schoolId);
    const studentIds = schoolStudents.map(s => s.id);
    
    if (studentIds.length === 0) {
      return {
        totalStudents: 0,
        totalPosts: 0,
        totalEngagement: 0,
        activeSports: 0,
      };
    }
    
    const schoolPosts = await db.select().from(posts).where(inArray(posts.studentId, studentIds));
    
    let totalLikes = 0;
    let totalComments = 0;
    let totalSaves = 0;

    for (const post of schoolPosts) {
      const postLikes = await db.select().from(likes).where(eq(likes.postId, post.id));
      const postComments = await db.select().from(comments).where(eq(comments.postId, post.id));
      const postSaves = await db.select().from(saves).where(eq(saves.postId, post.id));
      
      totalLikes += postLikes.length;
      totalComments += postComments.length;
      totalSaves += postSaves.length;
    }

    return {
      totalStudents: schoolStudents.length,
      totalPosts: schoolPosts.length,
      totalEngagement: totalLikes + totalComments + totalSaves,
      activeSports: Array.from(new Set(schoolStudents.map(s => s.sport).filter(Boolean))).length,
    };
  }

  async getSystemStats(): Promise<any> {
    const allSchools = await db.select().from(schools);
    const allUsers = await db.select().from(users);
    const allPosts = await db.select().from(posts);
    
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

  async followStudent(insertFollow: InsertFollow): Promise<Follow> {
    if (!isDbConnected) throw new Error('Database not connected');
    const [follow] = await db.insert(follows).values(insertFollow).returning();
    return follow;
  }

  async unfollowStudent(followerId: string, followingId: string): Promise<void> {
    if (!isDbConnected) throw new Error('Database not connected');
    await db.delete(follows)
      .where(sql`${follows.followerId} = ${followerId} AND ${follows.followingId} = ${followingId}`);
  }

  async getFollowers(studentId: string): Promise<User[]> {
    if (!isDbConnected) throw new Error('Database not connected');
    const result = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        password: users.password,
        role: users.role,
        schoolId: users.schoolId,
        createdAt: users.createdAt,
      })
      .from(follows)
      .innerJoin(users, eq(follows.followerId, users.id))
      .where(eq(follows.followingId, studentId));
    return result;
  }

  async getFollowing(userId: string): Promise<Student[]> {
    if (!isDbConnected) throw new Error('Database not connected');
    const result = await db
      .select({
        id: students.id,
        userId: students.userId,
        roleNumber: students.roleNumber,
        dateOfBirth: students.dateOfBirth,
        position: students.position,
        sport: students.sport,
        profilePic: students.profilePic,
        bio: students.bio,
        coverPhoto: students.coverPhoto,
      })
      .from(follows)
      .innerJoin(students, eq(follows.followingId, students.id))
      .where(eq(follows.followerId, userId));
    return result;
  }

  async isFollowing(followerId: string, followingId: string): Promise<boolean> {
    if (!isDbConnected) throw new Error('Database not connected');
    const result = await db
      .select({ id: follows.id })
      .from(follows)
      .where(sql`${follows.followerId} = ${followerId} AND ${follows.followingId} = ${followingId}`)
      .limit(1);
    return result.length > 0;
  }

  async searchStudents(query: string, currentUserId?: string): Promise<StudentSearchResult[]> {
    if (!isDbConnected) throw new Error('Database not connected');
    const searchTerm = `%${query.toLowerCase()}%`;
    
    const result = await db
      .select({
        student: students,
        user: users,
        school: schools,
        followersCount: sql<number>`COUNT(${follows.id})`.as('followersCount'),
      })
      .from(students)
      .innerJoin(users, eq(students.userId, users.id))
      .leftJoin(schools, eq(users.schoolId, schools.id))
      .leftJoin(follows, eq(follows.followingId, students.id))
      .where(
        sql`LOWER(${users.name}) LIKE ${searchTerm} OR 
            LOWER(${students.sport}) LIKE ${searchTerm} OR 
            LOWER(${students.position}) LIKE ${searchTerm}`
      )
      .groupBy(students.id, users.id, schools.id)
      .orderBy(sql`COUNT(${follows.id}) DESC`);

    // Check if current user is following each student
    const resultsWithFollowStatus = await Promise.all(
      result.map(async (row) => {
        const isFollowing = currentUserId ? 
          await this.isFollowing(currentUserId, row.student.id) : false;
        
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
}

// Use PostgreSQL storage for admin features
export const storage = isDbConnected ? new PostgresStorage() : new MemStorage();

// MemStorage class is already exported above
