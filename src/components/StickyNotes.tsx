import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
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

  They're written on the dashboard's wall, and a note that came from a study
  session remembers where, so it can take you back to that passage. (Notes kept with the old "Keep
  key ideas" button, source "key-idea", are on the wall like any other.)
*/

export const STICKY_COLORS: StickyColor[] = ["amber", "pink", "green", "blue", "violet"];

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
      {/* Opened from the study page's header: like its Quiz, Teach mode stops talking
          when it opens, leaves its keys alone in here and lowers the board under it. */}
      <DialogContent data-study-dialog="" className="max-w-3xl">
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
        <p className="mt-3 text-sm text-muted-foreground">
          {error}{" "}
          <button type="button" onClick={() => void load(true)} className="font-medium text-foreground underline-offset-2 hover:underline">
            Try now
          </button>
        </p>
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
