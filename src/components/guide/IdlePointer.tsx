import { useEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { accentVars, useAvatar } from "@/lib/guide/avatars";
import type { BotKind } from "./GuideBot";
import { AvatarArrow, GuideAvatar } from "./GuideAvatar";

/*
  The tutor's pointer as the student's own, while no lesson is running.

  On Full Study the page hides the system cursor (.tutor-pointer in index.css) and this
  rides under the mouse instead, so the pointer itself says "point at anything, click,
  and I'll explain it". Over a control the page's CSS gives the system cursor back (a
  button still looks like a button) and this steps aside; it also steps aside for a
  touch screen, which has no pointer to ride under. Once a lesson runs, TeachMode's own
  pointer takes over and this is hidden.
*/
const HINT_KEY = "an-tutor-pointer-hint";
const HINT = "Click any line and I'll explain it · double-click to edit · right-click to highlight";

export function IdlePointer({ host, hidden, kind }: { host: RefObject<HTMLElement>; hidden: boolean; kind: BotKind }) {
  const avatar = useAvatar(kind);
  const el = useRef<HTMLDivElement>(null);
  const [over, setOver] = useState(false);
  const [, mounted] = useState(0);
  const [hint, setHint] = useState<boolean>(() => {
    try {
      return !window.localStorage.getItem(HINT_KEY);
    } catch {
      return true;
    }
  });
  const coarse = typeof window !== "undefined" && !!window.matchMedia?.("(hover: none)").matches;

  // The host ref is filled after the first render: render again once it is.
  useEffect(() => mounted(1), []);

  useEffect(() => {
    const h = host.current;
    if (!h || hidden || coarse) return;
    let raf = 0;
    let last: { x: number; y: number } | null = null;
    const paint = () => {
      raf = 0;
      if (!last || !el.current) return;
      const r = h.getBoundingClientRect();
      el.current.style.transform = `translate(${last.x - r.left}px, ${last.y - r.top}px)`;
    };
    const onMove = (e: PointerEvent) => {
      const t = e.target;
      // The system cursor is showing here (a button, a link, a field): step aside.
      const own = t instanceof Element && h.contains(t) && getComputedStyle(t).cursor === "none";
      setOver(own);
      if (!own) return;
      last = { x: e.clientX, y: e.clientY };
      if (!raf) raf = requestAnimationFrame(paint);
    };
    const onLeave = () => setOver(false);
    const seen = () => {
      setHint(false);
      try {
        window.localStorage.setItem(HINT_KEY, "1");
      } catch {
        /* a private window: the hint just shows again next time */
      }
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    h.addEventListener("pointerleave", onLeave);
    document.addEventListener("pointerdown", seen, { once: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      h.removeEventListener("pointerleave", onLeave);
      document.removeEventListener("pointerdown", seen);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [host, hidden, coarse]);

  if (!host.current || hidden || coarse) return null;
  return createPortal(
    <div className="pointer-events-none absolute inset-0 z-[70]" data-guide-layer="" aria-hidden style={accentVars(avatar.palette)}>
      <div
        ref={el}
        className={cn("guide-cursor absolute left-0 top-0 will-change-transform transition-opacity duration-150", over ? "opacity-100" : "opacity-0")}
        style={{ transform: "translate(-100px, -100px)" }}
      >
        <AvatarArrow color={avatar.palette.base} />
        <GuideAvatar className="guide-cursor-avatar" avatar={avatar.id} kind={kind} size={34} mood="idle" />
        {hint && over && <div className="tutor-hint">{HINT}</div>}
      </div>
    </div>,
    host.current,
  );
}
