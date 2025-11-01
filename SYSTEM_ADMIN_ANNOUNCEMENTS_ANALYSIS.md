# System Admin Announcements Page - Deep Analysis & Implementation Plan

## Executive Summary

This document provides a comprehensive analysis of the current System Admin Announcements implementation and outlines the plan to enhance it with three distinct functions: **Announcements**, **Banners**, and **Promotions**.

---

## Current Implementation Analysis

### 1. Architecture Overview

#### Database Schema
- **Table**: `posts`
- **Type Field**: `type = 'announcement'` (distinguishes from regular posts)
- **Key Fields**:
  - `title`: Announcement title
  - `caption`: Announcement content
  - `scope`: `'global' | 'school' | 'staff'` - Visibility scope
  - `schoolId`: `varchar | null` - Required for school-scoped announcements
  - `createdByAdminId`: `varchar` - System admin who created it
  - `broadcast`: `boolean` - Whether to show to target audience
  - `mediaUrl`: `text | null` - Optional image/video
  - `mediaType`: `text | null` - 'image' | 'video' | null

#### Current Flow

**Creation Flow**:
1. System admin creates announcement via `AnnouncementModal`
2. POST to `/api/system/announcements`
3. Creates post with `type='announcement'`
4. If `scope='school'`, requires `targetSchoolId` (single school)
5. If `scope='global'`, appears in all feeds

**Display Flow**:
1. Students see announcements in their feed via `/api/posts/feed`
2. Announcements are prioritized at top of feed
3. Displayed with yellow background and megaphone icon
4. School announcements only visible to students in that school
5. Global announcements visible to all students

#### API Endpoints

**Current Endpoints**:
- `POST /api/system/announcements` - Create announcement
- `GET /api/system-admin/announcements` - Get announcements (system admin view)
- `PUT /api/announcements/:id` - Update announcement
- `DELETE /api/announcements/:id` - Delete announcement

**Current Limitations**:
1. ❌ Can only target **one** school at a time (or all schools)
2. ❌ Cannot target **multiple specific schools** simultaneously
3. ❌ No support for scheduling (start/end dates)
4. ❌ No banners system for dashboard communications
5. ❌ No role-specific targeting (scouts, admins, etc.)

---

## Enhancement Requirements

### 1. Announcements (Enhanced)

#### Current Behavior:
- ✅ Appears in student feeds
- ✅ Can target all schools (global) or one school
- ✅ Displays with distinctive styling
- ✅ Supports media (images/videos)

#### Required Enhancements:

**A. Multi-School Targeting**
- Allow system admin to select **multiple schools** when creating announcement
- Store school IDs in a way that supports multiple schools
- **Option 1**: Create separate announcement post per school (current structure)
- **Option 2**: Add junction table `announcement_schools` (many-to-many)
- **Option 3**: Store JSON array of school IDs in `schoolId` field (simplest)

**Recommendation**: **Option 3** (JSON array) - Simplest to implement, maintains backward compatibility

**Implementation**:
```typescript
// Current: schoolId: "school-123" | null
// Enhanced: schoolId: "school-123" | "school-123,school-456" | null
// Or use JSON: schoolIds: ["school-123", "school-456"] | null
```

**B. UI Updates**
- Add multi-select dropdown for schools
- Show "All Schools" checkbox
- Display list of targeted schools in announcement card
- Allow editing school selection

**C. Feed Logic Updates**
- When checking if announcement applies to student's school:
  - If `scope='global'` → Show to all
  - If `scope='school'` and `schoolId` contains student's school → Show
  - Split comma-separated school IDs or parse JSON array

---

### 2. Banners (New Feature)

#### Purpose:
- Dashboard-level communications for specific roles
- Appears at top of dashboards when users log in
- Different from announcements (not in feed, only on dashboard)

#### Target Roles:
- `scout_admin` - Scout administrators
- `school_admin` - School administrators  
- `xen_scout` - Individual scouts

#### Features Required:

**A. Database Schema**
```sql
CREATE TABLE banners (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('info', 'warning', 'success', 'error', 'announcement')),
  target_roles TEXT[] NOT NULL, -- Array of roles: ['scout_admin', 'school_admin']
  start_date TIMESTAMP,
  end_date TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 0, -- Higher priority shown first
  created_by_admin_id VARCHAR NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);
```

**B. Color Coding by Category**
- `info` → Blue (`bg-blue-50 border-blue-200 text-blue-800`)
- `warning` → Yellow/Amber (`bg-yellow-50 border-yellow-200 text-yellow-800`)
- `success` → Green (`bg-green-50 border-green-200 text-green-800`)
- `error` → Red (`bg-red-50 border-red-200 text-red-800`)
- `announcement` → Purple (`bg-purple-50 border-purple-200 text-purple-800`)

**C. Scheduling**
- `start_date`: When banner should start appearing
- `end_date`: When banner should stop appearing
- If `start_date` is null → Show immediately
- If `end_date` is null → Show indefinitely (until manually disabled)
- Automatic visibility based on current timestamp

**D. CRUD Operations**
- Create banner (with role selection, category, scheduling)
- Edit banner (update all fields including scheduling)
- Delete banner (soft delete or hard delete)
- Toggle active/inactive status

**E. Dashboard Integration**
- Fetch active banners for user's role
- Filter by:
  - `is_active = true`
  - User's role in `target_roles`
  - Current time between `start_date` and `end_date` (or null dates)
  - Sort by `priority DESC, created_at DESC`

**F. Display on Dashboards**
- Show banners at top of:
  - `/scouts/admin` (scout_admin dashboard)
  - `/school-admin` (school_admin dashboard)
  - Scout dashboard (xen_scout role - if they have one)

---

### 3. Promotions (Coming Soon)

- Placeholder section with "Coming Soon" message
- Professional design matching the rest of the interface
- Can be expanded in future to include:
  - Promotional campaigns
  - Discount codes
  - Featured content
  - Marketing materials

---

## Implementation Plan

### Phase 1: Database Schema & Migrations

1. **Create Banners Migration**
   - Create `banners` table
   - Add indexes for performance (`target_roles`, `is_active`, `start_date`, `end_date`)
   - Add foreign key to `users` table

2. **Update Announcements Schema** (Optional)
   - Consider adding `target_school_ids` JSON field for multi-school support
   - Or maintain backward compatibility with comma-separated string

### Phase 2: Backend API

1. **Banners API Endpoints**
   ```
   GET    /api/system-admin/banners          - List all banners
   GET    /api/system-admin/banners/:id      - Get single banner
   POST   /api/system-admin/banners          - Create banner
   PUT    /api/system-admin/banners/:id      - Update banner
   DELETE /api/system-admin/banners/:id      - Delete banner
   GET    /api/banners/active                - Get active banners for current user (for dashboard)
   ```

2. **Enhanced Announcements API**
   ```
   POST   /api/system/announcements          - Support multiple school IDs
   PUT    /api/announcements/:id             - Support updating school selection
   ```

3. **Storage Methods**
   - `createBanner()`
   - `getBanners()`
   - `getBanner(id)`
   - `updateBanner(id, data)`
   - `deleteBanner(id)`
   - `getActiveBannersForRole(role)`

### Phase 3: Frontend Components

1. **System Admin Announcements Page Restructure**
   - Convert to tabbed interface:
     - Tab 1: "Announcements"
     - Tab 2: "Banners"
     - Tab 3: "Promotions"
   - Each tab has its own management interface

2. **Announcements Tab** (Enhanced)
   - Multi-school selector component
   - Display selected schools in list
   - Show school names in announcement cards

3. **Banners Tab** (New)
   - Banner list/grid view
   - Create banner modal/form
   - Edit banner modal/form
   - Category color indicators
   - Scheduling date/time pickers
   - Role selection (multi-select)
   - Priority slider/input
   - Active/inactive toggle

4. **Promotions Tab**
   - "Coming Soon" placeholder
   - Professional design

5. **Dashboard Banner Component** (New)
   - Reusable banner display component
   - Fetches active banners via API
   - Displays with appropriate color coding
   - Shows at top of dashboards
   - Dismissible (optional - future enhancement)

### Phase 4: Integration

1. **Dashboard Integration**
   - Add banner component to:
     - Scout Admin Dashboard (`/scouts/admin`)
     - School Admin Dashboard (`/school-admin`)
     - Scout Dashboard (if exists)

2. **Feed Logic Updates**
   - Update announcement filtering to support multiple schools
   - Parse comma-separated or JSON school IDs

---

## Technical Considerations

### Multi-School Storage Options

**Option 1: Comma-Separated String**
```typescript
schoolId: "school-123,school-456,school-789" | null
```
- ✅ Simple, backward compatible
- ✅ No schema changes needed
- ❌ Not normalized, harder to query

**Option 2: JSON Array Field**
```typescript
targetSchoolIds: ["school-123", "school-456"] | null
```
- ✅ Proper array type
- ✅ Easy to query with JSON operators
- ❌ Requires schema migration

**Option 3: Junction Table**
```sql
CREATE TABLE announcement_schools (
  announcement_id VARCHAR REFERENCES posts(id),
  school_id VARCHAR REFERENCES schools(id),
  PRIMARY KEY (announcement_id, school_id)
);
```
- ✅ Properly normalized
- ✅ Best for complex queries
- ❌ More complex to implement
- ❌ Requires joins

**Recommendation**: Start with **Option 1** (comma-separated) for quick implementation, can migrate to Option 2 later if needed.

### Banner Scheduling Logic

```typescript
function isBannerVisible(banner: Banner, userRole: string, currentTime: Date): boolean {
  // Check if banner is active
  if (!banner.is_active) return false;
  
  // Check if user's role is targeted
  if (!banner.target_roles.includes(userRole)) return false;
  
  // Check start date
  if (banner.start_date && currentTime < banner.start_date) return false;
  
  // Check end date
  if (banner.end_date && currentTime > banner.end_date) return false;
  
  return true;
}
```

### Performance Considerations

1. **Banner Caching**
   - Cache active banners per role (5-minute TTL)
   - Invalidate cache when banner is created/updated/deleted

2. **Announcement Queries**
   - Use indexed queries for school-based filtering
   - Consider materialized views for complex multi-school queries

3. **Dashboard Loading**
   - Fetch banners in parallel with dashboard data
   - Use React Query for caching

---

## UI/UX Design Guidelines

### Color Scheme

**Banners by Category**:
- **Info** (Blue): `bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-100`
- **Warning** (Yellow): `bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800 text-yellow-900 dark:text-yellow-100`
- **Success** (Green): `bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800 text-green-900 dark:text-green-100`
- **Error** (Red): `bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800 text-red-900 dark:text-red-100`
- **Announcement** (Purple): `bg-purple-50 dark:bg-purple-950 border-purple-200 dark:border-purple-800 text-purple-900 dark:text-purple-100`

### Banner Display on Dashboard

```tsx
<div className="space-y-3 mb-6">
  {activeBanners.map(banner => (
    <div 
      key={banner.id}
      className={`p-4 rounded-lg border ${getCategoryClasses(banner.category)}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h3 className="font-semibold mb-1">{banner.title}</h3>
          <p className="text-sm">{banner.message}</p>
        </div>
        {banner.end_date && (
          <span className="text-xs opacity-75 ml-4">
            Until {formatDate(banner.end_date)}
          </span>
        )}
      </div>
    </div>
  ))}
</div>
```

---

## File Structure

```
server/
  ├── routes/
  │   ├── system-admin.ts          # Enhanced announcements + banners endpoints
  │   └── banners.ts               # New: Banner-specific endpoints (optional)
  ├── storage.ts                   # Add banner storage methods
  └── migrations/
      └── YYYY-MM-DD_add_banners_table.sql

client/
  ├── src/
  │   ├── pages/
  │   │   └── system-admin/
  │   │       └── announcements.tsx    # Restructured with tabs
  │   ├── components/
  │   │   ├── admin/
  │   │   │   ├── announcement-management.tsx    # Enhanced
  │   │   │   └── banner-management.tsx          # New
  │   │   └── ui/
  │   │       ├── announcement-modal.tsx         # Enhanced with multi-school
  │   │       ├── banner-modal.tsx               # New
  │   │       └── dashboard-banner.tsx           # New
  │   └── hooks/
  │       └── use-banners.ts                     # New: Banner fetching hook
```

---

## Testing Checklist

### Announcements
- [ ] Create announcement targeting all schools
- [ ] Create announcement targeting single school
- [ ] Create announcement targeting multiple schools
- [ ] Verify announcement appears in correct student feeds
- [ ] Edit announcement school selection
- [ ] Delete announcement

### Banners
- [ ] Create banner for scout_admin role
- [ ] Create banner for school_admin role
- [ ] Create banner for xen_scout role
- [ ] Create banner with start/end dates
- [ ] Verify banner appears on correct dashboards
- [ ] Verify banner doesn't appear before start date
- [ ] Verify banner doesn't appear after end date
- [ ] Test category color coding
- [ ] Test priority ordering
- [ ] Edit banner
- [ ] Toggle banner active/inactive
- [ ] Delete banner

### Integration
- [ ] Verify banners appear on scout admin dashboard
- [ ] Verify banners appear on school admin dashboard
- [ ] Verify announcements appear in student feeds
- [ ] Verify no performance regressions

---

## Next Steps

1. ✅ Complete analysis (this document)
2. ⏭️ Create database migration for banners table
3. ⏭️ Implement banner API endpoints
4. ⏭️ Create banner management UI
5. ⏭️ Enhance announcements with multi-school support
6. ⏭️ Integrate banners into dashboards
7. ⏭️ Add promotions placeholder
8. ⏭️ Testing and refinement

---

**Status**: Analysis Complete - Ready for Implementation

