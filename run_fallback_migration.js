const { sequelize } = require('./database');
const path = require('path');

async function runFallbackMigration() {
  try {
    console.log('🔄 Starting fallback URLs migration...');

    // Load and run the fallback URLs migration
    const migrationPath = path.join(__dirname, 'database', 'migrations', '20250724-create-fallback-urls.js');
    const migration = require(migrationPath);

    console.log('📝 Running fallback URLs table creation...');
    await migration.up(sequelize.getQueryInterface(), sequelize.constructor);

    console.log('✅ Fallback URLs migration completed successfully!');

    // Verify the table was created
    console.log('🔍 Verifying table creation...');
    const tables = await sequelize.getQueryInterface().showAllTables();
    
    if (tables.includes('FallbackUrls')) {
      console.log('✅ FallbackUrls table verified successfully');
      
      // Check table structure
      const tableInfo = await sequelize.query(`PRAGMA table_info(FallbackUrls)`);
      console.log('📋 Table structure:');
      tableInfo[0].forEach(column => {
        console.log(`  - ${column.name}: ${column.type} ${column.notnull ? 'NOT NULL' : 'NULL'} ${column.dflt_value ? `DEFAULT ${column.dflt_value}` : ''}`);
      });
    } else {
      console.log('❌ FallbackUrls table not found after migration');
    }

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await sequelize.close();
    console.log('🔌 Database connection closed');
  }
}

// Run the migration
runFallbackMigration();
