# AWS Amplify Deployment Guide

Complete guide to deploy this Vite + React application to AWS Amplify with automatic Git-based deployments.

## 📋 Prerequisites

- AWS Account (create at https://aws.amazon.com)
- GitHub repository connected (already set up: `Ifthikar20/playstudy-card-dash`)
- AWS CLI installed (optional, for advanced setup)

## 💰 Estimated Costs

**Free Tier (First 12 months):**
- 1,000 build minutes/month
- 15 GB storage
- 5 GB data transfer/month

**After Free Tier:**
- Build: $0.01/minute (~$1-5/month for typical usage)
- Storage: $0.023/GB/month (~$0.01-0.50/month)
- Data served: $0.15/GB (~$1-10/month depending on traffic)

**Expected Total: $5-15/month** for moderate traffic

## 🚀 Deployment Methods

### Method 1: Amplify Console (Recommended - Easiest)

This method uses the AWS Amplify Console web interface for deployment.

#### Step 1: Access Amplify Console

1. Go to https://console.aws.amazon.com/amplify/
2. Sign in with your AWS account
3. Click **"New app"** → **"Host web app"**

#### Step 2: Connect GitHub Repository

1. Select **GitHub** as your Git provider
2. Click **"Continue"**
3. Authorize AWS Amplify to access your GitHub account
4. Select:
   - **Repository**: `Ifthikar20/playstudy-card-dash`
   - **Branch**: `main` (or your preferred branch)
5. Click **"Next"**

#### Step 3: Configure Build Settings

The build settings should be auto-detected from `amplify.yml`:

```yaml
version: 1
frontend:
  phases:
    preBuild:
      commands:
        - npm ci
    build:
      commands:
        - npm run build
  artifacts:
    baseDirectory: dist
    files:
      - '**/*'
  cache:
    paths:
      - node_modules/**/*
```

✅ **Verify these settings:**
- Build command: `npm run build`
- Output directory: `dist`
- Node version: Latest (or specify 18.x if needed)

Click **"Next"**

#### Step 4: Review and Deploy

1. Review all settings
2. Click **"Save and deploy"**
3. Wait 3-5 minutes for initial deployment

#### Step 5: Access Your App

Once deployed, you'll get:
- **Amplify URL**: `https://main.xxxxx.amplifyapp.com`
- **Custom domain** (optional): Can be configured in settings

### Method 2: Amplify CLI (Advanced)

For developers who prefer command-line setup.

#### Step 1: Install Amplify CLI

```bash
npm install -g @aws-amplify/cli
```

#### Step 2: Configure Amplify

```bash
amplify configure
```

Follow the prompts:
1. Sign in to AWS Console (opens browser)
2. Create IAM user with AdministratorAccess-Amplify policy
3. Copy Access Key ID and Secret Access Key
4. Enter them in the CLI

#### Step 3: Initialize Amplify

```bash
cd /path/to/playstudy-card-dash
amplify init
```

Configuration:
```
? Enter a name for the project: playstudy-card-dash
? Enter a name for the environment: prod
? Choose your default editor: Visual Studio Code
? Choose the type of app: javascript
? What javascript framework are you using: react
? Source Directory Path: src
? Distribution Directory Path: dist
? Build Command: npm run build
? Start Command: npm run dev
? Do you want to use an AWS profile? Yes
? Please choose the profile: default
```

#### Step 4: Add Hosting

```bash
amplify add hosting
```

Select:
```
? Select the plugin module to execute: Hosting with Amplify Console
? Choose a type: Continuous deployment (Git-based deployments)
```

This opens Amplify Console in your browser to connect GitHub.

#### Step 5: Publish

```bash
amplify publish
```

This will:
1. Build your app locally
2. Deploy to Amplify
3. Set up continuous deployment from GitHub

## 🔄 Continuous Deployment

Once set up, **every git push automatically triggers a deployment**:

```bash
# Make changes to your code
git add .
git commit -m "Update feature"
git push origin main
```

Amplify will:
1. Detect the push
2. Run build process (`npm ci` → `npm run build`)
3. Deploy to production
4. Update your live site in 3-5 minutes

## 🛠️ Build Settings Explained

The `amplify.yml` file controls how your app is built:

```yaml
version: 1
frontend:
  phases:
    # Phase 1: Install dependencies
    preBuild:
      commands:
        - npm ci  # Clean install (faster than npm install)

    # Phase 2: Build the app
    build:
      commands:
        - npm run build  # Runs Vite build

  # Output configuration
  artifacts:
    baseDirectory: dist  # Vite output directory
    files:
      - '**/*'  # Deploy all files in dist/

  # Cache for faster builds
  cache:
    paths:
      - node_modules/**/*  # Cache dependencies
```

## 🌍 Custom Domain Setup (Optional)

### Add Custom Domain

1. Go to **Amplify Console** → Your App → **Domain management**
2. Click **"Add domain"**
3. Enter your domain (e.g., `playstudy.com`)
4. Follow DNS setup instructions
5. Wait for SSL certificate provisioning (5-15 minutes)

### DNS Configuration

For Route 53 (automatic):
- Amplify configures DNS automatically

For other providers (GoDaddy, Namecheap, etc.):
```
Type: CNAME
Name: www
Value: [provided by Amplify]

Type: A
Name: @
Value: [provided by Amplify]
```

## 🔧 Environment Variables

If you need environment variables (API keys, etc.):

### In Amplify Console:

1. Go to **App settings** → **Environment variables**
2. Click **"Manage variables"**
3. Add variables:
   ```
   VITE_API_URL=https://api.yourbackend.com
   VITE_ENVIRONMENT=production
   ```

### In Code:

Access variables with `import.meta.env`:
```typescript
const apiUrl = import.meta.env.VITE_API_URL;
```

**Important:** Prefix with `VITE_` for Vite apps!

## 📊 Monitoring & Logs

### View Build Logs

1. Go to Amplify Console → Your App
2. Click on a deployment
3. View detailed build logs

### Access Logs

Amplify automatically captures:
- Build logs
- Deployment status
- Performance metrics

## 🚨 Troubleshooting

### Build Fails with "npm ERR!"

**Solution:** Check Node version compatibility
```yaml
# Add to amplify.yml under preBuild
- nvm install 18
- nvm use 18
```

### "Module not found" Errors

**Solution:** Clear cache and rebuild
1. In Amplify Console → App settings → Build settings
2. Click **"Edit"**
3. Clear build cache
4. Redeploy

### Large Build Times (>5 minutes)

**Solution:** Optimize dependencies
```bash
# Remove unused dependencies
npm prune

# Check bundle size
npm run build -- --report
```

### 404 Errors on Client-Side Routes

**Solution:** Add redirects for SPA routing

In `amplify.yml`, add:
```yaml
frontend:
  # ... existing config ...
  customHeaders:
    - pattern: '**/*'
      headers:
        - key: 'X-Frame-Options'
          value: 'SAMEORIGIN'
```

And in Amplify Console:
1. Go to **App settings** → **Rewrites and redirects**
2. Add rule:
   ```
   Source: </^[^.]+$|\.(?!(css|gif|ico|jpg|js|png|txt|svg|woff|ttf|map|json)$)([^.]+$)/>
   Target: /index.html
   Type: 200 (Rewrite)
   ```

## 🔐 Security Best Practices

1. **Enable HTTPS** (automatic with Amplify)
2. **Set security headers** in `amplify.yml`:
   ```yaml
   customHeaders:
     - pattern: '**/*'
       headers:
         - key: 'Strict-Transport-Security'
           value: 'max-age=31536000; includeSubDomains'
         - key: 'X-Content-Type-Options'
           value: 'nosniff'
   ```
3. **Use environment variables** for sensitive data (never commit API keys)
4. **Enable access logs** in Amplify settings

## 📈 Performance Optimization

### Enable Compression

Amplify automatically enables:
- Gzip compression
- Brotli compression
- CDN caching

### Optimize Build

```bash
# Production build with minification
npm run build

# Analyze bundle size
npm install -D vite-bundle-visualizer
```

Add to `vite.config.ts`:
```typescript
import { visualizer } from 'vite-bundle-visualizer';

export default defineConfig({
  plugins: [
    react(),
    visualizer() // Generate stats.html
  ]
});
```

## 💡 Tips & Best Practices

1. **Branch Deployments**: Deploy different branches to different URLs
   - `main` → production (`https://main.xxxxx.amplifyapp.com`)
   - `develop` → staging (`https://develop.xxxxx.amplifyapp.com`)

2. **Preview Deployments**: Amplify creates preview URLs for pull requests

3. **Rollback**: Easy rollback to previous deployments in Console

4. **Notifications**: Set up email/Slack notifications for build status

## 🔗 Useful Links

- [AWS Amplify Console](https://console.aws.amazon.com/amplify/)
- [Amplify Documentation](https://docs.amplify.aws/)
- [Amplify Pricing](https://aws.amazon.com/amplify/pricing/)
- [Your GitHub Repo](https://github.com/Ifthikar20/playstudy-card-dash)

## 📝 Quick Reference Commands

```bash
# Install Amplify CLI
npm install -g @aws-amplify/cli

# Configure Amplify
amplify configure

# Initialize project
amplify init

# Add hosting
amplify add hosting

# Publish app
amplify publish

# Check status
amplify status

# View app in browser
amplify console
```

## 🎯 Next Steps After Deployment

1. ✅ Set up custom domain (optional)
2. ✅ Configure environment variables
3. ✅ Set up branch deployments for staging
4. ✅ Enable email notifications for builds
5. ✅ Monitor performance and costs
6. ✅ Connect backend API (when ready)

---

**Need Help?** Check [AWS Amplify Support](https://aws.amazon.com/amplify/resources/) or create an issue in the GitHub repo.
