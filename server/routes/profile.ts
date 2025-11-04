import { Router } from 'express';
import multer from 'multer';
import { db } from '../db';
import { requireAuth } from '../middleware/auth';
import { uploadBuffer } from '../storage';
import { students, viewers, schoolAdmins, systemAdmins, admins } from '@shared/schema';
import { eq } from 'drizzle-orm';

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: { 
        id: string; 
        email: string;
        role: 'student' | 'viewer' | 'school_admin' | 'system_admin' | 'scout_admin' | 'xen_scout'; 
        schoolId: string | null;
        linkedId: string;
      };
    }
  }
}

const router = Router();
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  }
});

// Add multer error handling middleware
const handleMulterError = (err: any, req: any, res: any, next: any) => {
  if (err instanceof multer.MulterError) {
    console.error('❌ Multer error:', err);
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File size too large. Maximum size is 5MB.' });
    }
    return res.status(400).json({ error: `File upload error: ${err.message}` });
  }
  next(err);
};

// Unified profile picture upload endpoint
router.put('/api/profile/picture', requireAuth, upload.single('profilePic'), handleMulterError, async (req, res) => {
  console.log('📸 Profile picture upload request:', {
    url: req.url,
    method: req.method,
    contentType: req.headers['content-type'],
    hasFile: !!req.file,
    fileSize: req.file?.size,
    fileType: req.file?.mimetype,
    fileName: req.file?.originalname,
    fieldName: req.file?.fieldname,
    user: req.user ? { id: req.user.id, role: req.user.role, linkedId: req.user.linkedId } : null
  });

  // Log multer parsing details
  console.log('🔍 Multer parsing result:', {
    file: req.file ? {
      fieldname: req.file.fieldname,
      originalname: req.file.originalname,
      encoding: req.file.encoding,
      mimetype: req.file.mimetype,
      size: req.file.size,
      buffer: req.file.buffer ? `Buffer(${req.file.buffer.length} bytes)` : 'No buffer'
    } : 'No file received',
    files: req.files ? Object.keys(req.files) : 'No files'
  });

  try {
    // Check authentication
    if (!req.user) {
      console.log('❌ No user in request - authentication failed');
      return res.status(401).json({ error: 'Unauthorized - authentication required' });
    }
    
    const { id: userId, email, role, schoolId, linkedId } = req.user;
    const file = req.file;

    console.log('🔍 Processing upload for:', { userId, email, role, schoolId, linkedId });

    // Validate linkedId is present
    if (!linkedId) {
      console.error('❌ Missing linkedId for user:', { userId, email, role, schoolId });
      return res.status(401).json({ 
        error: { 
          code: 'missing_linkedId', 
          message: 'User does not have a linked viewer record' 
        } 
      });
    }

    // Validate file presence
    if (!file) {
      console.log('❌ No file provided in request');
      console.log('🔍 Request details:', {
        body: req.body,
        files: req.files,
        headers: {
          'content-type': req.headers['content-type'],
          'content-length': req.headers['content-length']
        }
      });
      return res.status(400).json({ error: 'No file provided. Please select an image file to upload.' });
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.mimetype)) {
      console.log('❌ Invalid file type:', file.mimetype);
      return res.status(400).json({ 
        error: 'Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed' 
      });
    }

    // Validate file size (5MB limit)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      console.log('❌ File too large:', file.size, 'bytes');
      return res.status(400).json({ 
        error: 'File size must be less than 5MB' 
      });
    }

    // Upload file and get URL
    let url: string;
    try {
      console.log('📁 Uploading file to storage...');
      url = await uploadBuffer(file.buffer, `profile-pics/${userId}`);
      console.log('✅ File uploaded successfully:', url);
    } catch (uploadError) {
      console.error('❌ File upload failed:', uploadError);
      return res.status(500).json({ error: 'File upload failed' });
    }

    // Update the appropriate table based on role
    let updateResult;
    try {
      console.log('💾 Updating database for role:', role);
      
      if (role === 'student') {
        // For students: users.linked_id = students.id
        if (!linkedId) {
          console.log('❌ No linkedId for student');
          return res.status(404).json({ error: 'Student profile not found' });
        }
        console.log('🔄 Updating students table:', { linkedId, url });
        updateResult = await db.update(students)
          .set({ profilePicUrl: url })
          .where(eq(students.id, linkedId));
          
      } else if (role === 'viewer') {
        // For viewers: users.linked_id = viewers.id
        if (!linkedId) {
          console.error('❌ No linkedId for viewer:', { userId, email, role });
          return res.status(401).json({ 
            error: { 
              code: 'missing_linkedId', 
              message: 'User does not have a linked viewer record' 
            } 
          });
        }
        console.log('🔄 Updating viewers table:', { linkedId, url, userId, email });
        updateResult = await db.update(viewers)
          .set({ profilePicUrl: url })
          .where(eq(viewers.id, linkedId));
          
      } else if (role === 'school_admin') {
        // For school admins: users.linked_id = school_admins.id
        if (!linkedId) {
          console.log('❌ No linkedId for school admin');
          return res.status(404).json({ error: 'School admin profile not found' });
        }
        console.log('🔄 Updating school_admins table:', { linkedId, url });
        updateResult = await db.update(schoolAdmins)
          .set({ profilePicUrl: url })
          .where(eq(schoolAdmins.id, linkedId));
          
      } else if (role === 'system_admin') {
        // For system admins: users.linked_id = system_admins.id
        if (!linkedId) {
          console.log('❌ No linkedId for system admin');
          return res.status(404).json({ error: 'System admin profile not found' });
        }
        console.log('🔄 Updating system_admins table:', { linkedId, url });
        updateResult = await db.update(systemAdmins)
          .set({ profilePicUrl: url })
          .where(eq(systemAdmins.id, linkedId));
          
      } else if (role === 'scout_admin' || role === 'xen_scout') {
        // For scouts: users.linked_id = admins.id
        if (!linkedId) {
          console.log('❌ No linkedId for scout:', role);
          return res.status(404).json({ error: 'Scout profile not found' });
        }
        console.log('🔄 Updating admins table for scout:', { linkedId, url, role });
        updateResult = await db.update(admins)
          .set({ profilePicUrl: url })
          .where(eq(admins.id, linkedId));
          
      } else {
        console.log('❌ Invalid user role:', role);
        return res.status(400).json({ error: 'Invalid user role' });
      }
      
      console.log('✅ Database update result:', { 
        rowCount: updateResult?.rowCount,
        hasResult: !!updateResult 
      });
      
    } catch (dbError) {
      console.error('❌ Database update failed:', dbError);
      return res.status(500).json({ error: 'Failed to update profile picture' });
    }

    // Check if any rows were updated
    if (!updateResult || updateResult.rowCount === 0) {
      console.log('❌ No rows updated - profile record not found');
      return res.status(404).json({ error: 'Profile record not found' });
    }

    console.log('🎉 Profile picture upload successful:', { userId, role, url });
    
    // Return success response
    return res.json({ profilePicUrl: url });
  } catch (err: any) {
    console.error('❌ Profile picture upload error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
