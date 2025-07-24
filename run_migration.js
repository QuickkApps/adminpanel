const { sequelize } = require('./database');

async function runMigration() {
  try {
    console.log('🔄 Starting database migration...');

    // Check if is_custom column already exists
    console.log('📝 Checking if is_custom column exists...');
    try {
      const [columns] = await sequelize.query(`
        PRAGMA table_info(vpn_servers)
      `);

      const hasIsCustom = columns.some(col => col.name === 'is_custom');

      if (!hasIsCustom) {
        console.log('📝 Adding is_custom column to vpn_servers table...');
        await sequelize.query(`
          ALTER TABLE vpn_servers
          ADD COLUMN is_custom BOOLEAN NOT NULL DEFAULT 1
        `);
      } else {
        console.log('✅ is_custom column already exists');
      }
    } catch (error) {
      console.log('⚠️ Error checking/adding is_custom column:', error.message);
    }

    // Create admin_settings table
    console.log('📝 Creating admin_settings table...');
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS admin_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        setting_key VARCHAR(100) NOT NULL UNIQUE,
        setting_value TEXT,
        setting_type VARCHAR(20) NOT NULL DEFAULT 'string',
        description TEXT,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Insert default setting for show_only_custom_servers
    console.log('📝 Inserting default setting for show_only_custom_servers...');
    await sequelize.query(`
      INSERT OR IGNORE INTO admin_settings (setting_key, setting_value, setting_type, description)
      VALUES (
        'show_only_custom_servers',
        'false',
        'boolean',
        'When enabled, only custom VPN servers (added via admin panel) are visible to the Flutter app. When disabled, all servers are visible.'
      )
    `);

    // Add indexes for better performance
    console.log('📝 Adding database indexes...');
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_vpn_servers_is_custom ON vpn_servers (is_custom)
    `);

    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_vpn_servers_active_custom ON vpn_servers (is_active, is_custom)
    `);
    
    console.log('✅ Database migration completed successfully!');
    
    // Verify the changes
    console.log('🔍 Verifying migration...');
    const [results] = await sequelize.query(`
      SELECT setting_key, setting_value, setting_type 
      FROM admin_settings 
      WHERE setting_key = 'show_only_custom_servers'
    `);
    
    if (results.length > 0) {
      console.log('✅ Default setting created:', results[0]);
    } else {
      console.log('⚠️ Warning: Default setting not found');
    }
    
    // Check if is_custom column exists
    const [columns] = await sequelize.query(`
      PRAGMA table_info(vpn_servers)
    `);

    const hasIsCustom = columns.some(col => col.name === 'is_custom');
    if (hasIsCustom) {
      console.log('✅ is_custom column verified successfully');
    } else {
      console.log('⚠️ Warning: is_custom column not found');
    }
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
