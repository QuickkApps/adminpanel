const request = require('supertest');
const { app, server } = require('../server');
const { models, sequelize } = require('../database');
const { ChatConversation, ChatMessage, User, Admin } = models;

describe('Chat System Integration Tests', () => {
  let testUser;
  let testAdmin;
  let adminToken;
  let testConversation;

  beforeAll(async () => {
    // Initialize test database
    await sequelize.sync({ force: true });
    
    // Create test user
    testUser = await User.create({
      username: 'testuser',
      server_url: 'http://test.com',
      subscription_type: 'premium',
      subscription_status: 'active',
      is_active: true
    });

    // Create test admin
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash('testpass', 10);
    testAdmin = await Admin.create({
      username: 'testadmin',
      password: hashedPassword,
      role: 'admin',
      is_active: true
    });

    // Get admin token
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        username: 'testadmin',
        password: 'testpass'
      });
    
    adminToken = loginResponse.body.token;
  });

  afterAll(async () => {
    await sequelize.close();
    server.close();
  });

  beforeEach(async () => {
    // Clean up conversations and messages before each test
    await ChatMessage.destroy({ where: {} });
    await ChatConversation.destroy({ where: {} });
  });

  describe('Conversation Creation', () => {
    test('should create a new conversation with valid data', async () => {
      const response = await request(app)
        .post('/api/chat/conversations')
        .send({
          username: 'testuser',
          subject: 'Test Support Request',
          priority: 'medium',
          message: 'Hello, I need help with the app.'
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.conversation).toBeDefined();
      expect(response.body.conversation.subject).toBe('Test Support Request');
      expect(response.body.message).toBeDefined();
    });

    test('should reject conversation creation with invalid username', async () => {
      const response = await request(app)
        .post('/api/chat/conversations')
        .send({
          username: 'nonexistentuser',
          message: 'Hello, I need help.'
        });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('User not found');
    });

    test('should reject conversation creation with empty message', async () => {
      const response = await request(app)
        .post('/api/chat/conversations')
        .send({
          username: 'testuser',
          message: ''
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid message');
    });

    test('should reject conversation creation with spam content', async () => {
      const response = await request(app)
        .post('/api/chat/conversations')
        .send({
          username: 'testuser',
          message: 'BUY NOW! FREE MONEY! CLICK HERE! URGENT!'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Message rejected');
    });

    test('should sanitize HTML in message content', async () => {
      const response = await request(app)
        .post('/api/chat/conversations')
        .send({
          username: 'testuser',
          message: 'Hello <script>alert("xss")</script> world!'
        });

      expect(response.status).toBe(201);
      
      // Check that the message was sanitized
      const conversation = await ChatConversation.findByPk(response.body.conversation.id, {
        include: [{ model: ChatMessage, as: 'messages' }]
      });
      
      expect(conversation.messages[0].message).not.toContain('<script>');
    });
  });

  describe('Message Sending', () => {
    beforeEach(async () => {
      // Create a test conversation
      testConversation = await ChatConversation.create({
        user_id: testUser.id,
        subject: 'Test Conversation',
        priority: 'medium',
        last_message_at: new Date(),
        last_message_by: 'user',
        admin_unread_count: 1
      });
    });

    test('should send a user message successfully', async () => {
      const response = await request(app)
        .post(`/api/chat/conversations/${testConversation.id}/messages`)
        .send({
          username: 'testuser',
          message: 'This is a test message.'
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.message.message).toBe('This is a test message.');
      expect(response.body.message.senderType).toBe('user');
    });

    test('should send an admin message successfully', async () => {
      const response = await request(app)
        .post(`/api/chat/admin/conversations/${testConversation.id}/messages`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          message: 'Hello, how can I help you?'
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.message.message).toBe('Hello, how can I help you?');
      expect(response.body.message.senderType).toBe('admin');
    });

    test('should reject message from unauthorized user', async () => {
      const response = await request(app)
        .post(`/api/chat/conversations/${testConversation.id}/messages`)
        .send({
          username: 'unauthorizeduser',
          message: 'This should fail.'
        });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('User not found');
    });

    test('should reject admin message without authentication', async () => {
      const response = await request(app)
        .post(`/api/chat/admin/conversations/${testConversation.id}/messages`)
        .send({
          message: 'This should fail.'
        });

      expect(response.status).toBe(401);
    });

    test('should reject message that is too long', async () => {
      const longMessage = 'a'.repeat(5001);
      
      const response = await request(app)
        .post(`/api/chat/conversations/${testConversation.id}/messages`)
        .send({
          username: 'testuser',
          message: longMessage
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid message');
    });
  });

  describe('Conversation Retrieval', () => {
    beforeEach(async () => {
      // Create test conversations with messages
      testConversation = await ChatConversation.create({
        user_id: testUser.id,
        subject: 'Test Conversation',
        priority: 'medium',
        last_message_at: new Date(),
        last_message_by: 'user',
        admin_unread_count: 1
      });

      await ChatMessage.create({
        conversation_id: testConversation.id,
        sender_type: 'user',
        sender_id: testUser.id,
        message: 'Hello, I need help!'
      });
    });

    test('should get user conversations', async () => {
      const response = await request(app)
        .get('/api/chat/conversations')
        .query({ username: 'testuser' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.conversations).toHaveLength(1);
      expect(response.body.conversations[0].subject).toBe('Test Conversation');
    });

    test('should get admin conversations', async () => {
      const response = await request(app)
        .get('/api/chat/admin/conversations')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.conversations).toHaveLength(1);
    });

    test('should get conversation messages', async () => {
      const response = await request(app)
        .get(`/api/chat/conversations/${testConversation.id}/messages`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.messages).toHaveLength(1);
      expect(response.body.messages[0].message).toBe('Hello, I need help!');
    });
  });

  describe('Rate Limiting', () => {
    beforeEach(async () => {
      testConversation = await ChatConversation.create({
        user_id: testUser.id,
        subject: 'Rate Limit Test',
        priority: 'medium',
        last_message_at: new Date(),
        last_message_by: 'user',
        admin_unread_count: 1
      });
    });

    test('should enforce message rate limiting', async () => {
      // Send multiple messages quickly
      const promises = [];
      for (let i = 0; i < 35; i++) {
        promises.push(
          request(app)
            .post(`/api/chat/conversations/${testConversation.id}/messages`)
            .send({
              username: 'testuser',
              message: `Message ${i}`
            })
        );
      }

      const responses = await Promise.all(promises);
      
      // Some requests should be rate limited
      const rateLimitedResponses = responses.filter(res => res.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });

  describe('Message Status Updates', () => {
    beforeEach(async () => {
      testConversation = await ChatConversation.create({
        user_id: testUser.id,
        subject: 'Status Test',
        priority: 'medium',
        last_message_at: new Date(),
        last_message_by: 'user',
        admin_unread_count: 1
      });

      await ChatMessage.create({
        conversation_id: testConversation.id,
        sender_type: 'admin',
        sender_id: testAdmin.id,
        message: 'Admin message to be marked as read'
      });
    });

    test('should mark messages as read', async () => {
      const response = await request(app)
        .patch(`/api/chat/conversations/${testConversation.id}/messages/read`)
        .send({
          readerType: 'user',
          readerId: testUser.id
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.markedAsRead).toBe(1);
    });
  });

  describe('Conversation Status Management', () => {
    beforeEach(async () => {
      testConversation = await ChatConversation.create({
        user_id: testUser.id,
        subject: 'Status Management Test',
        priority: 'medium',
        status: 'open',
        last_message_at: new Date(),
        last_message_by: 'user'
      });
    });

    test('should update conversation status', async () => {
      const response = await request(app)
        .patch(`/api/chat/admin/conversations/${testConversation.id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: 'closed'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.conversation.status).toBe('closed');
    });

    test('should reject invalid status', async () => {
      const response = await request(app)
        .patch(`/api/chat/admin/conversations/${testConversation.id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: 'invalid_status'
        });

      expect(response.status).toBe(400);
    });
  });
});
