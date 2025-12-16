# Mentor Mode Voice Troubleshooting

## Quick Debug Steps

### 1. Check Your Setup

**Is your backend running?**
```bash
cd backend
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Should see:
```
INFO:     Uvicorn running on http://0.0.0.0:8000
INFO:     Application startup complete
```

**Is your frontend running?**
```bash
npm run dev
```

Should see:
```
VITE ready in XXX ms
Local: http://localhost:5173/
```

### 2. Check Browser Console

Open browser DevTools (F12) and look for errors:

**Common Issues:**

1. **"Authentication required"**
   - You're not logged in
   - **Fix:** Log in first, then try Mentor Mode

2. **"Failed to fetch"**
   - Backend is not running
   - **Fix:** Start backend with command above

3. **"Provider not configured"**
   - No TTS API key in backend `.env`
   - **Fix:** Use Browser TTS (select it from Provider dropdown)

4. **CORS errors**
   - Backend CORS not configured for your frontend URL
   - **Fix:** Check `ALLOWED_ORIGINS` in backend/.env

### 3. Try Browser TTS First

Browser TTS works without any configuration:

1. Go to Mentor Mode
2. In "TTS Provider Settings", select **"Browser TTS"**
3. Click Play ▶️

This should work immediately!

### 4. Check Network Tab

In DevTools > Network tab, when you click play:

**For API-based TTS (OpenAI/Google Cloud):**
- Should see: `POST /api/tts/generate`
- Status should be: `200 OK`
- Response should be audio file

**If you see:**
- `401 Unauthorized` → You're not logged in
- `400 Bad Request` → Check error message in response
- `500 Internal Server Error` → Backend error (check backend logs)
- `Failed to fetch` → Backend not running

### 5. Test Backend Directly

Test if TTS endpoint works:

```bash
# Get your auth token from browser localStorage
# Open Console (F12) and run:
localStorage.getItem('access_token')

# Then test the endpoint:
curl http://localhost:8000/api/tts/providers \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

Should return:
```json
[
  {"id": "openai", "name": "OpenAI TTS", "configured": true},
  {"id": "google-cloud", "name": "Google Cloud TTS", "configured": true}
]
```

### 6. Backend Configuration

Check `backend/.env` has:

```bash
# Required for app
DATABASE_URL=postgresql+psycopg://localhost/playstudy_db
REDIS_URL=redis://localhost:6379/0
SECRET_KEY=your-secret-key
DEEPSEEK_API_KEY=your-deepseek-key

# Optional - for AI voices (if you want OpenAI or Google Cloud)
GOOGLE_CLOUD_API_KEY=your-google-cloud-api-key
# OR
OPENAI_API_KEY=your-openai-api-key
```

### 7. Common Solutions

#### Voice Not Playing at All

**Solution 1: Use Browser TTS**
- Select "Browser TTS" from provider dropdown
- Click play
- Works instantly, no configuration needed

**Solution 2: Check Authentication**
```javascript
// In browser console (F12)
console.log(localStorage.getItem('access_token'));
```
- If `null`, you need to log in first
- Go to login page, then come back to Mentor Mode

**Solution 3: Check Backend Logs**
Look at your backend terminal for errors:
```
ERROR: ...
```

#### Audio Loads But Doesn't Play

- Check browser audio is not muted
- Check volume slider in Mentor Mode
- Try different browser (Chrome works best)
- Check browser autoplay policy

#### "Preparing your lesson..." Forever

- Backend is slow or not responding
- Check backend terminal for errors
- Check network tab for failed requests
- Try Browser TTS instead

### 8. Expected Behavior

**When working correctly:**

1. Click "Mentor Mode" from session
2. See provider settings at top
3. Select a provider (Browser TTS for instant test)
4. Click big Play ▶️ button
5. See "Preparing your lesson..." for 1-3 seconds
6. Then "Listening to your AI mentor" with green pulsing dot
7. Voice starts playing explaining the content
8. Progress shows as narration plays

### 9. Report Issues

If still not working, check:

1. **Browser Console (F12)** - Any errors?
2. **Backend Terminal** - Any errors?
3. **Network Tab** - Failed requests?

Share this info for debugging.

## Quick Test Commands

```bash
# 1. Test if backend is responding
curl http://localhost:8000/health

# 2. Test if frontend can reach backend
curl http://localhost:8000/api/tts/providers

# 3. Check Redis is running
redis-cli ping
# Should return: PONG

# 4. Check Postgres is running
psql -U postgres -c "SELECT 1"
```

## Still Stuck?

**Try this simple test:**

1. Stop everything
2. Start backend: `cd backend && python -m uvicorn app.main:app --reload`
3. Start frontend: `npm run dev`
4. Log in to the app
5. Create a study session
6. Go to Mentor Mode
7. Select "Browser TTS" (no config needed!)
8. Click Play

Browser TTS should work immediately!
