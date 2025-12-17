# 🚨 QUICK FIX: Google TTS Not Working

## The Problem

Your `backend/.env` file still has **placeholder values** instead of real API keys.

**Current status:**
```
GOOGLE_CLOUD_API_KEY=your-google-cloud-api-key-here  ❌ PLACEHOLDER
DEEPSEEK_API_KEY=your-deepseek-api-key-here          ❌ PLACEHOLDER
```

This is why you're seeing **Browser TTS** instead of **Google Cloud TTS**.

---

## ⚡ Quick Fix (2 minutes)

### Option 1: Use the Setup Script (Recommended)

```bash
cd ~/Downloads/project-ps-full/playstudy-card-dash
./setup_google_tts.sh
```

This will guide you through adding your API key.

### Option 2: Manual Edit

1. **Open the .env file:**
   ```bash
   nano backend/.env
   # or
   code backend/.env
   # or use any text editor
   ```

2. **Find these lines:**
   ```bash
   GOOGLE_CLOUD_API_KEY=your-google-cloud-api-key-here
   DEEPSEEK_API_KEY=your-deepseek-api-key-here
   ```

3. **Replace with your actual keys:**
   ```bash
   GOOGLE_CLOUD_API_KEY=AIzaSyBq1234567890abcdefghijklmnopqrst
   DEEPSEEK_API_KEY=sk-1234567890abcdefghijklmnopqrstuvwxyz
   ```

4. **Save and close** (Ctrl+X, then Y, then Enter if using nano)

---

## 🔍 Where to Get API Keys

### Google Cloud API Key
1. Go to: https://console.cloud.google.com/apis/credentials
2. Create a project or select existing one
3. Click **"Create Credentials"** → **"API Key"**
4. Copy the key (starts with `AIza`)
5. **Enable Text-to-Speech API**: https://console.cloud.google.com/apis/library/texttospeech.googleapis.com

### DeepSeek API Key
1. Go to: https://platform.deepseek.com/
2. Sign up or log in
3. Go to API Keys section
4. Create a new key
5. Copy the key (starts with `sk-`)

---

## ✅ Verify It's Working

### 1. Run the Troubleshooting Script:
```bash
python3 troubleshoot_tts.py
```

You should see:
```
✅ GOOGLE_CLOUD_API_KEY is configured
   Key starts with: AIzaSyBq1234567...
   Key length: 39 characters
```

### 2. Restart Your Backend:
```bash
# In your backend terminal, press Ctrl+C to stop
# Then restart:
cd backend
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### 3. Look for These Logs:
```
======================================================================
🔊 GOOGLE CLOUD TTS CONFIGURATION CHECK
======================================================================
📋 Key Exists: True
📏 Key Length: 39 characters
⚠️  Is Placeholder: False
✅ Status: CONFIGURED
🔑 API Key (first 15 chars): AIzaSyBq1234567...
======================================================================
```

### 4. Test in Frontend:
- Open Mentor Mode in your app
- Click the **Voice Settings** dropdown
- You should see **"Google Cloud"** as an option with no "(Not configured)" message
- Click **Play**
- Open browser console (F12) - you should see Google Cloud TTS being used

---

## 🎵 Audio Player Behavior

Once Google TTS is working, the audio will:
- ✅ Play as streaming MP3 audio (not browser TTS)
- ✅ Show live transcript word-by-word
- ✅ Have Play/Pause/Skip controls
- ✅ Auto-scroll transcript
- ✅ Use high-quality neural voices

**Current behavior with placeholder:**
- ❌ Falls back to browser TTS (robotic voice)
- ❌ No provider selection available

---

## 🐛 Still Not Working?

1. **Check the logs** when backend starts - look for the emoji headers
2. **Run troubleshooting:** `python3 troubleshoot_tts.py`
3. **Verify .env was saved:** `cat backend/.env | grep GOOGLE_CLOUD_API_KEY`
4. **Restart backend** after changing .env
5. **Clear browser cache** (Ctrl+Shift+R)

---

## 📝 Files Created for You

- **`troubleshoot_tts.py`** - Comprehensive diagnostic script
- **`setup_google_tts.sh`** - Interactive setup helper
- **`QUICK_FIX_GOOGLE_TTS.md`** - This guide

Run any of these for help!
