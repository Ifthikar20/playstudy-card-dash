import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { accentVars, useAvatar } from "@/lib/guide/avatars";
import type { BotKind } from "./GuideBot";
import { AvatarArrow, GuideAvatar } from "./GuideAvatar";

/*
  The AI's pointer — an arrow with the tutor's avatar riding beside it, living
  inside the page (not the OS cursor, which a web page can't move). Arrow,
  avatar, ripples, the speech bubble and the outline round the block all take
  the avatar's colour, so each voice points in its own colour (lib/guide/avatars).

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

  On the whiteboard it can point at one exact part (a colour band, side c): the
  tip holds still on it, the avatar tucks out of the way, a tight ring goes round
  the part, and the speech bubble moves off the board so it never covers it.
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
   *  `around` (the target's rect) is needed for the "circle" gesture.
   *  `precise`: the tip is on one exact part (a colour band, side c), so the idle drift
   *  stops and the avatar tucks further out of the way, smaller, until the next move.
   *  `keepClear`: rects the speech bubble must not cover (the board, the part); it takes
   *  the first spot left of, above or below them that covers none. */
  moveTo(
    p: Pt,
    opts?: { gesture?: Gesture; around?: HostRect; duration?: number; precise?: boolean; keepClear?: HostRect[] },
  ): void;
  /** After the current flight and gesture, drift along a phrase to `to` over `ms`. */
  glide(to: Pt, ms: number): void;
  /** Highlighter marks over the quoted words. `color` is for all of them; a rect that
   *  carries its own colour keeps it (the note review marks every open question in one
   *  hue and the one being asked about in another). */
  underline(rects: Array<HostRect & { color?: MarkColor }>, color?: MarkColor): void;
  clearUnderline(): void;
  /** Outline the block currently being explained (null clears it). `above` draws it over
   *  the whiteboard, for something on the board itself (a picture, a formula). `pad` and
   *  `radius` fit it closer; `ring` makes it the tight, solid ring round one exact part. */
  focus(rect: HostRect | null, color?: MarkColor, opts?: { above?: boolean; pad?: number; radius?: number; ring?: boolean }): void;
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

/** "pink" is the pointer's default outline, so it means the tutor's colour. */
const focusRgb = (color: MarkColor) => (color === "pink" ? "var(--guide-accent)" : RGB[color]);

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
    const kind: BotKind = speaker?.kind ?? "neutral";
    const avatar = useAvatar(kind);
    const [focusRect, setFocusRect] = useState<
      (HostRect & { color: MarkColor; above?: boolean; pad?: number; radius?: number; ring?: boolean }) | null
    >(null);
    const [bubbleLeft, setBubbleLeft] = useState(false);
    // Pointing at one exact part: no drift, and the avatar out of the way (see moveTo).
    const [precise, setPrecise] = useState(false);
    const preciseRef = useRef(false);
    // What the speech bubble must stay off (the board, the part), from the last moveTo,
    // and where that put it: an offset from the tip, or null for the usual spot beside it.
    const clearRef = useRef<{ p: Pt; rects: HostRect[] } | null>(null);
    const bubbleRef = useRef<HTMLDivElement | null>(null);
    const [bubbleAt, setBubbleAt] = useState<{ left: number; top: number } | null>(null);

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
      if (!queue.current.length && speakingRef.current && !preciseRef.current) {
        // Idle while talking: a barely-there drift, like a hand at rest. Not while it's
        // on one exact part: a band a few pixels wide can't have the tip wander off it.
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

    /**
     * Put the speech bubble where it covers neither the board nor the part being
     * pointed at: left of them, above, below, then right, taking the first spot that's
     * clear and on screen. Failing that, anywhere that at least leaves the part itself
     * visible; failing that, the usual spot beside the pointer. Worked out for where the
     * pointer is going, from the bubble's real size, so it's re-run when the words change.
     */
    const placeBubble = () => {
      const c = clearRef.current;
      if (!c || !c.rects.length) {
        setBubbleAt(null);
        return;
      }
      const el = bubbleRef.current;
      const w = el?.offsetWidth || 300;
      const h = el?.offsetHeight || 72;
      const hr = host.getBoundingClientRect();
      // the visible part of the page, in host coordinates
      const view = { x: -hr.left + 8, y: -hr.top + 8, w: window.innerWidth - 16, h: window.innerHeight - 16 };
      const gap = 14;
      const overlaps = (a: HostRect, b: HostRect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
      const onScreen = (b: HostRect) => b.x >= view.x && b.y >= view.y && b.x + b.w <= view.x + view.w && b.y + b.h <= view.y + view.h;
      const clampY = (y: number) => Math.max(view.y, Math.min(y, view.y + view.h - h));
      const clampX = (x: number) => Math.max(view.x, Math.min(x, view.x + view.w - w));
      const around = (r: HostRect): HostRect[] => [
        { x: r.x - gap - w, y: clampY(c.p.y - 24), w, h },
        { x: clampX(c.p.x - w / 2), y: r.y - gap - h, w, h },
        { x: clampX(c.p.x - w / 2), y: r.y + r.h + gap, w, h },
        { x: r.x + r.w + gap, y: clampY(c.p.y - 24), w, h },
      ];
      const all = c.rects.reduce((u, r) => {
        const x = Math.min(u.x, r.x);
        const y = Math.min(u.y, r.y);
        return { x, y, w: Math.max(u.x + u.w, r.x + r.w) - x, h: Math.max(u.y + u.h, r.y + r.h) - y };
      });
      const part = c.rects[c.rects.length - 1];
      const spot =
        around(all).find((b) => onScreen(b) && !c.rects.some((r) => overlaps(b, r))) ??
        around(part).find((b) => onScreen(b) && !overlaps(b, part)) ??
        null;
      setBubbleAt((prev) => {
        const next = spot ? { left: Math.round(spot.x - c.p.x), top: Math.round(spot.y - c.p.y) } : null;
        return prev && next && prev.left === next.left && prev.top === next.top ? prev : next;
      });
    };
    // A new sentence is a new size of bubble.
    useLayoutEffect(() => {
      if (clearRef.current) placeBubble();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [caption]);

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
        preciseRef.current = !!opts.precise;
        setPrecise(!!opts.precise);
        clearRef.current = opts.keepClear?.length ? { p, rects: opts.keepClear } : null;
        placeBubble();
        ensureLoop();
      },
      glide(to, ms) {
        queue.current.push({ kind: "hold", ms: 350 }, { kind: "line", to, ms, wobble: 0.8 });
        ensureLoop();
      },
      underline(rects, color = "yellow") {
        const next = rects.map((r) => ({ x: r.x, y: r.y, w: r.w, h: r.h, color: r.color ?? color }));
        // Callers that re-place on every resize send the same marks again and again;
        // keeping the old array means no re-render and no replayed highlighter sweep.
        setMarks((prev) =>
          prev.length === next.length &&
          prev.every((m, i) => m.x === next[i].x && m.y === next[i].y && m.w === next[i].w && m.h === next[i].h && m.color === next[i].color)
            ? prev
            : next,
        );
      },
      clearUnderline() {
        setMarks([]);
      },
      focus(rect, color = "pink", opts) {
        setFocusRect(
          rect ? { ...rect, color, above: !!opts?.above, pad: opts?.pad, radius: opts?.radius, ring: !!opts?.ring } : null,
        );
      },
      freeze() {
        queue.current = [];
        segStart.current = 0;
        cancelPress();
        render(performance.now());
      },
    }));

    const padX = focusRect?.pad ?? 8;
    const padY = focusRect?.pad ?? 6;
    const outline = focusRect && (
      <span
        className={cn("guide-focus", focusRect.ring && "guide-focus-part")}
        style={{
          left: focusRect.x - padX,
          top: focusRect.y - padY,
          width: focusRect.w + padX * 2,
          height: focusRect.h + padY * 2,
          borderRadius: focusRect.radius,
          // The default outline is the tutor's own colour; a caller's highlighter hue wins.
          // A ring round one part is solid, with a thin white halo so it shows on any photo.
          borderColor: focusRect.ring ? `rgb(${focusRgb(focusRect.color)})` : `rgba(${focusRgb(focusRect.color)}, 0.5)`,
          background: focusRect.above ? "transparent" : `rgba(${focusRgb(focusRect.color)}, 0.05)`,
          boxShadow: focusRect.ring
            ? `0 0 0 2px rgba(255, 255, 255, 0.9), 0 0 0 5px rgba(${focusRgb(focusRect.color)}, 0.22)`
            : `0 0 0 5px rgba(${focusRgb(focusRect.color)}, 0.07)`,
        }}
      />
    );
    // Off the board and the part (placeBubble), else beside the pointer as usual.
    const bubbleStyle = bubbleAt ? { left: bubbleAt.left, top: bubbleAt.top, right: "auto" } : undefined;
    return createPortal(
      // data-guide-layer marks this as an overlay, so code watching the page for real
      // changes (the note review's MutationObserver) can ignore the pointer's own ripples.
      <div aria-hidden data-guide-layer="" className="pointer-events-none absolute inset-0" style={accentVars(avatar.palette)}>
        {/* Highlights and outlines belong to the page, so they stay under the
            whiteboard (z 60) where it overlaps the notes. No z-index here on purpose:
            a z-index makes this layer its own stacking context, and then the marks'
            mix-blend-mode (multiply, like a real highlighter) can only blend with
            this empty layer, so the yellow painted over the words and washed them
            out. Without one the marks tint the page under them and the text stays dark,
            and a positioned layer with no z-index still paints below the board's 60. */}
        <div className="absolute inset-0">
          {!focusRect?.above && outline}
          {marks.map((m, i) => (
            <span
              key={`${m.x}-${m.y}-${m.color}-${i}`}
              className={cn("guide-mark", `guide-mark-${m.color}`)}
              style={{ left: m.x - 3, top: m.y - 1, width: m.w + 7, height: m.h + 3, animationDelay: `${i * 130}ms` }}
            />
          ))}
        </div>
        {/* The pointer, its clicks and its speech bubble ride above the whiteboard, so it
            can go to a picture or a formula on the board and point at it. (Under one
            z-40 layer it used to slide behind the board and vanish.) */}
        <div ref={layerRef} className="absolute inset-0 z-[70]">
          {focusRect?.above && outline}
          <div
            ref={cursorRef}
            className={cn(
              "guide-cursor absolute left-0 top-0 will-change-transform",
              shown ? "opacity-100" : "opacity-0",
              precise && "guide-cursor-precise",
            )}
            style={{ transform: "translate(0px, 0px)" }}
          >
            <AvatarArrow color={avatar.palette.base} />
            <GuideAvatar
              className="guide-cursor-avatar"
              avatar={avatar.id}
              kind={kind}
              size={34}
              mood={speaking ? "talking" : "idle"}
            />
            {caption ? (
              <div
                key={caption}
                ref={bubbleRef}
                className={cn("guide-bubble", bubbleAt ? "guide-bubble-free" : bubbleLeft && "guide-bubble-left")}
                style={bubbleStyle}
              >
                <div className="guide-bubble-head">
                  {speaker ? (
                    speaker.name
                  ) : (
                    // The voice list hasn't arrived yet, so there's no name to show.
                    "Tutor"
                  )}
                  {speaking && (
                    <span className="guide-eq guide-eq-pink">
                      <i />
                      <i />
                      <i />
                    </span>
                  )}
                </div>
                {/* dir="auto": an Arabic or Hebrew line reads right to left, an English one left to right */}
                <div dir="auto">{caption}</div>
              </div>
            ) : (
              <div ref={bubbleRef} className={cn("guide-chip", speaker && "guide-chip-speaker")} style={bubbleStyle}>
                {speaker ? (
                  speaker.name
                ) : (
                  "Tutor"
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
        </div>
      </div>,
      host,
    );
  },
);
