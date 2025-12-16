# Google Cloud Text-to-Speech Setup Guide

This is a quick guide to get your Google Cloud TTS API key for the PlayStudy Mentor Mode.

## Why Google Cloud TTS?

- ✅ **Free tier**: 1 million characters per month
- ✅ **Cheaper**: $4 per 1M chars (vs OpenAI's $15)
- ✅ **High quality**: Neural2 voices sound excellent
- ✅ **Multiple accents**: US, UK, Australian English

## Step-by-Step Setup (5 minutes)

### 1. Create Google Cloud Account

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Sign in with your Google account
3. If it's your first time:
   - Click "Get started for free" or "Try for free"
   - Enter your billing information (you get $300 free credits)
   - Don't worry - you won't be charged without your permission

### 2. Create a New Project

1. Click the project dropdown at the top (says "Select a project")
2. Click "NEW PROJECT"
3. Enter a project name (e.g., "playstudy-tts")
4. Click "CREATE"
5. Wait for the project to be created (takes ~10 seconds)
6. Select your new project from the dropdown

### 3. Enable Text-to-Speech API

1. Go to [Text-to-Speech API page](https://console.cloud.google.com/apis/library/texttospeech.googleapis.com)

   OR manually navigate:
   - Click the hamburger menu (☰) in top left
   - Go to "APIs & Services" → "Library"
   - Search for "Text-to-Speech"
   - Click "Cloud Text-to-Speech API"

2. Click the blue "ENABLE" button
3. Wait for it to enable (~5-10 seconds)

### 4. Create API Key

1. Go to [Credentials page](https://console.cloud.google.com/apis/credentials)

   OR manually navigate:
   - Click hamburger menu (☰)
   - Go to "APIs & Services" → "Credentials"

2. Click "CREATE CREDENTIALS" at the top
3. Select "API Key"
4. Your API key will be created and displayed in a popup
5. **Copy the API key** - you'll need it for your `.env` file

### 5. (Optional but Recommended) Restrict Your API Key

For security, restrict your API key:

1. In the popup with your new API key, click "EDIT API KEY"

   OR
   - Go to the Credentials page
   - Find your API key in the list
   - Click the pencil icon (✏️) to edit

2. Under "API restrictions":
   - Select "Restrict key"
   - Check only "Cloud Text-to-Speech API"

3. Under "Application restrictions" (optional):
   - For development: Leave as "None"
   - For production: Select "HTTP referrers" and add your domain

4. Click "SAVE"

### 6. Add API Key to Your Project

1. In your project directory, open (or create) `.env` file:
   ```bash
   cp .env.example .env
   ```

2. Add your API key:
   ```bash
   VITE_GOOGLE_CLOUD_API_KEY=AIza...your-actual-key-here
   ```

3. Save the file

### 7. Test It!

1. Start your development server:
   ```bash
   npm run dev
   ```

2. Go to any study session → Click "Mentor Mode"

3. In the "TTS Provider Settings" section:
   - Select "Google Cloud TTS" from the Provider dropdown
   - Choose a voice (try "US Neural Female F" - it's great!)
   - Click the play button

4. You should hear AI narration! 🎉

## Troubleshooting

### "API key not configured" warning

- Make sure you saved the `.env` file
- Restart your dev server (`npm run dev`)
- Check that the key doesn't have quotes around it

### "API error" messages

1. **"API not enabled"**
   - Go back to step 3 and enable the Text-to-Speech API

2. **"Invalid API key"**
   - Double-check you copied the entire key
   - Make sure there are no extra spaces

3. **"Quota exceeded"**
   - You've used your free tier
   - Check usage in [Google Cloud Console](https://console.cloud.google.com/apis/api/texttospeech.googleapis.com/quotas)
   - Switch to Browser TTS as fallback

### Browser console shows CORS errors

- Your API key might be restricted to specific domains
- Go to Credentials → Edit your API key
- Under "Application restrictions", make sure it allows your domain (or use "None" for development)

## Free Tier Limits

Google Cloud TTS Free Tier:
- **1 million characters per month FREE**
- Resets on the 1st of each month
- After that: $4 per 1M characters (Neural voices)

Typical usage:
- One study session narration: ~1,000 characters
- You can do ~1,000 sessions per month for free
- That's 33 sessions per day!

## Monitoring Usage

Check your usage anytime:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project
3. Go to "APIs & Services" → "Dashboard"
4. Click "Text-to-Speech API"
5. View usage charts

## Setting Up Billing Alerts (Recommended)

To avoid unexpected charges:

1. Go to [Billing](https://console.cloud.google.com/billing)
2. Click "Budgets & alerts"
3. Click "CREATE BUDGET"
4. Set a budget (e.g., $5/month)
5. Add alert at 50%, 90%, 100%
6. You'll get email notifications

## Cost Comparison

For 1 million characters:

| Provider | Cost | Free Tier |
|----------|------|-----------|
| **Google Cloud** | $4 | 1M chars/month |
| OpenAI | $15 | None |
| Browser TTS | $0 | Unlimited |

## Next Steps

- Try different voices to find your favorite
- See [TTS_INTEGRATION.md](./TTS_INTEGRATION.md) for AWS deployment
- Configure multiple providers for flexibility

## Need Help?

- [Google Cloud TTS Documentation](https://cloud.google.com/text-to-speech/docs)
- [Google Cloud TTS Pricing](https://cloud.google.com/text-to-speech/pricing)
- [Google Cloud Support](https://cloud.google.com/support)
