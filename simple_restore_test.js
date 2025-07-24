const { models } = require('./database');
const configService = require('./services/configService');

async function simpleRestoreTest() {
    console.log('🧪 Simple restore test...');
    
    try {
        // Get current state
        console.log('\n📊 Current Database State:');
        const currentUsers = await models.User.count();
        const currentAdmins = await models.Admin.count();
        const currentVpnServers = await models.VpnServer.count();
        
        console.log(`   - Users: ${currentUsers}`);
        console.log(`   - Admins: ${currentAdmins}`);
        console.log(`   - VPN Servers: ${currentVpnServers}`);
        
        // List available backups
        const fs = require('fs').promises;
        const path = require('path');
        const backupDir = path.join(__dirname, 'backups');
        
        const backupFiles = await fs.readdir(backupDir);
        const fullBackups = backupFiles.filter(file => file.startsWith('full_backup_') && file.endsWith('.json'));
        
        if (fullBackups.length === 0) {
            console.log('❌ No backups found');
            return;
        }
        
        // Use the backup with 9 users (before we added the test user)
        const targetBackup = fullBackups.find(backup => backup.includes('33min-51sec')) || fullBackups[0];
        console.log(`\n🔄 Testing restore with: ${targetBackup}`);
        
        // Read backup to see what it contains
        const backupPath = path.join(backupDir, targetBackup);
        const backupData = JSON.parse(await fs.readFile(backupPath, 'utf8'));
        const backupUserCount = backupData.database?.users?.length || 0;
        const backupVpnCount = backupData.database?.vpnServers?.length || 0;
        
        console.log(`   📋 Backup contains: ${backupUserCount} users, ${backupVpnCount} VPN servers`);
        
        // Perform restore
        try {
            const restoreResult = await configService.restoreFromBackup(targetBackup, {
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
            
            // Verify restore worked correctly
            if (finalUsers === backupUserCount) {
                console.log('   ✅ User count matches backup - restore successful');
            } else {
                console.log(`   ⚠️  User count mismatch: expected ${backupUserCount}, got ${finalUsers}`);
            }
            
            if (finalVpnServers === backupVpnCount) {
                console.log('   ✅ VPN server count matches backup - restore successful');
            } else {
                console.log(`   ⚠️  VPN server count mismatch: expected ${backupVpnCount}, got ${finalVpnServers}`);
            }
            
            // Show some restored users
            const restoredUsers = await models.User.findAll({ 
                limit: 5,
                attributes: ['id', 'username', 'subscription_type', 'subscription_status']
            });
            console.log('\n👥 Sample Restored Users:');
            restoredUsers.forEach(user => {
                console.log(`   - ${user.username} (${user.subscription_type}, ${user.subscription_status})`);
            });
            
            console.log('\n🎉 Simple restore test completed successfully!');
            
        } catch (restoreError) {
            console.error('❌ Restore failed:', restoreError.message);
            console.error('Full error:', restoreError);
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

// Run if called directly
if (require.main === module) {
    simpleRestoreTest().then(() => {
        console.log('\n🏁 Test completed');
        process.exit(0);
    }).catch(error => {
        console.error('💥 Test script failed:', error);
        process.exit(1);
    });
}

module.exports = simpleRestoreTest;
