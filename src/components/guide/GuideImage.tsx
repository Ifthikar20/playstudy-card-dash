import { useEffect, useState, type CSSProperties } from "react";
import { lookupPicture, type GuideImage as GuideImageData } from "@/services/guide";
import { blockPicture, isPictureBlocked, onBlockedChange, trustedPicture, useBlockedVersion } from "@/lib/guide/blocked";

/*
  A real photo on the Teach mode whiteboard (or pinned in the notes), for a concrete
  subject a diagram can't capture: an object in space, a historical event, a place, an
  artifact.

  Only a picture the server stored and checked itself is ever shown: the file
  "/img/<sha256>.jpg" with the signed picture_id the server issued for it (the rule is in
  lib/guide/blocked.ts). Nothing here searches for a picture or loads one from anywhere
  else - a lesson once showed a subway train for "resistor". Before it's shown, the
  server is asked about the id once per session: a picture reported since, or pictures
  switched off, and the answer is 404 and nothing is shown. A picture that is taken away
  while it's up (the board's "Wrong picture", say) goes from here at once, the notes'
  pinned copy included.

  Nothing reaches the board until the picture is *decoded*: a photo that paints in line
  by line while the tutor says "here's a real image of..." reads as a glitch, so the
  board keeps its quiet loading state until the whole thing is ready, then shows it in
  one go. The next step's picture is looked up while the current one is still being
  explained, so that wait is usually already over.
*/

interface Ready {
  /** The checked /img/ address. */
  url: string;
  /** What the <img> loads: that same checked address. */
  src: string;
  caption?: string;
  source?: string;
  attribution?: string;
  licence?: string;
  /** The picture's natural size, once decoded (0 when it never said). */
  w?: number;
  h?: number;
}

interface State extends Partial<Ready> {
  /** The picture_id this state is about: a state left over from another picture is never drawn. */
  id: string | null;
  loading: boolean;
  failed?: boolean;
}

/** A short, human label for a source URL, e.g. "nasa.gov" or "commons.wikimedia.org". */
function sourceName(url?: string): string {
  if (!url) return "";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "source";
  }
}

/** A source link only when it's a web page: never a javascript: or data: address. */
function webPage(url?: string): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:" ? u.href : null;
  } catch {
    return null;
  }
}

/** Resolve with the natural size when the bitmap is in memory and painted-ready. Rejects when it won't load. */
function decoded(url: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    let settled = false;
    const done = () => {
      if (!settled) {
        settled = true;
        resolve({ w: img.naturalWidth, h: img.naturalHeight });
      }
    };
    img.onload = () => (img.decode ? img.decode().then(done, done) : done());
    img.onerror = () => {
      if (!settled) {
        settled = true;
        reject(new Error("image failed"));
      }
    };
    img.src = url;
    // A very large photo on a slow connection shouldn't strand the board on a
    // spinner; after this we show it and let the browser finish painting.
    window.setTimeout(done, 10_000);
  });
}

/** One lookup and decode per picture_id: the same id is the same file, checked for the same subject. */
const cache = new Map<string, Promise<Ready>>();
// A picture taken away leaves the cache at once, so nothing can show it from there.
onBlockedChange(() => {
  for (const id of [...cache.keys()]) if (isPictureBlocked({ picture_id: id })) cache.delete(id);
});

/** The picture, looked up and decoded; null when it may not be shown at all. */
function imageFor(image: GuideImageData): Promise<Ready> | null {
  const t = trustedPicture(image);
  if (!t || isPictureBlocked(t)) return null;
  const hit = cache.get(t.picture_id);
  if (hit) return hit;
  const p = (async (): Promise<Ready> => {
    const found = await lookupPicture(t.picture_id);
    const pic = found.picture;
    if (!pic) {
      // The server won't vouch for it (blocked, or pictures are off): gone for the whole
      // session, so the board, its history and the lesson's later steps drop it too.
      if (found.gone) blockPicture(t);
      throw new Error("no picture");
    }
    // lookupPicture only answers with this same id and file.
    const src = t.url;
    let size: { w: number; h: number };
    try {
      size = await decoded(src);
    } catch (e) {
      // A file that won't load (deleted by a block, or the network) is never shown in
      // part: it's dropped everywhere, which also clears it off the board.
      blockPicture(t);
      throw e;
    }
    if (isPictureBlocked(t)) throw new Error("taken away");
    return { url: t.url, src, caption: pic.caption, source: pic.source, attribution: pic.attribution, licence: pic.licence, ...size };
  })();
  cache.set(t.picture_id, p);
  p.catch(() => {
    if (cache.get(t.picture_id) === p) cache.delete(t.picture_id); // a failed try shouldn't stick
  });
  return p;
}

/** Start looking up and decoding a picture before the step that shows it comes round. */
export function prefetchGuideImage(image?: GuideImageData | null): void {
  if (image) void imageFor(image)?.catch(() => undefined);
}

/**
 * `pinned`: a picture kept in the notes. One that can't be shown - from before pictures
 * were checked (an outside address), or taken away since - leaves its caption behind
 * rather than nothing, so the note still says what was there. On the board a picture
 * that can't be shown renders nothing at all.
 */
export function GuideImage({ image, pinned = false }: { image: GuideImageData; pinned?: boolean }) {
  useBlockedVersion(); // re-render the moment any picture is taken away
  const trusted = trustedPicture(image);
  const id = trusted?.picture_id ?? null;
  const [held, setSt] = useState<State>({ id, loading: true });
  // Handed a different picture, the one before must not show for even a frame (it may
  // be the one just taken away) while the effect below starts on the new one.
  const st: State = held.id === id ? held : { id, loading: true };

  useEffect(() => {
    let cancelled = false;
    setSt({ id, loading: true });
    const p = id ? imageFor(image) : null;
    if (!p) {
      setSt({ id, loading: false, failed: true });
      return;
    }
    p.then(
      (r) => !cancelled && setSt({ id, loading: false, ...r }),
      () => !cancelled && setSt({ id, loading: false, failed: true }),
    );
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the id names the file: the same id is the same picture
  }, [id]);

  const label = image.caption || image.query;
  const captionOnly = pinned ? (
    <figure className="guide-image guide-image-gone">
      <figcaption className="guide-image-caption">
        <span>{label}</span>
      </figcaption>
    </figure>
  ) : null;

  if (!trusted || isPictureBlocked(trusted) || st.failed) return captionOnly;
  if (st.loading || !st.src) {
    return (
      <div className="guide-image guide-image-status">
        <div className="guide-image-spinner" aria-hidden />
        <span>Loading the picture…</span>
      </div>
    );
  }
  const caption = image.caption || st.caption;
  const link = webPage(st.source);
  const credit = [st.attribution, st.licence].filter(Boolean).join(", ");
  // The natural size goes on the element: width/height keep its shape before layout,
  // --ar lets the board size it to fill without letterboxing, and --nw caps how far a
  // small photo is blown up (twice its own size, before it turns soft).
  const sized = !!(st.w && st.h);
  const vars = sized ? ({ "--ar": String(st.w! / st.h!), "--nw": `${st.w}px` } as CSSProperties) : undefined;
  return (
    <figure className="guide-image">
      {/* already decoded by the time this mounts, so it appears whole */}
      <img
        className="guide-image-img"
        src={st.src}
        alt={caption || image.query}
        data-picture-id={trusted.picture_id}
        width={sized ? st.w : undefined}
        height={sized ? st.h : undefined}
        style={vars}
        onLoad={(e) => {
          // a picture that outlasted the decode wait arrives here with its size at last
          const el = e.currentTarget;
          if (!sized && el.naturalWidth > 0) setSt((prev) => (prev.id === id ? { ...prev, w: el.naturalWidth, h: el.naturalHeight } : prev));
        }}
        onError={() => {
          blockPicture(trusted);
          setSt({ id, loading: false, failed: true });
        }}
      />
      <figcaption className="guide-image-caption">
        <span>{caption}</span>
        {(credit || link) && (
          <span className="guide-image-credit">
            {credit && <span>{credit}</span>}
            {link && (
              <a className="guide-image-source" href={link} target="_blank" rel="noopener noreferrer" title={link}>
                Source: {sourceName(link)}
              </a>
            )}
          </span>
        )}
      </figcaption>
    </figure>
  );
}
