#!/usr/bin/env tsx

/**
 * Demo Data Injection Script for LockerRoom
 * 
 * This script populates the database with comprehensive demo data for development and testing.
 * 
 * Usage:
 * npm run demo-data
 * or
 * tsx scripts/inject-demo-data.ts
 */

import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { config } from 'dotenv';
import { 
  users, schools, students, posts, postLikes, postComments, savedPosts, studentFollowers,
  type User, type School, type Student, type Post,
  type InsertUser, type InsertSchool, type InsertStudent, type InsertPost,
  type InsertPostLike, type InsertPostComment, type InsertSavedPost, type InsertStudentFollower
} from '../shared/schema';
import bcrypt from 'bcrypt';

// Load environment variables
config();

// Initialize database connection
const sql_client = neon(process.env.DATABASE_URL!);
const db = drizzle(sql_client);

const DEMO_SCHOOLS = [
  {
    name: "Elite Soccer Academy",
    subscriptionPlan: "premium" as const,
    maxStudents: 500
  },
  {
    name: "Champions Football Club",
    subscriptionPlan: "standard" as const,
    maxStudents: 200
  },
  {
    name: "Rising Stars Academy",
    subscriptionPlan: "premium" as const,
    maxStudents: 300
  }
];

const DEMO_USERS = [
  // System Admin
  {
    name: "James Wilson",
    email: "admin@lockerroom.com",
    password: "Admin123!",
    role: "system_admin" as const,
    schoolId: null
  },
  // School Admins
  {
    name: "Coach Maria Santos",
    email: "school@lockerroom.com", 
    password: "School123!",
    role: "school_admin" as const,
    schoolId: null // Will be set to first school
  },
  {
    name: "Coach David Johnson",
    email: "coach.johnson@champions.edu",
    password: "School123!",
    role: "school_admin" as const,
    schoolId: null // Will be set to second school
  },
  // Students
  {
    name: "Diego Rodriguez",
    email: "student@lockerroom.com",
    password: "Student123!",
    role: "student" as const,
    schoolId: null
  },
  {
    name: "Sofia Martinez",
    email: "sofia@elitesoccer.edu",
    password: "Demo123!",
    role: "student" as const,
    schoolId: null
  },
  {
    name: "Lucas Silva",
    email: "lucas@elitesoccer.edu", 
    password: "Demo123!",
    role: "student" as const,
    schoolId: null
  },
  {
    name: "Emma Thompson",
    email: "emma@champions.edu",
    password: "Demo123!",
    role: "student" as const,
    schoolId: null
  },
  {
    name: "Alex Kim",
    email: "alex@risingstars.edu",
    password: "Demo123!",
    role: "student" as const,
    schoolId: null
  },
  {
    name: "Marcus Johnson",
    email: "marcus@elitesoccer.edu",
    password: "Demo123!",
    role: "student" as const,
    schoolId: null
  },
  // Viewers
  {
    name: "John Viewer",
    email: "viewer@lockerroom.com",
    password: "Viewer123!",
    role: "viewer" as const,
    schoolId: null
  },
  {
    name: "Sarah Williams",
    email: "sarah.williams@gmail.com",
    password: "Viewer123!",
    role: "viewer" as const,
    schoolId: null
  },
  {
    name: "Mike Chen",
    email: "mike.chen@gmail.com",
    password: "Viewer123!",
    role: "viewer" as const,
    schoolId: null
  },
  {
    name: "Lisa Brown",
    email: "lisa.brown@gmail.com",
    password: "Viewer123!",
    role: "viewer" as const,
    schoolId: null
  }
];

const DEMO_STUDENTS = [
  {
    name: "Diego Rodriguez",
    email: "diego@elitesoccer.edu",
    phone: "+1 (555) 123-4567",
    gender: "male",
    dateOfBirth: "2006-03-15",
    grade: "11th Grade",
    guardianContact: "Carlos Rodriguez: +1 (555) 123-4568",
    roleNumber: "10",
    position: "Attacking Midfielder",
    sport: "Soccer",
    profilePic: "https://images.unsplash.com/photo-1594736797933-d0281ba35a95?auto=format&fit=crop&w=400&h=400",
    bio: "⚽ Attacking Midfielder | Team Captain | Regional Champions 2024\n📍 Elite Soccer Academy\n🎯 \"Skill and passion combined create magic\"\n📧 Contact: diego@elitesoccer.edu",
    coverPhoto: "https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=1920&h=400"
  },
  {
    name: "Sofia Martinez",
    email: "sofia@elitesoccer.edu",
    phone: "+1 (555) 234-5678",
    gender: "female",
    dateOfBirth: "2007-07-22",
    grade: "10th Grade", 
    guardianContact: "Ana Martinez: +1 (555) 234-5679",
    roleNumber: "7",
    position: "Winger",
    sport: "Soccer",
    profilePic: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=400&h=400",
    bio: "🏃‍♀️ Right Winger | Speed & Precision | State Champions 2023\n📍 Elite Soccer Academy\n⚡ \"Fast feet, faster goals\"\n📧 Contact: sofia@elitesoccer.edu"
  },
  {
    name: "Lucas Silva",
    email: "lucas@elitesoccer.edu",
    phone: "+1 (555) 345-6789",
    gender: "male",
    dateOfBirth: "2006-11-08",
    grade: "11th Grade",
    guardianContact: "Roberto Silva: +1 (555) 345-6790",
    roleNumber: "1",
    position: "Goalkeeper",
    sport: "Soccer", 
    profilePic: "https://images.unsplash.com/photo-1552374196-c4e7ffc6e126?auto=format&fit=crop&w=400&h=400",
    bio: "🥅 Goalkeeper | Last Line of Defense | All-State 2024\n📍 Elite Soccer Academy\n🧤 \"Nothing gets past these hands\"\n📧 Contact: lucas@elitesoccer.edu"
  },
  {
    name: "Emma Thompson",
    email: "emma@champions.edu",
    phone: "+1 (555) 456-7890",
    gender: "female",
    dateOfBirth: "2007-01-12",
    grade: "10th Grade",
    guardianContact: "Jenny Thompson: +1 (555) 456-7891",
    roleNumber: "9",
    position: "Striker",
    sport: "Soccer",
    profilePic: "https://images.unsplash.com/photo-1494790108755-2616c36278ec?auto=format&fit=crop&w=400&h=400",
    bio: "⚽ Striker | Goal Machine | Leading Scorer 2024\n📍 Champions Football Club\n🎯 \"Every shot has a purpose\"\n📧 Contact: emma@champions.edu"
  },
  {
    name: "Alex Kim",
    email: "alex@risingstars.edu", 
    phone: "+1 (555) 567-8901",
    gender: "male",
    dateOfBirth: "2006-09-30",
    grade: "11th Grade",
    guardianContact: "Susan Kim: +1 (555) 567-8902",
    roleNumber: "8",
    position: "Central Midfielder",
    sport: "Soccer",
    profilePic: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&h=400",
    bio: "⚽ Central Midfielder | Playmaker | Academy MVP 2024\n📍 Rising Stars Academy\n🎯 \"Vision creates opportunities\"\n📧 Contact: alex@risingstars.edu"
  },
  {
    name: "Marcus Johnson",
    email: "marcus@elitesoccer.edu",
    phone: "+1 (555) 678-9012",
    gender: "male", 
    dateOfBirth: "2007-04-18",
    grade: "10th Grade",
    guardianContact: "Michael Johnson: +1 (555) 678-9013",
    roleNumber: "3",
    position: "Defender",
    sport: "Soccer",
    profilePic: "https://images.unsplash.com/photo-1546525848-3ce03ca516f6?auto=format&fit=crop&w=400&h=400",
    bio: "🛡️ Center Back | Defensive Wall | Rookie of the Year 2024\n📍 Elite Soccer Academy\n💪 \"Defense wins championships\"\n📧 Contact: marcus@elitesoccer.edu"
  }
];

const DEMO_POSTS = [
  {
    mediaUrl: "https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=800&h=600",
    mediaType: "image",
    caption: "Training hard for the upcoming championship! The team chemistry is incredible this season. 💪⚽ #EliteSoccer #Training #TeamWork"
  },
  {
    mediaUrl: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?auto=format&fit=crop&w=800&h=600", 
    mediaType: "image",
    caption: "Game day vibes! Ready to give everything on the field. Let's show them what Elite Soccer Academy is made of! 🔥 #GameDay #Ready"
  },
  {
    mediaUrl: "https://images.unsplash.com/photo-1553778263-73a83bab9b0c?auto=format&fit=crop&w=800&h=600",
    mediaType: "image",
    caption: "Beautiful goal from yesterday's match! This is why I love playing midfielder - setting up the perfect play! ⚽️✨ #Goal #Teamwork"
  },
  {
    mediaUrl: "https://images.unsplash.com/photo-1575361204480-aadea25e6e68?auto=format&fit=crop&w=800&h=600",
    mediaType: "image", 
    caption: "Speed training session complete! Working on those explosive runs down the wing 🏃‍♀️💨 #SpeedTraining #Wing #FastFeet"
  },
  {
    mediaUrl: "https://images.unsplash.com/photo-1551698618-1dfe5d97d256?auto=format&fit=crop&w=800&h=600",
    mediaType: "image",
    caption: "Another clean sheet! 🥅 Keeping the goal safe is what I do best. Team defense was amazing today! #CleanSheet #Goalkeeper #Defense"
  },
  {
    mediaUrl: "https://images.unsplash.com/photo-1518604666860-f20c3092c299?auto=format&fit=crop&w=800&h=600",
    mediaType: "image",
    caption: "Hat trick today! ⚽⚽⚽ Nothing beats the feeling of finding the back of the net. Thank you team for the amazing assists! #HatTrick #Striker"
  }
];

const DEMO_COMMENTS = [
  "Amazing performance! Keep up the great work! 🔥",
  "Incredible skill! You're inspiring the next generation ⚽",
  "What a goal! That technique was perfect 👏",
  "Training paying off! Can't wait to see you in the championship 💪",
  "Outstanding teamwork! This is what soccer is all about 🙌",
  "Your dedication is showing! Keep pushing forward 🚀",
  "Fantastic save! Best goalkeeper in the league 🥅",
  "That speed is unreal! Nobody can catch you 💨",
  "Perfect positioning! Your game IQ is next level 🧠",
  "Champions in the making! So proud of this team 🏆"
];

async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, 12); // Match auth storage salt rounds
}

async function clearDatabase() {
  console.log('🗑️  Clearing existing data...');
  
  // Clear in reverse dependency order
  await db.delete(studentFollowers);
  await db.delete(savedPosts);
  await db.delete(postComments);
  await db.delete(postLikes);
  await db.delete(posts);
  await db.delete(students);
  await db.delete(users);
  await db.delete(schools);
  
  console.log('✅ Database cleared');
}

async function createSchools(): Promise<School[]> {
  console.log('🏫 Creating schools...');
  
  const createdSchools = await db.insert(schools).values(DEMO_SCHOOLS as InsertSchool[]).returning();
  
  console.log(`✅ Created ${createdSchools.length} schools`);
  return createdSchools;
}

async function createUsers(schoolList: School[]): Promise<User[]> {
  console.log('👥 Creating users...');
  
  // Hash all passwords and map to correct schema fields
  const usersWithHashedPasswords = await Promise.all(
    DEMO_USERS.map(async (user, index) => ({
      name: user.name,
      email: user.email,
      passwordHash: await hashPassword(user.password),
      role: user.role,
      linkedId: '', // Will be set after creating role-specific profiles
      schoolId: user.role === "school_admin" 
        ? schoolList[index < 2 ? index : 0]?.id || null
        : user.role === "student" 
        ? schoolList[index % schoolList.length]?.id || null
        : null
    }))
  );
  
  const createdUsers = await db.insert(users).values(usersWithHashedPasswords as InsertUser[]).returning();
  
  console.log(`✅ Created ${createdUsers.length} users`);
  return createdUsers;
}

async function createStudents(userList: User[], schoolList: School[]): Promise<Student[]> {
  console.log('🎓 Creating student profiles...');
  
  const studentUsers = userList.filter(user => user.role === "student");
  
  const studentsData = DEMO_STUDENTS.map((studentTemplate, index) => {
    const user = studentUsers[index];
    if (!user) return null;
    
    return {
      ...studentTemplate,
      userId: user.id,
      schoolId: user.schoolId!
    };
  }).filter(Boolean);
  
  const createdStudents = await db.insert(students).values(studentsData as InsertStudent[]).returning();
  
  console.log(`✅ Created ${createdStudents.length} student profiles`);
  return createdStudents;
}

async function createPosts(studentList: Student[]): Promise<Post[]> {
  console.log('📝 Creating posts...');
  
  const postsData = [];
  
  // Create multiple posts per student
  for (let i = 0; i < studentList.length; i++) {
    const student = studentList[i];
    const numPosts = Math.floor(Math.random() * 3) + 2; // 2-4 posts per student
    
    for (let j = 0; j < numPosts && j < DEMO_POSTS.length; j++) {
      const postTemplate = DEMO_POSTS[(i * numPosts + j) % DEMO_POSTS.length];
      postsData.push({
        ...postTemplate,
        studentId: student.id
      });
    }
  }
  
  const createdPosts = await db.insert(posts).values(postsData as InsertPost[]).returning();
  
  console.log(`✅ Created ${createdPosts.length} posts`);
  return createdPosts;
}

async function createInteractions(userList: User[], postList: Post[], studentList: Student[]) {
  console.log('💝 Creating interactions (likes, comments, saves, follows)...');
  
  const viewerUsers = userList.filter(user => user.role === "viewer");
  const studentUsers = userList.filter(user => user.role === "student");
  const allInteractingUsers = [...viewerUsers, ...studentUsers];
  
  // Create likes
  const likesData = [];
  for (const post of postList) {
    const numLikes = Math.floor(Math.random() * 8) + 3; // 3-10 likes per post
    const shuffledUsers = [...allInteractingUsers].sort(() => Math.random() - 0.5);
    
    for (let i = 0; i < numLikes && i < shuffledUsers.length; i++) {
      likesData.push({
        postId: post.id,
        userId: shuffledUsers[i].id
      });
    }
  }
  
  await db.insert(postLikes).values(likesData as InsertPostLike[]);
  
  // Create comments
  const commentsData = [];
  for (const post of postList) {
    const numComments = Math.floor(Math.random() * 5) + 1; // 1-5 comments per post
    const shuffledUsers = [...allInteractingUsers].sort(() => Math.random() - 0.5);
    
    for (let i = 0; i < numComments && i < shuffledUsers.length; i++) {
      const randomComment = DEMO_COMMENTS[Math.floor(Math.random() * DEMO_COMMENTS.length)];
      commentsData.push({
        postId: post.id,
        userId: shuffledUsers[i].id,
        content: randomComment
      });
    }
  }
  
  await db.insert(postComments).values(commentsData as InsertPostComment[]);
  
  // Create saves
  const savesData = [];
  for (const user of viewerUsers) {
    const numSaves = Math.floor(Math.random() * 5) + 1; // 1-5 saves per viewer
    const shuffledPosts = [...postList].sort(() => Math.random() - 0.5);
    
    for (let i = 0; i < numSaves && i < shuffledPosts.length; i++) {
      savesData.push({
        postId: shuffledPosts[i].id,
        userId: user.id
      });
    }
  }
  
  await db.insert(savedPosts).values(savesData as InsertSavedPost[]);
  
  // Create follows  
  const followsData = [];
  for (const viewer of viewerUsers) {
    const numFollows = Math.floor(Math.random() * 4) + 2; // 2-5 follows per viewer
    const shuffledStudents = [...studentList].sort(() => Math.random() - 0.5);
    
    for (let i = 0; i < numFollows && i < shuffledStudents.length; i++) {
      followsData.push({
        followerUserId: viewer.id,
        studentId: shuffledStudents[i].id
      });
    }
  }
  
  await db.insert(studentFollowers).values(followsData as InsertStudentFollower[]);
  
  console.log(`✅ Created interactions: ${likesData.length} likes, ${commentsData.length} comments, ${savesData.length} saves, ${followsData.length} follows`);
}

async function main() {
  try {
    console.log('🚀 Starting demo data injection...\n');
    
    // Clear existing data
    await clearDatabase();
    
    // Create data in dependency order
    const schoolList = await createSchools();
    const userList = await createUsers(schoolList);
    const studentList = await createStudents(userList, schoolList);
    const postList = await createPosts(studentList);
    await createInteractions(userList, postList, studentList);
    
    console.log('\n🎉 Demo data injection completed successfully!');
    console.log('\n📋 Demo Account Credentials:');
    console.log('System Admin: admin@lockerroom.com / Admin123!');
    console.log('School Admin: school@lockerroom.com / School123!');
    console.log('Student: student@lockerroom.com / Student123!');
    console.log('Viewer: viewer@lockerroom.com / Viewer123!');
    console.log('\n🌟 Additional accounts available with password Demo123! or Viewer123!');
    
  } catch (error) {
    console.error('❌ Error injecting demo data:', error);
    process.exit(1);
  }
}

// Run the script if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().then(() => process.exit(0));
}

export { main as injectDemoData };