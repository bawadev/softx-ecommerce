# Ecom - Dokploy Deployment Guide

This guide provides step-by-step instructions for deploying Ecom to Dokploy.

## 🎯 Prerequisites

Before you begin, ensure you have:

- ✅ Dokploy server access
- ✅ GitHub repository access
- ✅ Neo4j and MinIO services configured in Dokploy (or ready to configure)

## 📋 Deployment Checklist

### Phase 1: Infrastructure Setup

#### 1.1 Deploy Neo4j Database

If not already deployed, create a Neo4j service in Dokploy:

1. **Create New Service** → Database → Neo4j
2. **Configuration:**
   - Name: `softx-ecommerce-neo4j`
   - Version: `5.26` (or latest 5.x)
   - Username: `neo4j`
   - Password: `[SECURE_PASSWORD]` (save this!)
   - Exposed Ports:
     - `7687` (Bolt protocol - for app connection)
     - `7474` (Browser UI - optional, for debugging)

3. **Resource Limits:**
   - Memory: At least 512MB (1GB recommended)
   - CPU: 0.5 cores minimum

4. **Persistence:**
   - Ensure volumes are configured for `/data` directory
   - This preserves your database across restarts

#### 1.2 Deploy MinIO Object Storage

If not already deployed, create a MinIO service:

1. **Create New Service** → Application → MinIO
2. **Configuration:**
   - Name: `softx-ecommerce-minio`
   - Access Key: `ecommerce` (or your custom key)
   - Secret Key: `[SECURE_PASSWORD]` (save this!)
   - Exposed Ports:
     - `9000` (API - REQUIRED for images)
     - `9001` (Console - optional, for management)

3. **Resource Limits:**
   - Memory: At least 256MB
   - CPU: 0.5 cores minimum

4. **Persistence:**
   - Ensure volumes are configured for `/data` directory

### Phase 2: Application Deployment

#### 2.1 Create New Application in Dokploy

1. Go to Dokploy Dashboard → **Create New Project** (if needed)
2. Create **New Application**
3. **Source Configuration:**
   - Type: `GitHub`
   - Repository: `bawaDev/softx-ecommerce` (or your fork)
   - Branch: `master`
   - Build Type: `nixpacks` (auto-detected for Next.js)

#### 2.2 Configure Environment Variables

In the application settings, add these environment variables:

```env
# Neo4j Database (use internal service name)
NEO4J_URI=neo4j://softx-ecommerce-neo4j:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=[YOUR_NEO4J_PASSWORD]

# JWT Secret (generate with: openssl rand -base64 32)
JWT_SECRET=[YOUR_SECURE_JWT_SECRET]

# MinIO Storage (internal service name)
MINIO_ENDPOINT=softx-ecommerce-minio
MINIO_PORT=9000
MINIO_ACCESS_KEY=ecommerce
MINIO_SECRET_KEY=[YOUR_MINIO_SECRET_KEY]
MINIO_BUCKET_NAME=product-images
MINIO_USE_SSL=false

# Public URLs (use your domain or server IP)
NEXT_PUBLIC_MINIO_URL=http://YOUR_SERVER_IP:9000
NEXT_PUBLIC_APP_URL=http://YOUR_SERVER_IP:3000

# Application
NODE_ENV=production
```

**Important Notes:**
- Replace `[YOUR_NEO4J_PASSWORD]` with your Neo4j password
- Replace `[YOUR_SECURE_JWT_SECRET]` with a strong random string
- Replace `[YOUR_MINIO_SECRET_KEY]` with your MinIO secret
- Update IP addresses if using a custom domain

#### 2.3 Configure Build Settings

Dokploy should auto-detect Next.js, but verify:

- **Build Command:** `npm install && npm run build`
- **Start Command:** `npm start`
- **Port:** `3000`

#### 2.4 Configure Port Mapping

Expose the application:

- **Container Port:** `3000`
- **Public Port:** `3000` (or your preferred port)

### Phase 3: Database Initialization

After the first successful deployment, initialize the database:

#### 3.1 SSH into Your Dokploy Server

```bash
ssh root@YOUR_SERVER_IP
```

#### 3.2 Find Your Application Container

```bash
# List all running containers
docker ps

# Find your Ecom container (look for the image name)
# It will be something like: dokploy-softx-ecommerce-xxx
```

#### 3.3 Run Initialization Script

```bash
# Execute initialization script inside the container
docker exec -it [CONTAINER_NAME] /bin/bash

# Inside the container:
./deploy-init.sh

# Or run commands manually:
npm run db:init
npm run db:seed
npm run setup:categories
npm run minio:init
```

#### 3.4 Alternative: Run from Dokploy Console

If Dokploy provides a console/terminal for your app:

1. Open your application in Dokploy
2. Go to **Console** or **Terminal**
3. Run: `./deploy-init.sh`

### Phase 4: Verify Deployment

#### 4.1 Check Application Health

Visit your application: `http://YOUR_SERVER_IP:3000`

You should see the Ecom homepage.

#### 4.2 Test Login

Try logging in with the default admin account:

- Email: `testadmin@ecommerce.com`
- Password: `Admin123!`

#### 4.3 Verify Services

**Neo4j Browser** (if port 7474 is exposed):
- URL: `http://YOUR_SERVER_IP:7474`
- Login: `neo4j` / `[YOUR_PASSWORD]`
- Run: `MATCH (n) RETURN count(n)` (should show nodes)

**MinIO Console** (if port 9001 is exposed):
- URL: `http://YOUR_SERVER_IP:9001`
- Login: Your MinIO access key / secret key
- Check: `product-images` bucket exists

#### 4.4 Test Image Upload

1. Login as admin
2. Go to Products → Add Product
3. Upload an image
4. Verify the image displays correctly

### Phase 5: Post-Deployment Security

#### 5.1 Change Default Passwords

**IMPORTANT:** Change all default passwords immediately!

1. Login as `testadmin@ecommerce.com`
2. Go to Profile → Change Password
3. Update to a strong password

Or create a new admin account and delete the default one.

#### 5.2 Secure Environment Variables

- Ensure `JWT_SECRET` is a strong random value
- Verify Neo4j and MinIO passwords are secure
- Review all environment variables

#### 5.3 Configure Domain (Optional)

If using a custom domain:

1. Point your domain to your server IP
2. Update environment variables:
   - `NEXT_PUBLIC_APP_URL=https://yourdomain.com`
   - `NEXT_PUBLIC_MINIO_URL=https://storage.yourdomain.com`
3. Configure SSL/TLS in Dokploy
4. Redeploy the application

## 🔄 Deploying Changes from Local to Production

This section covers the complete workflow for deploying code changes from your local development environment to production.

### Development Workflow

#### Step 1: Make Changes Locally

```bash
# Start local development environment
./setup.sh start          # Starts Neo4j, MinIO, and Next.js
# OR
npm run dev              # If services already running

# Make your code changes in your editor
# Test thoroughly in local environment
```

#### Step 2: Test Your Changes

Before deploying to production, ensure everything works locally:

```bash
# Run linting
npm run lint

# Build the application to catch build errors
npm run build

# Test the production build locally (optional)
npm start
```

**Important:** Always test your changes locally before deploying to production.

#### Step 3: Commit Your Changes

```bash
# Check which files changed
git status

# Stage your changes
git add .
# OR stage specific files
git add src/app/[locale]/HomePageClient.tsx

# Commit with a descriptive message
git commit -m "feat: add new product filtering feature"
# OR for bug fixes
git commit -m "fix: resolve hero slider navigation issue"
# OR for refactoring
git commit -m "refactor: remove navigation arrows from hero section"
```

**Commit Message Guidelines:**
- `feat:` - New features
- `fix:` - Bug fixes
- `refactor:` - Code restructuring without changing functionality
- `style:` - UI/styling changes
- `docs:` - Documentation updates
- `chore:` - Maintenance tasks

#### Step 4: Push to GitHub

```bash
# Push to the master branch
git push origin master

# Verify push was successful
git status
```

**Note:** Pushing to GitHub is the trigger for Dokploy deployment.

#### Step 5: Deploy to Production

You have two options for deployment:

**Option A: Automatic Deployment (Recommended)**

If auto-deploy is enabled in Dokploy (default):

1. Dokploy automatically detects the push to GitHub
2. Deployment starts within 30-60 seconds
3. You'll see a new deployment appear in Dokploy dashboard
4. Monitor the deployment progress in the Deployments tab

**Option B: Manual Deployment**

If auto-deploy is disabled or you want manual control:

1. Go to your Dokploy dashboard: `http://YOUR_SERVER_IP:3000`
2. Navigate to: **Projects** → **Ecom** → **Application**
3. Click the **Deployments** tab
4. Click the **Deploy** button (top right)
5. Confirm the deployment

#### Step 6: Monitor Deployment

```bash
# Watch deployment progress in Dokploy UI:
# - Click on your application
# - Go to Deployments tab
# - Click on the latest deployment to see logs

# OR monitor via SSH:
ssh root@YOUR_SERVER_IP
docker logs -f [CONTAINER_NAME]
```

**Typical Deployment Timeline:**
- **Build Phase:** 1-3 minutes (Nixpacks builds Next.js app)
- **Deploy Phase:** 30-60 seconds (Container restart)
- **Total Time:** ~2-4 minutes for most changes

**Deployment Status Indicators:**
- 🟡 **Running** - Deployment in progress
- 🟢 **Done** - Deployment successful
- 🔴 **Error** - Deployment failed (check logs)

#### Step 7: Verify Production Changes

After deployment completes:

1. **Visit Your Production Site:**
   ```
   http://YOUR_DOMAIN
   # OR
   http://YOUR_SERVER_IP:3000
   ```

2. **Test Your Changes:**
   - Navigate to the pages you modified
   - Test the functionality you added/changed
   - Check browser console for any errors
   - Verify images and assets load correctly

3. **Check Application Logs (if issues occur):**
   ```bash
   # In Dokploy dashboard
   Application → Logs → View Real-time Logs

   # OR via SSH
   docker logs [CONTAINER_NAME] --tail 100
   ```

### Common Deployment Scenarios

#### Scenario 1: UI Changes Only

For frontend-only changes (components, styles, client logic):

```bash
git add src/components/
git commit -m "style: update hero section design"
git push origin master
# Wait for auto-deploy (~2-3 min)
# Verify changes in browser (hard refresh: Ctrl+Shift+R)
```

#### Scenario 2: Server Action / API Changes

For backend changes (server actions, repositories, database queries):

```bash
git add src/app/actions/ src/lib/repositories/
git commit -m "feat: add product search functionality"
git push origin master
# Wait for deployment
# Test API functionality thoroughly
```

#### Scenario 3: Database Schema Changes

For changes requiring database updates:

```bash
# 1. Update schema locally
git add src/lib/schema.ts src/lib/repositories/
git commit -m "feat: add promotional categories schema"
git push origin master

# 2. Wait for deployment to complete

# 3. SSH into server and run migrations
ssh root@YOUR_SERVER_IP
docker exec -it [CONTAINER_NAME] npm run db:init
```

#### Scenario 4: Environment Variable Changes

If you need to update environment variables:

```bash
# 1. Update code if needed
git commit -am "feat: add email notification feature"
git push origin master

# 2. Update environment variables in Dokploy
# - Go to Application → Settings → Environment
# - Add/update variables
# - Click Save

# 3. Redeploy (restart required for env changes)
# - Click Deploy button in Dokploy
```

### Rollback Procedure

If a deployment causes issues:

**Option 1: Revert Git Commit**

```bash
# Revert to previous commit
git revert HEAD
git push origin master
# Auto-deploy will deploy the reverted version
```

**Option 2: Deploy Previous Version via Dokploy**

1. Go to Deployments tab in Dokploy
2. Find the last successful deployment
3. Click **Redeploy** on that deployment

**Option 3: Manual Rollback**

```bash
# SSH into server
ssh root@YOUR_SERVER_IP

# Restart container to previous image
docker ps -a | grep ecommerce
docker restart [CONTAINER_NAME]
```

### Deployment Best Practices

1. ✅ **Always test locally first** - Run `npm run build` before pushing
2. ✅ **Commit frequently** - Small, focused commits are easier to debug
3. ✅ **Write clear commit messages** - Helps track what changed
4. ✅ **Monitor deployments** - Don't assume it worked, verify it
5. ✅ **Test after deployment** - Always verify changes on production
6. ✅ **Deploy during low-traffic times** - Minimize user impact
7. ✅ **Keep dependencies updated** - Run `npm update` periodically
8. ✅ **Backup before major changes** - See backup commands below

### Data Persistence During Deployments

**What is preserved:**
- ✅ Neo4j database data (users, products, orders)
- ✅ MinIO uploaded images
- ✅ Environment variables
- ✅ Docker volumes

**What is rebuilt:**
- 🔄 Application code
- 🔄 Node modules
- 🔄 Next.js build cache
- 🔄 Container image

**Important:** User data and uploaded content are never lost during deployments.

### Quick Reference Commands

```bash
# Complete deployment workflow
git status                          # Check changes
npm run lint                        # Verify code quality
npm run build                       # Test build
git add .                           # Stage changes
git commit -m "feat: description"   # Commit
git push origin master              # Deploy to production

# Check deployment status
ssh root@YOUR_SERVER_IP
docker ps | grep ecommerce        # Check if running
docker logs [CONTAINER_NAME] -f     # Watch logs

# Emergency rollback
git revert HEAD && git push origin master
```

## 🐛 Troubleshooting

### Application Won't Start

**Check logs in Dokploy:**
- Application logs
- Build logs
- Container logs

**Common issues:**
- Missing environment variables
- Neo4j not accessible
- Port conflicts

### Database Connection Errors

**Verify Neo4j service:**
```bash
docker ps | grep neo4j
docker logs softx-ecommerce-neo4j
```

**Test connection:**
```bash
docker exec -it [APP_CONTAINER] npm run db:init
```

### Image Upload Fails

**Verify MinIO:**
```bash
docker ps | grep minio
docker logs softx-ecommerce-minio
```

**Check bucket:**
```bash
docker exec -it [APP_CONTAINER] npm run minio:init
```

### Application Shows 502/503 Error

**Check if app is running:**
```bash
docker ps | grep ecommerce
docker logs [CONTAINER_NAME]
```

**Verify port mapping in Dokploy:**
- Container port: 3000
- Public port: 3000

## 📚 Useful Commands

### View Application Logs
```bash
# In Dokploy: Click on your app → Logs

# Or via SSH:
docker logs -f [CONTAINER_NAME]
```

### Restart Application
```bash
# In Dokploy: Click on your app → Restart

# Or via SSH:
docker restart [CONTAINER_NAME]
```

### Backup Database
```bash
# SSH into server
ssh root@YOUR_SERVER_IP

# Backup Neo4j
docker run --rm \
  --volumes-from softx-ecommerce-neo4j \
  -v $(pwd)/backups:/backup \
  ubuntu tar czf /backup/neo4j-backup-$(date +%Y%m%d).tar.gz /data

# Backup MinIO
docker run --rm \
  --volumes-from softx-ecommerce-minio \
  -v $(pwd)/backups:/backup \
  ubuntu tar czf /backup/minio-backup-$(date +%Y%m%d).tar.gz /data
```

### Access Application Shell
```bash
docker exec -it [CONTAINER_NAME] /bin/bash
```

## 🔐 Credentials Reference

### Server Access
- **IP:** [Your server IP]
- **SSH User:** root
- **SSH Password:** [Stored securely - not in git]

### Dokploy Dashboard
- **URL:** [Your Dokploy URL]
- **Username:** [Your Dokploy email]
- **Password:** [Stored securely - not in git]

### GitHub
- **Username:** [Your GitHub username]
- **PAT:** [Stored securely - not in git]

### Default Application Accounts (After Seeding)
- **Admin:** testadmin@ecommerce.com / Admin123!
- **Customer:** test@example.com / Customer123!

**⚠️ SECURITY WARNING:** Change these credentials in production!

## 📞 Support

For issues:
1. Check Dokploy application logs
2. Review this guide's troubleshooting section
3. Check Docker container logs
4. Verify environment variables
5. Ensure Neo4j and MinIO services are running

## ✅ Deployment Success Checklist

- [ ] Neo4j service running and accessible
- [ ] MinIO service running and accessible
- [ ] Application deployed and running
- [ ] Environment variables configured correctly
- [ ] Database initialized (`db:init`)
- [ ] Test users seeded (`db:seed`)
- [ ] Categories setup (`setup:categories`)
- [ ] MinIO bucket created (`minio:init`)
- [ ] Can access homepage
- [ ] Can login with admin account
- [ ] Can upload product images
- [ ] Default passwords changed
- [ ] Backups configured (optional)
- [ ] Domain configured (optional)

---

**Ecom** - Deployed with Dokploy 🚀
