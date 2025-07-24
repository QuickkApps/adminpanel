const axios = require('axios');

const BASE_URL = 'http://localhost:3003';

async function testAddFallbackUrl() {
  try {
    console.log('🔐 Step 1: Login to get JWT token...');
    
    // Login first
    const loginResponse = await axios.post(`${BASE_URL}/api/auth/login`, {
      username: 'admin',
      password: 'admin123'
    });
    
    if (!loginResponse.data.success) {
      throw new Error('Login failed: ' + loginResponse.data.message);
    }
    
    const token = loginResponse.data.token;
    console.log('✅ Login successful, token received');
    
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
    
    console.log('\n➕ Step 2: Add a new fallback URL...');
    
    // Create a new fallback URL
    const createData = {
      url: 'https://api.example.com/test',
      url_type: 'api',
      description: 'Test API fallback URL'
    };
    
    const createResponse = await axios.post(`${BASE_URL}/api/fallback-urls`, createData, { headers });
    console.log('✅ POST /api/fallback-urls response:', createResponse.data);
    
    if (createResponse.data.success) {
      const createdUrl = createResponse.data.data;
      console.log('✅ Created URL ID:', createdUrl.id);
      
      console.log('\n📋 Step 3: Verify the URL was added...');
      
      // Get URLs to verify
      const getResponse = await axios.get(`${BASE_URL}/api/fallback-urls`, { headers });
      console.log('✅ GET /api/fallback-urls after creation:', getResponse.data);
      
      if (getResponse.data.data && getResponse.data.data.length > 0) {
        console.log('🎉 SUCCESS! Fallback URL was added successfully!');
        console.log('📋 URL Details:');
        getResponse.data.data.forEach((url, index) => {
          console.log(`   ${index + 1}. ${url.url} (${url.url_type}) - ${url.description}`);
        });
      } else {
        console.log('❌ ERROR: No URLs found after creation');
      }
    } else {
      console.log('❌ Failed to create URL:', createResponse.data.message);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

// Run the test
testAddFallbackUrl();
