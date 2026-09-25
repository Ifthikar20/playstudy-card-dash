import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";

/*
  Dragging for the quiz kinds that move things about, with no library: putting items
  in order (useDragList) and sorting items into groups (useDropDrag).

  Dragging is only ever the quick way. Everything can be done by tapping (the ↑/↓ on
  a row, a chip then a group) and from the keyboard, so these only add to that:

  - Only a handle starts a drag (an order row's grip; a chip, with a mouse or pen),
    and it takes 8px of movement to count, so a tap is still a tap and the rest of
    the board still scrolls under a finger (touch-action: none is on the grip alone).
  - The pointer is captured, so a drag that strays off the row keeps going.
  - Near the top or bottom edge of whatever scrolls (the board's body, a dialog) it
    scrolls, so a long list can be dragged past what fits.
  - The click that ends a drag is not a press: consumeDrag() says so, once.
*/

/** How far the pointer must move before a press becomes a drag. */
const THRESHOLD = 8;
/** How close to a scrolling edge the pointer must be for it to scroll, and the fastest step. */
const EDGE = 40;
const MAX_STEP = 14;

/** The nearest ancestor that scrolls up and down. */
function scrollerOf(el: HTMLElement | null): HTMLElement | null {
  for (let p = el?.parentElement ?? null; p; p = p.parentElement) {
    const oy = getComputedStyle(p).overflowY;
    if ((oy === "auto" || oy === "scroll") && p.scrollHeight > p.clientHeight) return p;
  }
  return null;
}

/** Scroll `scroller` a little when `y` is near its edge. True when it moved. */
function edgeScroll(scroller: HTMLElement | null, y: number): boolean {
  if (!scroller) return false;
  const r = scroller.getBoundingClientRect();
  const up = r.top + EDGE - y;
  const down = y - (r.bottom - EDGE);
  const before = scroller.scrollTop;
  if (up > 0) scroller.scrollTop -= Math.ceil((Math.min(up, EDGE) / EDGE) * MAX_STEP);
  else if (down > 0) scroller.scrollTop += Math.ceil((Math.min(down, EDGE) / EDGE) * MAX_STEP);
  return scroller.scrollTop !== before;
}

// ---- putting a list in order --------------------------------------------------------------

interface Row {
  top: number;
  height: number;
}

interface ListPress {
  pointerId: number;
  from: number;
  /** The pointer's height within the list when pressed. */
  startY: number;
  lastY: number;
  rows: Row[];
  gap: number;
  /** Where the row would land now. */
  to: number;
  active: boolean;
  scroller: HTMLElement | null;
}

export interface ListDrag {
  from: number;
  to: number;
  /** How far the dragged row has moved from its place, in px. */
  dy: number;
  /** How far each row it passes moves aside: its height and the gap. */
  room: number;
}

/**
 * Drag rows of a list into a new order. Mark each row [data-drag-row] inside the element
 * `listRef` is on, spread `grip(i)` on each row's handle, and give each row `rowStyle(i)`.
 * `onMove(from, to)` is called once, on the drop.
 */
export function useDragList({ onMove, disabled = false }: { onMove: (from: number, to: number) => void; disabled?: boolean }) {
  const list = useRef<HTMLElement | null>(null);
  const press = useRef<ListPress | null>(null);
  const [drag, setDrag] = useState<ListDrag | null>(null);
  const dragged = useRef(false);
  const frame = useRef(0);
  const onMoveRef = useRef(onMove);
  onMoveRef.current = onMove;

  const listRef = useCallback((el: HTMLElement | null) => {
    list.current = el;
  }, []);

  /** Where the row would land with the pointer at `clientY`. */
  const follow = useCallback((clientY: number) => {
    const p = press.current;
    const el = list.current;
    if (!p || !el) return;
    p.lastY = clientY;
    const y = clientY - el.getBoundingClientRect().top;
    const dy = y - p.startY;
    if (!p.active) {
      if (Math.abs(dy) < THRESHOLD) return;
      p.active = true;
    }
    const me = p.rows[p.from];
    const centre = me.top + me.height / 2 + dy;
    let to = p.from;
    p.rows.forEach((r, j) => {
      const mid = r.top + r.height / 2;
      if (j < p.from && centre < mid) to = Math.min(to, j);
      if (j > p.from && centre > mid) to = Math.max(to, j);
    });
    p.to = to;
    setDrag({ from: p.from, to, dy, room: me.height + p.gap });
  }, []);

  const stop = useCallback(() => {
    cancelAnimationFrame(frame.current);
    frame.current = 0;
    press.current = null;
    setDrag(null);
  }, []);

  // Keep scrolling while the pointer rests near an edge.
  const tick = useCallback(() => {
    const p = press.current;
    if (!p?.active) {
      frame.current = 0;
      return;
    }
    if (edgeScroll(p.scroller, p.lastY)) follow(p.lastY);
    frame.current = requestAnimationFrame(tick);
  }, [follow]);

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  const grip = (index: number) => ({
    onPointerDown: (e: ReactPointerEvent<HTMLElement>) => {
      if (disabled || !list.current || (e.pointerType === "mouse" && e.button !== 0)) return;
      const el = list.current;
      const top = el.getBoundingClientRect().top;
      const rows = Array.from(el.querySelectorAll<HTMLElement>("[data-drag-row]")).map((r) => {
        const b = r.getBoundingClientRect();
        return { top: b.top - top, height: b.height };
      });
      if (!rows[index]) return;
      const gap = rows.length > 1 ? Math.max(0, rows[1].top - rows[0].top - rows[0].height) : 0;
      press.current = {
        pointerId: e.pointerId,
        from: index,
        startY: e.clientY - top,
        lastY: e.clientY,
        rows,
        gap,
        to: index,
        active: false,
        scroller: scrollerOf(el),
      };
      dragged.current = false;
      e.currentTarget.setPointerCapture?.(e.pointerId);
    },
    onPointerMove: (e: ReactPointerEvent<HTMLElement>) => {
      const p = press.current;
      if (!p || p.pointerId !== e.pointerId) return;
      follow(e.clientY);
      if (press.current?.active && !frame.current) frame.current = requestAnimationFrame(tick);
    },
    onPointerUp: (e: ReactPointerEvent<HTMLElement>) => {
      const p = press.current;
      if (!p || p.pointerId !== e.pointerId) return;
      if (p.active) {
        dragged.current = true;
        if (p.to !== p.from) onMoveRef.current(p.from, p.to);
      }
      stop();
    },
    onPointerCancel: () => stop(),
  });

  /** Row `i`'s look while a drag is on: the dragged one follows the pointer, the rows it passes make room. */
  const rowStyle = (i: number): CSSProperties | undefined => {
    if (!drag) return undefined;
    if (i === drag.from) return { transform: `translateY(${drag.dy}px)`, zIndex: 2, position: "relative" };
    if (drag.from < drag.to && i > drag.from && i <= drag.to) return { transform: `translateY(${-drag.room}px)` };
    if (drag.to < drag.from && i >= drag.to && i < drag.from) return { transform: `translateY(${drag.room}px)` };
    return undefined;
  };

  /** Whether the click just now ended a drag (then it isn't a press). Answers once. */
  const consumeDrag = () => {
    const was = dragged.current;
    dragged.current = false;
    return was;
  };

  return { listRef, grip, drag, rowStyle, consumeDrag };
}

// ---- dragging onto a target ---------------------------------------------------------------

interface DropPress {
  pointerId: number;
  item: number;
  el: HTMLElement;
  x: number;
  y: number;
  lastX: number;
  lastY: number;
  active: boolean;
  scroller: HTMLElement | null;
}

export interface DropDrag {
  item: number;
  dx: number;
  dy: number;
  /** The [data-drop] value under the pointer, or null. */
  over: string | null;
}

/**
 * Drag an item onto a target marked [data-drop="<value>"] (a group to sort into, or the
 * pool). Mouse and pen only: on a touch screen the chips are small and the board
 * must scroll under a finger, and tapping a chip then a group is easier there anyway.
 * `onDrop(item, value)` is called on a drop over a target.
 */
export function useDropDrag({ onDrop, disabled = false }: { onDrop: (item: number, target: string) => void; disabled?: boolean }) {
  const press = useRef<DropPress | null>(null);
  const [drag, setDrag] = useState<DropDrag | null>(null);
  const dragged = useRef(false);
  const frame = useRef(0);
  const onDropRef = useRef(onDrop);
  onDropRef.current = onDrop;

  /** The target under a point, looking past the item being dragged. */
  const targetAt = (x: number, y: number, el: HTMLElement): string | null => {
    for (const hit of document.elementsFromPoint(x, y)) {
      if (el.contains(hit)) continue;
      const t = hit.closest<HTMLElement>("[data-drop]");
      if (t) return t.dataset.drop ?? null;
    }
    return null;
  };

  const follow = useCallback((x: number, y: number) => {
    const p = press.current;
    if (!p) return;
    p.lastX = x;
    p.lastY = y;
    if (!p.active) {
      if (Math.hypot(x - p.x, y - p.y) < THRESHOLD) return;
      p.active = true;
    }
    // The item's own box moves with any scrolling since the press: measure against it.
    setDrag({ item: p.item, dx: x - p.x, dy: y - p.y, over: targetAt(x, y, p.el) });
  }, []);

  const stop = useCallback(() => {
    cancelAnimationFrame(frame.current);
    frame.current = 0;
    press.current = null;
    setDrag(null);
  }, []);

  const tick = useCallback(() => {
    const p = press.current;
    if (!p?.active) {
      frame.current = 0;
      return;
    }
    const before = p.scroller?.scrollTop ?? 0;
    if (edgeScroll(p.scroller, p.lastY)) {
      // What scrolled moved the item with it: keep it under the pointer.
      p.y -= (p.scroller?.scrollTop ?? 0) - before;
      follow(p.lastX, p.lastY);
    }
    frame.current = requestAnimationFrame(tick);
  }, [follow]);

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  const handle = (item: number) => ({
    onPointerDown: (e: ReactPointerEvent<HTMLElement>) => {
      if (disabled || e.pointerType === "touch" || e.button !== 0) return;
      const el = e.currentTarget;
      press.current = { pointerId: e.pointerId, item, el, x: e.clientX, y: e.clientY, lastX: e.clientX, lastY: e.clientY, active: false, scroller: scrollerOf(el) };
      dragged.current = false;
      el.setPointerCapture?.(e.pointerId);
    },
    onPointerMove: (e: ReactPointerEvent<HTMLElement>) => {
      const p = press.current;
      if (!p || p.pointerId !== e.pointerId) return;
      follow(e.clientX, e.clientY);
      if (press.current?.active && !frame.current) frame.current = requestAnimationFrame(tick);
    },
    onPointerUp: (e: ReactPointerEvent<HTMLElement>) => {
      const p = press.current;
      if (!p || p.pointerId !== e.pointerId) return;
      if (p.active) {
        dragged.current = true;
        const over = targetAt(e.clientX, e.clientY, p.el);
        if (over != null) onDropRef.current(p.item, over);
      }
      stop();
    },
    onPointerCancel: () => stop(),
  });

  /** The dragged item's look: it follows the pointer, above everything else. */
  const itemStyle = (item: number): CSSProperties | undefined =>
    drag?.item === item ? { transform: `translate(${drag.dx}px, ${drag.dy}px)`, zIndex: 3, position: "relative" } : undefined;

  const consumeDrag = () => {
    const was = dragged.current;
    dragged.current = false;
    return was;
  };

  return { handle, drag, itemStyle, consumeDrag };
}
