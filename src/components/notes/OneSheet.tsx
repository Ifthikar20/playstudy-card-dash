/**
 * One Sheet — the whole section as ONE writing surface.
 *
 * A transparent <textarea> over a painted copy of its own value. Both layers are
 * one box, one font, one line-height and one measure, so they agree character
 * for character by construction: there is no drift to correct because nothing
 * varies. The caret is the browser's own, which is why Enter, Backspace-merge,
 * cross-paragraph selection, Ctrl+A, word-jump, column-preserving Up/Down and a
 * single document-wide undo stack are all native-exact rather than
 * reimplemented — and why none of them costs a network save.
 *
 * WHY IT CANNOT CORRUPT NOTES
 *   `textarea.value` IS the stored Markdown, byte for byte, at every instant.
 *   There are no spacer characters, no synthetic nodes and no DOM → Markdown
 *   serialiser anywhere in this file, so a save cannot emit a byte the student
 *   did not type. `<mark class="hi">`, `\ce{}`, KaTeX, GFM tables and pinned
 *   ```playstudy-visual fences survive because they are never read.
 *
 *   Three refusals, matching the discipline of the per-line editor it replaces:
 *     1. `beforeinput` cancels any input whose range touches a frozen atom.
 *     2. the caret never rests inside one — it steps over it in one keypress.
 *     3. `guardDoc` re-proves it on the candidate document, and is the only one
 *        trusted. A refusal never reverts what the student typed; it just
 *        leaves it unsaved with a visible reason, and retries on the next edit.
 *
 * WHAT IT CANNOT SHOW
 *   A textarea has ONE font-size and ONE line-height, so while you are writing a
 *   heading is the same size as body text (coloured, banded, ghost-prefixed with
 *   `## `, but not bigger) and a list indents by its source whitespace. That is
 *   why this surface only exists while you are actually writing: the moment it
 *   loses focus the notes go back to full prose typography.
 */

import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from "react";
import { Loader2, Lock } from "lucide-react";
import { HEADING_COLORS, reanchor } from "@/lib/notes/units";
import { atomDelta, buildSheet, changedRange, guardDoc, type Sheet, type SheetAtom, type SheetRun } from "@/lib/notes/sheet";

const IDLE_MS = 800;
const MAX_WAIT_MS = 5000;

const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);

const runClass = (r: SheetRun) =>
  [
    r.syntax && "ps-syntax",
    r.strong && "ps-strong",
    r.em && "ps-em",
    r.del && "ps-del",
    r.code && "ps-code",
    r.mark && "ps-mark",
    r.link && !r.syntax && "ps-link",
    r.tag && "ps-tag",
    r.atom && "ps-atom",
    r.quote && "ps-quote",
    r.head > 0 && "ps-head",
  ]
    .filter(Boolean)
    .join(" ");

/** One innerHTML assignment beats reconciling a thousand spans per keystroke.
 *  Nothing here may change layout metrics — see the header and index.css. */
function paint(ink: HTMLElement, runs: SheetRun[]) {
  let html = "";
  for (const r of runs) {
    const cls = runClass(r);
    const hue = r.hue >= 0 ? HEADING_COLORS[r.hue] : null;
    const style = hue ? ` style="--ps-h:${hue};--ps-h-bg:${hue}22"` : "";
    html += cls || style ? `<span class="${cls}"${style}>${esc(r.text)}</span>` : esc(r.text);
  }
  ink.innerHTML = html;
}

const hits = (frozen: Array<[number, number]>, s: number, e: number) =>
  frozen.some(([fs, fe]) => s < fe && e > fs);

/** The block a frozen range is protecting. A frozen range is WIDER than the
 *  atom inside it (it swallows the blank lines around it), so the atom has to be
 *  looked up through the range rather than by raw offset. */
const atomIn = (sheet: Sheet, range: [number, number] | undefined): SheetAtom | null => {
  if (!range) return null;
  const inside = sheet.atoms.filter((a) => a.start >= range[0] && a.end <= range[1]);
  return inside.find((a) => a.top) ?? inside[0] ?? null;
};

/** The extent a collapsed delete would actually consume. Conservative on
 *  purpose: over-estimating refuses a legal edit, under-estimating eats an atom. */
function deleteExtent(value: string, type: string, at: number): [number, number] {
  const back = type.endsWith("Backward");
  if (/^deleteContent/.test(type)) return back ? [at - 1, at] : [at, at + 1];
  if (/^deleteWord/.test(type)) {
    if (back) {
      let i = at;
      while (i > 0 && /\s/.test(value[i - 1])) i--;
      while (i > 0 && !/\s/.test(value[i - 1])) i--;
      return [i, at];
    }
    let i = at;
    while (i < value.length && /\s/.test(value[i])) i++;
    while (i < value.length && !/\s/.test(value[i])) i++;
    return [at, i];
  }
  if (/^delete(Soft|Hard)Line/.test(type)) {
    if (back) return [value.lastIndexOf("\n", at - 1) + 1, at];
    const nl = value.indexOf("\n", at);
    return [at, nl < 0 ? value.length : nl];
  }
  return [at, at];
}

export interface OneSheetProps {
  /** The stored Markdown at mount. The textarea is uncontrolled from here on. */
  initial: string;
  caret: number;
  guideKey?: number;
  onCommit: (next: string) => Promise<string | void>;
  /** Leave the writing surface and go back to rendered prose. */
  onClose: () => void;
}

export interface OneSheetHandle {
  /** Another writer landed a new copy of the notes under us. */
  external: (md: string) => void;
  flush: () => Promise<void>;
}

export const OneSheet = forwardRef<OneSheetHandle, OneSheetProps>(function OneSheet(
  { initial, caret, guideKey, onCommit, onClose },
  handleRef,
) {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const inkRef = useRef<HTMLDivElement>(null);
  const baseRef = useRef(initial); // the last copy the server has
  /* The textarea's value, mirrored on every keystroke. React detaches host refs
     BEFORE passive-effect cleanups run, so an unmount flush that read
     `taRef.current.value` would find nothing and silently drop the last words a
     student typed before navigating away. */
  const liveValue = useRef(initial);
  const sheetRef = useRef<Sheet>(buildSheet(initial));
  const lastCaret = useRef(caret);
  const idleTimer = useRef(0);
  const maxTimer = useRef(0);
  const busyRef = useRef(false);
  /* Atom signatures the student has EXPLICITLY agreed to remove, one entry per
     block. Nothing else may ever disappear. This is a ledger rather than a
     remembered "intent" because an intent goes stale the moment they undo: the
     ledger only ever says what is PERMITTED, and `flush` still has to observe
     that exactly those atoms, and no others, actually went. */
  const consent = useRef<string[]>([]);
  /* Set only while the Remove command is applying its own edit, so the
     `beforeinput` refusal does not block the one deletion it has just proved. */
  const applying = useRef(false);

  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState<string | null>(null);
  const [locked, setLocked] = useState<SheetAtom | null>(null);
  const [conflict, setConflict] = useState(false);

  /* selectionchange fires on every caret move, so only ever push NEW state. */
  const show = useCallback((a: SheetAtom | null) => {
    setLocked((prev) => (prev?.start === a?.start && prev?.end === a?.end ? prev : a));
  }, []);

  const repaint = useCallback(() => {
    const el = taRef.current;
    const ink = inkRef.current;
    if (!el || !ink) return;
    liveValue.current = el.value;
    sheetRef.current = buildSheet(el.value);
    paint(ink, sheetRef.current.runs);
  }, []);

  /* ---------------------------------------------------------------- *
   * Refusal 3 — the only one trusted.
   * ---------------------------------------------------------------- */
  const flush = useCallback(async () => {
    window.clearTimeout(idleTimer.current);
    window.clearTimeout(maxTimer.current);
    idleTimer.current = 0;
    maxTimer.current = 0;
    const el = taRef.current;
    if (busyRef.current) return;
    const next = el ? el.value : liveValue.current;
    const base = baseRef.current;
    if (next === base) return;

    const { gone, made } = atomDelta(base, next);
    const ledger = [...consent.current];
    const unauthorised = made.length > 0 || gone.some((sig) => {
      const i = ledger.indexOf(sig);
      if (i < 0) return true;
      ledger.splice(i, 1);
      return false;
    });
    const g = unauthorised
      ? { ok: false, why: "that would change a pinned diagram, formula, table or code block" }
      : guardDoc(base, next, { removeAtoms: gone });
    if (!g.ok) {
      // The student's words are NEVER reverted. They stay on screen, unsaved,
      // with a reason — they may simply be mid-way through closing a <mark>.
      setBlocked(g.why ?? "That change wasn't saved.");
      return;
    }
    setBlocked(null);
    busyRef.current = true;
    setBusy(true);
    try {
      const server = await onCommit(next);
      const adopted = typeof server === "string" ? server : next;
      baseRef.current = adopted;
      // The base now contains the removals, so the permission is spent.
      for (const sig of gone) {
        const i = consent.current.indexOf(sig);
        if (i >= 0) consent.current.splice(i, 1);
      }
      // Adopt the server's normalisation only if nothing was typed meanwhile.
      if (adopted !== next && el && el.value === next) {
        el.value = adopted;
        const at = Math.min(lastCaret.current, adopted.length);
        el.setSelectionRange(at, at);
        repaint();
      }
    } catch (e) {
      setBlocked(e instanceof Error ? e.message : "Couldn't save — we'll keep trying.");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [onCommit, repaint]);

  const flushRef = useRef(flush);
  flushRef.current = flush;

  const schedule = useCallback(() => {
    window.clearTimeout(idleTimer.current);
    idleTimer.current = window.setTimeout(() => void flushRef.current(), IDLE_MS);
    if (!maxTimer.current) {
      maxTimer.current = window.setTimeout(() => {
        maxTimer.current = 0;
        void flushRef.current();
      }, MAX_WAIT_MS);
    }
  }, []);

  /* ---------------------------------------------------------------- *
   * Refusal 1 — no input may touch a frozen range.
   * ---------------------------------------------------------------- */
  useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    const onBeforeInput = (e: Event) => {
      const ev = e as InputEvent;
      const value = el.value;
      let s = el.selectionStart ?? 0;
      let x = el.selectionEnd ?? 0;
      if (applying.current) return;
      if (s === x && ev.inputType.startsWith("delete")) [s, x] = deleteExtent(value, ev.inputType, s);
      const hit = sheetRef.current.frozen.find(([fs, fe]) => s < fe && x > fs);
      if (!hit) return;
      e.preventDefault();
      show(atomIn(sheetRef.current, hit));
      setBlocked(null);
    };
    el.addEventListener("beforeinput", onBeforeInput);
    return () => el.removeEventListener("beforeinput", onBeforeInput);
  }, [show]);

  /* ---------------------------------------------------------------- *
   * Refusal 2 — the caret steps OVER an atom in one keypress, never into it.
   * Also the block-boundary flush: moving the caret out of the region you were
   * editing saves it, so two edits in different parts of the section can never
   * end up in one debounce window (and therefore never in one changed range).
   * ---------------------------------------------------------------- */
  useEffect(() => {
    const onSel = () => {
      const el = taRef.current;
      if (!el || document.activeElement !== el) return;
      const at = el.selectionStart ?? 0;
      if (el.selectionStart === el.selectionEnd) {
        const hit = sheetRef.current.frozen.find(([fs, fe]) => at > fs && at < fe);
        if (hit) {
          const to = at >= lastCaret.current ? hit[1] : hit[0];
          el.setSelectionRange(to, to);
          lastCaret.current = to;
          // Stepping over a locked block is also how you learn it is one, and
          // that you can take it out — the way clicking an image in Word selects
          // it and tells you Delete will remove it.
          show(atomIn(sheetRef.current, hit));
          return;
        }
        // Resting on either edge of one keeps the notice up, so the offer to
        // remove it does not vanish the moment the caret settles.
        show(atomIn(sheetRef.current, sheetRef.current.frozen.find(([fs, fe]) => at === fs || at === fe)));
      }
      lastCaret.current = at;

      const base = baseRef.current;
      const value = el.value;
      if (value === base || busyRef.current) return;
      const [s, e] = changedRange(base, value);
      const eAfter = value.length - (base.length - e);
      if (at + 1 < s || at > eAfter + 1) void flushRef.current();
    };
    document.addEventListener("selectionchange", onSel);
    return () => document.removeEventListener("selectionchange", onSel);
  }, [show]);

  /* Mount: paint, focus, place the caret where the student clicked. */
  useLayoutEffect(() => {
    const el = taRef.current;
    if (!el) return;
    repaint();
    el.focus({ preventScroll: true });
    const at = Math.max(0, Math.min(caret, el.value.length));
    el.setSelectionRange(at, at);
    lastCaret.current = at;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Leaving the page, the route or the tab must not lose the last keystrokes. */
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") void flushRef.current();
    };
    const onUnload = () => void flushRef.current();
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("beforeunload", onUnload);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("beforeunload", onUnload);
      void flushRef.current();
    };
  }, []);

  /* ---------------------------------------------------------------- *
   * Typing helpers. Everything goes through insertText so it lands on the
   * NATIVE undo stack — one stack for the whole section, never destroyed,
   * where the per-line editor threw its stack away at every line close.
   * ---------------------------------------------------------------- */
  const insert = (text: string, from?: number, to?: number) => {
    const el = taRef.current;
    if (!el) return;
    if (from != null && to != null) el.setSelectionRange(from, to);
    if (!document.execCommand("insertText", false, text)) {
      const s = el.selectionStart ?? 0;
      const e = el.selectionEnd ?? 0;
      el.setSelectionRange(s, e);
      el.value = el.value.slice(0, s) + text + el.value.slice(e);
      el.setSelectionRange(s + text.length, s + text.length);
    }
    repaint();
    schedule();
  };

  const wrap = (open: string, close: string) => {
    const el = taRef.current;
    if (!el) return;
    const s = el.selectionStart ?? 0;
    const e = el.selectionEnd ?? 0;
    if (hits(sheetRef.current.frozen, s, e)) return;
    const v = el.value;
    const outer = [s - open.length, e + close.length] as const;
    if (v.slice(outer[0], s) === open && v.slice(e, outer[1]) === close) {
      const inner = v.slice(s, e);
      insert(inner, outer[0], outer[1]);
      el.setSelectionRange(outer[0], outer[0] + inner.length);
      return;
    }
    const sel = v.slice(s, e);
    insert(open + sel + close, s, e);
    el.setSelectionRange(s + open.length, s + open.length + sel.length);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget;
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation(); // don't let Teach mode's window handler close the lesson
      void flushRef.current().then(onClose);
      return;
    }
    const mod = e.metaKey || e.ctrlKey;
    if (mod && !e.altKey) {
      const k = e.key.toLowerCase();
      if (k === "b") return e.preventDefault(), wrap("**", "**");
      if (k === "i") return e.preventDefault(), wrap("*", "*");
      if (k === "h" && e.shiftKey) return e.preventDefault(), wrap("<mark>", "</mark>");
      return; // ⌘K stays the app's command palette
    }
    const v = el.value;
    const at = el.selectionStart ?? 0;
    const lineStart = v.lastIndexOf("\n", at - 1) + 1;
    const line = v.slice(lineStart, at);
    const bullet = /^(\s*)(?:([-*+])|(\d+)\.)(\s+)(\[[ xX]\]\s+)?(.*)$/.exec(line);
    const quote = /^(\s*>\s?)(.*)$/.exec(line);

    if (e.key === "Enter" && !e.shiftKey && el.selectionStart === el.selectionEnd) {
      if (bullet) {
        const [, indent, dash, num, gap, task, rest] = bullet;
        if (!rest.trim() && !task) {
          // Enter on an empty bullet ends the list, exactly as Word does.
          e.preventDefault();
          return insert("", lineStart, at);
        }
        e.preventDefault();
        const marker = dash ? dash : `${Number(num) + 1}.`;
        return insert(`\n${indent}${marker}${gap}${task ? "[ ] " : ""}`);
      }
      if (quote && quote[2].trim()) {
        e.preventDefault();
        return insert(`\n${quote[1]}`);
      }
      return; // native newline, native undo
    }

    if (e.key === "Tab" && bullet) {
      // Only inside a list, so Tab keeps moving focus everywhere else and the
      // surface never becomes a keyboard trap.
      e.preventDefault();
      if (e.shiftKey) {
        const cut = /^ {1,2}/.exec(v.slice(lineStart));
        if (cut) insert("", lineStart, lineStart + cut[0].length);
      } else insert("  ", lineStart, lineStart);
    }
  };

  /* ---------------------------------------------------------------- *
   * Removing a pinned block — the one deliberate atom change, and the only
   * one the guard will accept, because the command DECLARES exactly which
   * atom it means to remove and guardDoc proves that is all that changed.
   * ---------------------------------------------------------------- */
  const removeLocked = () => {
    const el = taRef.current;
    const atom = locked;
    if (!el || !atom) return;
    const v = el.value;
    let s = atom.start;
    let e = atom.end;
    while (e < v.length && v[e] === "\n") e++;
    while (s > 0 && v[s - 1] === "\n" && v.slice(0, s).trim()) s--;
    const next = v.slice(0, s) + v.slice(e);
    // Prove it BEFORE touching the document: exactly this atom leaves, nothing
    // is created, and every byte outside the removed range is identical.
    const { gone, made } = atomDelta(v, next);
    const g = made.length ? { ok: false, why: "that would change a pinned diagram, formula, table or code block" } : guardDoc(v, next, { removeAtoms: gone });
    if (!g.ok || !gone.length) {
      show(null);
      setBlocked(g.why ?? "That block couldn't be removed on its own.");
      return;
    }
    consent.current.push(...gone);
    applying.current = true;
    try {
      el.setSelectionRange(s, e);
      if (!document.execCommand("delete")) {
        el.value = next;
        repaint();
      }
    } finally {
      applying.current = false;
    }
    el.setSelectionRange(s, s);
    repaint();
    show(null);
    void flushRef.current();
  };

  /* Another writer (pinVisual, the guide's notes_updated stream, revise). */
  const external = useCallback(
    (md: string) => {
      const el = taRef.current;
      if (!el || md === baseRef.current) return;
      if (el.value === baseRef.current) {
        const at = Math.min(lastCaret.current, md.length);
        baseRef.current = md;
        el.value = md;
        liveValue.current = md;
        el.setSelectionRange(at, at);
        repaint();
        return;
      }
      // We have unsaved words. Only rebase if the region we changed still
      // occurs exactly once in the new copy; otherwise show the conflict bar
      // rather than clobbering either side.
      const [s, e] = changedRange(baseRef.current, el.value);
      const before = baseRef.current.slice(s, e);
      if (before && reanchor(md, before)) baseRef.current = md;
      else setConflict(true);
    },
    [repaint],
  );

  useImperativeHandle(handleRef, () => ({ external, flush }), [external, flush]);

  return (
    <>
      {conflict && (
        <div className="mx-auto mb-3 flex max-w-[78ch] flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground" data-ps-chrome="">
          <span>These notes changed somewhere else while you were writing.</span>
          <button type="button" className="underline underline-offset-2 hover:text-foreground" onClick={onClose}>
            Show me the new version
          </button>
        </div>
      )}
      <div className="ps-sheet relative mx-auto max-w-[78ch]" data-guide-notes={guideKey}>
        <div ref={inkRef} data-ps-ink="" aria-hidden="true" />
        <textarea
          ref={taRef}
          data-ps-input=""
          aria-label="Your notes for this section. Type anywhere; Escape goes back to reading."
          defaultValue={initial}
          spellCheck
          autoCapitalize="sentences"
          autoCorrect="on"
          onInput={() => {
            repaint();
            schedule();
            setBlocked(null);
          }}
          onKeyDown={onKeyDown}
          onBlur={() => void flushRef.current()}
        />
      </div>
      <div className="mx-auto mt-2 flex max-w-[78ch] flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground" data-ps-chrome="">
        {busy ? (
          <span className="flex items-center gap-1.5">
            <Loader2 className="size-3 animate-spin" /> Saving…
          </span>
        ) : blocked ? (
          <span className="text-destructive">Not saved — {blocked}</span>
        ) : locked ? (
          <span className="flex items-center gap-2">
            <Lock className="size-3" />
            {locked.label} is locked so it can't be broken by typing.
            {locked.top && (
              <button type="button" className="underline underline-offset-2 hover:text-foreground" onClick={removeLocked}>
                Remove it
              </button>
            )}
            <button type="button" className="underline underline-offset-2 hover:text-foreground" onClick={() => setLocked(null)}>
              Keep it
            </button>
          </span>
        ) : (
          <span>Writing · saves itself · Esc to go back to reading</span>
        )}
      </div>
    </>
  );
});
