# TTS Backend Logging - Debugging Guide

## Overview

Comprehensive backend logging has been added to help diagnose Google Cloud TTS configuration issues. This guide explains how to use the logs to identify and fix problems.

## Where the Logs Appear

All TTS logs appear in your **backend terminal** where you run `uvicorn`. Look for lines starting with:
- `INFO:app.config` - Configuration loading
- `INFO:app.services.tts_providers` - Provider initialization
- `INFO:app.api.tts` - API endpoint calls

## What Gets Logged

### 1. Configuration Loading (at startup)

When the backend starts, you'll see:

```
============================================================
GOOGLE CLOUD TTS CONFIGURATION
============================================================
INFO:app.config:Status: ✅ Configured
INFO:app.config:API Key (first 10 chars): AIzaSyBcd...
============================================================
```

**What to check:**
- ✅ means the key is present in `backend/.env`
- ❌ means the key is missing or empty
- First 10 characters help verify you copied the right key

### 2. Provider Initialization

When the provider is checked, you'll see:

```
INFO:app.services.tts_providers:[Google Cloud TTS] Initializing provider - API Key: ✅ Present
INFO:app.services.tts_providers:[Google Cloud TTS] API Key (first 10 chars): AIzaSyBcd...
INFO:app.services.tts_providers:[Google Cloud TTS] is_configured() = True
```

**What to check:**
- Shows if API key is present or missing
- Shows the result of `is_configured()` check

### 3. Provider List Request

When frontend calls `/api/tts/providers`, you'll see:

```
============================================================
INFO:app.api.tts:[API /tts/providers] Endpoint called
INFO:app.api.tts:[API /tts/providers] User: user@example.com
============================================================
INFO:app.services.tts_providers:[TTSProviderFactory] Getting available providers...
INFO:app.services.tts_providers:[TTSProviderFactory] Checking provider: google-cloud
INFO:app.services.tts_providers:[Google Cloud TTS] Initializing provider - API Key: ✅ Present
INFO:app.services.tts_providers:[Google Cloud TTS] API Key (first 10 chars): AIzaSyBcd...
INFO:app.services.tts_providers:[Google Cloud TTS] is_configured() = True
INFO:app.services.tts_providers:[TTSProviderFactory] Provider 'google-cloud': {'id': 'google-cloud', 'name': 'Google Cloud', 'configured': True}
INFO:app.services.tts_providers:[TTSProviderFactory] Total providers: 1
INFO:app.services.tts_providers:[TTSProviderFactory] Configured providers: 1
INFO:app.services.tts_providers:[TTSProviderFactory] Final provider list: [{'id': 'google-cloud', 'name': 'Google Cloud', 'configured': True}]
============================================================
INFO:app.api.tts:[API /tts/providers] Returning 1 providers:
INFO:app.api.tts:  - google-cloud: configured=True
============================================================
```

**What to check:**
- Shows exactly what provider is being returned to frontend
- Shows the configured status
- Verifies the API key is being loaded correctly

### 4. TTS Generation Request

When you click play in Mentor Mode:

```
============================================================
INFO:app.api.tts:[API /tts/generate] TTS generation requested
INFO:app.api.tts:[API /tts/generate] User: user@example.com
INFO:app.api.tts:[API /tts/generate] Provider: google-cloud
INFO:app.api.tts:[API /tts/generate] Voice: en-US-Neural2-F
INFO:app.api.tts:[API /tts/generate] Text length: 156 chars
INFO:app.api.tts:[API /tts/generate] Calling tts_service.generate_speech()...
INFO:app.api.tts:[API /tts/generate] ✅ Successfully generated 8192 bytes of audio
============================================================
```

**What to check:**
- Shows which provider is being used
- Shows which voice is selected
- Shows if generation succeeded (✅) or failed (❌)

## Common Issues and What Logs Show

### Issue 1: Google Cloud TTS Not Showing in Frontend

**Symptoms:** Only see "Browser TTS" in dropdown

**Check logs for:**
```
INFO:app.config:Status: ❌ Not configured
```

**Fix:**
1. Edit `backend/.env`
2. Add line: `GOOGLE_CLOUD_API_KEY=your-actual-api-key`
3. Restart backend
4. Check logs show ✅ Configured

### Issue 2: Provider Shows as "Not Configured"

**Symptoms:** Google Cloud appears in list but says "Not configured"

**Check logs for:**
```
INFO:app.services.tts_providers:[Google Cloud TTS] is_configured() = False
```

**Fix:**
- API key is empty or whitespace only
- Check `backend/.env` has actual key, not placeholder
- Restart backend

### Issue 3: Authentication Errors

**Symptoms:** Frontend shows "Authentication required"

**Check logs for:**
```
ERROR:app.api.tts:[API /tts/providers] Error: Unauthorized
```

**Fix:**
- Log in to the app first
- Browser needs valid auth token in localStorage
- Try logging out and back in

### Issue 4: API Key Invalid

**Symptoms:** TTS generation fails with API error

**Check logs for:**
```
ERROR:app.api.tts:[API /tts/generate] ❌ Error: Google Cloud TTS API error: {...}
```

**Fix:**
- Check API key is correct (compare first 10 chars in logs)
- Verify key has Text-to-Speech API enabled in Google Cloud Console
- Check billing is enabled for the project

## How to Test

### Step 1: Start Backend and Check Startup Logs

```bash
cd backend
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Look for the configuration status section. Should see:
- ✅ if Google Cloud TTS is configured
- First 10 characters of the API key

### Step 2: Open Mentor Mode and Check Browser Console

Open browser DevTools (F12), go to Console tab. Look for:
```
[Mentor Mode] Fetching providers...
[Mentor Mode] Providers received: [{...}]
[Mentor Mode] Using provider: google-cloud
```

### Step 3: Check Backend Logs When Loading Mentor Mode

When you open Mentor Mode, backend logs should show:
```
[API /tts/providers] Endpoint called
...
[API /tts/providers] Returning 1 providers:
  - google-cloud: configured=True
```

### Step 4: Click Play and Check Logs

Backend should show:
```
[API /tts/generate] TTS generation requested
[API /tts/generate] Provider: google-cloud
...
[API /tts/generate] ✅ Successfully generated ... bytes of audio
```

## Quick Checklist

Use this checklist to verify everything is working:

- [ ] Backend starts without errors
- [ ] Startup logs show `Status: ✅ Configured`
- [ ] Startup logs show first 10 chars of API key
- [ ] Provider initialization logs show `API Key: ✅ Present`
- [ ] `is_configured()` returns `True` for Google Cloud provider
- [ ] `/tts/providers` endpoint returns `configured: true` for google-cloud
- [ ] Frontend receives provider (check browser console)
- [ ] Mentor Mode shows "Google Cloud" in provider dropdown (or uses it automatically)
- [ ] Clicking play generates audio successfully
- [ ] Logs show `✅ Successfully generated ... bytes of audio`

## Still Having Issues?

If Google Cloud TTS still doesn't work after checking all logs:

1. **Share the logs:** Copy the startup section and provider check section
2. **Check API key validity:**
   ```bash
   # Test Google Cloud TTS API directly
   curl "https://texttospeech.googleapis.com/v1/voices?key=YOUR_API_KEY"
   ```
   Should return JSON with available voices, not an error

3. **Verify API is enabled:**
   - Go to Google Cloud Console
   - Enable "Cloud Text-to-Speech API"
   - Verify billing is enabled

4. **Check network/firewall:**
   - Backend needs to reach `https://texttospeech.googleapis.com`
   - No proxy or firewall blocking the request

## Log Levels

To see even more detailed logs, you can increase log level:

```bash
# In backend/.env
DEBUG=True
```

Or start with verbose logging:
```bash
LOG_LEVEL=DEBUG python -m uvicorn app.main:app --reload
```
