/**
 * Railway Migration Script
 * This script runs the fallback URL migration on Railway production environment
 */

const { models, initializeDatabase } = require('./database');
const logger = require('./utils/logger');

async function runRailwayMigration() {
  try {
    console.log('🚂 Starting Railway migration...');
    console.log('🔧 Environment:', process.env.NODE_ENV || 'development');
    console.log('🔧 Database URL:', process.env.DATABASE_URL ? 'Set' : 'Not set');
    
    // Initialize database
    console.log('🔄 Initializing database connection...');
    await initializeDatabase();
    
    const { FallbackUrl } = models;
    
    // Check if FallbackUrl table exists and is accessible
    console.log('🔍 Checking FallbackUrl table...');
    try {
      const count = await FallbackUrl.count();
      console.log(`✅ FallbackUrl table exists with ${count} records`);
    } catch (error) {
      console.error('❌ FallbackUrl table issue:', error.message);
      throw error;
    }
    
    // Test basic operations
    console.log('🧪 Testing basic operations...');
    
    // Test getActiveUrls method
    const activeUrls = await FallbackUrl.getActiveUrls('api');
    console.log(`✅ Found ${activeUrls.length} active API URLs`);
    
    // If no URLs exist, create a default one for testing
    if (activeUrls.length === 0) {
      console.log('📝 Creating default fallback URL for testing...');
      const defaultUrl = await FallbackUrl.create({
        url: 'https://web-production-6358.up.railway.app/api/config',
        url_type: 'api',
        description: 'Default Railway API URL',
        priority: 1,
        is_active: true,
      });
      console.log('✅ Created default URL:', defaultUrl.url);
    }
    
    // Verify the table structure
    console.log('🔍 Verifying table structure...');
    const tableInfo = await FallbackUrl.describe();
    console.log('✅ Table columns:', Object.keys(tableInfo));
    
    // Test all methods
    console.log('🧪 Testing all model methods...');
    
    // Test getActiveUrls
    const testActiveUrls = await FallbackUrl.getActiveUrls('api');
    console.log(`✅ getActiveUrls: ${testActiveUrls.length} URLs`);
    
    // Test findAll
    const allUrls = await FallbackUrl.findAll();
    console.log(`✅ findAll: ${allUrls.length} URLs`);
    
    console.log('🎉 Railway migration completed successfully!');
    console.log('📋 Summary:');
    console.log(`   - Total URLs: ${allUrls.length}`);
    console.log(`   - Active URLs: ${testActiveUrls.length}`);
    
    // List all URLs
    if (allUrls.length > 0) {
      console.log('📋 Current fallback URLs:');
      allUrls.forEach((url, index) => {
        console.log(`   ${index + 1}. ${url.url} (${url.url_type}, priority: ${url.priority}, active: ${url.is_active})`);
      });
    }
    
  } catch (error) {
    console.error('❌ Railway migration failed:', error);
    logger.error('Railway migration failed:', error);
    throw error;
  } finally {
    console.log('🔌 Closing database connection...');
    process.exit(0);
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Run the migration
console.log('🚀 Starting Railway migration script...');
runRailwayMigration();
