# LockerRoom System Documentation: Inputs & Actions

## Overview
This document provides a comprehensive mapping of every user interface element in the LockerRoom platform to its corresponding backend implementation requirements. Use this for development planning, QA testing, and system integration verification.

---

## 🎯 **VIEWER PORTAL**

### **Login Page**
| Input/Button | Description | Backend Requirements | API Endpoint | Expected Response |
|---|---|---|---|---|
| Email Input | User login email | Query `users` table where `email = input` | `POST /api/auth/login` | 200 OK → redirect to feed |
| Password Input | User login password | bcrypt comparison with `users.password` | `POST /api/auth/login` | 401 → show error toast |
| Login Button | Submit login form | Session creation in `connect-pg-simple` | `POST /api/auth/login` | 200 → set user context |

### **Feed Page**
| Input/Button | Description | Backend Requirements | API Endpoint | Expected Response |
|---|---|---|---|---|
| Like Button | Toggle post like | Insert/delete from `likes` table | `POST/DELETE /api/posts/:id/like` | 200 → update like count |
| Comment Button | Show comment input | Toggle UI state (frontend only) | N/A | Immediate UI toggle |
| Comment Input | Write new comment | Insert into `comments` table | `POST /api/posts/:id/comment` | 200 → show in comments |
| Comment Submit | Submit comment | Insert `comments` record with `userId`, `postId`, `content` | `POST /api/posts/:id/comment` | 200 → refresh comments |
| Save Button | Toggle post save | Insert/delete from `saves` table | `POST/DELETE /api/posts/:id/save` | 200 → update save count |
| Follow Button | Follow student | Insert into `follows` table | `POST /api/students/:id/follow` | 200 → show "Following" |
| View All Comments | Open comments modal | Query `comments` table with user data | `GET /api/posts/:id/comments` | 200 → populate modal |

### **Following Page**
| Input/Button | Description | Backend Requirements | API Endpoint | Expected Response |
|---|---|---|---|---|
| Student Avatar | Navigate to profile | Route to student profile (frontend) | N/A | Navigate to `/profile/:id` |
| Unfollow Button | Unfollow student | Delete from `follows` table | `DELETE /api/students/:id/follow` | 200 → remove from list |

### **Saved Posts Page**
| Input/Button | Description | Backend Requirements | API Endpoint | Expected Response |
|---|---|---|---|---|
| Unsave Button | Remove from saved | Delete from `saves` table | `DELETE /api/posts/:id/save` | 200 → remove from list |
| View Post | Navigate to original post | Route to feed with post focus | N/A | Navigate to feed |

### **Search Page**
| Input/Button | Description | Backend Requirements | API Endpoint | Expected Response |
|---|---|---|---|---|
| Search Input | Search students/posts | Query `students` and `posts` tables with LIKE | `GET /api/search?q=term` | 200 → search results |
| Student Result Click | Navigate to profile | Route to student profile | N/A | Navigate to `/profile/:id` |
| Clear Search | Clear search input | Reset UI state (frontend only) | N/A | Clear input field |

### **Settings Page**
| Input/Button | Description | Backend Requirements | API Endpoint | Expected Response |
|---|---|---|---|---|
| Name Input | Update user name | Update `users.name` | `PUT /api/users/:id/profile` | 200 → show success toast |
| Bio Input | Update user bio | Update `users.bio` | `PUT /api/users/:id/profile` | 200 → show success toast |
| Phone Input | Update user phone | Update `users.phone` | `PUT /api/users/:id/profile` | 200 → show success toast |
| Change Photo Button | Upload profile photo | **Cloudinary upload** → Update `users.profilePicUrl` | `PUT /api/users/:id/profile` | 200 → update avatar |
| Save Profile Button | Save all profile changes | Update multiple `users` columns | `PUT /api/users/:id/profile` | 200 → show success toast |
| Current Password Input | Password change validation | bcrypt comparison with `users.password` | `POST /api/users/:id/change-password` | 200 → proceed to change |
| New Password Input | New password | bcrypt hash → Update `users.password` | `POST /api/users/:id/change-password` | 200 → show success toast |
| Confirm Password Input | Password confirmation | Frontend validation only | N/A | Match validation |
| Change Password Button | Submit password change | bcrypt hash and update `users.password` | `POST /api/users/:id/change-password` | 200 → clear form |
| Logout Button | End user session | Destroy session in `connect-pg-simple` | `POST /api/auth/logout` | 200 → redirect to login |

---

## 🏃 **STUDENT PORTAL**

### **Feed Page** (All Viewer features plus:)
| Input/Button | Description | Backend Requirements | API Endpoint | Expected Response |
|---|---|---|---|---|
| Create Post Button | Open post creation modal | UI state change (frontend) | N/A | Show upload modal |
| Upload Media Button | Upload photo/video | **Cloudinary upload** | Cloudinary Widget | Return media URL |
| Caption Input | Post description | Store as `posts.caption` | `POST /api/posts` | 200 → create post |
| Post Submit Button | Create new post | Insert into `posts` table with `studentId`, `mediaUrl`, `caption` | `POST /api/posts` | 200 → show in feed |

### **Profile Page**
| Input/Button | Description | Backend Requirements | API Endpoint | Expected Response |
|---|---|---|---|---|
| Edit Profile Button | Navigate to settings | Route to settings page | N/A | Navigate to `/settings` |
| View Followers | Show followers list | Query `follows` table where `studentId = current` | `GET /api/students/:id/followers` | 200 → followers modal |
| View Following | Show following list | Query `follows` table where `userId = current` | `GET /api/students/:id/following` | 200 → following modal |

### **Settings Page** (All Viewer settings plus:)
| Input/Button | Description | Backend Requirements | API Endpoint | Expected Response |
|---|---|---|---|---|
| Position Select | Update player position | Update `students.position` | `PUT /api/students/profile/:id` | 200 → show success toast |
| Jersey Number Input | Update jersey number | Update `students.roleNumber` | `PUT /api/students/profile/:id` | 200 → show success toast |
| Sport Select | Update sport | Update `students.sport` | `PUT /api/students/profile/:id` | 200 → show success toast |

---

## 🏫 **SCHOOL ADMIN PORTAL**

### **Dashboard Page**
| Input/Button | Description | Backend Requirements | API Endpoint | Expected Response |
|---|---|---|---|---|
| View Analytics Button | Navigate to analytics | Route to analytics page | N/A | Navigate to `/analytics` |
| Manage Students Button | Navigate to student management | Route to students page | N/A | Navigate to `/students` |
| School Settings Button | Navigate to school settings | Route to school settings | N/A | Navigate to `/school-settings` |

### **Student Management Page**
| Input/Button | Description | Backend Requirements | API Endpoint | Expected Response |
|---|---|---|---|---|
| Add Student Button | Open add student modal | UI state change | N/A | Show add student form |
| Student Name Input | New student name | Store for `students.name` and `users.name` | `POST /api/students` | 200 → create student |
| Student Email Input | New student email | Store for `students.email` and `users.email` | `POST /api/students` | 200 → create student |
| Generate Password Button | Create one-time password | Insert into `invitations` table | `POST /api/students` | 200 → show password |
| Send Invite Button | Send invitation email | Email service integration | `POST /api/students/invite` | 200 → show sent status |
| Edit Student Button | Open edit modal | Query `students` table | `GET /api/students/:id` | 200 → populate form |
| Delete Student Button | Remove student | Delete from `students` and `users` tables | `DELETE /api/students/:id` | 200 → remove from list |
| Suspend Student Button | Suspend account | Update `students.status` or `users.active` | `PUT /api/students/:id/suspend` | 200 → show suspended |

### **School Settings Page**
| Input/Button | Description | Backend Requirements | API Endpoint | Expected Response |
|---|---|---|---|---|
| School Name Input | Update school name | Update `schools.name` | `PUT /api/schools/:id` | 200 → show success toast |
| Max Students Input | Update student limit | Update `schools.maxStudents` | `PUT /api/schools/:id` | 200 → show success toast |
| Subscription Plan Select | Change plan | Update `schools.subscriptionPlan` | `PUT /api/schools/:id/subscription` | 200 → show success toast |

### **Analytics Page**
| Input/Button | Description | Backend Requirements | API Endpoint | Expected Response |
|---|---|---|---|---|
| Date Range Picker | Filter analytics period | Query posts/interactions in date range | `GET /api/analytics?start=date&end=date` | 200 → update charts |
| Export Data Button | Download analytics CSV | Generate CSV from analytics data | `GET /api/analytics/export` | 200 → download file |

---

## 🔧 **SYSTEM ADMIN PORTAL**

### **System Dashboard**
| Input/Button | Description | Backend Requirements | API Endpoint | Expected Response |
|---|---|---|---|---|
| Total Users Metric | Display user count | Count from `users` table | `GET /api/system/stats` | 200 → system statistics |
| Total Schools Metric | Display school count | Count from `schools` table | `GET /api/system/stats` | 200 → system statistics |
| System Health Check | Check system status | Database and service health | `GET /api/system/health` | 200 → health status |

### **School Management Page**
| Input/Button | Description | Backend Requirements | API Endpoint | Expected Response |
|---|---|---|---|---|
| Add School Button | Open add school modal | UI state change | N/A | Show add school form |
| School Name Input | New school name | Insert into `schools` table | `POST /api/schools` | 200 → create school |
| Subscription Plan Select | Set initial plan | Set `schools.subscriptionPlan` | `POST /api/schools` | 200 → create school |
| Student Limit Input | Set student limit | Set `schools.maxStudents` | `POST /api/schools` | 200 → create school |
| Edit School Button | Open edit modal | Query `schools` table | `GET /api/schools/:id` | 200 → populate form |
| Delete School Button | Remove school | Delete from `schools` table (cascade) | `DELETE /api/schools/:id` | 200 → remove from list |

### **User Management Page**
| Input/Button | Description | Backend Requirements | API Endpoint | Expected Response |
|---|---|---|---|---|
| User Search Input | Search users | Query `users` table with LIKE | `GET /api/users?search=term` | 200 → user list |
| Role Filter Select | Filter by user role | Query `users` table where `role = selected` | `GET /api/users?role=role` | 200 → filtered users |
| Change Role Button | Update user role | Update `users.role` | `PUT /api/users/:id/role` | 200 → show success |
| Suspend User Button | Suspend account | Update `users.active = false` | `PUT /api/users/:id/suspend` | 200 → show suspended |
| Reset Password Button | Generate new password | Update `users.password` and send email | `POST /api/users/:id/reset-password` | 200 → show success |

### **System Configuration Page**
| Input/Button | Description | Backend Requirements | API Endpoint | Expected Response |
|---|---|---|---|---|
| Global Settings Form | Update system config | Update `system_config` table | `PUT /api/system/config` | 200 → show success toast |
| Database Backup Button | Trigger backup | Database backup service | `POST /api/system/backup` | 200 → backup initiated |
| System Maintenance Toggle | Enable/disable maintenance | Update `system_config.maintenance` | `PUT /api/system/maintenance` | 200 → toggle status |

---

## 🔗 **CLOUDINARY INTEGRATION REQUIREMENTS**

### **Required for:**
- **Profile Photo Upload** (All user types)
- **Post Media Upload** (Students only)
- **Cover Photo Upload** (Students only)

### **Cloudinary Configuration:**
```javascript
{
  cloudName: process.env.VITE_CLOUDINARY_CLOUD_NAME,
  uploadPreset: 'ml_default', // Unsigned preset
  sources: ['local', 'camera'],
  multiple: false,
  resourceType: 'auto', // image or video
  clientAllowedFormats: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'mp4', 'mov'],
  maxFileSize: 5000000, // 5MB for images, 50MB for videos
  cropping: true, // For profile photos only
  folder: 'profile_photos' // or 'posts', 'covers'
}
```

### **Upload Flow:**
1. User clicks upload button
2. Cloudinary widget opens
3. User selects/captures media
4. Cloudinary processes and returns `secure_url`
5. Frontend sends `secure_url` to backend
6. Backend updates appropriate database field
7. Frontend updates UI with new media

---

## 📊 **DATABASE TABLE MAPPING**

### **Core Tables:**
- **`users`**: id, name, email, password, role, schoolId, profilePicUrl, bio, phone, createdAt
- **`schools`**: id, name, subscriptionPlan, maxStudents, createdAt
- **`students`**: id, userId, schoolId, name, email, phone, profilePicUrl, roleNumber, position, sport, bio, createdAt
- **`posts`**: id, studentId, mediaUrl, mediaType, caption, createdAt
- **`comments`**: id, postId, userId, content, createdAt
- **`likes`**: id, postId, userId, createdAt
- **`saves`**: id, postId, userId, createdAt
- **`follows`**: id, studentId, userId, createdAt

### **API Endpoint Structure:**
```
Authentication:
POST /api/auth/login
POST /api/auth/logout

Users:
GET /api/users/me/:id
PUT /api/users/:id/profile
POST /api/users/:id/change-password
GET /api/users/:id/saved-posts
GET /api/users/:id/following

Students:
GET /api/students
POST /api/students
GET /api/students/:id
PUT /api/students/profile/:id
DELETE /api/students/:id
POST /api/students/:id/follow
DELETE /api/students/:id/follow
GET /api/students/:id/followers
GET /api/students/:id/following

Posts:
GET /api/posts
POST /api/posts
GET /api/posts/:id/comments
POST /api/posts/:id/comment
POST /api/posts/:id/like
DELETE /api/posts/:id/like
POST /api/posts/:id/save
DELETE /api/posts/:id/save

Schools:
GET /api/schools
POST /api/schools
GET /api/schools/:id
PUT /api/schools/:id
DELETE /api/schools/:id

System:
GET /api/system/stats
GET /api/system/health
PUT /api/system/config
POST /api/system/backup
```

---

## ✅ **QA TESTING CHECKLIST**

| Portal | Page | Input/Button | Expected Backend Action | Success Criteria | Test Status |
|---|---|---|---|---|---|
| **Viewer** | Login | Login Button | Query users table, create session | 200 response, redirect to feed | ❌ |
| **Viewer** | Feed | Like Button | Insert/delete likes table | Like count updates, button toggles | ❌ |
| **Viewer** | Feed | Comment Submit | Insert comments table | Comment appears, count updates | ❌ |
| **Viewer** | Feed | Save Button | Insert/delete saves table | Save count updates, button toggles | ❌ |
| **Viewer** | Feed | Follow Button | Insert follows table | Button shows "Following" | ❌ |
| **Viewer** | Feed | View All Comments | Query comments with users | Modal opens with user data | ❌ |
| **Viewer** | Settings | Save Profile | Update users table | Success toast, profile updates | ❌ |
| **Viewer** | Settings | Change Photo | Cloudinary → Update users.profilePicUrl | Avatar updates immediately | ❌ |
| **Viewer** | Settings | Change Password | bcrypt check → Update users.password | Success toast, form clears | ❌ |
| **Viewer** | Following | Unfollow Button | Delete from follows table | Student removed from list | ❌ |
| **Viewer** | Search | Search Input | Query students/posts tables | Results populate correctly | ❌ |
| **Student** | Feed | Create Post | Cloudinary → Insert posts table | Post appears in feed | ❌ |
| **Student** | Settings | Position Select | Update students.position | Success toast, profile updates | ❌ |
| **Student** | Settings | Jersey Number | Update students.roleNumber | Success toast, profile updates | ❌ |
| **School Admin** | Students | Add Student | Insert students + users tables | Student created, invite sent | ❌ |
| **School Admin** | Students | Delete Student | Delete from students/users | Student removed from list | ❌ |
| **School Admin** | Settings | School Name | Update schools.name | Success toast, name updates | ❌ |
| **School Admin** | Settings | Student Limit | Update schools.maxStudents | Success toast, limit updates | ❌ |
| **System Admin** | Schools | Add School | Insert schools table | School created successfully | ❌ |
| **System Admin** | Schools | Delete School | Delete from schools (cascade) | School and data removed | ❌ |
| **System Admin** | Users | Change Role | Update users.role | Role updated, permissions change | ❌ |
| **System Admin** | Users | Suspend User | Update users.active | User cannot login | ❌ |
| **System Admin** | Config | System Settings | Update system_config table | Settings applied globally | ❌ |

---

## 🔧 **DEVELOPMENT NOTES**

### **Environment Variables Required:**
```bash
DATABASE_URL=postgresql://...
VITE_CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
SESSION_SECRET=your_session_secret
```

### **Key Implementation Patterns:**
1. **All mutations use React Query** with proper cache invalidation
2. **All uploads use Cloudinary widget** with error handling
3. **All forms use React Hook Form** with Zod validation
4. **All API responses follow** consistent format: `{ success: boolean, data: any, error?: string }`
5. **All database operations use Drizzle ORM** with type safety
6. **All authentication checks use** session-based auth with `connect-pg-simple`

### **Testing Strategy:**
1. **Unit Tests**: Individual component interactions
2. **Integration Tests**: API endpoint functionality
3. **E2E Tests**: Complete user workflows
4. **Performance Tests**: Database query optimization
5. **Security Tests**: Authentication and authorization

---

*Last Updated: September 11, 2025*
*Version: 1.0*
*Status: Complete System Documentation*