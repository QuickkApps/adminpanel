# Anume Admin Panel - Railway Deployment Guide

## Quick Deploy to Railway

Railway is a modern hosting platform that makes deploying Node.js applications incredibly easy.

### 1. Prerequisites
- GitHub account
- Railway account (free at railway.app)

### 2. Deploy Steps

#### Step 1: Connect GitHub to Railway
1. Go to [railway.app](https://railway.app)
2. Sign up/Login with GitHub
3. Click "New Project"
4. Select "Deploy from GitHub repo"
5. Choose your repository: `QuickkApps/adminpanel`

#### Step 2: Configure Environment Variables
In Railway dashboard, add these environment variables:

**Required Variables:**
```
NODE_ENV=production
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your-secure-password-change-this
PORT=3000
```

**Optional Variables:**
```
ALLOWED_ORIGINS=https://your-app-name.up.railway.app
ANUME_CONFIG_PATH=./config/remote_config.json
BACKUP_DIR=./backups
LOG_LEVEL=info
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
WEBSOCKET_ENABLED=true
```

#### Step 3: Deploy
1. Railway will automatically detect it's a Node.js app
2. It will run `npm install` and `npm start`
3. Your app will be deployed automatically
4. You'll get a URL like: `https://your-app-name.up.railway.app`

### 3. Important Configuration

#### Generate Secure JWT Secret
Run this command locally and use the output as JWT_SECRET:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

#### Update CORS Origins
Set `ALLOWED_ORIGINS` to your Railway URL:
```
ALLOWED_ORIGINS=https://your-app-name.up.railway.app
```

#### Change Default Password
**IMPORTANT**: Change `ADMIN_PASSWORD` from the default `admin123`

### 4. Access Your Admin Panel

1. **URL**: Your Railway app URL (shown in dashboard)
2. **Login**: Use your `ADMIN_USERNAME` and `ADMIN_PASSWORD`
3. **Default**: `admin` / `admin123` (CHANGE THIS!)

### 5. Railway Features

#### Free Tier Includes:
- ✅ **$5 credit per month** (usually enough for small apps)
- ✅ **Automatic deployments** from GitHub
- ✅ **Custom domains** (on paid plans)
- ✅ **Environment variables** management
- ✅ **Logs and monitoring**
- ✅ **No sleep mode** (unlike some free platforms)

#### Database Storage:
- ✅ **Persistent storage** (your SQLite database persists)
- ✅ **Automatic backups** via your app's backup system
- ✅ **Can upgrade** to PostgreSQL if needed

### 6. Monitoring and Logs

#### View Logs:
1. Go to Railway dashboard
2. Click on your project
3. Go to "Deployments" tab
4. Click on latest deployment to view logs

#### Monitor Usage:
- Check resource usage in Railway dashboard
- Monitor your $5 monthly credit
- Upgrade to paid plan if needed

### 7. Custom Domain (Optional)

#### Free Subdomain:
- Railway provides: `your-app-name.up.railway.app`
- No additional setup required

#### Custom Domain (Paid):
1. Upgrade to Pro plan ($5/month)
2. Add your domain in Railway dashboard
3. Update DNS records as instructed

### 8. Troubleshooting

#### Common Issues:

1. **Build Fails**:
   - Check Node.js version in package.json
   - Verify all dependencies are in package.json
   - Check Railway build logs

2. **App Won't Start**:
   - Verify `npm start` works locally
   - Check environment variables are set
   - Review Railway deployment logs

3. **Database Issues**:
   - Railway has persistent storage
   - Database will be recreated on first run
   - Check file permissions in logs

4. **CORS Errors**:
   - Update `ALLOWED_ORIGINS` with your Railway URL
   - Include both HTTP and HTTPS if testing

#### Debug Steps:
1. Check Railway deployment logs
2. Verify environment variables
3. Test locally with same environment
4. Check Railway status page

### 9. Scaling and Upgrades

#### When to Upgrade:
- **Free tier**: Good for testing and light usage
- **Pro plan** ($5/month): For production use
- **More resources**: If you exceed free tier limits

#### Upgrade Benefits:
- More compute resources
- Custom domains
- Priority support
- Higher usage limits

### 10. Security Best Practices

1. **Change default credentials** immediately
2. **Use strong JWT secret** (64+ characters)
3. **Enable HTTPS** (automatic on Railway)
4. **Regular backups** (automatic via app)
5. **Monitor access logs**

## Support

For Railway-specific issues:
1. Check Railway documentation
2. Railway Discord community
3. Railway support (paid plans)

For app-specific issues:
1. Check Railway deployment logs
2. Test locally first
3. Verify environment variables match local .env
