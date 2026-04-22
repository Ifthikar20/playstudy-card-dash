import { useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RotateCcw, Check, X, GripVertical, ChevronDown } from "lucide-react";

/* ═══════════════════════════════════════════
   1. FLIP CARD — Memory check before quiz
   ═══════════════════════════════════════════ */

interface FlipCardProps {
  front: string;
  back: string;
  onResult: (remembered: boolean) => void;
  index: number;
  total: number;
}

export function FlipCard({ front, back, onResult, index, total }: FlipCardProps) {
  const [flipped, setFlipped] = useState(false);
  const [answered, setAnswered] = useState(false);

  return (
    <div className="w-full max-w-lg mx-auto">
      <p className="text-xs text-muted-foreground text-center mb-3">
        Card {index + 1} of {total} — Tap to flip
      </p>

      <div
        className="relative w-full cursor-pointer"
        style={{ perspective: "1000px", minHeight: "200px" }}
        onClick={() => !answered && setFlipped(!flipped)}
      >
        <div
          className="relative w-full transition-transform duration-500"
          style={{
            transformStyle: "preserve-3d",
            transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
            minHeight: "200px",
          }}
        >
          {/* Front */}
          <div
            className="absolute inset-0 rounded-xl border-2 border-primary/20 bg-gradient-to-br from-card to-muted/30 p-6 flex flex-col items-center justify-center text-center"
            style={{ backfaceVisibility: "hidden" }}
          >
            <p className="text-xs uppercase tracking-wider text-primary font-semibold mb-3">Question</p>
            <p className="text-lg font-medium text-foreground leading-relaxed">{front}</p>
            <p className="text-xs text-muted-foreground mt-4">Tap to reveal answer →</p>
          </div>

          {/* Back */}
          <div
            className="absolute inset-0 rounded-xl border-2 border-emerald-500/30 bg-gradient-to-br from-emerald-50 to-card dark:from-emerald-950/30 dark:to-card p-6 flex flex-col items-center justify-center text-center"
            style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
          >
            <p className="text-xs uppercase tracking-wider text-emerald-600 font-semibold mb-3">Answer</p>
            <p className="text-lg font-medium text-foreground leading-relaxed">{back}</p>
          </div>
        </div>
      </div>

      {flipped && !answered && (
        <div className="flex gap-3 justify-center mt-4 animate-fade-in-up">
          <Button
            variant="outline"
            size="sm"
            className="gap-2 border-red-300 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
            onClick={() => { setAnswered(true); onResult(false); }}
          >
            <X size={14} /> Didn't know
          </Button>
          <Button
            size="sm"
            className="gap-2 bg-emerald-500 hover:bg-emerald-600 text-white"
            onClick={() => { setAnswered(true); onResult(true); }}
          >
            <Check size={14} /> Got it!
          </Button>
        </div>
      )}

      {answered && (
        <p className="text-center text-sm text-muted-foreground mt-3">
          <RotateCcw size={12} className="inline mr-1" /> Moving to next card...
        </p>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════
   2. DROPDOWN SELECT — Pick the right answer
   ═══════════════════════════════════════════ */

interface DropdownQuestionProps {
  question: string;
  options: string[];
  correctIndex: number;
  onAnswer: (correct: boolean) => void;
  explanation?: string;
}

export function DropdownQuestion({ question, options, correctIndex, onAnswer, explanation }: DropdownQuestionProps) {
  const [selected, setSelected] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const isCorrect = selected === correctIndex;

  const handleSubmit = () => {
    if (selected === null) return;
    setSubmitted(true);
    onAnswer(selected === correctIndex);
  };

  return (
    <Card className="border border-border">
      <CardContent className="p-5 space-y-4">
        <p className="font-medium text-foreground">{question}</p>

        <div className="relative">
          <select
            className="w-full appearance-none bg-card border border-border rounded-lg px-4 py-3 pr-10 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
            value={selected ?? ""}
            onChange={(e) => !submitted && setSelected(Number(e.target.value))}
            disabled={submitted}
          >
            <option value="" disabled>Select your answer...</option>
            {options.map((opt, i) => (
              <option key={i} value={i}>{opt}</option>
            ))}
          </select>
          <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        </div>

        {!submitted && selected !== null && (
          <Button size="sm" onClick={handleSubmit} className="w-full">
            Submit Answer
          </Button>
        )}

        {submitted && (
          <div className={`rounded-lg p-3 text-sm ${isCorrect
            ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800"
            : "bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800"
          }`}>
            <p className="font-semibold">{isCorrect ? "✓ Correct!" : "✗ Incorrect"}</p>
            {!isCorrect && <p className="mt-1">The answer is: <strong>{options[correctIndex]}</strong></p>}
            {explanation && <p className="mt-1 text-xs opacity-80">{explanation}</p>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ═══════════════════════════════════════════
   3. DRAG & DROP — Match answers to questions
   ═══════════════════════════════════════════ */

interface DragDropPair {
  id: string;
  term: string;
  definition: string;
}

interface DragDropMatchProps {
  pairs: DragDropPair[];
  onComplete: (score: number) => void;
}

export function DragDropMatch({ pairs, onComplete }: DragDropMatchProps) {
  const [availableAnswers, setAvailableAnswers] = useState(() =>
    [...pairs].sort(() => Math.random() - 0.5).map(p => p.definition)
  );
  const [matches, setMatches] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [draggedItem, setDraggedItem] = useState<string | null>(null);
  const [dragOverSlot, setDragOverSlot] = useState<string | null>(null);

  const handleDragStart = (answer: string) => {
    setDraggedItem(answer);
  };

  const handleDrop = (termId: string) => {
    if (!draggedItem) return;

    // Remove from previous slot if exists
    const newMatches = { ...matches };
    const prevSlot = Object.entries(newMatches).find(([, v]) => v === draggedItem)?.[0];
    if (prevSlot) delete newMatches[prevSlot];

    // Remove previous answer from this slot
    const prevAnswer = newMatches[termId];

    newMatches[termId] = draggedItem;
    setMatches(newMatches);

    // Update available answers
    let newAvailable = availableAnswers.filter(a => a !== draggedItem);
    if (prevAnswer) newAvailable.push(prevAnswer);
    setAvailableAnswers(newAvailable);

    setDraggedItem(null);
    setDragOverSlot(null);
  };

  const handleSubmit = () => {
    setSubmitted(true);
    let correct = 0;
    pairs.forEach(p => {
      if (matches[p.id] === p.definition) correct++;
    });
    onComplete(correct);
  };

  const allPlaced = Object.keys(matches).length === pairs.length;

  return (
    <div className="space-y-4">
      {/* Available answers to drag */}
      {!submitted && availableAnswers.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Drag answers below:</p>
          <div className="flex flex-wrap gap-2">
            {availableAnswers.map((answer, i) => (
              <div
                key={`${answer}-${i}`}
                draggable
                onDragStart={() => handleDragStart(answer)}
                className="flex items-center gap-1.5 px-3 py-2 bg-primary/10 border border-primary/20 rounded-lg text-sm cursor-grab active:cursor-grabbing hover:bg-primary/15 transition-colors"
              >
                <GripVertical size={12} className="text-primary/50" />
                <span>{answer}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Terms with drop slots */}
      <div className="space-y-2">
        {pairs.map((pair) => {
          const matched = matches[pair.id];
          const isCorrect = submitted && matched === pair.definition;
          const isWrong = submitted && matched && matched !== pair.definition;

          return (
            <div
              key={pair.id}
              className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                dragOverSlot === pair.id ? "border-primary bg-primary/5" :
                isCorrect ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-950/20" :
                isWrong ? "border-red-400 bg-red-50 dark:bg-red-950/20" :
                "border-border"
              }`}
              onDragOver={(e) => { e.preventDefault(); setDragOverSlot(pair.id); }}
              onDragLeave={() => setDragOverSlot(null)}
              onDrop={(e) => { e.preventDefault(); handleDrop(pair.id); }}
            >
              <span className="font-medium text-sm flex-1">{pair.term}</span>
              <span className="text-muted-foreground mx-2">→</span>
              <div className={`flex-1 min-h-[36px] rounded-md border border-dashed flex items-center px-3 text-sm ${
                matched ? "border-solid bg-card" : "border-border text-muted-foreground"
              }`}>
                {matched || "Drop answer here"}
              </div>
              {submitted && (
                <span>{isCorrect ? "✓" : "✗"}</span>
              )}
            </div>
          );
        })}
      </div>

      {!submitted && allPlaced && (
        <Button onClick={handleSubmit} className="w-full">Check Answers</Button>
      )}

      {submitted && (
        <div className="text-center text-sm text-muted-foreground">
          {pairs.filter(p => matches[p.id] === p.definition).length} of {pairs.length} correct
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════
   4. SECTION INTRO — Explains what's coming
   ═══════════════════════════════════════════ */

interface SectionIntroProps {
  title: string;
  description: string;
  objectives: string[];
  icon: React.ReactNode;
  onStart: () => void;
}

export function SectionIntro({ title, description, objectives, icon, onStart }: SectionIntroProps) {
  return (
    <div className="max-w-lg mx-auto text-center py-6 space-y-5 animate-fade-in-up">
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center mx-auto border border-primary/10">
        {icon}
      </div>

      <div>
        <h3 className="text-xl font-bold text-foreground font-heading">{title}</h3>
        <p className="text-sm text-muted-foreground mt-2 leading-relaxed max-w-md mx-auto">{description}</p>
      </div>

      {objectives.length > 0 && (
        <div className="bg-muted/50 rounded-xl p-4 text-left space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">What you'll learn</p>
          {objectives.map((obj, i) => (
            <div key={i} className="flex items-start gap-2 text-sm">
              <span className="text-primary mt-0.5 font-bold">•</span>
              <span className="text-foreground">{obj}</span>
            </div>
          ))}
        </div>
      )}

      <Button onClick={onStart} size="lg" className="gap-2 rounded-xl px-8">
        Let's Begin →
      </Button>
    </div>
  );
}

/* ═══════════════════════════════════════════
   5. CONTENT SUMMARY — Post-section review
   ═══════════════════════════════════════════ */

interface ContentSummaryProps {
  title: string;
  keyPoints: string[];
  score?: { correct: number; total: number };
  onContinue: () => void;
}

export function ContentSummary({ title, keyPoints, score, onContinue }: ContentSummaryProps) {
  return (
    <div className="max-w-lg mx-auto py-6 space-y-5 animate-fade-in-up">
      <div className="text-center">
        <p className="text-3xl mb-2">📝</p>
        <h3 className="text-lg font-bold text-foreground">{title} — Summary</h3>
        {score && (
          <p className="text-sm text-muted-foreground mt-1">
            You scored <span className="font-bold text-primary">{score.correct}/{score.total}</span>
          </p>
        )}
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Key takeaways</p>
        {keyPoints.map((point, i) => (
          <div key={i} className="flex items-start gap-3 p-3 bg-card rounded-lg border border-border">
            <span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
              {i + 1}
            </span>
            <p className="text-sm text-foreground leading-relaxed">{point}</p>
          </div>
        ))}
      </div>

      <Button onClick={onContinue} className="w-full rounded-xl gap-2">
        Continue to Next Section →
      </Button>
    </div>
  );
}
