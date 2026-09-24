/**
 * Unified API service for making a single call to fetch all application data
 */
import { clearCachedUserData } from '@/lib/localData';
import type { ExamPlan } from '@/lib/examPlan';
import type { NoteCheck } from '@/services/notes';

// Browser storage keys
const STORAGE_KEYS = {
  SESSIONS: 'anothernotes_sessions',
  SESSIONS_TIMESTAMP: 'anothernotes_sessions_timestamp',
  SESSION_CACHE_DURATION: 5 * 60 * 1000, // 5 minutes
};

// Browser storage helpers
const BrowserStorage = {
  saveSessions: (sessions: StudySession[]) => {
    try {
      localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(sessions));
      localStorage.setItem(STORAGE_KEYS.SESSIONS_TIMESTAMP, Date.now().toString());
      console.log('💾 Saved sessions to browser storage');
    } catch (error) {
      console.warn('Failed to save sessions to browser storage:', error);
    }
  },

  loadSessions: (): StudySession[] | null => {
    try {
      const timestamp = localStorage.getItem(STORAGE_KEYS.SESSIONS_TIMESTAMP);
      if (!timestamp) return null;

      const age = Date.now() - parseInt(timestamp);
      if (age > STORAGE_KEYS.SESSION_CACHE_DURATION) {
        console.log('⏰ Browser storage cache expired');
        return null;
      }

      const stored = localStorage.getItem(STORAGE_KEYS.SESSIONS);
      if (!stored) return null;

      const sessions = JSON.parse(stored);
      console.log('📂 Loaded sessions from browser storage');
      return sessions;
    } catch (error) {
      console.warn('Failed to load sessions from browser storage:', error);
      return null;
    }
  },

  saveSession: (sessionId: string, session: StudySession) => {
    try {
      const key = `anothernotes_session_${sessionId}`;
      localStorage.setItem(key, JSON.stringify(session));
      localStorage.setItem(`${key}_timestamp`, Date.now().toString());
      console.log(`💾 Saved session ${sessionId} to browser storage`);
    } catch (error) {
      console.warn('Failed to save session to browser storage:', error);
    }
  },

  loadSession: (sessionId: string): StudySession | null => {
    try {
      const key = `anothernotes_session_${sessionId}`;
      const timestamp = localStorage.getItem(`${key}_timestamp`);

      if (!timestamp) return null;

      const age = Date.now() - parseInt(timestamp);
      if (age > STORAGE_KEYS.SESSION_CACHE_DURATION) {
        console.log(`⏰ Session ${sessionId} cache expired`);
        return null;
      }

      const stored = localStorage.getItem(key);
      if (!stored) return null;

      const session = JSON.parse(stored);
      console.log(`📂 Loaded session ${sessionId} from browser storage`);
      return session;
    } catch (error) {
      console.warn('Failed to load session from browser storage:', error);
      return null;
    }
  },

  clearCache: () => {
    try {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith('anothernotes_')) {
          localStorage.removeItem(key);
        }
      });
      console.log('🗑️ Cleared browser storage cache');
    } catch (error) {
      console.warn('Failed to clear browser storage:', error);
    }
  }
};

export interface Question {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
}

export interface Topic {
  id: string;
  db_id?: number;  // Database ID for syncing cached audio/narratives
  title: string;
  description: string;
  questions: Question[];
  completed: boolean;
  score: number | null;
  currentQuestionIndex: number;
  subtopics?: Topic[];
}

export interface StudySession {
  id: string;
  title: string;
  progress: number;
  topics: number;
  time: string;
  createdAt: number; // Timestamp in milliseconds
  hasFullStudy: boolean;
  hasSpeedRun: boolean;
  hasQuiz: boolean;
  studyContent?: string;
  fileContent?: string;  // Original file (base64)
  fileType?: string;  // File type: pdf, pptx, docx, txt
  pdfContent?: string;  // Converted PDF for PPTX files (base64)
  /** There's a PDF to show in Full Study (the upload, or a deck converted to one); fetch it with fetchSessionPdf. */
  hasPdf?: boolean;
  extractedTopics?: Topic[];
  /** "note" for the student's own note (lib/notes/isNote.ts). */
  sourceKind?: string | null;
  sourceUrl?: string | null;
  sourceSnapshots?: string[] | null;
  /** Last edit, in ms. */
  updatedAt?: number | null;
}

export interface UserProfile {
  id: string;
  name: string;
  /** null on a guardian-created child profile, which has no email. */
  email: string | null;
  /** Progress XP plus read-time XP - the number shown on the dashboard. */
  xp: number;
  /** Measured reading seconds, all time. */
  studySeconds: number;
  /** The part of `xp` that came from reading. */
  studyXp: number;
  avatar?: string;
}

export interface Folder {
  id: number;
  name: string;
  color: string;
  icon: string;
  is_archived: boolean;
  created_at: string;
  session_count: number;
}

export interface AppData {
  studySessions: StudySession[];
  folders: Folder[];
  /** Exam run-ups, one per session that has one (see lib/examPlan.ts). */
  examPlans?: ExamPlan[];
  userProfile: UserProfile;
  stats: {
    totalSessions: number;
    averageAccuracy: number;
    questionsAnswered: number;
    totalStudyTime: string;
  };
}

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

/**
 * Get authentication token from localStorage
 */
export const getAuthToken = (): string | null => {
  return localStorage.getItem('auth_token');
};

/**
 * Set authentication token in localStorage
 */
export const setAuthToken = (token: string): void => {
  localStorage.setItem('auth_token', token);
};

/**
 * Remove authentication token from localStorage
 */
export const removeAuthToken = (): void => {
  localStorage.removeItem('auth_token');
};

/**
 * Logout user and clear token
 */
export const logout = (): void => {
  removeAuthToken();
  clearCachedUserData();
  window.location.href = '/auth';
};

/**
 * A 401 means the token went stale, not that the student should be thrown out:
 * renew it and report whether the call can be retried. Signs out only when the
 * server rejects the token outright.
 */
const recoverFromUnauthorized = async (): Promise<boolean> => {
  const { authService } = await import('./authService');
  const result = await authService.refreshToken();
  if (result === 'rejected') authService.logout();
  return result === 'refreshed';
};

/**
 * Login user and store token
 */
export const login = async (email: string, password: string): Promise<{success: boolean; error?: string}> => {
  try {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      return { success: false, error: errorData.detail || 'Login failed' };
    }

    const data = await response.json();
    setAuthToken(data.access_token);
    return { success: true };
  } catch (error) {
    console.error('Login error:', error);
    return { success: false, error: 'Network error. Please try again.' };
  }
};

/**
 * Register new user and store token
 */
export const register = async (email: string, name: string, password: string): Promise<{success: boolean; error?: string}> => {
  try {
    const response = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, name, password }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      return { success: false, error: errorData.detail || 'Registration failed' };
    }

    const data = await response.json();
    setAuthToken(data.access_token);
    return { success: true };
  } catch (error) {
    console.error('Registration error:', error);
    return { success: false, error: 'Network error. Please try again.' };
  }
};

/**
 * Fetches all application data in a single API call
 */
export const fetchAppData = async (): Promise<AppData> => {
  try {
    const token = getAuthToken();

    // If no token, try to use mock data
    if (!token) {
      console.warn('[fetchAppData] No authentication token found. Using mock data.');
      return getMockAppData();
    }

    // Try to load from browser storage first (instant load)
    const cachedSessions = BrowserStorage.loadSessions();
    if (cachedSessions && cachedSessions.length > 0) {
      console.log('[fetchAppData] ⚡ Using cached sessions from browser storage');
      // Fetch in background to update cache
      fetchAndCacheAppData(token);
    }

    console.log('[fetchAppData] Fetching app data from API...');
    const response = await fetch(`${API_URL}/app-data`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    console.log(`[fetchAppData] Response status: ${response.status}`);

    if (!response.ok) {
      if (response.status === 401) {
        // Token expired or invalid - let AuthContext handle logout
        console.error('[fetchAppData] ❌ 401 Unauthorized - token invalid or expired');
        // Don't remove token here - let the auth system handle it
        // This will cause a proper redirect via ProtectedRoute
      }
      throw new Error(`API request failed with status ${response.status}`);
    }

    const data: AppData = await response.json();
    console.log('[fetchAppData] ✅ App data fetched successfully');

    // Save sessions to browser storage for next time
    BrowserStorage.saveSessions(data.studySessions);

    return data;
  } catch (error) {
    console.error('[fetchAppData] ❌ Failed to fetch app data:', error);
    // No stand-in data for someone who is signed in. This used to return demo data
    // (sessions "1", "2", "3" and someone else's profile and stats): it looked real,
    // every session opened from it failed, and the tab kept it even after the server
    // came back. The error goes to useAppData instead, which shows "Couldn't reach
    // the server" and keeps retrying until it answers.
    throw error instanceof Error ? error : new Error(String(error));
  }
};

// Background fetch to update cache
async function fetchAndCacheAppData(token: string) {
  try {
    const response = await fetch(`${API_URL}/app-data`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    if (response.ok) {
      const data: AppData = await response.json();
      BrowserStorage.saveSessions(data.studySessions);
      console.log('🔄 Updated browser storage in background');
    }
  } catch (error) {
    console.warn('Background cache update failed:', error);
  }
}

/**
 * Generate questions using Anthropic AI
 */
export const generateQuestions = async (topic: string, numQuestions: number = 5, difficulty: string = 'medium'): Promise<any> => {
  try {
    const token = getAuthToken();

    if (!token) {
      throw new Error('Authentication required');
    }

    const response = await fetch(`${API_URL}/generate-questions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ topic, num_questions: numQuestions, difficulty }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Failed to generate questions');
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Failed to generate questions:', error);
    throw error;
  }
};

/**
 * Content analysis response interface
 */
export interface ContentAnalysis {
  word_count: number;
  estimated_reading_time: number;
  recommended_topics: number;
  recommended_questions: number;
  complexity_score: number;
  content_summary: string;
}

/**
 * Analyze content and get recommendations for topics/questions
 */
export const analyzeContent = async (content: string, retried = false): Promise<ContentAnalysis> => {
  try {
    const token = getAuthToken();

    if (!token) {
      throw new Error('Authentication required. Please log in again.');
    }

    const response = await fetch(`${API_URL}/study-sessions/analyze-content`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ content }),
    });

    if (!response.ok) {
      if (response.status === 401) {
        if (!retried && (await recoverFromUnauthorized())) return analyzeContent(content, true);
        throw new Error('Your session has expired. Please log in again.');
      }
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Failed to analyze content');
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Failed to analyze content:', error);
    throw error;
  }
};

/**
 * Create study session with AI-generated topics and questions
 */
export const createStudySessionWithAI = async (
  title: string,
  content: string,
  numTopics: number = 4,
  questionsPerTopic: number = 10,
  retried = false,
): Promise<StudySession> => {
  try {
    const token = getAuthToken();

    if (!token) {
      throw new Error('Authentication required. Please log in again.');
    }

    const response = await fetch(`${API_URL}/study-sessions/create-with-ai`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        title,
        content,
        num_topics: numTopics,
        questions_per_topic: questionsPerTopic,
      }),
    });

    if (!response.ok) {
      if (response.status === 401) {
        if (!retried && (await recoverFromUnauthorized())) {
          return createStudySessionWithAI(title, content, numTopics, questionsPerTopic, true);
        }
        throw new Error('Your session has expired. Please log in again.');
      }
      if (response.status === 413) {
        // File too large
        const errorData = await response.json();
        throw new Error(errorData.detail || 'File size is too large. Please use a smaller file (max 35MB).');
      }
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Failed to create study session');
    }

    const data = await response.json();

    // Transform API response to match frontend StudySession interface
    return {
      id: String(data.id),
      title: data.title,
      progress: data.progress,
      topics: data.topics,
      time: 'Just now',
      createdAt: Date.now(),
      hasFullStudy: data.hasFullStudy,
      hasSpeedRun: data.hasSpeedRun,
      hasQuiz: false,
      studyContent: data.studyContent,
      fileContent: data.fileContent,
      fileType: data.fileType,
      pdfContent: data.pdfContent,  // Converted PDF for PPTX files
      extractedTopics: normalizeTopics(data.extractedTopics || []),
      sourceKind: data.sourceKind ?? null,
      sourceUrl: data.sourceUrl ?? null,
      sourceSnapshots: data.sourceSnapshots ?? null,
    };
  } catch (error) {
    console.error('Failed to create study session:', error);
    throw error;
  }
};

/**
 * Fetch a specific study session with all its topics and questions
 */
export const getStudySession = async (sessionId: string): Promise<StudySession> => {
  try {
    const token = getAuthToken();

    if (!token) {
      throw new Error('Authentication required. Please log in again.');
    }

    // Try to load from browser storage first (instant load)
    const cachedSession = BrowserStorage.loadSession(sessionId);
    if (cachedSession) {
      console.log(`⚡ Using cached session ${sessionId} from browser storage`);
      return cachedSession;
    }

    const response = await fetch(`${API_URL}/study-sessions/${sessionId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Study session not found');
      }
      if (response.status === 401) {
        throw new Error('Authentication required. Please log in again.');
      }
      throw new Error('Failed to fetch study session');
    }

    const data = await response.json();

    // Transform backend response to frontend StudySession format
    const session: StudySession = {
      id: data.id.toString(),
      title: data.title,
      progress: data.progress,
      topics: data.topics,
      time: 'Loaded',
      createdAt: data.createdAt || Date.now(),
      hasFullStudy: data.hasFullStudy,
      hasSpeedRun: data.hasSpeedRun,
      hasQuiz: false,
      studyContent: data.studyContent,
      fileContent: data.fileContent,  // Original file (base64)
      fileType: data.fileType,  // File type: pdf, pptx, docx, txt
      pdfContent: data.pdfContent,  // Converted PDF for PPTX files (base64)
      extractedTopics: normalizeTopics(data.extractedTopics || []),
      sourceKind: data.sourceKind ?? null,
      sourceUrl: data.sourceUrl ?? null,
      sourceSnapshots: data.sourceSnapshots ?? null,
    };

    // Save to browser storage for next time
    BrowserStorage.saveSession(sessionId, session);

    return session;
  } catch (error) {
    console.error('Error fetching study session:', error);
    throw error;
  }
};

/**
 * The session's PDF (the upload itself, or a slide deck converted to PDF) as bytes,
 * for Full Study's PDF view. Fetched only when the student opens that view: the
 * session list leaves the file out.
 */
export const fetchSessionPdf = async (sessionId: string, signal?: AbortSignal): Promise<ArrayBuffer> => {
  const token = getAuthToken();
  if (!token) throw new Error('Authentication required. Please log in again.');
  const response = await fetch(`${API_URL}/study-sessions/${sessionId}/pdf`, {
    headers: { Authorization: `Bearer ${token}` },
    signal,
  });
  if (response.status === 404) throw new Error("This session doesn't have a PDF.");
  if (!response.ok) throw new Error("Couldn't load the PDF. Try again in a moment.");
  return response.arrayBuffer();
};

/**
 * Stream question generation using Server-Sent Events (SSE)
 * Provides real-time updates as questions are generated in the background
 */
// Normalize topics from the API into the frontend shape (recursive).
function normalizeTopics(topicList: any[]): any[] {
  if (!topicList) return [];
  return topicList.map((t: any) => ({
    ...t,
    db_id: t.db_id ?? t.id,
    score: t.score ?? 0,
    currentQuestionIndex: t.currentQuestionIndex ?? 0,
    completed: t.completed ?? false,
    subtopics: t.subtopics ? normalizeTopics(t.subtopics) : [],
  }));
}

/**
 * Create a study session from a YouTube video URL. The backend reads the
 * video's captions and runs the same topic/question pipeline as pasted text.
 * Returns the created session (questions then stream in via
 * streamQuestionGeneration, exactly like a normal session).
 */
export const createStudySessionFromYouTube = async (
  url: string,
  title: string,
  numTopics: number = 4,
  questionsPerTopic: number = 30,
): Promise<StudySession> => {
  const token = getAuthToken();
  const response = await fetch(`${API_URL}/study-sessions/from-youtube`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ url, title: title || undefined, num_topics: numTopics, questions_per_topic: questionsPerTopic }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof data.detail === 'string' ? data.detail : 'Could not create a session from that video');
  }
  return {
    id: data.id,
    title: data.title,
    progress: data.progress ?? 0,
    topics: data.topics ?? 0,
    time: 'Just now',
    createdAt: data.createdAt ?? Date.now(),
    hasFullStudy: true,
    hasSpeedRun: data.hasSpeedRun ?? false,
    hasQuiz: data.hasQuiz ?? false,
    studyContent: data.studyContent,
    extractedTopics: normalizeTopics(data.extractedTopics || []),
    sourceKind: data.sourceKind ?? null,
    sourceUrl: data.sourceUrl ?? null,
    sourceSnapshots: data.sourceSnapshots ?? null,
  };
};

export const streamQuestionGeneration = (
  sessionId: string,
  onProgress: (progress: {
    batchNumber: number;
    generated: number;
    remaining: number;
    totalQuestions: number;
    totalFlashcards: number;
    cumulativeQuestions: number;
    cumulativeFlashcards: number;
    hasMore: boolean;
  }) => void,
  onComplete: (data: {
    totalQuestions: number;
    totalFlashcards: number;
    batchesCompleted: number;
  }) => void,
  onError: (error: string) => void
): (() => void) => {
  const token = getAuthToken();

  if (!token) {
    onError('Authentication required');
    return () => {};
  }

  // Create EventSource connection (token passed via query param since EventSource doesn't support headers)
  const eventSource = new EventSource(
    `${API_URL}/study-sessions/${sessionId}/generate-more-questions-stream?token=${token}`,
    { withCredentials: true }
  );

  console.log(`🔌 SSE: Connected to question generation stream for session ${sessionId}`);

  // Handle 'start' event
  eventSource.addEventListener('start', (event) => {
    const data = JSON.parse(event.data);
    console.log(`🚀 SSE: Generation started - ${data.totalRemaining} topics remaining`);
  });

  // Handle 'batch_start' event
  eventSource.addEventListener('batch_start', (event) => {
    const data = JSON.parse(event.data);
    console.log(`⏳ SSE: Batch ${data.batchNumber} starting - ${data.topicsInBatch} topics in this batch`);
  });

  // Handle 'progress' event (MAIN EVENT - triggers UI update)
  eventSource.addEventListener('progress', (event) => {
    const data = JSON.parse(event.data);
    console.log(`📊 SSE: Batch ${data.batchNumber} complete - Generated ${data.generated} topics (${data.totalQuestions}Q, ${data.totalFlashcards}F). Remaining: ${data.remaining}`);

    // Call the progress callback with the data
    onProgress(data);

    console.log('🔄 UI refreshed with new questions from SSE');
  });

  // Handle 'complete' event
  eventSource.addEventListener('complete', (event) => {
    const data = JSON.parse(event.data);
    console.log(`🎉 SSE: Generation complete! Total: ${data.totalQuestions}Q, ${data.totalFlashcards}F in ${data.batchesCompleted} batches`);

    eventSource.close();
    onComplete(data);
  });

  // Handle 'error' event
  eventSource.addEventListener('error', (event) => {
    console.error('❌ SSE: Stream connection failed', event);
    eventSource.close();
    onError('Stream connection failed');
  });

  // Return cleanup function
  return () => {
    console.log('🔌 SSE: Closing connection');
    eventSource.close();
  };
};

/**
 * Generate more questions for remaining subtopics (automatic progressive loading)
 * This should be called automatically after session creation to load all remaining questions
 * @deprecated Use streamQuestionGeneration instead for real-time updates
 */
export const generateAllRemainingQuestions = async (
  sessionId: string,
  onProgress?: (generated: number, remaining: number) => void
): Promise<void> => {
  try {
    const token = getAuthToken();
    if (!token) {
      throw new Error('Authentication required');
    }

    let hasMore = true;
    let totalGenerated = 0;

    console.log(`🔄 Starting automatic question generation for session ${sessionId}`);

    while (hasMore) {
      const response = await fetch(`${API_URL}/study-sessions/${sessionId}/generate-more-questions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        console.error('Failed to generate more questions:', response.statusText);
        break;
      }

      const data = await response.json();

      totalGenerated += data.generated || 0;
      hasMore = data.hasMore || false;

      console.log(`✅ Generated ${data.generated} more subtopics (${data.totalQuestions} questions). Remaining: ${data.remaining}`);

      // Notify progress callback
      if (onProgress) {
        onProgress(data.generated, data.remaining);
      }

      // If there are more, continue loading
      if (!hasMore) {
        console.log(`🎉 All questions generated! Total: ${totalGenerated} batches`);
        break;
      }

      // Small delay between requests to avoid overwhelming server
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

  } catch (error) {
    console.error('Error generating remaining questions:', error);
    throw error;
  }
};

/**
 * Update topic progress (score, current question index, completion status)
 */
export const updateTopicProgress = async (
  sessionId: string,
  topicId: number,
  score: number,
  currentQuestionIndex: number,
  completed: boolean
): Promise<void> => {
  try {
    const token = getAuthToken();

    if (!token) {
      console.warn('No auth token - progress update skipped');
      return; // Gracefully fail - user can continue working offline
    }

    const response = await fetch(`${API_URL}/study-sessions/${sessionId}/topics/${topicId}/progress`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        score: Math.round(score), // Round to integer (0-100)
        current_question_index: currentQuestionIndex,
        completed,
      }),
    });

    if (!response.ok) {
      // Log but don't throw - allow offline usage
      console.warn('Failed to sync topic progress:', response.status);
      return;
    }

    const data = await response.json();
    console.log('✅ Topic progress synced:', data);
  } catch (error) {
    // Gracefully handle network errors - don't block user
    console.warn('Network error syncing topic progress:', error);
  }
};

/**
 * Update user XP
 */
/**
 * The message to show for a failed section edit. FastAPI's own validation errors
 * (422) carry `detail` as a list of problems rather than a sentence; the first
 * one's `msg` says what was wrong, where a generic fallback said nothing.
 */
const sectionErrorMessage = (err: { detail?: unknown }, fallback: string): string => {
  const detail = err?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail) && typeof detail[0]?.msg === 'string') return detail[0].msg;
  return fallback;
};

/**
 * Edit a Full Study section (title, short description, written notes).
 */
/**
 * Forget the browser's copy of one session. getStudySession serves that copy for five
 * minutes, so after a section is changed it would hand back the OLD text the next time
 * the page opens — and the next save would then write that old text over the new.
 * Every write to a session's notes calls this.
 */
export const forgetCachedSession = (sessionId: string) => {
  try {
    localStorage.removeItem(`anothernotes_session_${sessionId}`);
    localStorage.removeItem(`anothernotes_session_${sessionId}_timestamp`);
  } catch {
    /* private mode: there is no copy to forget */
  }
};

export const updateTopicDetails = async (
  sessionId: string,
  topicDbId: number,
  patch: { title?: string; description?: string; notes?: string },
): Promise<{
  id: number;
  title: string;
  description: string;
  notes: string | null;
  /** The tutor's questions about this section, moved to follow the edit. */
  noteChecks?: NoteCheck[];
  updatedAt?: number | null;
}> => {
  const token = getAuthToken();
  const response = await fetch(`${API_URL}/study-sessions/${sessionId}/topics/${topicDbId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(patch),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(sectionErrorMessage(err, 'Failed to save section'));
  }
  forgetCachedSession(sessionId);
  return response.json();
};

/**
 * Ask the AI to write the notes for one section (returns existing notes unless force).
 */
export const generateTopicNotes = async (sessionId: string, topicDbId: number, force = false): Promise<string> => {
  const token = getAuthToken();
  const response = await fetch(`${API_URL}/study-sessions/${sessionId}/topics/${topicDbId}/notes${force ? '?force=1' : ''}`, {
    method: 'POST',
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(typeof err.detail === 'string' ? err.detail : 'Failed to write notes');
  }
  forgetCachedSession(sessionId);
  return (await response.json()).notes as string;
};

/**
 * Generate a focused, challenging quiz for one Full Study section, grounded in
 * that section's notes and source. Returns existing questions unless `force`.
 */
export const generateSectionQuiz = async (
  sessionId: string,
  topicDbId: number,
  opts: { count?: number; force?: boolean } = {},
): Promise<Question[]> => {
  const token = getAuthToken();
  const response = await fetch(`${API_URL}/study-sessions/${sessionId}/topics/${topicDbId}/quiz`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ count: opts.count ?? 8, force: opts.force ?? false }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(typeof err.detail === 'string' ? err.detail : 'Failed to build the quiz');
  }
  forgetCachedSession(sessionId);
  const data = await response.json();
  return (data.questions ?? []).map((q: any): Question => ({
    id: String(q.id),
    question: q.question,
    options: q.options ?? [],
    correctAnswer: q.correctAnswer ?? 0,
    explanation: q.explanation ?? '',
  }));
};

/**
 * Ask the AI to change part of a section's notes with a plain-language instruction.
 */
export const reviseTopicNotes = async (sessionId: string, topicDbId: number, instruction: string): Promise<string> => {
  const token = getAuthToken();
  const response = await fetch(`${API_URL}/study-sessions/${sessionId}/topics/${topicDbId}/notes/revise`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ instruction }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(sectionErrorMessage(err, 'Failed to revise notes'));
  }
  forgetCachedSession(sessionId);
  return (await response.json()).notes as string;
};

export interface Flashcard {
  id: string;
  front: string;
  back: string;
  hint?: string | null;
}

/**
 * Generate recall flashcards for one section, grounded in its notes. Returns
 * existing cards unless `force`.
 */
export const generateSectionFlashcards = async (
  sessionId: string,
  topicDbId: number,
  opts: { count?: number; force?: boolean } = {},
): Promise<Flashcard[]> => {
  const token = getAuthToken();
  const response = await fetch(`${API_URL}/study-sessions/${sessionId}/topics/${topicDbId}/flashcards/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ count: opts.count ?? 8, force: opts.force ?? false }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(typeof err.detail === 'string' ? err.detail : 'Failed to make flashcards');
  }
  const data = await response.json();
  return (data.flashcards ?? []).map((f: any): Flashcard => ({
    id: String(f.id),
    front: f.front,
    back: f.back,
    hint: f.hint ?? null,
  }));
};

export const updateUserXP = async (xpToAdd: number): Promise<void> => {
  try {
    const token = getAuthToken();

    if (!token) {
      console.warn('No auth token - XP update skipped');
      return; // Gracefully fail
    }

    const response = await fetch(`${API_URL}/study-sessions/user/xp`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        xp_to_add: xpToAdd,
      }),
    });

    if (!response.ok) {
      console.warn('Failed to sync XP:', response.status);
      return;
    }

    const data = await response.json();
    console.log('✅ XP synced:', data);
  } catch (error) {
    console.warn('Network error syncing XP:', error);
  }
};

/**
 * Delete a study session
 */
export const deleteStudySession = async (sessionId: string): Promise<void> => {
  try {
    const token = getAuthToken();

    if (!token) {
      throw new Error('Authentication required');
    }

    const response = await fetch(`${API_URL}/study-sessions/${sessionId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      // If session doesn't exist (404), consider it already deleted - don't throw error
      if (response.status === 404) {
        console.warn(`Session ${sessionId} not found on server - may have been already deleted`);
        return; // Success - session is gone either way
      }
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Failed to delete study session');
    }
  } catch (error) {
    console.error('Failed to delete study session:', error);
    throw error;
  }
};

/**
 * Archive a study session
 */
export const archiveStudySession = async (sessionId: string): Promise<void> => {
  try {
    const token = getAuthToken();

    if (!token) {
      throw new Error('Authentication required');
    }

    const response = await fetch(`${API_URL}/study-sessions/${sessionId}/archive`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      // If session doesn't exist (404), consider it already gone - don't throw error
      if (response.status === 404) {
        console.warn(`Session ${sessionId} not found on server - may have been already deleted`);
        return; // Success - session is gone either way
      }
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Failed to archive study session');
    }
  } catch (error) {
    console.error('Failed to archive study session:', error);
    throw error;
  }
};

/**
 * Mock data for development/fallback
 */
const getMockAppData = (): AppData => {
  return {
    folders: [],
    userProfile: {
      id: 'user-1',
      name: 'Student User',
      email: 'student@anothernotes.com',
      xp: 2450,
      studySeconds: 64800,
      studyXp: 2160,
    },
    stats: {
      totalSessions: 12,
      averageAccuracy: 85,
      questionsAnswered: 247,
      totalStudyTime: '18hrs',
    },
    studySessions: [
      { id: '1', title: "Calculus Fundamentals", progress: 92, topics: 12, time: "2 hours ago", createdAt: Date.now() - 7 * 24 * 60 * 60 * 1000, hasFullStudy: true, hasSpeedRun: true, hasQuiz: true },
      { id: '2', title: "Distribution & Channel Strategy Fundamentals", progress: 0, topics: 7, time: "Just now", createdAt: Date.now() - 1 * 60 * 60 * 1000, hasFullStudy: true, hasSpeedRun: true, hasQuiz: false },
      { id: '3', title: "Foundations of Marketing Ethics", progress: 0, topics: 6, time: "30 mins ago", createdAt: Date.now() - 2 * 60 * 60 * 1000, hasFullStudy: true, hasSpeedRun: true, hasQuiz: false },
      { id: '4', title: "Geography Capitals", progress: 88, topics: 10, time: "2 days ago", createdAt: Date.now() - 5 * 24 * 60 * 60 * 1000, hasFullStudy: true, hasSpeedRun: true, hasQuiz: true },
      { id: '5', title: "Organic Chemistry", progress: 85, topics: 8, time: "5 hours ago", createdAt: Date.now() - 6 * 24 * 60 * 60 * 1000, hasFullStudy: true, hasSpeedRun: true, hasQuiz: false },
      { id: '6', title: "Python Basics", progress: 91, topics: 14, time: "2 days ago", createdAt: Date.now() - 4 * 24 * 60 * 60 * 1000, hasFullStudy: true, hasSpeedRun: true, hasQuiz: false },
      { id: '7', title: "Spanish Vocabulary", progress: 95, topics: 20, time: "Yesterday", createdAt: Date.now() - 3 * 24 * 60 * 60 * 1000, hasFullStudy: true, hasSpeedRun: true, hasQuiz: true },
      { id: '8', title: "World War II History", progress: 78, topics: 15, time: "Yesterday", createdAt: Date.now() - 8 * 24 * 60 * 60 * 1000, hasFullStudy: true, hasSpeedRun: true, hasQuiz: true },
    ],
  };
};
