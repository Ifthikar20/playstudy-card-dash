import { useEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { useAvatar } from "@/lib/guide/avatars";
import { tutorCursor } from "@/lib/guide/cursor";
import type { BotKind } from "./GuideBot";

/*
  The tutor's pointer as the student's own, while no lesson is running.

  On Full Study the mouse cursor IS the tutor's pointer: a CSS cursor image (lib/guide/
  cursor.ts) set on the page, which the browser draws over everything - a PDF's canvas, the
  board, a dialog - so it is never covered and never gone. Controls keep their own cursor
  (index.css), so a button still looks like a button. All this component adds on top is the
  one-time hint that rides beside the cursor, in a fixed layer above the page. A touch
  screen has no pointer to dress, and gets nothing.
*/
const HINT_KEY = "an-tutor-pointer-hint";
const HINT = "Click any line and I'll explain it · double-click to edit · right-click to highlight";

export function IdlePointer({ host, hidden, kind }: { host: RefObject<HTMLElement>; hidden: boolean; kind: BotKind }) {
  const avatar = useAvatar(kind);
  const [at, setAt] = useState<{ x: number; y: number } | null>(null);
  const [hint, setHint] = useState<boolean>(() => {
    try {
      return !window.localStorage.getItem(HINT_KEY);
    } catch {
      return true;
    }
  });
  const coarse = typeof window !== "undefined" && !!window.matchMedia?.("(hover: none)").matches;
  const cursor = useRef("");

  // The cursor itself: on the page while the pointer is the tutor's, off otherwise.
  useEffect(() => {
    const h = host.current;
    if (!h) return;
    if (hidden || coarse) {
      h.style.removeProperty("--tutor-cursor");
      return;
    }
    cursor.current = tutorCursor(avatar.id, kind, avatar.palette.base);
    h.style.setProperty("--tutor-cursor", cursor.current);
    return () => {
      h.style.removeProperty("--tutor-cursor");
    };
  }, [host, hidden, coarse, avatar.id, avatar.palette.base, kind]);

  // The hint follows the mouse while it is over something the tutor's cursor is on.
  useEffect(() => {
    const h = host.current;
    if (!h || hidden || coarse || !hint) return;
    const onMove = (e: PointerEvent) => {
      const t = e.target;
      const own = t instanceof Element && h.contains(t) && getComputedStyle(t).cursor.startsWith("url(");
      setAt(own ? { x: e.clientX, y: e.clientY } : null);
    };
    const seen = () => {
      setHint(false);
      setAt(null);
      try {
        window.localStorage.setItem(HINT_KEY, "1");
      } catch {
        /* a private window: the hint just shows again next time */
      }
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    h.addEventListener("pointerleave", () => setAt(null));
    document.addEventListener("pointerdown", seen, { once: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerdown", seen);
    };
  }, [host, hidden, coarse, hint]);

  if (!hint || !at || hidden || coarse) return null;
  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-[9999]" aria-hidden>
      <div className="tutor-hint" style={{ transform: `translate(${at.x + 24}px, ${at.y + 28}px)` }}>
        {HINT}
      </div>
    </div>,
    document.body,
  );
}
