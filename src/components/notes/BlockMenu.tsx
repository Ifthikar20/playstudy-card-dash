/**
 * The `/` menu and the locked-block editor — the two halves of "put something
 * in the page that isn't a sentence".
 *
 * SlashMenu     Type `/` on a fresh line (or after a space) and this opens at
 *               the caret, filtered live by whatever is typed after the slash.
 *               Arrow keys move, Enter or Tab inserts, Escape dismisses without
 *               leaving the writing surface. Every item is literal Markdown
 *               from the catalogue in lib/notes/blocks.ts — the menu never
 *               builds a string of its own.
 *
 * BlockEditor   A table, a code fence, a `$$` formula and a pinned diagram are
 *               ATOMS: the caret cannot enter their source and no keystroke may
 *               touch it, because one stray character in a closing fence
 *               swallows the rest of the notes. So they are edited here
 *               instead, as their own source, in their own box. It opens by
 *               itself on a block the `/` menu just inserted — the block lands
 *               already filled in with something that renders, and this is
 *               where it gets changed.
 *
 * NEITHER TOUCHES THE DOCUMENT. Both hand a candidate string back to OneSheet,
 * which proves it with `guardDoc` against a DECLARED intent before a byte moves.
 */

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BlockItem } from "@/lib/notes/blocks";

export interface Anchor {
  top: number;
  left: number;
  bottom: number;
}

const MENU_W = 300;
const GAP = 6;
const EDGE = 8;

export function SlashMenu({
  items,
  active,
  anchor,
  onPick,
  onActive,
}: {
  items: BlockItem[];
  active: number;
  anchor: Anchor;
  onPick: (item: BlockItem) => void;
  onActive: (i: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  /* Flip above the line when there isn't room below it, and never let the panel
     hang off either edge — a phone is 360px wide and the caret can be at 350. */
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const h = el.offsetHeight;
    const w = el.offsetWidth;
    const vh = window.innerHeight;
    const vw = window.innerWidth;
    const above = vh - anchor.bottom < h + GAP + EDGE && anchor.top > h + GAP + EDGE;
    setPos({
      top: above ? Math.max(EDGE, anchor.top - h - GAP) : Math.min(vh - h - EDGE, anchor.bottom + GAP),
      left: Math.max(EDGE, Math.min(anchor.left, vw - w - EDGE)),
    });
  }, [anchor.top, anchor.left, anchor.bottom, items.length]);

  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('[data-active="true"]')?.scrollIntoView({ block: "nearest" });
  }, [active]);

  let group = "";
  return (
    <div
      ref={ref}
      data-an-chrome=""
      role="listbox"
      aria-label="Insert a block"
      className="fixed z-50 max-h-[min(20rem,60vh)] overflow-y-auto overscroll-contain rounded-xl border border-border/70 bg-popover py-1.5 text-popover-foreground shadow-xl"
      style={{
        width: `min(${MENU_W}px, calc(100vw - ${EDGE * 2}px))`,
        top: pos?.top ?? 0,
        left: pos?.left ?? 0,
        visibility: pos ? "visible" : "hidden",
      }}
      // Keep the caret in the notes: a mousedown here would blur the textarea,
      // which flushes and tears the menu down before the click ever lands.
      onMouseDown={(e) => e.preventDefault()}
    >
      {items.map((item, i) => {
        const head = item.group !== group ? ((group = item.group), item.group) : null;
        const Icon = item.icon;
        return (
          <div key={item.id}>
            {head && (
              <div className="px-3 pb-1 pt-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70">
                {head}
              </div>
            )}
            <button
              type="button"
              role="option"
              aria-selected={i === active}
              data-active={i === active}
              className={cn(
                "flex w-full items-center gap-2.5 px-2.5 py-1.5 text-left",
                i === active ? "bg-accent" : "hover:bg-accent/50",
              )}
              onMouseEnter={() => onActive(i)}
              onClick={() => onPick(item)}
            >
              <span className="flex size-7 shrink-0 items-center justify-center rounded-md border border-border/60 bg-background">
                <Icon className="size-3.5 text-muted-foreground" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[13px] leading-tight">{item.label}</span>
                <span className="block truncate text-[11px] leading-tight text-muted-foreground">{item.hint}</span>
              </span>
            </button>
          </div>
        );
      })}
    </div>
  );
}

export interface EditingBlock {
  start: number;
  end: number;
  label: string;
  /** The bytes that were there when the panel opened. If they have moved on,
   *  the save is refused rather than applied at a stale offset. */
  original: string;
  draft: string;
}

/**
 * The source of one locked block, in a plain textarea.
 *
 * Deliberately the SOURCE and not a form: a `playstudy-visual` fence is JSON, a
 * table is pipes, a formula is LaTeX, and what is shown here is exactly what
 * will be stored. A form would be a serialiser, and a serialiser is the one
 * thing this whole feature refuses to have.
 */
export function BlockEditor({
  block,
  error,
  onDraft,
  onSave,
  onCancel,
}: {
  block: EditingBlock;
  error: string | null;
  onDraft: (s: string) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, [block.start]);

  /* Grow to the content so a 12-line fence isn't edited through a 3-line slot. */
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 320)}px`;
  }, [block.draft]);

  return (
    <div className="mx-auto mt-3 max-w-[78ch] rounded-lg border border-border/70 bg-card/60 p-3" data-an-chrome="">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{block.label}</span>
        <span className="text-[11px] text-muted-foreground">⌘↵ to apply · Esc to cancel</span>
      </div>
      <textarea
        ref={ref}
        value={block.draft}
        spellCheck={false}
        aria-label={`${block.label} source`}
        className="w-full resize-none rounded-md border border-border/60 bg-background px-2.5 py-2 font-mono text-[12px] leading-relaxed outline-none focus:border-ring"
        onChange={(e) => onDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            onCancel();
          } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            onSave();
          }
        }}
      />
      <div className="mt-2 flex items-center gap-3">
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-2.5 py-1 text-[12px] text-primary-foreground hover:opacity-90"
          onClick={onSave}
        >
          <Check className="size-3" /> Apply
        </button>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[12px] text-muted-foreground hover:text-foreground"
          onClick={onCancel}
        >
          <X className="size-3" /> Cancel
        </button>
        {error && <span className="text-[11px] text-destructive">{error}</span>}
      </div>
    </div>
  );
}
