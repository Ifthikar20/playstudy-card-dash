import { useState, useCallback } from "react";
import { Sidebar } from "@/components/Sidebar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookOpen, Play, CheckCircle2, Circle } from "lucide-react";
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

// Modern node styles with gradients and shadows
const nodeStyles = {
  completed: {
    background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
    color: "white",
    border: "none",
    borderRadius: "12px",
    padding: "16px 20px",
    boxShadow: "0 4px 14px rgba(16, 185, 129, 0.4)",
    fontWeight: 600,
  },
  inProgress: {
    background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
    color: "white",
    border: "none",
    borderRadius: "12px",
    padding: "16px 20px",
    boxShadow: "0 4px 14px rgba(245, 158, 11, 0.4)",
    fontWeight: 600,
  },
  locked: {
    background: "linear-gradient(135deg, hsl(var(--muted)) 0%, hsl(var(--muted)) 100%)",
    color: "hsl(var(--muted-foreground))",
    border: "2px dashed hsl(var(--border))",
    borderRadius: "12px",
    padding: "16px 20px",
    fontWeight: 500,
  },
  current: {
    background: "linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(260 80% 50%) 100%)",
    color: "white",
    border: "none",
    borderRadius: "12px",
    padding: "16px 20px",
    boxShadow: "0 4px 20px hsla(var(--primary), 0.5)",
    fontWeight: 600,
  },
};

const initialNodes: Node[] = [
  {
    id: "1",
    type: "default",
    data: { label: "📚 Introduction to Subject" },
    position: { x: 250, y: 0 },
    style: nodeStyles.current,
  },
  {
    id: "2",
    type: "default",
    data: { label: "✅ Chapter 1: Basics" },
    position: { x: 80, y: 120 },
    style: nodeStyles.completed,
  },
  {
    id: "3",
    type: "default",
    data: { label: "✅ Chapter 2: Core Concepts" },
    position: { x: 420, y: 120 },
    style: nodeStyles.completed,
  },
  {
    id: "4",
    type: "default",
    data: { label: "🔄 Chapter 3: Advanced Topics" },
    position: { x: 80, y: 240 },
    style: nodeStyles.inProgress,
  },
  {
    id: "5",
    type: "default",
    data: { label: "⏳ Chapter 4: Applications" },
    position: { x: 420, y: 240 },
    style: nodeStyles.locked,
  },
  {
    id: "6",
    type: "default",
    data: { label: "🔒 Chapter 5: Mastery" },
    position: { x: 250, y: 360 },
    style: nodeStyles.locked,
  },
];

const initialEdges: Edge[] = [
  { id: "e1-2", source: "1", target: "2", animated: false, style: { stroke: "#10b981", strokeWidth: 3 } },
  { id: "e1-3", source: "1", target: "3", animated: false, style: { stroke: "#10b981", strokeWidth: 3 } },
  { id: "e2-4", source: "2", target: "4", animated: true, style: { stroke: "#f59e0b", strokeWidth: 3 } },
  { id: "e3-5", source: "3", target: "5", animated: false, style: { stroke: "hsl(var(--border))", strokeWidth: 2 } },
  { id: "e4-6", source: "4", target: "6", animated: false, style: { stroke: "hsl(var(--border))", strokeWidth: 2 } },
  { id: "e5-6", source: "5", target: "6", animated: false, style: { stroke: "hsl(var(--border))", strokeWidth: 2 } },
];

const quizTopics = [
  { id: 1, title: "Introduction Quiz", questions: 10, completed: true, score: 95 },
  { id: 2, title: "Chapter 1: Basics", questions: 15, completed: true, score: 88 },
  { id: 3, title: "Chapter 2: Core Concepts", questions: 20, completed: true, score: 92 },
  { id: 4, title: "Chapter 3: Advanced", questions: 25, completed: false, score: null },
  { id: 5, title: "Chapter 4: Applications", questions: 15, completed: false, score: null },
  { id: 6, title: "Final Mastery Test", questions: 50, completed: false, score: null },
];

export default function FullStudyPage() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedQuiz, setSelectedQuiz] = useState<number | null>(null);

  const onConnect = useCallback(() => {}, []);

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      
      <main className="flex-1 flex flex-col lg:flex-row min-h-0">
        <ResizablePanelGroup direction="horizontal" className="flex-1">
          {/* Left Side - Quiz Options */}
          <ResizablePanel defaultSize={50} minSize={20} maxSize={70}>
            <div className="h-full overflow-y-auto p-4 border-r border-border">
              <div className="space-y-4">
                <div>
                  <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                    <BookOpen size={24} />
                    Study Quizzes
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Complete quizzes to unlock new topics
                  </p>
                </div>

                <div className="space-y-2">
                  {quizTopics.map((quiz) => (
                    <Card 
                      key={quiz.id}
                      className={`cursor-pointer transition-all hover:shadow-md ${
                        selectedQuiz === quiz.id ? "ring-2 ring-primary" : ""
                      } ${quiz.completed ? "bg-green-50 dark:bg-green-950/20" : ""}`}
                      onClick={() => setSelectedQuiz(quiz.id)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {quiz.completed ? (
                              <CheckCircle2 className="text-green-600 dark:text-green-400" size={20} />
                            ) : (
                              <Circle className="text-muted-foreground" size={20} />
                            )}
                            <div>
                              <p className="font-medium text-foreground text-sm">{quiz.title}</p>
                              <p className="text-xs text-muted-foreground">{quiz.questions} questions</p>
                            </div>
                          </div>
                          {quiz.completed && quiz.score && (
                            <span className="text-sm font-semibold text-green-600 dark:text-green-400">
                              {quiz.score}%
                            </span>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {selectedQuiz && (
                  <Button className="w-full" size="lg">
                    <Play size={18} className="mr-2" />
                    Start Quiz
                  </Button>
                )}
              </div>
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* Right Side - Topic Tree View */}
          <ResizablePanel defaultSize={50} minSize={30}>
            <div className="h-full flex flex-col">
              <div className="p-4 border-b border-border">
                <h2 className="text-xl font-bold text-foreground">Learning Progress Tree</h2>
                <p className="text-sm text-muted-foreground">
                  Drag nodes to reorganize • Click to view details • Complete quizzes to unlock new paths
                </p>
              </div>
              
              <div className="flex-1 bg-gradient-to-br from-background via-background to-muted/30">
                <ReactFlow
                  nodes={nodes}
                  edges={edges}
                  onNodesChange={onNodesChange}
                  onEdgesChange={onEdgesChange}
                  onConnect={onConnect}
                  fitView
                  minZoom={0.5}
                  maxZoom={1.5}
                  defaultViewport={{ x: 0, y: 0, zoom: 0.85 }}
                  attributionPosition="bottom-left"
                  className="[&_.react-flow__node]:transition-transform [&_.react-flow__node]:duration-200 [&_.react-flow__node:hover]:scale-105"
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
              <div className="p-4 border-t border-border bg-card/50 backdrop-blur-sm">
                <div className="flex flex-wrap gap-6 text-sm justify-center">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-md shadow-emerald-500/30"></div>
                    <span className="text-muted-foreground font-medium">Completed</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-lg bg-gradient-to-br from-amber-500 to-amber-600 shadow-md shadow-amber-500/30"></div>
                    <span className="text-muted-foreground font-medium">In Progress</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-lg bg-muted border-2 border-dashed border-border"></div>
                    <span className="text-muted-foreground font-medium">Locked</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-lg bg-gradient-to-br from-primary to-purple-600 shadow-md shadow-primary/30"></div>
                    <span className="text-muted-foreground font-medium">Current Topic</span>
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
