const { models } = require('./database');

async function createMultipleTestUsers() {
  try {
    console.log('🔧 Creating multiple test users...');
    
    const users = [
      { username: 'TestUser1', subscription: 'basic' },
      { username: 'TestUser2', subscription: 'premium' },
      { username: 'TestUser3', subscription: 'trial' }
    ];
    
    for (const userData of users) {
      // Check if user already exists
      const existingUser = await models.User.findOne({
        where: { username: userData.username }
      });
      
      if (existingUser) {
        console.log(`ℹ️  User ${userData.username} already exists, skipping...`);
        continue;
      }
      
      // Create new user
      const user = await models.User.create({
        username: userData.username,
        subscription_type: userData.subscription,
        subscription_status: 'active',
        server_url: 'http://localhost:3001',
        is_online: false,
        last_login: null,
        created_at: new Date(),
        updated_at: new Date()
      });
      
      console.log(`✅ User created successfully:`);
      console.log(`   ID: ${user.id}`);
      console.log(`   Username: ${user.username}`);
      console.log(`   Subscription: ${user.subscription_type}`);
      console.log(`   Status: ${user.subscription_status}`);
      console.log('');
    }
    
    console.log('✅ All test users created successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating test users:', error);
    process.exit(1);
  }
}

createMultipleTestUsers();
