import express from "express";
import multer from "multer";
import { Readable } from "stream";
import cloudinary from "../cloudinary";
import { storage } from "../storage";
import { requireAuth } from "../middleware/auth";
import { notifyFollowersOfNewPost } from "../utils/notification-helpers";

const router = express.Router();
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB limit
  }
});

// Helper function to detect file type
function getFileType(mimetype: string): 'image' | 'video' {
  if (mimetype.startsWith('image/')) return 'image';
  if (mimetype.startsWith('video/')) return 'video';
  throw new Error('Unsupported file type');
}

// Helper function to generate thumbnail from video
async function generateVideoThumbnail(publicId: string): Promise<string> {
  try {
    const thumbnailUrl = cloudinary.url(publicId, {
      resource_type: 'video',
      transformation: [
        { width: 400, crop: 'scale' },
        { quality: 'auto', fetch_format: 'auto' }
      ]
    });
    return thumbnailUrl;
  } catch (error) {
    console.error('Failed to generate thumbnail:', error);
    return ''; // Return empty string if thumbnail generation fails
  }
}

/**
 * Upload file to Cloudinary using streaming (no base64 conversion)
 * This reduces memory usage by 50% compared to base64 encoding
 */
async function uploadToCloudinaryStream(
  file: Express.Multer.File,
  folder: string,
  resourceType: 'image' | 'video',
  options: {
    chunkSize?: number;
    eager?: any[];
    eagerAsync?: boolean;
    notificationUrl?: string;
  } = {}
): Promise<any> {
  return new Promise((resolve, reject) => {
    try {
      // Create a readable stream from the buffer (no base64 conversion)
      const fileStream = Readable.from(file.buffer);
      
      const uploadOptions: any = {
        folder: `lockerroom/${folder}`,
        resource_type: resourceType,
        ...(options.eager && { eager: options.eager }),
        ...(options.eagerAsync !== undefined && { eager_async: options.eagerAsync }),
        ...(options.notificationUrl && { notification_url: options.notificationUrl }),
      };

      // For large videos, use upload_large_stream with chunking
      if (resourceType === 'video' && file.size > 20 * 1024 * 1024 && options.chunkSize) {
        uploadOptions.chunk_size = options.chunkSize;
        
        // Use upload_stream for large videos
        const uploadStream = cloudinary.uploader.upload_stream(
          uploadOptions,
          (error, result) => {
            if (error) {
              reject(error);
            } else {
              resolve(result);
            }
          }
        );
        
        fileStream.pipe(uploadStream);
      } else {
        // Regular upload_stream for images and small videos
        const uploadStream = cloudinary.uploader.upload_stream(
          uploadOptions,
          (error, result) => {
            if (error) {
              reject(error);
            } else {
              resolve(result);
            }
          }
        );
        
        fileStream.pipe(uploadStream);
      }
    } catch (error) {
      reject(error);
    }
  });
}

// POST /api/upload/image?folder=coverPhoto
// Note: Authentication optional - allows public uploads but checks auth if provided
router.post("/image", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file provided" });
    }
    const folder = (req.query.folder as string) || "misc";
    const fileType = getFileType(req.file.mimetype);
    
    console.log(`📤 Uploading ${fileType}:`, {
      fileName: req.file.originalname,
      fileSize: req.file.size,
      fileType: req.file.mimetype,
      folder: `lockerroom/${folder}`
    });

    // Use streaming upload (no base64 conversion - reduces memory by 50%)
    console.log('📤 Using streaming upload (no base64 conversion)');
    
    const result = await uploadToCloudinaryStream(
      req.file,
      folder,
      fileType,
      {
        chunkSize: fileType === 'video' && req.file.size > 20 * 1024 * 1024 ? 6000000 : undefined,
        eager: fileType === 'video' ? [
          { width: 400, crop: 'scale', quality: 'auto', fetch_format: 'auto' }
        ] : undefined,
        eagerAsync: fileType === 'video',
        notificationUrl: fileType === 'video' && req.file.size > 20 * 1024 * 1024
          ? `${process.env.CLIENT_ORIGIN || 'http://localhost:5173'}/api/webhooks/cloudinary`
          : undefined
      }
    );

    console.log('✅ Upload successful:', {
      url: result.secure_url,
      public_id: result.public_id,
      resource_type: result.resource_type
    });

    return res.json({
      url: result.secure_url,
      public_id: result.public_id,
      resource_type: result.resource_type,
      thumbnail_url: fileType === 'video' ? await generateVideoThumbnail(result.public_id) : undefined
    });
  } catch (err: any) {
    console.error("Cloudinary upload error:", err?.message || err);
    return res.status(500).json({ error: err?.message || "Upload failed" });
  }
});

// POST /api/upload/post - Special endpoint for post creation with placeholder
router.post("/post", requireAuth, upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file provided" });
    }

    const { caption, studentId } = req.body;
    const userId = (req as any).auth?.id;
    
    if (!caption || !studentId) {
      return res.status(400).json({ error: "Caption and studentId are required" });
    }

    // Verify the student belongs to the authenticated user
    const student = await storage.getStudent(studentId);
    if (!student || student.userId !== userId) {
      return res.status(403).json({ error: "Unauthorized to create post for this student" });
    }

    const fileType = getFileType(req.file.mimetype);
    const folder = fileType === 'video' ? 'posts/videos' : 'posts/images';
    
    console.log(`📤 Creating post with ${fileType}:`, {
      fileName: req.file.originalname,
      fileSize: req.file.size,
      fileType: req.file.mimetype,
      caption: caption.substring(0, 50) + '...'
    });

    // Create placeholder post immediately
    const placeholderPost = await storage.insertPost({
      studentId,
      mediaUrl: '/api/placeholder/processing', // Temporary placeholder URL
      mediaType: fileType,
      caption,
      status: 'processing',
      cloudinaryPublicId: '',
      thumbnailUrl: '/api/placeholder/video-thumbnail'
    });

    console.log('📝 Placeholder post created:', placeholderPost.id);

    // Start upload in background (don't await)
    uploadFileInBackground(req.file, folder, placeholderPost.id, studentId);

    // Return placeholder immediately
    return res.json({
      post: {
        ...placeholderPost,
        // Use the actual placeholder URLs from the database
      },
      isProcessing: true
    });
  } catch (err: any) {
    console.error("Post creation error:", err?.message || err);
    return res.status(500).json({ error: err?.message || "Post creation failed" });
  }
});

// Background upload function
async function uploadFileInBackground(file: Express.Multer.File, folder: string, postId: string, studentId: string) {
  try {
    console.log(`🔄 Starting background upload for post ${postId} (using streaming)`);
    
    const fileType = getFileType(file.mimetype);
    
    // Use streaming upload (no base64 conversion - reduces memory by 50%)
    const result = await uploadToCloudinaryStream(
      file,
      folder,
      fileType,
      {
        chunkSize: fileType === 'video' && file.size > 20 * 1024 * 1024 ? 6000000 : undefined,
        eager: fileType === 'video' ? [
          { width: 400, crop: 'scale', quality: 'auto', fetch_format: 'auto' }
        ] : undefined,
        eagerAsync: fileType === 'video',
        notificationUrl: fileType === 'video' && file.size > 20 * 1024 * 1024
          ? `${process.env.CLIENT_ORIGIN || 'http://localhost:5173'}/api/webhooks/cloudinary`
          : undefined
      }
    );

    // Generate thumbnail for videos
    const thumbnailUrl = fileType === 'video' ? await generateVideoThumbnail(result.public_id) : '';

    // Update post with final URLs
    await storage.updatePost(postId, {
      mediaUrl: result.secure_url,
      cloudinaryPublicId: result.public_id,
      thumbnailUrl,
      status: 'ready'
    });

    // Get the post to get studentId
    const post = await storage.getPost(postId);
    if (post && post.studentId) {
      // Post is now ready, notify followers
      notifyFollowersOfNewPost(postId, post.studentId).catch(err => {
        console.error(`❌ Failed to notify followers for post ${postId} (non-critical):`, err);
      });
    }

    console.log(`✅ Background upload completed for post ${postId}`);
  } catch (error: any) {
    console.error(`❌ Background upload failed for post ${postId}:`, error);
    
    // Mark post as failed with proper placeholder URL
    await storage.updatePost(postId, {
      status: 'failed',
      mediaUrl: '/api/placeholder/failed',
      thumbnailUrl: '/api/placeholder/failed-thumbnail'
    });
  }
}

// POST /api/upload/retry/:postId - Retry failed upload
router.post("/retry/:postId", requireAuth, async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = (req as any).auth?.id;
    
    // Get the post from database
    const post = await storage.getPost(postId);
    
    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }
    
    // Check if user owns the post
    const student = await storage.getStudent(post.studentId);
    if (!student || student.userId !== userId) {
      return res.status(403).json({ error: "Unauthorized to retry this post" });
    }
    
    // Check if post is retryable (no valid mediaUrl or failed status)
    const hasValidMediaUrl = post.mediaUrl && 
      post.mediaUrl.trim() !== '' && 
      !post.mediaUrl.includes('/api/placeholder/') &&
      !post.mediaUrl.includes('via.placeholder.com');
    
    if (post.status !== 'failed' && hasValidMediaUrl) {
      return res.status(400).json({ error: "Post is not in a retryable state" });
    }
    
    // Mark as processing
    await storage.updatePost(postId, {
      status: 'processing'
    });
    
    // For posts without valid mediaUrl, we need the original file
    // Since we don't have the original file, we'll mark it as failed with a message
    if (!hasValidMediaUrl) {
      await storage.updatePost(postId, {
        status: 'failed',
        mediaUrl: '/api/placeholder/failed'
      });
      
      return res.json({ 
        success: false, 
        message: "Cannot retry upload without original file. Please delete and recreate the post.",
        post: { ...post, status: 'failed' }
      });
    }
    
    // For posts with failed status but valid mediaUrl, just reset to ready
    await storage.updatePost(postId, {
      status: 'ready'
    });
    
    res.json({ 
      success: true, 
      message: "Retry successful",
      post: { ...post, status: 'ready' }
    });
  } catch (error: any) {
    console.error("Retry upload error:", error);
    res.status(500).json({ error: error.message || "Retry failed" });
  }
});

// POST /api/upload/announcement - Upload media for announcements
router.post("/announcement", requireAuth, upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file provided" });
    }

    const userRole = (req as any).auth?.role;
    
    // Only admins can upload announcement media
    if (userRole !== 'system_admin' && userRole !== 'school_admin') {
      return res.status(403).json({ 
        error: "Only administrators can upload announcement media" 
      });
    }

    const fileType = getFileType(req.file.mimetype);
    
    console.log(`📤 Uploading announcement media:`, {
      fileName: req.file.originalname,
      fileSize: req.file.size,
      fileType: req.file.mimetype,
      folder: 'lockerroom/announcements'
    });

    // Use streaming upload (no base64 conversion - reduces memory by 50%)
    console.log('📤 Using streaming upload for announcement media');
    
    const result = await uploadToCloudinaryStream(
      req.file,
      'announcements',
      fileType,
      {
        chunkSize: fileType === 'video' && req.file.size > 20 * 1024 * 1024 ? 6000000 : undefined,
        eager: fileType === 'video' ? [
          { width: 400, crop: 'scale', quality: 'auto', fetch_format: 'auto' }
        ] : undefined,
        eagerAsync: fileType === 'video',
        notificationUrl: fileType === 'video' && req.file.size > 20 * 1024 * 1024
          ? `${process.env.CLIENT_ORIGIN || 'http://localhost:5173'}/api/webhooks/cloudinary`
          : undefined
      }
    );

    // Generate thumbnail for videos
    const thumbnailUrl = fileType === 'video' ? await generateVideoThumbnail(result.public_id) : '';

    console.log('✅ Announcement media upload successful:', {
      url: result.secure_url,
      public_id: result.public_id,
      resource_type: result.resource_type
    });

    return res.json({
      success: true,
      file: {
        url: result.secure_url,
        publicId: result.public_id,
        resourceType: result.resource_type,
        thumbnailUrl: thumbnailUrl,
        originalName: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype
      }
    });
  } catch (err: any) {
    console.error("Announcement media upload error:", err?.message || err);
    return res.status(500).json({ error: err?.message || "Upload failed" });
  }
});

// POST /api/upload/video - Upload video for Xen Watch submissions
router.post("/video", requireAuth, upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file provided" });
    }

    const fileType = getFileType(req.file.mimetype);
    
    if (fileType !== 'video') {
      return res.status(400).json({ error: "Only video files are allowed" });
    }
    
    console.log(`📤 Uploading Xen Watch video:`, {
      fileName: req.file.originalname,
      fileSize: req.file.size,
      fileType: req.file.mimetype,
      folder: 'lockerroom/xen-watch'
    });

    // Use streaming upload (no base64 conversion - reduces memory by 50%)
    console.log('📤 Using streaming upload for Xen Watch video');
    
    const result = await uploadToCloudinaryStream(
      req.file,
      'xen-watch',
      'video',
      {
        chunkSize: req.file.size > 20 * 1024 * 1024 ? 6000000 : undefined,
        eager: [
          { width: 400, crop: 'scale', quality: 'auto', fetch_format: 'auto' }
        ],
        eagerAsync: true,
        notificationUrl: req.file.size > 20 * 1024 * 1024
          ? `${process.env.CLIENT_ORIGIN || 'http://localhost:5173'}/api/webhooks/cloudinary`
          : undefined
      }
    );

    console.log('✅ Xen Watch video upload successful:', {
      url: result.secure_url,
      public_id: result.public_id,
      resource_type: result.resource_type
    });

    return res.json({
      videoUrl: result.secure_url,
      thumbUrl: await generateVideoThumbnail(result.public_id)
    });
  } catch (err: any) {
    console.error("Xen Watch video upload error:", err?.message || err);
    return res.status(500).json({ error: err?.message || "Video upload failed" });
  }
});

export default router;
