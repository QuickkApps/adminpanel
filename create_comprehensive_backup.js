const { models } = require('./database');
const configService = require('./services/configService');

async function createComprehensiveBackup() {
    console.log('🔧 Creating comprehensive backup with all current data...');
    
    try {
        // Create backup using the service
        const backupFileName = await configService.createBackup();
        
        if (backupFileName) {
            console.log(`✅ Comprehensive backup created: ${backupFileName}`);
            
            // Verify backup contents
            const fs = require('fs').promises;
            const path = require('path');
            const backupPath = path.join(__dirname, 'backups', backupFileName);
            
            const backupData = JSON.parse(await fs.readFile(backupPath, 'utf8'));
            
            console.log('\n📊 Backup Contents:');
            console.log(`   - Configuration: ${backupData.configuration ? '✅ Included' : '❌ Missing'}`);
            console.log(`   - Admins: ${backupData.database?.admins?.length || 0} accounts`);
            console.log(`   - Users: ${backupData.database?.users?.length || 0} users`);
            console.log(`   - User Sessions: ${backupData.database?.userSessions?.length || 0} sessions`);
            console.log(`   - Admin Sessions: ${backupData.database?.adminSessions?.length || 0} sessions`);
            console.log(`   - Chat Conversations: ${backupData.database?.chatConversations?.length || 0} conversations`);
            console.log(`   - Chat Messages: ${backupData.database?.chatMessages?.length || 0} messages`);
            console.log(`   - VPN Servers: ${backupData.database?.vpnServers?.length || 0} servers`);
            
            // Show current database stats for comparison
            console.log('\n📈 Current Database Stats:');
            const userCount = await models.User.count();
            const adminCount = await models.Admin.count();
            const vpnServerCount = await models.VpnServer.count();
            
            console.log(`   - Current Users in DB: ${userCount}`);
            console.log(`   - Current Admins in DB: ${adminCount}`);
            console.log(`   - Current VPN Servers in DB: ${vpnServerCount}`);
            
            if (backupData.database?.users?.length !== userCount) {
                console.log(`⚠️  WARNING: Backup users (${backupData.database?.users?.length || 0}) != Current users (${userCount})`);
            }
            
            return backupFileName;
        } else {
            console.log('❌ Failed to create backup');
            return null;
        }
        
    } catch (error) {
        console.error('❌ Error creating comprehensive backup:', error);
        return null;
    }
}

// Run if called directly
if (require.main === module) {
    createComprehensiveBackup().then((backupFileName) => {
        if (backupFileName) {
            console.log(`\n🎉 Backup completed successfully: ${backupFileName}`);
            console.log('\n💡 You can now use this backup to restore to this exact state.');
        } else {
            console.log('\n❌ Backup failed');
        }
        process.exit(0);
    }).catch(error => {
        console.error('💥 Script failed:', error);
        process.exit(1);
    });
}

module.exports = createComprehensiveBackup;
