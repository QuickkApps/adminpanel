const axios = require('axios');

const RAILWAY_URL = 'https://web-production-6358.up.railway.app';

async function testRailwayAPI() {
  try {
    console.log('🔍 Testing Railway API endpoints...');
    
    // Test 1: Check if the active servers endpoint exists and works
    console.log('\n1. Testing /api/vpn-servers/active endpoint...');
    try {
      const response = await axios.get(`${RAILWAY_URL}/api/vpn-servers/active`);
      console.log(`✅ Status: ${response.status}`);
      console.log(`📊 Response data:`, JSON.stringify(response.data, null, 2));
      
      if (response.data._metadata) {
        console.log(`🔧 Filter setting: showOnlyCustomServers = ${response.data._metadata.showOnlyCustomServers}`);
      } else {
        console.log('⚠️ No _metadata found - this suggests old version without filtering');
      }
    } catch (error) {
      console.log(`❌ Error: ${error.response?.status} - ${error.message}`);
    }
    
    // Test 2: Check if the filter settings endpoint exists
    console.log('\n2. Testing /api/vpn-servers/settings/filter endpoint...');
    try {
      const response = await axios.get(`${RAILWAY_URL}/api/vpn-servers/settings/filter`);
      console.log(`✅ Status: ${response.status}`);
      console.log(`📊 Filter setting:`, JSON.stringify(response.data, null, 2));
    } catch (error) {
      console.log(`❌ Error: ${error.response?.status} - ${error.message}`);
      if (error.response?.status === 404) {
        console.log('🚨 This endpoint doesn\'t exist - Railway deployment is missing the latest changes!');
      }
    }
    
    // Test 3: Try to update the filter setting
    console.log('\n3. Testing filter setting update...');
    try {
      const response = await axios.put(`${RAILWAY_URL}/api/vpn-servers/settings/filter`, {
        showOnlyCustomServers: true
      });
      console.log(`✅ Status: ${response.status}`);
      console.log(`📊 Update response:`, JSON.stringify(response.data, null, 2));
    } catch (error) {
      console.log(`❌ Error: ${error.response?.status} - ${error.message}`);
    }
    
    // Test 4: Check active servers again after enabling filter
    console.log('\n4. Testing active servers after enabling filter...');
    try {
      const response = await axios.get(`${RAILWAY_URL}/api/vpn-servers/active`);
      console.log(`✅ Status: ${response.status}`);
      console.log(`📊 Server count: ${response.data.count || response.data.data?.length || 'unknown'}`);
      
      if (response.data._metadata) {
        console.log(`🔧 Filter setting: showOnlyCustomServers = ${response.data._metadata.showOnlyCustomServers}`);
      }
    } catch (error) {
      console.log(`❌ Error: ${error.response?.status} - ${error.message}`);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testRailwayAPI();
