import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Award, Bell, BookOpen, Clock, ListChecks, LogOut, Mic, Settings, Shield, Sparkles, Target, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/store/appStore";
import { usePresenceStore, formatDuration } from "@/store/presenceStore";
import { logout } from "@/services/api";
import { MyGuardiansCard } from "@/components/family/MyGuardiansCard";
import { VoiceKeyPicker, VoiceKeyTester } from "@/components/VoiceKeyPicker";
import { TutorLookPicker } from "@/components/TutorLookPicker";
import { setAvatar, useAvatar } from "@/lib/guide/avatars";
import { useVoiceKey, writeVoiceKey, type VoiceKey } from "@/lib/voiceKey";
import { isNote } from "@/lib/notes/isNote";
import { authService } from "@/services/authService";
import { formatStudyTime } from "@/lib/xp";
import { cn } from "@/lib/utils";

/** A toggle that remembers itself in localStorage, so settings actually persist. */
function usePref(key: string, initial: boolean) {
  const [value, setValue] = useState(() => {
    try {
      const raw = localStorage.getItem(`an-pref:${key}`);
      return raw == null ? initial : raw === "1";
    } catch {
      return initial;
    }
  });
  const set = (next: boolean) => {
    setValue(next);
    try {
      localStorage.setItem(`an-pref:${key}`, next ? "1" : "0");
    } catch {
      /* private mode */
    }
  };
  return [value, set] as const;
}

function initialsOf(name?: string | null) {
  if (!name) return "PS";
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("") || "PS";
}

function SettingRow({ id, title, desc, initial }: { id: string; title: string; desc: string; initial: boolean }) {
  const [on, set] = usePref(id, initial);
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="space-y-0.5">
        <Label htmlFor={id} className="text-sm font-normal">{title}</Label>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
      <Switch id={id} checked={on} onCheckedChange={set} />
    </div>
  );
}

export default function ProfilePage() {
  // The talk key lives on the account, so a change here is saved for every device.
  const voiceKey = useVoiceKey();
  const saveVoiceKey = (key: VoiceKey) => writeVoiceKey(key, (value) => authService.setVoiceKey(value));

  const userProfile = useAppStore((s) => s.userProfile);
  const xp = useAppStore((s) => s.xp);
  const stats = useAppStore((s) => s.stats);
  const allSessions = useAppStore((s) => s.studySessions);
  // Their own notes aren't study sessions, so they don't count or show as recent activity.
  const studySessions = useMemo(() => allSessions.filter((s) => !isNote(s)), [allSessions]);
  const studiedSeconds = usePresenceStore((s) => s.activeSeconds);

  const name = userProfile?.name ?? "Student";
  const email = userProfile?.email ?? "";

  const sessionCount = studySessions.length;
  const recent = [...studySessions].sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0)).slice(0, 6);

  const statCards = [
    { icon: BookOpen, label: "Study sessions", value: String(sessionCount) },
    { icon: ListChecks, label: "Questions answered", value: String(stats.questionsAnswered ?? 0) },
    { icon: Target, label: "Accuracy", value: `${Math.round(stats.averageAccuracy ?? 0)}%` },
    { icon: Clock, label: "Studied today", value: formatDuration(studiedSeconds) },
  ];

  return (
    <div className="flex min-h-0 flex-1">
      <main className="flex-1 p-4 md:p-8">
        <div className="mx-auto max-w-4xl space-y-6">
          <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">Profile</h1>

          {/* Profile header — real user */}
          <Card>
            <CardContent className="p-6">
              <div className="flex flex-col items-center gap-6 md:flex-row md:items-center">
                <span className="flex size-20 shrink-0 items-center justify-center rounded-full bg-chart-1/15 text-2xl font-semibold text-chart-1">
                  {initialsOf(name)}
                </span>
                <div className="min-w-0 flex-1 text-center md:text-left">
                  <h2 className="truncate text-xl font-semibold text-foreground">{name}</h2>
                  {email && <p className="mt-0.5 truncate text-sm text-muted-foreground">{email}</p>}
                  <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-foreground">
                    <TrendingUp className="size-3.5 text-chart-1" />
                    {xp.toLocaleString()} XP · {formatStudyTime(userProfile?.studySeconds ?? 0)} read
                  </p>
                </div>
                <Button variant="outline" size="sm" className="shrink-0 gap-2 text-muted-foreground" onClick={() => logout()}>
                  <LogOut className="size-4" />
                  Log out
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Who can see this learner, and exactly what they see. Read-only:
              a guardianship is not something the learner can end, so the
              compensating control is that they can always see it in full. */}
          <MyGuardiansCard />

          {/* Stats — measured, not seeded */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {statCards.map((s) => (
              <Card key={s.label}>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <s.icon size={16} />
                    {s.label}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold tabular-nums text-foreground">{s.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Settings — persisted */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Settings size={20} />
                Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Mic size={18} className="text-muted-foreground" />
                  <h3 className="font-medium text-foreground">Talking to your tutor</h3>
                </div>
                <div className="ml-7 space-y-3">
                  <p className="text-xs text-muted-foreground">
                    Press this key during a lesson and your tutor stops to listen. Press it again to send your question.
                  </p>
                  <VoiceKeyPicker value={voiceKey} onChange={saveVoiceKey} />
                  <VoiceKeyTester value={voiceKey} />
                </div>
              </div>

              <Separator />

              <TutorLooks />

              <Separator />

              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Bell size={18} className="text-muted-foreground" />
                  <h3 className="font-medium text-foreground">Notifications</h3>
                </div>
                <div className="ml-7 space-y-3">
                  <SettingRow id="email-notifications" title="Email notifications" desc="Study reminders and product updates" initial={false} />
                  <SettingRow id="streak-reminders" title="Streak reminders" desc="A nudge when your daily streak is about to lapse" initial={true} />
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Shield size={18} className="text-muted-foreground" />
                  <h3 className="font-medium text-foreground">Privacy</h3>
                </div>
                <div className="ml-7 space-y-3">
                  <SettingRow id="public-profile" title="Public profile" desc="Make your profile visible to other users" initial={false} />
                  <SettingRow id="show-activity" title="Show activity" desc="Display your study activity on your profile" initial={true} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recent activity — real sessions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Recent activity</CardTitle>
            </CardHeader>
            <CardContent>
              {recent.length === 0 ? (
                <div className="py-10 text-center">
                  <Award className="mx-auto size-6 text-muted-foreground/40" />
                  <p className="mt-3 text-sm text-muted-foreground">No sessions yet — start one and your progress shows up here.</p>
                </div>
              ) : (
                <ul className="divide-y divide-border">
                  {recent.map((s) => (
                    <li key={s.id}>
                      <Link to={`/dashboard/${s.id}/full-study`} className="flex items-center gap-4 py-3 hover:opacity-80">
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{s.title}</span>
                          <span className="block text-xs text-muted-foreground">
                            {s.topics} topic{s.topics === 1 ? "" : "s"}
                            {s.time ? ` · ${s.time}` : ""}
                          </span>
                        </span>
                        <span className="w-24 shrink-0">
                          <span className="mb-1 block text-right text-xs font-semibold tabular-nums">{Math.round(s.progress ?? 0)}%</span>
                          <span className="block h-1 overflow-hidden rounded-full bg-muted">
                            <span
                              className={cn("block h-full rounded-full", (s.progress ?? 0) >= 100 ? "bg-success" : "bg-chart-1")}
                              style={{ width: `${Math.max(3, s.progress ?? 0)}%` }}
                            />
                          </span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}

/** How the Teach mode tutors look: the avatar on each voice's pointer, saved on the account. */
function TutorLooks() {
  const male = useAvatar("male").id;
  const female = useAvatar("female").id;
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Sparkles size={18} className="text-muted-foreground" />
        <h3 className="font-medium text-foreground">How your tutors look</h3>
      </div>
      <div className="ml-7 space-y-3">
        <p className="text-xs text-muted-foreground">
          The face that rides on each voice's pointer during a lesson. The pointer takes its colour.
        </p>
        <TutorLookPicker value={{ male, female }} onChange={(kind, id) => setAvatar(kind, id)} />
      </div>
    </div>
  );
}

