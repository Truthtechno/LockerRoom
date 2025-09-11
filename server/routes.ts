import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import bcrypt from "bcrypt";
import { v2 as cloudinary } from "cloudinary";
import { storage } from "./storage";
import { 
  insertUserSchema, 
  insertPostSchema, 
  insertCommentSchema, 
  insertFollowSchema,
  insertSchoolApplicationSchema,
  insertSystemSettingSchema,
  insertAdminRoleSchema,
  insertAnalyticsLogSchema,
  insertStudentSchema,
  insertStudentRatingSchema,
  insertSchoolSettingSchema
} from "@shared/schema";

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Configure multer for file uploads
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
});

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Authentication routes
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ message: "Email and password required" });
      }

      const user = await storage.getUserByEmail(email);
      
      if (!user) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      // Compare password with bcrypt
      const isPasswordValid = await bcrypt.compare(password, user.password);
      
      if (!isPasswordValid) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      // In a real app, you'd use JWT here
      res.json({ 
        user: { 
          id: user.id, 
          name: user.name, 
          email: user.email, 
          role: user.role,
          schoolId: user.schoolId 
        } 
      });
    } catch (error) {
      res.status(500).json({ message: "Login failed" });
    }
  });

  app.post("/api/auth/register", async (req, res) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      const existingUser = await storage.getUserByEmail(userData.email);
      
      if (existingUser) {
        return res.status(400).json({ message: "User already exists" });
      }

      const user = await storage.createUser(userData);
      res.json({ 
        user: { 
          id: user.id, 
          name: user.name, 
          email: user.email, 
          role: user.role,
          schoolId: user.schoolId 
        } 
      });
    } catch (error) {
      res.status(400).json({ message: "Registration failed" });
    }
  });

  // User routes
  app.get("/api/users/me/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json({ 
        id: user.id, 
        name: user.name, 
        email: user.email, 
        role: user.role,
        schoolId: user.schoolId 
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // User profile update (JSON) - for regular profile updates without files
  app.put("/api/users/:userId/profile", async (req, res) => {
    try {
      const { userId } = req.params;
      const updateData = req.body;
      
      const updatedUser = await storage.updateUser(userId, updateData);
      
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json({
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        schoolId: updatedUser.schoolId,
        profilePicUrl: updatedUser.profilePicUrl
      });
    } catch (error) {
      console.error('Update user profile error:', error);
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  // User profile picture update (FormData) - for file uploads
  app.put("/api/users/:userId", upload.single("profilePic"), async (req, res) => {
    try {
      const { userId } = req.params;
      let updateData = { ...req.body };

      // Handle profile picture upload to Cloudinary for users
      if (req.file) {
        const result = await new Promise((resolve, reject) => {
          cloudinary.uploader.upload_stream(
            { 
              resource_type: "image",
              folder: "user-profiles",
              transformation: [
                { width: 400, height: 400, crop: "fill", gravity: "face" }
              ]
            },
            (error, result) => {
              if (error) reject(error);
              else resolve(result);
            }
          ).end(req.file!.buffer);
        });

        updateData.profilePicUrl = (result as any).secure_url;
      }
      
      const updatedUser = await storage.updateUser(userId, updateData);
      
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json({
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        schoolId: updatedUser.schoolId,
        profilePicUrl: updatedUser.profilePicUrl
      });
    } catch (error) {
      console.error('Update user profile error:', error);
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  // Get all comments for a post
  app.get("/api/posts/:postId/comments", async (req, res) => {
    try {
      const { postId } = req.params;
      const comments = await storage.getPostComments(postId);
      res.json(comments);
    } catch (error) {
      console.error('Get post comments error:', error);
      res.status(500).json({ message: "Failed to fetch comments" });
    }
  });

  // Password change endpoint
  app.post("/api/users/:userId/change-password", async (req, res) => {
    try {
      const { userId } = req.params;
      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: "Both current and new password are required" });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({ message: "New password must be at least 6 characters long" });
      }

      // Get user to verify current password
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Verify current password with bcrypt
      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
      if (!isCurrentPasswordValid) {
        return res.status(400).json({ message: "Current password is incorrect" });
      }

      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

      // Update user password
      await storage.updateUser(userId, { password: hashedPassword });

      res.json({ message: "Password updated successfully" });
    } catch (error) {
      console.error('Change password error:', error);
      res.status(500).json({ message: "Failed to change password" });
    }
  });

  // Student routes
  app.get("/api/students/profile/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      const studentWithStats = await storage.getStudentWithStats(userId);
      
      if (!studentWithStats) {
        return res.status(404).json({ message: "Student not found" });
      }

      res.json(studentWithStats);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch student profile" });
    }
  });

  app.put("/api/students/profile/:userId", upload.single("profilePic"), async (req, res) => {
    try {
      const { userId } = req.params;
      const student = await storage.getStudentByUserId(userId);
      
      if (!student) {
        return res.status(404).json({ message: "Student not found" });
      }

      let updateData = { ...req.body };

      // Handle profile picture upload to Cloudinary
      if (req.file) {
        const result = await new Promise((resolve, reject) => {
          cloudinary.uploader.upload_stream(
            { 
              resource_type: "image",
              folder: "student-profiles",
              transformation: [
                { width: 400, height: 400, crop: "fill", gravity: "face" }
              ]
            },
            (error, result) => {
              if (error) reject(error);
              else resolve(result);
            }
          ).end(req.file!.buffer);
        });

        updateData.profilePicUrl = (result as any).secure_url;
      }

      const updatedStudent = await storage.updateStudent(student.id, updateData);
      res.json(updatedStudent);
    } catch (error) {
      console.error('Update student profile error:', error);
      res.status(500).json({ message: "Failed to update student profile" });
    }
  });

  // Post routes
  app.get("/api/posts", async (req, res) => {
    try {
      const posts = await storage.getPosts();
      res.json(posts);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch posts" });
    }
  });

  app.get("/api/posts/student/:studentId", async (req, res) => {
    try {
      const { studentId } = req.params;
      const posts = await storage.getPostsByStudent(studentId);
      res.json(posts);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch student posts" });
    }
  });

  app.post("/api/posts", async (req, res) => {
    try {
      const postData = insertPostSchema.parse(req.body);
      const post = await storage.createPost(postData);
      res.json(post);
    } catch (error) {
      res.status(400).json({ message: "Failed to create post" });
    }
  });

  // Interaction routes
  app.post("/api/posts/:postId/like", async (req, res) => {
    try {
      const { postId } = req.params;
      const { userId } = req.body;
      
      const like = await storage.likePost({ postId, userId });
      res.json(like);
    } catch (error) {
      res.status(400).json({ message: "Failed to like post" });
    }
  });

  app.delete("/api/posts/:postId/like", async (req, res) => {
    try {
      const { postId } = req.params;
      const { userId } = req.body;
      
      await storage.unlikePost(postId, userId);
      res.json({ message: "Post unliked" });
    } catch (error) {
      res.status(400).json({ message: "Failed to unlike post" });
    }
  });

  app.post("/api/posts/:postId/comment", async (req, res) => {
    try {
      const { postId } = req.params;
      const commentData = insertCommentSchema.parse({ ...req.body, postId });
      
      const comment = await storage.commentOnPost(commentData);
      res.json(comment);
    } catch (error) {
      res.status(400).json({ message: "Failed to add comment" });
    }
  });

  app.post("/api/posts/:postId/save", async (req, res) => {
    try {
      const { postId } = req.params;
      const { userId } = req.body;
      
      const save = await storage.savePost({ postId, userId });
      res.json(save);
    } catch (error) {
      res.status(400).json({ message: "Failed to save post" });
    }
  });

  app.delete("/api/posts/:postId/save", async (req, res) => {
    try {
      const { postId } = req.params;
      const { userId } = req.body;
      
      await storage.unsavePost(postId, userId);
      res.json({ message: "Post unsaved" });
    } catch (error) {
      res.status(400).json({ message: "Failed to unsave post" });
    }
  });

  app.get("/api/users/:userId/saved-posts", async (req, res) => {
    try {
      const { userId } = req.params;
      const savedPosts = await storage.getUserSavedPosts(userId);
      res.json(savedPosts);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch saved posts" });
    }
  });

  // School routes
  app.get("/api/schools", async (req, res) => {
    try {
      const schools = await storage.getSchools();
      res.json(schools);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch schools" });
    }
  });

  app.get("/api/schools/:schoolId/stats", async (req, res) => {
    try {
      const { schoolId } = req.params;
      const stats = await storage.getSchoolStats(schoolId);
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch school stats" });
    }
  });

  app.get("/api/schools/:schoolId/students", async (req, res) => {
    try {
      const { schoolId } = req.params;
      const students = await storage.getStudentsBySchool(schoolId);
      res.json(students);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch school students" });
    }
  });

  // System admin routes
  app.get("/api/system/stats", async (req, res) => {
    try {
      const stats = await storage.getSystemStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch system stats" });
    }
  });

  // Cloudinary file upload
  app.post("/api/upload", upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file provided" });
      }

      // Upload to Cloudinary with transformations
      const result = await new Promise((resolve, reject) => {
        cloudinary.uploader.upload_stream(
          {
            folder: "lockerroom",
            transformation: [
              { width: 800, crop: "scale" },
              { quality: "auto:good" },
              { fetch_format: "auto" }
            ],
            resource_type: "auto"
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        ).end(req.file.buffer);
      });

      res.json({ 
        url: (result as any).secure_url,
        public_id: (result as any).public_id,
        format: (result as any).format,
        resource_type: (result as any).resource_type
      });
    } catch (error) {
      console.error('Upload error:', error);
      res.status(500).json({ message: "Upload failed" });
    }
  });

  // Follow/Unfollow routes
  app.post("/api/students/:studentId/follow", async (req, res) => {
    try {
      const { studentId } = req.params;
      const { userId } = req.body;
      
      if (!userId) {
        return res.status(400).json({ message: "User ID required" });
      }

      // Check if already following
      const isAlreadyFollowing = await storage.isFollowing(userId, studentId);
      if (isAlreadyFollowing) {
        return res.status(400).json({ message: "Already following this student" });
      }

      const follow = await storage.followStudent({ followerId: userId, followingId: studentId });
      res.json(follow);
    } catch (error) {
      console.error('Follow error:', error);
      res.status(400).json({ message: "Failed to follow student" });
    }
  });

  app.delete("/api/students/:studentId/follow", async (req, res) => {
    try {
      const { studentId } = req.params;
      const { userId } = req.body;
      
      if (!userId) {
        return res.status(400).json({ message: "User ID required" });
      }

      await storage.unfollowStudent(userId, studentId);
      res.json({ message: "Unfollowed successfully" });
    } catch (error) {
      console.error('Unfollow error:', error);
      res.status(400).json({ message: "Failed to unfollow student" });
    }
  });

  app.get("/api/students/:studentId/followers", async (req, res) => {
    try {
      const { studentId } = req.params;
      const followers = await storage.getFollowers(studentId);
      res.json(followers);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch followers" });
    }
  });

  app.get("/api/users/:userId/following", async (req, res) => {
    try {
      const { userId } = req.params;
      const following = await storage.getFollowing(userId);
      res.json(following);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch following" });
    }
  });

  app.get("/api/students/:studentId/is-following", async (req, res) => {
    try {
      const { studentId } = req.params;
      const { userId } = req.query;
      
      if (!userId) {
        return res.status(400).json({ message: "User ID required" });
      }

      const isFollowing = await storage.isFollowing(userId as string, studentId);
      res.json(isFollowing);
    } catch (error) {
      res.status(500).json({ message: "Failed to check follow status" });
    }
  });

  // Search routes
  app.get("/api/search/students", async (req, res) => {
    try {
      const { q: query, userId } = req.query;
      
      if (!query || typeof query !== 'string') {
        return res.status(400).json({ message: "Search query required" });
      }

      const results = await storage.searchStudents(query, userId as string);
      res.json(results);
    } catch (error) {
      console.error('Search error:', error);
      res.status(500).json({ message: "Search failed" });
    }
  });

  // Public signup route (enhanced from existing register)
  app.post("/api/auth/signup", async (req, res) => {
    try {
      
      const userData = insertUserSchema.parse({
        ...req.body,
        role: "viewer" // Force public users to be viewers
      });
      
      
      const existingUser = await storage.getUserByEmail(userData.email);
      
      if (existingUser) {
        return res.status(400).json({ message: "Email already registered" });
      }

      const user = await storage.createUser(userData);
      res.json({ 
        user: { 
          id: user.id, 
          name: user.name, 
          email: user.email, 
          role: user.role,
          schoolId: user.schoolId 
        },
        message: "Account created successfully! You can now search and follow student athletes."
      });
    } catch (error) {
      console.error('Signup error:', error);
      res.status(400).json({ message: "Registration failed. Please check your information." });
    }
  });

  // Admin School Application Routes
  app.get("/api/admin/school-applications", async (req, res) => {
    try {
      const applications = await storage.getSchoolApplications();
      res.json(applications);
    } catch (error) {
      console.error('Get school applications error:', error);
      res.status(500).json({ message: "Failed to fetch school applications" });
    }
  });

  app.post("/api/admin/school-applications", async (req, res) => {
    try {
      const applicationData = insertSchoolApplicationSchema.parse(req.body);
      const application = await storage.createSchoolApplication(applicationData);
      res.json(application);
    } catch (error) {
      console.error('Create school application error:', error);
      res.status(400).json({ message: "Failed to create school application" });
    }
  });

  app.post("/api/admin/school-applications/:id/approve", async (req, res) => {
    try {
      const { id } = req.params;
      const { reviewerId } = req.body;
      
      if (!reviewerId) {
        return res.status(400).json({ message: "Reviewer ID required" });
      }

      const school = await storage.approveSchoolApplication(id, reviewerId);
      if (!school) {
        return res.status(404).json({ message: "School application not found" });
      }

      res.json({ school, message: "School application approved successfully" });
    } catch (error) {
      console.error('Approve school application error:', error);
      res.status(500).json({ message: "Failed to approve application" });
    }
  });

  app.post("/api/admin/school-applications/:id/reject", async (req, res) => {
    try {
      const { id } = req.params;
      const { reviewerId, notes } = req.body;
      
      if (!reviewerId) {
        return res.status(400).json({ message: "Reviewer ID required" });
      }

      const application = await storage.rejectSchoolApplication(id, reviewerId, notes);
      if (!application) {
        return res.status(404).json({ message: "School application not found" });
      }

      res.json({ application, message: "School application rejected" });
    } catch (error) {
      console.error('Reject school application error:', error);
      res.status(500).json({ message: "Failed to reject application" });
    }
  });

  // Admin System Settings Routes
  app.get("/api/admin/system-settings", async (req, res) => {
    try {
      const settings = await storage.getSystemSettings();
      res.json(settings);
    } catch (error) {
      console.error('Get system settings error:', error);
      res.status(500).json({ message: "Failed to fetch system settings" });
    }
  });

  app.post("/api/admin/system-settings", async (req, res) => {
    try {
      const settingData = insertSystemSettingSchema.parse(req.body);
      const setting = await storage.createOrUpdateSystemSetting(settingData);
      res.json(setting);
    } catch (error) {
      console.error('Update system setting error:', error);
      res.status(400).json({ message: "Failed to update system setting" });
    }
  });

  app.delete("/api/admin/system-settings/:key", async (req, res) => {
    try {
      const { key } = req.params;
      await storage.deleteSystemSetting(key);
      res.json({ message: "System setting deleted successfully" });
    } catch (error) {
      console.error('Delete system setting error:', error);
      res.status(500).json({ message: "Failed to delete system setting" });
    }
  });

  // Admin Role Management Routes
  app.get("/api/admin/roles", async (req, res) => {
    try {
      const roles = await storage.getAdminRoles();
      res.json(roles);
    } catch (error) {
      console.error('Get admin roles error:', error);
      res.status(500).json({ message: "Failed to fetch admin roles" });
    }
  });

  app.post("/api/admin/roles", async (req, res) => {
    try {
      const roleData = insertAdminRoleSchema.parse(req.body);
      const role = await storage.createAdminRole(roleData);
      res.json(role);
    } catch (error) {
      console.error('Create admin role error:', error);
      res.status(400).json({ message: "Failed to create admin role" });
    }
  });

  app.put("/api/admin/roles/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      const updateData = req.body;
      const role = await storage.updateAdminRole(userId, updateData);
      
      if (!role) {
        return res.status(404).json({ message: "Admin role not found" });
      }

      res.json(role);
    } catch (error) {
      console.error('Update admin role error:', error);
      res.status(500).json({ message: "Failed to update admin role" });
    }
  });

  app.delete("/api/admin/roles/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      await storage.deleteAdminRole(userId);
      res.json({ message: "Admin role deleted successfully" });
    } catch (error) {
      console.error('Delete admin role error:', error);
      res.status(500).json({ message: "Failed to delete admin role" });
    }
  });

  // Analytics Routes
  app.post("/api/analytics/log", async (req, res) => {
    try {
      const logData = insertAnalyticsLogSchema.parse(req.body);
      const log = await storage.logAnalyticsEvent(logData);
      res.json(log);
    } catch (error) {
      console.error('Log analytics event error:', error);
      res.status(400).json({ message: "Failed to log analytics event" });
    }
  });

  app.get("/api/analytics/logs", async (req, res) => {
    try {
      const { eventType, limit } = req.query;
      const logs = await storage.getAnalyticsLogs(
        eventType as string, 
        limit ? parseInt(limit as string) : undefined
      );
      res.json(logs);
    } catch (error) {
      console.error('Get analytics logs error:', error);
      res.status(500).json({ message: "Failed to fetch analytics logs" });
    }
  });

  app.get("/api/analytics/stats", async (req, res) => {
    try {
      const stats = await storage.getAnalyticsStats();
      res.json(stats);
    } catch (error) {
      console.error('Get analytics stats error:', error);
      res.status(500).json({ message: "Failed to fetch analytics stats" });
    }
  });

  // Student analytics endpoints
  app.get("/api/students/:studentId/analytics", async (req, res) => {
    try {
      const { studentId } = req.params;
      
      // Get student posts and engagement data
      const posts = await storage.getPostsByStudent(studentId);
      const totalPosts = posts.length;
      
      // Calculate monthly engagement data for the last 6 months
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const now = new Date();
      const monthlyData = [];
      
      for (let i = 5; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthName = monthNames[date.getMonth()];
        const year = date.getFullYear();
        
        // Filter posts for this month
        const monthPosts = posts.filter(post => {
          const postDate = new Date(post.createdAt);
          return postDate.getMonth() === date.getMonth() && postDate.getFullYear() === year;
        });
        
        // Calculate totals for this month
        const monthLikes = monthPosts.reduce((sum, post) => sum + (post.likesCount || 0), 0);
        const monthComments = monthPosts.reduce((sum, post) => sum + (post.commentsCount || 0), 0);
        const monthSaves = monthPosts.reduce((sum, post) => sum + (post.savesCount || 0), 0);
        
        monthlyData.push({
          month: monthName,
          posts: monthPosts.length,
          likes: monthLikes,
          comments: monthComments,
          saves: monthSaves
        });
      }

      // Get student profile for total stats
      const studentStats = await storage.getStudentWithStats(studentId);
      
      res.json({
        monthlyEngagement: monthlyData,
        totalStats: {
          posts: totalPosts,
          likes: studentStats?.totalLikes || 0,
          comments: studentStats?.totalComments || 0,
          saves: studentStats?.totalSaves || 0,
          views: studentStats?.totalViews || 0,
          followers: studentStats?.followersCount || 0
        }
      });
    } catch (error) {
      console.error('Get student analytics error:', error);
      res.status(500).json({ message: "Failed to fetch student analytics" });
    }
  });

  app.get("/api/students/:studentId/performance", async (req, res) => {
    try {
      const { studentId } = req.params;
      
      // Mock sports performance data based on student's sport
      const student = await storage.getStudentById(studentId);
      if (!student) {
        return res.status(404).json({ message: "Student not found" });
      }

      // Generate realistic performance data based on student's sport
      const sportsSkills = {
        'Soccer': [
          { skill: 'Dribbling', score: Math.floor(Math.random() * 30) + 70, target: 90 },
          { skill: 'Passing', score: Math.floor(Math.random() * 30) + 70, target: 88 },
          { skill: 'Shooting', score: Math.floor(Math.random() * 30) + 70, target: 85 },
          { skill: 'Defense', score: Math.floor(Math.random() * 30) + 70, target: 80 },
          { skill: 'Speed', score: Math.floor(Math.random() * 30) + 70, target: 90 },
          { skill: 'Teamwork', score: Math.floor(Math.random() * 30) + 80, target: 95 }
        ],
        'Basketball': [
          { skill: 'Shooting', score: Math.floor(Math.random() * 30) + 70, target: 90 },
          { skill: 'Dribbling', score: Math.floor(Math.random() * 30) + 70, target: 85 },
          { skill: 'Defense', score: Math.floor(Math.random() * 30) + 70, target: 88 },
          { skill: 'Rebounding', score: Math.floor(Math.random() * 30) + 70, target: 82 },
          { skill: 'Passing', score: Math.floor(Math.random() * 30) + 70, target: 85 },
          { skill: 'Free Throws', score: Math.floor(Math.random() * 30) + 70, target: 95 }
        ]
      };

      const skills = sportsSkills[student.sport as keyof typeof sportsSkills] || sportsSkills['Soccer'];
      
      // Generate monthly goals data
      const monthlyGoals = [];
      for (let i = 5; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const monthName = monthNames[date.getMonth()];
        
        const totalGoals = Math.floor(Math.random() * 5) + 8; // 8-12 goals
        const completed = Math.floor(Math.random() * totalGoals) + Math.floor(totalGoals * 0.6); // 60-100% completion
        
        monthlyGoals.push({
          month: monthName,
          completed: Math.min(completed, totalGoals),
          total: totalGoals
        });
      }

      res.json({
        sportsPerformance: skills,
        monthlyGoals: monthlyGoals,
        overallRating: Math.floor(Math.random() * 20) + 80 // 80-100 rating
      });
    } catch (error) {
      console.error('Get student performance error:', error);
      res.status(500).json({ message: "Failed to fetch student performance data" });
    }
  });

  // School Admin Student Management Routes
  app.get("/api/schools/:schoolId/students", async (req, res) => {
    try {
      const { schoolId } = req.params;
      const students = await storage.getStudentsBySchool(schoolId);
      res.json(students);
    } catch (error) {
      console.error('Get school students error:', error);
      res.status(500).json({ message: "Failed to fetch school students" });
    }
  });

  app.post("/api/schools/:schoolId/students", upload.single("profilePic"), async (req, res) => {
    try {
      const { schoolId } = req.params;
      
      // First check for duplicate email in users
      const existingUser = await storage.getUserByEmail(req.body.email);
      if (existingUser) {
        return res.status(400).json({ message: "User with this email already exists" });
      }

      // Handle profile picture upload to Cloudinary
      let profilePicUrl = null;
      if (req.file) {
        const result = await new Promise((resolve, reject) => {
          cloudinary.uploader.upload_stream(
            { 
              resource_type: "image",
              folder: "student-profiles",
              transformation: [
                { width: 400, height: 400, crop: "fill", gravity: "face" }
              ]
            },
            (error, result) => {
              if (error) reject(error);
              else resolve(result);
            }
          ).end(req.file!.buffer);
        });

        profilePicUrl = (result as any).secure_url;
      }

      // Create user first
      const userData = insertUserSchema.parse({
        name: req.body.name,
        email: req.body.email,
        password: await bcrypt.hash("TempPassword123!", 10), // Temporary password
        role: "student",
        schoolId: schoolId,
      });

      const user = await storage.createUser(userData);

      // Create student record with userId
      const studentData = insertStudentSchema.parse({
        userId: user.id,
        schoolId: schoolId,
        name: req.body.name,
        email: req.body.email,
        phone: req.body.phone || null,
        gender: req.body.gender || null,
        dateOfBirth: req.body.dateOfBirth || null,
        grade: req.body.grade || null,
        guardianContact: req.body.guardianContact || null,
        profilePicUrl: profilePicUrl,
        roleNumber: req.body.roleNumber || null,
        position: req.body.position || null,
        sport: req.body.sport || null,
        bio: req.body.bio || null,
      });

      const student = await storage.createStudent(studentData);
      
      // Log analytics event
      await storage.logAnalyticsEvent({
        eventType: "student_created",
        entityId: student.id,
        entityType: "student",
        metadata: JSON.stringify({ schoolId }),
      });

      res.json(student);
    } catch (error) {
      console.error('Create student error:', error);
      res.status(400).json({ message: "Failed to create student" });
    }
  });

  app.get("/api/students/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const student = await storage.getStudent(id);
      if (!student) {
        return res.status(404).json({ message: "Student not found" });
      }
      res.json(student);
    } catch (error) {
      console.error('Get student error:', error);
      res.status(500).json({ message: "Failed to fetch student" });
    }
  });

  app.put("/api/students/:id", upload.single("profilePic"), async (req, res) => {
    try {
      const { id } = req.params;
      let updates = req.body;

      // Handle profile picture upload to Cloudinary
      if (req.file) {
        const result = await new Promise((resolve, reject) => {
          cloudinary.uploader.upload_stream(
            { 
              resource_type: "image",
              folder: "student-profiles",
              transformation: [
                { width: 400, height: 400, crop: "fill", gravity: "face" }
              ]
            },
            (error, result) => {
              if (error) reject(error);
              else resolve(result);
            }
          ).end(req.file!.buffer);
        });

        updates.profilePicUrl = (result as any).secure_url;
      }

      const student = await storage.updateStudent(id, updates);
      if (!student) {
        return res.status(404).json({ message: "Student not found" });
      }
      res.json(student);
    } catch (error) {
      console.error('Update student error:', error);
      res.status(500).json({ message: "Failed to update student" });
    }
  });

  app.delete("/api/students/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteStudent(id);
      res.json({ message: "Student deleted successfully" });
    } catch (error) {
      console.error('Delete student error:', error);
      res.status(500).json({ message: "Failed to delete student" });
    }
  });

  app.get("/api/schools/:schoolId/students/search", async (req, res) => {
    try {
      const { schoolId } = req.params;
      const { q: query } = req.query;
      
      if (!query || typeof query !== 'string') {
        return res.status(400).json({ message: "Search query required" });
      }

      const students = await storage.searchSchoolStudents(schoolId, query);
      res.json(students);
    } catch (error) {
      console.error('Search school students error:', error);
      res.status(500).json({ message: "Search failed" });
    }
  });

  // Student Rating Routes
  app.get("/api/students/:studentId/ratings", async (req, res) => {
    try {
      const { studentId } = req.params;
      const ratings = await storage.getStudentRatings(studentId);
      const averageRating = await storage.getAverageRating(studentId);
      res.json({ ratings, averageRating });
    } catch (error) {
      console.error('Get student ratings error:', error);
      res.status(500).json({ message: "Failed to fetch student ratings" });
    }
  });

  app.post("/api/students/:studentId/ratings", async (req, res) => {
    try {
      const { studentId } = req.params;
      
      // TODO: Get the current user from session/auth
      // For now, using a placeholder - in real app this would come from authenticated user
      const ratedBy = req.headers['x-user-id'] || 'admin-placeholder';
      
      const ratingData = insertStudentRatingSchema.parse({
        ...req.body,
        studentId,
        ratedBy,
      });

      const rating = await storage.createStudentRating(ratingData);
      res.json(rating);
    } catch (error) {
      console.error('Create student rating error:', error);
      res.status(400).json({ message: "Failed to create student rating" });
    }
  });

  app.put("/api/ratings/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      
      const rating = await storage.updateStudentRating(id, updates);
      if (!rating) {
        return res.status(404).json({ message: "Rating not found" });
      }
      res.json(rating);
    } catch (error) {
      console.error('Update student rating error:', error);
      res.status(500).json({ message: "Failed to update student rating" });
    }
  });

  app.delete("/api/ratings/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteStudentRating(id);
      res.json({ message: "Rating deleted successfully" });
    } catch (error) {
      console.error('Delete student rating error:', error);
      res.status(500).json({ message: "Failed to delete student rating" });
    }
  });

  // School Settings Routes
  app.get("/api/schools/:schoolId/settings", async (req, res) => {
    try {
      const { schoolId } = req.params;
      const settings = await storage.getSchoolSettings(schoolId);
      res.json(settings);
    } catch (error) {
      console.error('Get school settings error:', error);
      res.status(500).json({ message: "Failed to fetch school settings" });
    }
  });

  app.post("/api/schools/:schoolId/settings", async (req, res) => {
    try {
      const { schoolId } = req.params;
      const settingData = insertSchoolSettingSchema.parse({
        ...req.body,
        schoolId,
      });

      const setting = await storage.createOrUpdateSchoolSetting(settingData);
      res.json(setting);
    } catch (error) {
      console.error('Update school setting error:', error);
      res.status(400).json({ message: "Failed to update school setting" });
    }
  });

  app.delete("/api/schools/:schoolId/settings/:key", async (req, res) => {
    try {
      const { schoolId, key } = req.params;
      await storage.deleteSchoolSetting(schoolId, key);
      res.json({ message: "School setting deleted successfully" });
    } catch (error) {
      console.error('Delete school setting error:', error);
      res.status(500).json({ message: "Failed to delete school setting" });
    }
  });

  // Enhanced school stats for analytics
  app.get("/api/schools/:schoolId/analytics", async (req, res) => {
    try {
      const { schoolId } = req.params;
      
      const students = await storage.getStudentsBySchool(schoolId);
      const totalStudents = students.length;
      
      // Get ratings statistics
      const ratingsStats = await Promise.all(
        students.map(async (student) => {
          const avgRating = await storage.getAverageRating(student.id);
          const ratings = await storage.getStudentRatings(student.id);
          return { studentId: student.id, avgRating, ratingsCount: ratings.length };
        })
      );

      const averageSchoolRating = ratingsStats.length > 0 
        ? ratingsStats.reduce((sum, stat) => sum + stat.avgRating, 0) / ratingsStats.length
        : 0;

      // Grade distribution
      const gradeDistribution = students.reduce((acc, student) => {
        const grade = student.grade || 'Unknown';
        acc[grade] = (acc[grade] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // Gender distribution  
      const genderDistribution = students.reduce((acc, student) => {
        const gender = student.gender || 'Not specified';
        acc[gender] = (acc[gender] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      res.json({
        totalStudents,
        averageSchoolRating: Math.round(averageSchoolRating * 100) / 100,
        gradeDistribution,
        genderDistribution,
        ratingsStats: ratingsStats.filter(stat => stat.ratingsCount > 0),
      });
    } catch (error) {
      console.error('Get school analytics error:', error);
      res.status(500).json({ message: "Failed to fetch school analytics" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
