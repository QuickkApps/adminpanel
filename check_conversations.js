const { models } = require('./database');

async function checkConversations() {
  try {
    console.log('🔍 Checking conversations in database...');
    
    // Get all conversations
    const conversations = await models.ChatConversation.findAll({
      include: [
        {
          model: models.User,
          as: 'user',
          attributes: ['id', 'username']
        },
        {
          model: models.Admin,
          as: 'admin',
          attributes: ['id', 'username'],
          required: false
        }
      ],
      order: [['created_at', 'DESC']]
    });

    console.log(`📊 Found ${conversations.length} conversations:`);
    
    conversations.forEach((conv, index) => {
      console.log(`\n${index + 1}. Conversation ID: ${conv.id}`);
      console.log(`   Subject: ${conv.subject}`);
      console.log(`   Status: ${conv.status}`);
      console.log(`   Priority: ${conv.priority}`);
      console.log(`   User: ${conv.user ? conv.user.username : 'Unknown'} (ID: ${conv.user_id})`);
      console.log(`   Admin: ${conv.admin ? conv.admin.username : 'Not assigned'}`);
      console.log(`   Created: ${conv.created_at}`);
      console.log(`   Last Message: ${conv.last_message_at}`);
      console.log(`   Last Message By: ${conv.last_message_by}`);
    });

    // Get all messages
    const messages = await models.ChatMessage.findAll({
      include: [
        {
          model: models.ChatConversation,
          as: 'conversation',
          attributes: ['id', 'subject']
        }
      ],
      order: [['created_at', 'DESC']]
    });

    console.log(`\n💬 Found ${messages.length} messages:`);
    
    messages.forEach((msg, index) => {
      console.log(`\n${index + 1}. Message ID: ${msg.id}`);
      console.log(`   Conversation: ${msg.conversation.subject} (ID: ${msg.conversation_id})`);
      console.log(`   Content: ${msg.content}`);
      console.log(`   Sender Type: ${msg.sender_type}`);
      console.log(`   Sender ID: ${msg.sender_id}`);
      console.log(`   Created: ${msg.created_at}`);
    });

    // Get all users
    const users = await models.User.findAll({
      attributes: ['id', 'username', 'created_at']
    });

    console.log(`\n👥 Found ${users.length} users:`);
    users.forEach((user, index) => {
      console.log(`${index + 1}. ${user.username} (ID: ${user.id}) - Created: ${user.created_at}`);
    });

  } catch (error) {
    console.error('❌ Error checking conversations:', error);
  } finally {
    process.exit(0);
  }
}

checkConversations();
