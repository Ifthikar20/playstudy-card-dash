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

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Loader2, Lock } from "lucide-react";
import { HEADING_COLORS, atomSignature, reanchor } from "@/lib/notes/units";
import { atomDelta, buildSheet, changedRange, guardDoc, type Sheet, type SheetAtom, type SheetRun } from "@/lib/notes/sheet";
import { type BlockItem, searchBlocks } from "@/lib/notes/blocks";
import { type Anchor, BlockEditor, type EditingBlock, SlashMenu } from "@/components/notes/BlockMenu";

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

/** Spend one permission from a ledger. False when it was never granted. */
const take = (ledger: string[], sig: string) => {
  const i = ledger.indexOf(sig);
  if (i < 0) return false;
  ledger.splice(i, 1);
  return true;
};

/* ------------------------------------------------------------------ *
 * The `/` menu's two measurements.
 * ------------------------------------------------------------------ */

/** What a command name may look like. A `/` followed by anything else is just a
 *  slash — "and/or", "24 / 7", a path — so the menu never opens on one. */
const NAME = /^[A-Za-z0-9]*(?: [A-Za-z0-9]+)*$/;

/**
 * The offset of the `/` that opened the menu, or -1.
 *
 * It has to start a word (document start, or whitespace before it) and
 * everything between it and the caret has to still read like a command name.
 * Those two conditions together are what stop ordinary prose summoning a menu.
 */
function slashStart(v: string, at: number): number {
  const min = Math.max(0, at - 40);
  for (let i = at - 1; i >= min; i--) {
    const c = v[i];
    if (c === "/") {
      if (i > 0 && !/\s/.test(v[i - 1])) return -1;
      return NAME.test(v.slice(i + 1, at)) ? i : -1;
    }
    if (!/[A-Za-z0-9 ]/.test(c)) return -1;
  }
  return -1;
}

/**
 * Where a character sits on screen.
 *
 * Measured on the PAINTED layer rather than the textarea, because the two are
 * one box, one font, one line-height and one measure — they agree character for
 * character by construction. That is the same guarantee the caret itself rides
 * on, so there is no second mirror here to keep in step.
 */
function caretRect(ink: HTMLElement, offset: number): Anchor {
  const walker = document.createTreeWalker(ink, NodeFilter.SHOW_TEXT);
  let seen = 0;
  for (let t = walker.nextNode(); t; t = walker.nextNode()) {
    const len = t.nodeValue?.length ?? 0;
    if (seen + len >= offset) {
      const r = document.createRange();
      r.setStart(t, offset - seen);
      r.collapse(true);
      const box = r.getBoundingClientRect();
      return { top: box.top, left: box.left, bottom: box.top + (box.height || 24) };
    }
    seen += len;
  }
  const box = ink.getBoundingClientRect();
  return { top: box.top, left: box.left, bottom: box.top + 24 };
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
  /* The copy currently being saved. `baseRef` cannot move until the request
     comes back, so for the whole of that await it is STALE — and the student
     keeps typing. Anything that diffs against "what the server has" has to use
     this while it is set, or it measures the change from the wrong side. */
  const sending = useRef<string | null>(null);
  /* Atom signatures the student has EXPLICITLY agreed to, one entry per block:
     `remove` for a block taken out, `add` for one a `/` command put in or the
     block panel rewrote. Nothing else may ever appear or disappear. It is a
     ledger rather than a remembered "intent" because an intent goes stale the
     moment they undo: the ledger only ever says what is PERMITTED, and `flush`
     still has to observe that exactly those atoms, and no others, moved. */
  const consent = useRef<{ remove: string[]; add: string[] }>({ remove: [], add: [] });
  /* Set only while the Remove command is applying its own edit, so the
     `beforeinput` refusal does not block the one deletion it has just proved. */
  const applying = useRef(false);

  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState<string | null>(null);
  const [locked, setLocked] = useState<SheetAtom | null>(null);
  const [conflict, setConflict] = useState(false);
  const [menu, setMenu] = useState<{ from: number; query: string; anchor: Anchor } | null>(null);
  const [active, setActive] = useState(0);
  const [editing, setEditing] = useState<EditingBlock | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  /* A `/` dismissed with Escape. The menu must not spring back on the next
     keystroke of the same word. */
  const dismissed = useRef(-1);
  const menuRef = useRef(menu);
  menuRef.current = menu;
  const items = useMemo(() => (menu ? searchBlocks(menu.query) : []), [menu]);

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
    const rm = [...consent.current.remove];
    const ad = [...consent.current.add];
    const authorised = gone.every((sig) => take(rm, sig)) && made.every((sig) => take(ad, sig));
    const g = authorised
      ? guardDoc(base, next, { removeAtoms: gone, addAtoms: made })
      : { ok: false, why: "that would change a pinned diagram, formula, table or code block" };
    if (!g.ok) {
      // The student's words are NEVER reverted. They stay on screen, unsaved,
      // with a reason — they may simply be mid-way through closing a <mark>.
      setBlocked(g.why ?? "That change wasn't saved.");
      return;
    }
    setBlocked(null);
    busyRef.current = true;
    sending.current = next;
    setBusy(true);
    try {
      const server = await onCommit(next);
      const adopted = typeof server === "string" ? server : next;
      baseRef.current = adopted;
      // The base now carries the change, so the permissions are spent.
      for (const sig of gone) take(consent.current.remove, sig);
      for (const sig of made) take(consent.current.add, sig);
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
      sending.current = null;
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
   * The `/` menu. Recomputed from the document alone — after every input and
   * every caret move — so it opens, filters and closes without any state of
   * its own to fall out of step with what is actually typed.
   * ---------------------------------------------------------------- */
  const syncMenu = useCallback(() => {
    const el = taRef.current;
    const ink = inkRef.current;
    if (!el || !ink || document.activeElement !== el) return;
    if (el.selectionStart !== el.selectionEnd) {
      setMenu(null);
      return;
    }
    const at = el.selectionStart ?? 0;
    const from = slashStart(el.value, at);
    if (from >= 0 && from !== dismissed.current) dismissed.current = -1;
    if (from < 0 || from === dismissed.current || hits(sheetRef.current.frozen, from, at)) {
      setMenu(null);
      return;
    }
    const query = el.value.slice(from + 1, at);
    // A `/` that no longer names anything is just a slash in a sentence.
    if (!searchBlocks(query).length) {
      setMenu(null);
      return;
    }
    const anchor = caretRect(ink, from);
    const prev = menuRef.current;
    if (!prev || prev.from !== from || prev.query !== query) setActive(0);
    if (prev && prev.from === from && prev.query === query && prev.anchor.top === anchor.top && prev.anchor.left === anchor.left)
      return;
    setMenu({ from, query, anchor });
  }, []);

  const syncRef = useRef(syncMenu);
  syncRef.current = syncMenu;

  /* The anchor is in viewport coordinates, so the page moving under an open
     menu has to re-measure it rather than leave it behind. */
  const menuOpen = !!menu;
  useEffect(() => {
    if (!menuOpen) return;
    const on = () => syncRef.current();
    window.addEventListener("scroll", on, true);
    window.addEventListener("resize", on);
    return () => {
      window.removeEventListener("scroll", on, true);
      window.removeEventListener("resize", on);
    };
  }, [menuOpen]);

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
      const sheet = sheetRef.current;
      const touched = sheet.frozen.filter(([fs, fe]) => s < fe && x > fs);
      if (!touched.length) return;
      // An edit that swallows a highlight WHOLE is allowed through: both tags
      // go together, so it can never be left half-open, and guardDoc still
      // proves nothing else moved. Refusing it meant a highlighted phrase could
      // be made but never deleted — you could not select across it either way.
      const soft = ([fs, fe]: [number, number]) => sheet.soft.some((r) => r[0] === fs && r[1] === fe);
      if (touched.every(([fs, fe]) => s <= fs && x >= fe && soft([fs, fe]))) return;
      const hit = touched[0];
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
          syncRef.current();
          return;
        }
        // Resting on either edge of one keeps the notice up, so the offer to
        // remove it does not vanish the moment the caret settles.
        show(atomIn(sheetRef.current, sheetRef.current.frozen.find(([fs, fe]) => at === fs || at === fe)));
      }
      lastCaret.current = at;
      syncRef.current();

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

  /* ---------------------------------------------------------------- *
   * Inserting a block from the `/` menu.
   *
   * The command writes literal Markdown from the catalogue and DECLARES the
   * atoms those bytes contain; `guardDoc` then proves the document gained
   * exactly those and that every byte outside the insertion is untouched. So a
   * fence that would swallow the paragraph below it, or a `---` that would turn
   * the line above into a heading, is refused BEFORE anything moves rather than
   * discovered in the saved notes afterwards.
   * ---------------------------------------------------------------- */
  const pickBlock = (item: BlockItem) => {
    const el = taRef.current;
    const m = menuRef.current;
    if (!el || !m) return;
    const v = el.value;
    const from = m.from;
    const to = from + 1 + m.query.length;

    let text = item.md;
    let caretIn = item.caret;
    if (!item.inline) {
      // Its own block, with a clear line on each side. The blank line is not
      // cosmetic: a table cannot interrupt a paragraph, and `---` under a line
      // of prose is a setext heading rather than a divider.
      const head = v.slice(0, from);
      const rest = v.slice(to);
      const before = !head ? "" : head.endsWith("\n\n") ? "" : head.endsWith("\n") ? "\n" : "\n\n";
      const after = rest.startsWith("\n\n") ? "" : rest.startsWith("\n") ? "\n" : "\n\n";
      text = before + item.md + after;
      caretIn = before.length + item.caret;
    }

    const next = v.slice(0, from) + text + v.slice(to);
    const addAtoms = atomSignature(text).parts;
    const g = guardDoc(v, next, { addAtoms });
    if (!g.ok) {
      setMenu(null);
      setBlocked(g.why ?? "That block doesn't fit here.");
      return;
    }
    consent.current.add.push(...addAtoms);
    setMenu(null);
    dismissed.current = -1;
    insert(text, from, to);

    if (item.atom) {
      // A locked block cannot be typed into, so the panel that CAN edit it
      // opens on it straight away and the caret parks safely after it.
      const end = from + text.length;
      el.setSelectionRange(end, end);
      lastCaret.current = end;
      const atom = sheetRef.current.atoms.find((a) => a.top && a.start >= from && a.end <= end);
      if (atom) openEditor(atom);
    } else {
      const p = from + caretIn;
      // A selected placeholder, where the item has one: the next thing typed
      // replaces it, which is the only way to land INSIDE a `<mark>` pair.
      el.setSelectionRange(p, p + (item.select ?? 0));
      lastCaret.current = p;
    }
  };

  const openEditor = (atom: SheetAtom) => {
    const el = taRef.current;
    if (!el) return;
    const original = el.value.slice(atom.start, atom.end);
    setEditError(null);
    setEditing({ start: atom.start, end: atom.end, label: atom.label, original, draft: original });
  };

  /* ---------------------------------------------------------------- *
   * Rewriting a locked block through the panel — the same discipline as the
   * Remove command. The change DECLARES which atoms leave and which arrive,
   * computed from the two snippets alone, and `guardDoc` proves the document
   * moved exactly that much. A fence edited into one that swallows the table
   * below it shows up as an extra atom in the delta, so it is refused.
   * ---------------------------------------------------------------- */
  const saveEdit = () => {
    const el = taRef.current;
    const ed = editing;
    if (!el || !ed) return;
    const v = el.value;
    if (v.slice(ed.start, ed.end) !== ed.original) {
      setEditError("These notes moved while the panel was open — cancel and open it again.");
      return;
    }
    if (ed.draft === ed.original) {
      setEditing(null);
      return;
    }
    const next = v.slice(0, ed.start) + ed.draft + v.slice(ed.end);
    const removeAtoms = atomSignature(ed.original).parts;
    const addAtoms = atomSignature(ed.draft).parts;
    const g = guardDoc(v, next, { removeAtoms, addAtoms });
    if (!g.ok) {
      setEditError(g.why ?? "That change couldn't be applied.");
      return;
    }
    consent.current.remove.push(...removeAtoms);
    consent.current.add.push(...addAtoms);
    // execCommand only acts on the focused element, and focus is in the panel.
    el.focus({ preventScroll: true });
    applying.current = true;
    try {
      el.setSelectionRange(ed.start, ed.end);
      if (!document.execCommand("insertText", false, ed.draft)) el.value = next;
    } finally {
      applying.current = false;
    }
    const p = ed.start + ed.draft.length;
    el.setSelectionRange(p, p);
    lastCaret.current = p;
    repaint();
    setEditing(null);
    setEditError(null);
    show(null);
    void flushRef.current();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget;
    const m = menuRef.current;
    if (m && items.length) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        setActive((a) => (Math.min(a, items.length - 1) + (e.key === "ArrowDown" ? 1 : items.length - 1)) % items.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        pickBlock(items[Math.min(active, items.length - 1)]);
        return;
      }
      if (e.key === "Escape") {
        // Dismiss the menu WITHOUT leaving the writing surface.
        e.preventDefault();
        e.stopPropagation();
        dismissed.current = m.from;
        setMenu(null);
        return;
      }
    }
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
    consent.current.remove.push(...gone);
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

  /* Another writer (pinVisual, the guide's notes_updated stream, revise, or a
     stale /api/app-data refetch landing after a save). */
  const external = useCallback(
    (md: string) => {
      const el = taRef.current;
      if (!el || md === baseRef.current) return;
      if (md === el.value || md === sending.current) {
        // Our OWN save, echoing back through the store. `saveNotes` updates the
        // store synchronously, so the parent re-renders with the new copy
        // BEFORE `flush` resumes from its await and moves the base forward.
        // This used to reach the branch below with a stale base and raise a
        // conflict against the student's own typing — either because nothing
        // had been typed since (`md === el.value`) or because they had typed
        // straight through the save and the region the stale base said had
        // changed no longer existed anywhere in the copy coming back.
        baseRef.current = md;
        if (md === el.value) liveValue.current = md;
        return;
      }
      if (el.value === baseRef.current) {
        const at = Math.min(lastCaret.current, md.length);
        baseRef.current = md;
        el.value = md;
        liveValue.current = md;
        el.setSelectionRange(at, at);
        repaint();
        // The menu's anchor was MEASURED against the text we have just
        // replaced, and the panel holds offsets into it. The menu simply goes;
        // the panel stays only where its block is still unambiguously here.
        setMenu(null);
        setEditing((b) => {
          if (!b) return b;
          const i = md.indexOf(b.original);
          return i >= 0 && i === md.lastIndexOf(b.original)
            ? { ...b, start: i, end: i + b.original.length }
            : null;
        });
        return;
      }
      // We have unsaved words, and the textarea is NOT rewritten below — so
      // every offset the panel holds stays valid whichever way this goes.
      //
      // Only rebase if the region we changed can still be found exactly once in
      // the new copy; otherwise show the conflict bar rather than clobbering
      // either side. A pure INSERTION replaces nothing, so the region is empty
      // and there is nothing to look for — which is why the anchor falls back
      // to the text leading up to the caret, and then to the text after it.
      // Without that fallback, plain typing (much the most common unsaved edit
      // there is) raised a conflict against every copy that came back.
      // Diff from what was SENT while a save is in flight; `baseRef` only
      // catches up when the request comes back.
      const base = sending.current ?? baseRef.current;
      const [s, e] = changedRange(base, el.value);
      const anchors =
        s === e
          ? [base.slice(Math.max(0, s - 48), s), base.slice(e, e + 48)]
          : [base.slice(s, e)];
      if (anchors.some((a) => a && reanchor(md, a))) baseRef.current = md;
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
            syncMenu();
            schedule();
            setBlocked(null);
          }}
          onKeyDown={onKeyDown}
          onBlur={() => void flushRef.current()}
        />
      </div>
      {menu && items.length > 0 && (
        <SlashMenu
          items={items}
          active={Math.min(active, items.length - 1)}
          anchor={menu.anchor}
          onPick={pickBlock}
          onActive={setActive}
        />
      )}
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
              <button
                type="button"
                className="underline underline-offset-2 hover:text-foreground"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => openEditor(locked)}
              >
                Edit it
              </button>
            )}
            {locked.top && (
              <button
                type="button"
                className="underline underline-offset-2 hover:text-foreground"
                onMouseDown={(e) => e.preventDefault()}
                onClick={removeLocked}
              >
                Remove it
              </button>
            )}
            <button
              type="button"
              className="underline underline-offset-2 hover:text-foreground"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setLocked(null)}
            >
              Keep it
            </button>
          </span>
        ) : (
          <span>Writing · type / to add a block · saves itself · Esc to go back to reading</span>
        )}
      </div>
      {editing && (
        <BlockEditor
          block={editing}
          error={editError}
          onDraft={(draft) => setEditing((b) => (b ? { ...b, draft } : b))}
          onSave={saveEdit}
          onCancel={() => {
            setEditing(null);
            setEditError(null);
            taRef.current?.focus({ preventScroll: true });
          }}
        />
      )}
    </>
  );
});
