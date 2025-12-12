import { create } from 'zustand';

interface Game {
  id: number;
  title: string;
  description: string;
  category: string;
  likes: number;
  rating: number;
  image: string;
  difficulty: string;
}

interface Question {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
}

interface Topic {
  id: string;
  title: string;
  description: string;
  questions: Question[];
  completed: boolean;
  score: number | null;
  currentQuestionIndex: number;
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
  studyContent?: string;
  extractedTopics?: Topic[];
}

interface AppState {
  // Current Study Session
  currentSession: StudySession | null;
  studySessions: StudySession[];
  setCurrentSession: (session: StudySession | null) => void;
  createFullStudy: (sessionId: string) => void;
  createSpeedRun: (sessionId: string) => void;
  createQuiz: (sessionId: string) => void;
  processStudyContent: (sessionId: string, content: string) => void;
  answerQuestion: (sessionId: string, topicId: string, answerIndex: number) => { correct: boolean; explanation: string };
  completeTopic: (sessionId: string, topicId: string) => void;
  
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

// Simulated AI topic extraction and question generation
const generateTopicsFromContent = (content: string): Topic[] => {
  // This simulates AI extraction - in production, this would call an AI API
  const topics: Topic[] = [
    {
      id: 'topic-1',
      title: 'Introduction & Overview',
      description: 'Understanding the fundamentals and key concepts',
      completed: false,
      score: null,
      currentQuestionIndex: 0,
      questions: [
        {
          id: 'q1-1',
          question: 'What is the primary purpose of this study material?',
          options: ['Entertainment', 'Education and learning', 'Physical exercise', 'Social networking'],
          correctAnswer: 1,
          explanation: 'The study material is designed for education and learning purposes.'
        },
        {
          id: 'q1-2',
          question: 'Which approach is most effective for understanding new concepts?',
          options: ['Passive reading only', 'Active engagement with questions', 'Skipping difficult sections', 'Memorization without understanding'],
          correctAnswer: 1,
          explanation: 'Active engagement through questions and practice helps reinforce learning.'
        },
        {
          id: 'q1-3',
          question: 'What should you do when you encounter unfamiliar terminology?',
          options: ['Ignore it', 'Look up the definition and understand context', 'Skip that section', 'Guess the meaning'],
          correctAnswer: 1,
          explanation: 'Looking up definitions helps build vocabulary and understanding.'
        },
      ]
    },
    {
      id: 'topic-2',
      title: 'Core Concepts',
      description: 'Deep dive into the main principles',
      completed: false,
      score: null,
      currentQuestionIndex: 0,
      questions: [
        {
          id: 'q2-1',
          question: 'Which of the following best describes a core concept?',
          options: ['A minor detail', 'A fundamental principle that supports understanding', 'An optional topic', 'A historical fact'],
          correctAnswer: 1,
          explanation: 'Core concepts are fundamental principles that form the foundation of understanding.'
        },
        {
          id: 'q2-2',
          question: 'How do core concepts relate to each other?',
          options: ['They are completely independent', 'They build upon and connect to each other', 'They contradict each other', 'They are randomly organized'],
          correctAnswer: 1,
          explanation: 'Core concepts are interconnected and build upon each other.'
        },
        {
          id: 'q2-3',
          question: 'What is the best way to master core concepts?',
          options: ['Read once quickly', 'Practice with examples and applications', 'Memorize without understanding', 'Avoid challenging material'],
          correctAnswer: 1,
          explanation: 'Practicing with examples helps solidify understanding of core concepts.'
        },
      ]
    },
    {
      id: 'topic-3',
      title: 'Advanced Applications',
      description: 'Applying knowledge to complex scenarios',
      completed: false,
      score: null,
      currentQuestionIndex: 0,
      questions: [
        {
          id: 'q3-1',
          question: 'When applying concepts to new situations, what is most important?',
          options: ['Following instructions exactly', 'Understanding underlying principles to adapt', 'Avoiding new situations', 'Copying previous solutions'],
          correctAnswer: 1,
          explanation: 'Understanding principles allows you to adapt knowledge to new situations.'
        },
        {
          id: 'q3-2',
          question: 'What indicates mastery of advanced applications?',
          options: ['Memorizing all facts', 'Ability to solve novel problems independently', 'Completing assignments quickly', 'Avoiding mistakes'],
          correctAnswer: 1,
          explanation: 'True mastery is demonstrated by solving new problems independently.'
        },
        {
          id: 'q3-3',
          question: 'How should you approach complex problems?',
          options: ['Rush through to finish quickly', 'Break down into smaller, manageable parts', 'Skip if too difficult', 'Wait for someone to solve it'],
          correctAnswer: 1,
          explanation: 'Breaking complex problems into smaller parts makes them more manageable.'
        },
      ]
    },
    {
      id: 'topic-4',
      title: 'Review & Synthesis',
      description: 'Connecting all topics for comprehensive understanding',
      completed: false,
      score: null,
      currentQuestionIndex: 0,
      questions: [
        {
          id: 'q4-1',
          question: 'What is the purpose of review and synthesis?',
          options: ['To repeat the same material', 'To integrate knowledge from all topics', 'To memorize facts', 'To finish studying faster'],
          correctAnswer: 1,
          explanation: 'Synthesis integrates knowledge from all topics into a cohesive understanding.'
        },
        {
          id: 'q4-2',
          question: 'How does connecting topics improve learning?',
          options: ['It makes studying longer', 'It creates a deeper understanding of relationships', 'It is unnecessary', 'It only helps with exams'],
          correctAnswer: 1,
          explanation: 'Connecting topics reveals relationships and deepens overall understanding.'
        },
        {
          id: 'q4-3',
          question: 'What should you do after completing all topics?',
          options: ['Forget the material', 'Review periodically to maintain knowledge', 'Move on immediately', 'Delete your notes'],
          correctAnswer: 1,
          explanation: 'Periodic review helps maintain and strengthen long-term memory.'
        },
      ]
    },
  ];

  return topics;
};

export const useAppStore = create<AppState>((set, get) => ({
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

  processStudyContent: (sessionId, content) => {
    const topics = generateTopicsFromContent(content);
    set((state) => {
      const updatedSessions = state.studySessions.map((s) =>
        s.id === sessionId 
          ? { ...s, studyContent: content, extractedTopics: topics, hasFullStudy: true, topics: topics.length } 
          : s
      );
      const updatedCurrent = state.currentSession?.id === sessionId 
        ? { ...state.currentSession, studyContent: content, extractedTopics: topics, hasFullStudy: true, topics: topics.length }
        : state.currentSession;
      return { studySessions: updatedSessions, currentSession: updatedCurrent };
    });
  },

  answerQuestion: (sessionId, topicId, answerIndex) => {
    const state = get();
    const session = state.studySessions.find(s => s.id === sessionId);
    if (!session?.extractedTopics) return { correct: false, explanation: '' };
    
    const topic = session.extractedTopics.find(t => t.id === topicId);
    if (!topic) return { correct: false, explanation: '' };
    
    const question = topic.questions[topic.currentQuestionIndex];
    if (!question) return { correct: false, explanation: '' };
    
    const correct = answerIndex === question.correctAnswer;
    
    // Update current question index
    set((state) => {
      const updatedSessions = state.studySessions.map((s) => {
        if (s.id !== sessionId || !s.extractedTopics) return s;
        return {
          ...s,
          extractedTopics: s.extractedTopics.map(t => {
            if (t.id !== topicId) return t;
            const newIndex = Math.min(t.currentQuestionIndex + 1, t.questions.length);
            const isComplete = newIndex >= t.questions.length;
            return {
              ...t,
              currentQuestionIndex: newIndex,
              completed: isComplete,
              score: isComplete ? Math.round(((t.score || 0) + (correct ? 100 / t.questions.length : 0))) : (t.score || 0) + (correct ? 100 / t.questions.length : 0),
            };
          })
        };
      });
      
      const updatedCurrent = updatedSessions.find(s => s.id === sessionId);
      return { 
        studySessions: updatedSessions, 
        currentSession: state.currentSession?.id === sessionId ? updatedCurrent || state.currentSession : state.currentSession 
      };
    });

    if (correct) {
      get().addXp(10);
    }
    
    return { correct, explanation: question.explanation };
  },

  completeTopic: (sessionId, topicId) => set((state) => {
    const updatedSessions = state.studySessions.map((s) => {
      if (s.id !== sessionId || !s.extractedTopics) return s;
      return {
        ...s,
        extractedTopics: s.extractedTopics.map(t =>
          t.id === topicId ? { ...t, completed: true } : t
        )
      };
    });
    const updatedCurrent = updatedSessions.find(s => s.id === sessionId);
    return { 
      studySessions: updatedSessions, 
      currentSession: state.currentSession?.id === sessionId ? updatedCurrent || state.currentSession : state.currentSession 
    };
  }),

  // Games data
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
