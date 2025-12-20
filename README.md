# Playstudy Card Dashboard

A modern, interactive study platform that transforms educational content into engaging, game-like experiences.

## 🚀 Quick Start

### Frontend Setup

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

Visit http://localhost:5173

### Backend Setup

```bash
# Run the quick start script
./backend-quickstart.sh
```

See [Backend Implementation Guide](./BACKEND_IMPLEMENTATION.md) for detailed setup.

---

## 📚 New: Backend API Documentation

### Complete Implementation Guides

- **[TTS Integration Guide](./TTS_INTEGRATION.md)** - Multi-provider Text-to-Speech setup and AWS deployment
- **[API Integration Guide](./API_INTEGRATION.md)** - How the consolidated API architecture works
- **[Backend Implementation](./BACKEND_IMPLEMENTATION.md)** - Complete Python FastAPI backend with security features
- **[Security Checklist](./SECURITY_CHECKLIST.md)** - Comprehensive security implementation checklist

### Key Features

✅ **AI-Powered Mentor Mode** 🎙️ NEW!
- Multi-provider Text-to-Speech support (OpenAI TTS, Google Cloud TTS, Browser TTS)
- AI-narrated teaching experience with interactive voice
- Switch between providers and voices in real-time
- Cost-effective options for production deployment
- See [TTS Integration Guide](./TTS_INTEGRATION.md) for setup details

✅ **Single API Call Architecture**
- Consolidated `/api/app-data` endpoint returns all data in ONE request
- React Query caching with 5-minute TTL
- Automatic fallback to mock data for development
- Type-safe with TypeScript

✅ **Security Features** (Backend)
- JWT authentication with token expiration
- Bcrypt password hashing
- Rate limiting (30 req/min per user, 1000 req/hour)
- CORS protection with origin whitelist
- SQL injection prevention (SQLAlchemy ORM)
- XSS protection headers
- Input validation with Pydantic
- User data isolation
- Redis caching with TTL

✅ **Backend Tech Stack**
- FastAPI (async Python framework)
- PostgreSQL database
- Redis for caching
- SQLAlchemy ORM
- JWT authentication
- Comprehensive security features

### API Endpoint Structure

**GET `/api/app-data`** - Single consolidated endpoint

Returns:
```json
{
  "games": [...],           // All available games
  "studySessions": [...],   // User's study sessions
  "userProfile": {...},     // User profile data
  "stats": {...}            // User statistics
}
```

**Authentication**: Required (Bearer token)
**Rate Limit**: 30 requests/minute
**Cache**: 5 minutes TTL

---

## How can I edit this code?

**Use your preferred IDE**

Clone this repo and push changes using your favorite code editor.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

You can deploy this project using any modern hosting platform that supports Vite/React applications, such as:
- Vercel
- Netlify
- AWS Amplify
- Cloudflare Pages

Build the production bundle with `npm run build` and deploy the `dist` folder.
