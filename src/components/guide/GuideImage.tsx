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

async function lookup(query: string, match: string[]): Promise<Ready> {
  const token = getAuthToken();
  // `must`: the backend only accepts a picture whose file is about one of these
  // words, so "concave lens" can never come back as a picture of some other lens.
  const must = match.length ? `&must=${encodeURIComponent(match.join(","))}` : "";
  const res = await fetch(`${API_URL}/guide/image?q=${encodeURIComponent(query)}${must}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!res.ok) throw new Error(String(res.status));
  const data = await res.json();
  if (!data?.url) throw new Error("no image");
  await decoded(data.url);
  return { url: data.url, caption: data.caption, source: data.source };
}

function imageFor(query: string, match: string[] = [], found?: { url: string; source?: string; caption?: string }): Promise<Ready> {
  const key = `${query}|${match.join(",")}`;
  const hit = cache.get(key);
  if (hit) return hit;
  // A lesson step arrives with the picture the server already found and checked:
  // only decoding is left to do. A question's answer still asks for it here.
  const p = found?.url
    ? decoded(found.url).then(() => ({ url: found.url, caption: found.caption, source: found.source }))
    : lookup(query, match);
  cache.set(key, p);
  p.catch(() => cache.delete(key)); // a failed lookup shouldn't poison the next try
  return p;
}

/** Start finding and decoding a picture before the step that shows it comes round. */
export function prefetchGuideImage(image?: GuideImageData | null): void {
  if (image?.query?.trim()) void imageFor(image.query.trim(), image.match ?? [], image.url ? { url: image.url, source: image.source, caption: image.caption } : undefined).catch(() => undefined);
}

export function GuideImage({ image }: { image: GuideImageData }) {
  const [st, setSt] = useState<State>({ loading: true });

  useEffect(() => {
    let cancelled = false;
    setSt({ loading: true });
    imageFor(image.query, image.match ?? [], image.url ? { url: image.url, source: image.source, caption: image.caption } : undefined).then(
      (r) => !cancelled && setSt({ loading: false, ...r }),
      () => !cancelled && setSt({ loading: false, failed: true }),
    );
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- match is part of the same request as query
  }, [image.query, (image.match ?? []).join(",")]);

  if (st.loading) {
    return (
      <div className="guide-image guide-image-status">
        <div className="guide-image-spinner" aria-hidden />
        <span>Finding a picture…</span>
      </div>
    );
  }
  if (st.failed || !st.url) {
    // Say plainly there's no picture, rather than leave a caption on its own as if it were one.
    return (
      <div className="guide-image guide-image-status">
        <span>No good picture of {image.caption || image.query} was found.</span>
      </div>
    );
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
