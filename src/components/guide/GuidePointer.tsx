import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { GuideBot, type BotKind } from "./GuideBot";

/*
  The AI's pointer — a big pink cursor that lives inside the page (not the OS
  cursor, which a web page can't move).

  Movement is animated frame by frame so it feels like a hand, not a tween:
  every flight follows a slightly curved path with a random bend, its own
  easing (some settle gently, some overshoot and correct), a touch of tremor,
  and a short hesitation before it "clicks". Gestures vary — a click, a double
  click, a press-and-hold, or a loop around the target before landing — and
  while it talks it drifts almost imperceptibly instead of sitting frozen.

  What it points at gets a highlighter sweep (yellow / green / orange / blue,
  chosen by the caller) and the block gets a soft outline in the same hue.
  Positions are in the host element's coordinate space, so everything scrolls
  with the notes and stays glued to its target.
*/

export interface HostRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

type Pt = { x: number; y: number };

export type Gesture = "none" | "click" | "double" | "press" | "circle";
export type MarkColor = "yellow" | "green" | "orange" | "blue" | "pink";

export interface PointerHandle {
  /** Fly to a point (host coordinates) and perform `gesture` on arrival (default: click).
   *  `around` (the target's rect) is needed for the "circle" gesture. */
  moveTo(p: Pt, opts?: { gesture?: Gesture; around?: HostRect; duration?: number }): void;
  /** After the current flight and gesture, drift along a phrase to `to` over `ms`. */
  glide(to: Pt, ms: number): void;
  /** Highlighter marks over the quoted words. */
  underline(rects: HostRect[], color?: MarkColor): void;
  clearUnderline(): void;
  /** Outline the block currently being explained (null clears it). */
  focus(rect: HostRect | null, color?: MarkColor): void;
  /** Stop mid-flight and stay exactly where the pointer is right now. */
  freeze(): void;
}

type Segment =
  | { kind: "bezier"; from: Pt; ctrl: Pt; to: Pt; ms: number; ease: (t: number) => number; tremor: number }
  | { kind: "ellipse"; center: Pt; rx: number; ry: number; from: number; dir: 1 | -1; ms: number }
  | { kind: "line"; from?: Pt; to: Pt; ms: number; wobble: number }
  | { kind: "hold"; ms: number }
  | { kind: "do"; fn: () => void };

const EASE = {
  inOutCubic: (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  inOutQuart: (t: number) => (t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2),
  outQuint: (t: number) => 1 - Math.pow(1 - t, 5),
  outBack: (t: number) => {
    const c1 = 1.25;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); // overshoots ~10%, then settles
  },
  inOutSine: (t: number) => -(Math.cos(Math.PI * t) - 1) / 2,
};

const pickEase = () => {
  const r = Math.random();
  if (r < 0.45) return EASE.inOutCubic;
  if (r < 0.7) return EASE.outBack;
  if (r < 0.85) return EASE.inOutQuart;
  return EASE.outQuint;
};

const RGB: Record<MarkColor, string> = {
  yellow: "250, 204, 21",
  green: "132, 204, 22",
  orange: "249, 115, 22",
  blue: "56, 189, 248",
  pink: "236, 72, 153",
};

/** Whose voice is talking: the tutor's name and character, so it reads as a person teaching. */
export interface Speaker {
  name: string;
  kind: BotKind;
}

export const GuidePointer = forwardRef<
  PointerHandle,
  { host: HTMLElement; speaking: boolean; caption: string | null; speaker?: Speaker | null }
>(
  function GuidePointer({ host, speaking, caption, speaker }, ref) {
    const layerRef = useRef<HTMLDivElement>(null);
    const cursorRef = useRef<HTMLDivElement>(null);
    const pos = useRef<Pt>({ x: 0, y: 0 });
    const queue = useRef<Segment[]>([]);
    const segStart = useRef(0);
    const raf = useRef(0);
    const speakingRef = useRef(speaking);
    speakingRef.current = speaking;
    const pressRing = useRef<HTMLSpanElement | null>(null);
    const [shown, setShown] = useState(false);
    const [marks, setMarks] = useState<Array<HostRect & { color: MarkColor }>>([]);
    const [focusRect, setFocusRect] = useState<(HostRect & { color: MarkColor }) | null>(null);
    const [bubbleLeft, setBubbleLeft] = useState(false);

    // ---- click gestures ---------------------------------------------------------
    const ripple = (size = 18, delay = 0, ms = 800) => {
      const layer = layerRef.current;
      if (!layer) return;
      const r = document.createElement("span");
      r.className = "guide-ripple";
      r.style.left = `${pos.current.x}px`;
      r.style.top = `${pos.current.y}px`;
      r.style.width = `${size}px`;
      r.style.height = `${size}px`;
      r.style.animationDelay = `${delay}ms`;
      r.style.animationDuration = `${ms}ms`;
      layer.appendChild(r);
      window.setTimeout(() => r.remove(), ms + delay + 100);
    };
    const dip = () => {
      const el = cursorRef.current;
      if (!el) return;
      el.classList.remove("guide-clicking");
      void el.offsetWidth; // restart the animation
      el.classList.add("guide-clicking");
    };
    const click = () => {
      dip();
      ripple(18, 0);
      ripple(18, 140);
    };
    const pressStart = () => {
      const el = cursorRef.current;
      const layer = layerRef.current;
      if (!el || !layer) return;
      el.classList.add("guide-pressing");
      const ring = document.createElement("span");
      ring.className = "guide-press-ring";
      ring.style.left = `${pos.current.x}px`;
      ring.style.top = `${pos.current.y}px`;
      layer.appendChild(ring);
      pressRing.current = ring;
    };
    const cancelPress = () => {
      cursorRef.current?.classList.remove("guide-pressing");
      pressRing.current?.remove();
      pressRing.current = null;
    };
    const pressEnd = () => {
      cancelPress();
      ripple(30, 0, 950);
    };

    // ---- motion engine ----------------------------------------------------------
    const render = (now: number) => {
      const el = cursorRef.current;
      if (!el) return;
      let dx = 0;
      let dy = 0;
      if (!queue.current.length && speakingRef.current) {
        // Idle while talking: a barely-there drift, like a hand at rest.
        dx = Math.sin(now / 1300) * 1.4;
        dy = Math.cos(now / 1700) * 1.0;
      }
      el.style.transform = `translate(${pos.current.x + dx}px, ${pos.current.y + dy}px)`;
    };

    const tick = (now: number) => {
      const q = queue.current;
      if (q.length) {
        const seg = q[0];
        if (!segStart.current) {
          segStart.current = now;
          if (seg.kind === "line" && !seg.from) seg.from = { ...pos.current };
        }
        const t = seg.kind === "do" ? 1 : Math.min(1, (now - segStart.current) / seg.ms);
        switch (seg.kind) {
          case "bezier": {
            const e = seg.ease(t);
            const u = 1 - e;
            const x = u * u * seg.from.x + 2 * u * e * seg.ctrl.x + e * e * seg.to.x;
            const y = u * u * seg.from.y + 2 * u * e * seg.ctrl.y + e * e * seg.to.y;
            const nx = -(seg.to.y - seg.from.y);
            const ny = seg.to.x - seg.from.x;
            const len = Math.hypot(nx, ny) || 1;
            const tremor = seg.tremor * Math.sin(t * 43) * Math.sin(t * Math.PI); // fades in and out
            pos.current = { x: x + (nx / len) * tremor, y: y + (ny / len) * tremor };
            break;
          }
          case "ellipse": {
            const a = seg.from + seg.dir * 2 * Math.PI * EASE.inOutSine(t);
            pos.current = { x: seg.center.x + seg.rx * Math.cos(a), y: seg.center.y + seg.ry * Math.sin(a) };
            break;
          }
          case "line": {
            const from = seg.from!;
            const w = Math.sin(t * Math.PI * 6) * seg.wobble;
            pos.current = { x: from.x + (seg.to.x - from.x) * t, y: from.y + (seg.to.y - from.y) * t + w };
            break;
          }
          case "hold":
            break;
          case "do":
            seg.fn();
            break;
        }
        if (t >= 1) {
          q.shift();
          segStart.current = 0;
        }
      }
      render(now);
      if (q.length || speakingRef.current) raf.current = requestAnimationFrame(tick);
      else raf.current = 0;
    };
    const ensureLoop = () => {
      if (!raf.current) raf.current = requestAnimationFrame(tick);
    };

    useEffect(() => {
      ensureLoop();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [speaking]);
    useEffect(
      () => () => {
        // Reset the id too: effects re-run under hot reload / StrictMode, and a
        // stale non-zero id would make ensureLoop() think the loop is alive.
        if (raf.current) cancelAnimationFrame(raf.current);
        raf.current = 0;
      },
      [],
    );

    /** A curved flight from `a` to `b`: random bend to one side, own easing, slight tremor. */
    const flight = (a: Pt, b: Pt, ms: number, bend = 0.28): Segment => {
      const d = Math.hypot(b.x - a.x, b.y - a.y);
      const side = Math.random() < 0.5 ? -1 : 1;
      const curve = Math.min(d * bend, 170) * side * (0.6 + Math.random() * 0.8);
      const mx = (a.x + b.x) / 2 + (Math.random() - 0.5) * d * 0.18;
      const my = (a.y + b.y) / 2 + (Math.random() - 0.5) * d * 0.18;
      const nx = -(b.y - a.y) / (d || 1);
      const ny = (b.x - a.x) / (d || 1);
      return {
        kind: "bezier",
        from: a,
        ctrl: { x: mx + nx * curve, y: my + ny * curve },
        to: b,
        ms,
        ease: pickEase(),
        tremor: Math.min(1.2, d / 400),
      };
    };

    useImperativeHandle(ref, () => ({
      moveTo(p, opts = {}) {
        const from = { ...pos.current };
        const q: Segment[] = [];
        const dist = Math.hypot(p.x - from.x, p.y - from.y);
        const pace = 0.85 + Math.random() * 0.3;
        const ms = opts.duration ?? Math.min(1700, Math.max(480, (430 + dist * 0.8) * pace));
        const gesture = opts.gesture ?? "click";
        if (gesture === "circle" && opts.around) {
          // Loop once around the target, then land on it.
          const r = opts.around;
          const center = { x: r.x + r.w / 2, y: r.y + r.h / 2 };
          const rx = r.w / 2 + 16;
          const ry = r.h / 2 + 12;
          const dir: 1 | -1 = Math.random() < 0.5 ? 1 : -1;
          const start = Math.atan2((from.y - center.y) / ry, (from.x - center.x) / rx);
          const entry = { x: center.x + rx * Math.cos(start), y: center.y + ry * Math.sin(start) };
          q.push(flight(from, entry, ms * 0.7));
          q.push({ kind: "ellipse", center, rx, ry, from: start, dir, ms: 650 + Math.min(600, rx + ry) });
          q.push(flight(entry, p, 380, 0.12));
        } else {
          q.push(flight(from, p, ms));
        }
        if (gesture !== "none") q.push({ kind: "hold", ms: 60 + Math.random() * 110 }); // a beat before acting
        if (gesture === "click" || gesture === "circle") q.push({ kind: "do", fn: click });
        else if (gesture === "double") q.push({ kind: "do", fn: click }, { kind: "hold", ms: 140 }, { kind: "do", fn: click });
        else if (gesture === "press") q.push({ kind: "do", fn: pressStart }, { kind: "hold", ms: 480 }, { kind: "do", fn: pressEnd });
        cancelPress(); // never leave a previous press hanging
        queue.current = q;
        segStart.current = 0;
        setShown(true);
        setBubbleLeft(p.x > host.clientWidth - 400);
        ensureLoop();
      },
      glide(to, ms) {
        queue.current.push({ kind: "hold", ms: 350 }, { kind: "line", to, ms, wobble: 0.8 });
        ensureLoop();
      },
      underline(rects, color = "yellow") {
        setMarks(rects.map((r) => ({ ...r, color })));
      },
      clearUnderline() {
        setMarks([]);
      },
      focus(rect, color = "pink") {
        setFocusRect(rect ? { ...rect, color } : null);
      },
      freeze() {
        queue.current = [];
        segStart.current = 0;
        cancelPress();
        render(performance.now());
      },
    }));

    return createPortal(
      <div ref={layerRef} aria-hidden className="pointer-events-none absolute inset-0 z-40">
        {focusRect && (
          <span
            className="guide-focus"
            style={{
              left: focusRect.x - 8,
              top: focusRect.y - 6,
              width: focusRect.w + 16,
              height: focusRect.h + 12,
              borderColor: `rgba(${RGB[focusRect.color]}, 0.5)`,
              background: `rgba(${RGB[focusRect.color]}, 0.05)`,
              boxShadow: `0 0 0 5px rgba(${RGB[focusRect.color]}, 0.07)`,
            }}
          />
        )}
        {marks.map((m, i) => (
          <span
            key={`${m.x}-${m.y}-${i}`}
            className={cn("guide-mark", `guide-mark-${m.color}`)}
            style={{ left: m.x - 3, top: m.y - 1, width: m.w + 7, height: m.h + 3, animationDelay: `${i * 130}ms` }}
          />
        ))}
        <div
          ref={cursorRef}
          className={cn("guide-cursor absolute left-0 top-0 will-change-transform", shown ? "opacity-100" : "opacity-0")}
          style={{ transform: "translate(0px, 0px)" }}
        >
          <svg width="30" height="36" viewBox="0 0 30 36" className="guide-cursor-svg">
            <path
              d="M3 2 L3 27 L9.5 21.2 L14.2 32 L18.6 30.1 L14 19.6 L22.5 19.6 Z"
              fill="#ec4899"
              stroke="#ffffff"
              strokeWidth="2"
              strokeLinejoin="round"
            />
          </svg>
          {caption ? (
            <div key={caption} className={cn("guide-bubble", bubbleLeft && "guide-bubble-left")}>
              <div className="guide-bubble-head">
                {speaker ? (
                  <>
                    <GuideBot kind={speaker.kind} variant="head" size={22} mood={speaking ? "talking" : "idle"} />
                    {speaker.name}
                    <span className="guide-bubble-role">· AnotherNotes AI</span>
                  </>
                ) : (
                  "AnotherNotes AI"
                )}
                {speaking && (
                  <span className="guide-eq guide-eq-pink">
                    <i />
                    <i />
                    <i />
                  </span>
                )}
              </div>
              {caption}
            </div>
          ) : (
            <div className={cn("guide-chip", speaker && "guide-chip-speaker")}>
              {speaker ? (
                <>
                  <GuideBot kind={speaker.kind} variant="head" size={18} mood={speaking ? "talking" : "idle"} />
                  {speaker.name}
                </>
              ) : (
                "AnotherNotes AI"
              )}
              {speaking && (
                <span className="guide-eq">
                  <i />
                  <i />
                  <i />
                </span>
              )}
            </div>
          )}
        </div>
      </div>,
      host,
    );
  },
);
