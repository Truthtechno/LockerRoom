-- Migration: Add new upload fields to posts table with safe defaults
-- This ensures existing posts are preserved and get default values

-- Add new columns with safe defaults
ALTER TABLE posts 
ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'ready';

ALTER TABLE posts 
ADD COLUMN IF NOT EXISTS cloudinary_public_id text DEFAULT NULL;

ALTER TABLE posts 
ADD COLUMN IF NOT EXISTS thumbnail_url text DEFAULT NULL;

-- Update existing posts that don't have the new fields set
-- This is safe because we're only setting defaults for NULL values
UPDATE posts 
SET 
    status = 'ready',
    cloudinary_public_id = CASE 
        WHEN content_url IS NOT NULL AND content_url != '' THEN 'legacy_' || id
        ELSE NULL 
    END,
    thumbnail_url = CASE 
        WHEN content_type = 'video' THEN 'https://res.cloudinary.com/dh9cfkyhc/image/upload/f_auto,q_auto,w_400/v1620000000/placeholder-video-thumbnail.jpg'
        WHEN content_type = 'image' AND content_url IS NOT NULL THEN content_url
        ELSE NULL
    END
WHERE status IS NULL 
   OR cloudinary_public_id IS NULL 
   OR thumbnail_url IS NULL;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_posts_status ON posts(status);
CREATE INDEX IF NOT EXISTS idx_posts_cloudinary_public_id ON posts(cloudinary_public_id);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC);

-- Add comments for documentation
COMMENT ON COLUMN posts.status IS 'Post processing status: ready, processing, failed';
COMMENT ON COLUMN posts.cloudinary_public_id IS 'Cloudinary public ID for optimized delivery';
COMMENT ON COLUMN posts.thumbnail_url IS 'Thumbnail URL for videos and optimized images';
