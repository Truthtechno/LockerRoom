# Developer Guidelines - Terminology Standards

## Overview

This document establishes terminology standards for all future development in the LockerRoom platform. **All user-facing text MUST use "Academy" and "Player" terminology**, even though code-level references may use "school" and "student" for backend compatibility.

## Terminology Standards

### ✅ User-Facing Text (Display Layer)
**MUST ALWAYS USE:**
- **"Academy"** (not "School")
- **"Player"** (not "Student")
- **"Academy Admin"** (not "School Admin")

### ⚠️ Code-Level References (Backend Compatibility)
**MAY USE** (for backend compatibility):
- `school`, `schools`, `schoolId`, `school_id`
- `student`, `students`, `studentId`, `student_id`
- API endpoints: `/api/schools`, `/api/students`
- Database tables: `schools`, `students`

## Why This Dual Standard?

The codebase maintains backward compatibility with:
- Existing database schema
- API endpoints
- TypeScript type definitions
- External integrations

**However**, all user-facing text has been updated to reflect the correct terminology (Academy/Player).

## Development Rules

### 1. UI Components (React/TypeScript)
**ALWAYS** use "Academy" and "Player" in:
- ✅ Component text/labels: `<Label>Academy Name</Label>`
- ✅ Placeholders: `placeholder="Search for players..."`
- ✅ Error messages: `"Academy not found"`
- ✅ Success messages: `"Player added successfully"`
- ✅ Toast notifications: `toast({ title: "Academy Created" })`
- ✅ Page titles: `<h1>Academy Dashboard</h1>`
- ✅ Table headers: `<th>Academy</th>`
- ✅ Button labels: `<Button>Add Player</Button>`
- ✅ Dialog descriptions: `"Create a new academy..."`

**Example:**
```tsx
// ✅ CORRECT
<Label>Academy Name</Label>
<Input placeholder="Enter academy name" />
toast({ title: "Academy Created", description: "The academy has been registered successfully." })

// ❌ WRONG
<Label>School Name</Label>
<Input placeholder="Enter school name" />
toast({ title: "School Created", description: "The school has been registered successfully." })
```

### 2. Code Variables (Backend Compatibility)
**MAY** use "school" and "student" for:
- ✅ Variable names: `const school = await getSchool(id)`
- ✅ API calls: `await apiRequest("GET", "/api/schools")`
- ✅ Type definitions: `interface School { ... }`
- ✅ Database queries: `SELECT * FROM schools`
- ✅ Function parameters: `function updateSchool(schoolId: string)`

**Example:**
```tsx
// ✅ CORRECT - Code-level uses "school" for backend compatibility
const { data: schools } = useQuery({
  queryKey: ["/api/schools"],
  queryFn: () => apiRequest("GET", "/api/schools")
});

// But display text uses "Academy"
<CardTitle>Academies ({schools.length})</CardTitle>

// ❌ WRONG - Don't mix terminology in display
<CardTitle>Schools ({schools.length})</CardTitle>
```

### 3. Mapping Pattern
When displaying data from backend, use the `getRoleDisplayName()` utility:

```tsx
import { getRoleDisplayName } from "@/lib/role-display";

// ✅ CORRECT
<span>{getRoleDisplayName(user.role)}</span>
// Displays: "Player" for role="student", "Academy Admin" for role="school_admin"

// ❌ WRONG
<span>{user.role === "student" ? "Student" : "School Admin"}</span>
```

### 4. Form Fields & Labels
**ALWAYS** use Academy/Player in form labels:

```tsx
// ✅ CORRECT
<Label htmlFor="academyName">Academy Name *</Label>
<Label htmlFor="playerEmail">Player Email *</Label>
<Label htmlFor="maxPlayers">Maximum Players *</Label>

// ❌ WRONG
<Label htmlFor="schoolName">School Name *</Label>
<Label htmlFor="studentEmail">Student Email *</Label>
<Label htmlFor="maxStudents">Maximum Students *</Label>
```

### 5. Error & Success Messages
**ALWAYS** use Academy/Player:

```tsx
// ✅ CORRECT
toast({
  title: "Academy Not Found",
  description: "The requested academy could not be found.",
  variant: "destructive"
});

toast({
  title: "Player Added Successfully! 🎉",
  description: "Player has been registered in the system."
});

// ❌ WRONG
toast({
  title: "School Not Found",
  description: "The requested school could not be found."
});
```

### 6. Comments & Documentation
**ALWAYS** use Academy/Player in:
- Inline comments explaining UI behavior
- JSDoc comments for user-facing functions
- README files
- User documentation

```tsx
// ✅ CORRECT
/**
 * Displays the academy dashboard with player statistics
 * @param academyId - The ID of the academy to display
 */
function AcademyDashboard({ academyId }: { academyId: string }) {
  // Fetch academy players...
}

// ❌ WRONG
/**
 * Displays the school dashboard with student statistics
 */
```

## Key Files Reference

### Role Display Utility
**Location**: `client/src/lib/role-display.ts`

**Usage**: Always use this for displaying roles:
```tsx
import { getRoleDisplayName } from "@/lib/role-display";

// Maps backend roles to display names:
// "student" → "Player"
// "school_admin" → "Academy Admin"
// "system_admin" → "System Admin"
```

### Type Definitions
**Location**: `shared/schema.ts`

**Note**: Type names may still use "School" and "Student" for backend compatibility, but all user-facing properties should be mapped to Academy/Player in the UI.

## Code Review Checklist

When reviewing code, ensure:
- [ ] All UI text uses "Academy" (not "School")
- [ ] All UI text uses "Player" (not "Student")
- [ ] Error messages use Academy/Player
- [ ] Success messages use Academy/Player
- [ ] Form labels use Academy/Player
- [ ] Table headers use Academy/Player
- [ ] Navigation items use Academy/Player
- [ ] `getRoleDisplayName()` is used for role display
- [ ] Comments/documentation use Academy/Player

## Common Mistakes to Avoid

### ❌ Don't Do This:
```tsx
// Using backend variable names in UI
<CardTitle>Schools ({schools.length})</CardTitle>

// Forgetting to use role display utility
<span>{user.role}</span> // Shows "student" instead of "Player"

// Using old terminology in new features
<Button>Add Student</Button>
```

### ✅ Do This Instead:
```tsx
// Map backend data to display terminology
<CardTitle>Academies ({schools.length})</CardTitle>

// Use role display utility
<span>{getRoleDisplayName(user.role)}</span> // Shows "Player"

// Use correct terminology in all new features
<Button>Add Player</Button>
```

## Testing New Features

When adding new features:
1. **Check all user-facing text** - Verify Academy/Player terminology
2. **Test error messages** - Ensure they use Academy/Player
3. **Review form labels** - Check all labels use Academy/Player
4. **Verify role display** - Use `getRoleDisplayName()` utility
5. **Check documentation** - Update any docs with new features

## Migration Guide for New Developers

**Q: Why do variable names use "school" but UI shows "Academy"?**

**A**: Backend compatibility. The database, API endpoints, and TypeScript types use "school"/"student" for historical reasons and to maintain compatibility with existing integrations. However, all user-facing text uses "Academy"/"Player" to reflect the correct business terminology.

**Q: Should I update variable names in new code?**

**A**: No. Keep using "school"/"student" for:
- Variable names
- API endpoints
- Type definitions
- Database queries

But always use "Academy"/"Player" for:
- UI text
- Labels
- Messages
- Documentation

**Q: What if I'm creating a new API endpoint?**

**A**: Keep using `/api/schools` and `/api/students` for consistency. The URL structure doesn't affect user experience since users don't see URLs.

## Examples from Codebase

### ✅ Good Example: `client/src/pages/system-admin/manage-schools.tsx`
```tsx
// Backend variable uses "school" for compatibility
const { data: schoolsData } = useQuery({
  queryKey: ["/api/system-admin/schools"],
  queryFn: () => apiRequest("GET", "/api/system-admin/schools")
});

// But UI displays "Academy"
<CardTitle>Academies ({filteredSchools.length})</CardTitle>
<TableHead>Academy Name</TableHead>
toast({ title: "Academy Updated! 🎉" });
```

### ✅ Good Example: `client/src/components/navigation/sidebar.tsx`
```tsx
// Uses role display utility
import { getRoleDisplayName } from "@/lib/role-display";

// Displays correct terminology
<span>{getRoleDisplayName(user?.role)}</span>
// Shows: "Player" for student, "Academy Admin" for school_admin
```

## Questions?

If you're unsure about terminology usage:
1. Check this guide first
2. Look at existing code examples (see examples above)
3. Use the `getRoleDisplayName()` utility for roles
4. When in doubt, use "Academy" and "Player" for user-facing text

---

**Last Updated**: 2025-11-06  
**Maintained By**: Development Team  
**Status**: Active Guidelines

