import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { isTypingTarget } from "@/lib/useTalkKey";

/*
  Keys for a quiz: number keys pick (1-4 an option, 1-3 a group to sort into, 1-n the
  match for a pair), T and F answer true or false, Enter checks the answer or moves
  on once it's answered. Each kind of question says what its keys do (see QuizRunner
  and the question kinds in components/quiz); the keys that only mean something on a
  focused row (the arrows, Space and Esc when putting items in order, Backspace on a
  placed item) are that row's own and never come through here.

  Only where the quiz is the thing being worked on: Teach mode's board
  (.guide-board-panel) and the page's study dialogs ([data-study-dialog]). Both are
  already left alone by Teach mode's keys and the talk key, so a number or Enter there
  is the quiz's. Anywhere else (a quiz sitting in a page) the page keeps
  its keys: nothing is listened for at all.

  A key typed into a field is text, never an answer (a fill-in-the-blank box sends its
  own Enter). Enter is the quiz's only when it comes from the quiz itself or from
  nowhere in particular (the button just used went away); Enter on any other button
  (the dialog's close, "Next section") is that button's, and so is Enter on one of the
  quiz's own side buttons ([data-quiz-own-keys]: "Ask about this", read aloud).
*/

/** Where a quiz's number keys work. */
const KEY_HOSTS = ".guide-board-panel, [data-study-dialog]";

/** Things with keys of their own: a key pressed inside one of them (that isn't our host) is theirs. */
const OTHER_OWNERS = '[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"], .guide-board-panel, [data-study-dialog]';

/** An option's name: its number where the number keys pick it, else a letter. */
export const optionLabel = (option: number, numbered: boolean): string =>
  numbered ? String(option + 1) : String.fromCharCode(65 + option);

/** A button inside a quiz that keeps its own Enter (and Space): not an answer, nor Check. */
export const OWN_KEYS = "[data-quiz-own-keys]";

/**
 * What a quiz does with a key; each returns true when it used the key up. Any may be
 * left out. One quiz can listen in more than one place (the question for its picks and
 * Check, the quiz around it for Next): the first to use a key up has it, and the others
 * see it's taken (defaultPrevented) and leave it.
 */
export interface QuizKeyHandlers {
  /** A number key, 1-9 (the number itself, not an index). */
  digit?: (n: number) => boolean;
  /** A letter key pressed on its own (no Shift either), lower case: true/false's t and f. */
  letter?: (ch: string) => boolean;
  /** Enter: check the answer, or move on (next question, or finish). */
  enter?: () => boolean;
  /** The first shape, for a quiz not moved to QuizRunner yet: `pick(n - 1)` for a digit. */
  pick?: (option: number) => boolean;
  /** The first shape's Enter. */
  next?: () => boolean;
}

/**
 * Wire a quiz's keys. Put `ref` on the quiz's outermost element, with tabIndex={-1} so
 * focus can be brought into it. `live` says whether the keys are on (the quiz sits on
 * the board or in a study dialog), which is also when its options are numbered rather
 * than lettered, so the label is the key.
 */
export function useQuizKeys(handlers: QuizKeyHandlers): { ref: (el: HTMLElement | null) => void; live: boolean } {
  const [root, setRoot] = useState<HTMLElement | null>(null);
  const ref = useCallback((el: HTMLElement | null) => setRoot(el), []);
  const host = useMemo(() => root?.closest(KEY_HOSTS) ?? null, [root]);
  // The latest handlers, so the listener is bound once and still sees this render's state.
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!root || !host) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.repeat || e.isComposing || e.altKey || e.ctrlKey || e.metaKey) return;
      // A board folded away (or a dialog closing) keeps the quiz mounted for a moment:
      // it only answers keys while it can be seen.
      if (!root.isConnected || root.getClientRects().length === 0) return;
      // Behind a modal: the page's Quiz dialog opened over a quiz on Teach mode's board,
      // say. The dialog hides everything else from screen readers (aria-hidden), and its
      // keys are its own even with focus nowhere in particular (an answer just clicked
      // disables its button and focus drops to the body): the quiz behind must not take
      // them, or a "1" meant for the dialog would answer (and score) the board's question.
      if (root.closest('[aria-hidden="true"]')) return;
      const target = e.target instanceof Element ? e.target : null;
      if (isTypingTarget(target)) return;
      const loose = !target || target === document.body || target === document.documentElement;
      if (!loose && !host.contains(target) && target.closest(OTHER_OWNERS)) return;

      const h = handlersRef.current;
      if (e.key === "Enter") {
        if (!loose && target !== host && !root.contains(target)) return;
        if (target?.closest(OWN_KEYS)) return;
        // preventDefault also stops Enter clicking the focused button, which would move on twice.
        const used = h.enter ? h.enter() : h.next ? h.next() : false;
        if (used) e.preventDefault();
        return;
      }
      let used = false;
      if (/^[1-9]$/.test(e.key)) {
        const n = Number(e.key);
        used = h.digit ? h.digit(n) : h.pick ? h.pick(n - 1) : false;
      } else if (/^[a-z]$/i.test(e.key) && !e.shiftKey && h.letter) {
        used = h.letter(e.key.toLowerCase());
      }
      if (!used) return;
      e.preventDefault();
      // Answered from the keyboard with focus elsewhere (a "Skip section" just used):
      // bring it into the quiz, so the Enter that follows moves on here and doesn't
      // press that button again.
      if (!root.contains(document.activeElement)) root.focus({ preventScroll: true });
    };
    // On the document, so it runs before the window listeners (Teach mode's keys, the
    // talk key), which skip a key already used up here.
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [root, host]);

  return { ref, live: !!host };
}
