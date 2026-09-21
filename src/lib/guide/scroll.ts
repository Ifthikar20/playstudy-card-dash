/**
 * Human-paced scrolling for Teach mode.
 *
 * The browser's own smooth scroll is quick and springy; a tutor scrolling the
 * page for you is slower and deliberate, so this animates the scroller with an
 * ease-in-out whose duration grows with distance. The moment the person scrolls
 * themselves (wheel, touch, page keys) the animation stops — Teach mode never
 * fights the user; it simply takes the wheel again on the next step.
 */

let activeCancel: (() => void) | null = null;
let lastUserScrollAt = 0;

/** Nearest ancestor that actually scrolls vertically, or null when the window does. */
export function scrollParentOf(el: Element): HTMLElement | null {
  let p = el.parentElement;
  while (p) {
    const s = getComputedStyle(p);
    if (/(auto|scroll)/.test(s.overflowY) && p.scrollHeight > p.clientHeight + 2) return p;
    p = p.parentElement;
  }
  return null;
}

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export function cancelAutoScroll(): void {
  activeCancel?.();
  activeCancel = null;
}

function animate(scroller: HTMLElement | null, to: number, ms: number): Promise<boolean> {
  cancelAutoScroll();
  const read = () => (scroller ? scroller.scrollTop : window.scrollY);
  const write = (v: number) => {
    if (scroller) scroller.scrollTop = v;
    else window.scrollTo(0, v);
  };
  const max = scroller
    ? scroller.scrollHeight - scroller.clientHeight
    : document.documentElement.scrollHeight - window.innerHeight;
  const from = read();
  const dest = Math.max(0, Math.min(max, to));
  if (Math.abs(dest - from) < 2) return Promise.resolve(true);
  return new Promise((resolve) => {
    const start = performance.now();
    let raf = 0;
    let cancelled = false;
    activeCancel = () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      resolve(false);
    };
    const tick = (now: number) => {
      if (cancelled) return;
      const t = Math.min(1, (now - start) / ms);
      write(from + (dest - from) * easeInOut(t));
      if (t < 1) raf = requestAnimationFrame(tick);
      else {
        activeCancel = null;
        resolve(true);
      }
    };
    raf = requestAnimationFrame(tick);
  });
}

/**
 * Scroll so `rect` (viewport coordinates, belonging to `el`) sits at a
 * comfortable reading height — its top around `align` of the visible area.
 * Does nothing when it's already comfortably in view, unless `force`.
 * Resolves true when the scroll finished, false if the person took over.
 */
export function bringIntoView(el: Element, rect: DOMRect, opts: { align?: number; force?: boolean } = {}): Promise<boolean> {
  const align = opts.align ?? 0.3;
  const scroller = scrollParentOf(el);
  const viewH = scroller ? scroller.clientHeight : window.innerHeight;
  const viewTop = scroller ? scroller.getBoundingClientRect().top : 0;
  const relTop = rect.top - viewTop;
  const relBottom = rect.bottom - viewTop;
  const comfortable = relTop >= viewH * 0.1 && relBottom <= viewH * 0.68;
  if (comfortable && !opts.force) return Promise.resolve(true);
  const current = scroller ? scroller.scrollTop : window.scrollY;
  const dest = current + relTop - viewH * align;
  const dist = Math.abs(dest - current);
  const ms = Math.max(550, Math.min(1900, 400 + dist * 0.75));
  return animate(scroller, dest, ms);
}

/** Stop auto-scrolling whenever the person scrolls; returns the uninstaller. */
export function installScrollTakeover(): () => void {
  const onUser = () => {
    lastUserScrollAt = Date.now();
    cancelAutoScroll();
  };
  const onKey = (e: KeyboardEvent) => {
    // Moving the caret inside an editable line is not the person scrolling —
    // without this, every ArrowUp/ArrowDown cancels the guide's in-flight scroll.
    const t = e.target as HTMLElement | null;
    if (t && (t.isContentEditable || t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT")) return;
    if (["PageUp", "PageDown", "Home", "End", "ArrowUp", "ArrowDown"].includes(e.key)) onUser();
  };
  window.addEventListener("wheel", onUser, { passive: true });
  window.addEventListener("touchmove", onUser, { passive: true });
  window.addEventListener("keydown", onKey);
  return () => {
    window.removeEventListener("wheel", onUser);
    window.removeEventListener("touchmove", onUser);
    window.removeEventListener("keydown", onKey);
  };
}

export const userScrolledRecently = (withinMs = 1500): boolean => Date.now() - lastUserScrollAt < withinMs;
