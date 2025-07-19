const axios = require('axios');

async function testAdminAPI() {
  try {
    console.log('🔐 Testing admin login...');
    
    // Login as admin
    const loginResponse = await axios.post('http://localhost:3001/api/auth/login', {
      username: 'admin',
      password: 'admin123'
    });
    
    console.log('✅ Login successful');
    const token = loginResponse.data.token;
    
    // Test conversations API
    console.log('📋 Testing conversations API...');
    const conversationsResponse = await axios.get('http://localhost:3001/api/chat/admin/conversations?status=open', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('✅ Conversations API successful');
    console.log('📊 Response data:');
    console.log(JSON.stringify(conversationsResponse.data, null, 2));
    
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

testAdminAPI();
