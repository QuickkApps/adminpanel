# Anume App Integration Guide

This guide explains how to integrate the main Anume Flutter app with the Admin Panel for remote configuration management and status reporting.

## Overview

The integration allows the main Anume app to:
- Automatically receive configuration updates from the admin panel
- Report its status and errors to the admin panel
- Respond to remote commands (future feature)

## Integration Steps

### 1. Add HTTP Dependencies

Add the following to your `pubspec.yaml`:

```yaml
dependencies:
  http: ^1.1.0
  shared_preferences: ^2.2.2
```

### 2. Create Admin Panel Service

Create a new file `lib/services/admin_panel_service.dart`:

```dart
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

class AdminPanelService {
  static const String _adminPanelUrl = 'http://localhost:3001';
  static const String _lastStatusKey = 'last_admin_panel_status';
  static const Duration _timeout = Duration(seconds: 10);
  
  static SharedPreferences? _prefs;
  static bool _isEnabled = true;
  
  /// Initialize the service
  static Future<void> initialize() async {
    _prefs ??= await SharedPreferences.getInstance();
    
    // Check if admin panel is available
    _isEnabled = await checkAdminPanelHealth();
    debugPrint('🔗 Admin Panel Service: ${_isEnabled ? "Enabled" : "Disabled"}');
  }
  
  /// Check if admin panel is available
  static Future<bool> checkAdminPanelHealth() async {
    try {
      final response = await http.get(
        Uri.parse('$_adminPanelUrl/api/app/ping'),
        headers: {'Content-Type': 'application/json'},
      ).timeout(_timeout);
      
      return response.statusCode == 200;
    } catch (e) {
      debugPrint('⚠️ Admin panel health check failed: $e');
      return false;
    }
  }
  
  /// Send status update to admin panel
  static Future<void> sendStatusUpdate({
    required String status,
    String? version,
    String? configVersion,
    int activeUsers = 0,
    List<String> errors = const [],
  }) async {
    if (!_isEnabled) return;
    
    try {
      final statusData = {
        'status': status,
        'version': version ?? '1.0.0',
        'configVersion': configVersion ?? DateTime.now().toIso8601String(),
        'activeUsers': activeUsers,
        'errors': errors,
      };
      
      final response = await http.post(
        Uri.parse('$_adminPanelUrl/api/app/status'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode(statusData),
      ).timeout(_timeout);
      
      if (response.statusCode == 200) {
        debugPrint('✅ Status sent to admin panel: $status');
        await _prefs?.setString(_lastStatusKey, jsonEncode(statusData));
      } else {
        debugPrint('❌ Failed to send status: ${response.statusCode}');
      }
    } catch (e) {
      debugPrint('❌ Failed to send status to admin panel: $e');
    }
  }
  
  /// Report error to admin panel
  static Future<void> reportError({
    required String error,
    String? stack,
    Map<String, dynamic>? context,
  }) async {
    if (!_isEnabled) return;
    
    try {
      final errorData = {
        'error': error,
        'stack': stack,
        'context': context ?? {},
      };
      
      final response = await http.post(
        Uri.parse('$_adminPanelUrl/api/app/error'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode(errorData),
      ).timeout(_timeout);
      
      if (response.statusCode == 200) {
        debugPrint('✅ Error reported to admin panel');
      } else {
        debugPrint('❌ Failed to report error: ${response.statusCode}');
      }
    } catch (e) {
      debugPrint('❌ Failed to report error to admin panel: $e');
    }
  }
  
  /// Get last sent status
  static Future<Map<String, dynamic>?> getLastStatus() async {
    try {
      final statusJson = _prefs?.getString(_lastStatusKey);
      if (statusJson != null) {
        return jsonDecode(statusJson) as Map<String, dynamic>;
      }
    } catch (e) {
      debugPrint('❌ Failed to get last status: $e');
    }
    return null;
  }
  
  /// Enable or disable the service
  static void setEnabled(bool enabled) {
    _isEnabled = enabled;
    debugPrint('🔗 Admin Panel Service: ${enabled ? "Enabled" : "Disabled"}');
  }
}
```

### 3. Update Remote Config Reader

Modify your existing `lib/config/remote_config_reader.dart` to work with the admin panel:

```dart
// Add this method to your RemoteConfigReader class

/// Force reload configuration and notify admin panel
static Future<void> forceReloadWithNotification() async {
  await forceReload();
  
  // Notify admin panel of config reload
  final config = await _getConfig();
  await AdminPanelService.sendStatusUpdate(
    status: 'running',
    configVersion: config['lastUpdated'],
  );
}

/// Get configuration with admin panel integration
static Future<Map<String, dynamic>> getConfigWithAdminPanel() async {
  final config = await _getConfig();
  
  // Send status update to admin panel
  AdminPanelService.sendStatusUpdate(
    status: 'running',
    configVersion: config['lastUpdated'],
  );
  
  return config;
}
```

### 4. Update Auth Provider

Modify your `lib/providers/auth_provider.dart` to integrate with admin panel:

```dart
// Add these imports at the top
import '../services/admin_panel_service.dart';

// In your AuthProvider class, add these methods:

/// Initialize admin panel integration
Future<void> initializeAdminPanel() async {
  await AdminPanelService.initialize();
}

/// Report authentication status
Future<void> reportAuthStatus(String status, {String? error}) async {
  await AdminPanelService.sendStatusUpdate(
    status: status,
    activeUsers: _isAuthenticated ? 1 : 0,
    errors: error != null ? [error] : [],
  );
}

// Modify your existing authenticate method:
Future<bool> authenticate({
  required String username,
  required String password,
  required String serverUrl,
}) async {
  try {
    // ... existing authentication code ...
    
    if (authResponse.userInfo != null) {
      // ... existing success code ...
      
      // Report successful authentication
      await reportAuthStatus('running');
      
      return true;
    } else {
      // Report authentication failure
      await reportAuthStatus('error', error: 'Authentication failed');
      return false;
    }
  } catch (e) {
    // Report error
    await AdminPanelService.reportError(
      error: 'Authentication error: $e',
      context: {
        'username': username,
        'serverUrl': serverUrl,
        'timestamp': DateTime.now().toIso8601String(),
      },
    );
    
    await reportAuthStatus('error', error: e.toString());
    return false;
  }
}
```

### 5. Update Main App Entry Point

Modify your `main.dart` to initialize admin panel integration:

```dart
import 'services/admin_panel_service.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  // Initialize admin panel service
  await AdminPanelService.initialize();
  
  // Send app startup status
  await AdminPanelService.sendStatusUpdate(
    status: 'starting',
    version: '1.0.0',
  );
  
  runApp(MyApp());
}

class MyApp extends StatefulWidget {
  @override
  _MyAppState createState() => _MyAppState();
}

class _MyAppState extends State<MyApp> with WidgetsBindingObserver {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    
    // Send app ready status
    WidgetsBinding.instance.addPostFrameCallback((_) {
      AdminPanelService.sendStatusUpdate(status: 'running');
    });
  }
  
  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }
  
  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    super.didChangeAppLifecycleState(state);
    
    switch (state) {
      case AppLifecycleState.resumed:
        AdminPanelService.sendStatusUpdate(status: 'running');
        break;
      case AppLifecycleState.paused:
        AdminPanelService.sendStatusUpdate(status: 'paused');
        break;
      case AppLifecycleState.detached:
        AdminPanelService.sendStatusUpdate(status: 'stopping');
        break;
      default:
        break;
    }
  }
  
  // ... rest of your app code
}
```

### 6. Error Reporting Integration

Add error reporting throughout your app:

```dart
// In your XtreamService or other services:
try {
  // ... your existing code ...
} catch (e, stackTrace) {
  // Report to admin panel
  await AdminPanelService.reportError(
    error: e.toString(),
    stack: stackTrace.toString(),
    context: {
      'service': 'XtreamService',
      'method': 'authenticate',
      'baseUrl': baseUrl,
      'timestamp': DateTime.now().toIso8601String(),
    },
  );
  
  // ... your existing error handling ...
}
```

### 7. Periodic Status Updates

Add periodic status updates in your main app:

```dart
import 'dart:async';

class StatusReporter {
  static Timer? _statusTimer;
  
  static void startPeriodicReporting() {
    _statusTimer?.cancel();
    _statusTimer = Timer.periodic(Duration(minutes: 5), (timer) {
      _sendPeriodicStatus();
    });
  }
  
  static void stopPeriodicReporting() {
    _statusTimer?.cancel();
    _statusTimer = null;
  }
  
  static Future<void> _sendPeriodicStatus() async {
    try {
      // Get current app state
      final config = await RemoteConfigReader.getConfigStatus();
      
      await AdminPanelService.sendStatusUpdate(
        status: 'running',
        configVersion: config['lastUpdated'],
        activeUsers: 1, // You can track this based on your app logic
      );
    } catch (e) {
      debugPrint('Failed to send periodic status: $e');
    }
  }
}

// Start reporting in your main app initialization
StatusReporter.startPeriodicReporting();
```

## Configuration

### Admin Panel URL

Update the admin panel URL in `AdminPanelService`:

```dart
// For local development
static const String _adminPanelUrl = 'http://localhost:3001';

// For production (replace with your actual domain)
static const String _adminPanelUrl = 'https://admin.your-domain.com';
```

### Network Security

Add the admin panel domain to your network security config (`android/app/src/main/res/xml/network_security_config.xml`):

```xml
<domain-config cleartextTrafficPermitted="true">
    <domain includeSubdomains="true">localhost</domain>
    <domain includeSubdomains="true">admin.your-domain.com</domain>
</domain-config>
```

## Testing Integration

Run the integration test from the admin panel directory:

```bash
cd admin_panel
node test_integration.js
```

This will verify that all endpoints are working correctly.

## Best Practices

1. **Error Handling**: Always wrap admin panel calls in try-catch blocks
2. **Timeouts**: Use reasonable timeouts to avoid blocking the main app
3. **Graceful Degradation**: The app should work even if the admin panel is unavailable
4. **Privacy**: Don't send sensitive user data to the admin panel
5. **Rate Limiting**: Avoid sending too many requests to prevent rate limiting

## Troubleshooting

### Common Issues

1. **Network connectivity**: Ensure the admin panel is accessible from the app
2. **CORS errors**: Check the admin panel's CORS configuration
3. **Timeout errors**: Increase timeout values if needed
4. **SSL/TLS issues**: Ensure proper certificate configuration for HTTPS

### Debug Mode

Enable debug logging to see admin panel communication:

```dart
// Add this to see all admin panel requests
debugPrint('🔗 Admin Panel Request: $url');
debugPrint('📤 Admin Panel Data: $data');
```
