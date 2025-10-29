# Deployment Guide - LockerRoom

This guide provides comprehensive instructions for deploying the LockerRoom platform to various hosting platforms and environments.

## 📋 Table of Contents

- [Pre-Deployment Checklist](#pre-deployment-checklist)
- [Environment Variables](#environment-variables)
- [Database Setup](#database-setup)
- [Deployment Platforms](#deployment-platforms)
  - [Vercel](#vercel-recommended)
  - [Railway](#railway)
  - [Render](#render)
  - [DigitalOcean App Platform](#digitalocean-app-platform)
  - [Self-Hosted (VPS)](#self-hosted-vps)
- [Post-Deployment](#post-deployment)
- [Monitoring & Maintenance](#monitoring--maintenance)
- [Troubleshooting](#troubleshooting)

## Pre-Deployment Checklist

Before deploying, ensure you have:

- ✅ **Environment Variables** configured
- ✅ **Database** provisioned and migrations run
- ✅ **Cloudinary Account** set up with API credentials
- ✅ **Stripe Account** configured (if using XEN Watch payments)
- ✅ **Domain Name** registered (optional)
- ✅ **SSL Certificate** configured (automated on most platforms)
- ✅ **Backup Strategy** for database

## Environment Variables

### Required Variables

```env
# Server Configuration
NODE_ENV=production
PORT=5174
CLIENT_ORIGIN=https://your-domain.com

# Database
DATABASE_URL=postgresql://user:password@host:5432/database

# JWT Authentication
JWT_SECRET=your-very-secure-random-string-minimum-32-characters

# Cloudinary
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret

# Session Storage
SESSION_SECRET=your-session-secret-key
```

### Optional Variables

```env
# Stripe (for XEN Watch payments)
STRIPE_SECRET_KEY=sk_live_your_stripe_secret_key
STRIPE_PUBLISHABLE_KEY=pk_live_your_stripe_publishable_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
```

### Generating Secure Secrets

```bash
# Generate JWT Secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Generate Session Secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Database Setup

### Option 1: Neon (Recommended for Serverless)

1. **Create Account** at [neon.tech](https://neon.tech)
2. **Create Project** and database
3. **Copy Connection String** to `DATABASE_URL`
4. **Run Migrations**:
   ```bash
   npm run db:push
   ```

### Option 2: Supabase

1. **Create Project** at [supabase.com](https://supabase.com)
2. **Get Connection String** from Settings → Database
3. **Run Migrations**:
   ```bash
   DATABASE_URL="postgresql://..." npm run db:push
   ```

### Option 3: Railway PostgreSQL

1. **Create PostgreSQL Service** in Railway dashboard
2. **Copy Connection String** from Variables tab
3. **Run Migrations**:
   ```bash
   DATABASE_URL="postgresql://..." npm run db:push
   ```

### Option 4: Managed PostgreSQL

For platforms like **AWS RDS**, **Google Cloud SQL**, or **Azure Database**:

1. **Provision Database** instance
2. **Configure Network Security** (allow your app's IP)
3. **Create Database**:
   ```sql
   CREATE DATABASE lockerroom;
   ```
4. **Run Migrations**:
   ```bash
   DATABASE_URL="postgresql://..." npm run db:push
   ```

## Deployment Platforms

### Vercel (Recommended)

Vercel provides excellent support for full-stack applications with automatic deployments.

#### Setup Steps

1. **Install Vercel CLI**:
   ```bash
   npm i -g vercel
   ```

2. **Login to Vercel**:
   ```bash
   vercel login
   ```

3. **Create `vercel.json`** configuration:
   ```json
   {
     "version": 2,
     "builds": [
       {
         "src": "server/index.ts",
         "use": "@vercel/node"
       },
       {
         "src": "package.json",
         "use": "@vercel/static-build",
         "config": {
           "distDir": "dist/public"
         }
       }
     ],
     "routes": [
       {
         "src": "/api/(.*)",
         "dest": "server/index.ts"
       },
       {
         "src": "/(.*)",
         "dest": "dist/public/$1"
       }
     ],
     "env": {
       "NODE_ENV": "production"
     }
   }
   ```

4. **Deploy**:
   ```bash
   vercel --prod
   ```

5. **Set Environment Variables** in Vercel Dashboard:
   - Go to Project → Settings → Environment Variables
   - Add all required variables

6. **Configure Build Settings**:
   ```json
   {
     "buildCommand": "npm run build",
     "outputDirectory": "dist/public",
     "installCommand": "npm install"
   }
   ```

#### GitHub Integration

1. **Connect Repository** to Vercel
2. **Configure Auto-Deployments** on push to main branch
3. **Preview Deployments** for pull requests

### Railway

Railway provides seamless deployment with integrated PostgreSQL.

#### Setup Steps

1. **Create Account** at [railway.app](https://railway.app)

2. **New Project** → Deploy from GitHub

3. **Add PostgreSQL Service**:
   - Click "+ New" → Database → PostgreSQL
   - Railway automatically creates `DATABASE_URL` variable

4. **Configure App Service**:
   - **Build Command**: `npm run build`
   - **Start Command**: `npm start`
   - **Healthcheck Path**: `/api/health`

5. **Set Environment Variables**:
   ```env
   NODE_ENV=production
   PORT=5174
   DATABASE_URL=${{Postgres.DATABASE_URL}}
   JWT_SECRET=your-jwt-secret
   CLOUDINARY_CLOUD_NAME=your-cloud-name
   CLOUDINARY_API_KEY=your-api-key
   CLOUDINARY_API_SECRET=your-api-secret
   ```

6. **Deploy**: Railway automatically deploys on git push

### Render

Render provides straightforward deployment with managed services.

#### Setup Steps

1. **Create Account** at [render.com](https://render.com)

2. **New Web Service** → Connect GitHub repository

3. **Configure Service**:
   - **Runtime**: Node
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Environment**: Node 18+

4. **Add PostgreSQL Database**:
   - New → PostgreSQL
   - Render automatically provides `DATABASE_URL`

5. **Set Environment Variables**:
   Add all required variables in the Environment tab

6. **Deploy**: Render automatically deploys on git push

### DigitalOcean App Platform

DigitalOcean App Platform offers straightforward deployment.

#### Setup Steps

1. **Create App** in DigitalOcean dashboard

2. **Connect GitHub Repository**

3. **Configure Build**:
   - **Build Command**: `npm run build`
   - **Run Command**: `npm start`
   - **HTTP Port**: 5174

4. **Add Database**:
   - Components → Add Database → PostgreSQL
   - DigitalOcean auto-provisions and links

5. **Set Environment Variables**: Add all required variables

6. **Deploy**: App Platform handles deployments automatically

### Self-Hosted (VPS)

For complete control, deploy on a VPS (DigitalOcean Droplet, AWS EC2, etc.).

#### Prerequisites

- Ubuntu 20.04+ or similar Linux distribution
- Node.js 18+ installed
- PostgreSQL 13+ installed
- Nginx for reverse proxy (recommended)
- PM2 for process management (recommended)

#### Setup Steps

1. **Server Setup**:
   ```bash
   # Update system
   sudo apt update && sudo apt upgrade -y
   
   # Install Node.js
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt install -y nodejs
   
   # Install PostgreSQL
   sudo apt install -y postgresql postgresql-contrib
   
   # Install Nginx
   sudo apt install -y nginx
   
   # Install PM2
   sudo npm install -g pm2
   ```

2. **Database Setup**:
   ```bash
   # Create PostgreSQL user and database
   sudo -u postgres psql
   ```
   ```sql
   CREATE USER lockerroom WITH PASSWORD 'secure-password';
   CREATE DATABASE lockerroom OWNER lockerroom;
   GRANT ALL PRIVILEGES ON DATABASE lockerroom TO lockerroom;
   \q
   ```

3. **Deploy Application**:
   ```bash
   # Clone repository
   git clone https://github.com/your-org/lockerroom.git
   cd lockerroom
   
   # Install dependencies
   npm install --production
   
   # Build application
   npm run build
   
   # Set environment variables
   nano .env  # Add all required variables
   ```

4. **Configure PM2**:
   ```bash
   # Start application with PM2
   pm2 start dist/index.js --name lockerroom
   
   # Save PM2 configuration
   pm2 save
   pm2 startup  # Follow instructions for systemd setup
   ```

5. **Configure Nginx**:
   ```nginx
   # /etc/nginx/sites-available/lockerroom
   server {
       listen 80;
       server_name your-domain.com;
       
       location / {
           proxy_pass http://localhost:5174;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
       }
   }
   ```

   ```bash
   # Enable site
   sudo ln -s /etc/nginx/sites-available/lockerroom /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl reload nginx
   ```

6. **Setup SSL with Let's Encrypt**:
   ```bash
   sudo apt install certbot python3-certbot-nginx
   sudo certbot --nginx -d your-domain.com
   ```

7. **Run Migrations**:
   ```bash
   npm run db:push
   ```

8. **Seed Database** (optional):
   ```bash
   npm run seed
   ```

## Post-Deployment

### 1. Verify Deployment

- ✅ **Health Check**: Visit `/api/health` endpoint
- ✅ **Database Connection**: Verify database connectivity
- ✅ **Authentication**: Test login functionality
- ✅ **Media Uploads**: Test Cloudinary integration
- ✅ **API Endpoints**: Test critical API routes

### 2. Initial Setup

1. **Create System Admin**:
   ```bash
   # Via database or API
   # Use the ensure-sysadmin script
   npm run ensure-sysadmin
   ```

2. **Configure System Settings**:
   - Login as system admin
   - Multi-platform Settings → System Configuration
   - Configure branding, appearance, and payment settings

3. **Seed Demo Data** (if needed):
   ```bash
   DATABASE_URL="your-prod-db-url" npm run seed
   ```

### 3. Domain Configuration

#### DNS Setup

- **A Record**: Point to server IP (VPS)
- **CNAME**: Point to platform URL (Vercel, Railway, etc.)
- **Allow DNS Propagation** (up to 48 hours)

#### SSL Certificate

- **Automatic**: Most platforms handle SSL automatically
- **Manual**: Use Let's Encrypt for VPS deployments

## Monitoring & Maintenance

### Application Monitoring

#### Health Checks

Create a health endpoint:

```typescript
// server/routes.ts
app.get('/api/health', async (req, res) => {
  try {
    // Check database connection
    await db.select().from(users).limit(1);
    res.json({ status: 'healthy', database: 'connected' });
  } catch (error) {
    res.status(503).json({ status: 'unhealthy', error: error.message });
  }
});
```

#### Logging

- **Platform Logs**: Use built-in logging (Vercel, Railway, Render)
- **PM2 Logs**: `pm2 logs lockerroom` (VPS)
- **Application Logs**: Implement structured logging

```typescript
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});
```

### Database Backups

#### Automated Backups

**Neon/Supabase**: Automatic backups included

**Self-Hosted PostgreSQL**:
```bash
# Add to crontab
0 2 * * * pg_dump -U lockerroom lockerroom > /backups/lockerroom-$(date +\%Y\%m\%d).sql
```

**Railway/Render**: Use platform backup features

### Performance Monitoring

- **Uptime Monitoring**: Use services like UptimeRobot, Pingdom
- **Error Tracking**: Integrate Sentry for error monitoring
- **Analytics**: Set up application analytics

### Updates & Maintenance

1. **Pull Latest Changes**:
   ```bash
   git pull origin main
   npm install
   npm run build
   ```

2. **Run Migrations**:
   ```bash
   npm run db:push
   ```

3. **Restart Application**:
   ```bash
   # VPS with PM2
   pm2 restart lockerroom
   
   # Most platforms auto-restart on deploy
   ```

## Troubleshooting

### Common Issues

#### Database Connection Errors

```bash
# Verify connection string
psql $DATABASE_URL

# Check network connectivity
ping your-database-host

# Verify credentials
```

#### Application Won't Start

```bash
# Check logs
pm2 logs lockerroom  # VPS
# Or platform logs

# Verify environment variables
env | grep DATABASE_URL

# Check port availability
netstat -tulpn | grep 5174
```

#### Build Failures

```bash
# Clear cache
rm -rf node_modules package-lock.json
npm install

# Check Node.js version
node --version  # Should be 18+

# Verify build script
npm run build
```

#### Performance Issues

- **Enable Compression**: Already configured in Express
- **Database Indexing**: Review and add indexes
- **CDN for Static Assets**: Use Cloudinary CDN
- **Caching**: Implement Redis for session storage (optional)

### Rollback Strategy

#### Vercel/Railway/Render

- **Deploy Previous Version**: Use platform rollback feature
- **Git Rollback**: Revert commit and redeploy

#### VPS

```bash
# Keep previous build
cp -r dist dist.backup

# Restore previous version
git checkout previous-commit-hash
npm install
npm run build
pm2 restart lockerroom
```

### Support Resources

- **Platform Documentation**: Refer to platform-specific docs
- **Application Logs**: Check logs for error messages
- **Database Logs**: Check PostgreSQL logs
- **GitHub Issues**: Search or create issue

## Security Checklist

- ✅ **HTTPS Enabled**: SSL/TLS certificates configured
- ✅ **Environment Variables**: Not committed to repository
- ✅ **Secrets Rotation**: Regular secret updates
- ✅ **Database Security**: Secure credentials, network restrictions
- ✅ **Rate Limiting**: Configured on authentication endpoints
- ✅ **CORS Configuration**: Properly configured
- ✅ **Security Headers**: Helmet.js configured
- ✅ **Input Validation**: Zod validation on all inputs
- ✅ **SQL Injection Protection**: Using Drizzle ORM
- ✅ **XSS Protection**: React escaping and input sanitization

---

**Deployment Complete! 🚀**

For additional support, refer to platform-specific documentation or contact the development team.

