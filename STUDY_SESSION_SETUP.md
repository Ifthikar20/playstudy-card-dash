# Study Session Flow Setup Guide

This guide covers the complete setup for the AI-powered study session flow, from content upload to quiz gameplay.

## Overview

The study session flow now includes:
- **AI-powered content analysis** using Anthropic Claude API
- **Automatic topic extraction** from uploaded study materials
- **Question generation** for each topic (10+ questions per topic)
- **Database persistence** with Topics and Questions tables
- **Locked progression** - must complete one topic before moving to next

## Prerequisites

Before running the application, ensure you have:

1. **PostgreSQL** running on `localhost:5432`
2. **Redis** running on `localhost:6379` (for rate limiting)
3. **Anthropic API Key** for AI-powered question generation

## Setup Steps

### 1. Database Migration

The database schema needs to be updated to support topics and questions. Run the migration:

```bash
cd backend

# Option A: Using the Python migration script (recommended)
source venv/bin/activate
python run_migration.py

# Option B: Using psql directly
psql -d playstudy_db -f migrate_database.sql
```

This migration:
- Adds `study_content` column to `study_sessions` table
- Creates `topics` table with foreign key to `study_sessions`
- Creates `questions` table with foreign key to `topics`
- Adds appropriate indexes for performance

### 2. Configure Anthropic API Key

Add your Anthropic API key to `backend/.env`:

```bash
# In backend/.env, add or update:
ANTHROPIC_API_KEY=sk-ant-api03-your-actual-key-here
```

**IMPORTANT**:
- Never commit your `.env` file with real API keys
- The `.env` file is already in `.gitignore`
- Get your API key from: https://console.anthropic.com/

### 3. Verify Database Connection

Make sure PostgreSQL is running and accessible:

```bash
# Test database connection
psql -d playstudy_db -c "SELECT version();"

# Verify migration succeeded
psql -d playstudy_db -c "\d study_sessions"
psql -d playstudy_db -c "\d topics"
psql -d playstudy_db -c "\d questions"
```

Expected output should show:
- `study_sessions` table with `study_content` column
- `topics` table with columns: id, study_session_id, title, description, etc.
- `questions` table with columns: id, topic_id, question, options, correct_answer, explanation

### 4. Start the Backend

```bash
cd backend
source venv/bin/activate
uvicorn app.main:app --reload --port 3001
```

The backend should start successfully and connect to the database.

### 5. Start the Frontend

```bash
# From project root
npm run dev
```

Visit http://localhost:5173

## How It Works

### 1. Content Upload Flow

1. User logs in and navigates to create a study session
2. User uploads or pastes study content (text or file)
3. Frontend calls `POST /api/study-sessions/create-with-ai` with:
   - Title
   - Content (study material text)
   - Number of topics (2-10, default: 4)
   - Questions per topic (5-20, default: 10)

### 2. AI Processing (Backend)

The backend (`backend/app/api/study_sessions.py`):

1. **Topic Extraction**:
   - Sends content to Claude AI
   - Extracts N major topics from the material
   - Gets title and description for each topic

2. **Question Generation**:
   - For each topic, sends another AI request
   - Generates M questions per topic
   - Each question has 4 multiple-choice options
   - Includes correct answer index and explanation

3. **Database Storage**:
   - Creates StudySession record with original content
   - Creates Topic records linked to session
   - Creates Question records linked to each topic
   - All in a single transaction for data consistency

### 3. Quiz Gameplay

**Full Study Mode**:
- Topics are presented in sequential order
- Each topic must be completed before unlocking the next
- Questions answered one at a time
- Score tracked per topic
- Progress saved in database

**Speed Run Mode**:
- All questions from all topics in rapid succession
- Timer-based gameplay
- Final score calculated across all topics

## Database Schema

### study_sessions
```sql
- id (PRIMARY KEY)
- user_id (FOREIGN KEY to users)
- title (VARCHAR)
- topic (VARCHAR)
- study_content (TEXT) -- NEW: Original uploaded content
- topics_count (INTEGER)
- status (VARCHAR)
- has_full_study (BOOLEAN)
- has_speed_run (BOOLEAN)
- created_at, updated_at
```

### topics
```sql
- id (PRIMARY KEY)
- study_session_id (FOREIGN KEY to study_sessions)
- title (VARCHAR)
- description (TEXT)
- order_index (INTEGER) -- For sequential display
- completed (BOOLEAN)
- score (INTEGER)
- current_question_index (INTEGER)
```

### questions
```sql
- id (PRIMARY KEY)
- topic_id (FOREIGN KEY to topics)
- question (TEXT)
- options (JSON) -- Array of 4 strings
- correct_answer (INTEGER) -- Index 0-3
- explanation (TEXT)
- order_index (INTEGER)
```

## API Endpoints

### Create Study Session with AI

**Endpoint**: `POST /api/study-sessions/create-with-ai`

**Authentication**: Required (Bearer token)

**Rate Limit**: 5 requests per minute

**Request Body**:
```json
{
  "title": "Calculus Fundamentals",
  "content": "Study material text here...",
  "num_topics": 4,
  "questions_per_topic": 10
}
```

**Response**:
```json
{
  "id": 123,
  "title": "Calculus Fundamentals",
  "studyContent": "Original content...",
  "extractedTopics": [
    {
      "id": "topic-1",
      "title": "Limits and Continuity",
      "description": "Introduction to calculus concepts",
      "questions": [
        {
          "id": "topic-1-q1",
          "question": "What is the limit of...",
          "options": ["A", "B", "C", "D"],
          "correctAnswer": 2,
          "explanation": "The answer is C because..."
        }
      ],
      "completed": false,
      "score": null,
      "currentQuestionIndex": 0
    }
  ],
  "progress": 0,
  "topics": 4,
  "hasFullStudy": true,
  "hasSpeedRun": true
}
```

## Troubleshooting

### Database Connection Errors

If you see `column study_sessions.study_content does not exist`:
- Run the migration script (see step 1)
- Verify migration succeeded with `\d study_sessions` in psql

### AI API Errors

If you see `AI API error`:
- Verify your ANTHROPIC_API_KEY is set in `backend/.env`
- Check your API key is valid at https://console.anthropic.com/
- Ensure you have API credits available

### Rate Limit Errors

If you see `429 Too Many Requests`:
- Wait a minute and try again
- Rate limit is 5 session creations per minute
- This prevents excessive AI API usage

### Redis Connection Errors

If you see Redis connection errors:
- Start Redis: `redis-server`
- Or update REDIS_URL in `.env` to point to your Redis instance

## Testing the Flow

1. **Login**: http://localhost:5173/auth
2. **Create Session**: Click "Create Study Session"
3. **Upload Content**: Paste study material or upload a file
4. **Configure**: Set number of topics and questions per topic
5. **Process**: Click "Process Content" and wait for AI generation
6. **Select Mode**: Choose "Full Study" or "Speed Run"
7. **Play**: Complete the quiz and see your score

## Files Changed

### Backend
- `backend/app/models/topic.py` (NEW)
- `backend/app/models/question.py` (NEW)
- `backend/app/models/study_session.py` (MODIFIED - added study_content)
- `backend/app/api/study_sessions.py` (NEW)
- `backend/app/main.py` (MODIFIED - added study_sessions router)
- `backend/migrate_database.sql` (NEW)
- `backend/run_migration.py` (NEW)

### Frontend
- `src/services/api.ts` (MODIFIED - added createStudySessionWithAI)
- `src/components/CreateStudySessionDialog.tsx` (MODIFIED - integrated API call)

## Next Steps

After completing setup:
1. Test the end-to-end flow with sample content
2. Verify topics and questions are generated correctly
3. Play through a full study session to test progression
4. Check that topic locking works (can't skip ahead)
5. Test speed run mode

## Support

If you encounter issues:
1. Check backend logs for detailed error messages
2. Verify all prerequisites are running
3. Ensure environment variables are set correctly
4. Review this setup guide for missing steps
