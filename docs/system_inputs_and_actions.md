# LockerRoom System Documentation: Inputs & Actions

## Overview
This document provides a comprehensive mapping of every user interface element in the LockerRoom platform to its corresponding backend implementation requirements. Use this for development planning, QA testing, and system integration verification.

**System Architecture**: Centralized `users` table with `linkedId` references to role-specific tables (`students`, `viewers`, `school_admins`, `system_admins`). JWT authentication with bcrypt password hashing and Cloudinary media storage.

---

## 🎯 **VIEWER PORTAL**

### **Login Page**
| Input/Button | Description | Backend Requirements | API Endpoint | Expected Response |
|---|---|---|---|---|
| Email Input | User login email | Query `users` table where `email = input` | `POST /api/auth/login` | 200 OK → JWT token with linkedId |
| Password Input | User login password | bcrypt comparison with `users.passwordHash` | `POST /api/auth/login` | 401 → show error toast |
| Login Button | Submit login form | JWT token generation with linkedId | `POST /api/auth/login` | 200 → set JWT token, redirect to feed |

**JWT Token Structure**: `{ id, email, role, linkedId }` - linkedId connects to role-specific profile table

### **Public Signup Page**
| Input/Button | Description | Backend Requirements | API Endpoint | Expected Response |
|---|---|---|---|---|
| Email Input | New user email | Check uniqueness in `users` table | `POST /api/auth/register` | Validation error if exists |
| Password Input | New user password | bcrypt hash with 12 salt rounds | `POST /api/auth/register` | Minimum 6 characters |
| Name Input | User display name | Store in both `users.email` and `viewers.name` | `POST /api/auth/register` | Required field |
| Phone Input | Contact number | Store in `viewers.phone` | `POST /api/auth/register` | Optional field |
| Bio Input | User biography | Store in `viewers.bio` | `POST /api/auth/register` | Optional field |
| Register Button | Create new viewer account | Insert `users` + `viewers` records, set `linkedId` | `POST /api/auth/register` | 200 → JWT token, redirect to feed |

### **Feed Page**
| Input/Button | Description | Backend Requirements | API Endpoint | Expected Response |
|---|---|---|---|---|
| Like Button | Toggle post like | Insert/delete from `post_likes` table | `POST/DELETE /api/posts/:id/like` | 200 → update like count |
| Comment Button | Show comment input | Toggle UI state (frontend only) | N/A | Immediate UI toggle |
| Comment Input | Write new comment | Insert into `post_comments` table | `POST /api/posts/:id/comment` | 200 → show in comments |
| Comment Submit | Submit comment | Insert `post_comments` record with `userId`, `postId`, `content` | `POST /api/posts/:id/comment` | 200 → refresh comments |
| Save Button | Toggle post save | Insert/delete from `saved_posts` table | `POST/DELETE /api/posts/:id/save` | 200 → update save count |
| Follow Button | Follow student | Insert into `student_followers` table | `POST /api/students/:id/follow` | 200 → show "Following" |
| View All Comments | Open comments modal | Query `post_comments` table with user data | `GET /api/posts/:id/comments` | 200 → populate modal |

### **Following Page**
| Input/Button | Description | Backend Requirements | API Endpoint | Expected Response |
|---|---|---|---|---|
| Student Avatar | Navigate to profile | Route to student profile (frontend) | N/A | Navigate to `/profile/:id` |
| Unfollow Button | Unfollow student | Delete from `student_followers` table | `DELETE /api/students/:id/follow` | 200 → remove from list |

### **Saved Posts Page**
| Input/Button | Description | Backend Requirements | API Endpoint | Expected Response |
|---|---|---|---|---|
| Unsave Button | Remove from saved | Delete from `saved_posts` table | `DELETE /api/posts/:id/save` | 200 → remove from list |
| View Post | Navigate to original post | Route to feed with post focus | N/A | Navigate to feed |

### **Search Page**
| Input/Button | Description | Backend Requirements | API Endpoint | Expected Response |
|---|---|---|---|---|
| Search Input | Search students | Query `students` table with LIKE on name | `GET /api/search/students?q=term` | 200 → student results |
| Student Result Click | Navigate to profile | Route to student profile | N/A | Navigate to `/profile/:id` |
| Clear Search | Clear search input | Reset UI state (frontend only) | N/A | Clear input field |

### **Settings Page**
| Input/Button | Description | Backend Requirements | API Endpoint | Expected Response |
|---|---|---|---|---|
| Name Input | Update user name | Update `viewers.name` (via linkedId) | `PUT /api/users/:id/profile` | 200 → show success toast |
| Bio Input | Update user bio | Update `viewers.bio` | `PUT /api/users/:id/profile` | 200 → show success toast |
| Phone Input | Update user phone | Update `viewers.phone` | `PUT /api/users/:id/profile` | 200 → show success toast |
| Change Photo Button | Upload profile photo | **Cloudinary server-side upload** → Update `viewers.profilePicUrl` | `PUT /api/users/:id` (multipart) | 200 → update avatar |
| Save Profile Button | Save all profile changes | Update multiple `viewers` columns | `PUT /api/users/:id/profile` | 200 → show success toast |
| Current Password Input | Password change validation | bcrypt comparison with `users.passwordHash` | `POST /api/users/:id/change-password` | 200 → proceed to change |
| New Password Input | New password | bcrypt hash → Update `users.passwordHash` | `POST /api/users/:id/change-password` | 200 → show success toast |
| Confirm Password Input | Password confirmation | Frontend validation only | N/A | Match validation |
| Change Password Button | Submit password change | bcrypt hash and update `users.passwordHash` | `POST /api/users/:id/change-password` | 200 → clear form |
| Logout Button | End user session | Clear JWT token (frontend) | Frontend action | Clear localStorage, redirect to login |

---

## 🏃 **STUDENT PORTAL**

### **Feed Page** (All Viewer features plus:)
| Input/Button | Description | Backend Requirements | API Endpoint | Expected Response |
|---|---|---|---|---|
| Create Post Button | Open post creation modal | UI state change (frontend) | N/A | Show upload modal |
| Upload Media Button | Upload photo/video | **Cloudinary server-side upload** via multer | `POST /api/posts/create` (multipart) | Return `secure_url` |
| Caption Input | Post description | Store as `posts.caption` | `POST /api/posts/create` | 200 → create post |
| Post Submit Button | Create new post | Insert into `posts` table with `studentId` from JWT linkedId | `POST /api/posts/create` | 200 → show in feed |

**Post Creation Flow**: 
1. Student uploads file via multipart form
2. Server uploads to Cloudinary with transformations
3. Server creates post with `mediaUrl`, `mediaType`, `caption`, `studentId` (from JWT linkedId)

### **Profile Page**
| Input/Button | Description | Backend Requirements | API Endpoint | Expected Response |
|---|---|---|---|---|
| Edit Profile Button | Navigate to settings | Route to settings page | N/A | Navigate to `/settings` |
| View Followers | Show followers list | Query `student_followers` table where `studentId = current` | `GET /api/students/:id/followers` | 200 → followers modal |
| View Following | Show following list | Query `student_followers` table where `followerUserId = current` | `GET /api/students/:id/following` | 200 → following modal |

### **Settings Page** (All Viewer settings plus:)
| Input/Button | Description | Backend Requirements | API Endpoint | Expected Response |
|---|---|---|---|---|
| Position Select | Update player position | Update `students.position` (via linkedId) | `PUT /api/students/profile/:id` | 200 → show success toast |
| Jersey Number Input | Update jersey number | Update `students.roleNumber` | `PUT /api/students/profile/:id` | 200 → show success toast |
| Sport Select | Update sport | Update `students.sport` | `PUT /api/students/profile/:id` | 200 → show success toast |
| Gender Select | Update gender | Update `students.gender` | `PUT /api/students/profile/:id` | 200 → show success toast |
| Date of Birth Input | Update birthday | Update `students.dateOfBirth` | `PUT /api/students/profile/:id` | 200 → show success toast |
| Grade Select | Update grade level | Update `students.grade` | `PUT /api/students/profile/:id` | 200 → show success toast |
| Guardian Contact Input | Update emergency contact | Update `students.guardianContact` | `PUT /api/students/profile/:id` | 200 → show success toast |

---

## 🏫 **SCHOOL ADMIN PORTAL**

### **Dashboard Page**
| Input/Button | Description | Backend Requirements | API Endpoint | Expected Response |
|---|---|---|---|---|
| View Analytics Button | Navigate to analytics | Route to analytics page | N/A | Navigate to `/analytics` |
| Manage Students Button | Navigate to student management | Route to students page | N/A | Navigate to `/students` |
| School Settings Button | Navigate to school settings | Route to school settings | N/A | Navigate to `/school-settings` |
| View School Stats | Display student count/activity | Query students/posts for school | `GET /api/schools/:id/stats` | 200 → school metrics |

### **Student Management Page**
| Input/Button | Description | Backend Requirements | API Endpoint | Expected Response |
|---|---|---|---|---|
| Add Student Button | Open add student modal | UI state change | N/A | Show add student form |
| Student Name Input | New student name | Store for `students.name` | `POST /api/school-admin/add-student` | 200 → create student |
| Student Email Input | New student email | Store for `users.email` (must be unique) | `POST /api/school-admin/add-student` | 200 → create student |
| Student Phone Input | Contact number | Store for `students.phone` | `POST /api/school-admin/add-student` | 200 → create student |
| Gender Select | Student gender | Store for `students.gender` | `POST /api/school-admin/add-student` | 200 → create student |
| Date of Birth Input | Student birthday | Store for `students.dateOfBirth` | `POST /api/school-admin/add-student` | 200 → create student |
| Grade Select | Grade level | Store for `students.grade` | `POST /api/school-admin/add-student` | 200 → create student |
| Guardian Contact Input | Emergency contact | Store for `students.guardianContact` | `POST /api/school-admin/add-student` | 200 → create student |
| Add Student Button | Create student account | Insert `users` + `students` records, generate 6-digit OTP | `POST /api/school-admin/add-student` | 200 → return OTP for sharing |

**Student Creation Flow**:
1. School admin inputs student data
2. Server validates admin can only add to their own school (`school_admins.schoolId`)
3. Server creates `users` record with bcrypt-hashed 6-digit OTP password
4. Server creates `students` record linked via `users.linkedId`
5. Server returns OTP for admin to share with student

### **School Settings Page**
| Input/Button | Description | Backend Requirements | API Endpoint | Expected Response |
|---|---|---|---|---|
| School Name Input | Update school name | Update `schools.name` | `PUT /api/schools/:id` | 200 → show success toast |
| Max Students Input | Update student limit | Update `schools.maxStudents` | `PUT /api/schools/:id` | 200 → show success toast |
| Subscription Plan Select | Change plan | Update `schools.subscriptionPlan` | `PUT /api/schools/:id/subscription` | 200 → show success toast |

### **Analytics Page**
| Input/Button | Description | Backend Requirements | API Endpoint | Expected Response |
|---|---|---|---|---|
| Date Range Picker | Filter analytics period | Query posts/interactions in date range | `GET /api/schools/:id/analytics?start=date&end=date` | 200 → update charts |
| Export Data Button | Download analytics CSV | Generate CSV from school analytics | `GET /api/schools/:id/analytics/export` | 200 → download file |
| Student Activity Chart | View engagement metrics | Query posts/likes/comments by school students | `GET /api/schools/:id/analytics` | 200 → chart data |

---

## 🔧 **SYSTEM ADMIN PORTAL**

### **System Dashboard**
| Input/Button | Description | Backend Requirements | API Endpoint | Expected Response |
|---|---|---|---|---|
| Total Users Metric | Display user count | Count from `users` table | `GET /api/system/stats` | 200 → system statistics |
| Total Schools Metric | Display school count | Count from `schools` table | `GET /api/system/stats` | 200 → system statistics |
| Total Students Metric | Display student count | Count from `students` table | `GET /api/system/stats` | 200 → system statistics |
| Total Posts Metric | Display content count | Count from `posts` table | `GET /api/system/stats` | 200 → system statistics |
| System Health Check | Check system status | Database and service health | `GET /api/system/health` | 200 → health status |

### **School Management Page**
| Input/Button | Description | Backend Requirements | API Endpoint | Expected Response |
|---|---|---|---|---|
| View Applications Button | Navigate to applications | Route to school applications page | N/A | Navigate to `/school-applications` |
| Add School Button | Open add school modal | UI state change | N/A | Show add school form |
| School Name Input | New school name | Insert into `schools` table | `POST /api/schools` | 200 → create school |
| Subscription Plan Select | Set initial plan | Set `schools.subscriptionPlan` | `POST /api/schools` | 200 → create school |
| Student Limit Input | Set student limit | Set `schools.maxStudents` | `POST /api/schools` | 200 → create school |
| Edit School Button | Open edit modal | Query `schools` table | `GET /api/schools/:id` | 200 → populate form |
| Delete School Button | Remove school | Delete from `schools` table (cascade) | `DELETE /api/schools/:id` | 200 → remove from list |

### **School Applications Page**
| Input/Button | Description | Backend Requirements | API Endpoint | Expected Response |
|---|---|---|---|---|
| View Applications List | Show pending applications | Query `school_applications` where status = "pending" | `GET /api/admin/school-applications` | 200 → applications list |
| Approve Button | Approve school application | Update `school_applications.status`, create `schools` record | `POST /api/admin/school-applications/:id/approve` | 200 → create school |
| Reject Button | Reject application | Update `school_applications.status` to "rejected" | `POST /api/admin/school-applications/:id/reject` | 200 → mark rejected |
| View Details Button | Show application details | Query `school_applications` by id | `GET /api/admin/school-applications/:id` | 200 → full application data |

### **User Management Page**
| Input/Button | Description | Backend Requirements | API Endpoint | Expected Response |
|---|---|---|---|---|
| User Search Input | Search users | Query `users` table with LIKE on email/name | `GET /api/users?search=term` | 200 → user list |
| Role Filter Select | Filter by user role | Query `users` table where `role = selected` | `GET /api/users?role=role` | 200 → filtered users |
| Change Role Button | Update user role | Update `users.role`, handle linkedId migration | `PUT /api/admin/roles/:userId` | 200 → show success |
| Delete User Button | Remove user account | Delete from `users` and linked role table | `DELETE /api/admin/roles/:userId` | 200 → user removed |

### **System Configuration Page**
| Input/Button | Description | Backend Requirements | API Endpoint | Expected Response |
|---|---|---|---|---|
| System Settings Form | Update system config | Update `system_settings` table | `GET/POST /api/admin/system-settings` | 200 → show success toast |
| Add Setting Button | Add new system setting | Insert into `system_settings` table | `POST /api/admin/system-settings` | 200 → setting added |
| Delete Setting Button | Remove system setting | Delete from `system_settings` table | `DELETE /api/admin/system-settings/:key` | 200 → setting removed |

---

## 🔗 **CLOUDINARY INTEGRATION REQUIREMENTS**

### **Server-Side Upload Configuration:**
```javascript
// Multer configuration for file handling
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/mov'];
    cb(null, allowedTypes.includes(file.mimetype));
  }
});

// Cloudinary upload configuration
const cloudinaryConfig = {
  resource_type: "auto", // Automatically detect image/video
  folder: "posts", // or "user-profiles"
  transformation: [
    { width: 800, height: 600, crop: "limit" }, // For posts
    { width: 400, height: 400, crop: "fill", gravity: "face" } // For profiles
  ]
};
```

### **Upload Flow:**
1. User selects file via HTML file input
2. Frontend sends file via multipart/form-data to backend
3. Backend processes with multer middleware
4. Backend uploads to Cloudinary via server-side API
5. Cloudinary returns `secure_url`
6. Backend saves URL to database
7. Backend returns success response with URL
8. Frontend updates UI immediately

### **Required for:**
- **Profile Photo Upload**: `PUT /api/users/:id` (multipart)
- **Student Profile Photo**: `PUT /api/students/profile/:id` (multipart)
- **Post Media Upload**: `POST /api/posts/create` (multipart)

---

## 📊 **DATABASE SCHEMA MAPPING**

### **Core Tables (Current Implementation):**

#### **Centralized Users Table:**
```sql
users: id (uuid), email (unique), passwordHash (bcrypt), role (enum), linkedId (uuid), createdAt
```

#### **Role-Specific Tables:**
```sql
viewers: id (uuid), name, profilePicUrl, bio, phone, createdAt
students: id (uuid), schoolId, name, phone, gender, dateOfBirth, grade, guardianContact, profilePicUrl, roleNumber, position, sport, bio, coverPhoto, createdAt
school_admins: id (uuid), name, schoolId, profilePicUrl, bio, phone, position, createdAt
system_admins: id (uuid), name, profilePicUrl, bio, phone, permissions (array), createdAt
```

#### **Content & Social Tables:**
```sql
schools: id (uuid), name, subscriptionPlan, maxStudents, createdAt
posts: id (uuid), studentId, mediaUrl (not null), mediaType (enum), caption, createdAt
post_likes: id (uuid), postId, userId, createdAt
post_comments: id (uuid), postId, userId, content, createdAt
saved_posts: id (uuid), postId, userId, createdAt
student_followers: id (uuid), followerUserId, studentId, createdAt
school_applications: id (uuid), schoolName, contactEmail, contactName, phone, address, city, state, zipCode, expectedStudents, planType, status, notes, reviewedBy, reviewedAt, createdAt
system_settings: id (uuid), key (unique), value, category, description, updatedBy, updatedAt
```

### **Updated API Endpoint Structure:**
```
Authentication:
POST /api/auth/login
POST /api/auth/register

Users (Multi-role):
GET /api/users/me/:id
PUT /api/users/:id/profile (JSON)
PUT /api/users/:id (multipart - profile picture)
POST /api/users/:id/change-password
GET /api/users/:userId/saved-posts
GET /api/users/:id/following

Students:
GET /api/students/profile/:userId
PUT /api/students/profile/:userId (multipart)
POST /api/students/:id/follow
DELETE /api/students/:id/follow
GET /api/students/:id/followers
GET /api/students/:id/following
GET /api/students/:id/is-following

Posts:
GET /api/posts
GET /api/posts/student/:studentId
POST /api/posts/create (multipart - NEW)
POST /api/posts/:id/like
DELETE /api/posts/:id/like
POST /api/posts/:id/comment
POST /api/posts/:id/save
DELETE /api/posts/:id/save

Schools:
GET /api/schools
GET /api/schools/:id/stats
GET /api/schools/:id/students
GET /api/schools/:id/analytics

School Admin:
POST /api/school-admin/add-student (NEW)
GET /api/schools/:id/settings
POST /api/schools/:id/settings

System Admin:
GET /api/system/stats
GET /api/admin/school-applications
POST /api/admin/school-applications/:id/approve
POST /api/admin/school-applications/:id/reject
GET /api/admin/system-settings
POST /api/admin/system-settings
DELETE /api/admin/system-settings/:key
GET /api/admin/roles
POST /api/admin/roles
PUT /api/admin/roles/:userId
DELETE /api/admin/roles/:userId

Search:
GET /api/search/students

Upload:
POST /api/upload (general purpose)
```

---

## 🎮 **DEMO ACCOUNTS FOR TESTING**

### **Available Demo Accounts:**
```
System Admin:
  Email: admin@lockerroom.com
  Password: admin123
  
School Admin:
  Email: principal@lincoln.edu
  Password: principal123
  School: Lincoln High School
  
Students:
  Email: marcus.rodriguez@student.com
  Password: student123
  School: Lincoln High School
  Role: Team Captain, Midfielder
  
  Email: sophia.chen@student.com
  Password: student123
  School: Lincoln High School
  Role: Forward, #7
  
  Email: jordan.williams@student.com
  Password: student123
  School: Roosevelt Academy
  Role: Goalkeeper, #1
  
Viewers:
  Email: sarah.johnson@viewer.com
  Password: viewer123
  Bio: Proud parent following soccer journey
  
  Email: mike.thompson@viewer.com
  Password: viewer123
  Bio: Local sports enthusiast
```

### **Demo Data Includes:**
- **2 Schools**: Lincoln High School (premium), Roosevelt Academy (standard)
- **10 Posts**: Real Unsplash images and sample videos with engaging captions
- **Social Interactions**: 12 likes, 12 comments, 6 saves, 5 follows
- **Realistic Profiles**: Sports positions, jersey numbers, school associations

### **Demo Data Refresh:**
```bash
# Reset database with fresh demo data
tsx scripts/reseed-demo.ts
```

---

## ✅ **QA TESTING CHECKLIST**

| Portal | Feature | Input/Action | Backend Requirement | Success Criteria | Status |
|---|---|---|---|---|---|
| **Viewer** | Login | Submit credentials | bcrypt verify + JWT generation | JWT token returned, redirect to feed | ✅ |
| **Viewer** | Register | Create account | Insert users + viewers, hash password | Account created, auto-login | ✅ |
| **Viewer** | Like Post | Toggle like | Insert/delete post_likes | Button toggles, count updates | ✅ |
| **Viewer** | Comment | Add comment | Insert post_comments | Comment appears immediately | ✅ |
| **Viewer** | Save Post | Toggle save | Insert/delete saved_posts | Save status updates | ✅ |
| **Viewer** | Follow Student | Toggle follow | Insert/delete student_followers | Follow status updates | ✅ |
| **Viewer** | Update Profile | Save changes | Update viewers via linkedId | Profile updates saved | ✅ |
| **Viewer** | Upload Profile Pic | Change photo | Cloudinary upload + viewers update | Avatar updates immediately | ✅ |
| **Viewer** | Change Password | Update password | bcrypt verify + hash new password | Password changed securely | ✅ |
| **Student** | Create Post | Upload media | Cloudinary + posts insert | Post appears in feed | ✅ |
| **Student** | Update Profile | Student-specific fields | Update students via linkedId | Student profile updated | ✅ |
| **School Admin** | Add Student | Create student account | Insert users + students + OTP generation | Student account created, OTP returned | ✅ |
| **School Admin** | School Boundary | Add student to different school | Reject with 403 error | Operation blocked | ✅ |
| **System Admin** | System Stats | View metrics | Query all tables for counts | Statistics displayed | ✅ |
| **System Admin** | Manage Schools | CRUD operations | Insert/update/delete schools | School management working | ✅ |
| **System Admin** | User Management | Role changes | Update users.role + linkedId handling | Role changes applied | ✅ |

---

## 🔧 **DEVELOPMENT NOTES**

### **Environment Variables Required:**
```bash
# Database
DATABASE_URL=postgresql://user:pass@host:port/dbname

# Cloudinary (Server-side uploads)
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
CLOUDINARY_CLOUD_NAME=your_cloud_name

# Authentication
JWT_SECRET=your_jwt_secret_key_256_bit_minimum

# Optional
NODE_ENV=development
```

### **Key Implementation Patterns:**
1. **Centralized Authentication**: Single `users` table with `linkedId` pointing to role-specific tables
2. **JWT with LinkedId**: Server derives identity using `req.user.linkedId` for role-specific operations
3. **Bcrypt Security**: 12 salt rounds for all password operations
4. **Server-side Uploads**: Direct Cloudinary uploads via backend API, not widget
5. **Type Safety**: Drizzle ORM with TypeScript throughout
6. **React Query**: All API calls with proper cache invalidation
7. **Form Validation**: React Hook Form + Zod schemas from Drizzle

### **Security Implementation:**
1. **Password Requirements**: Minimum 6 characters, bcrypt hashed
2. **JWT Tokens**: Include role and linkedId for server-side authorization
3. **File Upload Security**: MIME type validation, size limits, Cloudinary processing
4. **School Boundaries**: School admins can only manage their own school's students
5. **Role-based Access**: Middleware checks user role and linkedId for all protected routes

### **Testing Strategy:**
1. **Demo Data**: Use `tsx scripts/reseed-demo.ts` for consistent test environment
2. **Unit Tests**: Test individual API endpoints with role-specific scenarios
3. **Integration Tests**: Test complete user workflows (signup → post creation → social interactions)
4. **Security Tests**: Verify school boundaries, role permissions, JWT validation
5. **Media Tests**: Validate Cloudinary uploads, file type restrictions, image transformations

---

*Last Updated: September 11, 2025*
*Version: 2.0*  
*Status: Updated with Centralized Authentication & Demo Data*