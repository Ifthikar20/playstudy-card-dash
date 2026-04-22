import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BookOpen, Brain, CheckCircle2, Clock, FileText, GripVertical, Lock, Play, Trophy, Zap, ChevronDown } from "lucide-react";

export type StepType = "overview" | "cards" | "flip-memory" | "quiz" | "dropdown-quiz" | "drag-drop" | "reading" | "summary" | "final-overview" | "timed-quiz";

export interface LearningStep {
  id: string;
  type: StepType;
  title: string;
  description: string;
  intention: string;
  completed: boolean;
  locked: boolean;
  duration?: string;
}

interface LearningMapProps {
  steps: LearningStep[];
  currentStepIndex: number;
  onStepClick: (index: number) => void;
  sessionTitle: string;
  overallProgress: number;
}

const stepIcons: Record<StepType, typeof BookOpen> = {
  "overview": FileText,
  "cards": Brain,
  "flip-memory": Brain,
  "quiz": Zap,
  "dropdown-quiz": ChevronDown,
  "drag-drop": GripVertical,
  "reading": BookOpen,
  "summary": FileText,
  "final-overview": FileText,
  "timed-quiz": Clock,
};

const stepColors: Record<StepType, string> = {
  "overview": "from-blue-500 to-blue-600",
  "cards": "from-purple-500 to-purple-600",
  "flip-memory": "from-violet-500 to-violet-600",
  "quiz": "from-primary to-brand-dark",
  "dropdown-quiz": "from-cyan-500 to-cyan-600",
  "drag-drop": "from-orange-500 to-orange-600",
  "reading": "from-amber-500 to-amber-600",
  "summary": "from-teal-500 to-teal-600",
  "final-overview": "from-indigo-500 to-indigo-600",
  "timed-quiz": "from-primary to-rose-600",
};

export function LearningMap({ steps, currentStepIndex, onStepClick, sessionTitle, overallProgress }: LearningMapProps) {
  return (
    <div className="max-w-2xl mx-auto py-4 px-2">
      {/* Header */}
      <div className="mb-6 text-center">
        <h2 className="text-xl font-bold text-foreground font-heading">{sessionTitle}</h2>
        <p className="text-muted-foreground text-sm mt-1">Your personalized learning path</p>
        <div className="mt-3 mx-auto max-w-xs">
          <div className="flex justify-between text-xs text-muted-foreground mb-1">
            <span>Progress</span>
            <span>{Math.round(overallProgress)}%</span>
          </div>
          <div className="airbnb-progress h-2">
            <div className="airbnb-progress-bar" style={{ width: `${overallProgress}%` }} />
          </div>
        </div>
      </div>

      {/* Learning Path */}
      <div className="relative">
        {steps.map((step, index) => {
          const Icon = stepIcons[step.type];
          const isActive = index === currentStepIndex;
          const isCompleted = step.completed;
          const isLocked = step.locked;
          const gradient = stepColors[step.type];

          return (
            <div key={step.id} className="learning-map-step">
              {/* Node */}
              <div
                className={`learning-map-node ${
                  isCompleted ? "learning-map-node-completed" :
                  isActive ? "learning-map-node-active" :
                  "learning-map-node-locked"
                }`}
              >
                {isCompleted ? <CheckCircle2 size={18} /> : isLocked ? <Lock size={14} /> : <span>{index + 1}</span>}
              </div>

              {/* Step card */}
              <Card
                className={`transition-all duration-200 cursor-pointer border ${
                  isActive ? "border-primary shadow-lg ring-2 ring-primary/20" :
                  isCompleted ? "border-emerald-300 dark:border-emerald-700 bg-emerald-50/50 dark:bg-emerald-950/20" :
                  isLocked ? "opacity-60 border-border" :
                  "border-border hover:shadow-md hover:border-primary/30"
                }`}
                onClick={() => !isLocked && onStepClick(index)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      isCompleted ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600" :
                      isActive ? `bg-gradient-to-br ${gradient} text-white shadow-sm` :
                      "bg-muted text-muted-foreground"
                    }`}>
                      <Icon size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className={`text-sm font-semibold ${isCompleted ? "text-emerald-700 dark:text-emerald-400" : "text-foreground"}`}>
                          {step.title}
                        </p>
                        {step.duration && (
                          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{step.duration}</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{step.description}</p>
                      {/* Intention — explains WHY this step exists */}
                      {isActive && !isCompleted && (
                        <p className="text-xs text-primary/80 mt-1 italic">💡 {step.intention}</p>
                      )}
                    </div>
                    {isActive && !isCompleted && (
                      <Button size="sm" className="rounded-full gap-1 text-xs h-8 flex-shrink-0">
                        <Play size={12} /> Start
                      </Button>
                    )}
                    {isCompleted && (
                      <CheckCircle2 size={18} className="text-emerald-500 flex-shrink-0" />
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          );
        })}

        {/* Finish line */}
        <div className="flex items-center gap-3 pl-12 pt-2">
          <div className="absolute left-0 w-10 h-10 rounded-full flex items-center justify-center bg-gradient-to-br from-amber-400 to-amber-500 text-white border-2 border-amber-400 shadow-lg">
            <Trophy size={18} />
          </div>
          <p className="text-sm font-semibold text-foreground">Session Complete!</p>
        </div>
      </div>
    </div>
  );
}

/** Generate a comprehensive learning path */
export function generateLearningPath(topics: any[], sessionTitle: string): LearningStep[] {
  const totalTopics = topics.length;
  const midpoint = Math.ceil(totalTopics / 2);
  const firstHalf = topics.slice(0, midpoint);
  const secondHalf = topics.slice(midpoint);

  return [
    {
      id: "step-overview",
      type: "overview",
      title: "📖 Overview & Introduction",
      description: `Get the big picture of "${sessionTitle}" — key concepts, structure, and what to expect`,
      intention: "We start with a high-level overview so you understand the full landscape before diving into details.",
      completed: false,
      locked: false,
      duration: "3 min",
    },
    {
      id: "step-cards-1",
      type: "cards",
      title: "🃏 Flashcards — Core Concepts",
      description: `Study ${firstHalf.length} core topic${firstHalf.length !== 1 ? "s" : ""} with interactive flashcards`,
      intention: "Flashcards help you build initial familiarity with key terms and definitions.",
      completed: false,
      locked: false,
      duration: "5 min",
    },
    {
      id: "step-flip-memory",
      type: "flip-memory",
      title: "🔄 Memory Check — Card Flip",
      description: "Flip cards and test if you remember the answers before peeking",
      intention: "Active recall strengthens memory. Try to answer before flipping — it's OK to get some wrong!",
      completed: false,
      locked: true,
      duration: "3 min",
    },
    {
      id: "step-quiz-1",
      type: "quiz",
      title: "⚡ Quick Quiz — Multiple Choice",
      description: "Test your understanding with multiple-choice questions",
      intention: "Multiple-choice tests help identify gaps in your understanding early on.",
      completed: false,
      locked: true,
      duration: "3 min",
    },
    {
      id: "step-dropdown",
      type: "dropdown-quiz",
      title: "📋 Select the Right Answer",
      description: "Choose the correct answer from dropdown menus for each question",
      intention: "Dropdown selection requires you to read all options carefully, improving comprehension.",
      completed: false,
      locked: true,
      duration: "3 min",
    },
    {
      id: "step-reading",
      type: "reading",
      title: "📚 Deep Reading — Advanced Topics",
      description: `Dive deeper into ${secondHalf.length} advanced topic${secondHalf.length !== 1 ? "s" : ""}`,
      intention: "Now that you have the basics, we explore advanced concepts and connections.",
      completed: false,
      locked: true,
      duration: "8 min",
    },
    {
      id: "step-drag-drop",
      type: "drag-drop",
      title: "🧩 Match & Connect — Drag & Drop",
      description: "Drag terms to their correct definitions to reinforce associations",
      intention: "Matching exercises build strong connections between concepts and definitions.",
      completed: false,
      locked: true,
      duration: "4 min",
    },
    {
      id: "step-summary",
      type: "summary",
      title: "📝 Section Summary & Review",
      description: "Review everything you've learned with a concise summary of key points",
      intention: "Summarizing helps consolidate knowledge and identify any remaining gaps.",
      completed: false,
      locked: true,
      duration: "3 min",
    },
    {
      id: "step-final-overview",
      type: "final-overview",
      title: "🎯 Final Review — All Key Points",
      description: "One last review of all major concepts before the final assessment",
      intention: "A final review primes your memory right before the test for best performance.",
      completed: false,
      locked: true,
      duration: "3 min",
    },
    {
      id: "step-timed-quiz",
      type: "timed-quiz",
      title: "⏱️ Final Timed Quiz — Mastery Test",
      description: "Timed assessment covering ALL topics — prove your mastery!",
      intention: "Timed conditions simulate real test pressure and reveal true understanding.",
      completed: false,
      locked: true,
      duration: "10 min",
    },
  ];
}
