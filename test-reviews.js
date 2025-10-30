import { db } from './server/db.ts';
import { sql } from 'drizzle-orm';

async function testReviews() {
  try {
    console.log('Testing submission_reviews table...');
    const result = await db.execute(sql`
      SELECT COUNT(*) as count FROM submission_reviews
    `);
    console.log('Submission reviews count:', result);
    
    console.log('Testing scout_profiles table...');
    const scouts = await db.execute(sql`
      SELECT id, name FROM scout_profiles LIMIT 3
    `);
    console.log('Scout profiles:', scouts);
    
    console.log('Testing join between scout_profiles and submission_reviews...');
    const joinResult = await db.execute(sql`
      SELECT sp.id, sp.name, COUNT(sr.id) as review_count
      FROM scout_profiles sp
      LEFT JOIN submission_reviews sr ON sr.scout_id::text = sp.id::text
      GROUP BY sp.id, sp.name
      LIMIT 3
    `);
    console.log('Join result:', joinResult);
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testReviews();
