import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { strippedText } from "@/lib/notes/units";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNowStrict } from "date-fns";
import { ArrowUpRight, Check, Palette, Pencil, Plus, StickyNote as StickyNoteIcon, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useStickyStore } from "@/store/stickyStore";
import type { StickyColor, StickyNote } from "@/services/stickies";

/*
  Sticky notes: the things a student decided were worth keeping.

  They're saved while reading (highlight a phrase, or take the key ideas of a
  section) and they all end up on one wall on the dashboard. A note remembers
  where it came from, so it can take you back to that passage.
*/

export const STICKY_COLORS: StickyColor[] = ["amber", "pink", "green", "blue", "violet"];

/** The backend keeps a sticky note short; longer selections are cut at a word. */
export const STICKY_MAX = 600;
export function clipForSticky(text: string): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= STICKY_MAX) return t;
  return `${t.slice(0, STICKY_MAX - 1).replace(/\s+\S*$/, "")}…`;
}

/**
 * The phrases the AI marked as the point of a section — `<mark>…</mark>` in the
 * notes' Markdown — which is exactly what a student would want on a sticky note.
 */
export function keyIdeasOf(markdown: string | null | undefined): string[] {
  if (!markdown) return [];
  const out: string[] = [];
  for (const m of markdown.matchAll(/<mark>([\s\S]*?)<\/mark>/gi)) {
    const text = clipForSticky(
      m[1]
        .replace(/<[^>]+>/g, "")
        .replace(/[*_`]/g, "")
        .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1"),
    );
    if (text.length > 3 && !out.includes(text)) out.push(text);
  }
  return out;
}

/** A small, stable tilt per note, so the wall looks stuck up by hand rather than laid out. */
const tiltOf = (id: number) => ((id % 5) - 2) * 0.55;

const whenOf = (iso: string) => {
  const t = Date.parse(iso.endsWith("Z") ? iso : `${iso}Z`);
  if (!Number.isFinite(t)) return "";
  return formatDistanceToNowStrict(t, { addSuffix: true });
};

function Swatches({ value, onPick }: { value: StickyColor; onPick: (c: StickyColor) => void }) {
  return (
    <div className="flex items-center gap-1.5">
      {STICKY_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          aria-label={c}
          aria-pressed={c === value}
          onClick={() => onPick(c)}
          className={cn("sticky-swatch", c === value && "is-on")}
          data-color={c}
        />
      ))}
    </div>
  );
}

export function StickyNoteCard({
  note,
  onOpen,
  onDelete,
  onEdit,
  onColor,
}: {
  note: StickyNote;
  onOpen?: (note: StickyNote) => void;
  onDelete?: (note: StickyNote) => void;
  onEdit?: (note: StickyNote, text: string) => void;
  onColor?: (note: StickyNote, color: StickyColor) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [painting, setPainting] = useState(false);
  const [draft, setDraft] = useState(note.text);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const save = () => {
    const text = draft.trim();
    setEditing(false);
    if (text && text !== note.text) onEdit?.(note, text);
    else setDraft(note.text);
  };
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Escape") {
      setDraft(note.text);
      setEditing(false);
    } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      save();
    }
    e.stopPropagation();
  };

  const from = note.section_title || note.session_title;

  return (
    <article className="sticky-note group" data-color={note.color} style={{ "--tilt": `${tiltOf(note.id)}deg` } as React.CSSProperties}>
      {editing ? (
        <textarea
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={save}
          onKeyDown={onKey}
          maxLength={600}
          className="sticky-note-input"
          aria-label="Edit this note"
        />
      ) : (
        <p className="sticky-note-text" title={note.text}>
          {note.text}
        </p>
      )}

      <footer className="sticky-note-foot">
        {painting && onColor ? (
          <Swatches
            value={note.color}
            onPick={(c) => {
              onColor(note, c);
              setPainting(false);
            }}
          />
        ) : (
          <span className="truncate" title={from ?? undefined}>
            {from ? `${from} · ` : ""}
            {whenOf(note.created_at)}
          </span>
        )}
      </footer>

      <div className="sticky-note-tools">
        {onColor && (
          <button type="button" onClick={() => setPainting((p) => !p)} title="Change the paper" aria-label="Change the paper">
            {painting ? <X className="size-3.5" /> : <Palette className="size-3.5" />}
          </button>
        )}
        {onEdit && !editing && (
          <button type="button" onClick={() => setEditing(true)} title="Edit" aria-label="Edit this note">
            <Pencil className="size-3.5" />
          </button>
        )}
        {editing && (
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={save} title="Save" aria-label="Save this note">
            <Check className="size-3.5" />
          </button>
        )}
        {onOpen && note.study_session_id && (
          <button type="button" onClick={() => onOpen(note)} title="Go to where this came from" aria-label="Go to where this came from">
            <ArrowUpRight className="size-3.5" />
          </button>
        )}
        {onDelete && (
          <button type="button" onClick={() => onDelete(note)} title="Throw away" aria-label="Throw this note away">
            <Trash2 className="size-3.5" />
          </button>
        )}
      </div>
    </article>
  );
}

/** A blank note to write on. */
function StickyComposer({ onSave, onCancel }: { onSave: (text: string, color: StickyColor) => void; onCancel: () => void }) {
  const [text, setText] = useState("");
  const [color, setColor] = useState<StickyColor>("amber");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => inputRef.current?.focus(), []);

  const save = () => {
    const t = text.trim();
    if (t) onSave(t, color);
    else onCancel();
  };

  return (
    <article className="sticky-note" data-color={color}>
      <textarea
        ref={inputRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") onCancel();
          else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) save();
          e.stopPropagation();
        }}
        maxLength={600}
        placeholder="Something worth remembering…"
        className="sticky-note-input"
        aria-label="Write a sticky note"
      />
      <footer className="sticky-note-foot">
        <Swatches value={color} onPick={setColor} />
        <span className="ml-auto flex items-center gap-1">
          <button type="button" onClick={onCancel} className="sticky-note-action" aria-label="Cancel">
            <X className="size-3.5" />
          </button>
          <button type="button" onClick={save} className="sticky-note-action" disabled={!text.trim()} aria-label="Keep this note">
            <Check className="size-3.5" />
          </button>
        </span>
      </footer>
    </article>
  );
}

/**
 * Highlight anything in your notes and keep it.
 *
 * Watches for a selection inside a notes block (`[data-guide-notes]` marks each
 * section's notes) and floats a save button over it. `resolve` turns the block's
 * id into the section it belongs to, so the note remembers where it came from.
 */
/** A rect for [start,end) of an open line, measured on its painted ink layer. */
function inkRectOf(input: HTMLTextAreaElement, start: number, end: number): DOMRect | null {
  const ink = input.parentElement?.querySelector<HTMLElement>("[data-ps-ink]");
  if (!ink) return null;
  const walker = document.createTreeWalker(ink, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  const offs: number[] = [];
  let seen = 0;
  for (let t = walker.nextNode() as Text | null; t; t = walker.nextNode() as Text | null) {
    nodes.push(t);
    offs.push(seen);
    seen += t.data.length;
  }
  const locate = (off: number) => {
    for (let i = nodes.length - 1; i >= 0; i--) if (offs[i] <= off) return { node: nodes[i], offset: Math.min(off - offs[i], nodes[i].data.length) };
    return nodes.length ? { node: nodes[0], offset: 0 } : null;
  };
  const a = locate(start);
  const b = locate(end);
  if (!a || !b) return null;
  try {
    const r = document.createRange();
    r.setStart(a.node, a.offset);
    r.setEnd(b.node, b.offset);
    const rect = r.getBoundingClientRect();
    return rect.width || rect.height ? rect : null;
  } catch {
    return null;
  }
}

export function StickySelection({
  sessionId,
  resolve,
}: {
  sessionId: string;
  resolve: (notesKey: string) => { topicId: number; title: string } | null;
}) {
  const { toast } = useToast();
  const add = useStickyStore((s) => s.add);
  const [at, setAt] = useState<{ x: number; y: number; text: string; notesKey: string } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const read = () => {
      // A line of notes open for editing is a <textarea>, and getSelection()
      // does not reach inside one — so read the offsets off it directly and
      // measure against the ink layer, whose layout is identical by design.
      const active = document.activeElement as HTMLTextAreaElement | null;
      if (active?.tagName === "TEXTAREA" && active.hasAttribute("data-ps-input")) {
        const root = active.closest("[data-guide-notes]") as HTMLElement | null;
        const s0 = active.selectionStart ?? 0;
        const e0 = active.selectionEnd ?? 0;
        if (!root || e0 - s0 < 3) return setAt(null);
        const kept = clipForSticky(strippedText(active.value.slice(s0, e0)).trim());
        if (kept.length < 3) return setAt(null);
        const rect = inkRectOf(active, s0, e0) ?? active.getBoundingClientRect();
        return setAt({
          x: Math.min(window.innerWidth - 90, Math.max(90, rect.left + rect.width / 2)),
          y: rect.top > 60 ? rect.top - 10 : rect.bottom + 34,
          text: kept,
          notesKey: root.getAttribute("data-guide-notes") ?? "",
        });
      }
      const sel = window.getSelection();
      const text = sel?.toString().trim() ?? "";
      if (!sel || sel.isCollapsed || text.length < 3) return setAt(null);
      const node = sel.anchorNode;
      const el = (node?.nodeType === 1 ? (node as Element) : node?.parentElement) ?? null;
      const root = el?.closest?.("[data-guide-notes]") as HTMLElement | null;
      if (!root || !root.contains(sel.focusNode)) return setAt(null);
      const rect = sel.getRangeAt(0).getBoundingClientRect();
      if (!rect.width && !rect.height) return setAt(null);
      setAt({
        x: Math.min(window.innerWidth - 90, Math.max(90, rect.left + rect.width / 2)),
        y: rect.top > 60 ? rect.top - 10 : rect.bottom + 34,
        text: clipForSticky(text),
        notesKey: root.getAttribute("data-guide-notes") ?? "",
      });
    };
    const onPointerUp = (e: PointerEvent) => {
      if ((e.target as HTMLElement)?.closest?.(".sticky-selection")) return; // the button itself
      window.setTimeout(read, 0); // let the selection settle first
    };
    const onSelectionChange = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) setAt(null);
    };
    document.addEventListener("pointerup", onPointerUp);
    document.addEventListener("keyup", read);
    document.addEventListener("selectionchange", onSelectionChange);
    window.addEventListener("scroll", read, { capture: true, passive: true });
    return () => {
      document.removeEventListener("pointerup", onPointerUp);
      document.removeEventListener("keyup", read);
      document.removeEventListener("selectionchange", onSelectionChange);
      window.removeEventListener("scroll", read, { capture: true } as EventListenerOptions);
    };
  }, []);

  if (!at) return null;

  const keep = async () => {
    const where = resolve(at.notesKey);
    setSaving(true);
    try {
      await add({
        text: at.text,
        source: "highlight",
        study_session_id: sessionId,
        topic_id: where?.topicId ?? null,
        section_title: where?.title ?? null,
      });
      toast({ title: "Kept on a sticky note", description: "It's waiting on your dashboard." });
      window.getSelection()?.removeAllRanges();
      setAt(null);
    } catch (e) {
      toast({ title: "Couldn't keep that", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <button type="button" className="sticky-selection" style={{ left: at.x, top: at.y }} onClick={keep} disabled={saving}>
      <StickyNoteIcon className="size-3.5" />
      {saving ? "Keeping…" : "Save to sticky"}
    </button>,
    document.body,
  );
}

/** Everything kept from one study session, for the pill in its header. */
export function StickySessionDialog({
  open,
  onOpenChange,
  sessionId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: string;
}) {
  const { toast } = useToast();
  const { notes, load, edit, remove } = useStickyStore();
  const mine = notes.filter((n) => n.study_session_id === sessionId);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  const guard = (run: () => Promise<unknown>) => {
    void run().catch((e) =>
      toast({ title: "Something went wrong", description: e instanceof Error ? e.message : undefined, variant: "destructive" }),
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Sticky notes from this session</DialogTitle>
          <DialogDescription>
            {mine.length
              ? "They're on your dashboard too. Highlight anything in the notes to keep more."
              : "Nothing kept from this session yet — highlight a phrase in the notes and choose Save to sticky."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid max-h-[60vh] gap-3 overflow-y-auto pr-1 sm:grid-cols-2">
          {mine.map((note) => (
            <StickyNoteCard
              key={note.id}
              note={note}
              onDelete={(n) => guard(() => remove(n.id))}
              onEdit={(n, text) => guard(() => edit(n.id, { text }))}
              onColor={(n, color) => guard(() => edit(n.id, { color }))}
            />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * The wall of everything kept, for the dashboard.
 * `limit` is how many show before "Show all".
 */
export function StickyWall({ limit = 6 }: { limit?: number }) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { notes, loaded, loading, error, load, add, edit, remove } = useStickyStore();
  const [composing, setComposing] = useState(false);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    void load();
  }, [load]);

  const shown = showAll ? notes : notes.slice(0, limit);

  const open = (note: StickyNote) => {
    if (!note.study_session_id) return;
    navigate(`/dashboard/${note.study_session_id}/full-study`, { state: { focusTopic: note.topic_id } });
  };
  const write = async (text: string, color: StickyColor) => {
    setComposing(false);
    try {
      await add({ text, color, source: "manual" });
    } catch (e) {
      toast({ title: "Couldn't keep that note", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
    }
  };
  const guard = (run: () => Promise<unknown>) => {
    void run().catch((e) =>
      toast({ title: "Something went wrong", description: e instanceof Error ? e.message : undefined, variant: "destructive" }),
    );
  };

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Sticky notes{notes.length ? ` · ${notes.length}` : ""}
        </p>
        <button
          type="button"
          onClick={() => setComposing(true)}
          className="inline-flex h-7 items-center gap-1 rounded-full px-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <Plus className="size-3.5" />
          New note
        </button>
      </div>

      {!loaded && loading ? (
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-36 rounded-2xl" />
          <Skeleton className="h-36 rounded-2xl" />
          <Skeleton className="h-36 rounded-2xl" />
        </div>
      ) : error ? (
        <p className="mt-3 text-sm text-muted-foreground">{error}</p>
      ) : notes.length === 0 && !composing ? (
        <button type="button" onClick={() => setComposing(true)} className="sticky-empty mt-3">
          <span className="font-medium text-foreground">Nothing kept yet.</span> Highlight anything while you study and choose{" "}
          <span className="font-medium text-foreground">Save to sticky</span> — or write your first note here.
        </button>
      ) : (
        <>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {composing && <StickyComposer onSave={write} onCancel={() => setComposing(false)} />}
            {shown.map((note) => (
              <StickyNoteCard
                key={note.id}
                note={note}
                onOpen={open}
                onDelete={(n) => guard(() => remove(n.id))}
                onEdit={(n, text) => guard(() => edit(n.id, { text }))}
                onColor={(n, color) => guard(() => edit(n.id, { color }))}
              />
            ))}
          </div>
          {notes.length > limit && (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="mt-3 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              {showAll ? "Show fewer" : `Show all ${notes.length}`}
            </button>
          )}
        </>
      )}
    </section>
  );
}
