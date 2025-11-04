import { sql } from "drizzle-orm";
import { db, isDbConnected } from "../server/db";

async function verifyColumns() {
  if (!isDbConnected) {
    console.error("❌ Database not connected");
    process.exit(1);
  }

  console.log("🔍 Verifying height and weight columns in students table...\n");

  try {
    // Check if columns exist
    const columnsCheck = await db.execute(sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'students' 
      AND column_name IN ('height', 'weight')
    `);

    console.log("📊 Column check results:", columnsCheck.rows);

    if (columnsCheck.rows.length === 0) {
      console.log("⚠️  Height and weight columns not found. Adding them now...");
      
      // Add height column
      await db.execute(sql`
        ALTER TABLE students 
        ADD COLUMN IF NOT EXISTS height TEXT
      `);
      console.log("✅ Added height column");

      // Add weight column
      await db.execute(sql`
        ALTER TABLE students 
        ADD COLUMN IF NOT EXISTS weight TEXT
      `);
      console.log("✅ Added weight column");

      // Add comments
      await db.execute(sql`
        COMMENT ON COLUMN students.height IS 'Height in centimeters (stored as text)'
      `);
      await db.execute(sql`
        COMMENT ON COLUMN students.weight IS 'Weight in kilograms (stored as text)'
      `);
      console.log("✅ Added column comments");
    } else {
      console.log("✅ Height and weight columns already exist");
      columnsCheck.rows.forEach((row: any) => {
        console.log(`   - ${row.column_name}: ${row.data_type}`);
      });
    }

    // Test query to ensure it works
    console.log("\n🧪 Testing student query...");
    const testStudent = await db.execute(sql`
      SELECT id, name, height, weight 
      FROM students 
      LIMIT 1
    `);
    
    if (testStudent.rows.length > 0) {
      console.log("✅ Test query successful!");
      console.log("   Sample student:", testStudent.rows[0]);
    } else {
      console.log("⚠️  No students found in database");
    }

    console.log("\n✅ Verification complete! All columns are properly set up.");
    process.exit(0);
  } catch (error: any) {
    console.error("❌ Error during verification:", error.message);
    console.error(error);
    process.exit(1);
  }
}

verifyColumns();

