# Anume Admin Panel - Vercel Deployment Guide

## 🚀 Quick Deploy to Vercel

### Prerequisites
- GitHub account with this repository
- Vercel account (free tier available)
- Node.js 16+ for local development

### One-Click Deployment

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/QuickkApps/adminpanel.git)

### Manual Deployment Steps

1. **Connect to Vercel**
   - Go to [vercel.com](https://vercel.com)
   - Sign in with your GitHub account
   - Click "New Project"
   - Import this repository: `https://github.com/QuickkApps/adminpanel.git`

2. **Configure Project Settings**
   - **Framework Preset**: Other
   - **Root Directory**: `./` (leave as default)
   - **Build Command**: `npm run build`
   - **Output Directory**: Leave empty
   - **Install Command**: `npm install`

3. **Environment Variables**
   Add these environment variables in Vercel dashboard:
   ```
   NODE_ENV=production
   JWT_SECRET=your-super-secret-jwt-key-here
   ADMIN_USERNAME=admin
   ADMIN_PASSWORD=your-secure-password
   PORT=3000
   ```

4. **Deploy**
   - Click "Deploy"
   - Wait for deployment to complete
   - Your admin panel will be available at: `https://your-project-name.vercel.app`

### Post-Deployment Setup

1. **Access Admin Panel**
   - Visit your Vercel URL
   - Login with the credentials you set in environment variables
   - The dashboard will show all connected users and statistics

2. **Connect to Your Flutter App**
   - Update your Flutter app's API endpoints to point to your Vercel URL
   - Replace `localhost:3000` with `https://your-project-name.vercel.app`

### Features Available

✅ **Modern Dashboard**
- Real-time user statistics
- Clickable stat cards for navigation
- Online users tracking
- System health monitoring

✅ **User Management**
- Complete user list with search/filter
- User status management
- Bulk operations
- Export functionality

✅ **Real-time Chat System**
- Live chat with connected users
- Message history
- User presence indicators
- Rate limiting protection

✅ **Admin Management**
- Multi-admin support
- Role-based permissions
- Admin activity logs
- Secure authentication

✅ **Configuration Management**
- Remote app configuration
- Real-time updates
- Version control
- Backup/restore functionality

### Integration with Flutter App

Update your Flutter app's configuration to connect to the deployed admin panel:

```dart
// In your Flutter app's config
const String ADMIN_PANEL_URL = 'https://your-project-name.vercel.app';
const String SOCKET_URL = 'https://your-project-name.vercel.app';
```

### Monitoring and Logs

- **Vercel Dashboard**: Monitor deployment status and performance
- **Function Logs**: View real-time logs in Vercel dashboard
- **Analytics**: Track usage and performance metrics

### Custom Domain (Optional)

1. Go to your project settings in Vercel
2. Navigate to "Domains"
3. Add your custom domain
4. Update DNS records as instructed
5. SSL certificate will be automatically provisioned

### Support

For issues or questions:
- Check the logs in Vercel dashboard
- Review the main README.md for detailed documentation
- Ensure all environment variables are properly set

---

**Note**: The admin panel uses SQLite for data storage. In production on Vercel, the database will reset on each deployment. For persistent data, consider upgrading to a cloud database like PostgreSQL or MongoDB.
