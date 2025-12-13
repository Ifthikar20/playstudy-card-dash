# Playstudy Card Dashboard - Setup Guide

## ✅ Completed Setup Steps

1. ✅ Backend models aligned with frontend interfaces
2. ✅ API endpoints configured and tested
3. ✅ Frontend authentication flow implemented
4. ✅ Anthropic AI question generation endpoint created
5. ✅ Database seed script created
6. ✅ Redis cache configured and running
7. ✅ Python dependencies installed

## 📋 Remaining Setup Steps

### 1. Add Your Anthropic API Key

Edit `/home/user/playstudy-card-dash/backend/.env` and replace the placeholder:

```bash
ANTHROPIC_API_KEY=your-actual-anthropic-api-key-here
```

**Where to get your API key:**
- Go to https://console.anthropic.com/
- Navigate to API Keys
- Create a new key or copy an existing one

### 2. Initialize the Database

Run the seed script to populate the database with sample data:

```bash
cd /home/user/playstudy-card-dash/backend
python seed_database.py
```

This will create:
- Sample games (Math, Science, History, etc.)
- Test user accounts:
  - Email: `student@playstudy.ai` | Password: `password123`
  - Email: `demo@playstudy.ai` | Password: `demo123`
- Sample study sessions

### 3. Start the Backend Server

```bash
cd /home/user/playstudy-card-dash/backend
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 3001
```

The backend will be available at: `http://localhost:3001`
API documentation at: `http://localhost:3001/api/docs`

### 4. Start the Frontend Development Server

In a new terminal:

```bash
cd /home/user/playstudy-card-dash
npm run dev
```

The frontend will be available at: `http://localhost:8080`

## 🎯 Testing the Application

### Test Authentication
1. Open `http://localhost:8080`
2. The app will load with mock data initially
3. To test real backend:
   - Create account or login with test credentials
   - The app will fetch real data from the backend

### Test Question Generation (Anthropic AI)
Once logged in, you can generate questions by calling:

```javascript
import { generateQuestions } from './services/api';

const result = await generateQuestions('Calculus', 5, 'medium');
console.log(result);
```

## 📊 API Endpoints

### Authentication
- `POST /api/auth/register` - Create new account
- `POST /api/auth/login` - Login and get JWT token

### Data
- `GET /api/app-data` - Get all app data (requires auth)

### AI Features
- `POST /api/generate-questions` - Generate questions with Anthropic (requires auth)

## 🔧 Troubleshooting

### Backend won't start
- Check `.env` file has valid configuration
- Ensure Redis is running: `redis-cli ping`
- Check Python dependencies: `pip install -r requirements.txt`

### Frontend can't connect to backend
- Verify backend is running on port 3001
- Check CORS configuration in `backend/app/main.py`
- Verify `VITE_API_URL` in frontend `.env`

### Questions not generating
- Verify Anthropic API key is set correctly
- Check API key has credits available
- Check backend logs for errors

## 🗄️ Database

Currently using SQLite for quick development. To switch to PostgreSQL:

1. Update `backend/.env`:
```bash
DATABASE_URL=postgresql+psycopg://postgres:postgres@localhost:5432/playstudy_db
```

2. Ensure PostgreSQL is running
3. Recreate database and run seed script

## 📚 Tech Stack

**Frontend:**
- React 18 + TypeScript
- Vite
- Tailwind CSS
- Zustand (state management)
- React Query (data fetching)

**Backend:**
- FastAPI
- SQLAlchemy 2.0
- Redis (caching)
- Anthropic Claude (AI question generation)
- JWT authentication

## 🚀 Next Steps

After setup is complete:
1. Explore the UI and different game modes
2. Generate questions for different topics
3. Test study sessions and progress tracking
4. Customize the app for your needs
