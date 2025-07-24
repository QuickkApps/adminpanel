const axios = require('axios');

const RAILWAY_URL = 'https://web-production-6358.up.railway.app';

async function testToggleFilter() {
  try {
    console.log('🔧 Testing filter toggle functionality...\n');
    
    // Test 1: Disable the filter
    console.log('1. Disabling the filter (showOnlyCustomServers = false)...');
    try {
      const response = await axios.put(`${RAILWAY_URL}/api/vpn-servers/settings/filter`, {
        showOnlyCustomServers: false
      });
      console.log(`   ✅ Status: ${response.status}`);
      console.log(`   📊 Response:`, JSON.stringify(response.data, null, 2));
    } catch (error) {
      console.log(`   ❌ Error: ${error.response?.status} - ${error.message}`);
    }
    
    // Test 2: Check active servers after disabling filter
    console.log('\n2. Checking active servers after disabling filter...');
    try {
      const response = await axios.get(`${RAILWAY_URL}/api/vpn-servers/active`);
      console.log(`   ✅ Status: ${response.status}`);
      console.log(`   📊 Server count: ${response.data.count || response.data.data?.length || 'unknown'}`);
      
      if (response.data._metadata) {
        console.log(`   🔧 Filter setting: showOnlyCustomServers = ${response.data._metadata.showOnlyCustomServers}`);
        console.log(`   📈 Total servers: ${response.data._metadata.totalServers}`);
      }
      
      // Show server breakdown
      if (response.data.data && response.data.data.length > 0) {
        const customServers = response.data.data.filter(s => s._isCustomServer === true);
        const nonCustomServers = response.data.data.filter(s => s._isCustomServer === false);
        console.log(`   📋 Custom servers: ${customServers.length}`);
        console.log(`   📋 Non-custom servers: ${nonCustomServers.length}`);
        
        // Show first few servers of each type
        if (customServers.length > 0) {
          console.log(`   🔸 First custom server: ${customServers[0]._serverName} (${customServers[0].CountryShort})`);
        }
        if (nonCustomServers.length > 0) {
          console.log(`   🔹 First non-custom server: ${nonCustomServers[0]._serverName} (${nonCustomServers[0].CountryShort})`);
        }
      }
    } catch (error) {
      console.log(`   ❌ Error: ${error.response?.status} - ${error.message}`);
    }
    
    // Test 3: Re-enable the filter
    console.log('\n3. Re-enabling the filter (showOnlyCustomServers = true)...');
    try {
      const response = await axios.put(`${RAILWAY_URL}/api/vpn-servers/settings/filter`, {
        showOnlyCustomServers: true
      });
      console.log(`   ✅ Status: ${response.status}`);
      console.log(`   📊 Response:`, JSON.stringify(response.data, null, 2));
    } catch (error) {
      console.log(`   ❌ Error: ${error.response?.status} - ${error.message}`);
    }
    
    // Test 4: Verify filter is re-enabled
    console.log('\n4. Verifying filter is re-enabled...');
    try {
      const response = await axios.get(`${RAILWAY_URL}/api/vpn-servers/active`);
      console.log(`   ✅ Status: ${response.status}`);
      console.log(`   📊 Server count: ${response.data.count || response.data.data?.length || 'unknown'}`);
      
      if (response.data._metadata) {
        console.log(`   🔧 Filter setting: showOnlyCustomServers = ${response.data._metadata.showOnlyCustomServers}`);
      }
    } catch (error) {
      console.log(`   ❌ Error: ${error.response?.status} - ${error.message}`);
    }
    
    console.log('\n🎯 Filter toggle test completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testToggleFilter();
