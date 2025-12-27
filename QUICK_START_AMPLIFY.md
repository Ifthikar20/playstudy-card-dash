# ⚡ Quick Start - Deploy to AWS Amplify in 5 Minutes

**Deploy your PlayStudy Card Dashboard to AWS Amplify in 5 simple steps.**

---

## Prerequisites
- ✅ AWS Account ([Sign up](https://aws.amazon.com))
- ✅ Code pushed to GitHub
- ✅ 5 minutes of your time

---

## 🚀 5-Minute Deployment

### Step 1: Push Your Code (if not already done)

```bash
git status
git add .
git commit -m "Prepare for deployment"
git push origin main
```

### Step 2: Open AWS Amplify Console

Click here: **https://console.aws.amazon.com/amplify/**

### Step 3: Create New App

1. Click **"New app"** → **"Host web app"**
2. Select **"GitHub"**
3. Authorize AWS Amplify (if first time)
4. Select:
   - **Repository:** `Ifthikar20/playstudy-card-dash`
   - **Branch:** `main`
5. Click **"Next"**

### Step 4: Confirm Build Settings

✅ Settings are auto-detected from `amplify.yml`:
- Build command: `npm run build`
- Output directory: `dist`

Click **"Next"** → **"Save and deploy"**

### Step 5: Wait for Deployment

⏳ Takes 3-5 minutes...

✅ Done! Your app is live at: `https://main.xxxxx.amplifyapp.com`

---

## 🔧 Connect Your Backend (Optional)

If you have a backend API:

1. In Amplify Console → **"Environment variables"**
2. Add:
   ```
   VITE_API_URL=https://your-backend-api.com/api
   ```
3. Click **"Save"** → **"Redeploy this version"**

---

## 📋 What's Next?

- ✅ **Working?** Great! See [AWS_AMPLIFY_COMPLETE_DEPLOYMENT.md](AWS_AMPLIFY_COMPLETE_DEPLOYMENT.md) for advanced features
- ⚙️ **Need Backend?** See [AWS_ECS_DEPLOYMENT_GUIDE.md](AWS_ECS_DEPLOYMENT_GUIDE.md) to deploy your backend
- 🌐 **Custom Domain?** Add it in Amplify Console → Domain management
- 🚨 **Issues?** Check troubleshooting in the complete guide

---

## 💰 Cost

**Free Tier:** FREE for 12 months (1,000 build minutes/month)

**After Free Tier:** $4-6/month (frontend only)

---

## 🎯 Deployment Checklist

- [ ] Code pushed to GitHub
- [ ] Amplify app created and deployed
- [ ] App accessible at Amplify URL
- [ ] Environment variables added (if needed)
- [ ] Backend connected (if applicable)
- [ ] Custom domain configured (optional)

---

## 📞 Need Help?

- 📖 **Complete Guide:** [AWS_AMPLIFY_COMPLETE_DEPLOYMENT.md](AWS_AMPLIFY_COMPLETE_DEPLOYMENT.md)
- 🔧 **Helper Script:** Run `./deploy-amplify.sh`
- 🌐 **AWS Docs:** https://docs.amplify.aws
- 💬 **Issues:** https://github.com/Ifthikar20/playstudy-card-dash/issues

---

**That's it! You're live on AWS Amplify! 🎉**
