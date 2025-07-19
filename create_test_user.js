const { models } = require('./database');

async function createTestUser() {
  try {
    console.log('🔧 Creating test user...');
    
    // Create the user that the Flutter app is using
    const user = await models.User.create({
      username: 'XT30560',
      server_url: 'http://localhost:3001',
      subscription_type: 'basic',
      subscription_status: 'active',
      is_online: false
    });

    console.log(`✅ User created successfully:`);
    console.log(`   ID: ${user.id}`);
    console.log(`   Username: ${user.username}`);
    console.log(`   Subscription: ${user.subscription_type}`);
    console.log(`   Status: ${user.subscription_status}`);
    console.log(`   Created: ${user.created_at}`);

  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      console.log('ℹ️  User already exists, that\'s fine!');
      
      // Get the existing user
      const existingUser = await models.User.findOne({
        where: { username: 'XT30560' }
      });
      
      if (existingUser) {
        console.log(`✅ Existing user found:`);
        console.log(`   ID: ${existingUser.id}`);
        console.log(`   Username: ${existingUser.username}`);
        console.log(`   Subscription: ${existingUser.subscription_type}`);
        console.log(`   Status: ${existingUser.subscription_status}`);
      }
    } else {
      console.error('❌ Error creating user:', error);
    }
  } finally {
    process.exit(0);
  }
}

createTestUser();
