import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { AppData, deleteStudySession as apiDeleteStudySession, archiveStudySession as apiArchiveStudySession, updateTopicProgress, updateUserXP } from '@/services/api';

export interface Game {
  id: number;
  title: string;
  description: string;
  category: string;
  likes: number;
  rating: number;
  image: string;
  difficulty: string;
  questionCount: number;
  points: number;
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
  db_id?: number | null;  // Database ID for syncing progress to backend
  title: string;
  description: string;
  questions: Question[];
  completed: boolean;
  score: number | null;
  currentQuestionIndex: number;
  isCategory?: boolean;
  parentTopicId?: string | null;
  subtopics?: Topic[];
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
  extractedTopics?: Topic[];
  folderId?: number | null;
}

interface AppState {
  // Data loading state
  isInitialized: boolean;
  initializeFromAPI: (data: AppData) => void;

  // Current Study Session
  currentSession: StudySession | null;
  studySessions: StudySession[];
  setCurrentSession: (session: StudySession | null) => void;
  addSession: (session: StudySession) => void;
  createSession: (title: string, content: string) => StudySession;
  createFullStudy: (sessionId: string) => void;
  createSpeedRun: (sessionId: string) => void;
  createQuiz: (sessionId: string) => void;
  processStudyContent: (sessionId: string, content: string) => void;
  answerQuestion: (sessionId: string, topicId: string, answerIndex: number, questionIndex?: number) => { correct: boolean; explanation: string };
  moveToNextQuestion: (sessionId: string, topicId: string) => void;
  completeTopic: (sessionId: string, topicId: string) => void;
  resetTopic: (sessionId: string, topicId: string) => void;
  deleteStudySession: (sessionId: string) => Promise<void>;
  archiveStudySession: (sessionId: string) => Promise<void>;

  // Games
  games: Game[];
  likeGame: (id: number) => void;

  // Folders
  folders: Folder[];
  addFolder: (folder: Folder) => void;
  updateFolder: (folderId: number, updates: Partial<Folder>) => void;
  deleteFolder: (folderId: number) => void;

  // Speed Run Mode
  speedRunMode: 'cards' | 'mcq';
  setSpeedRunMode: (mode: 'cards' | 'mcq') => void;

  // XP and User Profile
  xp: number;
  addXp: (amount: number) => void;
  userProfile: {
    id: string;
    name: string;
    email: string;
    level: number;
  } | null;

  // Stats
  stats: {
    totalSessions: number;
    averageAccuracy: number;
    questionsAnswered: number;
    totalStudyTime: string;
  };
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
  // Initialization state
  isInitialized: false,

  // Initialize store with data from API
  initializeFromAPI: (data: AppData) => {
    set({
      isInitialized: true,
      games: data.games,
      studySessions: data.studySessions,
      folders: data.folders || [],
      xp: data.userProfile.xp,
      userProfile: {
        id: data.userProfile.id,
        name: data.userProfile.name,
        email: data.userProfile.email,
        level: data.userProfile.level,
      },
      stats: data.stats,
    });
  },

  // Study Sessions - Start with empty arrays, will be populated by API
  currentSession: null,
  studySessions: [],

  setCurrentSession: (session) => set({ currentSession: session }),

  addSession: (session) => set((state) => ({
    studySessions: [session, ...state.studySessions],
  })),

  createSession: (title, content) => {
    const newSession: StudySession = {
      id: uuidv4(), // Generate UUID for globally unique session ID
      title,
      progress: 0,
      topics: 0,
      time: 'Just now',
      createdAt: Date.now(),
      hasFullStudy: false,
      hasSpeedRun: false,
      hasQuiz: false,
      studyContent: content,
    };

    set((state) => ({
      studySessions: [...state.studySessions, newSession],
      currentSession: newSession,
    }));

    return newSession;
  },

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

    // Normalize topics to ensure all required fields are present and properly initialized
    const normalizeTopics = (topicList: Topic[]): Topic[] => {
      return topicList.map(t => ({
        ...t,
        score: t.score ?? 0, // Ensure score is 0, not null/undefined
        currentQuestionIndex: t.currentQuestionIndex ?? 0,
        completed: t.completed ?? false,
        subtopics: t.subtopics ? normalizeTopics(t.subtopics) : []
      }));
    };

    const normalizedTopics = normalizeTopics(topics);

    console.log('📥 Processing study content with normalization:', {
      sessionId,
      topicsCount: normalizedTopics.length,
      sampleTopic: normalizedTopics[0] ? {
        id: normalizedTopics[0].id,
        title: normalizedTopics[0].title,
        score: normalizedTopics[0].score,
        questionsCount: normalizedTopics[0].questions?.length
      } : null
    });

    set((state) => {
      const updatedSessions = state.studySessions.map((s) =>
        s.id === sessionId
          ? { ...s, studyContent: content, extractedTopics: normalizedTopics, hasFullStudy: true, topics: normalizedTopics.length }
          : s
      );
      const updatedCurrent = state.currentSession?.id === sessionId
        ? { ...state.currentSession, studyContent: content, extractedTopics: normalizedTopics, hasFullStudy: true, topics: normalizedTopics.length }
        : state.currentSession;
      return { studySessions: updatedSessions, currentSession: updatedCurrent };
    });
  },

  answerQuestion: (sessionId, topicId, answerIndex, questionIndex) => {
    const state = get();
    const session = state.studySessions.find(s => s.id === sessionId);
    if (!session?.extractedTopics) return { correct: false, explanation: '' };

    // Helper function to find topic in hierarchical structure
    const findTopic = (topics: Topic[], id: string): Topic | null => {
      for (const topic of topics) {
        if (topic.id === id) return topic;
        if (topic.subtopics) {
          const found = findTopic(topic.subtopics, id);
          if (found) return found;
        }
      }
      return null;
    };

    const topic = findTopic(session.extractedTopics, topicId);
    if (!topic) return { correct: false, explanation: '' };

    // Use provided questionIndex or fall back to topic's currentQuestionIndex
    const indexToUse = questionIndex !== undefined ? questionIndex : topic.currentQuestionIndex;
    const question = topic.questions[indexToUse];
    if (!question) {
      console.error('❌ Question not found at index:', indexToUse, 'Total questions:', topic.questions.length);
      return { correct: false, explanation: '' };
    }

    console.log('📚 Checking answer for question', indexToUse + 1, 'of', topic.questions.length);

    // Enhanced debug logging
    console.log('🔍 Answer validation details:', {
      answerIndex,
      correctAnswer: question.correctAnswer,
      answerIndexType: typeof answerIndex,
      correctAnswerType: typeof question.correctAnswer,
      answerIndexValue: answerIndex,
      correctAnswerValue: question.correctAnswer,
      currentScore: topic.score,
      questionData: {
        question: question.question,
        options: question.options,
        selectedOption: question.options[answerIndex],
        correctOption: question.options[question.correctAnswer]
      }
    });

    // Ensure both are numbers for comparison (handle null/undefined)
    const answerNum = Number(answerIndex);
    const correctNum = Number(question.correctAnswer);
    const correct = !isNaN(answerNum) && !isNaN(correctNum) && answerNum === correctNum;

    console.log('✅ Comparison result:', {
      answerNum,
      correctNum,
      correct,
      willAddPoints: correct ? (100 / topic.questions.length) : 0,
      newScore: (topic.score || 0) + (correct ? 100 / topic.questions.length : 0)
    });

    // Helper function to update score recursively (WITHOUT incrementing index)
    const updateScoreRecursively = (topics: Topic[]): Topic[] => {
      return topics.map(t => {
        if (t.id === topicId) {
          return {
            ...t,
            score: (t.score || 0) + (correct ? 100 / t.questions.length : 0),
          };
        }
        if (t.subtopics) {
          return {
            ...t,
            subtopics: updateScoreRecursively(t.subtopics)
          };
        }
        return t;
      });
    };

    // Calculate new score
    const newScore = (topic.score || 0) + (correct ? 100 / topic.questions.length : 0);

    // Update score (but don't move to next question yet)
    set((state) => {
      const updatedSessions = state.studySessions.map((s) => {
        if (s.id !== sessionId || !s.extractedTopics) return s;
        return {
          ...s,
          extractedTopics: updateScoreRecursively(s.extractedTopics)
        };
      });

      const updatedCurrent = updatedSessions.find(s => s.id === sessionId);
      return {
        studySessions: updatedSessions,
        currentSession: state.currentSession?.id === sessionId ? updatedCurrent || state.currentSession : state.currentSession
      };
    });

    // Sync to backend if topic has database ID
    if (topic.db_id) {
      updateTopicProgress(
        sessionId,
        topic.db_id,
        newScore,
        topic.currentQuestionIndex,
        false // Not completed yet
      ).catch(err => console.warn('Failed to sync progress:', err));
    }

    if (correct) {
      get().addXp(10);
      // Sync XP to backend
      updateUserXP(10).catch(err => console.warn('Failed to sync XP:', err));
    }

    return { correct, explanation: question.explanation };
  },

  moveToNextQuestion: (sessionId, topicId) => {
    console.log('🔄 moveToNextQuestion called', { sessionId, topicId });

    // Find the topic first to get its db_id
    const state = get();
    const session = state.studySessions.find(s => s.id === sessionId);
    const findTopic = (topics: Topic[], id: string): Topic | null => {
      for (const topic of topics) {
        if (topic.id === id) return topic;
        if (topic.subtopics) {
          const found = findTopic(topic.subtopics, id);
          if (found) return found;
        }
      }
      return null;
    };
    const topic = session?.extractedTopics ? findTopic(session.extractedTopics, topicId) : null;

    // Helper function to find and update topic in hierarchical structure
    const updateIndexRecursively = (topics: Topic[]): Topic[] => {
      return topics.map(t => {
        if (t.id === topicId) {
          const newIndex = t.currentQuestionIndex + 1;
          const isComplete = newIndex >= t.questions.length;

          console.log('➡️ Moving from index', t.currentQuestionIndex, 'to', newIndex, '/', t.questions.length);

          const updatedTopic = {
            ...t,
            currentQuestionIndex: newIndex,
            completed: isComplete,
            score: isComplete ? Math.round(t.score || 0) : t.score,
          };

          // Sync to backend if topic has database ID
          if (t.db_id) {
            updateTopicProgress(
              sessionId,
              t.db_id,
              Math.round(updatedTopic.score || 0),
              updatedTopic.currentQuestionIndex,
              updatedTopic.completed
            ).catch(err => console.warn('Failed to sync progress on move:', err));
          }

          return updatedTopic;
        }
        if (t.subtopics && t.subtopics.length > 0) {
          return {
            ...t,
            subtopics: updateIndexRecursively(t.subtopics)
          };
        }
        return t;
      });
    };

    // Update state with new question index
    set((state) => {
      const updatedSessions = state.studySessions.map((session) => {
        if (session.id !== sessionId) return session;

        if (!session.extractedTopics) {
          console.error('❌ No extractedTopics found for session', sessionId);
          return session;
        }

        const newExtractedTopics = updateIndexRecursively(session.extractedTopics);
        console.log('✅ Updated extractedTopics for session', sessionId);

        return {
          ...session,
          extractedTopics: newExtractedTopics
        };
      });

      // Update currentSession if it matches the sessionId
      let newCurrentSession = state.currentSession;
      if (state.currentSession?.id === sessionId) {
        newCurrentSession = updatedSessions.find(s => s.id === sessionId) || state.currentSession;
        console.log('✅ Updated currentSession to new version');
      }

      return {
        studySessions: updatedSessions,
        currentSession: newCurrentSession
      };
    });
  },

  completeTopic: (sessionId, topicId) => set((state) => {
    console.log('✅ completeTopic called', { sessionId, topicId });

    // Helper function to update topic recursively
    const markCompleteRecursively = (topics: Topic[]): Topic[] => {
      return topics.map(t => {
        if (t.id === topicId) {
          console.log('✅ Marking topic as completed:', t.title);
          return { ...t, completed: true };
        }
        if (t.subtopics) {
          return {
            ...t,
            subtopics: markCompleteRecursively(t.subtopics)
          };
        }
        return t;
      });
    };

    const updatedSessions = state.studySessions.map((s) => {
      if (s.id !== sessionId || !s.extractedTopics) return s;
      return {
        ...s,
        extractedTopics: markCompleteRecursively(s.extractedTopics)
      };
    });
    const updatedCurrent = updatedSessions.find(s => s.id === sessionId);

    console.log('✅ Updated currentSession extractedTopics:', updatedCurrent?.extractedTopics);

    return {
      studySessions: updatedSessions,
      currentSession: state.currentSession?.id === sessionId ? updatedCurrent || state.currentSession : state.currentSession
    };
  }),

  resetTopic: (sessionId, topicId) => set((state) => {
    console.log('🔄 resetTopic called', { sessionId, topicId });

    // Helper function to reset topic recursively
    const resetTopicRecursively = (topics: Topic[]): Topic[] => {
      return topics.map(t => {
        if (t.id === topicId) {
          console.log('🔄 Resetting topic:', t.title);
          return {
            ...t,
            completed: false,
            score: 0,
            currentQuestionIndex: 0
          };
        }
        if (t.subtopics) {
          return {
            ...t,
            subtopics: resetTopicRecursively(t.subtopics)
          };
        }
        return t;
      });
    };

    const updatedSessions = state.studySessions.map((s) => {
      if (s.id !== sessionId || !s.extractedTopics) return s;
      return {
        ...s,
        extractedTopics: resetTopicRecursively(s.extractedTopics)
      };
    });
    const updatedCurrent = updatedSessions.find(s => s.id === sessionId);

    console.log('🔄 Reset topic - new state:', updatedCurrent?.extractedTopics);

    return {
      studySessions: updatedSessions,
      currentSession: state.currentSession?.id === sessionId ? updatedCurrent || state.currentSession : state.currentSession
    };
  }),

  deleteStudySession: async (sessionId) => {
    // Optimistic update - remove from UI immediately
    set((state) => {
      const updatedSessions = state.studySessions.filter(s => s.id !== sessionId);
      return {
        studySessions: updatedSessions,
        currentSession: state.currentSession?.id === sessionId ? null : state.currentSession
      };
    });

    // Then sync with backend
    try {
      await apiDeleteStudySession(sessionId);
      console.log(`✓ Session ${sessionId} deleted successfully`);
    } catch (error) {
      console.error('Failed to delete study session on server:', error);
      // UI already updated, so user doesn't see the error
      // Session will be gone from local state but may still exist on server
      // It will re-appear on next page refresh if deletion failed
    }
  },

  archiveStudySession: async (sessionId) => {
    // Optimistic update - remove from UI immediately
    set((state) => {
      const updatedSessions = state.studySessions.filter(s => s.id !== sessionId);
      return {
        studySessions: updatedSessions,
        currentSession: state.currentSession?.id === sessionId ? null : state.currentSession
      };
    });

    // Then sync with backend
    try {
      await apiArchiveStudySession(sessionId);
      console.log(`✓ Session ${sessionId} archived successfully`);
    } catch (error) {
      console.error('Failed to archive study session on server:', error);
      // UI already updated, so user doesn't see the error
      // Session will be gone from local state but may still exist on server
      // It will re-appear on next page refresh if archival failed
    }
  },

  // Games data - Start empty, will be populated by API
  games: [],

  likeGame: (id) => set((state) => ({
    games: state.games.map((game) =>
      game.id === id ? { ...game, likes: game.likes + 1 } : game
    ),
  })),

  // Folders data - Start empty, will be populated by API
  folders: [],

  addFolder: (folder) => set((state) => ({
    folders: [...state.folders, folder],
  })),

  updateFolder: (folderId, updates) => set((state) => ({
    folders: state.folders.map((folder) =>
      folder.id === folderId ? { ...folder, ...updates } : folder
    ),
  })),

  deleteFolder: (folderId) => set((state) => ({
    folders: state.folders.filter((folder) => folder.id !== folderId),
  })),

  // Speed Run Mode
  speedRunMode: 'mcq',
  setSpeedRunMode: (mode) => set({ speedRunMode: mode }),

  // XP and User Profile - Start with defaults, will be populated by API
  xp: 0,
  addXp: (amount) => set((state) => ({ xp: state.xp + amount })),
  userProfile: null,

  // Stats - Start with defaults, will be populated by API
  stats: {
    totalSessions: 0,
    averageAccuracy: 0,
    questionsAnswered: 0,
    totalStudyTime: '0hrs',
  },
}));
