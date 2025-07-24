const axios = require('axios');

const BASE_URL = 'http://localhost:3003';

async function testFallbackUrlAPI() {
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
    
    console.log('\n📋 Step 2: Get existing fallback URLs...');
    
    // Get existing fallback URLs
    const getResponse = await axios.get(`${BASE_URL}/api/fallback-urls`, { headers });
    console.log('✅ GET /api/fallback-urls response:', getResponse.data);
    
    console.log('\n➕ Step 3: Create a new fallback URL...');
    
    // Create a new fallback URL
    const createData = {
      url: 'https://api.test.com/fallback',
      url_type: 'api',
      description: 'Test fallback URL',
      priority: 1
    };
    
    const createResponse = await axios.post(`${BASE_URL}/api/fallback-urls`, createData, { headers });
    console.log('✅ POST /api/fallback-urls response:', createResponse.data);
    
    if (createResponse.data.success) {
      const createdUrl = createResponse.data.data;
      console.log('✅ Created URL ID:', createdUrl.id);
      
      console.log('\n📋 Step 4: Get fallback URLs again to verify...');
      
      // Get URLs again to verify
      const getResponse2 = await axios.get(`${BASE_URL}/api/fallback-urls`, { headers });
      console.log('✅ GET /api/fallback-urls after creation:', getResponse2.data);
      
      console.log('\n🧪 Step 5: Test the created URL...');
      
      // Test the URL
      const testResponse = await axios.post(`${BASE_URL}/api/fallback-urls/${createdUrl.id}/test`, {}, { headers });
      console.log('✅ POST /api/fallback-urls/:id/test response:', testResponse.data);
      
      console.log('\n✏️ Step 6: Update the URL...');
      
      // Update the URL
      const updateData = {
        description: 'Updated test fallback URL',
        is_active: true
      };
      
      const updateResponse = await axios.put(`${BASE_URL}/api/fallback-urls/${createdUrl.id}`, updateData, { headers });
      console.log('✅ PUT /api/fallback-urls/:id response:', updateResponse.data);
      
      console.log('\n🗑️ Step 7: Delete the URL...');
      
      // Delete the URL
      const deleteResponse = await axios.delete(`${BASE_URL}/api/fallback-urls/${createdUrl.id}`, { headers });
      console.log('✅ DELETE /api/fallback-urls/:id response:', deleteResponse.data);
      
      console.log('\n📋 Step 8: Final verification...');
      
      // Final verification
      const getResponse3 = await axios.get(`${BASE_URL}/api/fallback-urls`, { headers });
      console.log('✅ GET /api/fallback-urls after deletion:', getResponse3.data);
    }
    
    console.log('\n🎉 All API tests completed successfully!');
    
  } catch (error) {
    console.error('❌ API test failed:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

// Run the test
testFallbackUrlAPI();
