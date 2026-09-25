import { useEffect, useState } from "react";
import { CalendarDays, Loader2, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/appStore";
import { deleteExamPlan, saveExamPlan } from "@/services/examPlans";
import { daysBetween, todayIso, type ExamPlan } from "@/lib/examPlan";

/*
  "Is this for an exam?"

  Two answers are all the plan needs: the day of the exam, and how many times a
  day this student sits down to study. The server splits the sections across the
  days that are left and keeps the last ones for revision.
*/

const SITTINGS = [
  { value: 1, label: "Once", hint: "one sitting a day" },
  { value: 2, label: "Twice", hint: "morning and evening" },
  { value: 3, label: "Three times", hint: "short, often" },
  { value: 4, label: "Four times", hint: "cramming" },
];

export function ExamPlanDialog({
  open,
  onOpenChange,
  sessionId,
  sessionTitle,
  existing,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: string;
  sessionTitle?: string;
  existing?: ExamPlan | null;
  onSaved?: (plan: ExamPlan | null) => void;
}) {
  const { toast } = useToast();
  const setExamPlan = useAppStore((s) => s.setExamPlan);
  const clearExamPlan = useAppStore((s) => s.clearExamPlan);

  const [date, setDate] = useState("");
  const [sittings, setSittings] = useState(1);
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);

  // Re-read the current plan each time it opens, so editing shows what they chose.
  useEffect(() => {
    if (!open) return;
    setDate(existing?.examDate ?? "");
    setSittings(existing?.sittingsPerDay ?? 1);
    setLabel(existing?.label ?? "");
  }, [open, existing]);

  const today = todayIso();
  const ahead = date ? daysBetween(today, date) : null;
  const valid = !!date && ahead !== null && ahead >= 0;

  const save = async () => {
    if (!valid || saving) return;
    setSaving(true);
    try {
      const plan = await saveExamPlan(sessionId, { examDate: date, sittingsPerDay: sittings, label: label.trim() || null });
      setExamPlan(plan);
      onSaved?.(plan);
      toast({
        title: existing ? "Plan updated" : "Your plan is ready",
        description:
          ahead === 0
            ? "Your exam is today — go over everything once more."
            : `${plan.days.length - 1} days to the exam. Today's sections are on the study page.`,
      });
      onOpenChange(false);
    } catch (e) {
      toast({
        title: "Couldn't save your plan",
        description: e instanceof Error ? e.message : "Try again in a moment.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    setSaving(true);
    try {
      await deleteExamPlan(sessionId);
      clearExamPlan(sessionId);
      onSaved?.(null);
      toast({ title: "Plan removed", description: "Study it in any order you like." });
      onOpenChange(false);
    } catch (e) {
      toast({ title: "Couldn't remove the plan", description: e instanceof Error ? e.message : "Try again.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarDays className="size-5 text-primary" />
            {existing ? "Your exam plan" : "Studying for an exam?"}
          </DialogTitle>
          <DialogDescription>
            {sessionTitle ? `“${sessionTitle}” ` : "This material "}
            gets split across the days you have left, with the last days kept for revision.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-1">
          <div className="space-y-2">
            <Label htmlFor="exam-date">When is the exam?</Label>
            <Input id="exam-date" type="date" min={today} value={date} onChange={(e) => setDate(e.target.value)} />
            {ahead !== null && ahead >= 0 && (
              <p className="text-xs text-muted-foreground">
                {ahead === 0 ? "That's today." : ahead === 1 ? "That's tomorrow — one day to get through it." : `${ahead} days to go.`}
              </p>
            )}
            {ahead !== null && ahead < 0 && <p className="text-xs text-destructive">That day has already passed.</p>}
          </div>

          <div className="space-y-2">
            <Label>How many times a day do you sit down to study?</Label>
            <div className="grid grid-cols-2 gap-2">
              {SITTINGS.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setSittings(s.value)}
                  className={cn(
                    "rounded-xl border px-3 py-2 text-left transition-colors",
                    sittings === s.value ? "border-primary bg-primary/10" : "border-border hover:border-foreground/30",
                  )}
                >
                  <span className="block text-sm font-medium">{s.label}</span>
                  <span className="block text-xs text-muted-foreground">{s.hint}</span>
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Each sitting gets its own job — learn it, take its quiz, then its flashcards. Each one opens straight from today's plan.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="exam-label">What's the exam called? (optional)</Label>
            <Input
              id="exam-label"
              value={label}
              maxLength={120}
              placeholder="Biology paper 2"
              onChange={(e) => setLabel(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          {existing ? (
            <Button type="button" variant="ghost" onClick={remove} disabled={saving} className="text-destructive hover:text-destructive">
              <Trash2 className="mr-1.5 size-4" />
              Remove plan
            </Button>
          ) : (
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
              Not for an exam
            </Button>
          )}
          <Button type="button" onClick={save} disabled={!valid || saving}>
            {saving && <Loader2 className="mr-1.5 size-4 animate-spin" />}
            {existing ? "Update plan" : "Make my plan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
