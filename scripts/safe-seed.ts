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
  }
];

async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, 12);
}

async function safeSeed() {
  try {
    console.log("🌱 Starting safe seeding (preserving existing data)...");
    console.log("⚠️  This script will only add demo accounts if they don't exist.");

    // Check if demo data already exists
    const existingDemoUsers = await db.select().from(users).where(eq(users.email, "admin@lockerroom.com"));
    if (existingDemoUsers.length > 0) {
      console.log("✅ Demo data already exists. Skipping to preserve existing data.");
      console.log("🔑 Existing demo accounts:");
      console.log(`   System Admin: admin@lockerroom.com / admin123`);
      console.log(`   School Admin: principal@lincoln.edu / principal123`);
      console.log(`   Student 1: marcus.rodriguez@student.com / student123`);
      console.log(`   Student 2: sophia.chen@student.com / student123`);
      console.log(`   Student 3: jordan.williams@student.com / student123`);
      console.log(`   Viewer 1: sarah.johnson@viewer.com / viewer123`);
      console.log(`   Viewer 2: mike.thompson@viewer.com / viewer123`);
      return;
    }

    console.log("📝 No existing demo data found. Creating demo accounts...");

    // Create schools only if they don't exist
    console.log("🏫 Creating demo schools...");
    const existingSchools = await db.select().from(schools);
    let createdSchools = existingSchools;
    
    if (existingSchools.length === 0) {
      createdSchools = await db.insert(schools).values(demoSchools).returning();
    } else {
      console.log("✅ Schools already exist, using existing ones");
    }
    
    const school1 = createdSchools[0];
    const school2 = createdSchools[1];

    // Create system admin only if it doesn't exist
    console.log("👑 Creating system admin...");
    const existingSystemAdmin = await db.select().from(users).where(eq(users.email, "admin@lockerroom.com"));
    let systemAdminUser;
    
    if (existingSystemAdmin.length === 0) {
      const systemAdminData = {
        name: "System Administrator",
        profilePicUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200",
        bio: "System administrator managing the LockerRoom platform.",
        phone: "555-0001",
        permissions: ["manage_schools", "manage_users", "view_analytics"]
      };
      
      const [systemAdminProfile] = await db.insert(systemAdmins).values(systemAdminData).returning();
      const [createdSystemAdminUser] = await db.insert(users).values({
        email: "admin@lockerroom.com",
        passwordHash: await hashPassword("admin123"),
        role: "system_admin",
        linkedId: systemAdminProfile.id
      } as InsertUser).returning();
      systemAdminUser = createdSystemAdminUser;
    } else {
      console.log("✅ System admin already exists");
      systemAdminUser = existingSystemAdmin[0];
    }

    // Create school admin only if it doesn't exist
    console.log("🎓 Creating school admin...");
    const existingSchoolAdmin = await db.select().from(users).where(eq(users.email, "principal@lincoln.edu"));
    let schoolAdminUser;
    
    if (existingSchoolAdmin.length === 0) {
      const schoolAdminData = {
        name: "Principal Johnson",
        schoolId: school1.id,
        profilePicUrl: "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=200",
        bio: "Principal at Lincoln High School, passionate about student athletics.",
        phone: "555-0002",
        position: "Principal"
      };
      
      const [schoolAdminProfile] = await db.insert(schoolAdmins).values(schoolAdminData).returning();
      const [createdSchoolAdminUser] = await db.insert(users).values({
        email: "principal@lincoln.edu",
        passwordHash: await hashPassword("principal123"),
        role: "school_admin",
        linkedId: schoolAdminProfile.id
      } as InsertUser).returning();
      schoolAdminUser = createdSchoolAdminUser;
    } else {
      console.log("✅ School admin already exists");
      schoolAdminUser = existingSchoolAdmin[0];
    }

    // Create students only if they don't exist
    console.log("⚽ Creating demo students...");
    const studentDataList = [
      {
        email: "marcus.rodriguez@student.com",
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
        email: "sophia.chen@student.com",
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
        email: "jordan.williams@student.com",
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
      const existingStudent = await db.select().from(users).where(eq(users.email, studentData.email));
      
      if (existingStudent.length === 0) {
        // Create user first
        const [studentUser] = await db.insert(users).values({
          email: studentData.email,
          passwordHash: await hashPassword("student123"),
          role: "student",
          linkedId: "temp" // Will be updated after student creation
        } as InsertUser).returning();
        
        // Create student profile with userId
        const [studentProfile] = await db.insert(students).values({
          schoolId: studentData.schoolId,
          name: studentData.name,
          phone: studentData.phone,
          gender: studentData.gender,
          dateOfBirth: studentData.dateOfBirth,
          grade: studentData.grade,
          guardianContact: studentData.guardianContact,
          profilePicUrl: studentData.profilePicUrl,
          roleNumber: studentData.roleNumber,
          position: studentData.position,
          sport: studentData.sport,
          bio: studentData.bio,
          coverPhoto: null,
          userId: studentUser.id
        }).returning();
        
        // Update user with correct linkedId
        await db.update(users).set({ linkedId: studentProfile.id }).where(eq(users.id, studentUser.id));
        
        createdStudents.push(studentProfile);
        studentUsers.push(studentUser);
      } else {
        console.log(`✅ Student ${studentData.name} already exists`);
      }
    }

    // Create viewers only if they don't exist
    console.log("👀 Creating demo viewers...");
    const viewerDataList = [
      {
        email: "sarah.johnson@viewer.com",
        name: "Sarah Johnson",
        profilePicUrl: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200", 
        bio: "Proud parent following my daughter's soccer journey!",
        phone: "555-2001"
      },
      {
        email: "mike.thompson@viewer.com",
        name: "Mike Thompson", 
        profilePicUrl: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200",
        bio: "Local sports enthusiast and team supporter.",
        phone: "555-2002"
      }
    ];

    const createdViewers = [];
    const viewerUsers = [];

    for (const viewerData of viewerDataList) {
      const existingViewer = await db.select().from(users).where(eq(users.email, viewerData.email));
      
      if (existingViewer.length === 0) {
        const [viewerProfile] = await db.insert(viewers).values({
          name: viewerData.name,
          profilePicUrl: viewerData.profilePicUrl,
          bio: viewerData.bio,
          phone: viewerData.phone
        }).returning();
        
        const [viewerUser] = await db.insert(users).values({
          email: viewerData.email, 
          passwordHash: await hashPassword("viewer123"),
          role: "viewer",
          linkedId: viewerProfile.id
        } as InsertUser).returning();
        
        createdViewers.push(viewerProfile);
        viewerUsers.push(viewerUser);
      } else {
        console.log(`✅ Viewer ${viewerData.name} already exists`);
      }
    }

    // Summary
    console.log("\\n✅ Safe seeding completed successfully!");
    console.log(`\\n📊 Summary:`);
    console.log(`   🏫 Schools: ${createdSchools.length}`);
    console.log(`   👑 System Admins: 1`);
    console.log(`   🎓 School Admins: 1`);
    console.log(`   ⚽ Students: ${createdStudents.length}`);
    console.log(`   👀 Viewers: ${createdViewers.length}`);
    
    console.log(`\\n🔑 Demo Accounts:`);
    console.log(`   System Admin: admin@lockerroom.com / admin123`);
    console.log(`   School Admin: principal@lincoln.edu / principal123`);
    console.log(`   Student 1: marcus.rodriguez@student.com / student123`);
    console.log(`   Student 2: sophia.chen@student.com / student123`);
    console.log(`   Student 3: jordan.williams@student.com / student123`);
    console.log(`   Viewer 1: sarah.johnson@viewer.com / viewer123`);
    console.log(`   Viewer 2: mike.thompson@viewer.com / viewer123`);

    console.log("\\n⚠️  IMPORTANT: This script preserves all existing data!");
    console.log("   - Existing user accounts are never deleted");
    console.log("   - Existing schools and relationships remain intact");
    console.log("   - Only missing demo accounts are created");

  } catch (error) {
    console.error("❌ Error during safe seeding:", error);
    process.exit(1);
  }
}

// Run the safe seeding
safeSeed().then(() => {
  console.log("\\n🎉 Safe seeding completed successfully!");
  process.exit(0);
}).catch((error) => {
  console.error("❌ Safe seeding failed:", error);
  process.exit(1);
});
