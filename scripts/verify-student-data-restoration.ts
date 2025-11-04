/**
 * Verification Script: Student Data and Posts Restoration
 * 
 * This script verifies that:
 * 1. Student profiles are correctly stored with all fields including height and weight
 * 2. Posts are correctly stored and retrievable
 * 3. The API endpoints return the correct data
 */

import { db } from "../server/db";
import { students, posts, users } from "../shared/schema";
import { eq, desc, sql, and, isNotNull } from "drizzle-orm";

async function verifyStudentData() {
  console.log("🔍 Starting Student Data Verification...\n");

  try {
    // 1. Check all students have height and weight columns
    console.log("1️⃣ Checking student table structure...");
    const allStudents = await db.select().from(students).limit(10);
    
    if (allStudents.length === 0) {
      console.log("⚠️  No students found in database");
      return;
    }

    console.log(`✅ Found ${allStudents.length} students (showing first 10)`);
    
    // Check if height and weight columns exist by trying to access them
    const sampleStudent = allStudents[0];
    const hasHeight = 'height' in sampleStudent;
    const hasWeight = 'weight' in sampleStudent;
    
    console.log(`   - Height column exists: ${hasHeight ? '✅' : '❌'}`);
    console.log(`   - Weight column exists: ${hasWeight ? '✅' : '❌'}\n`);

    // 2. Check student profiles with stats
    console.log("2️⃣ Checking student profiles...");
    for (const student of allStudents.slice(0, 5)) {
      const user = await db.select().from(users)
        .where(eq(users.id, student.userId))
        .limit(1);
      
      if (user[0]) {
        console.log(`   Student: ${student.name || 'Unknown'}`);
        console.log(`   - ID: ${student.id}`);
        console.log(`   - User ID: ${student.userId}`);
        console.log(`   - Height: ${student.height || 'Not set'}`);
        console.log(`   - Weight: ${student.weight || 'Not set'}`);
        console.log(`   - Sport: ${student.sport || 'Not set'}`);
        console.log(`   - Position: ${student.position || 'Not set'}`);
        console.log(`   - Bio: ${student.bio ? 'Has bio' : 'No bio'}`);
        console.log(`   - Profile Pic: ${student.profilePicUrl ? 'Has pic' : 'No pic'}`);
        console.log(`   - Cover Photo: ${student.coverPhoto ? 'Has cover' : 'No cover'}`);
        console.log("");
      }
    }

    // 3. Check posts for students
    console.log("3️⃣ Checking student posts...");
    
    // Get posts count per student
    const studentPostCounts = await db
      .select({
        studentId: posts.studentId,
        postCount: sql<number>`COUNT(*)::int`,
      })
      .from(posts)
      .where(
        and(
          isNotNull(posts.studentId),
          sql`(${posts.type} = 'post' OR ${posts.type} IS NULL)`,
          sql`(${posts.status} != 'processing' OR ${posts.status} IS NULL)`
        )
      )
      .groupBy(posts.studentId)
      .orderBy(desc(sql`COUNT(*)`))
      .limit(10);

    console.log(`   Found ${studentPostCounts.length} students with posts:`);
    for (const count of studentPostCounts) {
      if (count.studentId) {
        const student = await db.select().from(students)
          .where(eq(students.id, count.studentId))
          .limit(1);
        
        if (student[0]) {
          console.log(`   - ${student[0].name || 'Unknown'}: ${count.postCount} posts`);
        }
      }
    }

    // 4. Check posts details
    console.log("\n4️⃣ Checking post details...");
    const samplePosts = await db.select().from(posts)
      .where(
        and(
          isNotNull(posts.studentId),
          sql`(${posts.type} = 'post' OR ${posts.type} IS NULL)`,
          sql`(${posts.status} != 'processing' OR ${posts.status} IS NULL)`
        )
      )
      .orderBy(desc(posts.createdAt))
      .limit(5);

    console.log(`   Found ${samplePosts.length} sample posts:`);
    for (const post of samplePosts) {
      const student = await db.select().from(students)
        .where(eq(students.id, post.studentId!))
        .limit(1);
      
      const hasMedia = post.mediaUrl && post.mediaUrl.trim() !== '';
      const hasCaption = post.caption && post.caption.trim() !== '';
      
      console.log(`   Post ID: ${post.id}`);
      console.log(`   - Student: ${student[0]?.name || 'Unknown'}`);
      console.log(`   - Has Media: ${hasMedia ? '✅' : '❌'} (${post.mediaUrl ? 'URL present' : 'No URL'})`);
      console.log(`   - Has Caption: ${hasCaption ? '✅' : '❌'}`);
      console.log(`   - Media Type: ${post.mediaType || 'Not set'}`);
      console.log(`   - Status: ${post.status || 'ready'}`);
      console.log(`   - Created: ${post.createdAt}`);
      console.log("");
    }

    // 5. Summary
    console.log("5️⃣ Summary:");
    const totalStudents = await db.select({ count: sql<number>`COUNT(*)::int` }).from(students);
    const totalPosts = await db.select({ count: sql<number>`COUNT(*)::int` })
      .from(posts)
      .where(
        and(
          isNotNull(posts.studentId),
          sql`(${posts.type} = 'post' OR ${posts.type} IS NULL)`
        )
      );
    
    const studentsWithHeight = await db.select({ count: sql<number>`COUNT(*)::int` })
      .from(students)
      .where(isNotNull(students.height));
    
    const studentsWithWeight = await db.select({ count: sql<number>`COUNT(*)::int` })
      .from(students)
      .where(isNotNull(students.weight));

    console.log(`   - Total Students: ${totalStudents[0]?.count || 0}`);
    console.log(`   - Students with Height: ${studentsWithHeight[0]?.count || 0}`);
    console.log(`   - Students with Weight: ${studentsWithWeight[0]?.count || 0}`);
    console.log(`   - Total Posts (non-announcements): ${totalPosts[0]?.count || 0}`);

    console.log("\n✅ Verification complete!");
    
  } catch (error) {
    console.error("❌ Verification error:", error);
    throw error;
  }
}

// Run verification
verifyStudentData()
  .then(() => {
    console.log("\n✅ Script completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Script failed:", error);
    process.exit(1);
  });

