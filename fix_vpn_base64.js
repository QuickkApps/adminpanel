const { models } = require('./database');
const { VpnServer } = models;

async function fixVpnBase64Encoding() {
  console.log('🔧 Starting VPN server Base64 encoding fix...');
  
  try {
    // Get all VPN servers
    const servers = await VpnServer.findAll();
    console.log(`📊 Found ${servers.length} VPN servers to check`);
    
    let fixedCount = 0;
    
    for (const server of servers) {
      try {
        // Check if the data is already Base64 encoded by trying to decode it
        const decoded = Buffer.from(server.openvpn_config_base64, 'base64').toString('utf8');
        
        // If it decodes successfully and looks like OpenVPN config, it's already encoded
        if (decoded.includes('# OpenVPN') || decoded.includes('dev tun') || decoded.includes('remote ')) {
          console.log(`✅ Server "${server.name}" (ID: ${server.id}) already has properly encoded Base64 data`);
          continue;
        }
        
        // If we get here, the data might not be properly Base64 encoded
        // Let's check if the current data looks like raw OpenVPN config
        if (server.openvpn_config_base64.includes('# OpenVPN') || 
            server.openvpn_config_base64.includes('dev tun') || 
            server.openvpn_config_base64.includes('remote ')) {
          
          // This is raw OpenVPN config, needs to be Base64 encoded
          const encodedConfig = Buffer.from(server.openvpn_config_base64, 'utf8').toString('base64');
          
          await server.update({
            openvpn_config_base64: encodedConfig
          });
          
          console.log(`🔧 Fixed Base64 encoding for server "${server.name}" (ID: ${server.id})`);
          fixedCount++;
        } else {
          console.log(`⚠️ Server "${server.name}" (ID: ${server.id}) has unknown data format, skipping`);
        }
        
      } catch (decodeError) {
        // If decoding fails, the data might be raw OpenVPN config
        if (server.openvpn_config_base64.includes('# OpenVPN') || 
            server.openvpn_config_base64.includes('dev tun') || 
            server.openvpn_config_base64.includes('remote ')) {
          
          // This is raw OpenVPN config, needs to be Base64 encoded
          const encodedConfig = Buffer.from(server.openvpn_config_base64, 'utf8').toString('base64');
          
          await server.update({
            openvpn_config_base64: encodedConfig
          });
          
          console.log(`🔧 Fixed Base64 encoding for server "${server.name}" (ID: ${server.id})`);
          fixedCount++;
        } else {
          console.log(`⚠️ Server "${server.name}" (ID: ${server.id}) has unknown data format, skipping`);
        }
      }
    }
    
    console.log(`✅ Base64 encoding fix completed! Fixed ${fixedCount} out of ${servers.length} servers`);
    
    // Test the API endpoint to verify the fix
    console.log('\n🧪 Testing API endpoint...');
    const activeServers = await VpnServer.findAll({
      where: { is_active: true },
      order: [
        ['is_featured', 'DESC'],
        ['server_load', 'ASC'],
        ['created_at', 'DESC']
      ]
    });
    
    console.log(`📡 API would return ${activeServers.length} active servers`);
    
    for (const server of activeServers) {
      try {
        const decoded = Buffer.from(server.openvpn_config_base64, 'base64').toString('utf8');
        const isValidConfig = decoded.includes('# OpenVPN') || decoded.includes('dev tun') || decoded.includes('remote ');
        console.log(`  - ${server.name}: ${isValidConfig ? '✅ Valid' : '❌ Invalid'} OpenVPN config`);
      } catch (error) {
        console.log(`  - ${server.name}: ❌ Invalid Base64 encoding`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error fixing VPN Base64 encoding:', error);
  }
}

// Run the fix
fixVpnBase64Encoding().then(() => {
  console.log('🏁 Script completed');
  process.exit(0);
}).catch(error => {
  console.error('💥 Script failed:', error);
  process.exit(1);
});
