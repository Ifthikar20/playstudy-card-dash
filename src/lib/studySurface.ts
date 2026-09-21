/**
 * The study surface: which background the study page is written on.
 *
 * ReadMode is the app's only other user-chosen background, and it stores a
 * colour TOGETHER WITH ITS INK (`#faf5ea`/`#2b2a26`) rather than leaning on the
 * app's `--background`/`--foreground` tokens — which is what lets its paper stay
 * cream while the app is in dark mode. Each swatch here does the same thing at
 * token scale: it redeclares the shadcn palette on the study surface, so a
 * chosen sheet carries its own ink, its own hairlines and its own card tint,
 * and everything drawn on it follows without per-element overrides.
 *
 * STORAGE follows every other preference in this app: localStorage, per-device,
 * the `an-` prefix, the `an-pref:<name>` shape used by the profile toggles, a
 * lazy read so the first paint is already correct, and try/catch around every
 * read and write because private mode throws. There is no server preferences
 * endpoint anywhere in this codebase, so a per-account choice would need a new
 * backend field; matching the established pattern means per-device.
 */

import { useSyncExternalStore } from "react";
import { migrateLocalKeys } from "@/lib/localData";

export type SheetId = "auto" | "paper" | "sand" | "sage" | "slate" | "ink";

export interface SheetSwatch {
  id: SheetId;
  label: string;
  hint: string;
  /** The dot drawn in the picker. `null` = follow the app theme. */
  css: string | null;
  ink: string | null;
}

export const SHEETS: SheetSwatch[] = [
  { id: "auto", label: "Match theme", hint: "Follows light or dark", css: null, ink: null },
  { id: "paper", label: "Paper", hint: "Warm writing paper", css: "#f8f4ea", ink: "#231f1c" },
  { id: "sand", label: "Sand", hint: "Deeper, warmer", css: "#eee5da", ink: "#2c2621" },
  { id: "sage", label: "Sage", hint: "Cool and quiet", css: "#ebf1ed", ink: "#1d2622" },
  { id: "slate", label: "Slate", hint: "Dark, blue-grey", css: "#1a1f27", ink: "#dde2e8" },
  { id: "ink", label: "Ink", hint: "Near black, like Read mode", css: "#0c0c0e", ink: "#e7e5df" },
];

const KEY = "an-pref:sheet";
const VALID = new Set(SHEETS.map((s) => s.id));

export function readSheet(): SheetId {
  try {
    const v = localStorage.getItem(KEY);
    if (v && VALID.has(v as SheetId)) return v as SheetId;
  } catch {
    /* private mode */
  }
  return "auto";
}

/* The sheet is read HERE, during module evaluation, so the first paint is
   already the right colour — which means it happens before App.tsx's body runs
   and before App.tsx's own call. Ordering is guaranteed by the import above,
   not by where this file sits in anyone's import list. */
migrateLocalKeys();

let current: SheetId = readSheet();
const listeners = new Set<(id: SheetId) => void>();

export const getSheet = (): SheetId => current;

export function setSheet(id: SheetId) {
  current = VALID.has(id) ? id : "auto";
  try {
    localStorage.setItem(KEY, current);
  } catch {
    /* private mode */
  }
  listeners.forEach((fn) => fn(current));
}

export function subscribeSheet(fn: (id: SheetId) => void) {
  listeners.add(fn);
  return () => void listeners.delete(fn);
}

/** The attribute the CSS keys off. Set on <html> so the chosen sheet reaches
 *  overscroll and the gutter the inset card floats in — below md the DOCUMENT
 *  scrolls, so a background that stops at the content box is not enough. */
export function applySheetAttr(id: SheetId | null) {
  const el = document.documentElement;
  if (id) el.dataset.anSheet = id;
  else delete el.dataset.anSheet;
}

/** The chosen sheet, live. Lazy by construction: `current` is read from
 *  localStorage at module load, so the first paint is already right. */
export const useSheet = (): SheetId => useSyncExternalStore(subscribeSheet, getSheet, getSheet);
