import { neon } from '@neondatabase/serverless';
import { config } from 'dotenv';
import * as fs from 'fs/promises';
import * as path from 'path';

config();

async function cleanupOldLogo() {
  console.log('🧹 Cleaning up old logo files...');
  
  const uploadsDir = path.join(process.cwd(), 'uploads', 'branding');
  
  try {
    // Check if directory exists
    try {
      await fs.access(uploadsDir);
    } catch {
      console.log('📁 Uploads directory does not exist, nothing to clean');
      return;
    }

    // List all files in branding directory
    const files = await fs.readdir(uploadsDir);
    console.log('📂 Found files:', files);

    // Remove old generic logo files (these cause conflicts)
    const oldLogoFiles = ['logo.jpg', 'logo.png', 'logo.svg'];
    let cleaned = 0;

    for (const oldFile of oldLogoFiles) {
      const oldFilePath = path.join(uploadsDir, oldFile);
      try {
        await fs.access(oldFilePath);
        await fs.unlink(oldFilePath);
        console.log(`✅ Removed old conflicting file: ${oldFile}`);
        cleaned++;
      } catch (error: any) {
        if (error.code !== 'ENOENT') {
          console.log(`⚠️ Could not remove ${oldFile}:`, error.message);
        }
      }
    }

    if (cleaned === 0) {
      console.log('ℹ️ No old logo files found to clean');
    } else {
      console.log(`\n✅ Cleanup complete! Removed ${cleaned} old logo file(s)`);
      console.log('💡 The system now uses:');
      console.log('   - system-logo.{ext} for System/Platform logo');
      console.log('   - company-logo.{ext} for Company logo');
    }

  } catch (error: any) {
    console.error('❌ Cleanup error:', error.message);
    throw error;
  }
}

cleanupOldLogo()
  .then(() => {
    console.log('\n✅ Cleanup script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Cleanup script failed:', error);
    process.exit(1);
  });

