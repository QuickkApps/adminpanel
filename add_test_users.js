const { models, sequelize } = require('./database');

async function addTestUsers() {
  try {
    console.log('🔄 Adding test users...');

    const testUsers = [
      {
        username: 'john_doe',
        server_url: 'vpn.us-east-1.example.com',
        subscription_type: 'premium',
        subscription_status: 'active',
        expiry_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        max_connections: 3,
        current_connections: 1,
        total_connections: 25,
        last_login: new Date(),
        last_ip: '192.168.1.100',
        user_agent: 'Anume VPN Client v1.0.0',
        app_version: '1.0.0',
        device_info: JSON.stringify({
          platform: 'Android',
          version: '12',
          model: 'Samsung Galaxy S21'
        }),
        is_active: true,
        is_online: true,
        last_activity: new Date(),
        notes: 'Premium user - very active'
      },
      {
        username: 'jane_smith',
        server_url: 'vpn.eu-west-1.example.com',
        subscription_type: 'basic',
        subscription_status: 'active',
        expiry_date: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), // 15 days from now
        max_connections: 1,
        current_connections: 0,
        total_connections: 12,
        last_login: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
        last_ip: '10.0.0.50',
        user_agent: 'Anume VPN Client v1.0.0',
        app_version: '1.0.0',
        device_info: JSON.stringify({
          platform: 'iOS',
          version: '16.0',
          model: 'iPhone 14'
        }),
        is_active: true,
        is_online: false,
        last_activity: new Date(Date.now() - 2 * 60 * 60 * 1000),
        notes: 'Basic user - regular usage'
      },
      {
        username: 'mike_wilson',
        server_url: 'vpn.asia-pacific-1.example.com',
        subscription_type: 'trial',
        subscription_status: 'expired',
        expiry_date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago (expired)
        max_connections: 1,
        current_connections: 0,
        total_connections: 3,
        last_login: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
        last_ip: '172.16.0.25',
        user_agent: 'Anume VPN Client v0.9.5',
        app_version: '0.9.5',
        device_info: JSON.stringify({
          platform: 'Windows',
          version: '11',
          model: 'Desktop PC'
        }),
        is_active: false,
        is_online: false,
        last_activity: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        notes: 'Trial expired - needs renewal'
      },
      {
        username: 'sarah_johnson',
        server_url: 'vpn.us-west-1.example.com',
        subscription_type: 'premium',
        subscription_status: 'suspended',
        expiry_date: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days from now
        max_connections: 3,
        current_connections: 0,
        total_connections: 45,
        last_login: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
        last_ip: '203.0.113.15',
        user_agent: 'Anume VPN Client v1.0.0',
        app_version: '1.0.0',
        device_info: JSON.stringify({
          platform: 'macOS',
          version: '13.0',
          model: 'MacBook Pro'
        }),
        is_active: false,
        is_online: false,
        last_activity: new Date(Date.now() - 24 * 60 * 60 * 1000),
        notes: 'Account suspended - policy violation'
      },
      {
        username: 'alex_brown',
        server_url: 'vpn.canada-central-1.example.com',
        subscription_type: 'basic',
        subscription_status: 'active',
        expiry_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
        max_connections: 1,
        current_connections: 1,
        total_connections: 18,
        last_login: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
        last_ip: '198.51.100.75',
        user_agent: 'Anume VPN Client v1.0.0',
        app_version: '1.0.0',
        device_info: JSON.stringify({
          platform: 'Android',
          version: '13',
          model: 'Google Pixel 7'
        }),
        is_active: true,
        is_online: true,
        last_activity: new Date(Date.now() - 30 * 60 * 1000),
        notes: 'Basic user - expires soon'
      }
    ];

    // Add users to database
    for (const userData of testUsers) {
      const user = await models.User.create(userData);
      console.log(`✅ Created user: ${user.username} (${user.email})`);
    }

    console.log(`🎉 Successfully added ${testUsers.length} test users!`);
    
    // Display summary
    const totalUsers = await models.User.count();
    console.log(`📊 Total users in database: ${totalUsers}`);

  } catch (error) {
    console.error('❌ Error adding test users:', error);
  } finally {
    await sequelize.close();
  }
}

// Run the script
addTestUsers();
