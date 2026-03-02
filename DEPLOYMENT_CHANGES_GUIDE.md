# Ecom - Deployment Changes Guide

This guide covers all methods for deploying code changes to your Ecom production environment.

## 📋 Table of Contents

- [Prerequisites](#prerequisites)
- [Method 1: Automatic Deployment (GitHub Webhook)](#method-1-automatic-deployment-github-webhook)
- [Method 2: Manual Deployment via Dokploy UI](#method-2-manual-deployment-via-dokploy-ui)
- [Method 3: Command Line Deployment](#method-3-command-line-deployment)
- [Method 4: Automated Deployment with Playwright](#method-4-automated-deployment-with-playwright)
- [Monitoring Deployments](#monitoring-deployments)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before deploying, ensure you have:

- ✅ Access to the Dokploy dashboard
- ✅ GitHub repository access (for automatic deployments)
- ✅ SSH access to the server (for CLI deployments)
- ✅ All changes committed and pushed to GitHub

### Important Credentials

```bash
# Server Access
DEV_SERVER_IP=62.171.137.117
DEV_SERVER_PASSWORD=<stored-securely>

# GitHub
GITHUB_USERNAME=bawaDev
GITHUB_PAT=<stored-securely>

# Dokploy Dashboard
DOKPLOY_URL=http://62.171.137.117:3000/
DOKPLOY_USERNAME=inbox.bawantha@gmail.com
DOKPLOY_PASSWORD=<stored-securely>

# Webhook URL (for manual triggers)
WEBHOOK_URL=http://62.171.137.117:3000/api/deploy/i4eKS6RBJFkmAo_vFc3Iw
```

---

## Method 1: Automatic Deployment (GitHub Webhook) ⭐ RECOMMENDED

**Status: ✅ CONFIGURED AND ACTIVE**

This is the easiest and most reliable method. Every push to the `master` branch automatically triggers a deployment.

### How It Works

1. **Make your code changes locally**
   ```bash
   # Edit your files
   code src/components/YourComponent.tsx
   ```

2. **Test locally**
   ```bash
   ./setup.sh start    # Start local environment
   npm run lint        # Check for errors
   npm run build       # Verify build works
   ```

3. **Commit and push**
   ```bash
   git add .
   git commit -m "feat: your feature description"
   git push origin master
   ```

4. **Automatic deployment begins!**
   - GitHub webhook triggers Dokploy
   - Dokploy pulls latest code
   - Builds new Docker image
   - Deploys new container
   - Takes ~2-3 minutes

### Webhook Configuration

The webhook is already configured with:
- **URL:** `http://62.171.137.117:3000/api/deploy/i4eKS6RBJFkmAo_vFc3Iw`
- **Events:** Push to master branch
- **Content-Type:** application/json

To verify or modify webhook settings:
```bash
# List webhooks
curl -H "Authorization: token YOUR_GITHUB_PAT" \
  https://api.github.com/repos/bawaDev/softx-ecommerce/hooks

# Test webhook
curl -H "Authorization: token YOUR_GITHUB_PAT" \
  -X POST \
  https://api.github.com/repos/bawaDev/softx-ecommerce/hooks/579868469/test
```

---

## Method 2: Manual Deployment via Dokploy UI

Use this method when you want more control over deployment timing.

### Step-by-Step Process

1. **Access Dokploy Dashboard**
   - Navigate to: http://62.171.137.117:3000/
   - Login with your credentials

2. **Navigate to Ecom App**
   - Click on "Ecom" project
   - Click on "Ecom App" service

3. **Trigger Deployment**
   - In the "General" tab, click the **"Deploy"** button
   - Confirm the deployment when prompted

4. **Monitor Progress**
   - Click on "Deployments" tab
   - Click "View" on the running deployment
   - Watch the build logs in real-time

### Using Playwright MCP (Automated UI)

```javascript
// Example automation script
await page.goto('http://62.171.137.117:3000/');
await page.getByRole('link', { name: 'Ecom' }).click();
await page.locator('.rounded-lg').first().click(); // Ecom App
await page.getByRole('button', { name: 'Deploy' }).click();
await page.getByRole('button', { name: 'Confirm' }).click();
```

---

## Method 3: Command Line Deployment

Use this for scripted deployments or when UI access is limited.

### Option A: Trigger Webhook via cURL

```bash
# Trigger deployment via webhook
curl -X POST http://62.171.137.117:3000/api/deploy/i4eKS6RBJFkmAo_vFc3Iw
```

### Option B: SSH Direct Deployment

```bash
# SSH into server
ssh root@62.171.137.117

# Navigate to application code
cd /etc/dokploy/applications/softx-ecommerce-app-i61kg8/code

# Pull latest code
git pull origin master

# Build new Docker image (from Dokploy container)
docker exec dokploy.1.u9slww8giihlpwz82qbe6x8i3 \
  nixpacks build /etc/dokploy/applications/softx-ecommerce-app-i61kg8/code \
  --name softx-ecommerce-app-i61kg8

# Update the service
docker service update --image softx-ecommerce-app-i61kg8:latest htrdmado8qtz
```

### Option C: Docker Service Update

```bash
# Force service restart with latest image
ssh root@62.171.137.117 "docker service update --force htrdmado8qtz"
```

---

## Method 4: Automated Deployment with Playwright

This method uses Playwright MCP in Claude for fully automated deployments.

### Setup

```bash
# Ensure Playwright MCP is available in Claude
# The browser tools will appear in the tool list
```

### Deployment Script

```javascript
// 1. Navigate to Dokploy
await mcp.browser.navigate({
  url: "http://62.171.137.117:3000/"
});

// 2. Navigate to Ecom App
await mcp.browser.click({
  element: "Ecom project",
  ref: "project_link"
});

await mcp.browser.click({
  element: "Ecom App service",
  ref: "app_service"
});

// 3. Deploy
await mcp.browser.click({
  element: "Deploy button",
  ref: "deploy_btn"
});

await mcp.browser.click({
  element: "Confirm",
  ref: "confirm_btn"
});

// 4. Monitor
await mcp.browser.click({
  element: "Deployments tab",
  ref: "deployments_tab"
});

await mcp.browser.click({
  element: "View deployment",
  ref: "view_btn"
});
```

---

## Monitoring Deployments

### Real-time Logs

1. **Via Dokploy UI**
   - Navigate to your app → Deployments tab
   - Click "View" on any deployment
   - Shows complete build and deployment logs

2. **Via SSH**
   ```bash
   # Watch container logs
   ssh root@62.171.137.117 "docker logs -f softx-ecommerce-app-i61kg8.1.CONTAINER_ID"

   # Check service status
   ssh root@62.171.137.117 "docker service ps htrdmado8qtz"
   ```

3. **Via Docker**
   ```bash
   # List recent deployments
   docker service ps htrdmado8qtz --no-trunc

   # Check deployment health
   docker service inspect htrdmado8qtz --pretty
   ```

### Typical Deployment Timeline

- **Code pull:** ~5-10 seconds
- **npm install:** ~30-40 seconds
- **Next.js build:** ~60-80 seconds
- **Image creation:** ~20-30 seconds
- **Container restart:** ~10-20 seconds
- **Total:** ~2-3 minutes

---

## Deployment Workflow Examples

### Example 1: Quick Feature Update

```bash
# 1. Make changes
vim src/components/Navigation.tsx

# 2. Test locally
npm run dev
# Test in browser

# 3. Commit and deploy
git add .
git commit -m "fix: update navigation logo"
git push origin master

# 4. Verify deployment (after ~3 minutes)
curl http://62.171.137.117:3000/
```

### Example 2: Database Schema Change

```bash
# 1. Update schema
vim src/lib/schema.ts

# 2. Test locally
npm run db:init

# 3. Deploy code
git add .
git commit -m "feat: add new user fields"
git push origin master

# 4. Wait for deployment
sleep 180

# 5. Run migration on server
ssh root@62.171.137.117
docker exec softx-ecommerce-app-i61kg8.1.XXX npm run db:init
```

### Example 3: Emergency Rollback

```bash
# Option 1: Revert commit
git revert HEAD
git push origin master

# Option 2: Deploy previous image
ssh root@62.171.137.117
docker service update --rollback htrdmado8qtz

# Option 3: Manual rollback in Dokploy
# Go to Deployments → Find previous successful deployment → Click "Redeploy"
```

---

## Troubleshooting

### Deployment Not Triggering

1. **Check webhook delivery**
   ```bash
   # View recent webhook deliveries
   curl -H "Authorization: token YOUR_GITHUB_PAT" \
     https://api.github.com/repos/bawaDev/softx-ecommerce/hooks/579868469/deliveries
   ```

2. **Test webhook manually**
   ```bash
   curl -X POST http://62.171.137.117:3000/api/deploy/i4eKS6RBJFkmAo_vFc3Iw
   ```

3. **Check Dokploy auto-deploy setting**
   - Go to app settings in Dokploy
   - Ensure "Autodeploy" toggle is ON

### Build Failures

1. **Check build logs**
   - Dokploy → Ecom App → Deployments → View

2. **Common issues:**
   - **Out of memory:** Container needs more resources
   - **npm install fails:** Clear npm cache
   - **Build timeout:** Increase timeout in Dokploy settings

3. **Fix locally first**
   ```bash
   npm run build  # Must succeed locally before deploying
   ```

### Container Won't Start

1. **Check environment variables**
   - All required env vars must be set in Dokploy
   - Verify database connection strings

2. **Check logs**
   ```bash
   ssh root@62.171.137.117
   docker logs softx-ecommerce-app-i61kg8.1.XXX --tail 100
   ```

3. **Verify services**
   ```bash
   # Check if Neo4j is running
   docker ps | grep neo4j

   # Check if MinIO is running
   docker ps | grep minio
   ```

---

## Best Practices

1. **Always test locally first**
   ```bash
   npm run lint
   npm run build
   npm run test
   ```

2. **Use meaningful commit messages**
   ```bash
   git commit -m "feat: add user authentication"
   git commit -m "fix: resolve cart calculation bug"
   git commit -m "docs: update deployment guide"
   ```

3. **Monitor after deployment**
   - Check application logs
   - Verify functionality
   - Test critical paths

4. **Keep deployments small**
   - Deploy frequently with small changes
   - Easier to debug issues
   - Faster rollbacks if needed

5. **Use feature branches for major changes**
   ```bash
   git checkout -b feature/new-payment-system
   # Work on feature
   git push origin feature/new-payment-system
   # Create PR and review before merging to master
   ```

---

## Quick Reference

### Essential Commands

```bash
# Check deployment status
curl http://62.171.137.117:3000/ -I

# View running containers
ssh root@62.171.137.117 "docker ps | grep ecommerce"

# Trigger deployment
curl -X POST http://62.171.137.117:3000/api/deploy/i4eKS6RBJFkmAo_vFc3Iw

# View logs
ssh root@62.171.137.117 "docker logs softx-ecommerce-app-i61kg8.1.XXX --tail 50"

# Restart service
ssh root@62.171.137.117 "docker service update --force htrdmado8qtz"
```

### Deployment Checklist

- [ ] Code changes tested locally
- [ ] `npm run build` succeeds
- [ ] Environment variables documented (if new)
- [ ] Database migrations prepared (if needed)
- [ ] Commit message is descriptive
- [ ] Pushed to correct branch (master)
- [ ] Deployment triggered (automatic or manual)
- [ ] Deployment logs checked
- [ ] Application verified working

---

## Support

For deployment issues:
1. Check this guide's troubleshooting section
2. Review Dokploy logs
3. Check Docker service status
4. Verify GitHub webhook deliveries
5. Ensure all services (Neo4j, MinIO) are running

---

**Last Updated:** November 8, 2024
**Webhook Status:** ✅ Active
**Auto-deploy:** ✅ Enabled
