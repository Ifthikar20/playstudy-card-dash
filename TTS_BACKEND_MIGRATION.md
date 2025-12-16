# TTS Backend Migration - Security Update

## What Changed?

TTS (Text-to-Speech) functionality has been moved from the frontend to the backend for security and best practices.

### Before (❌ Insecure)
- TTS API keys were in frontend `.env` with `VITE_` prefix
- API keys were exposed in compiled JavaScript
- Direct API calls from browser to OpenAI/Google Cloud

### After (✅ Secure)
- TTS API keys are securely stored in backend
- Frontend calls backend API endpoints
- Backend handles all TTS provider communication
- Better rate limiting and caching

## Migration Steps

### 1. Move API Keys to Backend

**Remove from frontend `.env`:**
```bash
# DELETE these lines from .env (root directory)
VITE_OPENAI_API_KEY=...
VITE_GOOGLE_CLOUD_API_KEY=...
```

**Add to backend `.env`:**
```bash
# ADD these to backend/.env
OPENAI_API_KEY=your-openai-api-key
GOOGLE_CLOUD_API_KEY=your-google-cloud-api-key
```

### 2. Install Backend Dependencies

```bash
cd backend
pip install -r requirements.txt
```

### 3. Restart Services

**Backend:**
```bash
cd backend
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

**Frontend:**
```bash
npm run dev
```

## New Backend API Endpoints

### POST `/api/tts/generate`
Generate speech from text.

**Request:**
```json
{
  "text": "Hello, this is a test",
  "provider": "google-cloud",
  "voice": "en-US-Neural2-F",
  "speed": 1.0,
  "pitch": 0.0,
  "model": "tts-1"
}
```

**Response:** MP3 audio file

**Headers Required:**
- `Authorization: Bearer <token>`

### GET `/api/tts/providers`
Get list of available providers and their configuration status.

**Response:**
```json
[
  {
    "id": "openai",
    "name": "OpenAI TTS",
    "configured": true
  },
  {
    "id": "google-cloud",
    "name": "Google Cloud TTS",
    "configured": true
  }
]
```

### GET `/api/tts/voices`
Get all available voices grouped by provider.

**Response:**
```json
{
  "openai": [
    {
      "id": "alloy",
      "name": "Alloy",
      "description": "Neutral and balanced",
      "gender": "neutral"
    }
  ],
  "google-cloud": [
    {
      "id": "en-US-Neural2-F",
      "name": "US Neural Female F",
      "description": "Female, energetic and engaging",
      "language": "en-US",
      "gender": "female"
    }
  ]
}
```

### GET `/api/tts/voices/{provider}`
Get voices for a specific provider.

## Frontend Changes

The frontend `aiVoiceService` now:

1. **Fetches providers from backend:**
   ```typescript
   const providers = await aiVoiceService.fetchProviders();
   ```

2. **Fetches voices from backend:**
   ```typescript
   const voices = await aiVoiceService.fetchVoices('google-cloud');
   ```

3. **Calls backend for TTS generation:**
   ```typescript
   await aiVoiceService.speak(text, {
     provider: 'google-cloud',
     voice: 'en-US-Neural2-F',
     speed: 1.0
   });
   ```

## Benefits of This Migration

### Security
- ✅ API keys not exposed in frontend code
- ✅ Keys stored securely in backend environment
- ✅ No risk of key extraction from browser

### Performance
- ✅ Backend caching with Redis (24-hour TTL)
- ✅ Reduced duplicate API calls
- ✅ Better rate limiting control

### Cost Control
- ✅ Centralized usage monitoring
- ✅ Server-side rate limiting (30 req/min per user)
- ✅ Cache reduces redundant API calls

### Maintainability
- ✅ Single source of truth for TTS logic
- ✅ Easier to add new providers
- ✅ Better error handling and logging

## Troubleshooting

### "Authentication required" error

**Problem:** Frontend trying to use TTS without being logged in.

**Solution:** Make sure you're logged in. Browser TTS works without authentication as fallback.

### "Provider not configured" error

**Problem:** TTS API keys not set in backend `.env`.

**Solution:**
1. Check `backend/.env` has the API keys
2. Restart backend server
3. Keys must be named exactly: `OPENAI_API_KEY` or `GOOGLE_CLOUD_API_KEY` (no `VITE_` prefix)

### Backend won't start - "Extra inputs not permitted"

**Problem:** `VITE_GOOGLE_CLOUD_API_KEY` in backend `.env`.

**Solution:** Remove ALL `VITE_*` variables from `backend/.env`. Those are frontend-only.

## AWS Deployment

### Environment Variables

**Backend (ECS, EC2, Lambda):**
```bash
# Required
DATABASE_URL=...
REDIS_URL=...
SECRET_KEY=...
DEEPSEEK_API_KEY=...

# Optional - TTS
OPENAI_API_KEY=sk-...
GOOGLE_CLOUD_API_KEY=AIza...
```

**Frontend (Amplify, S3+CloudFront):**
```bash
# Only need this
VITE_API_URL=https://api.yourdom ain.com/api
```

## Testing the Migration

1. **Start backend:**
   ```bash
   cd backend
   python -m uvicorn app.main:app --reload
   ```

2. **Check TTS endpoints:**
   ```bash
   # Get providers (requires auth token)
   curl http://localhost:8000/api/tts/providers \
     -H "Authorization: Bearer YOUR_TOKEN"
   ```

3. **Start frontend:**
   ```bash
   npm run dev
   ```

4. **Test in Mentor Mode:**
   - Go to any study session
   - Click "Mentor Mode"
   - Select a TTS provider
   - Click play - should generate speech via backend

## Rollback (if needed)

If you need to temporarily rollback:

1. Keep backend running with TTS endpoints
2. Frontend will fallback to browser TTS if backend is unavailable
3. Original frontend TTS code has been removed - would need to restore from git history

## Questions?

- Backend TTS code: `backend/app/services/tts_providers.py`
- Backend API: `backend/app/api/tts.py`
- Frontend service: `src/services/aiVoice.ts`
- Configuration: `backend/.env.example` and `.env.example`
