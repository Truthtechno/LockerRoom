import bcrypt from "bcrypt";
import { db } from "./db";
import { eq } from "drizzle-orm";
import { users, systemAdmins, type InsertUser, type InsertSystemAdmin } from "@shared/schema";

const SYSADMIN_EMAIL = "sysadmin@lockerroom.com";
const SYSADMIN_PASSWORD = "SuperSecure123!";
const SYSADMIN_NAME = "System Admin";

/**
 * Ensures the system admin user exists in the database.
 * This function is idempotent and safe to run on every server start.
 * 
 * @param db - Database connection instance
 */
export async function ensureSysAdmin(): Promise<void> {
  try {
    console.log("🔧 Ensuring system admin user exists...");

    // Check if user already exists
    const [existingUser] = await db
      .select()
      .from(users)
      .where(eq(users.email, SYSADMIN_EMAIL));

    if (existingUser) {
      // User exists, check if they have the correct role and linked system_admin
      if (existingUser.role !== "system_admin") {
        console.log("🔄 Updating existing user role to system_admin...");
        
        // Check if system_admin profile exists
        const [existingSystemAdmin] = await db
          .select()
          .from(systemAdmins)
          .where(eq(systemAdmins.id, existingUser.linkedId));

        if (!existingSystemAdmin) {
          // Create system_admin profile
          const [newSystemAdmin] = await db
            .insert(systemAdmins)
            .values({
              name: SYSADMIN_NAME,
              permissions: [],
            } as InsertSystemAdmin)
            .returning();

          // Update user with new linked_id and role
          await db
            .update(users)
            .set({
              role: "system_admin",
              linkedId: newSystemAdmin.id,
              name: SYSADMIN_NAME,
            })
            .where(eq(users.id, existingUser.id));

          console.log("✅ Sysadmin ensured (email=sysadmin@lockerroom.com) - Updated existing user");
        } else {
          // Just update the role
          await db
            .update(users)
            .set({
              role: "system_admin",
              name: SYSADMIN_NAME,
            })
            .where(eq(users.id, existingUser.id));

          console.log("✅ Sysadmin ensured (email=sysadmin@lockerroom.com) - Updated existing user role");
        }
      } else {
        // User exists with correct role, check if system_admin profile exists
        const [existingSystemAdmin] = await db
          .select()
          .from(systemAdmins)
          .where(eq(systemAdmins.id, existingUser.linkedId));

        if (!existingSystemAdmin) {
          // Create missing system_admin profile
          const [newSystemAdmin] = await db
            .insert(systemAdmins)
            .values({
              name: SYSADMIN_NAME,
              permissions: [],
            } as InsertSystemAdmin)
            .returning();

          // Update user with new linked_id
          await db
            .update(users)
            .set({
              linkedId: newSystemAdmin.id,
              name: SYSADMIN_NAME,
            })
            .where(eq(users.id, existingUser.id));

          console.log("✅ Sysadmin ensured (email=sysadmin@lockerroom.com) - Created missing profile");
        } else {
          console.log("✅ Sysadmin ensured (email=sysadmin@lockerroom.com) - Already exists");
        }
      }
    } else {
      // User doesn't exist, create both system_admin profile and user
      console.log("🆕 Creating new system admin user...");

      // Hash the password
      const passwordHash = await bcrypt.hash(SYSADMIN_PASSWORD, 12);

      // Create system_admin profile first
      const [newSystemAdmin] = await db
        .insert(systemAdmins)
        .values({
          name: SYSADMIN_NAME,
          permissions: [],
        } as InsertSystemAdmin)
        .returning();

      // Create user with linked_id pointing to system_admin profile
      await db
        .insert(users)
        .values({
          email: SYSADMIN_EMAIL,
          passwordHash,
          role: "system_admin",
          linkedId: newSystemAdmin.id,
          name: SYSADMIN_NAME,
          emailVerified: true,
        } as InsertUser);

      console.log("✅ Sysadmin ensured (email=sysadmin@lockerroom.com) - Created new user");
    }
  } catch (error) {
    console.warn(`⚠️ Failed to ensure sysadmin: ${error instanceof Error ? error.message : String(error)}`);
    // Don't throw - we want the server to continue starting even if this fails
  }
}
