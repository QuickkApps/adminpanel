const io = require('socket.io-client');

// Test script to simulate user logout
async function testUserLogout() {
    console.log('🧪 Testing user logout functionality...');
    
    // Connect to admin panel
    const socket = io('http://localhost:3001');
    
    socket.on('connect', () => {
        console.log('✅ Connected to admin panel');
        
        // First, simulate user login
        console.log('📱 Simulating manual user login...');
        socket.emit('user-connect', {
            username: 'TestUser123',
            sessionToken: 'test-session-token-' + Date.now(),
            serverUrl: 'http://test.example.com:8080',
            deviceInfo: {
                platform: 'android',
                model: 'Test Device',
                version: '1.0.0'
            },
            appVersion: '1.0.0',
            isManualLogin: true  // This is the key flag for manual login
        });
    });
    
    socket.on('user-connected', (response) => {
        if (response.success) {
            console.log('✅ User login successful:', response);
            
            // Wait 2 seconds, then simulate logout
            setTimeout(() => {
                console.log('🚪 Simulating user logout...');
                socket.emit('user-logout', {});
            }, 2000);
        } else {
            console.log('❌ User login failed:', response);
        }
    });
    
    socket.on('user-logout-success', (response) => {
        console.log('✅ User logout successful:', response);
        console.log('🎉 Test completed successfully!');
        socket.disconnect();
        process.exit(0);
    });
    
    socket.on('user-logout-error', (response) => {
        console.log('❌ User logout failed:', response);
        socket.disconnect();
        process.exit(1);
    });
    
    socket.on('disconnect', () => {
        console.log('🔌 Disconnected from admin panel');
    });
    
    socket.on('connect_error', (error) => {
        console.log('❌ Connection error:', error.message);
        process.exit(1);
    });
}

// Run the test
testUserLogout().catch(console.error);
