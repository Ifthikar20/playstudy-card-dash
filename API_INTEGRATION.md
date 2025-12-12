# API Integration Documentation

## Overview

The application uses a consolidated API approach where **a single API call** fetches all necessary data to paint the entire page. This reduces network overhead and improves initial load performance.

## Architecture

### 1. API Service (`src/services/api.ts`)

The API service provides a single endpoint that fetches all application data:

```typescript
fetchAppData(): Promise<AppData>
```

This function:
- Makes ONE API call to `/api/app-data`
- Returns all games, study sessions, user profile, and stats
- Falls back to mock data if the API is unavailable (for development)

### 2. React Query Hook (`src/hooks/useAppData.ts`)

The `useAppData` hook wraps the API call with React Query for:
- Automatic caching (5 minutes stale time)
- Background refetching
- Loading and error states
- Retry logic (2 retries)

Usage:
```typescript
const { data, isLoading, isError } = useAppData();
```

### 3. Zustand Store (`src/store/appStore.ts`)

The Zustand store:
- Starts with empty/default values
- Is initialized via `initializeFromAPI(data)` when API data loads
- Provides all application state management
- Tracks initialization state with `isInitialized` flag

Key features:
- Centralized state for games, study sessions, user profile, and stats
- Client-side state mutations (like game, answer questions)
- Syncs with API data on app load

### 4. App Component (`src/App.tsx`)

The App component orchestrates the data flow:

1. Fetches data using `useAppData()` hook
2. Shows loading spinner while fetching
3. Initializes Zustand store with API data
4. Renders app once data is loaded

## Data Flow

```
┌─────────────┐
│   App.tsx   │
│  (on mount) │
└──────┬──────┘
       │
       ▼
┌─────────────────┐
│  useAppData()   │
│ (React Query)   │
└──────┬──────────┘
       │
       ▼
┌─────────────────┐
│ fetchAppData()  │
│  (API Service)  │
└──────┬──────────┘
       │
       ▼
┌────────────────────────┐
│  GET /api/app-data     │
│  (Single API Call)     │
└──────┬─────────────────┘
       │
       ▼
┌─────────────────────────┐
│  AppData Response       │
│  - games[]              │
│  - studySessions[]      │
│  - userProfile          │
│  - stats                │
└──────┬──────────────────┘
       │
       ▼
┌──────────────────────────┐
│  initializeFromAPI()     │
│  (Zustand Store)         │
└──────┬───────────────────┘
       │
       ▼
┌──────────────────────────┐
│  Components use store    │
│  (useAppStore hook)      │
└──────────────────────────┘
```

## Configuration

### Environment Variables

Create a `.env` file (see `.env.example`):

```env
VITE_API_URL=http://localhost:3001/api
```

For production, set:
```env
VITE_API_URL=https://your-api-domain.com/api
```

## Backend API Contract

The backend must provide a single endpoint:

**GET `/api/app-data`**

Response format:
```json
{
  "games": [
    {
      "id": 1,
      "title": "Math Speed Challenge",
      "description": "...",
      "category": "Mathematics",
      "likes": 1240,
      "rating": 4.8,
      "image": "https://...",
      "difficulty": "Medium"
    }
  ],
  "studySessions": [
    {
      "id": "1",
      "title": "Calculus Fundamentals",
      "progress": 92,
      "topics": 12,
      "time": "2 hours ago",
      "hasFullStudy": true,
      "hasSpeedRun": true,
      "hasQuiz": true
    }
  ],
  "userProfile": {
    "id": "user-1",
    "name": "Student User",
    "email": "student@playstudy.ai",
    "xp": 2450,
    "level": 12
  },
  "stats": {
    "totalSessions": 12,
    "averageAccuracy": 85,
    "questionsAnswered": 247,
    "totalStudyTime": "18hrs"
  }
}
```

## Development Mode

When the API is unavailable, the app automatically falls back to mock data defined in `src/services/api.ts`. This allows frontend development without a backend.

## Testing

To test the integration:

1. Start your backend server on port 3001
2. Ensure `/api/app-data` endpoint returns the correct format
3. Start the frontend: `npm run dev`
4. Monitor the Network tab to see the single API call
5. Check Redux DevTools to see Zustand store initialization

## Benefits

1. **Single Network Request**: All data loaded in one call
2. **Offline Support**: Fallback to mock data for development
3. **Caching**: React Query caches responses
4. **Type Safety**: Full TypeScript types for API responses
5. **Centralized State**: Zustand manages all client state
6. **Loading States**: Automatic loading/error handling

## Future Enhancements

- Add authentication tokens to API requests
- Implement optimistic updates for mutations
- Add pagination for large datasets
- Implement WebSocket for real-time updates
- Add service worker for offline-first experience
