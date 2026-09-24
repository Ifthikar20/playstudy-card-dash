import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  addDays,
  addMonths,
  addWeeks,
  differenceInMinutes,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { CalendarDays, ChevronLeft, ChevronRight, GraduationCap, Plus, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar as MiniCalendar } from "@/components/ui/calendar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/EmptyState";
import { useAppStore } from "@/store/appStore";
import { KIND_LABELS, useCalendarStore, type CalendarEvent, type EventKind } from "@/store/calendarStore";
import { useToast } from "@/hooks/use-toast";
import { planCalendarEvents } from "@/lib/examPlan";
import { isNote } from "@/lib/notes/isNote";
import { cn } from "@/lib/utils";

/*
  Calendar — exams, deadlines, classes and study blocks in one place.
  Left rail: mini month, import (.ics) card, upcoming list.
  Main: Today / prev / next, range title, Day · Week · Month, "+ Add".
  Empty state names the producing action ("Add an exam"). Events are
  local-first (see calendarStore) and can be added manually or imported.
*/

type View = "day" | "week" | "month";

const HOUR_PX = 44; // height of one hour row in the time grid
const DAY_START_SCROLL = 7; // scroll the grid so 7am is at the top

const KIND_STYLE: Record<EventKind, string> = {
  exam: "border-chart-1 bg-chart-1/10 text-foreground",
  deadline: "border-warning bg-warning/10 text-foreground",
  class: "border-foreground/50 bg-muted text-foreground",
  study: "border-success bg-success/10 text-foreground",
  other: "border-muted-foreground/50 bg-muted text-foreground",
};

const KIND_DOT: Record<EventKind, string> = {
  exam: "bg-chart-1",
  deadline: "bg-warning",
  class: "bg-foreground/60",
  study: "bg-success",
  other: "bg-muted-foreground",
};

interface Draft {
  id?: string;
  title: string;
  kind: EventKind;
  date: string; // yyyy-MM-dd
  allDay: boolean;
  startTime: string; // HH:mm
  endTime: string;
  sessionId: string;
  notes: string;
}

function emptyDraft(date: Date, kind: EventKind = "exam"): Draft {
  return {
    title: "",
    kind,
    date: format(date, "yyyy-MM-dd"),
    allDay: false,
    startTime: "09:00",
    endTime: "10:00",
    sessionId: "",
    notes: "",
  };
}

function draftFromEvent(e: CalendarEvent): Draft {
  const s = parseISO(e.start);
  const en = e.end ? parseISO(e.end) : addMinutesSafe(s, 60);
  return {
    id: e.id,
    title: e.title,
    kind: e.kind,
    date: format(s, "yyyy-MM-dd"),
    allDay: e.allDay,
    startTime: format(s, "HH:mm"),
    endTime: format(en, "HH:mm"),
    sessionId: e.sessionId ?? "",
    notes: e.notes ?? "",
  };
}

function addMinutesSafe(d: Date, m: number) {
  return new Date(d.getTime() + m * 60_000);
}

function rangeTitle(view: View, date: Date) {
  if (view === "day") return format(date, "EEEE, MMM d, yyyy");
  if (view === "month") return format(date, "MMMM yyyy");
  const s = startOfWeek(date);
  const e = endOfWeek(date);
  return isSameMonth(s, e)
    ? `${format(s, "MMM d")} – ${format(e, "d, yyyy")}`
    : `${format(s, "MMM d")} – ${format(e, "MMM d, yyyy")}`;
}

export default function CalendarPage() {
  const { toast } = useToast();
  const { userProfile, studySessions: allSessions, examPlans } = useAppStore();
  // An exam or class links to study material, not to one of the student's own notes.
  const studySessions = useMemo(() => allSessions.filter((s) => !isNote(s)), [allSessions]);
  const navigate = useNavigate();
  const { events, load, add, update, remove, importIcs } = useCalendarStore();

  const [view, setView] = useState<View>("week");
  const [focus, setFocus] = useState<Date>(() => new Date());
  const [draft, setDraft] = useState<Draft | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (userProfile?.id) load(userProfile.id);
  }, [userProfile?.id, load]);

  // Exam study plans put their own days on the calendar. They are generated from
  // the plan rather than kept in the calendar store, so they follow it whenever it
  // changes — and they can't be edited or deleted here (see openEdit).
  const planEvents = useMemo(() => planCalendarEvents(Object.values(examPlans)), [examPlans]);

  const parsed = useMemo(
    () =>
      [...events, ...planEvents]
        .map((e) => ({ ...e, startDate: parseISO(e.start), endDate: e.end ? parseISO(e.end) : undefined }))
        .sort((a, b) => a.startDate.getTime() - b.startDate.getTime()),
    [events, planEvents],
  );
  const eventsOn = (day: Date) => parsed.filter((e) => isSameDay(e.startDate, day));
  const upcoming = parsed.filter((e) => e.startDate >= startOfDay(new Date())).slice(0, 5);

  const step = (dir: 1 | -1) =>
    setFocus((d) => (view === "day" ? addDays(d, dir) : view === "week" ? addWeeks(d, dir) : addMonths(d, dir)));

  const openNew = (date = focus, kind: EventKind = "exam") => setDraft(emptyDraft(date, kind));
  const openEdit = (e: CalendarEvent) => {
    // A plan day belongs to its study session — that's where it can be changed.
    if (e.source === "plan") {
      if (e.sessionId) navigate(`/dashboard/${e.sessionId}/full-study`);
      return;
    }
    setDraft(draftFromEvent(e));
  };

  const saveDraft = () => {
    if (!draft || !draft.title.trim()) return;
    const start = draft.allDay ? new Date(`${draft.date}T00:00`) : new Date(`${draft.date}T${draft.startTime}`);
    const end = draft.allDay ? undefined : new Date(`${draft.date}T${draft.endTime}`);
    const payload = {
      title: draft.title.trim(),
      kind: draft.kind,
      start: start.toISOString(),
      end: end && end > start ? end.toISOString() : undefined,
      allDay: draft.allDay,
      sessionId: draft.sessionId || undefined,
      notes: draft.notes.trim() || undefined,
    };
    if (draft.id) {
      update(draft.id, payload);
      toast({ title: "Event updated" });
    } else {
      add(payload);
      toast({ title: `${KIND_LABELS[draft.kind]} added`, description: format(start, "EEE, MMM d") });
    }
    setFocus(start);
    setDraft(null);
  };

  const deleteDraft = () => {
    if (draft?.id) {
      remove(draft.id);
      toast({ title: "Event removed" });
    }
    setDraft(null);
  };

  const onImportFile = async (file: File | undefined) => {
    if (!file) return;
    const text = await file.text();
    const { added, skipped, warnings } = importIcs(text);
    toast({
      title: added ? `Imported ${added} event${added === 1 ? "" : "s"}` : "Nothing new to import",
      description: [skipped ? `${skipped} already on your calendar` : null, warnings[0]].filter(Boolean).join(" · ") || undefined,
    });
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div className="fade-in flex flex-1 flex-col gap-4 lg:flex-row">
      {/* Left rail */}
      <aside className="flex w-full shrink-0 flex-col gap-4 lg:w-64">
        <Card className="rounded-2xl shadow-none">
          <MiniCalendar
            mode="single"
            selected={focus}
            onSelect={(d) => d && setFocus(d)}
            month={startOfMonth(focus)}
            onMonthChange={(m) => setFocus((f) => (isSameMonth(m, f) ? f : startOfMonth(m)))}
            modifiers={{ hasEvent: parsed.map((e) => e.startDate) }}
            modifiersClassNames={{ hasEvent: "font-semibold underline decoration-chart-1 decoration-2 underline-offset-4" }}
            className="p-3"
          />
        </Card>

        <Card className="rounded-2xl shadow-none">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm font-semibold">Import your calendar</CardTitle>
            <CardDescription className="text-xs leading-relaxed">
              Export an .ics file from Google Calendar, Outlook or your school portal and your exams, classes and
              deadlines appear here.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 p-4 pt-2">
            <input
              ref={fileRef}
              type="file"
              accept=".ics,text/calendar"
              className="hidden"
              onChange={(e) => onImportFile(e.target.files?.[0])}
            />
            <Button variant="outline" size="sm" className="justify-start" onClick={() => fileRef.current?.click()}>
              <Upload className="size-3.5" />
              Import .ics file
            </Button>
            <Button variant="ghost" size="sm" className="justify-start text-muted-foreground" onClick={() => openNew()}>
              <Plus className="size-3.5" />
              Or add a date manually
            </Button>
          </CardContent>
        </Card>

        <Card className="rounded-2xl shadow-none">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm font-semibold">Upcoming</CardTitle>
          </CardHeader>
          <CardContent className="p-2 pt-0">
            {upcoming.length === 0 ? (
              <p className="px-2 pb-2 text-xs text-muted-foreground">Nothing scheduled yet.</p>
            ) : (
              <ul className="flex flex-col">
                {upcoming.map((e) => (
                  <li key={e.id}>
                    <button
                      type="button"
                      onClick={() => openEdit(e)}
                      className="flex w-full items-start gap-2.5 rounded-lg px-2 py-1.5 text-left hover:bg-muted"
                    >
                      <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", KIND_DOT[e.kind])} />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{e.title}</span>
                        <span className="block text-xs text-muted-foreground">
                          {format(e.startDate, "EEE, MMM d")}
                          {!e.allDay && ` · ${format(e.startDate, "h:mm a")}`}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </aside>

      {/* Main calendar */}
      {/* 7.5rem = 1rem inset margin + 3rem of the shell's p-6 + the 3.5rem top strip */}
      <Card className="flex min-h-[70vh] min-w-0 flex-1 flex-col overflow-hidden rounded-2xl shadow-none lg:h-[calc(100svh-7.5rem)]">
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
          <Button variant="outline" size="sm" onClick={() => setFocus(new Date())}>
            Today
          </Button>
          <div className="flex items-center">
            <Button variant="ghost" size="icon" className="size-8" onClick={() => step(-1)} aria-label="Previous">
              <ChevronLeft className="size-4" />
            </Button>
            <Button variant="ghost" size="icon" className="size-8" onClick={() => step(1)} aria-label="Next">
              <ChevronRight className="size-4" />
            </Button>
          </div>
          <h2 className="text-base font-semibold tracking-tight">{rangeTitle(view, focus)}</h2>

          <div className="ml-auto flex items-center gap-2">
            <div className="flex gap-0.5 rounded-lg bg-muted p-[3px]">
              {(["day", "week", "month"] as View[]).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setView(v)}
                  className={cn(
                    "rounded-md px-3 py-1 text-xs font-semibold capitalize transition-colors",
                    view === v ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {v}
                </button>
              ))}
            </div>
            <Button size="sm" onClick={() => openNew()}>
              <Plus className="size-3.5" />
              Add
            </Button>
          </div>
        </div>

        <div className="relative flex min-h-0 flex-1 flex-col">
          {view === "month" ? (
            <MonthView focus={focus} eventsOn={eventsOn} onDay={(d) => { setFocus(d); setView("day"); }} onEvent={openEdit} onAdd={openNew} />
          ) : (
            <TimeGrid
              days={view === "day" ? [focus] : eachDayOfInterval({ start: startOfWeek(focus), end: endOfWeek(focus) })}
              eventsOn={eventsOn}
              onEvent={openEdit}
              onSlot={(d) => setDraft({ ...emptyDraft(d), startTime: format(d, "HH:mm"), endTime: format(addMinutesSafe(d, 60), "HH:mm") })}
            />
          )}

          {/* Nothing of their own AND no plan days: only then is the calendar really empty. */}
          {parsed.length === 0 && (
            <div className="pointer-events-none absolute inset-0 flex items-start justify-center pt-24">
              <EmptyState
                className="pointer-events-auto w-full max-w-sm bg-card/95 backdrop-blur"
                icon={<CalendarDays />}
                title="Add your first exam"
                body="Tell us when your exam is and what it covers. We'll reserve study time for it in the hours you're free."
                ctaLabel="Add an exam"
                onCta={() => openNew(new Date(), "exam")}
              />
            </div>
          )}
        </div>
      </Card>

      {/* Add / edit dialog */}
      <Dialog open={!!draft} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{draft?.id ? "Edit event" : "Add to calendar"}</DialogTitle>
            <DialogDescription>Exams, deadlines and classes you add here stay on this device for now.</DialogDescription>
          </DialogHeader>
          {draft && (
            <form
              className="grid gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                saveDraft();
              }}
            >
              <div className="grid gap-1.5">
                <Label htmlFor="ev-title">Title</Label>
                <Input
                  id="ev-title"
                  autoFocus
                  placeholder="e.g. Organic chemistry midterm"
                  value={draft.title}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label>Type</Label>
                  <Select value={draft.kind} onValueChange={(v) => setDraft({ ...draft, kind: v as EventKind })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(KIND_LABELS) as EventKind[]).map((k) => (
                        <SelectItem key={k} value={k}>
                          {KIND_LABELS[k]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="ev-date">Date</Label>
                  <Input id="ev-date" type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} required />
                </div>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                <Label htmlFor="ev-allday" className="text-sm font-normal">All day</Label>
                <Switch id="ev-allday" checked={draft.allDay} onCheckedChange={(v) => setDraft({ ...draft, allDay: v })} />
              </div>
              {!draft.allDay && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-1.5">
                    <Label htmlFor="ev-start">Starts</Label>
                    <Input id="ev-start" type="time" value={draft.startTime} onChange={(e) => setDraft({ ...draft, startTime: e.target.value })} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="ev-end">Ends</Label>
                    <Input id="ev-end" type="time" value={draft.endTime} onChange={(e) => setDraft({ ...draft, endTime: e.target.value })} />
                  </div>
                </div>
              )}
              {studySessions.length > 0 && (
                <div className="grid gap-1.5">
                  <Label>Study session</Label>
                  <Select value={draft.sessionId || "none"} onValueChange={(v) => setDraft({ ...draft, sessionId: v === "none" ? "" : v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Link a session (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {studySessions.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="grid gap-1.5">
                <Label htmlFor="ev-notes">Notes</Label>
                <Textarea id="ev-notes" rows={2} placeholder="What does it cover?" value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
              </div>
              <DialogFooter className="gap-2 sm:justify-between">
                {draft.id ? (
                  <Button type="button" variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={deleteDraft}>
                    <Trash2 className="size-3.5" />
                    Remove
                  </Button>
                ) : (
                  <span />
                )}
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setDraft(null)}>
                    Cancel
                  </Button>
                  <Button type="submit" size="sm" disabled={!draft.title.trim()}>
                    {draft.id ? "Save changes" : "Add to calendar"}
                  </Button>
                </div>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ---------------------------------------------------------------------------
   Time grid — day / week
--------------------------------------------------------------------------- */
type Parsed = CalendarEvent & { startDate: Date; endDate?: Date };

function TimeGrid({
  days,
  eventsOn,
  onEvent,
  onSlot,
}: {
  days: Date[];
  eventsOn: (d: Date) => Parsed[];
  onEvent: (e: CalendarEvent) => void;
  onSlot: (d: Date) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: DAY_START_SCROLL * HOUR_PX });
  }, [days.length]);
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const cols = `56px repeat(${days.length}, minmax(0, 1fr))`;
  const nowTop = ((now.getHours() * 60 + now.getMinutes()) / 60) * HOUR_PX;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Day headers + all-day row */}
      <div className="grid border-b border-border" style={{ gridTemplateColumns: cols }}>
        <div className="border-r border-border" />
        {days.map((d) => (
          <div key={d.toISOString()} className="border-r border-border px-2 py-2 text-center last:border-r-0">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{format(d, "EEE")}</p>
            <p
              className={cn(
                "mx-auto mt-0.5 flex size-7 items-center justify-center rounded-full text-sm font-semibold tabular-nums",
                isToday(d) && "bg-primary text-primary-foreground",
              )}
            >
              {format(d, "d")}
            </p>
            <div className="mt-1 flex flex-col gap-0.5">
              {eventsOn(d)
                .filter((e) => e.allDay)
                .map((e) => (
                  <EventChip key={e.id} e={e} onClick={() => onEvent(e)} compact />
                ))}
            </div>
          </div>
        ))}
      </div>

      {/* Scrollable hours */}
      <div ref={scrollRef} className="relative min-h-0 flex-1 overflow-y-auto">
        <div className="relative grid" style={{ gridTemplateColumns: cols, height: HOUR_PX * 24 }}>
          {/* hour labels */}
          <div className="relative border-r border-border">
            {Array.from({ length: 24 }, (_, h) => (
              <div key={h} className="absolute right-2 -translate-y-1/2 text-[10px] tabular-nums text-muted-foreground" style={{ top: h * HOUR_PX }}>
                {h === 0 ? "" : format(new Date(2000, 0, 1, h), "h a")}
              </div>
            ))}
          </div>
          {/* day columns */}
          {days.map((d) => {
            const timed = eventsOn(d).filter((e) => !e.allDay);
            return (
              <div key={d.toISOString()} className={cn("relative border-r border-border last:border-r-0", isToday(d) && "bg-accent/40 dark:bg-accent/20")}>
                {Array.from({ length: 24 }, (_, h) => (
                  <button
                    key={h}
                    type="button"
                    aria-label={`Add at ${format(new Date(2000, 0, 1, h), "h a")}`}
                    onClick={() => onSlot(new Date(d.getFullYear(), d.getMonth(), d.getDate(), h))}
                    className="absolute inset-x-0 border-t border-border/70 transition-colors hover:bg-muted/60"
                    style={{ top: h * HOUR_PX, height: HOUR_PX }}
                  />
                ))}
                {timed.map((e) => {
                  const startMin = e.startDate.getHours() * 60 + e.startDate.getMinutes();
                  const dur = e.endDate ? Math.max(30, differenceInMinutes(e.endDate, e.startDate)) : 60;
                  return (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => onEvent(e)}
                      className={cn(
                        "absolute inset-x-1 overflow-hidden rounded-md border-l-2 px-2 py-1 text-left text-xs leading-tight transition-opacity hover:opacity-90",
                        KIND_STYLE[e.kind],
                      )}
                      style={{ top: (startMin / 60) * HOUR_PX + 1, height: (dur / 60) * HOUR_PX - 2 }}
                    >
                      <span className="block truncate font-semibold">{e.title}</span>
                      <span className="block truncate text-[10px] text-muted-foreground">
                        {format(e.startDate, "h:mm a")}
                        {e.endDate && ` – ${format(e.endDate, "h:mm a")}`}
                      </span>
                    </button>
                  );
                })}
                {isToday(d) && (
                  <div className="pointer-events-none absolute inset-x-0 z-10 flex items-center" style={{ top: nowTop }}>
                    <span className="-ml-1 size-2 rounded-full bg-destructive" />
                    <span className="h-px flex-1 bg-destructive" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------------
   Month grid
--------------------------------------------------------------------------- */
function MonthView({
  focus,
  eventsOn,
  onDay,
  onEvent,
  onAdd,
}: {
  focus: Date;
  eventsOn: (d: Date) => Parsed[];
  onDay: (d: Date) => void;
  onEvent: (e: CalendarEvent) => void;
  onAdd: (d: Date) => void;
}) {
  const days = eachDayOfInterval({ start: startOfWeek(startOfMonth(focus)), end: endOfWeek(endOfMonth(focus)) });
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="grid grid-cols-7 border-b border-border">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="px-2 py-2 text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {d}
          </div>
        ))}
      </div>
      <div className="grid flex-1 grid-cols-7 auto-rows-fr">
        {days.map((d) => {
          const evs = eventsOn(d);
          const out = !isSameMonth(d, focus);
          return (
            <div
              key={d.toISOString()}
              className={cn("group flex min-h-24 flex-col border-b border-r border-border p-1.5 [&:nth-child(7n)]:border-r-0", out && "bg-muted/30")}
            >
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => onDay(d)}
                  className={cn(
                    "flex size-6 items-center justify-center rounded-full text-xs font-semibold tabular-nums hover:bg-muted",
                    out && "text-muted-foreground",
                    isToday(d) && "bg-primary text-primary-foreground hover:bg-primary",
                  )}
                >
                  {format(d, "d")}
                </button>
                <button
                  type="button"
                  onClick={() => onAdd(d)}
                  aria-label="Add event"
                  className="rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:bg-muted group-hover:opacity-100"
                >
                  <Plus className="size-3" />
                </button>
              </div>
              <div className="mt-1 flex flex-col gap-0.5">
                {evs.slice(0, 3).map((e) => (
                  <EventChip key={e.id} e={e} onClick={() => onEvent(e)} compact />
                ))}
                {evs.length > 3 && (
                  <button type="button" onClick={() => onDay(d)} className="text-left text-[10px] text-muted-foreground hover:underline">
                    +{evs.length - 3} more
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EventChip({ e, onClick, compact }: { e: Parsed; onClick: () => void; compact?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-1 truncate rounded border-l-2 px-1.5 text-left text-[11px] leading-5 hover:opacity-90",
        KIND_STYLE[e.kind],
        compact && "leading-[18px]",
      )}
    >
      {e.kind === "exam" && <GraduationCap className="size-3 shrink-0" />}
      <span className="truncate font-medium">{e.title}</span>
      {!e.allDay && <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">{format(e.startDate, "h:mm")}</span>}
    </button>
  );
}
