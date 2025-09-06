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
  type StudentWithStats
} from "@shared/schema";
import { randomUUID } from "crypto";

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
    const student: Student = { ...insertStudent, id };
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
      activeSports: [...new Set(schoolStudents.map(s => s.sport).filter(Boolean))].length,
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

export const storage = new MemStorage();
