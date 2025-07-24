const { models } = require('./database');
const configService = require('./services/configService');

async function testRestoreFunctionality() {
    console.log('🧪 Testing restore functionality...');
    
    try {
        // 1. Get current state
        console.log('\n📊 Current Database State:');
        const currentUsers = await models.User.count();
        const currentAdmins = await models.Admin.count();
        const currentVpnServers = await models.VpnServer.count();
        
        console.log(`   - Users: ${currentUsers}`);
        console.log(`   - Admins: ${currentAdmins}`);
        console.log(`   - VPN Servers: ${currentVpnServers}`);
        
        // 2. List available backups
        const fs = require('fs').promises;
        const path = require('path');
        const backupDir = path.join(__dirname, 'backups');
        
        const backupFiles = await fs.readdir(backupDir);
        const fullBackups = backupFiles.filter(file => file.startsWith('full_backup_') && file.endsWith('.json'));
        
        console.log('\n📁 Available Full Backups:');
        for (const backup of fullBackups.slice(-3)) { // Show last 3 backups
            const backupPath = path.join(backupDir, backup);
            const backupData = JSON.parse(await fs.readFile(backupPath, 'utf8'));
            const createdAt = new Date(backupData.metadata.createdAt).toLocaleString();
            const userCount = backupData.database?.users?.length || 0;
            const vpnCount = backupData.database?.vpnServers?.length || 0;
            
            console.log(`   - ${backup}`);
            console.log(`     Created: ${createdAt}`);
            console.log(`     Contains: ${userCount} users, ${vpnCount} VPN servers`);
        }
        
        // 3. Test restore with the latest backup
        if (fullBackups.length > 0) {
            const latestBackup = fullBackups[fullBackups.length - 1];
            console.log(`\n🔄 Testing restore with: ${latestBackup}`);
            
            try {
                // First, modify current state to test restore
                console.log('   📝 Modifying current state for testing...');
                
                // Add a test user to see if restore removes it
                const testUser = await models.User.create({
                    username: 'test_restore_user',
                    server_url: 'http://localhost:3001',
                    subscription_type: 'test',
                    subscription_status: 'active',
                    is_active: true,
                    is_online: false
                });
                
                console.log(`   ✅ Added test user: ${testUser.username} (ID: ${testUser.id})`);
                
                const modifiedUsers = await models.User.count();
                console.log(`   📊 Users after modification: ${modifiedUsers}`);
                
                // Now test restore
                console.log('\n🔄 Performing restore...');
                const restoreResult = await configService.restoreFromBackup(latestBackup, {
                    restoreDatabase: true,
                    restoreConfiguration: true,
                    currentUserId: 1 // Admin ID
                });
                
                console.log(`   ✅ Restore completed: ${restoreResult.message}`);
                console.log(`   📋 Restored items: ${restoreResult.restoredItems.join(', ')}`);
                
                // Check final state
                console.log('\n📊 Database State After Restore:');
                const finalUsers = await models.User.count();
                const finalAdmins = await models.Admin.count();
                const finalVpnServers = await models.VpnServer.count();
                
                console.log(`   - Users: ${finalUsers}`);
                console.log(`   - Admins: ${finalAdmins}`);
                console.log(`   - VPN Servers: ${finalVpnServers}`);
                
                // Verify test user was removed
                const testUserExists = await models.User.findOne({
                    where: { username: 'test_restore_user' }
                });
                
                if (testUserExists) {
                    console.log('   ❌ Test user still exists - restore may not have worked properly');
                } else {
                    console.log('   ✅ Test user removed - restore worked correctly');
                }
                
                // Show some restored users
                const restoredUsers = await models.User.findAll({ limit: 5 });
                console.log('\n👥 Sample Restored Users:');
                restoredUsers.forEach(user => {
                    console.log(`   - ${user.username} (${user.subscription_type})`);
                });
                
                console.log('\n🎉 Restore functionality test completed successfully!');
                
            } catch (restoreError) {
                console.error('❌ Restore test failed:', restoreError.message);
            }
            
        } else {
            console.log('\n❌ No full backups found to test with');
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

// Run if called directly
if (require.main === module) {
    testRestoreFunctionality().then(() => {
        console.log('\n🏁 Test completed');
        process.exit(0);
    }).catch(error => {
        console.error('💥 Test script failed:', error);
        process.exit(1);
    });
}

module.exports = testRestoreFunctionality;
