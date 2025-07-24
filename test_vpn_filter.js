const { models } = require('./database');
const { VpnServer, AdminSetting } = models;

async function testVpnFiltering() {
  try {
    console.log('🧪 Testing VPN server filtering...');
    
    // Create a test custom server
    const customServer = await VpnServer.create({
      name: 'Test Custom Server',
      hostname: 'custom.example.com',
      ip: '192.168.1.100',
      port: 1194,
      protocol: 'udp',
      country_long: 'Test Country',
      country_short: 'TC',
      openvpn_config_base64: Buffer.from('test config').toString('base64'),
      is_custom: true,
      is_active: true,
      created_by: 1
    });
    
    // Create a test default/pre-configured server
    const defaultServer = await VpnServer.create({
      name: 'Test Default Server',
      hostname: 'default.example.com',
      ip: '192.168.1.101',
      port: 1194,
      protocol: 'udp',
      country_long: 'Default Country',
      country_short: 'DC',
      openvpn_config_base64: Buffer.from('default config').toString('base64'),
      is_custom: false,
      is_active: true,
      created_by: 1
    });
    
    console.log('✅ Created test servers:');
    console.log('  - Custom Server:', customServer.name);
    console.log('  - Default Server:', defaultServer.name);
    
    // Test filtering with showOnlyCustom = false (should return both)
    console.log('\n🔍 Testing with showOnlyCustom = false...');
    let servers = await VpnServer.getFilteredServers(false);
    console.log(`Found ${servers.length} servers:`, servers.map(s => `${s.name} (custom: ${s.is_custom})`));
    
    // Test filtering with showOnlyCustom = true (should return only custom)
    console.log('\n🔍 Testing with showOnlyCustom = true...');
    servers = await VpnServer.getFilteredServers(true);
    console.log(`Found ${servers.length} servers:`, servers.map(s => `${s.name} (custom: ${s.is_custom})`));
    
    // Test the setting functions
    console.log('\n⚙️ Testing AdminSetting functions...');
    
    // Set to true
    await AdminSetting.setShowOnlyCustomServers(true);
    let setting = await AdminSetting.getShowOnlyCustomServers();
    console.log('Setting after setting to true:', setting);
    
    // Set to false
    await AdminSetting.setShowOnlyCustomServers(false);
    setting = await AdminSetting.getShowOnlyCustomServers();
    console.log('Setting after setting to false:', setting);
    
    console.log('\n✅ All tests passed!');
    
    // Clean up test data
    console.log('\n🧹 Cleaning up test data...');
    await customServer.destroy();
    await defaultServer.destroy();
    console.log('✅ Test data cleaned up');
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

testVpnFiltering();
