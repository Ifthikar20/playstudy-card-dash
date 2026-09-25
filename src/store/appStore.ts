import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { AppData, deleteStudySession as apiDeleteStudySession, archiveStudySession as apiArchiveStudySession, updateTopicProgress, updateUserXP } from '@/services/api';
import { XP_RULES, topicCompletionXp, type XpBreakdown } from '@/lib/xp';
import { loggedResponse, recordAnswers, type AnswerEventIn } from '@/services/activity';
import { grade } from '@/lib/quiz/grade';
import type { Grade, QuizItem, QuizResponse } from '@/lib/quiz/types';
import type { ExamPlan } from '@/lib/examPlan';
import type { NoteCheck } from '@/services/notes';

/**
 * A quiz question of any kind: single choice (a question with no `kind` is one), select
 * all, true/false, put in order, sort into groups, fill in the blank, match pairs.
 * lib/quiz/types.ts says what each kind keeps where. `hint` is a nudge for after a wrong
 * first try that never names or rules out an answer: null (or missing) until the server
 * has written one. `source` and `key` are only on a PDF's questions.
 */
export type Question = QuizItem;

export interface Topic {
  id: string;
  db_id?: number | null;  // Database ID for syncing progress to backend
  title: string;
  description: string;
  /** Written study notes for this section (Markdown), AI-generated and user-editable */
  notes?: string | null;
  questions: Question[];
  completed: boolean;
  score: number | null;
  currentQuestionIndex: number;
  isCategory?: boolean;
  parentTopicId?: string | null;
  subtopics?: Topic[];
  /** What the tutor asked about these notes when they were last checked (services/notes.ts). */
  noteChecks?: NoteCheck[] | null;
  notesCheckedAt?: string | null;
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
  fileContent?: string; // Original file (base64)
  fileType?: string; // File type: pdf, pptx, docx, txt
  pdfContent?: string; // Converted PDF for PPTX files
  /** There's a PDF to show in Full Study (the upload, or a deck converted to one). */
  hasPdf?: boolean;
  extractedTopics?: Topic[];
  folderId?: number | null;
  /** Where the material came from (e.g. a YouTube video) + a few frame snapshots.
   *  "note" means the student's own note (lib/notes/isNote.ts), not study material. */
  sourceKind?: string | null;
  sourceUrl?: string | null;
  sourceSnapshots?: string[] | null;
  /** Last edit, in ms — how notes are ordered in the sidebar and on the dashboard. */
  updatedAt?: number | null;
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
  processStudyContent: (sessionId: string, content: string) => void;
  /** Score the FIRST try at one of a section's questions: its score share, XP and the answer
   *  log. `response` is what was answered; a bare number is an option picked in a
   *  single-choice question (how every caller answered before there were other kinds). */
  answerQuestion: (
    sessionId: string,
    topicId: string,
    response: QuizResponse | number,
    questionIndex?: number,
  ) => { correct: boolean; explanation: string; grade: Grade };
  moveToNextQuestion: (sessionId: string, topicId: string) => void;
  completeTopic: (sessionId: string, topicId: string) => void;
  /** Patch a section's editable fields in the store (title / description / notes). */
  updateTopic: (sessionId: string, topicId: string, patch: Partial<Pick<Topic, 'title' | 'description' | 'notes'>>) => void;
  /** The same, found by the section's DATABASE id. The client-side topic ids differ between
   *  the dashboard payload and a full session fetch, so anything the server answers about
   *  a section (a save, a check, a fix) must be matched this way or it lands nowhere. */
  updateTopicByDbId: (
    sessionId: string,
    dbId: number,
    patch: Partial<Pick<Topic, 'title' | 'description' | 'notes' | 'noteChecks' | 'notesCheckedAt'>>,
  ) => void;
  /** Patch a session's own fields (a note's title after a rename, its updatedAt after a save). */
  patchSession: (sessionId: string, patch: Partial<Pick<StudySession, 'title' | 'updatedAt'>>) => void;
  /** Drop a session from the store (a note deleted from its own page). */
  removeSession: (sessionId: string) => void;
  /** Replace a section's quiz with a freshly generated set and start its score again.
   *  A section already finished stays finished (see completeTopic). */
  setTopicQuestions: (sessionId: string, topicId: string, questions: Question[]) => void;
  /** Keep a question's hint once the server has written it, so the quiz never asks twice. */
  setQuestionHint: (sessionId: string, topicId: string, questionId: string, hint: string) => void;
  resetTopic: (sessionId: string, topicId: string) => void;
  deleteStudySession: (sessionId: string) => Promise<void>;
  archiveStudySession: (sessionId: string) => Promise<void>;


  // Folders
  folders: Folder[];
  addFolder: (folder: Folder) => void;
  updateFolder: (folderId: number, updates: Partial<Folder>) => void;
  deleteFolder: (folderId: number) => void;


  // XP and User Profile
  xp: number;
  addXp: (amount: number) => void;
  /** Breakdown of the XP earned by the most recently completed topic (for the summary card). */
  lastTopicReward: { sessionId: string; topicId: string; breakdown: XpBreakdown; sessionCompleted: boolean } | null;
  userProfile: {
    id: string;
    name: string;
    /** null on a guardian-created child profile. */
    email: string | null;
    /** Measured reading seconds, all time - the read half of the XP total. */
    studySeconds: number;
  } | null;

  // Progress batching for performance
  pendingProgressUpdates: Map<string, { sessionId: string; topicId: number; score: number; currentQuestionIndex: number; completed: boolean }>;
  pendingXPUpdates: number;
  /** Answered questions not yet sent to /activity/answers (the source of every dashboard number). */
  pendingAnswers: AnswerEventIn[];
  /** Record one answered question (any mode) and schedule a flush. */
  logAnswer: (event: AnswerEventIn) => void;
  syncPendingProgress: () => Promise<void>;

  // Exam study plans, keyed by study session id: what to study today, and when the exam is.
  examPlans: Record<string, ExamPlan>;
  /** Save (or replace) one session's plan after the server has laid it out. */
  setExamPlan: (plan: ExamPlan) => void;
  clearExamPlan: (sessionId: string) => void;

  // Stats
  stats: {
    totalSessions: number;
    averageAccuracy: number;
    questionsAnswered: number;
    totalStudyTime: string;
  };
}

// Flush measured activity a few seconds after the last answer, and when the tab is hidden.
let flushTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleFlush(flush: () => void, delayMs = 4000) {
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flush();
  }, delayMs);
}
/**
 * Send what's pending (XP, answers, progress) a few seconds from now. For XP earned
 * outside a section's quiz (a PDF part's completion bonus): addXp only queues it, and
 * without a flush scheduled it would wait for the next answer to go out with it.
 */
export function syncProgressSoon() {
  scheduleFlush(() => useAppStore.getState().syncPendingProgress());
}
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
      useAppStore.getState().syncPendingProgress();
    }
  });
}

/** A topic anywhere in a session's tree, by its client-side id. */
function findTopicIn(topics: Topic[] | undefined, id: string): Topic | undefined {
  for (const t of topics ?? []) {
    if (t.id === id) return t;
    const inner = findTopicIn(t.subtopics, id);
    if (inner) return inner;
  }
  return undefined;
}

/*
  The store can hold two copies of one session: the page's full one (currentSession,
  from GET /study-sessions/{id}) and the dashboard's (studySessions, from /app-data).
  The server numbers their topics differently ("category-1-1" in one, "subtopic-1-1"
  in the other), so a section named by the page's id has to be looked up in both and
  matched in the other by its database id. The quiz actions used to look in
  studySessions alone and found nothing for the page's ids: no score, no XP, no answer
  log, and finishing a section swapped the page's copy for the dashboard's.
*/

/** The session copy a section lives in (the page's first), and the section itself. */
function locateTopic(state: AppState, sessionId: string, topicId: string): { session: StudySession; topic: Topic } | null {
  const copies = [state.currentSession?.id === sessionId ? state.currentSession : null, state.studySessions.find((s) => s.id === sessionId)];
  for (const session of copies) {
    const topic = session ? findTopicIn(session.extractedTopics, topicId) : undefined;
    if (session && topic) return { session, topic };
  }
  return null;
}

/** Change one section in both copies of its session: by database id where both have one, else by id. */
function patchSection(
  state: AppState,
  sessionId: string,
  topic: Topic,
  patch: (t: Topic) => Topic,
): Pick<AppState, 'studySessions' | 'currentSession'> {
  const same = (t: Topic) => (topic.db_id != null && t.db_id != null ? t.db_id === topic.db_id : t.id === topic.id);
  const apply = (topics: Topic[]): Topic[] =>
    topics.map((t) => (same(t) ? patch(t) : t.subtopics ? { ...t, subtopics: apply(t.subtopics) } : t));
  const touched = <S extends StudySession | null>(s: S): S =>
    s && s.id === sessionId && s.extractedTopics ? { ...s, extractedTopics: apply(s.extractedTopics) } : s;
  return { studySessions: state.studySessions.map(touched), currentSession: touched(state.currentSession) };
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
      studySessions: data.studySessions,
      folders: data.folders || [],
      xp: data.userProfile.xp,
      userProfile: {
        id: data.userProfile.id,
        name: data.userProfile.name,
        email: data.userProfile.email,
        studySeconds: data.userProfile.studySeconds ?? 0,
      },
      stats: data.stats,
      examPlans: Object.fromEntries((data.examPlans ?? []).map((p) => [p.sessionId, p])),
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

  answerQuestion: (sessionId, topicId, given, questionIndex) => {
    const missed: Grade = { correct: false, right: 0, total: 1 };
    // In whichever copy of the session has it: the page's, then the dashboard's.
    const topic = locateTopic(get(), sessionId, topicId)?.topic;
    if (!topic) return { correct: false, explanation: '', grade: missed };

    // Use provided questionIndex or fall back to topic's currentQuestionIndex
    const indexToUse = questionIndex !== undefined ? questionIndex : topic.currentQuestionIndex;
    const question = topic.questions[indexToUse];
    if (!question) {
      console.error('❌ Question not found at index:', indexToUse, 'Total questions:', topic.questions.length);
      return { correct: false, explanation: '', grade: missed };
    }

    // A bare number is an option index, the only answer there was before question kinds.
    // A true/false question keeps "True" and "False" as its options, so one answered
    // that way (an older caller) still means what was picked.
    const response: QuizResponse =
      typeof given !== 'number'
        ? given
        : question.kind === 'true_false'
          ? { kind: 'true_false', value: given === 0 }
          : { kind: 'single', choice: given };
    // All or nothing: a partly right answer ("3 of 5 in the right place") is feedback
    // on screen, but it scores, pays and is logged as wrong.
    const result = grade(question, response);
    const correct = result.correct;

    console.log('📚 Answer for question', indexToUse + 1, 'of', topic.questions.length, {
      kind: question.kind ?? 'single',
      correct,
      parts: `${result.right}/${result.total}`,
    });

    // Calculate new score
    const newScore = (topic.score || 0) + (correct ? 100 / topic.questions.length : 0);

    // Update score (but don't move to next question yet), in both copies of the session.
    // Each copy keeps its own tree: swapping the dashboard's in for the page's would drop
    // what only the page's has (the questions just written, the file, the notes).
    set((state) => patchSection(state, sessionId, topic, (t) => ({ ...t, score: newScore })));

    // Queue progress update for batching (don't sync immediately for performance)
    if (topic.db_id) {
      const key = `${sessionId}-${topic.db_id}`;
      set((state) => {
        const newMap = new Map(state.pendingProgressUpdates);
        newMap.set(key, {
          sessionId,
          topicId: topic.db_id!,
          score: newScore,
          currentQuestionIndex: topic.currentQuestionIndex,
          // A section once finished stays finished: a Retry (or fresh questions) answered
          // after it must not un-complete it on the server, or a reload would show it
          // undone and finishing it again would pay the completion bonus twice. A finish
          // queued moments ago (completeTopic) and not sent yet counts too.
          completed: topic.completed === true || state.pendingProgressUpdates.get(key)?.completed === true,
        });
        return { pendingProgressUpdates: newMap };
      });
      console.log('[Progress] Queued update for batching:', key);
    }

    if (correct) {
      get().addXp(XP_RULES.correctAnswer); // This now also updates pendingXPUpdates
    }
    get().logAnswer({
      session_id: sessionId,
      topic_id: topic.db_id ?? null,
      question_id: question.id,
      correct,
      mode: 'full_study',
      at: new Date().toISOString(),
      kind: question.kind ?? 'single',
      response: loggedResponse(response),
    });

    return { correct, explanation: question.explanation, grade: result };
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

          // Queue or sync progress update
          if (t.db_id) {
            const key = `${sessionId}-${t.db_id}`;

            if (isComplete) {
              // Topic completed - sync immediately to ensure data is saved
              console.log('[Progress] Topic completed - syncing immediately:', key);
              get().syncPendingProgress().then(() => {
                // After syncing pending updates, sync this final completion
                updateTopicProgress(
                  sessionId,
                  t.db_id!,
                  Math.round(updatedTopic.score || 0),
                  updatedTopic.currentQuestionIndex,
                  updatedTopic.completed
                ).catch(err => console.warn('Failed to sync completion:', err));
              });
            } else {
              // Not completed yet - queue for batching
              set((state) => {
                const newMap = new Map(state.pendingProgressUpdates);
                newMap.set(key, {
                  sessionId,
                  topicId: t.db_id!,
                  score: Math.round(updatedTopic.score || 0),
                  currentQuestionIndex: updatedTopic.currentQuestionIndex,
                  completed: updatedTopic.completed,
                });
                return { pendingProgressUpdates: newMap };
              });
              console.log('[Progress] Queued update for batching:', key);
            }
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

  completeTopic: (sessionId, topicId) => {
    console.log('✅ completeTopic called', { sessionId, topicId });

    // Award completion bonuses once per section, on its first incomplete -> complete
    // transition. A section stays complete through a Retry or fresh questions
    // (setTopicQuestions, answerQuestion), so finishing it again finds it complete here
    // and pays nothing more.
    const found = locateTopic(get(), sessionId, topicId);
    const leafTopics = (topics: Topic[] | undefined): Topic[] =>
      (topics ?? []).flatMap((t) => (t.subtopics && t.subtopics.length ? leafTopics(t.subtopics) : t.isCategory ? [] : [t]));
    const topicBefore = found?.topic;
    const leaves = leafTopics(found?.session.extractedTopics);
    const total = topicBefore?.questions?.length ?? 0;
    const correct = Math.round(((topicBefore?.score ?? 0) * total) / 100);
    const alreadyCompleted = topicBefore?.completed === true;
    const othersDone = leaves.filter((t) => t !== topicBefore).every((t) => t.completed);
    const sessionCompleted = othersDone && leaves.length > 0;
    // A section the store can't find pays nothing: there is nothing to say it was finished.
    const reward = topicCompletionXp(correct, total, { sessionCompleted, firstFinish: !!topicBefore && !alreadyCompleted });
    if (reward.bonus > 0) {
      get().addXp(reward.bonus);
    }

    set((state) => ({
      ...(topicBefore ? patchSection(state, sessionId, topicBefore, (t) => ({ ...t, completed: true })) : {}),
      lastTopicReward: { sessionId, topicId, breakdown: { lines: reward.lines, total: reward.total }, sessionCompleted },
    }));

    // Finishing is what marks a section done, so it has to reach the server too.
    // Nothing queued it before: every answer queued `completed: false`, and the
    // section came back unticked on the next load. Sent with the next flush.
    if (topicBefore?.db_id) {
      const key = `${sessionId}-${topicBefore.db_id}`;
      set((state) => {
        const newMap = new Map(state.pendingProgressUpdates);
        newMap.set(key, {
          sessionId,
          topicId: topicBefore.db_id!,
          score: topicBefore.score ?? 0,
          currentQuestionIndex: topicBefore.currentQuestionIndex,
          completed: true,
        });
        return { pendingProgressUpdates: newMap };
      });
      scheduleFlush(() => get().syncPendingProgress());
    }
  },

  updateTopic: (sessionId, topicId, patch) => set((state) => {
    const apply = (topics: Topic[]): Topic[] =>
      topics.map((t) => (t.id === topicId ? { ...t, ...patch } : t.subtopics ? { ...t, subtopics: apply(t.subtopics) } : t));
    const studySessions = state.studySessions.map((s) =>
      s.id === sessionId && s.extractedTopics ? { ...s, extractedTopics: apply(s.extractedTopics) } : s,
    );
    // Patch the open session's own tree too: the list copy can be a summary (or an older
    // fetch), and swapping it in would drop or revert what the page is showing.
    const current =
      state.currentSession?.id === sessionId && state.currentSession.extractedTopics
        ? { ...state.currentSession, extractedTopics: apply(state.currentSession.extractedTopics) }
        : state.currentSession;
    return { studySessions, currentSession: current };
  }),

  updateTopicByDbId: (sessionId, dbId, patch) => set((state) => {
    const apply = (topics: Topic[]): Topic[] =>
      topics.map((t) => (t.db_id === dbId ? { ...t, ...patch } : t.subtopics ? { ...t, subtopics: apply(t.subtopics) } : t));
    const touched = (s: StudySession | null) =>
      s && s.id === sessionId && s.extractedTopics ? { ...s, extractedTopics: apply(s.extractedTopics) } : s;
    return {
      studySessions: state.studySessions.map((s) => touched(s) as StudySession),
      currentSession: touched(state.currentSession),
    };
  }),

  patchSession: (sessionId, patch) => set((state) => ({
    studySessions: state.studySessions.map((s) => (s.id === sessionId ? { ...s, ...patch } : s)),
    currentSession: state.currentSession?.id === sessionId ? { ...state.currentSession, ...patch } : state.currentSession,
  })),

  removeSession: (sessionId) => set((state) => ({
    studySessions: state.studySessions.filter((s) => s.id !== sessionId),
    currentSession: state.currentSession?.id === sessionId ? null : state.currentSession,
  })),

  setTopicQuestions: (sessionId, topicId, questions) => set((state) => {
    const found = locateTopic(state, sessionId, topicId);
    if (!found) return state;
    // A new set starts the score again, but `completed` is left alone. Resetting it
    // (as this used to) let a Retry un-finish the section, and finishing it again then
    // paid the completion bonus a second time. Both copies are patched, each in its own
    // tree: swapping the list copy in would drop or revert what the page is showing.
    return patchSection(state, sessionId, found.topic, (t) => ({ ...t, questions, score: 0, currentQuestionIndex: 0 }));
  }),

  setQuestionHint: (sessionId, topicId, questionId, hint) => set((state) => {
    const found = locateTopic(state, sessionId, topicId);
    if (!found) return state;
    return patchSection(state, sessionId, found.topic, (t) => ({
      ...t,
      questions: t.questions.map((q) => (q.id === questionId ? { ...q, hint } : q)),
    }));
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


  // XP and User Profile - Start with defaults, will be populated by API
  xp: 0,
  addXp: (amount) => set((state) => ({ xp: state.xp + amount, pendingXPUpdates: state.pendingXPUpdates + amount })),
  lastTopicReward: null,
  userProfile: null,

  // Progress batching for performance
  pendingProgressUpdates: new Map(),
  pendingXPUpdates: 0,
  pendingAnswers: [],
  logAnswer: (event) => {
    set((state) => ({ pendingAnswers: [...state.pendingAnswers, event] }));
    scheduleFlush(() => get().syncPendingProgress());
  },
  syncPendingProgress: async () => {
    const state = get();
    const updates = Array.from(state.pendingProgressUpdates.values());
    const xpToSync = state.pendingXPUpdates;
    const answers = state.pendingAnswers;

    console.log(`[Progress Sync] Syncing ${updates.length} progress updates, ${answers.length} answers and ${xpToSync} XP`);

    // Clear pending updates first to avoid duplicate syncs
    set({ pendingProgressUpdates: new Map(), pendingXPUpdates: 0, pendingAnswers: [] });

    // Measured activity: answered questions
    const answersPromise = answers.length
      ? recordAnswers(answers).catch((err) => {
          console.warn('Failed to record answers, will retry:', err);
          set((s) => ({ pendingAnswers: [...answers, ...s.pendingAnswers] }));
        })
      : Promise.resolve();

    // Sync all progress updates in parallel
    const progressPromises = updates.map(update =>
      updateTopicProgress(
        update.sessionId,
        update.topicId,
        update.score,
        update.currentQuestionIndex,
        update.completed
      ).catch(err => console.warn('Failed to sync progress:', err))
    );

    // Sync XP if there are any updates
    const xpPromise = xpToSync > 0
      ? updateUserXP(xpToSync).catch(err => console.warn('Failed to sync XP:', err))
      : Promise.resolve();

    // Wait for all updates to complete
    await Promise.all([...progressPromises, xpPromise, answersPromise]);
    console.log('✅ All pending progress synced');
  },

  examPlans: {},
  setExamPlan: (plan) => set((state) => ({ examPlans: { ...state.examPlans, [plan.sessionId]: plan } })),
  clearExamPlan: (sessionId) =>
    set((state) => {
      const { [sessionId]: gone, ...rest } = state.examPlans;
      return { examPlans: rest };
    }),

  // Stats - Start with defaults, will be populated by API
  stats: {
    totalSessions: 0,
    averageAccuracy: 0,
    questionsAnswered: 0,
    totalStudyTime: '0hrs',
  },
}));
