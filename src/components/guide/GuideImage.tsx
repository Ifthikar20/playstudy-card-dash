import { useEffect, useState } from "react";
import { API_URL, getAuthToken } from "@/services/api";
import type { GuideImage as GuideImageData } from "@/services/guide";

/*
  A real photo on the Teach mode whiteboard, for a concrete subject a diagram can't
  capture (an object in space, a historical event, a person, a place, an artifact).
  The step carries only a search query; the backend resolves it to a real, sourced
  photo (so the model can never inject a URL), and if there's no confident match,
  nothing wrong is shown.

  Nothing reaches the board until the picture is *decoded*: a photo that paints in
  line by line while the tutor says "here's a real image of…" reads as a glitch, so
  the board keeps its quiet "finding a picture" state until the whole thing is
  ready, then shows it in one go. The lookup for the next step's image starts while
  the current one is still being explained, so that wait is usually already over.
*/

interface Ready {
  url: string;
  caption?: string;
  source?: string;
}

interface State extends Partial<Ready> {
  loading: boolean;
  failed?: boolean;
}

/** A short, human label for a source URL, e.g. "nasa.gov" or "en.wikipedia.org". */
function sourceName(url?: string): string {
  if (!url) return "";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "source";
  }
}

/** Resolve when the bitmap is in memory and painted-ready — never reject on a slow file. */
function decoded(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    let settled = false;
    const done = () => {
      if (!settled) {
        settled = true;
        resolve();
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

const cache = new Map<string, Promise<Ready>>();

async function lookup(query: string): Promise<Ready> {
  const token = getAuthToken();
  const res = await fetch(`${API_URL}/guide/image?q=${encodeURIComponent(query)}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!res.ok) throw new Error(String(res.status));
  const data = await res.json();
  if (!data?.url) throw new Error("no image");
  await decoded(data.url);
  return { url: data.url, caption: data.caption, source: data.source };
}

function imageFor(query: string): Promise<Ready> {
  const hit = cache.get(query);
  if (hit) return hit;
  const p = lookup(query);
  cache.set(query, p);
  p.catch(() => cache.delete(query)); // a failed lookup shouldn't poison the next try
  return p;
}

/** Start finding and decoding a photo before the step that shows it comes round. */
export function prefetchGuideImage(query?: string | null): void {
  if (query?.trim()) void imageFor(query.trim()).catch(() => undefined);
}

export function GuideImage({ image }: { image: GuideImageData }) {
  const [st, setSt] = useState<State>({ loading: true });

  useEffect(() => {
    let cancelled = false;
    setSt({ loading: true });
    imageFor(image.query).then(
      (r) => !cancelled && setSt({ loading: false, ...r }),
      () => !cancelled && setSt({ loading: false, failed: true }),
    );
    return () => {
      cancelled = true;
    };
  }, [image.query]);

  if (st.loading) {
    return (
      <div className="guide-image guide-image-status">
        <div className="guide-image-spinner" aria-hidden />
        <span>Finding a picture…</span>
      </div>
    );
  }
  if (st.failed || !st.url) {
    return <div className="guide-image guide-image-status">{image.caption || image.query}</div>;
  }
  const caption = image.caption || st.caption;
  return (
    <figure className="guide-image">
      {/* already decoded by the time this mounts, so it appears whole */}
      <img className="guide-image-img" src={st.url} alt={caption || image.query} onError={() => setSt({ loading: false, failed: true })} />
      <figcaption className="guide-image-caption">
        <span>{caption}</span>
        {st.source && (
          <a className="guide-image-source" href={st.source} target="_blank" rel="noopener noreferrer" title={st.source}>
            Source: {sourceName(st.source)}
          </a>
        )}
      </figcaption>
    </figure>
  );
}
