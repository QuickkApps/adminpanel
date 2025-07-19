/**
 * Test script to demonstrate admin panel integration with the main Anume app
 * This script simulates how the main app would communicate with the admin panel
 */

const axios = require('axios');

const ADMIN_PANEL_URL = 'http://localhost:3001';

async function testAdminPanelIntegration() {
    console.log('🧪 Testing Admin Panel Integration...\n');

    try {
        // Test 1: Health check
        console.log('1. Testing health check...');
        const healthResponse = await axios.get(`${ADMIN_PANEL_URL}/api/app/ping`);
        console.log('✅ Health check:', healthResponse.data.message);

        // Test 2: Send app status update
        console.log('\n2. Sending app status update...');
        const statusResponse = await axios.post(`${ADMIN_PANEL_URL}/api/app/status`, {
            status: 'running',
            version: '1.0.0',
            configVersion: '2024-01-01',
            activeUsers: 5,
            errors: []
        });
        console.log('✅ Status update sent:', statusResponse.data.message);

        // Test 3: Send error report
        console.log('\n3. Sending error report...');
        const errorResponse = await axios.post(`${ADMIN_PANEL_URL}/api/app/error`, {
            error: 'Test error from main app',
            stack: 'Error stack trace here...',
            context: {
                component: 'XtreamService',
                action: 'authenticate',
                timestamp: new Date().toISOString()
            }
        });
        console.log('✅ Error report sent:', errorResponse.data.message);

        // Test 4: Get current app status
        console.log('\n4. Getting current app status...');
        const currentStatusResponse = await axios.get(`${ADMIN_PANEL_URL}/api/app/status`);
        console.log('✅ Current status retrieved:', JSON.stringify(currentStatusResponse.data, null, 2));

        console.log('\n🎉 All integration tests passed!');
        console.log('\n📋 Integration Summary:');
        console.log('- Health check endpoint: ✅ Working');
        console.log('- Status updates: ✅ Working');
        console.log('- Error reporting: ✅ Working');
        console.log('- Status retrieval: ✅ Working');

        console.log('\n🔗 To integrate with your main Anume app:');
        console.log('1. Add HTTP requests to these endpoints in your Flutter app');
        console.log('2. Send status updates periodically');
        console.log('3. Report errors when they occur');
        console.log('4. Listen for configuration changes via WebSocket');

    } catch (error) {
        console.error('❌ Test failed:', error.response?.data || error.message);
    }
}

// Example Flutter/Dart integration code
function showFlutterIntegrationExample() {
    console.log('\n📱 Example Flutter Integration Code:');
    console.log(`
// Add this to your main Anume app to integrate with admin panel

import 'package:http/http.dart' as http;
import 'dart:convert';

class AdminPanelService {
  static const String adminPanelUrl = 'http://localhost:3001';
  
  // Send status update to admin panel
  static Future<void> sendStatusUpdate({
    required String status,
    String? version,
    String? configVersion,
    int activeUsers = 0,
    List<String> errors = const [],
  }) async {
    try {
      final response = await http.post(
        Uri.parse('\$adminPanelUrl/api/app/status'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'status': status,
          'version': version,
          'configVersion': configVersion,
          'activeUsers': activeUsers,
          'errors': errors,
        }),
      );
      
      if (response.statusCode == 200) {
        debugPrint('✅ Status sent to admin panel');
      }
    } catch (e) {
      debugPrint('❌ Failed to send status to admin panel: \$e');
    }
  }
  
  // Send error report to admin panel
  static Future<void> reportError({
    required String error,
    String? stack,
    Map<String, dynamic>? context,
  }) async {
    try {
      final response = await http.post(
        Uri.parse('\$adminPanelUrl/api/app/error'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'error': error,
          'stack': stack,
          'context': context ?? {},
        }),
      );
      
      if (response.statusCode == 200) {
        debugPrint('✅ Error reported to admin panel');
      }
    } catch (e) {
      debugPrint('❌ Failed to report error to admin panel: \$e');
    }
  }
  
  // Check admin panel health
  static Future<bool> checkAdminPanelHealth() async {
    try {
      final response = await http.get(
        Uri.parse('\$adminPanelUrl/api/app/ping'),
      );
      return response.statusCode == 200;
    } catch (e) {
      return false;
    }
  }
}

// Usage in your app:
// AdminPanelService.sendStatusUpdate(status: 'running', activeUsers: 10);
// AdminPanelService.reportError(error: 'Connection failed', context: {'url': apiUrl});
    `);
}

if (require.main === module) {
    testAdminPanelIntegration().then(() => {
        showFlutterIntegrationExample();
        process.exit(0);
    });
}

module.exports = { testAdminPanelIntegration };
