import { 
  type User, 
  type InsertUser, 
  type School, 
  type InsertSchool,
  type Student,
  type InsertStudent,
  type Post,
  type InsertPost,
  type Like,
  type InsertLike,
  type Comment,
  type InsertComment,
  type Save,
  type InsertSave,
  type PostWithDetails,
  type StudentWithStats,
  users,
  schools,
  students,
  posts,
  likes,
  comments,
  saves
} from "@shared/schema";
import { randomUUID } from "crypto";
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { eq, desc, sql } from 'drizzle-orm';

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, user: Partial<User>): Promise<User | undefined>;
  
  // School operations
  getSchool(id: string): Promise<School | undefined>;
  getSchools(): Promise<School[]>;
  createSchool(school: InsertSchool): Promise<School>;
  updateSchool(id: string, school: Partial<School>): Promise<School | undefined>;
  
  // Student operations
  getStudent(id: string): Promise<Student | undefined>;
  getStudentByUserId(userId: string): Promise<Student | undefined>;
  getStudentsBySchool(schoolId: string): Promise<Student[]>;
  createStudent(student: InsertStudent): Promise<Student>;
  updateStudent(id: string, student: Partial<Student>): Promise<Student | undefined>;
  getStudentWithStats(userId: string): Promise<StudentWithStats | undefined>;
  
  // Post operations
  getPost(id: string): Promise<Post | undefined>;
  getPosts(): Promise<PostWithDetails[]>;
  getPostsByStudent(studentId: string): Promise<PostWithDetails[]>;
  createPost(post: InsertPost): Promise<Post>;
  
  // Interaction operations
  likePost(like: InsertLike): Promise<Like>;
  unlikePost(postId: string, userId: string): Promise<void>;
  commentOnPost(comment: InsertComment): Promise<Comment>;
  savePost(save: InsertSave): Promise<Save>;
  unsavePost(postId: string, userId: string): Promise<void>;
  
  // Stats operations
  getSchoolStats(schoolId: string): Promise<any>;
  getSystemStats(): Promise<any>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User> = new Map();
  private schools: Map<string, School> = new Map();
  private students: Map<string, Student> = new Map();
  private posts: Map<string, Post> = new Map();
  private likes: Map<string, Like> = new Map();
  private comments: Map<string, Comment> = new Map();
  private saves: Map<string, Save> = new Map();

  constructor() {
    this.initializeDemoData();
  }

  private initializeDemoData() {
    // Create demo school
    const schoolId = randomUUID();
    const school: School = {
      id: schoolId,
      name: "Washington High School",
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
      name: "Dr. Sarah Mitchell",
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
      name: "Alex Johnson",
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
      roleNumber: "23",
      dateOfBirth: "2006-03-15",
      position: "Point Guard",
      sport: "Basketball",
      profilePic: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=400",
      bio: "🏀 Point Guard | Team Captain | State Championship 2024 bound\n📍 Washington High Eagles\n🎯 \"Hard work beats talent when talent doesn't work hard\"\n📧 Contact: alexj@whs.edu",
      coverPhoto: "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&w=1920&h=400",
    };
    this.students.set(studentId, student);

    // Create additional students for demo
    const students = [
      {
        userId: randomUUID(),
        name: "Marcus Rodriguez",
        email: "marcus@whs.edu",
        roleNumber: "15",
        sport: "Basketball",
        position: "Forward"
      },
      {
        userId: randomUUID(),
        name: "Emma Thompson",
        email: "emma@whs.edu",
        roleNumber: "7",
        sport: "Soccer",
        position: "Midfielder"
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
        profilePic: "https://images.unsplash.com/photo-1546525848-3ce03ca516f6?auto=format&fit=crop&w=400&h=400",
        bio: `${data.sport} player at Washington High School`,
        coverPhoto: "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&w=1920&h=400",
      };
      this.students.set(student.id, student);
    });
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.email === email);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { 
      ...insertUser, 
      id,
      role: insertUser.role || "viewer",
      schoolId: insertUser.schoolId || null,
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
        name: "Washington High School",
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
          name: "Dr. Sarah Mitchell",
          email: "school@lockerroom.com",
          password: "School123!",
          role: "school_admin",
          schoolId: school.id,
        },
        {
          name: "Alex Johnson",
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
        roleNumber: "23",
        dateOfBirth: "2006-03-15",
        position: "Point Guard",
        sport: "Basketball",
        profilePic: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=400",
        bio: "🏀 Point Guard | Team Captain | State Championship 2024 bound\n📍 Washington High Eagles\n🎯 \"Hard work beats talent when talent doesn't work hard\"\n📧 Contact: alexj@whs.edu",
        coverPhoto: "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&w=1920&h=400",
      });

      // Create additional demo students
      const additionalUsers = [
        {
          name: "Marcus Rodriguez",
          email: "marcus@whs.edu",
          password: "Demo123!",
          role: "student",
          schoolId: school.id,
        },
        {
          name: "Emma Thompson",
          email: "emma@whs.edu",
          password: "Demo123!",
          role: "student",
          schoolId: school.id,
        },
      ];

      const additionalCreatedUsers = await db.insert(users).values(additionalUsers).returning();
      
      const additionalStudents = [
        {
          userId: additionalCreatedUsers[0].id,
          roleNumber: "15",
          dateOfBirth: "2006-01-01",
          position: "Forward",
          sport: "Basketball",
          profilePic: "https://images.unsplash.com/photo-1546525848-3ce03ca516f6?auto=format&fit=crop&w=400&h=400",
          bio: "Basketball player at Washington High School",
          coverPhoto: "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&w=1920&h=400",
        },
        {
          userId: additionalCreatedUsers[1].id,
          roleNumber: "7",
          dateOfBirth: "2006-01-01",
          position: "Midfielder",
          sport: "Soccer",
          profilePic: "https://images.unsplash.com/photo-1546525848-3ce03ca516f6?auto=format&fit=crop&w=400&h=400",
          bio: "Soccer player at Washington High School",
          coverPhoto: "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&w=1920&h=400",
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
    const [user] = await db.insert(users).values(insertUser).returning();
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
    const schoolUsers = await db.select().from(users).where(eq(users.schoolId, schoolId));
    const userIds = schoolUsers.map(u => u.id);
    if (userIds.length === 0) return [];
    
    const result = await db.select().from(students).where(sql`${students.userId} = ANY(${userIds})`);
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

  async savePost(insertSave: InsertSave): Promise<Save> {
    const [save] = await db.insert(saves).values(insertSave).returning();
    return save;
  }

  async unsavePost(postId: string, userId: string): Promise<void> {
    await db.delete(saves).where(sql`${saves.postId} = ${postId} AND ${saves.userId} = ${userId}`);
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
    
    const schoolPosts = await db.select().from(posts).where(sql`${posts.studentId} = ANY(${studentIds})`);
    
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
}

// Use memory storage for now due to connection issues
// TODO: Switch to PostgreSQL when database connection is stable
export const storage = new MemStorage();

// MemStorage class is already exported above
