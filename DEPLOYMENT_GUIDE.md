# Anume Admin Panel - Deployment Guide

## Overview

The Anume Admin Panel is a web-based application that allows remote management of the main Anume app's configuration. It provides a secure interface for updating API URLs, credentials, and monitoring app status in real-time.

## Prerequisites

- **Node.js**: Version 16.0.0 or higher
- **npm**: Version 7.0.0 or higher
- **Operating System**: Windows, macOS, or Linux
- **Network**: Access to the main Anume app directory

## Installation Steps

### 1. Navigate to Admin Panel Directory

```bash
cd F:\Anume\anume3_with_player_code\anume2\admin_panel
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment

Copy the example environment file and customize it:

```bash
cp .env.example .env
```

Edit the `.env` file with your specific configuration:

```env
# Server Configuration
PORT=3001
NODE_ENV=production

# Security (CHANGE THESE IN PRODUCTION!)
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your-secure-password

# CORS Configuration
ALLOWED_ORIGINS=http://localhost:3001,http://your-domain.com

# File Paths
ANUME_CONFIG_PATH=../anume/lib/config/remote_config.json
BACKUP_DIR=./backups

# Logging
LOG_LEVEL=info
LOG_FILE=./logs/admin-panel.log

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# WebSocket Configuration
WEBSOCKET_ENABLED=true
```

### 4. Create Required Directories

```bash
mkdir -p logs backups
```

### 5. Test the Installation

```bash
npm test
```

### 6. Start the Application

For development:
```bash
npm run dev
```

For production:
```bash
npm start
```

## Production Deployment

### Using PM2 (Recommended)

1. Install PM2 globally:
```bash
npm install -g pm2
```

2. Create PM2 ecosystem file (`ecosystem.config.js`):
```javascript
module.exports = {
  apps: [{
    name: 'anume-admin-panel',
    script: 'server.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    }
  }]
};
```

3. Start with PM2:
```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### Using Windows Service

1. Install node-windows:
```bash
npm install -g node-windows
```

2. Create service script (`install-service.js`):
```javascript
const Service = require('node-windows').Service;

const svc = new Service({
  name: 'Anume Admin Panel',
  description: 'Admin panel for Anume app configuration management',
  script: require('path').join(__dirname, 'server.js'),
  env: {
    name: "NODE_ENV",
    value: "production"
  }
});

svc.on('install', () => {
  svc.start();
});

svc.install();
```

3. Run the installer:
```bash
node install-service.js
```

## Security Configuration

### 1. Change Default Credentials

**IMPORTANT**: Always change the default admin credentials in production:

```env
ADMIN_USERNAME=your-admin-username
ADMIN_PASSWORD=your-secure-password
```

### 2. Generate Secure JWT Secret

Generate a strong JWT secret:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Use the output as your `JWT_SECRET` in the `.env` file.

### 3. Configure CORS

Set allowed origins for your domain:

```env
ALLOWED_ORIGINS=https://your-domain.com,https://admin.your-domain.com
```

### 4. Enable HTTPS (Production)

For production, use a reverse proxy like Nginx:

```nginx
server {
    listen 443 ssl;
    server_name admin.your-domain.com;
    
    ssl_certificate /path/to/certificate.crt;
    ssl_certificate_key /path/to/private.key;
    
    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## Firewall Configuration

### Windows Firewall

1. Open Windows Defender Firewall
2. Click "Advanced settings"
3. Create new inbound rule:
   - Rule Type: Port
   - Protocol: TCP
   - Port: 3001
   - Action: Allow the connection
   - Profile: Apply to all profiles
   - Name: "Anume Admin Panel"

### Linux (UFW)

```bash
sudo ufw allow 3001/tcp
sudo ufw reload
```

## Monitoring and Maintenance

### 1. Log Files

Monitor application logs:

```bash
# View real-time logs
tail -f logs/combined.log

# View error logs
tail -f logs/error.log
```

### 2. Health Checks

Set up automated health checks:

```bash
# Simple health check script
curl -f http://localhost:3001/api/app/ping || exit 1
```

### 3. Backup Management

The admin panel automatically creates backups when configurations are changed. To manually manage backups:

```bash
# List backups
ls -la backups/

# Restore from backup (via API)
curl -X POST http://localhost:3001/api/config/restore/backup_filename.json \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 4. Updates

To update the admin panel:

```bash
# Stop the service
pm2 stop anume-admin-panel

# Pull updates (if using git)
git pull

# Install new dependencies
npm install

# Start the service
pm2 start anume-admin-panel
```

## Troubleshooting

### Common Issues

1. **Port already in use**:
   ```bash
   # Find process using port 3001
   netstat -ano | findstr :3001
   # Kill the process
   taskkill /PID <process_id> /F
   ```

2. **Permission denied accessing config file**:
   - Ensure the admin panel has read/write access to the Anume config directory
   - Check file permissions and ownership

3. **WebSocket connection failed**:
   - Check firewall settings
   - Verify CORS configuration
   - Ensure the port is accessible

4. **Authentication issues**:
   - Verify JWT_SECRET is set correctly
   - Check if credentials match the .env file
   - Clear browser localStorage and try again

### Debug Mode

Enable debug logging:

```env
LOG_LEVEL=debug
NODE_ENV=development
```

### Support

For additional support:
1. Check the application logs in `logs/` directory
2. Review the configuration in `.env` file
3. Test the integration using `node test_integration.js`
4. Verify network connectivity between admin panel and main app

## Performance Optimization

### 1. Memory Management

Monitor memory usage:

```bash
# With PM2
pm2 monit

# Manual monitoring
node -e "console.log(process.memoryUsage())"
```

### 2. Log Rotation

Configure log rotation to prevent disk space issues:

```javascript
// In winston configuration
new winston.transports.File({
  filename: 'logs/combined.log',
  maxsize: 5242880, // 5MB
  maxFiles: 5,
})
```

### 3. Rate Limiting

Adjust rate limiting based on your needs:

```env
RATE_LIMIT_WINDOW_MS=900000  # 15 minutes
RATE_LIMIT_MAX_REQUESTS=100  # 100 requests per window
```
