const { sequelize } = require('./database');

async function debugDatabase() {
  try {
    console.log('🔍 Debugging database...');
    
    // Check the table structure
    const [columns] = await sequelize.query(`PRAGMA table_info(vpn_servers)`);
    console.log('\nTable structure:');
    columns.forEach(col => {
      console.log(`  ${col.name}: ${col.type} (default: ${col.dflt_value}, nullable: ${col.notnull === 0})`);
    });
    
    // Check existing data
    const [servers] = await sequelize.query(`SELECT id, name, is_custom FROM vpn_servers`);
    console.log('\nExisting servers:');
    servers.forEach(server => {
      console.log(`  ${server.name}: is_custom = ${server.is_custom}`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Debug failed:', error);
    process.exit(1);
  }
}

debugDatabase();
