const { models } = require('./database');
const configService = require('./services/configService');

async function verifyAdminPanelData() {
    console.log('🔍 Verifying admin panel data after restore...');
    
    try {
        // 1. Check configuration
        console.log('\n📋 Configuration Status:');
        const config = await configService.readConfig();
        if (config) {
            console.log(`   ✅ Configuration loaded successfully`);
            console.log(`   📡 API URL: ${config.apiUrl}`);
            console.log(`   👤 Username: ${config.username}`);
            console.log(`   🔄 Active: ${config.isActive ? 'Yes' : 'No'}`);
            console.log(`   📅 Last Updated: ${config.lastUpdated}`);
        } else {
            console.log('   ❌ Configuration not found');
        }
        
        // 2. Check users
        console.log('\n👥 User Data:');
        const users = await models.User.findAll({
            attributes: ['id', 'username', 'subscription_type', 'subscription_status', 'is_active', 'is_online'],
            order: [['id', 'ASC']]
        });
        
        console.log(`   📊 Total users: ${users.length}`);
        
        const userStats = {
            active: users.filter(u => u.is_active).length,
            online: users.filter(u => u.is_online).length,
            premium: users.filter(u => u.subscription_type === 'premium').length,
            basic: users.filter(u => u.subscription_type === 'basic').length,
            trial: users.filter(u => u.subscription_type === 'trial').length
        };
        
        console.log(`   🟢 Active users: ${userStats.active}`);
        console.log(`   🔵 Online users: ${userStats.online}`);
        console.log(`   💎 Premium users: ${userStats.premium}`);
        console.log(`   📦 Basic users: ${userStats.basic}`);
        console.log(`   🆓 Trial users: ${userStats.trial}`);
        
        console.log('\n   📝 User List:');
        users.forEach(user => {
            const status = user.is_active ? '🟢' : '🔴';
            const online = user.is_online ? '🔵' : '⚫';
            console.log(`     ${status}${online} ${user.username} (${user.subscription_type}, ${user.subscription_status})`);
        });
        
        // 3. Check VPN servers
        console.log('\n🌐 VPN Server Data:');
        const vpnServers = await models.VpnServer.findAll({
            attributes: ['id', 'name', 'country_short', 'is_active', 'is_featured', 'speed', 'server_load'],
            order: [['is_featured', 'DESC'], ['speed', 'DESC']]
        });
        
        console.log(`   📊 Total VPN servers: ${vpnServers.length}`);
        
        const serverStats = {
            active: vpnServers.filter(s => s.is_active).length,
            featured: vpnServers.filter(s => s.is_featured).length
        };
        
        console.log(`   🟢 Active servers: ${serverStats.active}`);
        console.log(`   ⭐ Featured servers: ${serverStats.featured}`);
        
        console.log('\n   📝 Server List:');
        vpnServers.forEach(server => {
            const status = server.is_active ? '🟢' : '🔴';
            const featured = server.is_featured ? '⭐' : '  ';
            console.log(`     ${status}${featured} ${server.name} (${server.country_short}) - Speed: ${server.speed}Mbps, Load: ${server.server_load}%`);
        });
        
        // 4. Check admin accounts
        console.log('\n👨‍💼 Admin Data:');
        const admins = await models.Admin.findAll({
            attributes: ['id', 'username', 'role', 'is_active', 'last_login'],
            order: [['id', 'ASC']]
        });
        
        console.log(`   📊 Total admins: ${admins.length}`);
        
        console.log('\n   📝 Admin List:');
        admins.forEach(admin => {
            const status = admin.is_active ? '🟢' : '🔴';
            const lastLogin = admin.last_login ? new Date(admin.last_login).toLocaleString() : 'Never';
            console.log(`     ${status} ${admin.username} (${admin.role}) - Last login: ${lastLogin}`);
        });
        
        // 5. Check database integrity
        console.log('\n🔍 Database Integrity Check:');
        
        // Check for any null or invalid data
        const usersWithNullUrls = await models.User.count({ where: { server_url: null } });
        const usersWithNullSubscription = await models.User.count({ where: { subscription_type: null } });
        const inactiveVpnServers = await models.VpnServer.count({ where: { is_active: false } });
        
        console.log(`   📊 Users with null server_url: ${usersWithNullUrls}`);
        console.log(`   📊 Users with null subscription: ${usersWithNullSubscription}`);
        console.log(`   📊 Inactive VPN servers: ${inactiveVpnServers}`);
        
        if (usersWithNullUrls === 0 && usersWithNullSubscription === 0) {
            console.log('   ✅ Database integrity check passed');
        } else {
            console.log('   ⚠️  Database integrity issues found');
        }
        
        // 6. Test API endpoints simulation
        console.log('\n🧪 API Endpoint Simulation:');
        
        // Simulate user stats endpoint
        const activeUsers = await models.User.count({ where: { is_active: true } });
        const onlineUsers = await models.User.count({ where: { is_online: true } });
        const totalConnections = await models.User.sum('current_connections') || 0;
        
        console.log(`   📊 /api/users/stats would return:`);
        console.log(`     - Total users: ${users.length}`);
        console.log(`     - Active users: ${activeUsers}`);
        console.log(`     - Online users: ${onlineUsers}`);
        console.log(`     - Total connections: ${totalConnections}`);
        
        // Simulate VPN servers endpoint
        const activeVpnServers = await models.VpnServer.findAll({
            where: { is_active: true },
            attributes: ['name', 'country_short', 'is_featured'],
            order: [['is_featured', 'DESC'], ['speed', 'DESC']]
        });
        
        console.log(`   📊 /api/vpn/servers would return ${activeVpnServers.length} active servers`);
        
        console.log('\n🎉 Admin panel data verification completed successfully!');
        console.log('\n💡 The admin panel should now display all restored data correctly.');
        
    } catch (error) {
        console.error('❌ Verification failed:', error);
    }
}

// Run if called directly
if (require.main === module) {
    verifyAdminPanelData().then(() => {
        console.log('\n🏁 Verification completed');
        process.exit(0);
    }).catch(error => {
        console.error('💥 Verification script failed:', error);
        process.exit(1);
    });
}

module.exports = verifyAdminPanelData;
