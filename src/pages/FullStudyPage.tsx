import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { Sidebar } from "@/components/Sidebar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookOpen, CheckCircle2, Circle, PlusCircle, Lock, PanelLeftClose, Map, Brain, FileText, Zap, Clock } from "lucide-react";
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  BackgroundVariant,
  Node,
  Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { useAppStore } from "@/store/appStore";
import { StudyContentUpload } from "@/components/StudyContentUpload";
import { TopicQuizCard } from "@/components/TopicQuizCard";
import { TopicSummary } from "@/components/TopicSummary";
import { getStudySession, generateAllRemainingQuestions } from "@/services/api";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { LearningMap, generateLearningPath, LearningStep } from "@/components/LearningMap";
import { FlipCard, DropdownQuestion, DragDropMatch, SectionIntro, ContentSummary } from "@/components/StudyInteractives";

// Modern node styles with gradients and shadows - compact sizing
const nodeStyles = {
  completed: {
    background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
    color: "white",
    border: "none",
    borderRadius: "8px",
    padding: "8px 12px",
    boxShadow: "0 2px 8px rgba(16, 185, 129, 0.3)",
    fontWeight: 500,
    fontSize: "12px",
  },
  inProgress: {
    background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
    color: "white",
    border: "none",
    borderRadius: "8px",
    padding: "8px 12px",
    boxShadow: "0 2px 8px rgba(245, 158, 11, 0.3)",
    fontWeight: 500,
    fontSize: "12px",
  },
  locked: {
    background: "linear-gradient(135deg, hsl(var(--muted)) 0%, hsl(var(--muted)) 100%)",
    color: "hsl(var(--muted-foreground))",
    border: "1px dashed hsl(var(--border))",
    borderRadius: "8px",
    padding: "8px 12px",
    fontWeight: 500,
    fontSize: "12px",
  },
  current: {
    background: "linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(260 80% 50%) 100%)",
    color: "white",
    border: "none",
    borderRadius: "8px",
    padding: "8px 12px",
    boxShadow: "0 2px 12px hsla(var(--primary), 0.4)",
    fontWeight: 500,
    fontSize: "12px",
  },
};

// Recursive component to display topics at any depth
interface TopicTreeItemProps {
  topic: any;
  level: number;
  expandedCategories: Set<string>;
  setExpandedCategories: (categories: Set<string>) => void;
  onTopicSelect: (topicId: string) => void;
}

const TopicTreeItem: React.FC<TopicTreeItemProps> = ({
  topic,
  level,
  expandedCategories,
  setExpandedCategories,
  onTopicSelect,
}) => {
  const hasSubtopics = topic.subtopics && topic.subtopics.length > 0;
  const isExpanded = expandedCategories.has(topic.id);
  const isLeafTopic = topic.questions && topic.questions.length > 0;

  // Recursive function to check if all subtopics are completed
  const isFullyCompleted = (t: any): boolean => {
    if (t.questions && t.questions.length > 0) {
      return t.completed || false;
    }
    if (t.subtopics && t.subtopics.length > 0) {
      return t.subtopics.every((st: any) => isFullyCompleted(st));
    }
    return false;
  };

  const completed = isFullyCompleted(topic);
  const indent = level * 24; // 24px per level

  const toggleExpanded = () => {
    const newExpanded = new Set(expandedCategories);
    if (isExpanded) {
      newExpanded.delete(topic.id);
    } else {
      newExpanded.add(topic.id);
    }
    setExpandedCategories(newExpanded);
  };

  return (
    <div className="space-y-2 max-w-full">
      <Card
        className={`transition-all overflow-hidden ${completed ? "bg-green-50 dark:bg-green-950/20" : ""} ${
          isLeafTopic ? "cursor-pointer hover:shadow-md" : ""
        }`}
        style={{ marginLeft: `${indent}px` }}
      >
        <CardContent className="p-3">
          <div
            className="flex items-center justify-between gap-3"
            onClick={() => {
              if (hasSubtopics) {
                toggleExpanded();
              } else if (isLeafTopic) {
                onTopicSelect(topic.id);
              }
            }}
          >
            <div className="flex items-center gap-3 flex-1 min-w-0 overflow-hidden">
              {completed ? (
                <CheckCircle2 className="text-green-600 dark:text-green-400 flex-shrink-0" size={level === 0 ? 20 : 18} />
              ) : (
                <Circle className={`${level === 0 ? "text-amber-600" : "text-primary"} flex-shrink-0`} size={level === 0 ? 20 : 18} />
              )}
              <div className="flex-1 min-w-0 overflow-hidden">
                <p className={`${level === 0 ? "font-semibold" : "font-medium"} text-foreground text-sm break-words`}>
                  {topic.title}
                </p>
                <div className="text-xs text-muted-foreground break-words line-clamp-2">
                  {hasSubtopics && <span className="font-medium">{topic.subtopics.length} subtopic{topic.subtopics.length !== 1 ? 's' : ''}</span>}
                  {isLeafTopic && <span className="font-medium">{topic.questions.length} question{topic.questions.length !== 1 ? 's' : ''}</span>}
                  {topic.description && <span className="text-muted-foreground/80"> • {topic.description}</span>}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {isLeafTopic && completed && topic.score !== null && (
                <span className="text-sm font-semibold text-green-600 dark:text-green-400 whitespace-nowrap">
                  {Math.round((topic.score || 0) * (topic.questions?.length || 0) / 100)}/{topic.questions?.length || 0} pts
                </span>
              )}
              {hasSubtopics && (
                <span className="text-sm text-muted-foreground flex-shrink-0">
                  {isExpanded ? "▼" : "▶"}
                </span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recursive rendering of subtopics */}
      {isExpanded && hasSubtopics && (
        <div className="space-y-2">
          {topic.subtopics.map((subtopic: any) => (
            <TopicTreeItem
              key={subtopic.id}
              topic={subtopic}
              level={level + 1}
              expandedCategories={expandedCategories}
              setExpandedCategories={setExpandedCategories}
              onTopicSelect={onTopicSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default function FullStudyPage() {
  // Get sessionId from URL params
  const { sessionId } = useParams<{ sessionId?: string }>();

  // Use explicit selector to ensure re-renders on currentSession changes
  const currentSession = useAppStore(state => state.currentSession);
  const setCurrentSession = useAppStore(state => state.setCurrentSession);
  const studySessions = useAppStore(state => state.studySessions);
  const processStudyContent = useAppStore(state => state.processStudyContent);
  const answerQuestion = useAppStore(state => state.answerQuestion);
  const moveToNextQuestion = useAppStore(state => state.moveToNextQuestion);
  const completeTopic = useAppStore(state => state.completeTopic);
  const resetTopic = useAppStore(state => state.resetTopic);

  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const [showSummary, setShowSummary] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [localQuestionIndex, setLocalQuestionIndex] = useState(0);
  const [isLoadingSession, setIsLoadingSession] = useState(false);
  const [showLearningMap, setShowLearningMap] = useState(true);
  const [learningMapSteps, setLearningMapSteps] = useState<LearningStep[]>([]);
  const [currentMapStep, setCurrentMapStep] = useState(0);
  const [mapCollapsed, setMapCollapsed] = useState(false);
  const [activeStudyMode, setActiveStudyMode] = useState<'intro' | 'cards' | 'quiz' | 'dropdown' | 'dragdrop' | 'summary' | null>(null);
  const [flipCardResults, setFlipCardResults] = useState<boolean[]>([]);
  const [currentFlipIndex, setCurrentFlipIndex] = useState(0);

  // Load session data based on URL parameter
  // Track if we've started background question generation
  const questionGenerationStarted = useRef<Set<string>>(new Set());

  useEffect(() => {
    const loadSession = async () => {
      // If sessionId is in URL, load that session
      if (sessionId) {
        console.log('📥 URL sessionId detected:', sessionId);

        // Check if we already have this session in the store
        const existingSession = studySessions.find(s => s.id === sessionId);

        // If currentSession doesn't match URL, update it
        if (!currentSession || currentSession.id !== sessionId) {
          if (existingSession) {
            console.log('📂 Setting session from store:', sessionId);
            setCurrentSession(existingSession);
          }
        }

        // Load full session data if not already loaded
        if (!currentSession?.extractedTopics || currentSession.extractedTopics.length === 0 || currentSession.id !== sessionId) {
          console.log('📥 Loading session data from backend:', sessionId);
          setIsLoadingSession(true);

          try {
            const fullSession = await getStudySession(sessionId);
            console.log('✅ Session data loaded:', fullSession);

            // Update the current session with the full data
            setCurrentSession(fullSession);

            // Start background question generation if not already started for this session
            if (!questionGenerationStarted.current.has(sessionId)) {
              questionGenerationStarted.current.add(sessionId);
              console.log('🚀 Starting background question generation for session:', sessionId);

              // Start generating remaining questions in the background
              generateAllRemainingQuestions(sessionId, (generated, remaining) => {
                console.log(`📊 Progress: Generated ${generated} topics, ${remaining} remaining`);

                // Refresh session data periodically to show new questions
                if (generated > 0) {
                  getStudySession(sessionId).then(updated => {
                    console.log('🔄 Refreshed session with new questions');
                    setCurrentSession(updated);
                  }).catch(err => {
                    console.error('❌ Failed to refresh session:', err);
                  });
                }
              }).catch(err => {
                console.error('❌ Background question generation failed:', err);
              });
            }
          } catch (error: any) {
            console.error('❌ Failed to load session:', error);
            // If loading fails, stay on the current screen (will show upload)
          } finally {
            setIsLoadingSession(false);
          }
        }
      }
    };

    loadSession();
  }, [sessionId, currentSession?.id, studySessions]);

  // Reset question index when topic changes
  useEffect(() => {
    console.log('🔄 Topic changed, resetting question index to 0');
    setLocalQuestionIndex(0);
    setShowSummary(false);
  }, [selectedTopicId]);

  // Generate learning path when topics change
  useEffect(() => {
    const topics = currentSession?.extractedTopics || [];
    if (topics.length > 0 && learningMapSteps.length === 0) {
      const path = generateLearningPath(topics, currentSession?.title || "Study Session");
      setLearningMapSteps(path);
    }
  }, [currentSession?.extractedTopics, currentSession?.title]);

  // Sync pending progress when component unmounts or user navigates away
  const syncPendingProgress = useAppStore(state => state.syncPendingProgress);
  useEffect(() => {
    // Sync on component unmount
    return () => {
      console.log('[Progress] Component unmounting - syncing pending progress');
      syncPendingProgress();
    };
  }, [syncPendingProgress]);

  // Sync pending progress when user tries to leave the page
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const pendingUpdates = useAppStore.getState().pendingProgressUpdates;
      const pendingXP = useAppStore.getState().pendingXPUpdates;

      if (pendingUpdates.size > 0 || pendingXP > 0) {
        console.log('[Progress] Page unload - syncing pending progress');
        syncPendingProgress();

        // Show warning if there are unsaved changes
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [syncPendingProgress]);

  // Flatten topics for easier access (includes categories, subtopics, and sub-subtopics recursively)
  const flattenedTopics = useMemo(() => {
    const topics = currentSession?.extractedTopics || [];
    const flattened: any[] = [];

    // Recursive function to flatten all levels
    const flattenRecursive = (topic: any) => {
      flattened.push(topic);
      if (topic.subtopics && topic.subtopics.length > 0) {
        topic.subtopics.forEach((subtopic: any) => flattenRecursive(subtopic));
      }
    };

    topics.forEach((category) => {
      flattenRecursive(category);
    });

    return flattened;
  }, [currentSession?.extractedTopics]);

  // Get only leaf topics (topics with questions, not categories or intermediate subtopics)
  const leafTopics = useMemo(() => {
    return flattenedTopics.filter(t => !t.isCategory && t.questions && t.questions.length > 0);
  }, [flattenedTopics]);

  // Create a completion hash to trigger re-renders when any topic is completed
  const completionHash = useMemo(() => {
    const topics = currentSession?.extractedTopics || [];
    const generateHash = (topicList: any[]): string => {
      return topicList.map(t => {
        const subtopicsHash = t.subtopics ? generateHash(t.subtopics) : '';
        return `${t.id}:${t.completed ? '1' : '0'}:${t.currentQuestionIndex}${subtopicsHash}`;
      }).join('|');
    };
    return generateHash(topics);
  }, [currentSession?.extractedTopics]);

  // Generate nodes and edges from extracted topics (hierarchical structure) - RECURSIVE
  const { nodes: initialNodes, edges: initialEdges } = useMemo(() => {
    const topics = currentSession?.extractedTopics || [];

    console.log('🎨 Regenerating tree nodes - completion hash:', completionHash);

    if (topics.length === 0) {
      return { nodes: [], edges: [] };
    }

    const generatedNodes: Node[] = [];
    const generatedEdges: Edge[] = [];
    let yOffset = 0;

    // Recursive function to process topics at any depth
    const processTopicLevel = (
      topicList: any[],
      parentId: string | null,
      depth: number,
      xPosition: number
    ) => {
      topicList.forEach((topic: any, index: number) => {
        const hasSubtopics = topic.subtopics && topic.subtopics.length > 0;
        const isLeafTopic = !hasSubtopics && !topic.isCategory;
        const isCompleted = topic.completed;

        // Determine if all children are completed (for parent nodes)
        const allChildrenCompleted = hasSubtopics
          ? topic.subtopics.every((st: any) => st.completed)
          : isCompleted;

        // Style based on completion and type
        let style = nodeStyles.locked;
        let emoji = "📁";

        if (topic.isCategory) {
          // Category node
          emoji = allChildrenCompleted ? "✅" : hasSubtopics ? "📂" : "📁";
          style = allChildrenCompleted ? nodeStyles.completed : nodeStyles.inProgress;
        } else if (isLeafTopic) {
          // Leaf topic (has questions)
          emoji = isCompleted ? "✅" : "📚";
          style = isCompleted ? nodeStyles.completed : nodeStyles.current;
        } else {
          // Parent topic (has subtopics but not a category)
          emoji = allChildrenCompleted ? "✅" : "📋";
          style = allChildrenCompleted ? nodeStyles.completed : nodeStyles.inProgress;
        }

        // Add node
        generatedNodes.push({
          id: topic.id,
          type: "default",
          data: { label: `${emoji} ${topic.title}` },
          position: { x: xPosition, y: yOffset },
          style: { ...style, fontWeight: topic.isCategory ? 600 : 500, fontSize: topic.isCategory ? "13px" : "12px" },
        });

        // Edge from parent to this node
        if (parentId) {
          generatedEdges.push({
            id: `e-${parentId}-${topic.id}`,
            source: parentId,
            target: topic.id,
            animated: !isCompleted,
            style: {
              stroke: isCompleted ? "#10b981" : "hsl(var(--border))",
              strokeWidth: isCompleted ? 3 : 2
            },
          });
        }

        const currentY = yOffset;
        yOffset += 90;

        // Recursively process subtopics
        if (hasSubtopics) {
          const childXPosition = xPosition + 250; // Indent each level by 250px
          processTopicLevel(topic.subtopics, topic.id, depth + 1, childXPosition);
        }

        // Edge to next sibling at same level (flow arrow)
        if (index < topicList.length - 1 && !topic.isCategory) {
          const nextTopic = topicList[index + 1];
          generatedEdges.push({
            id: `e-${topic.id}-${nextTopic.id}-sibling`,
            source: topic.id,
            target: nextTopic.id,
            animated: !isCompleted,
            style: {
              stroke: isCompleted ? "#10b981" : "hsl(var(--border))",
              strokeWidth: isCompleted ? 3 : 2,
              strokeDasharray: "5, 5"
            },
          });
        }
      });
    };

    // Start processing from root level
    processTopicLevel(topics, null, 0, 50);

    return { nodes: generatedNodes, edges: generatedEdges };
  }, [currentSession?.extractedTopics, completionHash]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Update nodes and edges when topics change
  useEffect(() => {
    console.log('🔄 Updating tree nodes and edges - topics changed');
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  const onConnect = useCallback(() => {}, []);

  const handleContentSubmit = useCallback((content: string) => {
    if (!currentSession) return;
    setIsProcessing(true);
    // Simulate processing delay
    setTimeout(() => {
      processStudyContent(currentSession.id, content);
      setIsProcessing(false);
    }, 1500);
  }, [currentSession, processStudyContent]);

  // Store session ID in a ref to avoid recreating callbacks
  const sessionIdRef = useMemo(() => currentSession?.id, [currentSession?.id]);

  const handleAnswerQuestion = useCallback((topicId: string, answerIndex: number) => {
    if (!sessionIdRef) return { correct: false, explanation: '' };
    return answerQuestion(sessionIdRef, topicId, answerIndex);
  }, [sessionIdRef, answerQuestion]);

  const handleMoveToNext = useCallback((topicId: string) => {
    if (!sessionIdRef) return;
    console.log('🎯 handleMoveToNext called for topic:', topicId);
    moveToNextQuestion(sessionIdRef, topicId);
  }, [sessionIdRef, moveToNextQuestion]);

  const handleCompleteTopic = useCallback((topicId: string) => {
    if (!sessionIdRef) return;
    completeTopic(sessionIdRef, topicId);
    setShowSummary(true);
  }, [sessionIdRef, completeTopic]);

  const handleSkipToNextTopic = useCallback(() => {
    const currentIndex = leafTopics.findIndex(t => t.id === selectedTopicId);
    const nextTopic = leafTopics[currentIndex + 1];

    if (nextTopic) {
      setSelectedTopicId(nextTopic.id);
      setShowSummary(false);
    } else {
      // No more topics, go back to topic list
      setSelectedTopicId(null);
    }
  }, [leafTopics, selectedTopicId]);

  const handleContinueToNextTopic = useCallback(() => {
    handleSkipToNextTopic();
  }, [handleSkipToNextTopic]);

  const handleRetryTopic = useCallback(() => {
    if (!selectedTopicId || !sessionIdRef) return;

    console.log('🔄 Retrying topic:', selectedTopicId);

    // Reset the topic in the store (score, completed, questionIndex)
    resetTopic(sessionIdRef, selectedTopicId);

    // Reset local state
    setLocalQuestionIndex(0);
    setShowSummary(false);
  }, [selectedTopicId, sessionIdRef, resetTopic]);

  const selectedTopic = useMemo(() => {
    const topic = flattenedTopics.find(t => t.id === selectedTopicId);
    if (topic && selectedTopicId) {
      console.log('📍 Selected topic found:', {
        id: topic.id,
        title: topic.title,
        currentQuestionIndex: topic.currentQuestionIndex,
        totalQuestions: topic.questions?.length
      });
    }
    return topic;
  }, [flattenedTopics, selectedTopicId]);

  // Simple local handlers that just iterate through the questions array
  const handleAnswerForSelected = useCallback((answerIndex: number) => {
    if (!selectedTopicId || !selectedTopic || !sessionIdRef) return { correct: false, explanation: '' };

    console.log(`📝 Answering question ${localQuestionIndex + 1} of ${selectedTopic.questions.length}`);

    // Call answerQuestion with the LOCAL question index (not store's currentQuestionIndex)
    const result = answerQuestion(sessionIdRef, selectedTopicId, answerIndex, localQuestionIndex);

    console.log(`📝 Answer ${answerIndex} - ${result.correct ? '✅ Correct!' : '❌ Wrong'}`, {
      currentIndex: localQuestionIndex,
      totalQuestions: selectedTopic.questions.length
    });

    return result;
  }, [selectedTopicId, selectedTopic, localQuestionIndex, sessionIdRef, answerQuestion]);

  const handleMoveToNextForSelected = useCallback(() => {
    if (!selectedTopic) return;

    const nextIndex = localQuestionIndex + 1;
    console.log(`➡️ Moving from question ${localQuestionIndex + 1} to ${nextIndex + 1} of ${selectedTopic.questions.length}`);

    setLocalQuestionIndex(nextIndex);

    // Also update the store
    if (selectedTopicId && sessionIdRef) {
      moveToNextQuestion(sessionIdRef, selectedTopicId);
    }
  }, [selectedTopic, localQuestionIndex, selectedTopicId, sessionIdRef, moveToNextQuestion]);

  const handleMoveToPreviousForSelected = useCallback(() => {
    if (!selectedTopic || localQuestionIndex === 0) return;

    const prevIndex = localQuestionIndex - 1;
    console.log(`⬅️ Moving from question ${localQuestionIndex + 1} to ${prevIndex + 1} of ${selectedTopic.questions.length}`);

    setLocalQuestionIndex(prevIndex);
  }, [selectedTopic, localQuestionIndex]);

  const handleCompleteForSelected = useCallback(() => {
    if (!selectedTopicId || !sessionIdRef) return;

    console.log('✅ Completing topic:', selectedTopicId);
    completeTopic(sessionIdRef, selectedTopicId);
    setShowSummary(true);
  }, [selectedTopicId, sessionIdRef, completeTopic]);

  const topics = currentSession?.extractedTopics || [];

  // No session selected - show create new option
  if (!currentSession) {
    return (
      <div className="min-h-screen bg-background">
        <Sidebar />
        <main className="airbnb-container flex items-center justify-center py-20">
          <div className="text-center p-8 max-w-md">
            <BookOpen size={64} className="mx-auto text-primary mb-4" />
            <h2 className="text-2xl font-bold text-foreground mb-2">Start Full Study</h2>
            <p className="text-muted-foreground mb-6">
              Create a new study session or select an existing one from the sidebar to begin Full Study mode.
            </p>
            <Button 
              size="lg" 
              onClick={() => {
                const name = prompt("Enter a name for your new study session:");
                if (name) {
                  alert(`Session "${name}" would be created. Select it from the sidebar to continue.`);
                }
              }}
              className="gap-2"
            >
              <PlusCircle size={20} />
              Create New Study Session
            </Button>
          </div>
        </main>
      </div>
    );
  }

  // Session selected but no content uploaded yet
  if (!currentSession.extractedTopics || currentSession.extractedTopics.length === 0) {
    // Show loading state while fetching session data
    if (isLoadingSession) {
      return (
        <div className="min-h-screen bg-background">
          <Sidebar />
          <main className="airbnb-container flex items-center justify-center py-20">
            <LoadingSpinner message="Loading your study session..." size="lg" />
          </main>
        </div>
      );
    }

    // Show upload screen if no topics after loading
    return (
      <div className="min-h-screen bg-background">
        <Sidebar />
        <main className="airbnb-container flex items-center justify-center py-20">
          <StudyContentUpload
            onContentSubmit={handleContentSubmit}
            isProcessing={isProcessing}
          />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      
      <main className="flex-1 flex flex-col lg:flex-row" style={{ height: 'calc(100vh - 80px)' }}>
        <ResizablePanelGroup direction="horizontal" className="flex-1">
          {/* Left Side - Learning Map / Topic List & Quiz */}
          <ResizablePanel defaultSize={mapCollapsed ? 95 : 65} minSize={50} maxSize={95}>
            <div className="h-full overflow-y-auto overflow-x-hidden p-4 border-r border-border">
              <div className="space-y-4 w-full">
                {/* Header with view toggle */}
                <div>
                  <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                    <BookOpen size={24} />
                    {currentSession.title}
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    {leafTopics.filter(t => t.completed).length} of {leafTopics.length} subtopics completed
                  </p>

                  {/* View toggle pills */}
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => { setShowLearningMap(true); setSelectedTopicId(null); }}
                      className={`airbnb-pill text-xs ${showLearningMap && !selectedTopicId ? 'airbnb-pill-active' : ''}`}
                    >
                      🗺️ Learning Map
                    </button>
                    <button
                      onClick={() => { setShowLearningMap(false); setSelectedTopicId(null); }}
                      className={`airbnb-pill text-xs ${!showLearningMap && !selectedTopicId ? 'airbnb-pill-active' : ''}`}
                    >
                      📋 Topics
                    </button>
                  </div>
                </div>

                {/* Learning Map View */}
                {showLearningMap && !selectedTopicId && (
                  <LearningMap
                    steps={learningMapSteps}
                    currentStepIndex={currentMapStep}
                    onStepClick={(index) => {
                      setCurrentMapStep(index);
                      // When clicking a quiz or cards step, open the first available topic
                      const step = learningMapSteps[index];
                      if (step && !step.locked) {
                        const firstLeaf = leafTopics.find(t => !t.completed) || leafTopics[0];
                        if (firstLeaf && (step.type === 'quiz' || step.type === 'cards' || step.type === 'timed-quiz')) {
                          setSelectedTopicId(firstLeaf.id);
                        }
                        // Mark step as started (unlock next)
                        const updatedSteps = [...learningMapSteps];
                        if (index + 1 < updatedSteps.length) {
                          updatedSteps[index + 1] = { ...updatedSteps[index + 1], locked: false };
                        }
                        setLearningMapSteps(updatedSteps);
                      }
                    }}
                    sessionTitle={currentSession.title}
                    overallProgress={leafTopics.length > 0 ? (leafTopics.filter(t => t.completed).length / leafTopics.length) * 100 : 0}
                  />
                )}

                {/* Hierarchical Topic List */}
                {!showLearningMap && !selectedTopicId && (
                  <div className="space-y-3">
                    {topics.map((category) => (
                      <TopicTreeItem
                        key={category.id}
                        topic={category}
                        level={0}
                        expandedCategories={expandedCategories}
                        setExpandedCategories={setExpandedCategories}
                        onTopicSelect={setSelectedTopicId}
                      />
                    ))}
                  </div>
                )}

                {/* Quiz View */}
                {selectedTopicId && selectedTopic && !showSummary && (
                  <div className="space-y-4 w-full">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedTopicId(null)}
                    >
                      ← Back to Topics
                    </Button>

                    <div className="w-full">
                      <TopicQuizCard
                        key={`quiz-${selectedTopicId}-q${localQuestionIndex}`}
                        topicTitle={selectedTopic.title}
                        questions={selectedTopic.questions || []}
                        currentQuestionIndex={localQuestionIndex}
                        onAnswer={handleAnswerForSelected}
                        onMoveToNext={handleMoveToNextForSelected}
                        onMoveToPrevious={handleMoveToPreviousForSelected}
                        onComplete={handleCompleteForSelected}
                        onSkipToNext={handleSkipToNextTopic}
                        score={selectedTopic.score}
                        isCompleted={selectedTopic.completed || false}
                      />
                    </div>
                  </div>
                )}

                {/* Topic Summary */}
                {showSummary && selectedTopic && (
                  <div className="space-y-4">
                    <TopicSummary
                      topicTitle={selectedTopic.title}
                      score={selectedTopic.score || 0}
                      totalQuestions={selectedTopic.questions?.length || 0}
                      onContinue={handleContinueToNextTopic}
                      onRetry={handleRetryTopic}
                      isLastTopic={leafTopics.findIndex(t => t.id === selectedTopicId) === leafTopics.length - 1}
                    />
                  </div>
                )}
              </div>
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* Right Side — Progress Map (1/3 width, collapsible) */}
          <ResizablePanel defaultSize={mapCollapsed ? 5 : 35} minSize={5} maxSize={50} collapsible>
            <div className="h-full flex flex-col bg-card/50">
              {/* Collapse toggle header */}
              <div className="px-3 py-2 border-b border-border flex items-center justify-between">
                {!mapCollapsed && (
                  <div>
                    <h2 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                      <Map size={14} /> Progress Map
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      {leafTopics.filter(t => t.completed).length}/{leafTopics.length} completed
                    </p>
                  </div>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => setMapCollapsed(!mapCollapsed)}
                >
                  <PanelLeftClose size={14} className={`transition-transform ${mapCollapsed ? 'rotate-180' : ''}`} />
                </Button>
              </div>

              {!mapCollapsed && (
                <div className="flex-1 overflow-y-auto">
                  {/* ReactFlow tree */}
                  <div className="h-[50%] bg-gradient-to-br from-background via-background to-muted/30">
                    <ReactFlow
                      nodes={nodes}
                      edges={edges}
                      onNodesChange={onNodesChange}
                      onEdgesChange={onEdgesChange}
                      onConnect={onConnect}
                      onNodeClick={(_, node) => {
                        const topic = flattenedTopics.find(t => t.id === node.id);
                        if (topic && !topic.isCategory) {
                          setSelectedTopicId(node.id);
                          setShowSummary(false);
                        }
                      }}
                      fitView
                      minZoom={0.3}
                      maxZoom={1.2}
                      defaultViewport={{ x: 0, y: 0, zoom: 0.6 }}
                      proOptions={{ hideAttribution: true }}
                      className="[&_.react-flow__node]:transition-transform [&_.react-flow__node]:duration-200 [&_.react-flow__node:hover]:scale-105 [&_.react-flow__node]:cursor-pointer"
                    >
                      <Controls className="bg-card border border-border rounded-lg shadow-lg [&_button]:bg-card [&_button]:border-border [&_button]:text-foreground [&_button:hover]:bg-accent" />
                      <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="hsl(var(--muted-foreground) / 0.2)" />
                    </ReactFlow>
                  </div>

                  {/* Completed topics list */}
                  <div className="p-3 border-t border-border space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Completed Topics</p>
                    {leafTopics.filter(t => t.completed).length === 0 ? (
                      <p className="text-xs text-muted-foreground italic">No topics completed yet</p>
                    ) : (
                      leafTopics.filter(t => t.completed).map(topic => (
                        <div
                          key={topic.id}
                          className="flex items-center gap-2 p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 cursor-pointer hover:shadow-sm transition-all"
                          onClick={() => { setSelectedTopicId(topic.id); setShowSummary(false); }}
                        >
                          <CheckCircle2 size={14} className="text-emerald-500 flex-shrink-0" />
                          <span className="text-xs font-medium text-foreground truncate">{topic.title}</span>
                          {topic.score != null && (
                            <span className="text-xs text-emerald-600 ml-auto flex-shrink-0">{topic.score}%</span>
                          )}
                        </div>
                      ))
                    )}

                    {/* Remaining topics */}
                    {leafTopics.filter(t => !t.completed).length > 0 && (
                      <>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mt-3">Remaining</p>
                        {leafTopics.filter(t => !t.completed).map(topic => (
                          <div
                            key={topic.id}
                            className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 border border-border cursor-pointer hover:shadow-sm transition-all"
                            onClick={() => { setSelectedTopicId(topic.id); setShowSummary(false); }}
                          >
                            <Circle size={14} className="text-muted-foreground flex-shrink-0" />
                            <span className="text-xs text-muted-foreground truncate">{topic.title}</span>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </main>
    </div>
  );
}
