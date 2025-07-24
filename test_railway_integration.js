const axios = require('axios');
const io = require('socket.io-client');

// Railway admin panel URL
const ADMIN_PANEL_URL = 'https://web-production-6358.up.railway.app';

console.log('🚀 Testing Railway Admin Panel Integration');
console.log(`📡 Admin Panel URL: ${ADMIN_PANEL_URL}`);
console.log('=' .repeat(60));

async function testHealthCheck() {
  console.log('\n1. Testing Health Check...');
  try {
    const response = await axios.get(`${ADMIN_PANEL_URL}/api/app/ping`, {
      timeout: 10000
    });
    
    if (response.status === 200) {
      console.log('✅ Health check passed');
      console.log(`   Response: ${JSON.stringify(response.data)}`);
      return true;
    } else {
      console.log(`❌ Health check failed with status: ${response.status}`);
      return false;
    }
  } catch (error) {
    console.log(`❌ Health check failed: ${error.message}`);
    return false;
  }
}

async function testStatusUpdate() {
  console.log('\n2. Testing Status Update...');
  try {
    const statusData = {
      status: 'running',
      version: '1.0.0',
      configVersion: new Date().toISOString(),
      activeUsers: 1,
      errors: []
    };

    const response = await axios.post(`${ADMIN_PANEL_URL}/api/app/status`, statusData, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000
    });
    
    if (response.status === 200) {
      console.log('✅ Status update successful');
      console.log(`   Response: ${JSON.stringify(response.data)}`);
      return true;
    } else {
      console.log(`❌ Status update failed with status: ${response.status}`);
      return false;
    }
  } catch (error) {
    console.log(`❌ Status update failed: ${error.message}`);
    return false;
  }
}

async function testErrorReporting() {
  console.log('\n3. Testing Error Reporting...');
  try {
    const errorData = {
      error: 'Test error from integration test',
      stack: 'Test stack trace',
      context: {
        testType: 'integration',
        timestamp: new Date().toISOString()
      }
    };

    const response = await axios.post(`${ADMIN_PANEL_URL}/api/app/error`, errorData, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000
    });
    
    if (response.status === 200) {
      console.log('✅ Error reporting successful');
      console.log(`   Response: ${JSON.stringify(response.data)}`);
      return true;
    } else {
      console.log(`❌ Error reporting failed with status: ${response.status}`);
      return false;
    }
  } catch (error) {
    console.log(`❌ Error reporting failed: ${error.message}`);
    return false;
  }
}

async function testConfigFetch() {
  console.log('\n4. Testing Configuration Fetch...');
  try {
    const response = await axios.get(`${ADMIN_PANEL_URL}/api/config/app`, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000
    });
    
    if (response.status === 200) {
      console.log('✅ Configuration fetch successful');
      console.log(`   Config: ${JSON.stringify(response.data, null, 2)}`);
      return true;
    } else {
      console.log(`❌ Configuration fetch failed with status: ${response.status}`);
      return false;
    }
  } catch (error) {
    console.log(`❌ Configuration fetch failed: ${error.message}`);
    return false;
  }
}

function testWebSocketConnection() {
  return new Promise((resolve) => {
    console.log('\n5. Testing WebSocket Connection...');
    
    const socket = io(ADMIN_PANEL_URL, {
      transports: ['websocket'],
      timeout: 10000,
      reconnection: false
    });

    let resolved = false;

    const resolveOnce = (success, message) => {
      if (!resolved) {
        resolved = true;
        socket.disconnect();
        console.log(success ? '✅' : '❌', message);
        resolve(success);
      }
    };

    socket.on('connect', () => {
      console.log('🔌 WebSocket connected successfully');
      
      // Test subscribing to config updates
      socket.emit('subscribe-config-updates');
      
      // Test user connection registration
      socket.emit('user-connect', {
        username: 'test-user',
        serverUrl: 'test-server',
        sessionToken: Date.now().toString(),
        deviceInfo: {
          platform: 'Test',
          appName: 'Integration Test',
          deviceModel: 'Test Device'
        },
        appVersion: '1.0.0',
        isManualLogin: true
      });

      setTimeout(() => {
        resolveOnce(true, 'WebSocket connection and messaging successful');
      }, 2000);
    });

    socket.on('connect_error', (error) => {
      resolveOnce(false, `WebSocket connection failed: ${error.message}`);
    });

    socket.on('disconnect', (reason) => {
      if (!resolved) {
        resolveOnce(false, `WebSocket disconnected: ${reason}`);
      }
    });

    // Timeout after 15 seconds
    setTimeout(() => {
      resolveOnce(false, 'WebSocket connection timeout');
    }, 15000);
  });
}

async function runIntegrationTests() {
  console.log('🧪 Starting Railway Integration Tests...\n');
  
  const tests = [
    { name: 'Health Check', test: testHealthCheck },
    { name: 'Status Update', test: testStatusUpdate },
    { name: 'Error Reporting', test: testErrorReporting },
    { name: 'Configuration Fetch', test: testConfigFetch },
    { name: 'WebSocket Connection', test: testWebSocketConnection }
  ];

  let passed = 0;
  let failed = 0;

  for (const { name, test } of tests) {
    try {
      const result = await test();
      if (result) {
        passed++;
      } else {
        failed++;
      }
    } catch (error) {
      console.log(`❌ ${name} failed with exception: ${error.message}`);
      failed++;
    }
  }

  console.log('\n' + '=' .repeat(60));
  console.log('📊 Integration Test Results:');
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);
  
  if (failed === 0) {
    console.log('\n🎉 All tests passed! The main app should connect successfully to the Railway admin panel.');
  } else {
    console.log('\n⚠️ Some tests failed. Please check the admin panel configuration and network connectivity.');
  }
}

// Run the tests
runIntegrationTests().catch(console.error);
