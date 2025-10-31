// Unified role definitions for the LockerRoom application
export type Role =
  | "system_admin"   // top-level (replaces super_admin)
  | "moderator"
  | "scout_admin"
  | "xen_scout"
  | "finance"
  | "support"
  | "coach"
  | "analyst"
  | "school_admin"
  | "student"
  | "viewer";

// Role hierarchy for permission checking
export const ROLE_HIERARCHY: Record<Role, number> = {
  system_admin: 10,
  moderator: 8,
  scout_admin: 7,
  xen_scout: 6,
  finance: 5,
  support: 5,
  coach: 5,
  analyst: 5,
  school_admin: 4,
  student: 2,
  viewer: 1,
};

// Helper function to check if a role has sufficient permissions
export function hasRolePermission(userRole: Role, requiredRole: Role): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

// Helper function to check if user is system admin (has full rights)
export function isSystemAdmin(role: Role): boolean {
  return role === "system_admin";
}

// Helper function to check if role is scout-related
export function isScoutRole(role: Role): boolean {
  return role === "scout_admin" || role === "xen_scout";
}

// Helper function to check if role requires OTP
export function requiresOTP(role: Role): boolean {
  return isScoutRole(role);
}
