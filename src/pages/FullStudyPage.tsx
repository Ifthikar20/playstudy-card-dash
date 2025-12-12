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

  // Generate nodes and edges from extracted topics
  const { nodes: initialNodes, edges: initialEdges } = useMemo(() => {
    const topics = currentSession?.extractedTopics || [];
    
    if (topics.length === 0) {
      return { nodes: [], edges: [] };
    }

    const generatedNodes: Node[] = topics.map((topic, index) => {
      const isCompleted = topic.completed;
      const isCurrent = !isCompleted && (index === 0 || topics[index - 1]?.completed);
      const isLocked = !isCompleted && !isCurrent;

      let style = nodeStyles.locked;
      let emoji = "🔒";
      
      if (isCompleted) {
        style = nodeStyles.completed;
        emoji = "✅";
      } else if (isCurrent) {
        style = nodeStyles.current;
        emoji = "📚";
      } else {
        emoji = "⏳";
      }

      // Position nodes in a tree-like structure
      const row = Math.floor(index / 2);
      const col = index % 2;
      const x = col === 0 ? 100 : 350;
      const y = row * 120;

      return {
        id: topic.id,
        type: "default",
        data: { label: `${emoji} ${topic.title}` },
        position: { x, y },
        style,
      };
    });

    const generatedEdges: Edge[] = topics.slice(1).map((topic, index) => {
      const sourceId = topics[index].id;
      const targetId = topic.id;
      const isCompleted = topics[index].completed;

      return {
        id: `e-${sourceId}-${targetId}`,
        source: sourceId,
        target: targetId,
        animated: !isCompleted && topics[index + 1]?.completed !== true,
        style: { 
          stroke: isCompleted ? "#10b981" : "hsl(var(--border))", 
          strokeWidth: isCompleted ? 3 : 2 
        },
      };
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

  const handleContinueToNextTopic = () => {
    const topics = currentSession?.extractedTopics || [];
    const currentIndex = topics.findIndex(t => t.id === selectedTopicId);
    const nextTopic = topics[currentIndex + 1];
    
    setShowSummary(false);
    
    if (nextTopic) {
      setSelectedTopicId(nextTopic.id);
    } else {
      setSelectedTopicId(null);
    }
  };

  const handleRetryTopic = () => {
    setShowSummary(false);
    // Reset would require store update - for now just close summary
  };

  const selectedTopic = currentSession?.extractedTopics?.find(t => t.id === selectedTopicId);
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
                    {topics.filter(t => t.completed).length} of {topics.length} topics completed
                  </p>
                </div>

                {/* Topic List */}
                {!selectedTopicId && (
                  <div className="space-y-2">
                    {topics.map((topic, index) => {
                      const isCompleted = topic.completed;
                      const isCurrent = !isCompleted && (index === 0 || topics[index - 1]?.completed);
                      const isLocked = !isCompleted && !isCurrent;

                      return (
                        <Card 
                          key={topic.id}
                          className={`cursor-pointer transition-all ${
                            isLocked ? "opacity-60" : "hover:shadow-md"
                          } ${isCompleted ? "bg-green-50 dark:bg-green-950/20" : ""}`}
                          onClick={() => !isLocked && setSelectedTopicId(topic.id)}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                {isCompleted ? (
                                  <CheckCircle2 className="text-green-600 dark:text-green-400" size={20} />
                                ) : isLocked ? (
                                  <Lock className="text-muted-foreground" size={20} />
                                ) : (
                                  <Circle className="text-primary" size={20} />
                                )}
                                <div>
                                  <p className="font-medium text-foreground text-sm">{topic.title}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {topic.questions.length} questions
                                    {topic.description && ` • ${topic.description}`}
                                  </p>
                                </div>
                              </div>
                              {isCompleted && topic.score !== null && (
                                <span className="text-sm font-semibold text-green-600 dark:text-green-400">
                                  {Math.round(topic.score)}%
                                </span>
                              )}
                            </div>
                          </CardContent>
                        </Card>
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
                      questions={selectedTopic.questions}
                      currentQuestionIndex={selectedTopic.currentQuestionIndex}
                      onAnswer={(answerIndex) => handleAnswerQuestion(selectedTopicId, answerIndex)}
                      onComplete={() => handleCompleteTopic(selectedTopicId)}
                      score={selectedTopic.score}
                      isCompleted={selectedTopic.completed}
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
                  Click topics to start • Complete quizzes to unlock new paths
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
                    const topic = topics.find(t => t.id === node.id);
                    if (topic) {
                      const index = topics.indexOf(topic);
                      const isCurrent = !topic.completed && (index === 0 || topics[index - 1]?.completed);
                      if (!topic.completed || isCurrent) {
                        setSelectedTopicId(node.id);
                        setShowSummary(false);
                      }
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
