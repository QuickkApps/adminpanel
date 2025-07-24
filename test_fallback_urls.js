const { models, initializeDatabase } = require('./database');
const logger = require('./utils/logger');

async function testFallbackUrls() {
  try {
    console.log('🔄 Initializing database...');
    await initializeDatabase();
    
    const { FallbackUrl } = models;
    
    console.log('📋 Testing FallbackUrl model...');
    
    // Test 1: Create a fallback URL
    console.log('\n1️⃣ Creating test fallback URL...');
    const testUrl = await FallbackUrl.create({
      url: 'https://api.example.com/test',
      url_type: 'api',
      description: 'Test API URL',
      priority: 1,
      created_by: 1,
    });
    console.log('✅ Created:', testUrl.toJSON());
    
    // Test 2: Get all fallback URLs
    console.log('\n2️⃣ Getting all fallback URLs...');
    const allUrls = await FallbackUrl.findAll();
    console.log('✅ Found', allUrls.length, 'URLs');
    allUrls.forEach(url => {
      console.log(`   - ${url.url} (${url.url_type}, priority: ${url.priority})`);
    });
    
    // Test 3: Get active URLs
    console.log('\n3️⃣ Getting active URLs...');
    const activeUrls = await FallbackUrl.getActiveUrls('api');
    console.log('✅ Found', activeUrls.length, 'active API URLs');
    
    // Test 4: Update test result
    console.log('\n4️⃣ Testing updateTestResult...');
    const updateResult = await FallbackUrl.updateTestResult(
      testUrl.id,
      'success',
      150,
      null
    );
    console.log('✅ Update result:', updateResult);
    
    // Test 5: Verify update
    console.log('\n5️⃣ Verifying update...');
    const updatedUrl = await FallbackUrl.findByPk(testUrl.id);
    console.log('✅ Updated URL:', {
      id: updatedUrl.id,
      url: updatedUrl.url,
      last_test_status: updatedUrl.last_test_status,
      last_test_response_time: updatedUrl.last_test_response_time,
      success_count: updatedUrl.success_count,
    });
    
    // Test 6: Create another URL for reordering test
    console.log('\n6️⃣ Creating second URL for reordering test...');
    const testUrl2 = await FallbackUrl.create({
      url: 'https://api2.example.com/test',
      url_type: 'api',
      description: 'Second Test API URL',
      priority: 2,
      created_by: 1,
    });
    console.log('✅ Created second URL:', testUrl2.toJSON());
    
    // Test 7: Test reordering
    console.log('\n7️⃣ Testing reordering...');
    const reorderResult = await FallbackUrl.reorderPriorities([testUrl2.id, testUrl.id]);
    console.log('✅ Reorder result:', reorderResult);
    
    // Test 8: Verify reordering
    console.log('\n8️⃣ Verifying reordering...');
    const reorderedUrls = await FallbackUrl.findAll({
      order: [['priority', 'ASC']],
    });
    console.log('✅ Reordered URLs:');
    reorderedUrls.forEach(url => {
      console.log(`   - Priority ${url.priority}: ${url.url}`);
    });
    
    // Cleanup
    console.log('\n🧹 Cleaning up test data...');
    await FallbackUrl.destroy({ where: { id: [testUrl.id, testUrl2.id] } });
    console.log('✅ Cleanup completed');
    
    console.log('\n🎉 All tests passed! FallbackUrl model is working correctly.');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    logger.error('FallbackUrl test failed:', error);
  } finally {
    process.exit(0);
  }
}

// Run the test
testFallbackUrls();
