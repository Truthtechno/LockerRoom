import { readFileSync } from 'fs';
import { join } from 'path';
import { db } from '../server/db';
import { sql } from 'drizzle-orm';

async function runPerformanceIndexes() {
  console.log('🚀 Starting performance indexes migration...');
  
  try {
    // Key performance indexes for feed loading
    const indexes = [
      // Index for posts query with status and type filtering
      `CREATE INDEX IF NOT EXISTS idx_posts_status_type_created_at ON posts (status, type, created_at DESC) WHERE student_id IS NOT NULL`,
      
      // Index for posts with student_id and created_at for efficient ordering
      `CREATE INDEX IF NOT EXISTS idx_posts_student_created_at ON posts (student_id, created_at DESC)`,
      
      // Index for post_likes with post_id for efficient counting
      `CREATE INDEX IF NOT EXISTS idx_post_likes_post_id ON post_likes (post_id)`,
      
      // Index for post_likes with user_id and post_id for user-specific queries
      `CREATE INDEX IF NOT EXISTS idx_post_likes_user_post ON post_likes (user_id, post_id)`,
      
      // Index for post_comments with post_id for efficient counting
      `CREATE INDEX IF NOT EXISTS idx_post_comments_post_id ON post_comments (post_id)`,
      
      // Index for saved_posts with post_id for efficient counting
      `CREATE INDEX IF NOT EXISTS idx_saved_posts_post_id ON saved_posts (post_id)`,
      
      // Index for saved_posts with user_id and post_id for user-specific queries
      `CREATE INDEX IF NOT EXISTS idx_saved_posts_user_post ON saved_posts (user_id, post_id)`,
      
      // Index for post_views with post_id for efficient counting
      `CREATE INDEX IF NOT EXISTS idx_post_views_post_id ON post_views (post_id)`,
      
      // Index for student_followers with follower_user_id for follow status queries
      `CREATE INDEX IF NOT EXISTS idx_student_followers_follower ON student_followers (follower_user_id)`,
      
      // Index for student_followers with student_id for follower count queries
      `CREATE INDEX IF NOT EXISTS idx_student_followers_student ON student_followers (student_id)`,
      
      // Composite index for student_followers with both user and student for follow status checks
      `CREATE INDEX IF NOT EXISTS idx_student_followers_user_student ON student_followers (follower_user_id, student_id)`,
      
      // Index for students with user_id for efficient joins
      `CREATE INDEX IF NOT EXISTS idx_students_user_id ON students (user_id)`,
      
      // Partial index for non-processing posts (most common query)
      `CREATE INDEX IF NOT EXISTS idx_posts_ready_posts ON posts (created_at DESC, student_id) WHERE (status != 'processing' OR status IS NULL) AND student_id IS NOT NULL AND (type != 'announcement' OR type IS NULL)`
    ];

    console.log(`📝 Creating ${indexes.length} performance indexes...`);

    for (let i = 0; i < indexes.length; i++) {
      const statement = indexes[i];
      console.log(`🔄 Creating index ${i + 1}/${indexes.length}...`);
      await db.execute(sql.raw(statement));
    }

    console.log('✅ Performance indexes created successfully!');
    console.log('🚀 Feed loading should now be significantly faster!');
    
  } catch (error) {
    console.error('❌ Error creating performance indexes:', error);
    process.exit(1);
  }
}

runPerformanceIndexes();
