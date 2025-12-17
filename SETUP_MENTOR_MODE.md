# 🎓 Mentor Mode Setup Instructions

## Overview
The Mentor Mode uses AI to generate comprehensive, teacher-style lessons with voice narration. This guide will help you configure the required API keys and apply database changes.

## 📋 Prerequisites

You'll need two API keys:
1. **DeepSeek AI** - for generating lesson content
2. **OpenAI TTS** - for voice narration

## 🔑 Step 1: Get API Keys

### DeepSeek AI
1. Go to: https://platform.deepseek.com/
2. Sign up or log in
3. Navigate to API Keys section
4. Create a new API key
5. Copy the key (starts with `sk-`)

### OpenAI
1. Go to: https://platform.openai.com/api-keys
2. Sign up or log in
3. Click "Create new secret key"
4. Give it a name (e.g., "PlayStudy TTS")
5. Copy the key (starts with `sk-`)

## ⚙️ Step 2: Configure Backend

1. Open `backend/.env` file
2. Replace the placeholder values:

```env
# DeepSeek AI Configuration
DEEPSEEK_API_KEY=sk-your-actual-deepseek-key-here

# OpenAI TTS Configuration
OPENAI_API_KEY=sk-your-actual-openai-key-here
```

3. Save the file

## 🗄️ Step 3: Apply Database Migration

Run this command to add the mentor_narrative column to your database:

### Option A: Using psql directly
```bash
cd backend
psql $DATABASE_URL -f migrations/add_mentor_narrative_to_topics.sql
```

### Option B: Using Python migration script
```bash
cd backend
python run_migration.py
```

### Option C: Manual SQL
Connect to your database and run:
```sql
ALTER TABLE topics ADD COLUMN IF NOT EXISTS mentor_narrative TEXT;
```

## 🚀 Step 4: Restart Backend

After adding API keys, restart your backend server:

```bash
cd backend
# Stop the current server (Ctrl+C)
# Then restart it
uvicorn app.main:app --reload
```

## ✅ Step 5: Test It Out

1. Go to the Dashboard
2. Click on any study session
3. Click "AI Mentor" button
4. Click Play ▶️
5. You should hear the AI voice and see text appearing in sync!

## 🎯 Features

### Voice Playback
- **OpenAI TTS** generates natural-sounding speech
- Choose from 6 voices: Alloy, Echo, Fable, Onyx, Nova, Shimmer
- Speech speed: ~170 words/minute

### Content Generation
- **DeepSeek AI** creates comprehensive lessons including:
  - 🎯 Clear concept explanations
  - 💡 Detailed breakdowns
  - ✅ Key answers (highlighted)
  - 🌍 2-3 real-world examples per concept
  - ❓ "Why this matters" sections
  - 📌 Key takeaways
  - 🎓 Lesson summaries

### Session Persistence
- Lessons are **cached** in the database
- Going back to a session **replays the same content**
- No need to regenerate (saves API costs!)

## 💰 Pricing Estimates

### DeepSeek AI
- Free tier: First $5 worth of usage
- After: ~$0.14 per 1M input tokens, $0.28 per 1M output tokens
- **Estimated cost**: ~$0.01-0.02 per lesson

### OpenAI TTS
- tts-1 model: $15 per 1M characters
- **Estimated cost**: ~$0.01-0.03 per lesson

**Total cost per lesson**: ~$0.02-0.05

## 🐛 Troubleshooting

### "API keys not configured" error
- Make sure API keys are in `backend/.env`
- Restart the backend server
- Check that keys don't have extra spaces or quotes

### No voice playing
- Check browser console for errors
- Ensure OpenAI API key is valid
- Try a different voice
- Check browser's audio permissions

### "Failed to generate AI content"
- Check DeepSeek API key is valid
- Check backend logs for detailed errors
- Ensure you have API credits remaining

### Migration errors
- Ensure database is running
- Check DATABASE_URL in .env
- Verify you have write permissions to database

## 📝 Notes

- Narratives are stored in `topics.mentor_narrative` column
- Each topic generates content once, then caches it
- You can delete cached content by setting `mentor_narrative = NULL` in the database
- The system will regenerate if narrative is missing

## 🎉 You're All Set!

Enjoy your AI-powered mentor sessions! 🚀
