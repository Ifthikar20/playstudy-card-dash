# Database Operations Analysis

## Overview

This document provides a comprehensive analysis of database read and write operations in the PlayStudy application.

## Summary Statistics

```
Total Database Operations: 190
├─ Read Operations:  166 (87.4%)
└─ Write Operations:  24 (12.6%)

Read/Write Ratio: 6.9:1
```

## Operations by Module

| Module | Reads | Writes | Total | % of Total |
|--------|-------|--------|-------|------------|
| **study_sessions.py** | 85 | 13 | 98 | 51.6% |
| **folders.py** | 33 | 7 | 40 | 21.1% |
| **app_data.py** | 21 | 1 | 22 | 11.6% |
| **tts.py** | 13 | 1 | 14 | 7.4% |
| **auth.py** | 6 | 2 | 8 | 4.2% |
| **crypto.py** | 7 | 0 | 7 | 3.7% |
| **questions.py** | 1 | 0 | 1 | 0.5% |

## API Endpoints (22 total)

### Authentication (2 endpoints)
- `POST /auth/register` - Create new user account
- `POST /auth/login` - Authenticate user

### Study Sessions (8 endpoints)
- `POST /study-sessions/analyze-content` - Analyze uploaded study material
- `POST /study-sessions/create-with-ai` - Generate AI-powered study session
- `GET /study-sessions/{session_id}` - Retrieve study session details
- `POST /study-sessions/{session_id}/generate-more-questions` - Generate additional questions
- `DELETE /study-sessions/{session_id}` - Delete study session
- `PATCH /study-sessions/{session_id}/archive` - Archive study session
- `PATCH /study-sessions/{session_id}/topics/{topic_id}/progress` - Update topic progress
- `PATCH /study-sessions/user/xp` - Update user XP

### Folders (6 endpoints)
- `GET /folders` - List user folders
- `POST /folders` - Create new folder
- `PUT /folders/{folder_id}` - Update folder
- `DELETE /folders/{folder_id}` - Delete folder
- `POST /folders/{folder_id}/sessions/{session_id}` - Add session to folder
- `DELETE /folders/{folder_id}/sessions/{session_id}` - Remove session from folder

### App Data (1 endpoint)
- `GET /app-data` - Retrieve dashboard data (sessions, folders, user stats)

### Questions (1 endpoint)
- `POST /questions/generate-questions` - Generate questions for topics

### Text-to-Speech (Not listed in routes but has operations)
Estimated 5 endpoints for TTS generation and audio retrieval

### Cryptography (4 endpoints)
- `GET /crypto/public-key` - Get encryption public key
- `GET /crypto/key-version` - Get encryption key version
- `GET /crypto/nonce-stats` - Get nonce statistics
- `GET /crypto/health` - Health check

## Typical User Actions - Database Load

### Login Flow
```
1. POST /auth/login
   - 3 reads (find user, validate, fetch profile)
   - 0 writes
   Total: 3 operations
```

### Registration Flow
```
1. POST /auth/register
   - 1 read (check existing user)
   - 2 writes (create user, commit)
   Total: 3 operations
```

### Dashboard Load
```
1. GET /app-data
   - ~21 reads (user data, sessions, folders, stats)
   - 0 writes
   Total: 21 operations
```

### Create Study Session (Heavy Operation)
```
1. POST /study-sessions/create-with-ai
   - ~15 reads (user lookup, validation, AI content processing)
   - ~10 writes (session, topics, questions, commit)
   Total: ~25 operations per session

   With progressive question generation:
   Additional: 2-5 operations per topic batch
```

### View Study Session
```
1. GET /study-sessions/{session_id}
   - ~10 reads (session, topics, questions hierarchy)
   - 0 writes
   Total: 10 operations
```

### Update Progress
```
1. PATCH /study-sessions/{session_id}/topics/{topic_id}/progress
   - 3 reads (find session, topic, validate)
   - 2 writes (update, commit)
   Total: 5 operations
```

### Folder Management
```
1. GET /folders
   - ~5 reads (folders + session counts)
   - 0 writes

2. POST /folders
   - 1 read (user validation)
   - 2 writes (create, commit)

3. POST /folders/{folder_id}/sessions/{session_id}
   - 3 reads (find folder, session, validate)
   - 2 writes (update, commit)
```

## Database Performance Characteristics

### Read-Heavy Workload
- **87.4% reads** indicates excellent caching opportunities
- Most operations are lookups and hierarchical data retrieval
- Read replicas would provide significant performance benefits in production

### Write Patterns
- Writes are primarily during:
  - User registration (infrequent)
  - Study session creation (moderate frequency)
  - Progress tracking (frequent but lightweight)

### Optimization Opportunities

1. **Caching Strategy**
   - Dashboard data (`/app-data`) - Cache for 5-10 minutes
   - Study session details - Cache for 30 minutes
   - Folder listings - Cache for 15 minutes
   - Public key/crypto endpoints - Cache for 1 hour

2. **Database Indexing** (Already implemented)
   - User email (unique index)
   - Study session user_id (indexed)
   - Topics study_session_id (indexed)
   - Questions topic_id (indexed)

3. **Query Optimization**
   - Eager loading for topic hierarchies
   - Batch question generation
   - Optimized join queries for dashboard data

4. **Connection Pooling** (Configured)
   - Pool size: 10 connections
   - Max overflow: 20 connections
   - Sufficient for current load

## Current Database Statistics

Based on actual data (from `inspect_database.py`):
- **Users:** 3
- **Study Sessions:** 72
- **Questions:** 3,041
- **Topics:** 702
- **Folders:** 6
- **Database Size:** 537 MB

## Estimated Load Capacity

### Current Architecture
- **Read Operations:** Can handle ~1,000 req/min with current pool
- **Write Operations:** Can handle ~200 req/min
- **Bottleneck:** AI content generation (rate limited to 60/min)

### Scaling Recommendations
1. **0-100 concurrent users:** Current setup sufficient
2. **100-1,000 users:** Add Redis caching, increase pool size
3. **1,000+ users:** Read replicas, horizontal scaling, CDN for static assets

## Monitoring Recommendations

Track these metrics:
1. Database connection pool usage
2. Average query execution time
3. Slow query log (queries > 1 second)
4. Read/write ratio over time
5. Cache hit rates (when implemented)

---

**Last Updated:** December 24, 2025
**Analysis Tool:** `backend/inspect_database.py`
