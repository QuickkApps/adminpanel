const axios = require('axios');

// Railway admin panel URL
const ADMIN_PANEL_URL = 'https://web-production-6358.up.railway.app';
const TEST_USERNAME = 'XT30560';

console.log('🧪 Testing Chat API Integration');
console.log(`📡 Admin Panel URL: ${ADMIN_PANEL_URL}`);
console.log(`👤 Test Username: ${TEST_USERNAME}`);
console.log('=' .repeat(60));

async function testGetConversations() {
  console.log('\n1. Testing Get Conversations...');
  try {
    const response = await axios.get(`${ADMIN_PANEL_URL}/api/chat/conversations?username=${TEST_USERNAME}`, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000
    });
    
    if (response.status === 200) {
      console.log('✅ Get conversations successful');
      console.log(`   Response: ${JSON.stringify(response.data, null, 2)}`);
      return response.data.conversations || [];
    } else {
      console.log(`❌ Get conversations failed with status: ${response.status}`);
      return [];
    }
  } catch (error) {
    console.log(`❌ Get conversations failed: ${error.message}`);
    if (error.response) {
      console.log(`   Status: ${error.response.status}`);
      console.log(`   Data: ${JSON.stringify(error.response.data)}`);
    }
    return [];
  }
}

async function testCreateConversation() {
  console.log('\n2. Testing Create Conversation...');
  try {
    const conversationData = {
      username: TEST_USERNAME,
      subject: 'Test Support Request',
      priority: 'medium',
      message: 'Hello, I need help with my IPTV streaming. This is a test message from the integration test.'
    };

    const response = await axios.post(`${ADMIN_PANEL_URL}/api/chat/conversations`, conversationData, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000
    });
    
    if (response.status === 201) {
      console.log('✅ Create conversation successful');
      console.log(`   Response: ${JSON.stringify(response.data, null, 2)}`);
      return response.data.conversation;
    } else {
      console.log(`❌ Create conversation failed with status: ${response.status}`);
      return null;
    }
  } catch (error) {
    console.log(`❌ Create conversation failed: ${error.message}`);
    if (error.response) {
      console.log(`   Status: ${error.response.status}`);
      console.log(`   Data: ${JSON.stringify(error.response.data)}`);
    }
    return null;
  }
}

async function testGetMessages(conversationId) {
  console.log(`\n3. Testing Get Messages for conversation ${conversationId}...`);
  try {
    const response = await axios.get(`${ADMIN_PANEL_URL}/api/chat/conversations/${conversationId}/messages`, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000
    });
    
    if (response.status === 200) {
      console.log('✅ Get messages successful');
      console.log(`   Response: ${JSON.stringify(response.data, null, 2)}`);
      return response.data.messages || [];
    } else {
      console.log(`❌ Get messages failed with status: ${response.status}`);
      return [];
    }
  } catch (error) {
    console.log(`❌ Get messages failed: ${error.message}`);
    if (error.response) {
      console.log(`   Status: ${error.response.status}`);
      console.log(`   Data: ${JSON.stringify(error.response.data)}`);
    }
    return [];
  }
}

async function testSendMessage(conversationId) {
  console.log(`\n4. Testing Send Message to conversation ${conversationId}...`);
  try {
    const messageData = {
      username: TEST_USERNAME,
      message: 'This is a test message sent via REST API. The chat integration is working!'
    };

    const response = await axios.post(`${ADMIN_PANEL_URL}/api/chat/conversations/${conversationId}/messages`, messageData, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000
    });
    
    if (response.status === 201) {
      console.log('✅ Send message successful');
      console.log(`   Response: ${JSON.stringify(response.data, null, 2)}`);
      return response.data.message;
    } else {
      console.log(`❌ Send message failed with status: ${response.status}`);
      return null;
    }
  } catch (error) {
    console.log(`❌ Send message failed: ${error.message}`);
    if (error.response) {
      console.log(`   Status: ${error.response.status}`);
      console.log(`   Data: ${JSON.stringify(error.response.data)}`);
    }
    return null;
  }
}

async function runChatTests() {
  console.log('🚀 Starting Chat API Tests...\n');
  
  let testsPassed = 0;
  let testsFailed = 0;

  // Test 1: Get conversations
  const conversations = await testGetConversations();
  if (conversations !== null) {
    testsPassed++;
  } else {
    testsFailed++;
  }

  // Test 2: Create conversation
  const newConversation = await testCreateConversation();
  if (newConversation) {
    testsPassed++;
    
    // Test 3: Get messages for the new conversation
    const messages = await testGetMessages(newConversation.id);
    if (messages !== null) {
      testsPassed++;
    } else {
      testsFailed++;
    }

    // Test 4: Send a message
    const sentMessage = await testSendMessage(newConversation.id);
    if (sentMessage) {
      testsPassed++;
    } else {
      testsFailed++;
    }
  } else {
    testsFailed += 3; // Failed to create conversation, so can't test messages
  }

  console.log('\n' + '=' .repeat(60));
  console.log('📊 Chat API Test Results:');
  console.log(`✅ Passed: ${testsPassed}`);
  console.log(`❌ Failed: ${testsFailed}`);
  console.log(`📈 Success Rate: ${((testsPassed / (testsPassed + testsFailed)) * 100).toFixed(1)}%`);
  
  if (testsFailed === 0) {
    console.log('\n🎉 All chat API tests passed! The chat system should work properly.');
  } else {
    console.log('\n⚠️ Some chat API tests failed. Please check the admin panel configuration.');
  }
}

// Run the tests
runChatTests().catch(console.error);
