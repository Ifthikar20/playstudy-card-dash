import { create } from 'zustand';

interface Game {
  id: number;
  title: string;
  category: string;
  likes: number;
  rating: number;
  image: string;
  difficulty: string;
}

interface StudySession {
  id: string;
  title: string;
  progress: number;
  topics: number;
  time: string;
  hasFullStudy: boolean;
  hasSpeedRun: boolean;
  hasQuiz: boolean;
}

interface AppState {
  // Current Study Session
  currentSession: StudySession | null;
  studySessions: StudySession[];
  setCurrentSession: (session: StudySession | null) => void;
  createFullStudy: (sessionId: string) => void;
  createSpeedRun: (sessionId: string) => void;
  createQuiz: (sessionId: string) => void;
  
  // Games
  games: Game[];
  likeGame: (id: number) => void;
  
  // Speed Run Mode
  speedRunMode: 'cards' | 'mcq';
  setSpeedRunMode: (mode: 'cards' | 'mcq') => void;
  
  // XP
  xp: number;
  addXp: (amount: number) => void;
}

export const useAppStore = create<AppState>((set) => ({
  // Study Sessions
  currentSession: null,
  studySessions: [
    { id: '1', title: "Calculus Fundamentals", progress: 92, topics: 12, time: "2 hours ago", hasFullStudy: true, hasSpeedRun: true, hasQuiz: true },
    { id: '2', title: "Organic Chemistry", progress: 85, topics: 8, time: "5 hours ago", hasFullStudy: false, hasSpeedRun: true, hasQuiz: false },
    { id: '3', title: "World War II History", progress: 78, topics: 15, time: "Yesterday", hasFullStudy: true, hasSpeedRun: false, hasQuiz: true },
    { id: '4', title: "Spanish Vocabulary", progress: 95, topics: 20, time: "Yesterday", hasFullStudy: true, hasSpeedRun: true, hasQuiz: true },
    { id: '5', title: "Geography Capitals", progress: 88, topics: 10, time: "2 days ago", hasFullStudy: false, hasSpeedRun: false, hasQuiz: true },
    { id: '6', title: "Python Basics", progress: 91, topics: 14, time: "2 days ago", hasFullStudy: true, hasSpeedRun: true, hasQuiz: false },
  ],
  
  setCurrentSession: (session) => set({ currentSession: session }),
  
  createFullStudy: (sessionId) => set((state) => ({
    studySessions: state.studySessions.map((s) =>
      s.id === sessionId ? { ...s, hasFullStudy: true } : s
    ),
  })),
  
  createSpeedRun: (sessionId) => set((state) => ({
    studySessions: state.studySessions.map((s) =>
      s.id === sessionId ? { ...s, hasSpeedRun: true } : s
    ),
  })),
  
  createQuiz: (sessionId) => set((state) => ({
    studySessions: state.studySessions.map((s) =>
      s.id === sessionId ? { ...s, hasQuiz: true } : s
    ),
  })),

  // Games data
  games: [
    { id: 1, title: "Math Speed Challenge", category: "Mathematics", likes: 1240, rating: 4.8, image: "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=400&h=300&fit=crop", difficulty: "Medium" },
    { id: 2, title: "Science Quiz Battle", category: "Science", likes: 980, rating: 4.6, image: "https://images.unsplash.com/photo-1532094349884-543bc11b234d?w=400&h=300&fit=crop", difficulty: "Hard" },
    { id: 3, title: "History Trivia Rush", category: "History", likes: 756, rating: 4.5, image: "https://images.unsplash.com/photo-1461360370896-922624d12a74?w=400&h=300&fit=crop", difficulty: "Easy" },
    { id: 4, title: "Language Master", category: "Languages", likes: 1100, rating: 4.9, image: "https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=400&h=300&fit=crop", difficulty: "Medium" },
    { id: 5, title: "Geography Explorer", category: "Geography", likes: 620, rating: 4.4, image: "https://images.unsplash.com/photo-1524661135-423995f22d0b?w=400&h=300&fit=crop", difficulty: "Easy" },
    { id: 6, title: "Coding Challenge", category: "Programming", likes: 890, rating: 4.7, image: "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=400&h=300&fit=crop", difficulty: "Hard" },
    { id: 7, title: "Physics Fundamentals", category: "Science", likes: 540, rating: 4.3, image: "https://images.unsplash.com/photo-1636466497217-26a8cbeaf0aa?w=400&h=300&fit=crop", difficulty: "Hard" },
    { id: 8, title: "Chemistry Quiz", category: "Science", likes: 430, rating: 4.2, image: "https://images.unsplash.com/photo-1603126857599-f6e157fa2fe6?w=400&h=300&fit=crop", difficulty: "Medium" },
    { id: 9, title: "Biology Basics", category: "Science", likes: 670, rating: 4.5, image: "https://images.unsplash.com/photo-1530026405186-ed1f139313f8?w=400&h=300&fit=crop", difficulty: "Easy" },
    { id: 10, title: "Art History", category: "Arts", likes: 320, rating: 4.6, image: "https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=400&h=300&fit=crop", difficulty: "Medium" },
    { id: 11, title: "Music Theory", category: "Music", likes: 280, rating: 4.4, image: "https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=300&fit=crop", difficulty: "Medium" },
    { id: 12, title: "Economics 101", category: "Business", likes: 450, rating: 4.3, image: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=400&h=300&fit=crop", difficulty: "Hard" },
  ],
  
  likeGame: (id) => set((state) => ({
    games: state.games.map((game) =>
      game.id === id ? { ...game, likes: game.likes + 1 } : game
    ),
  })),
  
  // Speed Run Mode
  speedRunMode: 'mcq',
  setSpeedRunMode: (mode) => set({ speedRunMode: mode }),
  
  // XP
  xp: 2450,
  addXp: (amount) => set((state) => ({ xp: state.xp + amount })),
}));
