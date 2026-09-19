import { Upload } from "lucide-react";
import { cn } from "@/lib/utils";

/*
  Recognisable marks for each note source so connecting feels familiar.
  Simplified vector renderings in each product's brand colours; the generic
  upload tile uses the app's own icon.
*/
export function SourceLogo({ id, className }: { id: string; className?: string }) {
  const base = cn("size-9 shrink-0", className);
  switch (id) {
    case "google_docs":
      return (
        <svg viewBox="0 0 36 36" className={base} aria-hidden>
          <rect x="6" y="3" width="24" height="30" rx="3" fill="#4285F4" />
          <path d="M22 3v7a1 1 0 0 0 1 1h7z" fill="#A1C2FA" />
          <rect x="11" y="16" width="14" height="2" rx="1" fill="#fff" />
          <rect x="11" y="20.5" width="14" height="2" rx="1" fill="#fff" />
          <rect x="11" y="25" width="9" height="2" rx="1" fill="#fff" />
        </svg>
      );
    case "google_drive":
      return (
        <svg viewBox="0 0 36 36" className={base} aria-hidden>
          <path d="M12.5 5h11l9 15.5H21.5z" fill="#FFD04B" />
          <path d="M12.5 5 3.5 20.5l4.6 8 9-15.5z" fill="#1FA463" />
          <path d="M8.1 28.5h18.4l6-8H14.1z" fill="#4688F4" />
        </svg>
      );
    case "onenote":
      return (
        <svg viewBox="0 0 36 36" className={base} aria-hidden>
          <rect x="9" y="4" width="23" height="28" rx="2" fill="#B69FE3" />
          <rect x="9" y="4" width="23" height="7" fill="#7719AA" opacity="0.35" />
          <rect x="3" y="8" width="18" height="20" rx="2" fill="#7719AA" />
          <path d="M8 23V13h2.4l3.4 6.2V13H16v10h-2.4l-3.4-6.2V23z" fill="#fff" />
        </svg>
      );
    case "notion":
      return (
        <svg viewBox="0 0 36 36" className={base} aria-hidden>
          <rect x="5" y="5" width="26" height="26" rx="4" fill="#fff" stroke="#111" strokeWidth="1.6" />
          <path d="M11 25.5V10.5h3.2l6.8 10.3V10.5H25v15h-3.2l-6.8-10.3v10.3z" fill="#111" />
        </svg>
      );
    case "apple_notes":
      return (
        <svg viewBox="0 0 36 36" className={base} aria-hidden>
          <rect x="5" y="4" width="26" height="28" rx="5" fill="#fff" stroke="#E5E2DA" />
          <path d="M5 9a5 5 0 0 1 5-5h16a5 5 0 0 1 5 5v3H5z" fill="#FFD94A" />
          <rect x="10" y="17" width="16" height="1.6" rx=".8" fill="#D8D4CA" />
          <rect x="10" y="21.5" width="16" height="1.6" rx=".8" fill="#D8D4CA" />
          <rect x="10" y="26" width="10" height="1.6" rx=".8" fill="#D8D4CA" />
        </svg>
      );
    default:
      return (
        <span className={cn(base, "flex items-center justify-center rounded-lg border border-border bg-muted text-foreground")}>
          <Upload className="size-4" />
        </span>
      );
  }
}
