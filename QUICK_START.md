# Quick Start - Study Session Flow

## What Was Implemented ✅

The complete flow from content upload to quiz gameplay is now ready:

1. **Database Models**: Topic and Question models for organizing quiz content
2. **AI Integration**: Anthropic Claude API for extracting topics and generating questions
3. **API Endpoint**: `/api/study-sessions/create-with-ai` for creating sessions
4. **Frontend Integration**: CreateStudySessionDialog calls the backend API
5. **Migration Scripts**: SQL and Python scripts to update database schema

## What You Need To Do 🚀

### Step 1: Add Your Anthropic API Key

Edit `backend/.env` and add your API key:

```bash
ANTHROPIC_API_KEY=sk-ant-api03-YOUR-ACTUAL-KEY-HERE
```

Get your API key from: https://console.anthropic.com/

**SECURITY NOTE**: Never commit the `.env` file (it's already in `.gitignore`)

### Step 2: Run Database Migration

The migration fixes the error: `column study_sessions.study_content does not exist`

```bash
cd backend
source venv/bin/activate
python run_migration.py
```

Expected output:
```
✓ Migration completed successfully!
✓ study_content column exists
✓ Created tables: topics, questions
```

### Step 3: Start the Backend

```bash
cd backend
source venv/bin/activate
uvicorn app.main:app --reload --port 3001
```

The server should start without database errors.

### Step 4: Start the Frontend

```bash
npm run dev
```

### Step 5: Test the Flow

1. Go to http://localhost:5173/auth and login
2. Click "Create Study Session"
3. Paste some study content or upload a file
4. Click "Process Content" (wait 10-30 seconds for AI)
5. Select "Full Study" mode
6. Play through the quiz!

## How It Works 🧠

When you create a study session:

1. **Frontend** sends content to `/api/study-sessions/create-with-ai`
2. **Backend** uses Claude AI to:
   - Extract 4 major topics from your content
   - Generate 10 questions per topic (40 total)
   - Create explanations for each answer
3. **Database** saves everything:
   - Study session with original content
   - Topics linked to the session
   - Questions linked to each topic
4. **Frontend** receives structured data and starts the quiz

## Topic-Based Quiz Flow

**Full Study Mode**:
- Topics presented in order
- 10 questions per topic
- Must complete Topic 1 before Topic 2 unlocks
- Score tracked per topic
- Progress saved to database

**Speed Run Mode**:
- All 40 questions in rapid succession
- Timer-based
- Final score calculated

## Troubleshooting 🔧

### "column study_sessions.study_content does not exist"
➜ Run the migration: `python run_migration.py`

### "AI API error" or "Authentication required"
➜ Add ANTHROPIC_API_KEY to `backend/.env`

### "connection to server failed"
➜ Make sure PostgreSQL is running: `createdb playstudy_db` if needed

### Rate limit errors
➜ Wait 1 minute (limit is 5 session creations per minute)

## File Structure

```
backend/
├── app/
│   ├── models/
│   │   ├── topic.py              # NEW: Topic model
│   │   └── question.py           # NEW: Question model
│   ├── api/
│   │   └── study_sessions.py     # NEW: AI session creation endpoint
│   └── main.py                    # UPDATED: Added study_sessions router
├── migrate_database.sql          # NEW: SQL migration
├── run_migration.py              # NEW: Python migration runner
└── .env                          # UPDATE: Add ANTHROPIC_API_KEY

src/
├── services/
│   └── api.ts                    # UPDATED: Added createStudySessionWithAI
└── components/
    └── CreateStudySessionDialog.tsx  # UPDATED: Calls backend API
```

## What's Next?

1. ✅ Run migration
2. ✅ Add API key
3. ✅ Test the flow
4. 🎯 Create a study session with real content
5. 🎯 Play through full study and speed run modes
6. 🎯 Verify topics lock/unlock properly

## Documentation

For detailed information, see:
- **STUDY_SESSION_SETUP.md** - Comprehensive setup guide
- **Backend logs** - Check for any errors during API calls
- **API docs** - http://localhost:3001/api/docs (when backend running)

---

🎉 The study session flow is complete and ready to test!
