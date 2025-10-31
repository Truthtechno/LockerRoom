// Polyfill fetch for Node 16 compatibility (must be before any Neon imports)
if (typeof globalThis.fetch === 'undefined') {
  await (async () => {
    const { createRequire } = await import('module');
    const require = createRequire(import.meta.url);
    const nodeFetch = require('node-fetch');
    globalThis.fetch = nodeFetch.default || nodeFetch;
    globalThis.Headers = nodeFetch.Headers;
    globalThis.Request = nodeFetch.Request;
    globalThis.Response = nodeFetch.Response;
  })();
}
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { config } from 'dotenv';

// Load environment variables from .env file
config();

// Create database connection
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌ No DATABASE_URL found in environment variables');
  console.error('📝 Please ensure .env file contains: DATABASE_URL=postgresql://<user>:<password>@<host>/<dbname>?sslmode=require');
  throw new Error('No database connection string provided');
}

console.log('🔗 Connecting to database with URL:', connectionString.replace(/:[^:@]+@/, ':***@')); // Hide password in logs

const sql = neon(connectionString);

// Create drizzle instance with neon-http driver
export const db = drizzle(sql);

export default db;
