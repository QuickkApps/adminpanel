const axios = require('axios');
const { models } = require('./database');
const { VpnServer, AdminSetting } = models;

const BASE_URL = 'http://localhost:3001';

async function testApiEndpoints() {
  try {
    console.log('🧪 Testing API endpoints...');
    
    // Create test servers
    const customServer = await VpnServer.create({
      name: 'API Test Custom Server',
      hostname: 'api-custom.example.com',
      ip: '192.168.1.200',
      port: 1194,
      protocol: 'udp',
      country_long: 'API Test Country',
      country_short: 'AT',
      openvpn_config_base64: Buffer.from('api test config').toString('base64'),
      is_custom: true,
      is_active: true,
      created_by: 1
    });
    
    const defaultServer = await VpnServer.create({
      name: 'API Test Default Server',
      hostname: 'api-default.example.com',
      ip: '192.168.1.201',
      port: 1194,
      protocol: 'udp',
      country_long: 'API Default Country',
      country_short: 'AD',
      openvpn_config_base64: Buffer.from('api default config').toString('base64'),
      is_custom: false,
      is_active: true,
      created_by: 1
    });
    
    console.log('✅ Created test servers for API testing');
    
    // Test 1: Get active servers with showOnlyCustom = false (default)
    console.log('\n🔍 Test 1: Get active servers (showOnlyCustom = false)...');
    await AdminSetting.setShowOnlyCustomServers(false);
    
    let response = await axios.get(`${BASE_URL}/api/vpn-servers/active`);
    console.log(`Response: ${response.data.count} servers found`);
    console.log('Metadata:', response.data._metadata);
    console.log('Servers:', response.data.data.map(s => `${s._serverName} (custom: ${s._isCustomServer})`));

    // Verify we have both custom and default servers
    const hasCustom = response.data.data.some(s => s._isCustomServer === true);
    const hasDefault = response.data.data.some(s => s._isCustomServer === false);
    console.log('Has custom servers:', hasCustom);
    console.log('Has default servers:', hasDefault);
    
    // Test 2: Get active servers with showOnlyCustom = true
    console.log('\n🔍 Test 2: Get active servers (showOnlyCustom = true)...');
    await AdminSetting.setShowOnlyCustomServers(true);
    
    response = await axios.get(`${BASE_URL}/api/vpn-servers/active`);
    console.log(`Response: ${response.data.count} servers found`);
    console.log('Metadata:', response.data._metadata);
    console.log('Servers:', response.data.data.map(s => `${s._serverName} (custom: ${s._isCustomServer})`));
    
    // Test 3: Verify only custom servers are returned
    const allCustom = response.data.data.every(server => server._isCustomServer === true);
    console.log('All returned servers are custom:', allCustom);
    
    if (!allCustom) {
      throw new Error('Non-custom servers were returned when showOnlyCustom = true');
    }
    
    // Reset to false for cleanup
    await AdminSetting.setShowOnlyCustomServers(false);
    
    console.log('\n✅ All API tests passed!');
    
    // Clean up
    console.log('\n🧹 Cleaning up test data...');
    await customServer.destroy();
    await defaultServer.destroy();
    console.log('✅ Test data cleaned up');
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ API test failed:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
    process.exit(1);
  }
}

testApiEndpoints();
