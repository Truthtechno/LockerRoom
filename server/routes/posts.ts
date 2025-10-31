import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { db } from '../db';
import { posts } from '@shared/schema';
import { requireAuth, requireRole } from '../middleware/auth';
import { notifyFollowersOfNewPost } from '../utils/notification-helpers';

const upload = multer({
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

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

export function registerPostRoutes(app: any) {
  app.post('/api/posts', requireAuth, requireRole('student'), upload.single('media'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: { code: 'validation_error', message: 'Media file required' } });
      }

      // stream to cloudinary
      const result = await new Promise<any>((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: 'lockerroom', resource_type: 'auto' },
          (err, uploaded) => (err ? reject(err) : resolve(uploaded))
        );
        stream.end(req.file.buffer);
      });

      // Generate thumbnail for videos
      const thumbnailUrl = result.resource_type === 'video' ? await generateVideoThumbnail(result.public_id) : '';

      const [post] = await db.insert(posts).values({
        studentId: (req as any).auth.linkedId,
        mediaUrl: result.secure_url,
        mediaType: result.resource_type === 'video' ? 'video' : 'image',
        caption: req.body.caption || null,
        cloudinaryPublicId: result.public_id,
        thumbnailUrl: thumbnailUrl,
        status: 'ready'
      }).returning();

      // Create notifications for users who follow this student
      if (post && post.studentId) {
        notifyFollowersOfNewPost(post.id, post.studentId).catch(err => {
          console.error('❌ Failed to notify followers (non-critical):', err);
        });
      }

      res.json(post);
    } catch (error: any) {
      console.error('Post creation error:', error);
      res.status(500).json({ error: { code: 'server_error', message: 'Failed to create post' } });
    }
  });
}