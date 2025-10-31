import { db } from '../server/db';
import { users, notifications } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { storage } from '../server/storage';

(async () => {
  const scouts = await db.select().from(users).where(eq(users.role, 'scout_admin'));
  console.log(`Found ${scouts.length} scout admin(s):\n`);
  
  for (const scout of scouts) {
    console.log(`\n${scout.name} (${scout.id}):`);
    
    // Check via storage
    const notifsViaStorage = await storage.getNotifications(scout.id);
    console.log(`  Via storage: ${notifsViaStorage.length} notifications`);
    
    // Check directly in DB
    const notifsInDb = await db.select().from(notifications).where(eq(notifications.userId, scout.id));
    console.log(`  In database: ${notifsInDb.length} notifications`);
    
    if (notifsViaStorage.length > 0) {
      console.log(`  Latest notification: ${notifsViaStorage[0].title} - ${notifsViaStorage[0].message}`);
    }
  }
  
  process.exit(0);
})();

