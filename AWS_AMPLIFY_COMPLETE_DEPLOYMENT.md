# AWS Amplify Complete Deployment Guide - PlayStudy Card Dashboard

**🎯 Complete Step-by-Step Guide to Deploy Your Application to AWS Amplify**

This guide provides actionable steps to deploy your PlayStudy Card Dashboard to AWS Amplify, including frontend hosting and backend API integration.

---

## 📊 Deployment Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   Route53 (Optional)                         │
│              yourdomain.com / www.yourdomain.com            │
└────────────────────────┬────────────────────────────────────┘
                         │
                         │
                ┌────────▼────────────────┐
                │   AWS Amplify Hosting   │
                │   (React/Vite Frontend) │
                │   - Auto CDN            │
                │   - HTTPS/SSL           │
                │   - Global Edge         │
                └────────┬────────────────┘
                         │
                         │ HTTPS API Calls
                         │
         ┌───────────────┴────────────────┐
         │                                │
┌────────▼─────────┐          ┌──────────▼──────────┐
│  Backend Option 1│          │  Backend Option 2   │
│  AWS ECS/Fargate │          │  EC2 / External API │
│  (Full Backend)  │          │  (Your Backend)     │
│  + RDS + Redis   │          │                     │
└──────────────────┘          └─────────────────────┘
```

**What AWS Amplify Does:**
- ✅ Hosts your React frontend (static files)
- ✅ Provides global CDN for fast loading
- ✅ Automatic HTTPS/SSL certificates
- ✅ Git-based CI/CD (auto-deploy on push)
- ✅ Preview deployments for pull requests
- ✅ Custom domain support

**What You Need Separately:**
- 🔧 Backend API (ECS, EC2, Lambda, or external)
- 🔧 Database (RDS PostgreSQL)
- 🔧 Cache (ElastiCache Redis)

---

## ⚡ Quick Start (5 Minutes to Deploy)

### Prerequisites Checklist
- [ ] AWS account (create at https://aws.amazon.com)
- [ ] GitHub repository access (Ifthikar20/playstudy-card-dash)
- [ ] Git configured locally
- [ ] Code pushed to GitHub

### Fast Track Deployment

```bash
# 1. Ensure your code is pushed to GitHub
git status
git add .
git commit -m "Prepare for Amplify deployment"
git push origin main

# 2. Go to AWS Amplify Console
# https://console.aws.amazon.com/amplify/

# 3. Click "New app" → "Host web app"
# 4. Connect GitHub → Select your repo → Click "Save and deploy"

# Done! Your app will be live in 3-5 minutes
```

---

## 🚀 Detailed Step-by-Step Deployment

### Step 1: Prepare Your Repository

1. **Verify your amplify.yml configuration:**

```bash
cat amplify.yml
```

Should show:
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

✅ This is already configured in your repository!

2. **Push your latest changes:**

```bash
# On branch: claude/aws-ecs-deployment-guide-pWZhM
git add .
git commit -m "Ready for Amplify deployment"
git push -u origin claude/aws-ecs-deployment-guide-pWZhM
```

---

### Step 2: Deploy to AWS Amplify Console

#### 2.1: Access Amplify Console

1. Open your browser and go to: **https://console.aws.amazon.com/amplify/**
2. Sign in with your AWS account credentials
3. Click the **"Create new app"** button (or **"New app"** → **"Host web app"**)

#### 2.2: Connect GitHub Repository

1. **Select Git provider:**
   - Choose **"GitHub"**
   - Click **"Continue"**

2. **Authorize AWS Amplify:**
   - Click **"Authorize AWS Amplify"**
   - Sign in to GitHub if prompted
   - Grant access to your repositories

3. **Select Repository and Branch:**
   - **Repository:** `Ifthikar20/playstudy-card-dash`
   - **Branch:** `main` (or `claude/aws-ecs-deployment-guide-pWZhM` for testing)
   - ✅ Check **"Connecting a monorepo? Pick a folder"** if needed (leave unchecked for this project)
   - Click **"Next"**

#### 2.3: Configure Build Settings

AWS Amplify should auto-detect your build settings from `amplify.yml`.

**Verify these settings:**

```yaml
App name: playstudy-card-dash
Environment name: production (or dev/staging)
Build and test settings: [Auto-detected from amplify.yml]
```

**Advanced settings (expand if needed):**
- **Environment variables:** (We'll add these in Step 3)
- **Service role:** Create new role or use existing
- Click **"Next"**

#### 2.4: Review and Deploy

1. Review all settings:
   - ✅ Repository: `Ifthikar20/playstudy-card-dash`
   - ✅ Branch: `main`
   - ✅ Build command: `npm run build`
   - ✅ Output directory: `dist`

2. Click **"Save and deploy"**

3. **Wait for deployment** (3-5 minutes):
   - ⏳ Provision
   - ⏳ Build
   - ⏳ Deploy
   - ⏳ Verify
   - ✅ Completed

#### 2.5: Access Your Deployed App

Once deployment completes:
- Your app URL: `https://main.xxxxxxxxxxxxx.amplifyapp.com`
- Click the URL to view your live application!

---

### Step 3: Configure Environment Variables

Your frontend needs to know where your backend API is located.

#### 3.1: Add Environment Variables in Amplify

1. In Amplify Console, click on your app
2. Go to **"App settings"** → **"Environment variables"** (left sidebar)
3. Click **"Manage variables"**

#### 3.2: Add Required Variables

Add the following environment variables:

```bash
# Backend API URL (update with your actual backend URL)
VITE_API_URL=https://api.yourdomain.com/api

# Or if using ECS from the other guide:
VITE_API_URL=https://your-alb-dns-name.us-east-1.elb.amazonaws.com/api

# Environment
VITE_ENVIRONMENT=production

# Any other API keys your frontend needs
# (Never put secret keys here - only public ones that the browser can see)
```

**Important Notes:**
- ✅ All Vite environment variables **must** start with `VITE_`
- ✅ These are exposed to the browser (client-side only)
- ❌ **DO NOT** put secret API keys here
- ❌ **DO NOT** put database passwords here

4. Click **"Save"**
5. Redeploy your app: Click **"Redeploy this version"**

---

### Step 4: Set Up Backend API (Choose One Option)

Your Amplify frontend needs a backend. Choose one:

#### Option A: Deploy Backend to AWS ECS (Recommended for Production)

Follow your **AWS_ECS_DEPLOYMENT_GUIDE.md** to deploy:
- Backend API on ECS Fargate
- RDS PostgreSQL database
- ElastiCache Redis
- Application Load Balancer (ALB)

Once deployed, use the ALB DNS name as your `VITE_API_URL`:
```bash
VITE_API_URL=https://your-alb-xxxxx.us-east-1.elb.amazonaws.com/api
```

#### Option B: Deploy Backend to EC2

1. Launch an EC2 instance
2. Install Docker and Docker Compose
3. Clone your repository
4. Run: `docker-compose up -d`
5. Configure security groups to allow HTTPS (443)
6. Use EC2 public IP or DNS: `VITE_API_URL=http://ec2-xx-xx-xx-xx.compute.amazonaws.com:8000/api`

#### Option C: Use Existing External API

If you already have a backend deployed elsewhere:
```bash
VITE_API_URL=https://api.yourexistingbackend.com/api
```

---

### Step 5: Configure CORS on Your Backend

Your backend must allow requests from your Amplify domain.

#### For FastAPI Backend (Python):

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://main.xxxxxxxxxxxxx.amplifyapp.com",  # Your Amplify URL
        "https://yourdomain.com",  # Your custom domain (if configured)
        "http://localhost:5173",  # Local development
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

#### For Express.js Backend (Node.js):

```javascript
const cors = require('cors');

app.use(cors({
  origin: [
    'https://main.xxxxxxxxxxxxx.amplifyapp.com',
    'https://yourdomain.com',
    'http://localhost:5173'
  ],
  credentials: true
}));
```

**After updating CORS**, redeploy your backend.

---

### Step 6: Set Up Custom Domain (Optional)

#### 6.1: Add Domain to Amplify

1. In Amplify Console → Your App → **"Domain management"**
2. Click **"Add domain"**
3. Enter your domain: `yourdomain.com`
4. Configure subdomains:
   - `yourdomain.com` → main branch
   - `www.yourdomain.com` → main branch
5. Click **"Configure domain"**

#### 6.2: DNS Configuration

**If using Route53 (Automatic):**
- Amplify automatically creates DNS records ✅
- SSL certificate provisioned automatically ✅

**If using other DNS provider (GoDaddy, Namecheap, Cloudflare):**

1. Amplify will show you DNS records to add
2. Log in to your DNS provider
3. Add the CNAME records provided:

```
Type: CNAME
Name: _xxxxxxxxxxxxxx.yourdomain.com
Value: _yyyyyyyyyyyy.acm-validations.aws.
TTL: 300

Type: CNAME
Name: www
Value: main.xxxxxxxxxxxxx.amplifyapp.com
TTL: 300
```

4. Wait for DNS propagation (5-30 minutes)
5. SSL certificate will be auto-provisioned

---

### Step 7: Enable Branch Deployments (Optional)

Deploy different branches to different URLs for testing.

#### 7.1: Connect Additional Branches

1. In Amplify Console → Your App → **"App settings"** → **"Branch settings"**
2. Click **"Connect branch"**
3. Select branch: `develop` or `staging`
4. Each branch gets its own URL:
   - `main` → `https://main.xxxxxxxxxxxxx.amplifyapp.com`
   - `develop` → `https://develop.xxxxxxxxxxxxx.amplifyapp.com`

#### 7.2: Configure Branch-Specific Environment Variables

1. Go to **"Environment variables"**
2. Add branch-specific overrides:
   ```
   develop branch:
   VITE_API_URL=https://dev-api.yourdomain.com/api
   VITE_ENVIRONMENT=development
   ```

---

### Step 8: Configure Redirects for Single Page App (SPA)

React Router requires proper redirects to work correctly.

#### 8.1: Add Redirect Rules

1. In Amplify Console → **"App settings"** → **"Rewrites and redirects"**
2. Click **"Edit"**
3. Add this rule:

```
Source address: </^[^.]+$|\.(?!(css|gif|ico|jpg|js|png|txt|svg|woff|woff2|ttf|map|json|webp)$)([^.]+$)/>
Target address: /index.html
Type: 200 (Rewrite)
```

4. Click **"Save"**

This ensures routes like `/dashboard`, `/login`, etc. work correctly.

---

### Step 9: Set Up CI/CD (Automatic Deployments)

#### Automatic Deployments

Every time you push to GitHub, Amplify automatically deploys! 🎉

```bash
# Make changes to your code
git add .
git commit -m "Add new feature"
git push origin main

# Amplify automatically:
# 1. Detects the push
# 2. Runs build (npm ci → npm run build)
# 3. Deploys to production
# 4. Your site is live in 3-5 minutes!
```

#### Manual Deployment

If you need to redeploy without code changes:

1. Go to Amplify Console → Your App
2. Click on the build you want to redeploy
3. Click **"Redeploy this version"**

---

### Step 10: Monitor and Maintain

#### 10.1: View Build Logs

1. Amplify Console → Your App
2. Click on any deployment
3. View detailed logs:
   - Provision logs
   - Build logs
   - Deploy logs

#### 10.2: Set Up Notifications

1. **App settings** → **Notifications**
2. Add email address for build notifications
3. Get notified on:
   - Build success
   - Build failure
   - Deployment complete

---

## 🔐 Security Best Practices

### 1. Enable Security Headers

Update your `amplify.yml`:

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
  customHeaders:
    - pattern: '**/*'
      headers:
        - key: 'Strict-Transport-Security'
          value: 'max-age=31536000; includeSubDomains; preload'
        - key: 'X-Content-Type-Options'
          value: 'nosniff'
        - key: 'X-Frame-Options'
          value: 'DENY'
        - key: 'X-XSS-Protection'
          value: '1; mode=block'
        - key: 'Referrer-Policy'
          value: 'strict-origin-when-cross-origin'
```

### 2. Environment Variable Security

✅ **DO:**
- Store public API keys in Amplify environment variables
- Use `VITE_` prefix for all frontend env vars
- Store secrets in AWS Secrets Manager (for backend)

❌ **DON'T:**
- Put database passwords in Amplify env vars
- Put private API keys that should be server-side only
- Commit `.env` files with secrets to Git

### 3. API Security

- ✅ Use HTTPS only (Amplify provides this automatically)
- ✅ Implement rate limiting on your backend
- ✅ Use JWT tokens for authentication
- ✅ Validate CORS origins strictly
- ✅ Enable AWS WAF for DDoS protection (optional)

---

## 💰 Cost Analysis

### AWS Amplify Hosting Costs

**Free Tier (First 12 Months):**
- 1,000 build minutes/month (FREE)
- 15 GB storage (FREE)
- 5 GB data transfer/month (FREE)

**After Free Tier:**
| Resource | Price | Typical Usage | Monthly Cost |
|----------|-------|---------------|--------------|
| Build minutes | $0.01/minute | 100 min/month | $1.00 |
| Storage | $0.023/GB/month | 1 GB | $0.02 |
| Data served | $0.15/GB | 20 GB | $3.00 |
| **Total** | | | **~$4-6/month** |

### Full Stack Cost (Amplify + ECS Backend)

| Service | Configuration | Monthly Cost |
|---------|--------------|--------------|
| **Amplify** (Frontend) | Standard | $4-6 |
| **ECS Fargate** | 2 tasks (0.5 vCPU, 1GB) | $30-40 |
| **RDS PostgreSQL** | db.t4g.small | $25-30 |
| **ElastiCache Redis** | cache.t4g.small | $15-20 |
| **ALB** | Application Load Balancer | $16-20 |
| **Data Transfer** | 50 GB/month | $5-10 |
| **CloudWatch** | Logs & Metrics | $5-10 |
| **Total** | | **$100-136/month** |

**Comparison:**
- **Amplify Only (Frontend):** $4-6/month
- **Full Stack (Amplify + ECS):** $100-136/month
- **Full ECS Deployment:** $485-715/month (from your ECS guide)

💡 **Recommendation:** Use Amplify for frontend ($4-6/month) + lightweight backend on EC2 or ECS ($50-100/month) = **~$60-110/month total**

---

## 🚨 Troubleshooting

### Build Fails with "npm ERR!"

**Error:**
```
npm ERR! code ERESOLVE
npm ERR! ERESOLVE unable to resolve dependency tree
```

**Solution:**
1. Update `amplify.yml` to use specific Node version:
```yaml
preBuild:
  commands:
    - nvm use 18
    - npm ci
```

2. Or use legacy peer deps:
```yaml
preBuild:
  commands:
    - npm ci --legacy-peer-deps
```

---

### Build Fails with "Module not found"

**Error:**
```
Error: Cannot find module '@/components/ui/button'
```

**Solution:**
Check your `vite.config.ts` path aliases work:
```typescript
resolve: {
  alias: {
    "@": path.resolve(__dirname, "./src"),
  },
}
```

Clear cache and redeploy.

---

### 404 Errors on Page Refresh

**Error:** Refreshing `/dashboard` gives 404

**Solution:** Add SPA redirect rule (see Step 8 above)

---

### CORS Errors When Calling API

**Error:**
```
Access to fetch at 'https://api.example.com' from origin 'https://main.xxxxx.amplifyapp.com'
has been blocked by CORS policy
```

**Solution:**
1. Update backend CORS to include your Amplify URL
2. Ensure backend is accessible (security groups allow traffic)
3. Check `VITE_API_URL` is correct in Amplify environment variables

---

### Build Takes Too Long (>5 minutes)

**Solution:**
1. Enable dependency caching (already in amplify.yml)
2. Reduce bundle size:
```bash
npm install -D vite-plugin-compression
```

3. Add to `vite.config.ts`:
```typescript
import viteCompression from 'vite-plugin-compression';

export default defineConfig({
  plugins: [
    react(),
    viteCompression()
  ]
});
```

---

### Environment Variables Not Working

**Error:** `import.meta.env.VITE_API_URL` is undefined

**Solution:**
1. ✅ Verify variable name starts with `VITE_`
2. ✅ Redeploy after adding env vars
3. ✅ Check variables in Amplify Console → Environment variables
4. ✅ Access in code: `import.meta.env.VITE_API_URL` (not `process.env`)

---

## 📱 Using the Deployment Helper Script

You have a helper script: `deploy-amplify.sh`

```bash
# Make executable
chmod +x deploy-amplify.sh

# Run the script
./deploy-amplify.sh
```

**Options:**
1. Initialize Amplify (first time)
2. Add hosting
3. Publish/Deploy app
4. Check status
5. Open Amplify Console

---

## 🎯 Complete Deployment Checklist

### Initial Deployment
- [ ] Code pushed to GitHub (`main` branch)
- [ ] AWS account created and signed in
- [ ] Connected GitHub to Amplify Console
- [ ] App deployed successfully (green checkmark)
- [ ] Accessed app at Amplify URL

### Configuration
- [ ] Environment variables added (VITE_API_URL, etc.)
- [ ] SPA redirects configured (no 404 on refresh)
- [ ] Security headers enabled in amplify.yml
- [ ] Backend CORS configured with Amplify URL

### Backend Integration
- [ ] Backend API deployed (ECS/EC2/other)
- [ ] Backend is accessible via HTTPS
- [ ] API calls work from frontend
- [ ] Database connected to backend
- [ ] Redis cache configured (if needed)

### Optional Enhancements
- [ ] Custom domain configured
- [ ] SSL certificate active (auto from Amplify)
- [ ] Branch deployments set up (develop, staging)
- [ ] Build notifications configured
- [ ] Performance monitoring enabled

### Testing
- [ ] Homepage loads correctly
- [ ] All routes work (no 404s)
- [ ] API calls successful
- [ ] User authentication works
- [ ] Data loads from database
- [ ] Mobile responsive
- [ ] HTTPS enabled (green padlock)

---

## 📚 Additional Resources

### Documentation
- [AWS Amplify Hosting Docs](https://docs.amplify.aws/console/hosting/)
- [Amplify Environment Variables](https://docs.aws.amazon.com/amplify/latest/userguide/environment-variables.html)
- [Vite Environment Variables](https://vitejs.dev/guide/env-and-mode.html)
- [React Router with Amplify](https://docs.aws.amazon.com/amplify/latest/userguide/redirects.html)

### Your Project Files
- `amplify.yml` - Build configuration
- `deploy-amplify.sh` - Deployment helper script
- `AWS_ECS_DEPLOYMENT_GUIDE.md` - Backend deployment guide
- `COST_ANALYSIS.md` - Detailed cost breakdown

### Support
- [AWS Amplify Console](https://console.aws.amazon.com/amplify/)
- [GitHub Repository](https://github.com/Ifthikar20/playstudy-card-dash)
- [AWS Support](https://console.aws.amazon.com/support/)

---

## 🚀 Next Steps After Deployment

1. **Test Your Deployment**
   - Visit your Amplify URL
   - Test all pages and features
   - Check API connectivity

2. **Set Up Monitoring**
   - Enable CloudWatch metrics
   - Set up build failure alerts
   - Monitor performance

3. **Deploy Backend** (if not done yet)
   - Follow AWS_ECS_DEPLOYMENT_GUIDE.md
   - Or deploy to EC2 for lower costs
   - Connect to frontend

4. **Custom Domain** (optional)
   - Buy domain (Route53, GoDaddy, etc.)
   - Configure in Amplify
   - Wait for SSL certificate

5. **Optimize Performance**
   - Enable compression
   - Implement code splitting
   - Add error tracking (Sentry, etc.)

---

## 🎉 Success!

Your PlayStudy Card Dashboard is now live on AWS Amplify with:
- ✅ Global CDN distribution
- ✅ Automatic HTTPS
- ✅ CI/CD from GitHub
- ✅ Scalable infrastructure
- ✅ Low cost ($4-6/month for frontend)

**Your live app:** `https://main.xxxxxxxxxxxxx.amplifyapp.com`

---

**Questions or issues?** Check the troubleshooting section or create an issue in your GitHub repository.

**Need backend deployment?** See `AWS_ECS_DEPLOYMENT_GUIDE.md` for complete backend setup.
