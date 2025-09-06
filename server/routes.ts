import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertUserSchema, insertPostSchema, insertCommentSchema } from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Authentication routes
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ message: "Email and password required" });
      }

      const user = await storage.getUserByEmail(email);
      if (!user || user.password !== password) {
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

  app.put("/api/students/profile/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      const student = await storage.getStudentByUserId(userId);
      
      if (!student) {
        return res.status(404).json({ message: "Student not found" });
      }

      const updatedStudent = await storage.updateStudent(student.id, req.body);
      res.json(updatedStudent);
    } catch (error) {
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

  // File upload placeholder (ready for Cloudinary integration)
  app.post("/api/upload", async (req, res) => {
    try {
      // TODO: Implement Cloudinary upload
      // For now, return a placeholder URL
      const { file } = req.body;
      const mockUrl = "https://images.unsplash.com/photo-1546519638-68e109498ffc?auto=format&fit=crop&w=800&h=600";
      res.json({ url: mockUrl });
    } catch (error) {
      res.status(500).json({ message: "Upload failed" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
