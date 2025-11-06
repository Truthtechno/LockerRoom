# Terminology Change Plan: School → Academy, Student → Player

## Overview
This document outlines the comprehensive plan to change terminology throughout the LockerRoom platform:
- **"School" → "Academy"** 
- **"Student" → "Player"**

## Scope Analysis

### 1. Database Schema Changes

#### Table Names (Requires Migration)
- `schools` → `academies`
- `students` → `players`
- `school_admins` → `academy_admins`
- `school_applications` → `academy_applications`
- `school_payment_records` → `academy_payment_records`
- `school_settings` → `academy_settings`
- `student_followers` → `player_followers`
- `student_ratings` → `player_ratings`

#### Column Names (Requires Migration)
- `school_id` → `academy_id`
- `student_id` → `player_id`
- `schoolId` → `academyId`
- `studentId` → `playerId`
- `max_students` → `max_players`
- `expected_students` → `expected_players`
- `student_name` → `player_name`
- `student_school_id` → `player_academy_id`
- `student_school_name` → `player_academy_name`
- `student_profile_pic_url` → `player_profile_pic_url`
- `student_position` → `player_position`
- `student_height` → `player_height`
- `student_weight` → `player_weight`
- `student_role_number` → `player_role_number`
- `student_sport` → `player_sport`

#### Role Changes (Requires Data Migration)
- `school_admin` → `academy_admin`
- `student` → `player`

**⚠️ CRITICAL**: Database schema changes require:
1. Migration scripts to rename tables/columns
2. Data migration for role values
3. Foreign key constraint updates
4. Index updates
5. Backward compatibility considerations

---

### 2. Code Variable & Function Names

#### Type Definitions (`shared/schema.ts`)
- `School` → `Academy`
- `Student` → `Player`
- `InsertSchool` → `InsertAcademy`
- `InsertStudent` → `InsertPlayer`
- `SchoolAdmin` → `AcademyAdmin`
- `StudentSearchResult` → `PlayerSearchResult`
- `StudentWithStats` → `PlayerWithStats`
- `StudentSubmission` → `PlayerSubmission`
- `StudentSubmissionsResponse` → `PlayerSubmissionsResponse`

#### Function Names (server/storage.ts, server/routes.ts)
- `getSchool()` → `getAcademy()`
- `getSchools()` → `getAcademies()`
- `createSchool()` → `createAcademy()`
- `updateSchool()` → `updateAcademy()`
- `getStudent()` → `getPlayer()`
- `getStudentByUserId()` → `getPlayerByUserId()`
- `getStudentsBySchool()` → `getPlayersByAcademy()`
- `createStudent()` → `createPlayer()`
- `updateStudent()` → `updatePlayer()`
- `searchSchoolStudents()` → `searchAcademyPlayers()`
- `getStudentsBySchool()` → `getPlayersByAcademy()`
- `approveSchoolApplication()` → `approveAcademyApplication()`

#### Variable Names (Throughout Codebase)
- `school` → `academy`
- `schools` → `academies`
- `student` → `player`
- `students` → `players`
- `schoolId` → `academyId`
- `schoolIds` → `academyIds`
- `studentId` → `playerId`
- `studentIds` → `playerIds`
- `schoolName` → `academyName`
- `studentName` → `playerName`
- `schoolAdmin` → `academyAdmin`
- `schoolAdmins` → `academyAdmins`

---

### 3. API Routes & Endpoints

#### Route Changes
- `/api/schools` → `/api/academies`
- `/api/schools/:id` → `/api/academies/:id`
- `/api/schools/:id/stats` → `/api/academies/:id/stats`
- `/api/schools/:id/students` → `/api/academies/:id/players`
- `/api/schools/:id/analytics` → `/api/academies/:id/analytics`
- `/api/schools/:schoolId/announcements` → `/api/academies/:academyId/announcements`
- `/api/schools/:schoolId/students` → `/api/academies/:academyId/players`
- `/api/students` → `/api/players`
- `/api/students/:id` → `/api/players/:id`
- `/api/students/profile/:userId` → `/api/players/profile/:userId`
- `/api/students/:id/follow` → `/api/players/:id/follow`
- `/api/students/:id/followers` → `/api/players/:id/followers`
- `/api/students/:id/following` → `/api/players/:id/following`
- `/api/students/:studentId/analytics` → `/api/players/:playerId/analytics`
- `/api/school-admin/*` → `/api/academy-admin/*`
- `/api/admin/school-applications` → `/api/admin/academy-applications`

#### Frontend Routes
- `/school-admin/*` → `/academy-admin/*`
- `/system-admin/create-school` → `/system-admin/create-academy`
- `/system-admin/manage-schools` → `/system-admin/manage-academies`
- `/system-admin/create-school-admin` → `/system-admin/create-academy-admin`
- `/school-admin/add-student` → `/academy-admin/add-player`
- `/school-admin/student-search` → `/academy-admin/player-search`

**⚠️ NOTE**: Route changes may break existing bookmarks and integrations. Consider maintaining backward compatibility.

---

### 4. UI/Display Text Changes

#### Page Titles & Headings
- "School Dashboard" → "Academy Dashboard"
- "School Management" → "Academy Management"
- "School Admin Portal" → "Academy Admin Portal"
- "Student Portal" → "Player Portal"
- "Student Management" → "Player Management"
- "Student Registration" → "Player Registration"
- "Student Search" → "Player Search"
- "Student Analytics" → "Player Analytics"
- "Student Content" → "Player Content"
- "Add Student" → "Add Player"
- "Create School" → "Create Academy"
- "School Information" → "Academy Information"
- "School Settings" → "Academy Settings"
- "School Applications" → "Academy Applications"
- "School Payments" → "Academy Payments"

#### Labels & Form Fields
- "School Name" → "Academy Name"
- "Student Name" → "Player Name"
- "Student Email" → "Player Email"
- "Student Phone" → "Player Phone"
- "Student Limit" → "Player Limit"
- "Max Students" → "Max Players"
- "Expected Students" → "Expected Players"
- "School Admin" → "Academy Admin"
- "School ID" → "Academy ID"
- "Student ID" → "Player ID"

#### Messages & Notifications
- "School not found" → "Academy not found"
- "Student not found" → "Player not found"
- "School created successfully" → "Academy created successfully"
- "Student created successfully" → "Player created successfully"
- "School updated" → "Academy updated"
- "Student updated" → "Player updated"
- "School disabled" → "Academy disabled"
- "School enabled" → "Academy enabled"
- "School deleted" → "Academy deleted"
- "Unknown School" → "Unknown Academy"
- "Unknown Student" → "Unknown Player"
- "School Administration" → "Academy Administration"
- "School subscription" → "Academy subscription"
- "School payment" → "Academy payment"

#### Navigation Items
- "Create School" → "Create Academy"
- "Manage Schools" → "Manage Academies"
- "Add Student" → "Add Player"
- "Student Search" → "Player Search"
- "Student Content" → "Player Content"

#### Documentation Files
- README.md - All references
- DEVELOPMENT.md - All references
- DEPLOYMENT.md - All references
- MOBILE_APP_DEVELOPMENT_ANALYSIS.md - All references
- DEPLOYMENT_ANALYSIS_AND_RECOMMENDATIONS.md - All references
- docs/system_inputs_and_actions.md - All references
- docs/demo_credentials.md - All references

---

### 5. Component & File Names

#### Component Files (Consider renaming for consistency)
- `create-school.tsx` → `create-academy.tsx`
- `manage-schools.tsx` → `manage-academies.tsx`
- `create-school-admin.tsx` → `create-academy-admin.tsx`
- `add-student.tsx` → `add-player.tsx`
- `student-search.tsx` → `player-search.tsx`

#### Route Files
- `school-admin.tsx` → `academy-admin.tsx`
- `school-admin/*` → `academy-admin/*`

---

### 6. Comments & Documentation in Code

All code comments referencing "school" or "student" need updating:
- Function documentation
- Inline comments
- JSDoc comments
- Type definitions documentation

---

## Implementation Strategy

### Phase 1: UI Text (Low Risk)
1. Update all user-facing text in React components
2. Update navigation labels
3. Update error messages
4. Update notification messages
5. Update documentation files

### Phase 2: Code Variables (Medium Risk)
1. Update TypeScript types and interfaces
2. Update function names
3. Update variable names
4. Update API response types
5. Update frontend route handlers

### Phase 3: API Routes (Medium-High Risk)
1. Add new routes with new names
2. Add backward compatibility layer (redirects)
3. Update frontend to use new routes
4. Deprecate old routes
5. Remove old routes after migration period

### Phase 4: Database Schema (High Risk - Requires Careful Planning)
1. Create migration scripts
2. Test migrations on staging
3. Backup production database
4. Run migrations during maintenance window
5. Update all code references
6. Verify data integrity

---

## Risk Assessment

### Low Risk Changes
- ✅ UI display text
- ✅ Documentation files
- ✅ Comments in code

### Medium Risk Changes
- ⚠️ Code variable/function names
- ⚠️ Frontend routes
- ⚠️ API route paths

### High Risk Changes
- 🔴 Database table/column names
- 🔴 Role values in database
- 🔴 Foreign key relationships
- 🔴 Existing data migration

---

## Testing Checklist

After implementation, verify:
- [ ] All UI labels display correctly
- [ ] Navigation works correctly
- [ ] API endpoints respond correctly
- [ ] Database queries work correctly
- [ ] Authentication/authorization works
- [ ] Search functionality works
- [ ] Analytics/reporting works
- [ ] File uploads work
- [ ] Notifications work
- [ ] Mobile navigation works
- [ ] Documentation is accurate

---

## Files to Modify (Estimated Count)

- **React Components**: ~80+ files
- **Server Routes**: ~10+ files
- **Storage Layer**: ~5+ files
- **Schema Definitions**: ~3+ files
- **Documentation**: ~10+ files
- **Tests**: ~10+ files
- **Migrations**: New migration files needed

**Total Estimated Files**: ~120+ files

---

## Recommendations

1. **Start with UI Text**: Begin with low-risk UI changes to get immediate visual results
2. **Gradual Migration**: Consider keeping database names as-is initially, only changing display text
3. **Backward Compatibility**: Maintain old API routes for a transition period
4. **Comprehensive Testing**: Test all user flows after changes
5. **Staged Rollout**: Consider deploying changes in phases

---

## Next Steps

1. **Review this plan** with stakeholders
2. **Decide on approach**: Full migration vs. UI-only changes
3. **Create backup** of production database
4. **Set up staging environment** for testing
5. **Begin implementation** starting with lowest-risk changes
6. **Test thoroughly** before production deployment

---

**Prepared by**: AI Assistant  
**Date**: 2025-01-27  
**Status**: Awaiting Approval

