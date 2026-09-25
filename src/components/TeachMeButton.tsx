import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/*
  "Teach me": the button that starts a lesson (TeachMode in the code), where the tutor
  scrolls, points at and explains the notes out loud. It is the glossy pill from the
  old "download for Mac" buttons (.an-glossy in index.css), so the one control that
  starts a lesson stands apart from the page's quiet outline buttons. Every place that
  starts a lesson uses this, and keeps what differs there: the click, when it's off,
  the tooltip and the height.
*/

/**
 * A mortarboard, filled. Lucide's GraduationCap is an outline, which reads thin on a
 * glossy pill; the reference button carries a solid dark mark. The gap between the
 * board and the cap is kept at about a pixel at 14px, so the two shapes stay apart.
 */
function CapIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} fill="currentColor">
      <path d="M11.1 3.9a2 2 0 0 1 1.8 0l9.5 4.5a.6.6 0 0 1 0 1.08l-9.5 4.5a2 2 0 0 1-1.8 0L1.6 9.48a.6.6 0 0 1 0-1.08z" />
      <path d="M5.5 13.1l5.4 2.55a2.6 2.6 0 0 0 2.2 0l5.4-2.55v3.3c0 2-2.9 3.6-6.5 3.6s-6.5-1.6-6.5-3.6z" />
      <path d="M20.6 9.7v6.6" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" />
    </svg>
  );
}

type TeachMeButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** A fixed-height bar (a note's top bar, h-8) rather than the session header's row. */
  tall?: boolean;
};

export const TeachMeButton = forwardRef<HTMLButtonElement, TeachMeButtonProps>(function TeachMeButton(
  { tall = false, className, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        // The same padding and type size as the buttons beside it, in the lighter weight
        // the glossy buttons had. The look brings its own 1px outline, so in the header
        // it is as tall as its bordered neighbours.
        "an-glossy flex shrink-0 items-center gap-1.5 rounded-full px-3.5 text-xs font-medium disabled:cursor-not-allowed",
        tall ? "h-8" : "py-1.5",
        className,
      )}
      {...rest}
    >
      <CapIcon className="size-3.5 shrink-0" />
      Teach me
    </button>
  );
});
