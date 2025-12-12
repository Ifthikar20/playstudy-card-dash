import { useState, useCallback } from "react";
import { Sidebar } from "@/components/Sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookOpen, Play, CheckCircle2, Circle, ChevronRight } from "lucide-react";
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

const initialNodes: Node[] = [
  {
    id: "1",
    type: "default",
    data: { label: "📚 Introduction to Subject" },
    position: { x: 250, y: 0 },
    style: { background: "hsl(var(--primary))", color: "white", border: "none", borderRadius: "8px", padding: "12px" },
  },
  {
    id: "2",
    type: "default",
    data: { label: "✅ Chapter 1: Basics" },
    position: { x: 100, y: 100 },
    style: { background: "hsl(142 76% 36%)", color: "white", border: "none", borderRadius: "8px", padding: "12px" },
  },
  {
    id: "3",
    type: "default",
    data: { label: "✅ Chapter 2: Core Concepts" },
    position: { x: 400, y: 100 },
    style: { background: "hsl(142 76% 36%)", color: "white", border: "none", borderRadius: "8px", padding: "12px" },
  },
  {
    id: "4",
    type: "default",
    data: { label: "🔄 Chapter 3: Advanced Topics" },
    position: { x: 100, y: 200 },
    style: { background: "hsl(45 93% 47%)", color: "black", border: "none", borderRadius: "8px", padding: "12px" },
  },
  {
    id: "5",
    type: "default",
    data: { label: "⏳ Chapter 4: Applications" },
    position: { x: 400, y: 200 },
    style: { background: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))", border: "2px dashed hsl(var(--border))", borderRadius: "8px", padding: "12px" },
  },
  {
    id: "6",
    type: "default",
    data: { label: "🔒 Chapter 5: Mastery" },
    position: { x: 250, y: 300 },
    style: { background: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))", border: "2px dashed hsl(var(--border))", borderRadius: "8px", padding: "12px" },
  },
];

const initialEdges: Edge[] = [
  { id: "e1-2", source: "1", target: "2", animated: false, style: { stroke: "hsl(142 76% 36%)" } },
  { id: "e1-3", source: "1", target: "3", animated: false, style: { stroke: "hsl(142 76% 36%)" } },
  { id: "e2-4", source: "2", target: "4", animated: true, style: { stroke: "hsl(45 93% 47%)" } },
  { id: "e3-5", source: "3", target: "5", animated: false, style: { stroke: "hsl(var(--border))" } },
  { id: "e4-6", source: "4", target: "6", animated: false, style: { stroke: "hsl(var(--border))" } },
  { id: "e5-6", source: "5", target: "6", animated: false, style: { stroke: "hsl(var(--border))" } },
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
      
      <main className="flex-1 flex flex-col lg:flex-row">
        {/* Left Side - Quiz Options */}
        <div className="w-full lg:w-80 border-b lg:border-b-0 lg:border-r border-border p-4 overflow-y-auto">
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

        {/* Right Side - Topic Tree View */}
        <div className="flex-1 flex flex-col">
          <div className="p-4 border-b border-border">
            <h2 className="text-xl font-bold text-foreground">Learning Progress Tree</h2>
            <p className="text-sm text-muted-foreground">
              Drag nodes to reorganize • Click to view details • Complete quizzes to unlock new paths
            </p>
          </div>
          
          <div className="flex-1 min-h-[400px] lg:min-h-0">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              fitView
              attributionPosition="bottom-left"
            >
              <Controls />
              <MiniMap 
                nodeColor={(node) => {
                  const bg = node.style?.background as string || "";
                  if (bg.includes("142")) return "#22c55e";
                  if (bg.includes("45")) return "#eab308";
                  if (bg.includes("primary")) return "#6366f1";
                  return "#94a3b8";
                }}
              />
              <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
            </ReactFlow>
          </div>

          {/* Legend */}
          <div className="p-4 border-t border-border">
            <div className="flex flex-wrap gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-green-500"></div>
                <span className="text-muted-foreground">Completed</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-yellow-500"></div>
                <span className="text-muted-foreground">In Progress</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-muted border-2 border-dashed border-border"></div>
                <span className="text-muted-foreground">Locked</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-primary"></div>
                <span className="text-muted-foreground">Current Topic</span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
