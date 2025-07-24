# Content Management System Integration Guide

This guide explains how to test and use the new Content Management System that allows dynamic content updates for the Flutter app.

## 🚀 Quick Start

### 1. Start the Admin Panel Server

```bash
cd Main_admin_panel_all_done/admin_panel
npm install
npm start
```

The server will start on `http://localhost:3000`

### 2. Run Automated Tests

```bash
node test_content_management.js
```

This will verify that all API endpoints are working correctly.

### 3. Access Admin Panel

1. Open `http://localhost:3000` in your browser
2. Login with:
   - Username: `admin`
   - Password: `admin123`
3. Navigate to the **Content Management** tab

## 📱 Flutter App Setup

### 1. Install Dependencies

```bash
cd Main_anume_all_done/anume
flutter pub get
```

### 2. Run the Flutter App

```bash
flutter run
```

## 🧪 Manual Testing Steps

### Test 1: Content Management Interface

1. **Access Admin Panel**
   - Go to `http://localhost:3000`
   - Login with admin credentials
   - Click on "Content Management" tab

2. **Verify Content Display**
   - You should see two content cards: "About Anume" and "Privacy Policy"
   - Each card shows a preview of the current content
   - Each card has an "Edit" button

### Test 2: Content Editing

1. **Edit About Anume Content**
   - Click "Edit" on the About Anume card
   - Modal should open with current content
   - Modify the title and content
   - Click "Preview" to see how it will look
   - Click "Save Changes"
   - Confirm the update in the confirmation dialog

2. **Verify Update**
   - Content card should refresh with new content
   - Check the "Last updated" timestamp

### Test 3: Flutter App Integration

1. **Open Flutter App**
   - Navigate to Settings screen
   - Tap on "About Anume"
   - Verify that the content matches what you set in the admin panel

2. **Test Real-time Updates**
   - Keep the Flutter app open on the Settings screen
   - In the admin panel, update the About Anume content again
   - The Flutter app should show a notification about the content update
   - Tap "About Anume" again to see the updated content

### Test 4: Offline Functionality

1. **Test Offline Mode**
   - Disconnect from internet
   - Open Flutter app Settings > About Anume
   - Should show cached content with an "offline content" warning

2. **Test Cache Refresh**
   - Reconnect to internet
   - The app should automatically sync new content

## 🔧 API Endpoints

### Public Endpoints (No Authentication)

- `GET /api/content` - Get all content
- `GET /api/content/:key` - Get specific content (about_anume, privacy_policy)

### Admin Endpoints (Authentication Required)

- `GET /api/content/admin/all` - Get all content with admin details
- `PUT /api/content/:key` - Update specific content
- `GET /api/content/:key/history` - Get content history (future feature)

## 🔄 Real-time Synchronization

The system uses WebSocket connections to push content updates to connected Flutter apps in real-time.

### How it works:

1. Admin updates content in the admin panel
2. Server broadcasts update via WebSocket
3. Flutter app receives update notification
4. App clears cached content and shows notification
5. User can refresh to see new content immediately

## 🛡️ Security Features

### Authentication
- JWT-based authentication for admin endpoints
- Session management with automatic token refresh

### Validation
- Input validation for content length and format
- Content type validation (plain_text, html, markdown)
- XSS protection for HTML content

### Error Handling
- Graceful fallback to cached content
- Offline mode support
- Comprehensive error messages

## 📊 Monitoring and Logging

### Admin Panel Logs
- Content update events
- User authentication events
- WebSocket connection status
- API request/response logs

### Flutter App Logs
- Content fetch operations
- Cache operations
- WebSocket connection status
- Real-time update events

## 🔍 Troubleshooting

### Common Issues

1. **Content not updating in Flutter app**
   - Check WebSocket connection status
   - Verify admin panel server is running
   - Clear app cache manually

2. **Admin panel login fails**
   - Verify default credentials (admin/admin123)
   - Check server logs for authentication errors

3. **Real-time updates not working**
   - Check WebSocket connection in browser dev tools
   - Verify Flutter app has internet connection
   - Check server logs for WebSocket events

### Debug Commands

```bash
# Check server status
curl http://localhost:3000/api

# Test content fetch
curl http://localhost:3000/api/content

# Check WebSocket connection
# Open browser dev tools > Network > WS tab
```

## 🚀 Production Deployment

### Environment Variables

```bash
# Admin Panel
NODE_ENV=production
ADMIN_USERNAME=your_admin_username
ADMIN_PASSWORD=your_secure_password
JWT_SECRET=your_jwt_secret
DATABASE_URL=your_database_url

# Flutter App
ADMIN_PANEL_BASE_URL=https://your-admin-panel-domain.com
```

### Security Considerations

1. Change default admin credentials
2. Use HTTPS in production
3. Configure CORS properly
4. Set up rate limiting
5. Enable request logging
6. Use secure WebSocket connections (WSS)

## 📈 Performance Optimization

### Caching Strategy
- Content cached for 6 hours by default
- Automatic cache invalidation on updates
- Fallback to cached content when offline

### WebSocket Optimization
- Connection pooling
- Automatic reconnection
- Heartbeat mechanism
- Error recovery

## 🔮 Future Enhancements

1. **Content Versioning**
   - Track content history
   - Rollback functionality
   - Diff visualization

2. **Rich Text Editor**
   - WYSIWYG editor for HTML content
   - Markdown preview
   - Image upload support

3. **Multi-language Support**
   - Content localization
   - Language-specific content management

4. **Analytics**
   - Content view tracking
   - Update frequency metrics
   - User engagement analytics

## 📞 Support

For issues or questions:
1. Check the troubleshooting section above
2. Review server and app logs
3. Run the automated test suite
4. Check WebSocket connection status
