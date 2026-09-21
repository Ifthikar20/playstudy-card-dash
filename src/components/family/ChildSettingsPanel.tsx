import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { KeyRound, Trash2, Unlink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ResetPinDialog } from "./ResetPinDialog";
import { RemoveChildDialog } from "./RemoveChildDialog";
import { parentalKeys, updateChildSettings, type ChildDetail } from "@/services/parental";

export function ChildSettingsPanel({ child }: { child: ChildDetail }) {
  const [dailyLimit, setDailyLimit] = useState("");
  const [gradeLevel, setGradeLevel] = useState("");
  const [weeklyGoal, setWeeklyGoal] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // A profile this account created is one it owns outright. A claimed account
  // belongs to the learner — they keep their password, so there is no PIN to
  // reset and no profile to delete, only a link to give up.
  const owned = child.guardianship.origin === "created";
  const canChangeSettings = child.guardianship.scopes.includes("settings");

  useEffect(() => {
    const s = child.learningSettings ?? {};
    setDailyLimit(s.dailyLimitMinutes != null ? String(s.dailyLimitMinutes) : "");
    setGradeLevel(s.gradeLevel ?? "");
    setWeeklyGoal(s.weeklyGoalMinutes != null ? String(s.weeklyGoalMinutes) : "");
  }, [child]);

  async function save() {
    setIsSaving(true);
    try {
      await updateChildSettings(child.id, {
        dailyLimitMinutes: dailyLimit.trim() ? Number(dailyLimit) : null,
        gradeLevel: gradeLevel.trim() || null,
        weeklyGoalMinutes: weeklyGoal.trim() ? Number(weeklyGoal) : null,
      });
      await queryClient.invalidateQueries({ queryKey: parentalKeys.child(child.id) });
      toast({ title: "Saved", description: `Updated ${child.name}'s settings.` });
    } catch (error) {
      toast({
        title: "Couldn't save",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {canChangeSettings ? (
        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold">How they study</h2>
          <p className="mt-1 text-xs text-muted-foreground">Leave anything blank to keep it unlimited.</p>

          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="daily-limit">Daily limit (minutes)</Label>
              <Input
                id="daily-limit"
                inputMode="numeric"
                placeholder="No limit"
                value={dailyLimit}
                onChange={(e) => setDailyLimit(e.target.value.replace(/\D/g, ""))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="grade-level">Grade or year</Label>
              <Input
                id="grade-level"
                placeholder="e.g. Year 6"
                value={gradeLevel}
                onChange={(e) => setGradeLevel(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="weekly-goal">Weekly goal (minutes)</Label>
              <Input
                id="weekly-goal"
                inputMode="numeric"
                placeholder="No goal"
                value={weeklyGoal}
                onChange={(e) => setWeeklyGoal(e.target.value.replace(/\D/g, ""))}
              />
            </div>
          </div>

          <Button className="mt-4" size="sm" onClick={save} disabled={isSaving}>
            {isSaving ? "Saving…" : "Save settings"}
          </Button>
        </section>
      ) : (
        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold">How they study</h2>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {child.name} manages their own settings. You can see their progress, but not change how they study.
          </p>
        </section>
      )}

      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="text-sm font-semibold">Signing in</h2>
        {owned ? (
          <>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {child.name} signs in at <span className="font-medium text-foreground">{window.location.host}/kids</span> as{" "}
              <span className="font-mono font-medium text-foreground">{child.username}</span>. There's no email on this
              profile, so you're the only way back in if they forget the PIN.
            </p>
            <Button variant="outline" size="sm" className="mt-4" onClick={() => setResetOpen(true)}>
              <KeyRound className="size-4" />
              Set a new PIN
            </Button>
          </>
        ) : (
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {child.name} has their own account and their own password. You can't change how they sign in.
          </p>
        )}
      </section>

      <section className="rounded-2xl border border-destructive/30 bg-card p-5">
        <h2 className="text-sm font-semibold">{owned ? "Delete this profile" : "Stop following"}</h2>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          {owned
            ? `Removes ${child.name}'s profile and everything they've studied. This can't be undone.`
            : `You'll stop seeing ${child.name}'s progress. Their account is unaffected, and they'd need to give you a new code to reconnect.`}
        </p>
        <Button variant="outline" size="sm" className="mt-4 text-destructive hover:text-destructive" onClick={() => setRemoveOpen(true)}>
          {owned ? <Trash2 className="size-4" /> : <Unlink className="size-4" />}
          {owned ? "Delete profile" : "Stop following"}
        </Button>
      </section>

      <ResetPinDialog child={child} open={resetOpen} onOpenChange={setResetOpen} />
      <RemoveChildDialog child={child} open={removeOpen} onOpenChange={setRemoveOpen} />
    </div>
  );
}
