import { useState } from "react";
import { ArrowRight, ChevronDown, RotateCcw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { XP_RULES, XP_RULE_LABELS, type XpBreakdown } from "@/lib/xp";
import { useAppStore } from "@/store/appStore";
import { cn } from "@/lib/utils";

interface TopicSummaryProps {
  topicTitle: string;
  /** percentage 0–100 */
  score: number;
  totalQuestions: number;
  onContinue: () => void;
  onRetry: () => void;
  isLastTopic: boolean;
  /** XP earned by this completion (from the store); falls back to a computed estimate */
  xp?: XpBreakdown | null;
  sessionCompleted?: boolean;
}

/*
  Topic complete — quiet card: score, the XP you earned line by line, the
  running total, and a fold-out that explains exactly how XP is calculated.
*/
export function TopicSummary({ topicTitle, score, totalQuestions, onContinue, onRetry, isLastTopic, xp, sessionCompleted }: TopicSummaryProps) {
  const totalXp = useAppStore((s) => s.xp);
  const [showRules, setShowRules] = useState(false);

  const correct = Math.round(((score || 0) * totalQuestions) / 100);
  const passing = totalQuestions === 0 || correct >= totalQuestions * 0.7;
  const perfect = totalQuestions > 0 && correct === totalQuestions;

  return (
    <div className="mx-auto w-full max-w-md rounded-2xl border border-border bg-card">
      <div className="px-6 pb-5 pt-6 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
          {sessionCompleted ? "Session complete" : "Topic complete"}
        </p>
        <h3 className="mt-1.5 text-lg font-semibold tracking-tight">{topicTitle}</h3>
        <p className="mt-4 text-4xl font-semibold tabular-nums tracking-tight">
          {correct}
          <span className="text-muted-foreground"> / {totalQuestions}</span>
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {perfect ? "Perfect score." : passing ? "Nice work." : "Below the 70% pass mark. Retry to lock it in, or keep going."}
        </p>
      </div>

      {/* XP earned */}
      {xp && xp.lines.length > 0 && (
        <div className="border-t border-border px-6 py-4">
          <div className="flex items-center justify-between">
            <p className="inline-flex items-center gap-1.5 text-sm font-semibold">
              <Sparkles className="size-4 text-chart-1" />
              XP earned
            </p>
            <p className="text-sm font-semibold tabular-nums text-chart-1">+{xp.total}</p>
          </div>
          <ul className="mt-2 space-y-1">
            {xp.lines.map((l) => (
              <li key={l.label} className="flex items-baseline justify-between text-xs">
                <span className="text-muted-foreground">
                  {l.label}
                  {l.detail && <span className="opacity-70"> · {l.detail}</span>}
                </span>
                <span className="tabular-nums">+{l.amount}</span>
              </li>
            ))}
          </ul>

          {/* Running total */}
          <div className="mt-4 flex items-baseline justify-between border-t border-border pt-3 text-xs">
            <span className="font-medium">Total XP</span>
            <span className="tabular-nums text-muted-foreground">{totalXp.toLocaleString()}</span>
          </div>

          <button
            type="button"
            onClick={() => setShowRules((v) => !v)}
            className="mt-3 inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-4 hover:underline"
          >
            How is XP calculated?
            <ChevronDown className={cn("size-3.5 transition-transform", showRules && "rotate-180")} />
          </button>
          {showRules && (
            <dl className="mt-2 rounded-lg bg-muted/60 p-3 text-xs">
              {XP_RULE_LABELS.map((r) => (
                <div key={r.key} className="flex items-baseline justify-between gap-3 py-0.5">
                  <dt>
                    <span className="font-medium">{r.label}</span>
                    <span className="text-muted-foreground"> · {r.hint}</span>
                  </dt>
                  <dd className="shrink-0 tabular-nums">+{XP_RULES[r.key]}</dd>
                </div>
              ))}
              <p className="mt-2 border-t border-border pt-2 text-muted-foreground">
                Reading time counts too: every full minute on a study page adds {XP_RULES.minuteStudied} XP, measured
                while you're actually reading or answering.
              </p>
            </dl>
          )}
        </div>
      )}

      <div className="flex gap-2 border-t border-border p-4">
        {!passing && (
          <Button variant="outline" className="flex-1" onClick={onRetry}>
            <RotateCcw className="size-4" />
            Retry topic
          </Button>
        )}
        <Button className="flex-1" onClick={onContinue}>
          {isLastTopic ? "Back to topics" : "Next topic"}
          <ArrowRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}
