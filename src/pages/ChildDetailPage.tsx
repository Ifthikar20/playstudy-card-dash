import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { StatRail } from "@/components/StatRail";
import { StreakCard } from "@/components/StreakCard";
import { XpCard } from "@/components/XpCard";
import { EmptyState } from "@/components/EmptyState";
import { AnswerTimeline } from "@/components/family/AnswerTimeline";
import { ChildSettingsPanel } from "@/components/family/ChildSettingsPanel";
import { useChild, useChildActivity } from "@/hooks/useChildren";

function initials(name: string) {
  return name.split(" ").filter(Boolean).map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

/**
 * One learner, through their guardian's eyes.
 *
 * Everything here renders from props fed by the parental hooks. Nothing reads
 * the app store or the ['appData'] query — those hold the *guardian's* own
 * dashboard, and writing a child's numbers into them would replace it.
 */
export default function ChildDetailPage() {
  const { childId } = useParams<{ childId: string }>();
  const { data: child, isLoading, isError } = useChild(childId);
  const { data: activity, isLoading: activityLoading } = useChildActivity(childId);

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
      </div>
    );
  }

  if (isError || !child) {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
        <EmptyState
          title="Learner not found"
          body="They may have been removed, or the link between you may have ended."
        />
        <div className="mt-4 text-center">
          <Button variant="outline" size="sm" asChild>
            <Link to="/dashboard/family">Back to Family</Link>
          </Button>
        </div>
      </div>
    );
  }

  const { stats } = child;

  const statItems = [
    { value: stats.totalSessions, label: "sessions" },
    { value: `${stats.averageAccuracy}%`, label: "accuracy" },
    { value: stats.totalStudyTime, label: "studied" },
    { value: stats.questionsAnswered.toLocaleString(), label: "answered" },
  ];

  return (
    <div className="fade-in mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
      <Link
        to="/dashboard/family"
        className="mb-6 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        Family
      </Link>

      <header className="mb-8 flex items-center gap-4">
        <Avatar className="size-12">
          <AvatarFallback className="text-base font-semibold">{initials(child.name)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <h1 className="truncate font-display text-2xl font-semibold tracking-tight">{child.name}</h1>
          <p className="text-xs text-muted-foreground">
            {child.guardianship.origin === "created"
              ? `Signs in as ${child.username}`
              : "Has their own account — you can see their progress"}
          </p>
        </div>
      </header>

      <Tabs defaultValue="progress">
        <TabsList>
          <TabsTrigger value="progress">Progress</TabsTrigger>
          <TabsTrigger value="answers">Answers &amp; notes</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="progress" className="mt-6">
          <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
            <div className="space-y-4">
              <StreakCard data={activity ?? null} loading={activityLoading} />

              <section className="rounded-2xl border border-border bg-card p-5">
                <h2 className="text-sm font-semibold">Recent study</h2>
                {child.recentSessions.length === 0 ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Nothing studied yet. Sessions show up here as soon as they start one.
                  </p>
                ) : (
                  <ul className="mt-3 space-y-2.5">
                    {child.recentSessions.map((s) => (
                      <li key={s.id} className="flex items-center gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{s.title}</p>
                          <p className="truncate text-xs text-muted-foreground">{s.topic}</p>
                        </div>
                        <div className="w-24 shrink-0">
                          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                            <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, s.progress)}%` }} />
                          </div>
                        </div>
                        <span className="w-9 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                          {Math.round(s.progress)}%
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>

            <aside className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
              <StatRail items={statItems} />
              {/* The same total the learner sees, split the same way. */}
              <XpCard xp={stats.xp} studySeconds={stats.activeSeconds} />
            </aside>
          </div>
        </TabsContent>

        <TabsContent value="answers" className="mt-6">
          <AnswerTimeline childId={child.id} />
        </TabsContent>

        <TabsContent value="settings" className="mt-6">
          <ChildSettingsPanel child={child} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
