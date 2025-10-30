import bcrypt from "bcrypt";
import "dotenv/config";
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
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
  studentFollowers,
  type InsertUser,
  type InsertViewer,
  type InsertStudent,
  type InsertSchoolAdmin,
  type InsertSystemAdmin,
  type InsertSchool,
  type InsertPost,
  type InsertPostLike,
  type InsertPostComment,
  type InsertSavedPost,
  type InsertStudentFollower
} from "@shared/schema";
import { eq } from "drizzle-orm";

if (!process.env.DATABASE_URL) {
  throw new Error("❌ DATABASE_URL not set. Please define it in your .env");
}

const sql = neon(process.env.DATABASE_URL);
const db = drizzle(sql);

// Demo data arrays
const demoSchools = [
  {
    name: "Lincoln High School",
    subscriptionPlan: "premium",
    maxStudents: 200
  },
  {
    name: "Roosevelt Academy", 
    subscriptionPlan: "standard",
    maxStudents: 100
  }
];

const demoPosts = [
  {
    caption: "Great training session today! 💪⚽",
    mediaType: "image",
    mediaUrl: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=800"
  },
  {
    caption: "Victory celebration after winning the championship! 🏆",
    mediaType: "image", 
    mediaUrl: "https://images.unsplash.com/photo-1579952363873-27d3bfad9c0d?w=800"
  },
  {
    caption: "Morning workout routine - staying strong! 💯",
    mediaType: "video",
    mediaUrl: "https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_1mb.mp4"
  },
  {
    caption: "Team building activities with my squad ⚽👥",
    mediaType: "image",
    mediaUrl: "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800"
  },
  {
    caption: "Game highlights from last night's match! 🔥",
    mediaType: "video",
    mediaUrl: "https://sample-videos.com/zip/10/mp4/SampleVideo_640x360_1mb.mp4"
  },
  {
    caption: "New cleats arrived - ready for the season! 👟",
    mediaType: "image",
    mediaUrl: "https://images.unsplash.com/photo-1508089449237-3d32cb88c1e0?w=800"
  },
  {
    caption: "Recovery day stretching session 🧘‍♂️",
    mediaType: "image",
    mediaUrl: "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=800"
  },
  {
    caption: "Penalty practice - precision is key! ⚽🎯",
    mediaType: "video",
    mediaUrl: "https://sample-videos.com/zip/10/mp4/SampleVideo_720x480_1mb.mp4"
  },
  {
    caption: "Pre-game motivation with the team 💪",
    mediaType: "image",
    mediaUrl: "https://images.unsplash.com/photo-1606868306217-dbf5046868d2?w=800"
  },
  {
    caption: "Skills training - always improving! 📈⚽",
    mediaType: "image",
    mediaUrl: "https://images.unsplash.com/photo-1551698618-1dfe5d97d256?w=800"
  }
];

async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, 12);
}

async function reseedDemo() {
  try {
    console.log("🌱 Starting safe demo data reseeding...");
    console.log("⚠️  WARNING: This will only add demo accounts if they don't exist. Existing data will be preserved.");

    // Check if demo data already exists
    const existingDemoUsers = await db.select().from(users).where(eq(users.email, "admin@lockerroom.com"));
    if (existingDemoUsers.length > 0) {
      console.log("✅ Demo data already exists. Skipping reseed to preserve existing data.");
      console.log("🔑 Existing demo accounts:");
      console.log(`   System Admin: admin@lockerroom.com / admin123`);
      console.log(`   School Admin: principal@lincoln.edu / principal123`);
      return;
    }

    console.log("📝 No existing demo data found. Creating demo accounts...");

    // Create schools
    console.log("🏫 Creating demo schools...");
    const createdSchools = await db.insert(schools).values(demoSchools).returning();
    const school1 = createdSchools[0];
    const school2 = createdSchools[1];

    // Create system admin
    console.log("👑 Creating system admin...");
    const systemAdminData = {
      name: "System Administrator",
      profilePicUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200",
      bio: "System administrator managing the LockerRoom platform.",
      phone: "555-0001",
      permissions: ["manage_schools", "manage_users", "view_analytics"]
    };
    
    const [systemAdminProfile] = await db.insert(systemAdmins).values(systemAdminData).returning();
    const [systemAdminUser] = await db.insert(users).values({
      email: "admin@lockerroom.com",
      passwordHash: await hashPassword("admin123"),
      role: "system_admin",
      linkedId: systemAdminProfile.id
    } as InsertUser).returning();

    // Create school admin
    console.log("🎓 Creating school admin...");
    const schoolAdminData = {
      name: "Principal Johnson",
      schoolId: school1.id,
      profilePicUrl: "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=200",
      bio: "Principal at Lincoln High School, passionate about student athletics.",
      phone: "555-0002",
      position: "Principal"
    };
    
    const [schoolAdminProfile] = await db.insert(schoolAdmins).values(schoolAdminData).returning();
    const [schoolAdminUser] = await db.insert(users).values({
      email: "principal@lincoln.edu",
      passwordHash: await hashPassword("principal123"),
      role: "school_admin",
      linkedId: schoolAdminProfile.id
    } as InsertUser).returning();

    // Create students
    console.log("⚽ Creating demo students...");
    const studentDataList = [
      {
        schoolId: school1.id,
        name: "Marcus Rodriguez",
        phone: "555-1001",
        gender: "male",
        dateOfBirth: "2005-03-15",
        grade: "11th Grade",
        guardianContact: "555-1000",
        profilePicUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200",
        roleNumber: "10",
        position: "Midfielder",
        sport: "Soccer",
        bio: "Team captain and midfielder. Love creating opportunities for my teammates!"
      },
      {
        schoolId: school1.id,
        name: "Sophia Chen",
        phone: "555-1002",
        gender: "female", 
        dateOfBirth: "2006-07-22",
        grade: "10th Grade",
        guardianContact: "555-1003",
        profilePicUrl: "https://images.unsplash.com/photo-1494790108755-2616b332c437?w=200",
        roleNumber: "7",
        position: "Forward",
        sport: "Soccer",
        bio: "Fast striker with a keen eye for goal. Always ready for the next challenge!"
      },
      {
        schoolId: school2.id,
        name: "Jordan Williams",
        phone: "555-1004",
        gender: "male",
        dateOfBirth: "2005-11-08", 
        grade: "12th Grade",
        guardianContact: "555-1005",
        profilePicUrl: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=200",
        roleNumber: "1",
        position: "Goalkeeper",
        sport: "Soccer",
        bio: "Reliable goalkeeper with lightning reflexes. The last line of defense!"
      }
    ];

    const createdStudents = [];
    const studentUsers = [];

    for (const studentData of studentDataList) {
      // Create user first
      const [studentUser] = await db.insert(users).values({
        email: `${studentData.name.toLowerCase().replace(' ', '.')}@student.com`,
        passwordHash: await hashPassword("student123"),
        role: "student",
        linkedId: "temp" // Will be updated after student creation
      } as InsertUser).returning();
      
      // Create student profile with userId
      const [studentProfile] = await db.insert(students).values({
        ...studentData,
        userId: studentUser.id
      }).returning();
      
      // Update user with correct linkedId
      await db.update(users).set({ linkedId: studentProfile.id }).where(eq(users.id, studentUser.id));
      
      createdStudents.push(studentProfile);
      studentUsers.push(studentUser);
    }

    // Create viewers  
    console.log("👀 Creating demo viewers...");
    const viewerDataList = [
      {
        name: "Sarah Johnson",
        profilePicUrl: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200", 
        bio: "Proud parent following my daughter's soccer journey!",
        phone: "555-2001"
      },
      {
        name: "Mike Thompson", 
        profilePicUrl: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200",
        bio: "Local sports enthusiast and team supporter.",
        phone: "555-2002"
      }
    ];

    const createdViewers = [];
    const viewerUsers = [];

    for (const viewerData of viewerDataList) {
      const [viewerProfile] = await db.insert(viewers).values(viewerData).returning();
      const [viewerUser] = await db.insert(users).values({
        email: `${viewerData.name.toLowerCase().replace(' ', '.')}@viewer.com`, 
        passwordHash: await hashPassword("viewer123"),
        role: "viewer",
        linkedId: viewerProfile.id
      } as InsertUser).returning();
      
      createdViewers.push(viewerProfile);
      viewerUsers.push(viewerUser);
    }

    // Create posts
    console.log("📱 Creating demo posts...");
    const createdPosts = [];
    
    for (let i = 0; i < demoPosts.length; i++) {
      const postData = {
        ...demoPosts[i],
        studentId: createdStudents[i % createdStudents.length].id
      };
      
      const [post] = await db.insert(posts).values(postData as InsertPost).returning();
      createdPosts.push(post);
    }

    // Create likes
    console.log("❤️ Creating demo likes...");
    const likesData: InsertPostLike[] = [];
    
    // Each student likes some random posts
    for (const student of createdStudents) {
      for (const studentUser of studentUsers) {
        if (studentUser.linkedId === student.id) {
          // This student likes 3-5 random posts
          const numLikes = 3 + Math.floor(Math.random() * 3);
          const shuffledPosts = [...createdPosts].sort(() => 0.5 - Math.random());
          
          for (let i = 0; i < numLikes && i < shuffledPosts.length; i++) {
            likesData.push({
              postId: shuffledPosts[i].id,
              userId: studentUser.id
            });
          }
          break;
        }
      }
    }
    
    // Viewers also like posts
    for (const viewerUser of viewerUsers) {
      const numLikes = 2 + Math.floor(Math.random() * 4);
      const shuffledPosts = [...createdPosts].sort(() => 0.5 - Math.random());
      
      for (let i = 0; i < numLikes && i < shuffledPosts.length; i++) {
        likesData.push({
          postId: shuffledPosts[i].id,
          userId: viewerUser.id
        });
      }
    }
    
    if (likesData.length > 0) {
      await db.insert(postLikes).values(likesData);
    }

    // Create comments
    console.log("💬 Creating demo comments...");
    const commentsData: InsertPostComment[] = [];
    const commentTexts = [
      "Great shot! 🔥",
      "Amazing skills! Keep it up!",
      "Inspirational work! 💪",
      "Nice game! Well played! 👏",
      "Love the dedication! 🙌",
      "Excellent technique!",
      "Keep grinding! 💯",
      "Fantastic effort!",
      "So proud of you!",
      "Beast mode activated! 🦁"
    ];

    // Students comment on posts
    for (const studentUser of studentUsers) {
      const numComments = 2 + Math.floor(Math.random() * 3);
      const shuffledPosts = [...createdPosts].sort(() => 0.5 - Math.random());
      
      for (let i = 0; i < numComments && i < shuffledPosts.length; i++) {
        const randomComment = commentTexts[Math.floor(Math.random() * commentTexts.length)];
        commentsData.push({
          postId: shuffledPosts[i].id,
          userId: studentUser.id,
          content: randomComment
        });
      }
    }

    // Viewers comment on posts
    for (const viewerUser of viewerUsers) {
      const numComments = 1 + Math.floor(Math.random() * 3);
      const shuffledPosts = [...createdPosts].sort(() => 0.5 - Math.random());
      
      for (let i = 0; i < numComments && i < shuffledPosts.length; i++) {
        const randomComment = commentTexts[Math.floor(Math.random() * commentTexts.length)];
        commentsData.push({
          postId: shuffledPosts[i].id,
          userId: viewerUser.id,
          content: randomComment
        });
      }
    }

    if (commentsData.length > 0) {
      await db.insert(postComments).values(commentsData);
    }

    // Create saves
    console.log("💾 Creating demo saves...");
    const savesData: InsertSavedPost[] = [];
    
    // Each student saves some posts
    for (const studentUser of studentUsers) {
      const numSaves = 1 + Math.floor(Math.random() * 3);
      const shuffledPosts = [...createdPosts].sort(() => 0.5 - Math.random());
      
      for (let i = 0; i < numSaves && i < shuffledPosts.length; i++) {
        savesData.push({
          postId: shuffledPosts[i].id,
          userId: studentUser.id
        });
      }
    }

    // Viewers save posts too
    for (const viewerUser of viewerUsers) {
      const numSaves = 1 + Math.floor(Math.random() * 2);
      const shuffledPosts = [...createdPosts].sort(() => 0.5 - Math.random());
      
      for (let i = 0; i < numSaves && i < shuffledPosts.length; i++) {
        savesData.push({
          postId: shuffledPosts[i].id,
          userId: viewerUser.id
        });
      }
    }

    if (savesData.length > 0) {
      await db.insert(savedPosts).values(savesData);
    }

    // Create follows
    console.log("👥 Creating demo follows...");
    const followsData: InsertStudentFollower[] = [];
    
    // Create follow relationships between students and viewers
    for (let i = 0; i < createdStudents.length; i++) {
      for (let j = 0; j < createdStudents.length; j++) {
        if (i !== j && Math.random() > 0.6) { // 40% chance to follow
          // Find the user for follower
          const followerUser = studentUsers.find(user => user.linkedId === createdStudents[i].id);
          if (followerUser) {
            followsData.push({
              followerUserId: followerUser.id,
              studentId: createdStudents[j].id
            });
          }
        }
      }
    }

    // Viewers follow students
    for (const viewerUser of viewerUsers) {
      const numFollows = 1 + Math.floor(Math.random() * 3);
      const shuffledStudents = [...createdStudents].sort(() => 0.5 - Math.random());
      
      for (let i = 0; i < numFollows && i < shuffledStudents.length; i++) {
        followsData.push({
          followerUserId: viewerUser.id,
          studentId: shuffledStudents[i].id
        });
      }
    }

    if (followsData.length > 0) {
      await db.insert(studentFollowers).values(followsData);
    }

    // Summary
    console.log("\\n✅ Demo data seeded successfully!");
    console.log(`\\n📊 Summary:`);
    console.log(`   🏫 Schools: ${createdSchools.length}`);
    console.log(`   👑 System Admins: 1`);
    console.log(`   🎓 School Admins: 1`);
    console.log(`   ⚽ Students: ${createdStudents.length}`);
    console.log(`   👀 Viewers: ${createdViewers.length}`);
    console.log(`   📱 Posts: ${createdPosts.length}`);
    console.log(`   ❤️ Likes: ${likesData.length}`);
    console.log(`   💬 Comments: ${commentsData.length}`);
    console.log(`   💾 Saves: ${savesData.length}`);
    console.log(`   👥 Follows: ${followsData.length}`);
    
    console.log(`\\n🔑 Demo Accounts:`);
    console.log(`   System Admin: admin@lockerroom.com / admin123`);
    console.log(`   School Admin: principal@lincoln.edu / principal123`);
    console.log(`   Student 1: marcus.rodriguez@student.com / student123`);
    console.log(`   Student 2: sophia.chen@student.com / student123`);
    console.log(`   Student 3: jordan.williams@student.com / student123`);
    console.log(`   Viewer 1: sarah.johnson@viewer.com / viewer123`);
    console.log(`   Viewer 2: mike.thompson@viewer.com / viewer123`);

    // Write credentials to file
    const credentialsContent = `# LockerRoom Demo Credentials

## System Admin
- **Email**: admin@lockerroom.com
- **Password**: admin123
- **Access**: Full platform control, school management, user management

## School Admin  
- **Email**: principal@lincoln.edu
- **Password**: principal123
- **School**: Lincoln High School
- **Access**: Student management, school settings, analytics

## Students
### Marcus Rodriguez (Team Captain)
- **Email**: marcus.rodriguez@student.com
- **Password**: student123
- **School**: Lincoln High School
- **Position**: Midfielder (#10)
- **Access**: Content creation, social interactions

### Sophia Chen
- **Email**: sophia.chen@student.com  
- **Password**: student123
- **School**: Lincoln High School
- **Position**: Forward (#7)
- **Access**: Content creation, social interactions

### Jordan Williams
- **Email**: jordan.williams@student.com
- **Password**: student123
- **School**: Roosevelt Academy  
- **Position**: Goalkeeper (#1)
- **Access**: Content creation, social interactions

## Viewers
### Sarah Johnson
- **Email**: sarah.johnson@viewer.com
- **Password**: viewer123
- **Bio**: Proud parent following soccer journey
- **Access**: Browse content, follow students, comment

### Mike Thompson
- **Email**: mike.thompson@viewer.com
- **Password**: viewer123  
- **Bio**: Local sports enthusiast and team supporter
- **Access**: Browse content, follow students, comment

## Demo Data Includes:
- **2 Schools**: Lincoln High School (premium), Roosevelt Academy (standard)
- **10 Posts**: Mix of images and videos with engaging captions
- **Social Interactions**: ${likesData.length} likes, ${commentsData.length} comments, ${savesData.length} saves, ${followsData.length} follows
- **Realistic Content**: Unsplash images, sample videos, authentic sports content

## Usage Instructions:
1. Run \`npm run reseed\` to reset demo data
2. Start app with \`npm run dev\`
3. Login with any account above to test functionality
4. All passwords use bcrypt hashing for security
5. Cloudinary integration ready for new uploads

*Generated: ${new Date().toISOString()}*
`;

    // Ensure docs directory exists
    await import('fs/promises').then(fs => fs.mkdir('docs', { recursive: true }));
    await import('fs/promises').then(fs => fs.writeFile('docs/demo_credentials.md', credentialsContent));
    
    console.log("\\n📝 Demo credentials written to docs/demo_credentials.md");

  } catch (error) {
    console.error("❌ Error seeding demo data:", error);
    process.exit(1);
  }
}

// Run the reseeding
reseedDemo().then(() => {
  console.log("\\n🎉 Demo data reseeding completed successfully!");
  process.exit(0);
}).catch((error) => {
  console.error("❌ Reseeding failed:", error);
  process.exit(1);
});