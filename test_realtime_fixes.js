#!/usr/bin/env node

/**
 * Test script to validate real-time messaging and online status fixes
 */

const io = require('socket.io-client');
const axios = require('axios');

const ADMIN_PANEL_URL = 'http://localhost:3001';
const TEST_USERNAME = 'XT30560';
const TEST_SERVER_URL = 'http://nuconteaza.mmager.ro:8080';

let adminSocket = null;
let userSocket = null;
let testResults = {
  userConnection: false,
  onlineStatusDetection: false,
  realTimeMessaging: false,
  heartbeatResponse: false
};

async function runTests() {
  console.log('🧪 Starting Real-time Messaging and Online Status Tests...\n');

  try {
    // Test 1: User Connection and Online Status
    console.log('📋 Test 1: User Connection and Online Status Detection');
    await testUserConnection();
    
    // Test 2: Real-time Messaging
    console.log('\n📋 Test 2: Real-time Messaging');
    await testRealTimeMessaging();
    
    // Test 3: Heartbeat and Activity Updates
    console.log('\n📋 Test 3: Heartbeat and Activity Updates');
    await testHeartbeatResponse();
    
    // Test 4: Online Status Persistence
    console.log('\n📋 Test 4: Online Status Persistence');
    await testOnlineStatusPersistence();

  } catch (error) {
    console.error('❌ Test execution failed:', error);
  } finally {
    // Cleanup
    if (userSocket) userSocket.disconnect();
    if (adminSocket) adminSocket.disconnect();
    
    // Print results
    printTestResults();
  }
}

async function testUserConnection() {
  return new Promise((resolve, reject) => {
    console.log('  🔌 Connecting user socket...');
    
    userSocket = io(ADMIN_PANEL_URL, {
      transports: ['websocket'],
      timeout: 5000
    });

    userSocket.on('connect', () => {
      console.log('  ✅ User socket connected');
      
      // Simulate user connection
      userSocket.emit('user-connect', {
        username: TEST_USERNAME,
        serverUrl: TEST_SERVER_URL,
        sessionToken: Date.now().toString(),
        deviceInfo: {
          platform: 'Test',
          appName: 'Anume Test',
          deviceModel: 'Test Device'
        },
        appVersion: '1.0.0-test',
        isManualLogin: true
      });
    });

    userSocket.on('user-connected', (data) => {
      if (data.success) {
        console.log('  ✅ User connection acknowledged');
        testResults.userConnection = true;
        
        // Test online status detection
        setTimeout(async () => {
          try {
            const response = await axios.get(`${ADMIN_PANEL_URL}/api/users/online`);
            const onlineUsers = response.data.data || [];
            const isUserOnline = onlineUsers.some(user => user.username === TEST_USERNAME);
            
            if (isUserOnline) {
              console.log('  ✅ User detected as online in admin panel');
              testResults.onlineStatusDetection = true;
            } else {
              console.log('  ❌ User not detected as online in admin panel');
            }
            resolve();
          } catch (error) {
            console.log('  ❌ Failed to check online status:', error.message);
            resolve();
          }
        }, 2000);
      } else {
        console.log('  ❌ User connection failed:', data.message);
        resolve();
      }
    });

    userSocket.on('connect_error', (error) => {
      console.log('  ❌ User socket connection failed:', error.message);
      resolve();
    });

    setTimeout(() => {
      console.log('  ⏰ User connection test timeout');
      resolve();
    }, 10000);
  });
}

async function testRealTimeMessaging() {
  return new Promise(async (resolve) => {
    if (!testResults.userConnection) {
      console.log('  ⏭️ Skipping messaging test - user not connected');
      resolve();
      return;
    }

    try {
      console.log('  📝 Creating test conversation...');
      
      // Create a conversation via REST API
      const conversationResponse = await axios.post(`${ADMIN_PANEL_URL}/api/chat/conversations`, {
        username: TEST_USERNAME,
        subject: 'Test Real-time Messaging',
        priority: 'medium',
        message: 'This is a test message for real-time functionality'
      });

      if (conversationResponse.status === 201) {
        const conversation = conversationResponse.data.conversation;
        console.log(`  ✅ Test conversation created: ${conversation.id}`);

        // Set up message listener
        userSocket.on('new-chat-message', (messageData) => {
          console.log('  📨 Received real-time message:', messageData.message);
          testResults.realTimeMessaging = true;
          resolve();
        });

        // Join conversation room
        userSocket.emit('join-chat', {
          conversationId: conversation.id,
          userType: 'user',
          userId: 1
        });

        // Send a message via WebSocket
        setTimeout(() => {
          console.log('  📤 Sending test message via WebSocket...');
          userSocket.emit('send-chat-message', {
            conversationId: conversation.id,
            message: 'Test real-time message via WebSocket',
            senderType: 'user',
            senderId: 1
          });
        }, 1000);

        // Timeout if no response
        setTimeout(() => {
          if (!testResults.realTimeMessaging) {
            console.log('  ❌ Real-time messaging test timeout');
          }
          resolve();
        }, 5000);

      } else {
        console.log('  ❌ Failed to create test conversation');
        resolve();
      }
    } catch (error) {
      console.log('  ❌ Messaging test failed:', error.message);
      resolve();
    }
  });
}

async function testHeartbeatResponse() {
  return new Promise((resolve) => {
    if (!testResults.userConnection) {
      console.log('  ⏭️ Skipping heartbeat test - user not connected');
      resolve();
      return;
    }

    console.log('  💓 Testing heartbeat response...');

    userSocket.on('ping', () => {
      console.log('  🏓 Received ping from server');
      userSocket.emit('pong');
      console.log('  🏓 Sent pong response');
      testResults.heartbeatResponse = true;
      resolve();
    });

    // Manually trigger activity update
    userSocket.emit('user-activity', {
      timestamp: new Date().toISOString(),
      status: 'active'
    });

    setTimeout(() => {
      if (!testResults.heartbeatResponse) {
        console.log('  ❌ Heartbeat test timeout');
      }
      resolve();
    }, 35000); // Wait for ping cycle
  });
}

async function testOnlineStatusPersistence() {
  console.log('  ⏳ Testing online status persistence (waiting 30 seconds)...');
  
  // Wait and check if user is still online
  await new Promise(resolve => setTimeout(resolve, 30000));
  
  try {
    const response = await axios.get(`${ADMIN_PANEL_URL}/api/users/online`);
    const onlineUsers = response.data.data || [];
    const isUserStillOnline = onlineUsers.some(user => user.username === TEST_USERNAME);
    
    if (isUserStillOnline) {
      console.log('  ✅ User status persisted correctly');
    } else {
      console.log('  ❌ User status not persisted');
    }
  } catch (error) {
    console.log('  ❌ Failed to check status persistence:', error.message);
  }
}

function printTestResults() {
  console.log('\n📊 Test Results Summary:');
  console.log('========================');
  console.log(`User Connection: ${testResults.userConnection ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Online Status Detection: ${testResults.onlineStatusDetection ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Real-time Messaging: ${testResults.realTimeMessaging ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Heartbeat Response: ${testResults.heartbeatResponse ? '✅ PASS' : '❌ FAIL'}`);
  
  const passedTests = Object.values(testResults).filter(result => result).length;
  const totalTests = Object.keys(testResults).length;
  
  console.log(`\nOverall: ${passedTests}/${totalTests} tests passed`);
  
  if (passedTests === totalTests) {
    console.log('🎉 All tests passed! Real-time functionality is working correctly.');
  } else {
    console.log('⚠️ Some tests failed. Please check the implementation.');
  }
}

// Run tests if this script is executed directly
if (require.main === module) {
  runTests();
}

module.exports = { runTests };
