# Anume Admin Panel - Netlify Deployment Guide

## 🚀 Deploy to Netlify

### Prerequisites
- GitHub account with this repository
- Netlify account (free tier available)
- Node.js 18+ for local development

### Quick Deployment Steps

1. **Go to Netlify**
   - Visit [netlify.com](https://netlify.com)
   - Sign in with your GitHub account
   - Click "New site from Git"

2. **Connect Repository**
   - Choose "GitHub"
   - Select your repository: `QuickkApps/adminpanel`
   - Click "Deploy site"

3. **Configure Build Settings**
   - **Base directory**: Leave empty (uses root)
   - **Build command**: `npm run build`
   - **Publish directory**: `client`
   - **Functions directory**: `netlify/functions`

4. **Environment Variables**
   Go to Site Settings > Environment Variables and add:
   ```
   NODE_ENV=production
   JWT_SECRET=your-super-secret-jwt-key-here-make-it-long-and-random
   ADMIN_USERNAME=admin
   ADMIN_PASSWORD=your-secure-password
   PORT=8888
   ```

5. **Deploy**
   - Click "Deploy site"
   - Wait for deployment to complete
   - Your admin panel will be available at: `https://your-site-name.netlify.app`

### Important Notes for Netlify

⚠️ **Serverless Architecture**: Netlify uses serverless functions, which means:
- The server restarts on each request
- SQLite database will reset between deployments
- Real-time features (Socket.IO) may have limitations

### Recommended Database Upgrade

For production use on Netlify, consider upgrading to a cloud database:

1. **MongoDB Atlas** (Recommended)
   ```bash
   npm install mongodb
   ```
   Add to environment variables:
   ```
   MONGODB_URI=your-mongodb-connection-string
   ```

2. **PostgreSQL (Supabase/Neon)**
   ```bash
   npm install pg
   ```
   Add to environment variables:
   ```
   DATABASE_URL=your-postgresql-connection-string
   ```

### Alternative: Static Admin Panel

For a simpler deployment, you can also deploy just the client-side admin panel:

1. **Build Settings**:
   - Build command: `cd client && npm install && npm run build`
   - Publish directory: `client/dist` or `client/build`

2. **API Integration**: Connect to your existing backend or use Netlify Functions

### Post-Deployment

1. **Test the Admin Panel**
   - Visit your Netlify URL
   - Login with your admin credentials
   - Verify all features work correctly

2. **Update Flutter App**
   - Replace localhost URLs with your Netlify URL
   - Test the connection between Flutter app and admin panel

3. **Monitor Performance**
   - Check Netlify Analytics
   - Monitor function execution times
   - Review error logs in Netlify dashboard

### Custom Domain (Optional)

1. Go to Site Settings > Domain management
2. Add custom domain
3. Configure DNS records
4. SSL certificate will be automatically provisioned

### Troubleshooting

**Common Issues:**
- **Database resets**: Upgrade to cloud database
- **Function timeouts**: Optimize database queries
- **Socket.IO issues**: Consider using Netlify's real-time features or WebSockets

**Support:**
- Check Netlify function logs
- Review build logs for errors
- Ensure all environment variables are set

---

**Note**: For full real-time functionality and persistent data, consider using a cloud database service alongside Netlify hosting.
