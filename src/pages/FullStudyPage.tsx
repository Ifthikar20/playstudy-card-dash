import { useState, useCallback, useMemo } from "react";
import { Sidebar } from "@/components/Sidebar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookOpen, CheckCircle2, Circle, PlusCircle, Lock } from "lucide-react";
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

export default function FullStudyPage() {
  const { currentSession, processStudyContent, answerQuestion, completeTopic } = useAppStore();
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const [showSummary, setShowSummary] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  // Flatten topics for easier access (includes both categories and subtopics)
  const flattenedTopics = useMemo(() => {
    const topics = currentSession?.extractedTopics || [];
    const flattened: any[] = [];

    topics.forEach((category) => {
      flattened.push(category);
      if (category.subtopics && category.subtopics.length > 0) {
        flattened.push(...category.subtopics);
      }
    });

    return flattened;
  }, [currentSession?.extractedTopics]);

  // Get only leaf topics (topics with questions, not categories)
  const leafTopics = useMemo(() => {
    return flattenedTopics.filter(t => !t.isCategory);
  }, [flattenedTopics]);

  // Generate nodes and edges from extracted topics (hierarchical structure)
  const { nodes: initialNodes, edges: initialEdges } = useMemo(() => {
    const topics = currentSession?.extractedTopics || [];

    if (topics.length === 0) {
      return { nodes: [], edges: [] };
    }

    const generatedNodes: Node[] = [];
    const generatedEdges: Edge[] = [];
    let yOffset = 0;

    topics.forEach((category, catIndex) => {
      const categoryCompleted = category.subtopics?.every((st: any) => st.completed) || false;

      // Category node
      let categoryStyle = nodeStyles.locked;
      let categoryEmoji = "📁";

      if (categoryCompleted) {
        categoryStyle = nodeStyles.completed;
        categoryEmoji = "✅";
      } else if (category.subtopics?.some((st: any) => !st.completed)) {
        categoryStyle = nodeStyles.inProgress;
        categoryEmoji = "📂";
      }

      generatedNodes.push({
        id: category.id,
        type: "default",
        data: { label: `${categoryEmoji} ${category.title}` },
        position: { x: 50, y: yOffset },
        style: { ...categoryStyle, fontWeight: 600, fontSize: "13px" },
      });

      yOffset += 80;

      // Subtopic nodes
      if (category.subtopics && category.subtopics.length > 0) {
        category.subtopics.forEach((subtopic: any, subIndex: number) => {
          const isCompleted = subtopic.completed;

          let style = nodeStyles.locked;
          let emoji = "📝";

          if (isCompleted) {
            style = nodeStyles.completed;
            emoji = "✅";
          } else {
            style = nodeStyles.current;
            emoji = "📚";
          }

          generatedNodes.push({
            id: subtopic.id,
            type: "default",
            data: { label: `${emoji} ${subtopic.title}` },
            position: { x: 300, y: yOffset },
            style,
          });

          // Edge from category to subtopic
          generatedEdges.push({
            id: `e-${category.id}-${subtopic.id}`,
            source: category.id,
            target: subtopic.id,
            animated: !isCompleted,
            style: {
              stroke: isCompleted ? "#10b981" : "hsl(var(--border))",
              strokeWidth: isCompleted ? 3 : 2
            },
          });

          // Edge to next subtopic (if exists)
          if (subIndex < category.subtopics.length - 1) {
            const nextSubtopic = category.subtopics[subIndex + 1];
            generatedEdges.push({
              id: `e-${subtopic.id}-${nextSubtopic.id}`,
              source: subtopic.id,
              target: nextSubtopic.id,
              animated: !isCompleted,
              style: {
                stroke: isCompleted ? "#10b981" : "hsl(var(--border))",
                strokeWidth: isCompleted ? 3 : 2,
                strokeDasharray: "5, 5"
              },
            });
          }

          yOffset += 100;
        });
      }

      yOffset += 20; // Extra space between categories
    });

    return { nodes: generatedNodes, edges: generatedEdges };
  }, [currentSession?.extractedTopics]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Update nodes when topics change
  useMemo(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  const onConnect = useCallback(() => {}, []);

  const handleContentSubmit = (content: string) => {
    if (!currentSession) return;
    setIsProcessing(true);
    // Simulate processing delay
    setTimeout(() => {
      processStudyContent(currentSession.id, content);
      setIsProcessing(false);
    }, 1500);
  };

  const handleAnswerQuestion = (topicId: string, answerIndex: number) => {
    if (!currentSession) return { correct: false, explanation: '' };
    return answerQuestion(currentSession.id, topicId, answerIndex);
  };

  const handleCompleteTopic = (topicId: string) => {
    if (!currentSession) return;
    setShowSummary(true);
  };

  const handleSkipToNextTopic = () => {
    const currentIndex = leafTopics.findIndex(t => t.id === selectedTopicId);
    const nextTopic = leafTopics[currentIndex + 1];

    if (nextTopic) {
      setSelectedTopicId(nextTopic.id);
      setShowSummary(false);
    } else {
      // No more topics, go back to topic list
      setSelectedTopicId(null);
    }
  };

  const handleContinueToNextTopic = () => {
    handleSkipToNextTopic();
  };

  const handleRetryTopic = () => {
    setShowSummary(false);
    // Reset would require store update - for now just close summary
  };

  const selectedTopic = flattenedTopics.find(t => t.id === selectedTopicId);
  const topics = currentSession?.extractedTopics || [];

  // No session selected - show create new option
  if (!currentSession) {
    return (
      <div className="flex min-h-screen bg-background">
        <Sidebar />
        <main className="flex-1 flex items-center justify-center pt-24">
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
    return (
      <div className="flex min-h-screen bg-background">
        <Sidebar />
        <main className="flex-1 flex items-center justify-center p-6">
          <StudyContentUpload 
            onContentSubmit={handleContentSubmit}
            isProcessing={isProcessing}
          />
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      
      <main className="flex-1 flex flex-col lg:flex-row min-h-0">
        <ResizablePanelGroup direction="horizontal" className="flex-1">
          {/* Left Side - Topic List & Quiz */}
          <ResizablePanel defaultSize={50} minSize={30} maxSize={70}>
            <div className="h-full overflow-y-auto p-4 border-r border-border">
              <div className="space-y-4">
                <div>
                  <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                    <BookOpen size={24} />
                    {currentSession.title}
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    {leafTopics.filter(t => t.completed).length} of {leafTopics.length} subtopics completed
                  </p>
                </div>

                {/* Hierarchical Topic List */}
                {!selectedTopicId && (
                  <div className="space-y-3">
                    {topics.map((category, catIndex) => {
                      const categoryCompleted = category.subtopics?.every((st: any) => st.completed) || false;
                      const isExpanded = expandedCategories.has(category.id);

                      return (
                        <div key={category.id} className="space-y-2">
                          {/* Category Header */}
                          <Card className={`transition-all ${categoryCompleted ? "bg-green-50 dark:bg-green-950/20" : ""}`}>
                            <CardContent className="p-3">
                              <div
                                className="flex items-center justify-between cursor-pointer"
                                onClick={() => {
                                  const newExpanded = new Set(expandedCategories);
                                  if (isExpanded) {
                                    newExpanded.delete(category.id);
                                  } else {
                                    newExpanded.add(category.id);
                                  }
                                  setExpandedCategories(newExpanded);
                                }}
                              >
                                <div className="flex items-center gap-3">
                                  {categoryCompleted ? (
                                    <CheckCircle2 className="text-green-600 dark:text-green-400" size={20} />
                                  ) : (
                                    <Circle className="text-amber-600" size={20} />
                                  )}
                                  <div>
                                    <p className="font-semibold text-foreground">{category.title}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {category.subtopics?.length || 0} subtopics
                                      {category.description && ` • ${category.description}`}
                                    </p>
                                  </div>
                                </div>
                                <span className="text-sm text-muted-foreground">
                                  {isExpanded ? "▼" : "▶"}
                                </span>
                              </div>
                            </CardContent>
                          </Card>

                          {/* Subtopics (expanded) */}
                          {isExpanded && category.subtopics && category.subtopics.length > 0 && (
                            <div className="ml-6 space-y-2">
                              {category.subtopics.map((subtopic: any, subIndex: number) => {
                                const isCompleted = subtopic.completed;

                                return (
                                  <Card
                                    key={subtopic.id}
                                    className={`cursor-pointer transition-all hover:shadow-md ${
                                      isCompleted ? "bg-green-50 dark:bg-green-950/20" : ""
                                    }`}
                                    onClick={() => setSelectedTopicId(subtopic.id)}
                                  >
                                    <CardContent className="p-3">
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                          {isCompleted ? (
                                            <CheckCircle2 className="text-green-600 dark:text-green-400" size={18} />
                                          ) : (
                                            <Circle className="text-primary" size={18} />
                                          )}
                                          <div>
                                            <p className="font-medium text-foreground text-sm">{subtopic.title}</p>
                                            <p className="text-xs text-muted-foreground">
                                              {subtopic.questions?.length || 0} questions
                                              {subtopic.description && ` • ${subtopic.description}`}
                                            </p>
                                          </div>
                                        </div>
                                        {isCompleted && subtopic.score !== null && (
                                          <span className="text-sm font-semibold text-green-600 dark:text-green-400">
                                            {Math.round(subtopic.score)}%
                                          </span>
                                        )}
                                      </div>
                                    </CardContent>
                                  </Card>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Quiz View */}
                {selectedTopicId && selectedTopic && !showSummary && (
                  <div className="space-y-4">
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => setSelectedTopicId(null)}
                    >
                      ← Back to Topics
                    </Button>
                    
                    <TopicQuizCard
                      topicTitle={selectedTopic.title}
                      questions={selectedTopic.questions || []}
                      currentQuestionIndex={selectedTopic.currentQuestionIndex || 0}
                      onAnswer={(answerIndex) => handleAnswerQuestion(selectedTopicId, answerIndex)}
                      onComplete={() => handleCompleteTopic(selectedTopicId)}
                      onSkipToNext={handleSkipToNextTopic}
                      score={selectedTopic.score}
                      isCompleted={selectedTopic.completed || false}
                    />
                  </div>
                )}

                {/* Topic Summary */}
                {showSummary && selectedTopic && (
                  <div className="space-y-4">
                    <TopicSummary
                      topicTitle={selectedTopic.title}
                      score={selectedTopic.score || 0}
                      totalQuestions={selectedTopic.questions.length}
                      onContinue={handleContinueToNextTopic}
                      onRetry={handleRetryTopic}
                      isLastTopic={topics.findIndex(t => t.id === selectedTopicId) === topics.length - 1}
                    />
                  </div>
                )}
              </div>
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* Right Side - Topic Tree View */}
          <ResizablePanel defaultSize={50} minSize={30}>
            <div className="h-full flex flex-col">
              <div className="px-4 py-2 border-b border-border">
                <h2 className="text-sm font-semibold text-foreground">Learning Progress Tree</h2>
                <p className="text-xs text-muted-foreground">
                  Click any subtopic to start • Navigate freely between topics
                </p>
              </div>

              <div className="flex-1 bg-gradient-to-br from-background via-background to-muted/30">
                <ReactFlow
                  nodes={nodes}
                  edges={edges}
                  onNodesChange={onNodesChange}
                  onEdgesChange={onEdgesChange}
                  onConnect={onConnect}
                  onNodeClick={(_, node) => {
                    // Find the topic in the flattened list
                    const topic = flattenedTopics.find(t => t.id === node.id);
                    if (topic && !topic.isCategory) {
                      // Allow clicking on any subtopic (not categories)
                      setSelectedTopicId(node.id);
                      setShowSummary(false);
                    }
                  }}
                  fitView
                  minZoom={0.5}
                  maxZoom={1.5}
                  defaultViewport={{ x: 0, y: 0, zoom: 0.85 }}
                  attributionPosition="bottom-left"
                  className="[&_.react-flow__node]:transition-transform [&_.react-flow__node]:duration-200 [&_.react-flow__node:hover]:scale-105 [&_.react-flow__node]:cursor-pointer"
                >
                  <Controls 
                    className="bg-card border border-border rounded-lg shadow-lg [&_button]:bg-card [&_button]:border-border [&_button]:text-foreground [&_button:hover]:bg-accent"
                  />
                  <MiniMap 
                    className="bg-card/80 backdrop-blur-sm border border-border rounded-lg shadow-lg"
                    nodeColor={(node) => {
                      const bg = node.style?.background as string || "";
                      if (bg.includes("10b981") || bg.includes("059669")) return "#10b981";
                      if (bg.includes("f59e0b") || bg.includes("d97706")) return "#f59e0b";
                      if (bg.includes("primary")) return "hsl(var(--primary))";
                      return "hsl(var(--muted))";
                    }}
                    maskColor="hsl(var(--background) / 0.8)"
                  />
                  <Background 
                    variant={BackgroundVariant.Dots} 
                    gap={20} 
                    size={1.5} 
                    color="hsl(var(--muted-foreground) / 0.3)"
                  />
                </ReactFlow>
              </div>

              {/* Modern Legend */}
              <div className="px-4 py-2 border-t border-border bg-card/50 backdrop-blur-sm">
                <div className="flex flex-wrap gap-4 text-xs justify-center">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-sm shadow-emerald-500/30"></div>
                    <span className="text-muted-foreground">Completed</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded bg-gradient-to-br from-primary to-purple-600 shadow-sm shadow-primary/30"></div>
                    <span className="text-muted-foreground">Current</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded bg-muted border border-dashed border-border"></div>
                    <span className="text-muted-foreground">Locked</span>
                  </div>
                </div>
              </div>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </main>
    </div>
  );
}
