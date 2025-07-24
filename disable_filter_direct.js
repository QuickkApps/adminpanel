const { sequelize } = require('./database');
const AdminSetting = require('./database/models/AdminSetting');

async function disableFilterDirect() {
  try {
    console.log('🔧 Disabling VPN server filter directly in database...');
    
    // Set showOnlyCustomServers to false
    await AdminSetting.setShowOnlyCustomServers(false);
    console.log('✅ Filter disabled: showOnlyCustomServers = false');
    
    // Verify the setting
    const currentSetting = await AdminSetting.getShowOnlyCustomServers();
    console.log(`🔍 Current setting: showOnlyCustomServers = ${currentSetting}`);
    
    console.log('✅ Filter has been disabled. The Flutter app should now show all servers.');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to disable filter:', error);
    process.exit(1);
  }
}

disableFilterDirect();
