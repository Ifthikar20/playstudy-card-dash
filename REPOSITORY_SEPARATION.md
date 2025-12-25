# Repository Separation Guide

This guide explains how to separate the backend and frontend into independent repositories.

## Why Separate Repositories?

✅ **Independent Deployment** - Deploy backend and frontend separately
✅ **Team Organization** - Different teams can own different repos
✅ **CI/CD Simplification** - Separate pipelines for each service
✅ **Version Control** - Independent versioning and releases
✅ **Security** - Backend secrets isolated from frontend code

---

## Architecture After Separation

### Before (Monorepo)
```
playstudy-card-dash/
├── backend/          # Backend code
├── src/              # Frontend code
├── deploy/           # Deployment scripts
└── docker-compose.yml
```

### After (Separate Repos)
```
playstudy-backend/           # NEW: Backend repository
├── app/                     # FastAPI application
├── deploy/                  # Backend deployment
├── Dockerfile
├── docker-compose.yml       # Backend + DB + Redis
└── README.md

playstudy-card-dash/         # KEEP: Frontend repository
├── src/                     # React/Vite application
├── public/
├── package.json
└── README.md
```

---

## Step-by-Step Separation

### Phase 1: Create Backend Repository

#### 1. Run the Automated Script

From the root of `playstudy-card-dash`:

```bash
./create-backend-repo.sh
```

This creates a new directory `../playstudy-backend/` with:
- ✅ All backend code from `backend/`
- ✅ Deployment scripts and configurations
- ✅ Docker support
- ✅ Documentation (COST_ANALYSIS.md, AWS_ECS_DEPLOYMENT_GUIDE.md, etc.)
- ✅ .gitignore optimized for Python/backend
- ✅ README.md with backend-specific instructions
- ✅ Initial git commit

#### 2. Create GitHub Repository

**Option A: GitHub Web UI**
1. Go to https://github.com/new
2. Repository name: `playstudy-backend`
3. Description: `FastAPI backend for PlayStudy Card Dashboard`
4. Public or Private (your choice)
5. **Don't** initialize with README (we already have one)
6. Click "Create repository"

**Option B: GitHub CLI**
```bash
cd ../playstudy-backend
gh repo create playstudy-backend --public --source=. --remote=origin
```

#### 3. Push to GitHub

```bash
cd ../playstudy-backend

# Add remote (if not using gh CLI)
git remote add origin https://github.com/YOUR_USERNAME/playstudy-backend.git

# Push to main branch
git branch -M main
git push -u origin main
```

---

### Phase 2: Update Frontend Repository

#### 1. Remove Backend Files from Frontend Repo

```bash
cd ../playstudy-card-dash

# Remove backend directory
git rm -r backend/

# Update .gitignore to remove backend-specific entries
# (We'll create this in next step)

# Commit the removal
git add .
git commit -m "Remove backend code - moved to separate repository

Backend code has been moved to:
https://github.com/YOUR_USERNAME/playstudy-backend

This repository now contains only the frontend React application.
"
git push
```

#### 2. Update Frontend Documentation

Create `README.md` for frontend:

```markdown
# PlayStudy Card Dashboard - Frontend

React + TypeScript + Vite frontend for the PlayStudy application.

## Backend Repository

The backend API is in a separate repository:
https://github.com/YOUR_USERNAME/playstudy-backend

## Quick Start

1. Install dependencies:
\`\`\`bash
npm install
\`\`\`

2. Configure environment:
\`\`\`bash
cp .env.example .env
# Edit .env and set VITE_API_URL to your backend URL
\`\`\`

3. Start development server:
\`\`\`bash
npm run dev
\`\`\`

4. Build for production:
\`\`\`bash
npm run build
\`\`\`

## Deployment

Frontend is deployed to S3 + CloudFront.

See deployment guide in the backend repository.

## Tech Stack

- React 18
- TypeScript
- Vite
- TailwindCSS
- Zustand (state management)
```

#### 3. Update package.json

Add repository fields:

```json
{
  "name": "playstudy-frontend",
  "version": "1.0.0",
  "repository": {
    "type": "git",
    "url": "https://github.com/YOUR_USERNAME/playstudy-card-dash.git"
  },
  "bugs": {
    "url": "https://github.com/YOUR_USERNAME/playstudy-card-dash/issues"
  }
}
```

---

## Development Workflow

### Backend Development

```bash
cd playstudy-backend

# Install dependencies
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Run locally
uvicorn app.main:app --reload --port 8000

# Or use Docker
docker-compose up
```

### Frontend Development

```bash
cd playstudy-card-dash

# Install dependencies
npm install

# Update .env to point to backend
echo "VITE_API_URL=http://localhost:8000/api" > .env

# Run dev server
npm run dev
```

### Full Stack Local Development

**Terminal 1 - Backend:**
```bash
cd playstudy-backend
docker-compose up
# Backend running on http://localhost:8000
```

**Terminal 2 - Frontend:**
```bash
cd playstudy-card-dash
npm run dev
# Frontend running on http://localhost:5173
```

---

## Deployment Strategy

### Backend Deployment (AWS ECS)

```bash
cd playstudy-backend/deploy

# One-time setup
./setup-infrastructure.sh

# Deploy backend
./deploy.sh
```

Backend will be available at: `https://api.your-domain.com`

### Frontend Deployment (S3 + CloudFront)

```bash
cd playstudy-card-dash

# Build
npm run build

# Deploy to S3
aws s3 sync dist/ s3://your-frontend-bucket/ --delete

# Invalidate CloudFront cache
aws cloudfront create-invalidation \
  --distribution-id YOUR_DIST_ID \
  --paths "/*"
```

Frontend will be available at: `https://your-domain.com`

---

## CI/CD Pipelines

### Backend CI/CD (GitHub Actions)

Create `.github/workflows/deploy-backend.yml` in **playstudy-backend**:

```yaml
name: Deploy Backend to AWS ECS

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1

      - name: Login to Amazon ECR
        id: login-ecr
        uses: aws-actions/amazon-ecr-login@v1

      - name: Build and push Docker image
        env:
          ECR_REGISTRY: ${{ steps.login-ecr.outputs.registry }}
          ECR_REPOSITORY: playstudy-backend
          IMAGE_TAG: ${{ github.sha }}
        run: |
          docker build -t $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG .
          docker push $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG

      - name: Deploy to ECS
        run: |
          aws ecs update-service \
            --cluster playstudy-cluster \
            --service playstudy-backend-service \
            --force-new-deployment
```

### Frontend CI/CD (GitHub Actions)

Create `.github/workflows/deploy-frontend.yml` in **playstudy-card-dash**:

```yaml
name: Deploy Frontend to S3

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build
        env:
          VITE_API_URL: https://api.your-domain.com/api
        run: npm run build

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1

      - name: Deploy to S3
        run: |
          aws s3 sync dist/ s3://your-frontend-bucket/ --delete

      - name: Invalidate CloudFront
        run: |
          aws cloudfront create-invalidation \
            --distribution-id ${{ secrets.CLOUDFRONT_DISTRIBUTION_ID }} \
            --paths "/*"
```

---

## Environment Variables

### Backend (.env)

```bash
# Database
DATABASE_URL=postgresql+psycopg://user:pass@host:5432/dbname

# Redis
REDIS_URL=redis://host:6379/0

# Security
SECRET_KEY=your-secret-key
FIELD_ENCRYPTION_KEY=your-encryption-key

# API Keys
ANTHROPIC_API_KEY=your-key
OPENAI_API_KEY=your-key
GOOGLE_CLOUD_API_KEY=your-key
RECAPTCHA_SECRET_KEY=your-key

# CORS
ALLOWED_ORIGINS=https://your-domain.com,https://www.your-domain.com
```

### Frontend (.env)

```bash
VITE_API_URL=https://api.your-domain.com/api
```

---

## Benefits of Separation

### 1. Independent Scaling
- Backend can scale independently based on API load
- Frontend served from CDN (S3 + CloudFront) scales automatically

### 2. Team Organization
- Backend team works in `playstudy-backend`
- Frontend team works in `playstudy-card-dash`
- No merge conflicts between teams

### 3. Security
- Backend secrets stored separately
- Frontend repo can be public while backend is private

### 4. Deployment Flexibility
- Deploy backend without redeploying frontend
- Deploy frontend without touching backend
- Faster CI/CD pipelines (only build what changed)

### 5. Version Control
- Backend: v1.0.0, v1.1.0, etc.
- Frontend: v1.0.0, v1.2.0, etc.
- Independent release cycles

---

## Troubleshooting

### CORS Issues After Separation

If you get CORS errors, ensure backend `.env` has:

```bash
ALLOWED_ORIGINS=https://your-frontend-domain.com
```

### API URL Configuration

Frontend `.env` should point to deployed backend:

```bash
# Development
VITE_API_URL=http://localhost:8000/api

# Production
VITE_API_URL=https://api.your-domain.com/api
```

### Communication Between Repos

For coordinated changes that affect both frontend and backend:

1. Make backend changes first
2. Deploy backend
3. Update frontend to use new API
4. Deploy frontend

Or use feature flags for gradual rollouts.

---

## Checklist

### Backend Repository Setup
- [ ] Run `./create-backend-repo.sh`
- [ ] Create GitHub repository `playstudy-backend`
- [ ] Push code to GitHub
- [ ] Test locally with `docker-compose up`
- [ ] Deploy to AWS ECS
- [ ] Set up CI/CD pipeline

### Frontend Repository Cleanup
- [ ] Remove `backend/` directory
- [ ] Update README.md
- [ ] Update .gitignore
- [ ] Commit and push changes
- [ ] Test with backend API
- [ ] Deploy to S3 + CloudFront
- [ ] Set up CI/CD pipeline

### Documentation
- [ ] Update main README in both repos
- [ ] Link repos to each other in documentation
- [ ] Update deployment guides
- [ ] Update contributing guidelines

---

## Support

For questions or issues:
- Backend: https://github.com/YOUR_USERNAME/playstudy-backend/issues
- Frontend: https://github.com/YOUR_USERNAME/playstudy-card-dash/issues

---

**Next Steps:** Run `./create-backend-repo.sh` to get started!
