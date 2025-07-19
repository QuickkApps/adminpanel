#!/bin/bash

# Anume Admin Panel - Web Hosting Deployment Script
# This script helps prepare and deploy the admin panel to your web hosting

echo "🚀 Anume Admin Panel Deployment Script"
echo "======================================"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 16+ first."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 16 ]; then
    echo "❌ Node.js version 16+ required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js version: $(node -v)"

# Create required directories
echo "📁 Creating required directories..."
mkdir -p logs backups config

# Install dependencies
echo "📦 Installing dependencies..."
npm install --production

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "⚙️ Creating environment configuration..."
    cp .env.example .env
    echo "📝 Please edit .env file with your production settings:"
    echo "   - Change JWT_SECRET"
    echo "   - Update ADMIN_PASSWORD"
    echo "   - Set ALLOWED_ORIGINS to your domain"
    echo ""
    echo "Example .env configuration:"
    echo "PORT=3001"
    echo "NODE_ENV=production"
    echo "JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")"
    echo "ADMIN_USERNAME=admin"
    echo "ADMIN_PASSWORD=your-secure-password"
    echo "ALLOWED_ORIGINS=https://yourdomain.com"
    echo ""
    read -p "Press Enter after editing .env file..."
fi

# Create default config if it doesn't exist
if [ ! -f "config/remote_config.json" ]; then
    echo "📄 Creating default configuration file..."
    cat > config/remote_config.json << EOF
{
  "apiUrl": "http://nuconteaza.mmager.ro:8080",
  "username": "test",
  "password": "test",
  "activationApiUrl": "https://www.xtream.ro/appactivation",
  "lastUpdated": "$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")",
  "isActive": true,
  "additionalSettings": {
    "timeout": 30000,
    "retryAttempts": 3,
    "enableLogging": true
  },
  "version": "1.0.0"
}
EOF
fi

# Test the application
echo "🧪 Testing application..."
if npm test; then
    echo "✅ Tests passed!"
else
    echo "⚠️ Some tests failed, but continuing deployment..."
fi

# Check if PM2 is available
if command -v pm2 &> /dev/null; then
    echo "🔄 Starting application with PM2..."
    pm2 start server.js --name "anume-admin-panel"
    pm2 save
    echo "✅ Application started with PM2"
    echo "📊 Monitor with: pm2 monit"
    echo "📋 View logs with: pm2 logs anume-admin-panel"
else
    echo "⚠️ PM2 not found. Install with: npm install -g pm2"
    echo "🔄 Starting application with Node.js..."
    echo "📝 For production, consider using PM2 for process management"
    node server.js &
    echo "✅ Application started"
fi

echo ""
echo "🎉 Deployment completed!"
echo "📍 Access your admin panel at: http://localhost:3001"
echo "🔐 Default login: admin / (check your .env file)"
echo ""
echo "📚 Next steps:"
echo "1. Configure your web server (Nginx/Apache) to proxy requests"
echo "2. Set up SSL certificate for HTTPS"
echo "3. Configure firewall to allow port 3001"
echo "4. Set up domain/subdomain pointing to your server"
echo ""
echo "📖 For detailed instructions, see WEB_HOSTING_GUIDE.md"
