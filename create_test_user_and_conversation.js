/**
 * Script to create a test user and conversation for XT30560
 */

const { Sequelize } = require('sequelize');
const path = require('path');

// Initialize database connection
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: path.join(__dirname, 'database', 'admin_panel.db'),
  logging: false
});

// Define models
const User = sequelize.define('User', {
  id: {
    type: Sequelize.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  username: {
    type: Sequelize.STRING,
    unique: true,
    allowNull: false
  },
  email: {
    type: Sequelize.STRING,
    unique: true,
    allowNull: false
  },
  isActive: {
    type: Sequelize.BOOLEAN,
    defaultValue: true
  }
}, {
  tableName: 'Users'
});

const ChatConversation = sequelize.define('ChatConversation', {
  id: {
    type: Sequelize.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  userId: {
    type: Sequelize.INTEGER,
    allowNull: false
  },
  subject: {
    type: Sequelize.STRING,
    allowNull: false
  },
  status: {
    type: Sequelize.ENUM('open', 'closed', 'pending'),
    defaultValue: 'open'
  },
  priority: {
    type: Sequelize.ENUM('low', 'medium', 'high'),
    defaultValue: 'medium'
  },
  lastMessageAt: {
    type: Sequelize.DATE,
    defaultValue: Sequelize.NOW
  }
}, {
  tableName: 'ChatConversations'
});

const ChatMessage = sequelize.define('ChatMessage', {
  id: {
    type: Sequelize.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  conversationId: {
    type: Sequelize.INTEGER,
    allowNull: false
  },
  senderId: {
    type: Sequelize.INTEGER,
    allowNull: false
  },
  senderType: {
    type: Sequelize.ENUM('user', 'admin'),
    allowNull: false
  },
  message: {
    type: Sequelize.TEXT,
    allowNull: false
  },
  isRead: {
    type: Sequelize.BOOLEAN,
    defaultValue: false
  }
}, {
  tableName: 'ChatMessages'
});

async function createTestUserAndConversation() {
  try {
    console.log('🔄 Connecting to database...');
    await sequelize.authenticate();
    console.log('✅ Database connected successfully');

    // Create or find the user XT30560
    console.log('👤 Creating/finding user XT30560...');
    const [user, userCreated] = await User.findOrCreate({
      where: { username: 'XT30560' },
      defaults: {
        username: 'XT30560',
        email: 'xt30560@test.com',
        isActive: true
      }
    });

    if (userCreated) {
      console.log('✅ User XT30560 created successfully');
    } else {
      console.log('✅ User XT30560 already exists');
    }

    // Create a test conversation
    console.log('💬 Creating test conversation...');
    const [conversation, conversationCreated] = await ChatConversation.findOrCreate({
      where: { 
        userId: user.id,
        subject: 'Welcome to Support Chat'
      },
      defaults: {
        userId: user.id,
        subject: 'Welcome to Support Chat',
        status: 'open',
        priority: 'medium',
        lastMessageAt: new Date()
      }
    });

    if (conversationCreated) {
      console.log('✅ Test conversation created successfully');
    } else {
      console.log('✅ Test conversation already exists');
    }

    // Create a welcome message
    console.log('📝 Creating welcome message...');
    const [message, messageCreated] = await ChatMessage.findOrCreate({
      where: {
        conversationId: conversation.id,
        message: 'Welcome to our support chat! How can we help you today?'
      },
      defaults: {
        conversationId: conversation.id,
        senderId: 1, // Admin ID
        senderType: 'admin',
        message: 'Welcome to our support chat! How can we help you today?',
        isRead: false
      }
    });

    if (messageCreated) {
      console.log('✅ Welcome message created successfully');
    } else {
      console.log('✅ Welcome message already exists');
    }

    console.log('\n🎉 Test data created successfully!');
    console.log(`👤 User: ${user.username} (ID: ${user.id})`);
    console.log(`💬 Conversation: "${conversation.subject}" (ID: ${conversation.id})`);
    console.log(`📝 Message: "${message.message}"`);
    console.log('\n🧪 Now test the Flutter app chat functionality!');

  } catch (error) {
    console.error('❌ Error creating test data:', error);
  } finally {
    await sequelize.close();
  }
}

createTestUserAndConversation();
