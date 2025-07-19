# Anume Admin Panel - Web Hosting Deployment Guide

## Overview
This guide helps you deploy the admin panel on your own web hosting provider.

## Prerequisites
Your web hosting must support:
- Node.js (version 16+)
- SSH access OR Node.js app management panel
- File upload capabilities (FTP/SFTP/File Manager)

## Deployment Methods

### Method 1: VPS/Cloud Server (Full Control)

#### Step 1: Upload Files
```bash
# Via SFTP/SCP
scp -r admin_panel/ user@yourserver.com:/var/www/

# Or via Git
ssh user@yourserver.com
cd /var/www/
git clone https://github.com/QuickkApps/adminpanel.git admin_panel
```

#### Step 2: Install Dependencies
```bash
cd /var/www/admin_panel
npm install --production
```

#### Step 3: Configure Environment
```bash
cp .env.example .env
nano .env
```

Edit the .env file:
```env
PORT=3001
NODE_ENV=production
JWT_SECRET=your-super-secret-jwt-key-change-this
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your-secure-password
ALLOWED_ORIGINS=https://yourdomain.com,https://admin.yourdomain.com
ANUME_CONFIG_PATH=./config/remote_config.json
BACKUP_DIR=./backups
LOG_LEVEL=info
```

#### Step 4: Create Required Directories
```bash
mkdir -p logs backups config
```

#### Step 5: Start Application
```bash
# Install PM2 for process management
npm install -g pm2

# Start the application
pm2 start server.js --name "admin-panel"

# Save PM2 configuration
pm2 save
pm2 startup
```

#### Step 6: Configure Web Server (Nginx)
Create `/etc/nginx/sites-available/admin-panel`:
```nginx
server {
    listen 80;
    server_name admin.yourdomain.com;
    
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

Enable the site:
```bash
sudo ln -s /etc/nginx/sites-available/admin-panel /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### Method 2: Shared Hosting with Node.js Support

#### Step 1: Prepare Files
1. Create a ZIP file of your admin_panel folder
2. Upload via your hosting provider's File Manager
3. Extract the files in your desired directory

#### Step 2: Configure via Hosting Panel
1. Go to your hosting control panel
2. Find "Node.js Apps" or similar section
3. Create new Node.js application:
   - **Startup file**: `server.js`
   - **Application root**: `/path/to/admin_panel`
   - **Node.js version**: 16 or higher

#### Step 3: Set Environment Variables
In your hosting panel's Node.js app settings, add:
```
NODE_ENV=production
JWT_SECRET=your-super-secret-jwt-key
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your-secure-password
PORT=3001
```

#### Step 4: Install Dependencies
Most hosting panels have an "Install Dependencies" button or run:
```bash
npm install --production
```

#### Step 5: Start Application
Click "Start" or "Restart" in your hosting panel.

## Security Configuration

### 1. Change Default Credentials
```env
ADMIN_USERNAME=your-admin-username
ADMIN_PASSWORD=your-secure-password
```

### 2. Generate Secure JWT Secret
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### 3. Configure CORS
```env
ALLOWED_ORIGINS=https://yourdomain.com,https://admin.yourdomain.com
```

### 4. Enable HTTPS
- Use Let's Encrypt for free SSL certificates
- Configure your web server to redirect HTTP to HTTPS

## Domain Configuration

### Option 1: Subdomain
- Create subdomain: `admin.yourdomain.com`
- Point to your server IP or hosting account

### Option 2: Directory
- Access via: `yourdomain.com/admin`
- Configure web server to proxy requests

## Troubleshooting

### Common Issues:

1. **Port already in use**:
   ```bash
   sudo lsof -i :3001
   sudo kill -9 <PID>
   ```

2. **Permission denied**:
   ```bash
   sudo chown -R www-data:www-data /var/www/admin_panel
   sudo chmod -R 755 /var/www/admin_panel
   ```

3. **Node.js not found**:
   - Install Node.js: `curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -`
   - Then: `sudo apt-get install -y nodejs`

4. **Database issues**:
   - Ensure write permissions: `chmod 755 database/`
   - Check SQLite installation: `sqlite3 --version`

### Monitoring:

1. **Check application status**:
   ```bash
   pm2 status
   pm2 logs admin-panel
   ```

2. **Monitor resources**:
   ```bash
   pm2 monit
   ```

3. **View application logs**:
   ```bash
   tail -f logs/combined.log
   ```

## Performance Tips

1. **Enable gzip compression** in Nginx
2. **Set up log rotation** to prevent disk space issues
3. **Monitor memory usage** with PM2
4. **Use CDN** for static assets if needed

## Backup Strategy

1. **Database backups**: Automatically created in `backups/` folder
2. **Full application backup**: Regular snapshots of entire directory
3. **Configuration backup**: Keep `.env` file secure and backed up

## Support

If you encounter issues:
1. Check the logs in `logs/` directory
2. Verify Node.js and npm versions
3. Test locally first with `npm start`
4. Check firewall and port configurations
