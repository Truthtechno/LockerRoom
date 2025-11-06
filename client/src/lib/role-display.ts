/**
 * Maps role values from the backend to user-friendly display names
 * 
 * IMPORTANT: Always use this function when displaying user roles in the UI.
 * Never hardcode role display names - they may not match the terminology standards.
 * 
 * Terminology Standards:
 * - Backend role "student" → Display: "Player"
 * - Backend role "school_admin" → Display: "Academy Admin"
 * - Backend role "system_admin" → Display: "System Admin"
 * 
 * @param role - The role value from the backend (e.g., "student", "school_admin")
 * @returns User-friendly display name (e.g., "Player", "Academy Admin")
 * 
 * @example
 * // ✅ CORRECT
 * <span>{getRoleDisplayName(user.role)}</span>
 * // Displays: "Player" for role="student"
 * 
 * @example
 * // ❌ WRONG - Don't hardcode role names
 * <span>{user.role === "student" ? "Student" : "Admin"}</span>
 * 
 * See DEVELOPER_GUIDELINES.md for full terminology standards.
 */
export function getRoleDisplayName(role: string | undefined | null): string {
  if (!role) return "";
  
  const roleMap: Record<string, string> = {
    "student": "Player",
    "school_admin": "Academy Admin",
    "system_admin": "System Admin",
    "scout_admin": "Scout Admin",
    "xen_scout": "XEN Scout",
    "viewer": "Viewer",
    "moderator": "Moderator",
    "finance": "Finance",
    "support": "Support",
    "coach": "Coach",
    "analyst": "Analyst",
  };
  
  // Return mapped display name, or format the role if not in map
  return roleMap[role] || role.replace("_", " ").split(" ").map(word => 
    word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
  ).join(" ");
}

