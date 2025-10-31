import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { eq, count } from 'drizzle-orm';
import { 
  users, 
  viewers, 
  students, 
  schoolAdmins, 
  systemAdmins,
  schools,
  posts,
  postLikes,
  postComments,
  savedPosts,
  studentFollowers
} from '@shared/schema';

const connectionString = process.env.DATABASE_URL || '';
const sql = neon(connectionString);
const db = drizzle(sql);

export class DatabaseVerification {
  async verifyUserSignup(userId: string, email: string, role: string) {
    // Check user exists
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    expect(user).toBeDefined();
    expect(user.email).toBe(email);
    expect(user.role).toBe(role);
    
    // Check role-specific profile exists
    if (role === 'viewer') {
      const [viewer] = await db.select().from(viewers).where(eq(viewers.id, user.linkedId));
      expect(viewer).toBeDefined();
    } else if (role === 'student') {
      const [student] = await db.select().from(students).where(eq(students.id, user.linkedId));
      expect(student).toBeDefined();
    } else if (role === 'school_admin') {
      const [schoolAdmin] = await db.select().from(schoolAdmins).where(eq(schoolAdmins.id, user.linkedId));
      expect(schoolAdmin).toBeDefined();
    } else if (role === 'system_admin') {
      const [systemAdmin] = await db.select().from(systemAdmins).where(eq(systemAdmins.id, user.linkedId));
      expect(systemAdmin).toBeDefined();
    }
  }

  async verifyFollow(followerId: string, followingId: string) {
    const [follow] = await db.select()
      .from(studentFollowers)
      .where(eq(studentFollowers.followerId, followerId) && eq(studentFollowers.followingId, followingId));
    
    expect(follow).toBeDefined();
  }

  async verifyUnfollow(followerId: string, followingId: string) {
    const [follow] = await db.select()
      .from(studentFollowers)
      .where(eq(studentFollowers.followerId, followerId) && eq(studentFollowers.followingId, followingId));
    
    expect(follow).toBeUndefined();
  }

  async verifySavePost(userId: string, postId: string) {
    const [save] = await db.select()
      .from(savedPosts)
      .where(eq(savedPosts.userId, userId) && eq(savedPosts.postId, postId));
    
    expect(save).toBeDefined();
  }

  async verifyUnsavePost(userId: string, postId: string) {
    const [save] = await db.select()
      .from(savedPosts)
      .where(eq(savedPosts.userId, userId) && eq(savedPosts.postId, postId));
    
    expect(save).toBeUndefined();
  }

  async verifyComment(userId: string, postId: string, content: string) {
    const [comment] = await db.select()
      .from(postComments)
      .where(eq(postComments.userId, userId) && eq(postComments.postId, postId) && eq(postComments.content, content));
    
    expect(comment).toBeDefined();
  }

  async verifyLikePost(userId: string, postId: string) {
    const [like] = await db.select()
      .from(postLikes)
      .where(eq(postLikes.userId, userId) && eq(postLikes.postId, postId));
    
    expect(like).toBeDefined();
  }

  async verifyUnlikePost(userId: string, postId: string) {
    const [like] = await db.select()
      .from(postLikes)
      .where(eq(postLikes.userId, userId) && eq(postLikes.postId, postId));
    
    expect(like).toBeUndefined();
  }

  async verifyStudentAdded(studentId: string, schoolId: string, email: string) {
    // Check student exists
    const [student] = await db.select().from(students).where(eq(students.id, studentId));
    expect(student).toBeDefined();
    expect(student.schoolId).toBe(schoolId);
    
    // Check user exists with correct email
    const [user] = await db.select().from(users).where(eq(users.email, email));
    expect(user).toBeDefined();
    expect(user.role).toBe('student');
    expect(user.linkedId).toBe(studentId);
  }

  async verifyPostCreated(postId: string, studentId: string, caption: string) {
    const [post] = await db.select().from(posts).where(eq(posts.id, postId));
    expect(post).toBeDefined();
    expect(post.studentId).toBe(studentId);
    expect(post.caption).toBe(caption);
  }

  async getCounts() {
    const [
      usersCount,
      viewersCount,
      studentsCount,
      schoolAdminsCount,
      systemAdminsCount,
      schoolsCount,
      postsCount,
      likesCount,
      commentsCount,
      savesCount,
      followsCount
    ] = await Promise.all([
      db.select({ count: count() }).from(users),
      db.select({ count: count() }).from(viewers),
      db.select({ count: count() }).from(students),
      db.select({ count: count() }).from(schoolAdmins),
      db.select({ count: count() }).from(systemAdmins),
      db.select({ count: count() }).from(schools),
      db.select({ count: count() }).from(posts),
      db.select({ count: count() }).from(postLikes),
      db.select({ count: count() }).from(postComments),
      db.select({ count: count() }).from(savedPosts),
      db.select({ count: count() }).from(studentFollowers)
    ]);

    return {
      users: usersCount[0].count,
      viewers: viewersCount[0].count,
      students: studentsCount[0].count,
      schoolAdmins: schoolAdminsCount[0].count,
      systemAdmins: systemAdminsCount[0].count,
      schools: schoolsCount[0].count,
      posts: postsCount[0].count,
      likes: likesCount[0].count,
      comments: commentsCount[0].count,
      saves: savesCount[0].count,
      follows: followsCount[0].count
    };
  }

  async verifyAnalyticsMatch(expectedCounts: Partial<Record<string, number>>) {
    const actualCounts = await this.getCounts();
    
    for (const [key, expectedCount] of Object.entries(expectedCounts)) {
      if (expectedCount !== undefined) {
        expect(actualCounts[key as keyof typeof actualCounts]).toBe(expectedCount);
      }
    }
  }
}

export const dbVerification = new DatabaseVerification();
