const { models } = require('./database');
const { VpnServer } = models;

// Sample OpenVPN configurations for testing
const sampleConfigs = [
  {
    name: 'US East Server',
    hostname: 'us-east.example.com',
    port: 1194,
    protocol: 'UDP',
    country_short: 'US',
    country_long: 'United States',
    speed: 100,
    max_connections: 100,
    is_active: true,
    is_featured: true,
    description: 'High-speed US East Coast server',
    config: `# OpenVPN Configuration - US East
client
dev tun
proto udp
remote us-east.example.com 1194
resolv-retry infinite
nobind
persist-key
persist-tun
ca ca.crt
cert client.crt
key client.key
cipher AES-256-CBC
auth SHA256
comp-lzo
verb 3
# Sample configuration for testing`
  },
  {
    name: 'UK London Server',
    hostname: 'uk-london.example.com',
    port: 443,
    protocol: 'TCP',
    country_short: 'GB',
    country_long: 'United Kingdom',
    speed: 95,
    max_connections: 80,
    is_active: true,
    is_featured: false,
    description: 'Secure UK London server',
    config: `# OpenVPN Configuration - UK London
client
dev tun
proto tcp
remote uk-london.example.com 443
resolv-retry infinite
nobind
persist-key
persist-tun
ca ca.crt
cert client.crt
key client.key
cipher AES-256-GCM
auth SHA512
verb 3
# Sample configuration for testing`
  },
  {
    name: 'Germany Frankfurt Server',
    hostname: 'de-frankfurt.example.com',
    port: 1194,
    protocol: 'UDP',
    country_short: 'DE',
    country_long: 'Germany',
    speed: 98,
    max_connections: 120,
    is_active: true,
    is_featured: true,
    description: 'Fast German server in Frankfurt',
    config: `# OpenVPN Configuration - Germany Frankfurt
client
dev tun
proto udp
remote de-frankfurt.example.com 1194
resolv-retry infinite
nobind
persist-key
persist-tun
ca ca.crt
cert client.crt
key client.key
cipher AES-256-CBC
auth SHA256
comp-lzo
verb 3
# Sample configuration for testing`
  }
];

async function addTestVpnServers() {
  console.log('🔧 Adding test VPN servers...');
  
  try {
    // Clear existing servers
    await VpnServer.destroy({ where: {} });
    console.log('🗑️ Cleared existing VPN servers');
    
    let addedCount = 0;
    
    for (const serverConfig of sampleConfigs) {
      try {
        // Base64 encode the OpenVPN configuration
        const encodedConfig = Buffer.from(serverConfig.config, 'utf8').toString('base64');
        
        const server = await VpnServer.create({
          name: serverConfig.name,
          hostname: serverConfig.hostname,
          port: serverConfig.port,
          protocol: serverConfig.protocol,
          country_short: serverConfig.country_short,
          country_long: serverConfig.country_long,
          speed: serverConfig.speed,
          max_connections: serverConfig.max_connections,
          openvpn_config_base64: encodedConfig,
          is_active: serverConfig.is_active,
          is_featured: serverConfig.is_featured,
          description: serverConfig.description,
          server_load: Math.random() * 50 // Random load between 0-50%
        });
        
        console.log(`✅ Added VPN server: ${server.name} (ID: ${server.id})`);
        addedCount++;
        
        // Verify the Base64 encoding
        try {
          const decoded = Buffer.from(server.openvpn_config_base64, 'base64').toString('utf8');
          const isValid = decoded.includes('# OpenVPN') || decoded.includes('client') || decoded.includes('remote');
          console.log(`   📋 Base64 encoding: ${isValid ? '✅ Valid' : '❌ Invalid'}`);
        } catch (error) {
          console.log(`   📋 Base64 encoding: ❌ Invalid - ${error.message}`);
        }
        
      } catch (error) {
        console.error(`❌ Error adding server ${serverConfig.name}:`, error.message);
      }
    }
    
    console.log(`\n🎉 Successfully added ${addedCount} test VPN servers!`);
    
    // Test the API endpoint
    console.log('\n🧪 Testing API endpoint...');
    const activeServers = await VpnServer.findAll({
      where: { is_active: true },
      order: [
        ['is_featured', 'DESC'],
        ['server_load', 'ASC'],
        ['created_at', 'DESC']
      ]
    });
    
    console.log(`📡 API would return ${activeServers.length} active servers:`);
    
    for (const server of activeServers) {
      console.log(`  - ${server.name} (${server.country_short}): ${server.is_featured ? '⭐ Featured' : 'Regular'}`);
    }
    
  } catch (error) {
    console.error('❌ Error adding test VPN servers:', error);
  }
}

// Run the script
addTestVpnServers().then(() => {
  console.log('\n🏁 Script completed successfully');
  process.exit(0);
}).catch(error => {
  console.error('💥 Script failed:', error);
  process.exit(1);
});
