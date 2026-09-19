import { cn } from "@/lib/utils";

/*
  Folder covers — a set of hand-picked textures (served from /public/covers) that
  a folder can wear as a little "book cover". A folder stores its choice in the
  `icon` field as "cover:c3"; older folders keep a plain emoji, which still
  renders. Each cover carries an accent colour (extracted from the texture) used
  for spines, progress bars and tints.
*/
export interface FolderCover {
  id: string;
  src: string;
  accent: string;
}

export const FOLDER_COVERS: FolderCover[] = [
  { id: "c1", src: "/covers/c1.jpg", accent: "#7FBE8C" },
  { id: "c8", src: "/covers/c8.jpg", accent: "#4E8F8A" },
  { id: "c13", src: "/covers/c13.jpg", accent: "#3FB5A6" },
  { id: "c12", src: "/covers/c12.jpg", accent: "#57C08C" },
  { id: "c11", src: "/covers/c11.jpg", accent: "#2C62A1" },
  { id: "c9", src: "/covers/c9.jpg", accent: "#9F6864" },
  { id: "c3", src: "/covers/c3.jpg", accent: "#D98A80" },
  { id: "c10", src: "/covers/c10.jpg", accent: "#D88866" },
  { id: "c5", src: "/covers/c5.jpg", accent: "#C76150" },
  { id: "c7", src: "/covers/c7.jpg", accent: "#E07A16" },
  { id: "c2", src: "/covers/c2.jpg", accent: "#E0610B" },
  { id: "c6", src: "/covers/c6.jpg", accent: "#D24F28" },
  { id: "c4", src: "/covers/c4.jpg", accent: "#C0341F" },
];

const COVER_BY_ID: Record<string, FolderCover> = Object.fromEntries(FOLDER_COVERS.map((c) => [c.id, c]));

export const COVER_PREFIX = "cover:";

/** Turn a folder's `icon` value into a cover, or null when it's a plain emoji. */
export function parseCover(icon?: string | null): FolderCover | null {
  if (!icon || !icon.startsWith(COVER_PREFIX)) return null;
  return COVER_BY_ID[icon.slice(COVER_PREFIX.length)] ?? null;
}

/** For compact text labels (chips, menus): the emoji + trailing space when it's
 *  an emoji folder, or "" for a cover folder (whose token isn't human text). */
export function folderLabelIcon(icon?: string | null): string {
  return icon && !icon.startsWith(COVER_PREFIX) ? `${icon} ` : "";
}

type GlyphSize = "sm" | "md" | "lg";
const COVER_DIMS: Record<GlyphSize, string> = { sm: "h-9 w-7", md: "h-16 w-12", lg: "h-[4.5rem] w-14" };
const TILE_DIMS: Record<GlyphSize, string> = { sm: "size-9 text-base", md: "size-12 text-2xl", lg: "size-16 text-3xl" };

/**
 * The folder's visual: a textured book-cover when it has a cover, otherwise the
 * emoji on a colour-tinted tile. Consistent across the library, folder pages and
 * the create dialog.
 */
export function FolderGlyph({
  icon,
  color,
  size = "md",
  className,
}: {
  icon?: string | null;
  color: string;
  size?: GlyphSize;
  className?: string;
}) {
  const cover = parseCover(icon);
  if (cover) {
    return (
      <span
        className={cn("shrink-0 overflow-hidden rounded-md bg-cover bg-center shadow-sm ring-1 ring-inset ring-black/10", COVER_DIMS[size], className)}
        style={{ backgroundImage: `url(${cover.src})` }}
        aria-hidden
      />
    );
  }
  return (
    <span
      className={cn("flex shrink-0 items-center justify-center rounded-xl ring-1 ring-inset ring-black/5", TILE_DIMS[size], className)}
      style={{ backgroundColor: `${color}26` }}
      aria-hidden
    >
      {icon}
    </span>
  );
}
