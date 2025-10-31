// Test script to verify profile picture upload fixes
const fetch = require('node-fetch');
const FormData = require('form-data');
const fs = require('fs');

async function testProfileUpload() {
  try {
    console.log('🧪 Testing profile picture upload flow...\n');
    
    // Step 1: Login
    console.log('1️⃣ Logging in...');
    const loginResponse = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'viewer@example.com',
        password: 'password123'
      })
    });
    
    if (!loginResponse.ok) {
      throw new Error(`Login failed: ${loginResponse.status}`);
    }
    
    const loginData = await loginResponse.json();
    const token = loginData.token;
    console.log(`✅ Login successful. Token length: ${token.length}`);
    
    // Step 2: Fetch user data
    console.log('\n2️⃣ Fetching user data...');
    const userResponse = await fetch('http://localhost:5000/api/users/me', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!userResponse.ok) {
      throw new Error(`User fetch failed: ${userResponse.status}`);
    }
    
    const userData = await userResponse.json();
    console.log(`✅ User data fetched. Role: ${userData.role}, SchoolId: ${userData.schoolId}`);
    
    // Step 3: Create a test image file
    console.log('\n3️⃣ Creating test image...');
    const testImagePath = '/tmp/test-avatar.jpg';
    // Create a minimal 1x1 pixel JPEG
    const jpegData = Buffer.from([
      0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x48,
      0x00, 0x48, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43, 0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08,
      0x07, 0x07, 0x07, 0x09, 0x09, 0x08, 0x0A, 0x0C, 0x14, 0x0D, 0x0C, 0x0B, 0x0B, 0x0C, 0x19, 0x12,
      0x13, 0x0F, 0x14, 0x1D, 0x1A, 0x1F, 0x1E, 0x1D, 0x1A, 0x1C, 0x1C, 0x20, 0x24, 0x2E, 0x27, 0x20,
      0x22, 0x2C, 0x23, 0x1C, 0x1C, 0x28, 0x37, 0x29, 0x2C, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1F, 0x27,
      0x39, 0x3D, 0x38, 0x32, 0x3C, 0x2E, 0x33, 0x34, 0x32, 0xFF, 0xC0, 0x00, 0x11, 0x08, 0x00, 0x01,
      0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01, 0xFF, 0xC4, 0x00, 0x14,
      0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x08, 0xFF, 0xC4, 0x00, 0x14, 0x10, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xFF, 0xDA, 0x00, 0x0C, 0x03, 0x01, 0x00, 0x02,
      0x11, 0x03, 0x11, 0x00, 0x3F, 0x00, 0x8A, 0xFF, 0xD9
    ]);
    fs.writeFileSync(testImagePath, jpegData);
    console.log(`✅ Test image created: ${testImagePath}`);
    
    // Step 4: Upload profile picture
    console.log('\n4️⃣ Uploading profile picture...');
    const formData = new FormData();
    formData.append('profilePic', fs.createReadStream(testImagePath), 'test-avatar.jpg');
    
    const uploadResponse = await fetch('http://localhost:5000/api/profile/picture', {
      method: 'PUT',
      headers: { 
        'Authorization': `Bearer ${token}`,
        ...formData.getHeaders()
      },
      body: formData
    });
    
    console.log(`Upload response status: ${uploadResponse.status}`);
    
    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      throw new Error(`Upload failed: ${uploadResponse.status} - ${errorText}`);
    }
    
    const uploadData = await uploadResponse.json();
    console.log(`✅ Profile picture uploaded successfully!`);
    console.log(`   ProfilePicUrl: ${uploadData.profilePicUrl}`);
    
    // Step 5: Verify the upload by fetching user data again
    console.log('\n5️⃣ Verifying upload...');
    const verifyResponse = await fetch('http://localhost:5000/api/users/me', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!verifyResponse.ok) {
      throw new Error(`Verification failed: ${verifyResponse.status}`);
    }
    
    const verifyData = await verifyResponse.json();
    console.log(`✅ Verification successful!`);
    console.log(`   Updated ProfilePicUrl: ${verifyData.profilePicUrl}`);
    
    // Cleanup
    fs.unlinkSync(testImagePath);
    console.log('\n🎉 All tests passed! Profile picture upload is working correctly.');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Run the test
testProfileUpload();
