// Test script to verify progressive feed loading
const fetch = require('node-fetch');

async function testProgressiveFeed() {
  console.log('🧪 Testing Progressive Feed Loading...\n');
  
  try {
    // Test the new feed endpoint
    console.log('1. Testing /api/posts/feed endpoint...');
    const response = await fetch('http://localhost:5000/api/posts/feed?limit=2&offset=0', {
      headers: {
        'Authorization': 'Bearer test-token', // You'll need to replace with actual token
        'Content-Type': 'application/json'
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Feed endpoint working');
      console.log(`   Posts returned: ${data.posts.length}`);
      console.log(`   Has more: ${data.hasMore}`);
      console.log(`   Next offset: ${data.nextOffset}`);
    } else {
      console.log('❌ Feed endpoint failed:', response.status);
    }
    
    // Test pagination
    console.log('\n2. Testing pagination...');
    const response2 = await fetch('http://localhost:5000/api/posts/feed?limit=5&offset=2', {
      headers: {
        'Authorization': 'Bearer test-token',
        'Content-Type': 'application/json'
      }
    });
    
    if (response2.ok) {
      const data2 = await response2.json();
      console.log('✅ Pagination working');
      console.log(`   Posts returned: ${data2.posts.length}`);
      console.log(`   Has more: ${data2.hasMore}`);
      console.log(`   Next offset: ${data2.nextOffset}`);
    } else {
      console.log('❌ Pagination failed:', response2.status);
    }
    
  } catch (error) {
    console.log('❌ Test failed:', error.message);
  }
}

// Run the test
testProgressiveFeed();
