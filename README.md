# Anume VPN Admin Panel

A comprehensive web-based administration panel for managing VPN users, servers, and configurations with real-time chat support and fallback URL management.

![Admin Panel Dashboard](https://img.shields.io/badge/Status-Production%20Ready-brightgreen)
![Node.js](https://img.shields.io/badge/Node.js-16%2B-green)
![License](https://img.shields.io/badge/License-MIT-blue)

## 🚀 Features

### 📊 **Dashboard & Analytics**
- Real-time user statistics and server monitoring
- Interactive charts and system health indicators
- Activity tracking and comprehensive reporting

### 👥 **User Management**
- Complete user lifecycle management (CRUD operations)
- User activity monitoring and session tracking
- Bulk operations and advanced filtering
- Authentication and authorization system

### 🖥️ **VPN Server Management**
- Add, edit, and delete VPN servers with drag-and-drop reordering
- Real-time server status monitoring and health checks
- Country-based filtering and organization
- Custom server configurations and bulk operations

### 💬 **Real-time Support Chat**
- Live chat system between admins and users
- Message history and conversation management
- File sharing and multimedia support
- Multi-admin support with role-based access

### ⚙️ **Configuration Management**
- Remote configuration updates with versioning
- OVPN file upload and URL download functionality
- Automatic form population from uploaded files
- Configuration rollback capabilities

### 🔄 **Fallback URL System**
- Multiple fallback URLs with priority ordering
- Automatic failover and retry logic with exponential backoff
- URL health monitoring and testing
- Client-side persistence and caching

### 🔐 **Security Features**
- JWT-based authentication with refresh tokens
- Rate limiting and DDoS protection
- Input validation and sanitization
- Secure file upload handling with virus scanning

## Quick Start

### 🚀 Deploy to Railway (Recommended)

The easiest way to deploy this admin panel:

1. **Fork this repository** to your GitHub account
2. **Sign up at [Railway](https://railway.app)** with GitHub
3. **Create new project** → Deploy from GitHub repo
4. **Set environment variables** (see RAILWAY_DEPLOYMENT.md)
5. **Deploy automatically** - get instant URL!

👉 **[Detailed Railway Guide](RAILWAY_DEPLOYMENT.md)**

### 💻 Local Development

#### Prerequisites

- Node.js 16.0.0 or higher
- npm or yarn package manager

#### Installation

1. Clone or navigate to the admin panel directory:
   ```bash
   cd admin_panel
   ```

2. Install dependencies:
   ```bash
   npm run install:all
   ```

3. Copy environment configuration:
   ```bash
   cp .env.example .env
   ```

4. Edit `.env` file with your configuration:
   ```bash
   nano .env
   ```

5. Start the development server:
   ```bash
   npm run dev
   ```

6. Open your browser and navigate to:
   ```
   http://localhost:3001
   ```

### Default Login

- **Username**: admin
- **Password**: admin123

⚠️ **Important**: Change the default credentials in production!

## Configuration

The admin panel manages the main app's configuration through the `remote_config.json` file. This file contains:

- API URL for the Xtream service
- Activation API URL for the activation system
- Additional settings and flags
- Last updated timestamp

**Note**: Username and password credentials are managed by the app's activation system and are not configurable through the admin panel.

## API Endpoints

### Authentication
- `POST /api/auth/login` - Login with credentials
- `POST /api/auth/logout` - Logout current session
- `GET /api/auth/verify` - Verify JWT token

### Configuration Management
- `GET /api/config` - Get current configuration
- `PUT /api/config` - Update configuration
- `GET /api/config/status` - Get configuration status
- `POST /api/config/backup` - Create configuration backup
- `GET /api/config/backups` - List available backups
- `POST /api/config/restore/:backupId` - Restore from backup

### App Communication
- `POST /api/app/status` - Receive status updates from main app
- `GET /api/app/ping` - Health check endpoint

## Development

### Project Structure

```
admin_panel/
├── server.js              # Main server file
├── routes/                 # API routes
├── middleware/             # Express middleware
├── services/               # Business logic
├── utils/                  # Utility functions
├── client/                 # Frontend React app
├── logs/                   # Application logs
├── backups/                # Configuration backups
└── tests/                  # Test files
```

### Running Tests

```bash
npm test
```

### Building for Production

```bash
npm run build
npm start
```

## Security

- JWT-based authentication
- Rate limiting on API endpoints
- CORS protection
- Input validation and sanitization
- Secure headers with Helmet.js

## 🚀 Quick Demo

1. **Start the admin panel**:
   ```bash
   npm start
   ```

2. **Open in browser**: http://localhost:3001

3. **Login with default credentials**:
   - Username: `admin`
   - Password: `admin123`

4. **Test the integration**:
   ```bash
   node test_integration.js
   ```

## 📁 Project Structure

```
admin_panel/
├── server.js              # Main server file
├── routes/                 # API routes
│   ├── auth.js            # Authentication endpoints
│   ├── config.js          # Configuration management
│   └── app.js             # App communication endpoints
├── middleware/             # Express middleware
│   ├── auth.js            # JWT authentication
│   └── rateLimit.js       # Rate limiting
├── services/               # Business logic
│   └── configService.js   # Configuration management service
├── utils/                  # Utility functions
│   └── logger.js          # Winston logger setup
├── client/                 # Frontend files
│   ├── index.html         # Main UI
│   └── app.js             # Frontend JavaScript
├── logs/                   # Application logs
├── backups/                # Configuration backups
├── tests/                  # Test files
├── DEPLOYMENT_GUIDE.md     # Detailed deployment instructions
├── INTEGRATION_GUIDE.md    # Flutter app integration guide
└── test_integration.js     # Integration test script
```

## 🔗 API Endpoints

### Authentication
- `POST /api/auth/login` - Login with credentials
- `GET /api/auth/verify` - Verify JWT token
- `POST /api/auth/logout` - Logout current session
- `POST /api/auth/change-password` - Change admin password

### Configuration Management
- `GET /api/config` - Get current configuration
- `PUT /api/config` - Update configuration
- `GET /api/config/status` - Get configuration status
- `POST /api/config/backup` - Create configuration backup
- `GET /api/config/backups` - List available backups
- `POST /api/config/restore/:backupId` - Restore from backup
- `POST /api/config/reset` - Reset to default configuration

### App Communication
- `POST /api/app/status` - Receive status updates from main app
- `POST /api/app/error` - Receive error reports from main app
- `GET /api/app/status` - Get current app status
- `GET /api/app/ping` - Health check endpoint
- `DELETE /api/app/errors` - Clear error history
- `POST /api/app/command` - Send commands to main app

## 🔧 Configuration Management

The admin panel manages the main app's configuration through the `remote_config.json` file:

```json
{
  "apiUrl": "http://nuconteaza.mmager.ro:8080",
  "username": "test",
  "password": "test",
  "activationApiUrl": "https://www.xtream.ro/appactivation",
  "lastUpdated": "2024-01-01T00:00:00.000Z",
  "isActive": true,
  "additionalSettings": {
    "timeout": 30000,
    "retryAttempts": 3,
    "enableLogging": true
  },
  "version": "1.0.0"
}
```

**Configuration Fields:**
- `apiUrl`: The Xtream service API URL (configurable via admin panel)
- `activationApiUrl`: The activation service API URL (configurable via admin panel)
- `username`: Authentication username (managed by app activation system)
- `password`: Authentication password (managed by app activation system)
- `isActive`: Configuration status (configurable via admin panel)
- `additionalSettings`: Various app settings
- `lastUpdated`: Timestamp of last configuration change
```

## 🔐 Security Features

- **JWT Authentication**: Secure token-based authentication
- **Rate Limiting**: Protection against brute force attacks
- **CORS Protection**: Configurable cross-origin resource sharing
- **Input Validation**: Server-side validation of all inputs
- **Secure Headers**: Helmet.js for security headers
- **Configuration Backups**: Automatic backup before changes
- **Error Logging**: Comprehensive error tracking and logging

## 📊 Real-time Features

- **WebSocket Communication**: Real-time updates between admin panel and main app
- **Live Status Monitoring**: Real-time app status and error reporting
- **Configuration Sync**: Instant configuration updates across all connected clients
- **Error Notifications**: Real-time error alerts from the main app

## 🧪 Testing

Run the test suite:
```bash
npm test
```

Test integration with main app:
```bash
node test_integration.js
```

## 📚 Documentation

- **[Deployment Guide](DEPLOYMENT_GUIDE.md)**: Complete deployment instructions
- **[Integration Guide](INTEGRATION_GUIDE.md)**: Flutter app integration steps
- **[API Documentation](API.md)**: Detailed API reference (coming soon)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## 📞 Support

For support and questions:
- Check the logs in `logs/` directory
- Review the configuration in `.env` file
- Run integration tests to verify connectivity
- Check network connectivity between admin panel and main app

## 🔄 Updates

To update the admin panel:
1. Stop the current instance
2. Pull the latest changes
3. Run `npm install` to update dependencies
4. Restart the application

## License

MIT License - see LICENSE file for details
