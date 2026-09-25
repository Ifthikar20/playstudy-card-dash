/**
 * Which pictures this tab may show: the one rule, and the pictures that have been
 * taken away since.
 *
 * Why: a lesson on resistor colour codes once showed a red subway train. Now the server
 * only hands out pictures it stored itself after two vision checks, as the file
 * "/img/<sha256>.jpg" plus a signed picture_id (format in playstudy-backend's
 * app/core/guide_pictures.py: "<mac>.<sha>.<subject hash>"). Anything else - an outside
 * address, a data: URL, a picture with no id, an id for some other file - is never shown.
 * The id's middle part is the file's sha, so it can't be paired with another file. The
 * signature itself is only checked by the server: the browser can't, and doesn't need
 * to, because every picture is looked up there before it's shown (GuideImage).
 *
 * A picture can also be taken away while it's up: the student taps "Wrong picture", or
 * the server stops vouching for it (a lookup answers 404, the file won't load). The
 * copies already in this tab - on the board, in its history strip, in the image cache,
 * carried by the lesson's later steps, pinned in the notes underneath - must all go at
 * that moment. So each of them asks here before showing a picture and listens for
 * changes. A picture is blocked by its id and by its sha, so the same file checked for
 * another subject goes too (the server deletes the file on a report anyway).
 */
import { useSyncExternalStore } from "react";
import type { GuideImage } from "@/services/guide";

/** The only address a picture may have: a stored file named by its own sha256. */
const IMG_URL = /^\/img\/([0-9a-f]{64})\.jpg$/;
/** <mac: 43 base64url chars>.<sha: 64 hex>.<subject hash: 32 hex> */
const PICTURE_ID = /^[A-Za-z0-9_-]{43}\.([0-9a-f]{64})\.[0-9a-f]{32}$/;

type PictureLike = Pick<GuideImage, "picture_id" | "url">;

/** A picture that passed the shape check: its id, its /img/ address and the sha they share. */
export interface TrustedPicture {
  picture_id: string;
  url: string;
  sha: string;
}

/**
 * The picture's id and address when they're the kind the server issues and belong to
 * the same file; null for anything else. Says nothing about whether it has been blocked.
 */
export function trustedPicture(p: Partial<PictureLike> | null | undefined): TrustedPicture | null {
  if (!p || typeof p.picture_id !== "string" || typeof p.url !== "string") return null;
  const id = PICTURE_ID.exec(p.picture_id);
  const file = IMG_URL.exec(p.url);
  if (!id || !file || id[1] !== file[1]) return null;
  return { picture_id: p.picture_id, url: p.url, sha: file[1] };
}

/** The sha a picture names, from its address or its id (not verified). */
function shaOf(p: Partial<PictureLike>): string | null {
  const file = typeof p.url === "string" ? IMG_URL.exec(p.url) : null;
  if (file) return file[1];
  const id = typeof p.picture_id === "string" ? PICTURE_ID.exec(p.picture_id) : null;
  return id ? id[1] : null;
}

// picture_ids and shas taken away this session
const gone = new Set<string>();
let version = 0;
const listeners = new Set<() => void>();

export function isPictureBlocked(p: Partial<PictureLike> | null | undefined): boolean {
  if (!p) return false;
  if (typeof p.picture_id === "string" && gone.has(p.picture_id)) return true;
  const sha = shaOf(p);
  return !!sha && gone.has(sha);
}

/** A picture that may go up: the right shape, and not taken away since. */
export function canShowPicture<T extends Partial<PictureLike>>(p: T | null | undefined): p is T & { picture_id: string; url: string } {
  return !!trustedPicture(p) && !isPictureBlocked(p);
}

/** Take a picture away for the rest of this session, everywhere it's shown. */
export function blockPicture(p: Partial<PictureLike> | null | undefined): void {
  if (!p) return;
  const before = gone.size;
  if (typeof p.picture_id === "string" && p.picture_id) gone.add(p.picture_id);
  const sha = shaOf(p);
  if (sha) gone.add(sha);
  if (gone.size === before) return;
  version++;
  // a listener that throws must not stop the others from hiding it
  for (const fn of [...listeners]) {
    try {
      fn();
    } catch (e) {
      console.error("[blocked] listener failed", e);
    }
  }
}

/** Called after every change; returns the unsubscribe. */
export function onBlockedChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** For a component: re-renders it whenever a picture is taken away. */
export function useBlockedVersion(): number {
  return useSyncExternalStore(onBlockedChange, () => version);
}
