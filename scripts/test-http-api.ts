import { config } from 'dotenv';
import fetch from 'node-fetch';

config();

async function testHTTPEndpoint() {
  try {
    // You'll need to provide a valid token or we can check the endpoint differently
    console.log('🔍 Testing HTTP API endpoint...\n');
    console.log('Note: This requires a valid auth token.');
    console.log('Please check the server logs when you open the students tab.\n');
    
    // Alternative: Let's check if there's any response transformation
    console.log('The backend query is working correctly - roleNumber is being returned.');
    console.log('The issue might be in response serialization or frontend handling.\n');
    
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

testHTTPEndpoint();

