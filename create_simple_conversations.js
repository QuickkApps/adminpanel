const { models } = require('./database');
const { User, Conversation, Message } = models;

async function createSimpleConversations() {
    console.log('🧪 Creating test conversations with existing users...');

    try {
        // Get existing users
        const users = await User.findAll({ limit: 3 });
        
        if (users.length === 0) {
            console.log('❌ No users found. Please add users first.');
            return;
        }

        console.log(`✅ Found ${users.length} users to create conversations for`);

        // Create conversations for existing users
        for (let i = 0; i < Math.min(users.length, 3); i++) {
            const user = users[i];
            
            // Check if conversation already exists
            const existingConv = await Conversation.findOne({
                where: { userId: user.id }
            });

            if (existingConv) {
                console.log(`ℹ️  Conversation already exists for user ${user.username}, skipping...`);
                continue;
            }

            // Create conversation
            const conversation = await Conversation.create({
                userId: user.id,
                subject: `Support request from ${user.username}`,
                status: 'open',
                lastMessageAt: new Date()
            });

            console.log(`✅ Created conversation for user: ${user.username} (ID: ${conversation.id})`);

            // Create initial message
            const message = await Message.create({
                conversationId: conversation.id,
                senderId: user.id,
                senderType: 'user',
                message: `Hello, I need help with my ${user.subscription_type} subscription. Can you assist me?`
            });

            console.log(`   📝 Added initial message (ID: ${message.id})`);

            // Create admin response
            const adminResponse = await Message.create({
                conversationId: conversation.id,
                senderId: 1, // Admin ID
                senderType: 'admin',
                message: `Hello ${user.username}! I'd be happy to help you with your ${user.subscription_type} subscription. What specific issue are you experiencing?`
            });

            console.log(`   💬 Added admin response (ID: ${adminResponse.id})`);
        }

        console.log('\n🎉 Test conversations created successfully!');
        
        // Show summary
        const totalConversations = await Conversation.count();
        const totalMessages = await Message.count();
        
        console.log(`\n📊 Summary:`);
        console.log(`   - Total conversations: ${totalConversations}`);
        console.log(`   - Total messages: ${totalMessages}`);
        
    } catch (error) {
        console.error('❌ Error creating test conversations:', error);
    }
}

createSimpleConversations().then(() => {
    console.log('\n🏁 Script completed');
    process.exit(0);
}).catch(error => {
    console.error('💥 Script failed:', error);
    process.exit(1);
});
