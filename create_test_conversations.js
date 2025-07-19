/**
 * Script to create test conversations to verify filtering
 */

const { User, Conversation, Message } = require('./database/models');

async function createTestConversations() {
    console.log('🧪 Creating test conversations...');

    try {
        // Create test users
        const testUsers = await Promise.all([
            User.findOrCreate({
                where: { username: 'XT30560' },
                defaults: {
                    username: 'XT30560',
                    email: 'xt30560@test.com',
                    isActive: true
                }
            }),
            User.findOrCreate({
                where: { username: 'sda' },
                defaults: {
                    username: 'sda',
                    email: 'sda@test.com',
                    isActive: true
                }
            }),
            User.findOrCreate({
                where: { username: 'legitimate_user' },
                defaults: {
                    username: 'legitimate_user',
                    email: 'user@test.com',
                    isActive: true
                }
            })
        ]);

        console.log('✅ Test users created');

        // Create conversations
        const conversations = await Promise.all([
            Conversation.findOrCreate({
                where: { userId: testUsers[0][0].id },
                defaults: {
                    userId: testUsers[0][0].id,
                    subject: 'Test conversation from XT30560',
                    status: 'open',
                    lastMessageAt: new Date()
                }
            }),
            Conversation.findOrCreate({
                where: { userId: testUsers[1][0].id },
                defaults: {
                    userId: testUsers[1][0].id,
                    subject: 'Test conversation from sda',
                    status: 'open',
                    lastMessageAt: new Date()
                }
            }),
            Conversation.findOrCreate({
                where: { userId: testUsers[2][0].id },
                defaults: {
                    userId: testUsers[2][0].id,
                    subject: 'Legitimate user conversation',
                    status: 'open',
                    lastMessageAt: new Date()
                }
            })
        ]);

        console.log('✅ Test conversations created');

        // Create test messages
        await Promise.all([
            Message.findOrCreate({
                where: { 
                    conversationId: conversations[0][0].id,
                    message: 'This is a test message from XT30560'
                },
                defaults: {
                    conversationId: conversations[0][0].id,
                    senderId: testUsers[0][0].id,
                    senderType: 'user',
                    message: 'This is a test message from XT30560'
                }
            }),
            Message.findOrCreate({
                where: { 
                    conversationId: conversations[1][0].id,
                    message: 'This is a test message from sda'
                },
                defaults: {
                    conversationId: conversations[1][0].id,
                    senderId: testUsers[1][0].id,
                    senderType: 'user',
                    message: 'This is a test message from sda'
                }
            }),
            Message.findOrCreate({
                where: { 
                    conversationId: conversations[2][0].id,
                    message: 'This is a legitimate user message'
                },
                defaults: {
                    conversationId: conversations[2][0].id,
                    senderId: testUsers[2][0].id,
                    senderType: 'user',
                    message: 'This is a legitimate user message'
                }
            })
        ]);

        console.log('✅ Test messages created');
        console.log('\n📊 Test data summary:');
        console.log('   - XT30560 conversation (should be filtered out)');
        console.log('   - sda conversation (should be filtered out)');
        console.log('   - legitimate_user conversation (should be visible)');
        console.log('\n🎯 Now test the admin panel to verify filtering works!');

    } catch (error) {
        console.error('❌ Error creating test conversations:', error);
    }
}

createTestConversations();
