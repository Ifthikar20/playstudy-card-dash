/**
 * Unified API service for making a single call to fetch all application data
 */

export interface Game {
  id: number;
  title: string;
  description: string;
  category: string;
  likes: number;
  rating: number;
  image: string;
  difficulty: string;
}

export interface Question {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
}

export interface Topic {
  id: string;
  title: string;
  description: string;
  questions: Question[];
  completed: boolean;
  score: number | null;
  currentQuestionIndex: number;
}

export interface StudySession {
  id: string;
  title: string;
  progress: number;
  topics: number;
  time: string;
  hasFullStudy: boolean;
  hasSpeedRun: boolean;
  hasQuiz: boolean;
  studyContent?: string;
  extractedTopics?: Topic[];
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  xp: number;
  level: number;
  avatar?: string;
}

export interface AppData {
  games: Game[];
  studySessions: StudySession[];
  userProfile: UserProfile;
  stats: {
    totalSessions: number;
    averageAccuracy: number;
    questionsAnswered: number;
    totalStudyTime: string;
  };
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

/**
 * Get authentication token from localStorage
 */
const getAuthToken = (): string | null => {
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
  window.location.href = '/auth';
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
      console.warn('No authentication token found. Using mock data.');
      return getMockAppData();
    }

    const response = await fetch(`${API_URL}/app-data`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        // Token expired or invalid
        removeAuthToken();
        console.warn('Authentication failed. Using mock data.');
      }
      throw new Error(`API request failed with status ${response.status}`);
    }

    const data: AppData = await response.json();
    return data;
  } catch (error) {
    console.error('Failed to fetch app data:', error);
    // Return mock data as fallback for development
    return getMockAppData();
  }
};

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
 * Create study session with AI-generated topics and questions
 */
export const createStudySessionWithAI = async (
  title: string,
  content: string,
  numTopics: number = 4,
  questionsPerTopic: number = 10
): Promise<StudySession> => {
  try {
    const token = getAuthToken();

    if (!token) {
      throw new Error('Authentication required');
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
      hasFullStudy: data.hasFullStudy,
      hasSpeedRun: data.hasSpeedRun,
      hasQuiz: false,
      studyContent: data.studyContent,
      extractedTopics: data.extractedTopics,
    };
  } catch (error) {
    console.error('Failed to create study session:', error);
    throw error;
  }
};

/**
 * Mock data for development/fallback
 */
const getMockAppData = (): AppData => {
  return {
    userProfile: {
      id: 'user-1',
      name: 'Student User',
      email: 'student@playstudy.ai',
      xp: 2450,
      level: 12,
    },
    stats: {
      totalSessions: 12,
      averageAccuracy: 85,
      questionsAnswered: 247,
      totalStudyTime: '18hrs',
    },
    games: [
      { id: 1, title: "Math Speed Challenge", description: "Race against time solving arithmetic and algebra problems. Perfect for sharpening mental math skills!", category: "Mathematics", likes: 1240, rating: 4.8, image: "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=400&h=300&fit=crop", difficulty: "Medium" },
      { id: 2, title: "Science Quiz Battle", description: "Test your knowledge across physics, chemistry, and biology in this competitive quiz format.", category: "Science", likes: 980, rating: 4.6, image: "https://images.unsplash.com/photo-1532094349884-543bc11b234d?w=400&h=300&fit=crop", difficulty: "Hard" },
      { id: 3, title: "History Trivia Rush", description: "Journey through time answering questions about world events, famous figures, and ancient civilizations.", category: "History", likes: 756, rating: 4.5, image: "https://images.unsplash.com/photo-1461360370896-922624d12a74?w=400&h=300&fit=crop", difficulty: "Easy" },
      { id: 4, title: "Language Master", description: "Build vocabulary and grammar skills across multiple languages with interactive challenges.", category: "Languages", likes: 1100, rating: 4.9, image: "https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=400&h=300&fit=crop", difficulty: "Medium" },
      { id: 5, title: "Geography Explorer", description: "Explore countries, capitals, and landmarks. Learn about world geography through fun quizzes!", category: "Geography", likes: 620, rating: 4.4, image: "https://images.unsplash.com/photo-1524661135-423995f22d0b?w=400&h=300&fit=crop", difficulty: "Easy" },
      { id: 6, title: "Coding Challenge", description: "Solve programming puzzles and debug code snippets. Great for aspiring developers!", category: "Programming", likes: 890, rating: 4.7, image: "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=400&h=300&fit=crop", difficulty: "Hard" },
      { id: 7, title: "Physics Fundamentals", description: "Master mechanics, thermodynamics, and electromagnetism through interactive problem-solving.", category: "Science", likes: 540, rating: 4.3, image: "https://images.unsplash.com/photo-1636466497217-26a8cbeaf0aa?w=400&h=300&fit=crop", difficulty: "Hard" },
      { id: 8, title: "Chemistry Quiz", description: "Learn about elements, compounds, and chemical reactions in this engaging quiz game.", category: "Science", likes: 430, rating: 4.2, image: "https://images.unsplash.com/photo-1603126857599-f6e157fa2fe6?w=400&h=300&fit=crop", difficulty: "Medium" },
      { id: 9, title: "Biology Basics", description: "Discover the wonders of life science from cells to ecosystems in bite-sized challenges.", category: "Science", likes: 670, rating: 4.5, image: "https://images.unsplash.com/photo-1530026405186-ed1f139313f8?w=400&h=300&fit=crop", difficulty: "Easy" },
      { id: 10, title: "Art History", description: "Explore famous artworks, artists, and movements from Renaissance to Modern art.", category: "Arts", likes: 320, rating: 4.6, image: "https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=400&h=300&fit=crop", difficulty: "Medium" },
      { id: 11, title: "Music Theory", description: "Learn notes, scales, and composition basics through interactive music challenges.", category: "Music", likes: 280, rating: 4.4, image: "https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=300&fit=crop", difficulty: "Medium" },
      { id: 12, title: "Economics 101", description: "Understand market principles, supply & demand, and financial concepts through gameplay.", category: "Business", likes: 450, rating: 4.3, image: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=400&h=300&fit=crop", difficulty: "Hard" },
    ],
    studySessions: [
      { id: '1', title: "Calculus Fundamentals", progress: 92, topics: 12, time: "2 hours ago", hasFullStudy: true, hasSpeedRun: true, hasQuiz: true },
      { id: '2', title: "Organic Chemistry", progress: 85, topics: 8, time: "5 hours ago", hasFullStudy: false, hasSpeedRun: true, hasQuiz: false },
      { id: '3', title: "World War II History", progress: 78, topics: 15, time: "Yesterday", hasFullStudy: true, hasSpeedRun: false, hasQuiz: true },
      { id: '4', title: "Spanish Vocabulary", progress: 95, topics: 20, time: "Yesterday", hasFullStudy: true, hasSpeedRun: true, hasQuiz: true },
      { id: '5', title: "Geography Capitals", progress: 88, topics: 10, time: "2 days ago", hasFullStudy: false, hasSpeedRun: false, hasQuiz: true },
      { id: '6', title: "Python Basics", progress: 91, topics: 14, time: "2 days ago", hasFullStudy: true, hasSpeedRun: true, hasQuiz: false },
    ],
  };
};
