# Text-to-Speech Integration Guide

This document describes the multi-provider Text-to-Speech (TTS) integration for the PlayStudy Card Dashboard Mentor Mode feature.

## Overview

The application now supports three TTS providers:

1. **OpenAI TTS** - High-quality AI voices with multiple personalities
2. **Google Cloud TTS** - Neural voices in multiple languages with excellent quality
3. **Browser TTS** - Built-in browser speech synthesis (fallback, no API key needed)

The application automatically selects the first configured provider, and users can switch between providers in the Mentor Mode interface.

## Provider Comparison

| Feature | OpenAI TTS | Google Cloud TTS | Browser TTS |
|---------|------------|------------------|-------------|
| **Quality** | Excellent | Excellent | Good (varies by browser) |
| **API Key Required** | Yes | Yes | No |
| **Voices** | 6 voices | 16+ Neural voices | System dependent |
| **Languages** | English | Multiple languages | Multiple languages |
| **Free Tier** | No | 1M chars/month | Unlimited |
| **Pricing** | $15-30/1M chars | $4/1M chars (after free tier) | Free |
| **Speed** | Fast | Fast | Very Fast |
| **AWS Deployment** | ✅ Easy | ✅ Easy | ✅ Works everywhere |

## Setup Instructions

### 1. OpenAI TTS Setup

1. Create an account at [OpenAI Platform](https://platform.openai.com/)
2. Navigate to [API Keys](https://platform.openai.com/api-keys)
3. Create a new API key
4. Add to your `.env` file:
   ```bash
   VITE_OPENAI_API_KEY=sk-your-api-key-here
   ```

**Available Voices:**
- `alloy` - Neutral and balanced
- `echo` - Male, clear and articulate
- `fable` - British accent, warm
- `onyx` - Deep male voice
- `nova` - Female, energetic
- `shimmer` - Female, soft and gentle

### 2. Google Cloud TTS Setup

1. Create a project in [Google Cloud Console](https://console.cloud.google.com/)
2. Enable the [Cloud Text-to-Speech API](https://console.cloud.google.com/apis/library/texttospeech.googleapis.com)
3. Create credentials:
   - Go to [API Credentials](https://console.cloud.google.com/apis/credentials)
   - Click "Create Credentials" → "API Key"
   - Copy the API key
4. Add to your `.env` file:
   ```bash
   VITE_GOOGLE_CLOUD_API_KEY=your-api-key-here
   ```

**Available Voices:**
- US English Neural2 voices (A, C, D, F, G, H, I, J)
- UK English Neural2 voices (A, B, C, D)
- Australian English Neural2 voices (A, B, C, D)
- More languages available (easily extensible)

### 3. Browser TTS (No Setup Required)

Browser TTS works automatically on all modern browsers. No API key needed.

## Usage

### In Development

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Add your API keys to `.env`

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Navigate to Mentor Mode and select your preferred TTS provider from the settings panel

### In the Application

1. Go to any study session
2. Click "Mentor Mode"
3. Use the "TTS Provider Settings" panel to:
   - Select your preferred provider (OpenAI, Google Cloud, or Browser)
   - Choose a voice from the available options
4. Click the play button to start narration

## AWS Deployment

### Environment Variables

When deploying to AWS (Amplify, EC2, ECS, etc.), set these environment variables:

```bash
# Required
VITE_API_URL=https://your-api-domain.com/api

# Optional - Add one or both for AI voices
VITE_OPENAI_API_KEY=sk-your-openai-key
VITE_GOOGLE_CLOUD_API_KEY=your-google-cloud-key
```

### AWS Amplify Deployment

1. Push your code to GitHub/GitLab
2. Connect your repository to AWS Amplify
3. In Amplify Console, go to "Environment variables"
4. Add your environment variables:
   - `VITE_API_URL`
   - `VITE_OPENAI_API_KEY` (optional)
   - `VITE_GOOGLE_CLOUD_API_KEY` (optional)
5. Deploy

### AWS EC2/ECS Deployment

1. Build the application:
   ```bash
   npm run build
   ```

2. Set environment variables in your deployment configuration:
   ```bash
   export VITE_API_URL=https://your-api-domain.com/api
   export VITE_OPENAI_API_KEY=sk-your-openai-key
   export VITE_GOOGLE_CLOUD_API_KEY=your-google-cloud-key
   ```

3. Serve the `dist` folder with Nginx or your preferred web server

### Docker Deployment

Create a `Dockerfile`:

```dockerfile
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .

ARG VITE_API_URL
ARG VITE_OPENAI_API_KEY
ARG VITE_GOOGLE_CLOUD_API_KEY

ENV VITE_API_URL=$VITE_API_URL
ENV VITE_OPENAI_API_KEY=$VITE_OPENAI_API_KEY
ENV VITE_GOOGLE_CLOUD_API_KEY=$VITE_GOOGLE_CLOUD_API_KEY

RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

Build and run:

```bash
docker build \
  --build-arg VITE_API_URL=https://your-api-domain.com/api \
  --build-arg VITE_OPENAI_API_KEY=sk-your-key \
  --build-arg VITE_GOOGLE_CLOUD_API_KEY=your-key \
  -t playstudy-app .

docker run -p 80:80 playstudy-app
```

## Architecture

### File Structure

```
src/
├── services/
│   ├── aiVoice.ts                 # Main TTS service (manages all providers)
│   └── tts/
│       ├── types.ts               # TypeScript interfaces
│       ├── openaiProvider.ts      # OpenAI TTS implementation
│       ├── googleCloudProvider.ts # Google Cloud TTS implementation
│       └── browserProvider.ts     # Browser TTS implementation
└── pages/
    └── MentorModePage.tsx         # UI with provider selection
```

### Provider Interface

All providers implement the `ITTSProvider` interface:

```typescript
interface ITTSProvider {
  isConfigured(): boolean;
  generateSpeech(text: string, options?: Partial<TTSVoiceOptions>): Promise<string>;
  getAvailableVoices(): TTSVoiceInfo[];
  getProviderName(): string;
}
```

### Adding a New Provider

To add a new TTS provider:

1. Create a new file in `src/services/tts/` (e.g., `azureProvider.ts`)
2. Implement the `ITTSProvider` interface
3. Add the provider to the `AIVoiceService` constructor in `aiVoice.ts`:
   ```typescript
   this.providers = new Map([
     ['openai', new OpenAITTSProvider()],
     ['google-cloud', new GoogleCloudTTSProvider()],
     ['azure', new AzureTTSProvider()], // New provider
     ['browser', new BrowserTTSProvider()],
   ]);
   ```
4. Update the `TTSProvider` type in `types.ts`:
   ```typescript
   export type TTSProvider = 'openai' | 'google-cloud' | 'azure' | 'browser';
   ```

## Cost Optimization

### Best Practices

1. **Use Browser TTS for development** - No API costs
2. **Choose Google Cloud for production** - Better pricing ($4/1M chars vs $15/1M chars)
3. **Use caching** - Both API providers cache generated audio in memory
4. **Optimize narrative length** - Shorter, more focused narrations reduce costs
5. **Monitor usage** - Track API usage in your cloud provider console

### Estimated Costs

Average study session narration: ~1000 characters

| Provider | Cost per session | 1000 sessions | 10,000 sessions |
|----------|------------------|---------------|-----------------|
| OpenAI | $0.015 | $15 | $150 |
| Google Cloud | $0.004 | $4 | $40 |
| Browser | $0 | $0 | $0 |

## Troubleshooting

### Provider Not Working

1. **Check API key configuration**
   - Verify the API key is set in `.env`
   - Check the key has proper permissions
   - Ensure the API is enabled in your cloud console

2. **Check browser console for errors**
   - Open DevTools (F12)
   - Look for TTS-related errors
   - Common issues:
     - CORS errors (API key restrictions)
     - Network errors (API quota exceeded)
     - Authentication errors (invalid API key)

3. **Test with Browser TTS first**
   - Switch to Browser TTS to verify the UI works
   - This helps isolate API configuration issues

### Audio Not Playing

1. Check browser audio permissions
2. Verify audio is not muted
3. Try a different browser
4. Check network connectivity

### API Quota Exceeded

1. Monitor usage in your cloud provider console
2. Set up billing alerts
3. Switch to Browser TTS as a fallback
4. Consider implementing rate limiting

## Security Best Practices

1. **Never commit API keys** - Use `.env` files (already in `.gitignore`)
2. **Use environment variables** - Don't hardcode keys in source code
3. **Restrict API keys** - Limit keys to specific APIs and domains
4. **Rotate keys regularly** - Generate new keys periodically
5. **Monitor usage** - Set up alerts for unusual activity

## Future Enhancements

Potential improvements:

1. **Server-side TTS** - Move TTS generation to backend for better security
2. **Caching layer** - Use Redis/S3 to cache generated audio
3. **Voice customization** - Add pitch, speed, volume controls per provider
4. **Multilingual support** - Add language selection for non-English voices
5. **Offline mode** - Pre-generate audio for offline playback
6. **Audio streaming** - Stream audio as it's generated (OpenAI supports this)

## Support

For issues or questions:
- Check the troubleshooting section above
- Review provider documentation:
  - [OpenAI TTS Docs](https://platform.openai.com/docs/guides/text-to-speech)
  - [Google Cloud TTS Docs](https://cloud.google.com/text-to-speech/docs)
- Create an issue in the repository

## License

This TTS integration follows the same license as the main application.
