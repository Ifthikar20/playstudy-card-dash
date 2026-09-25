/**
 * AnotherNotes AI Guide — API client.
 *
 * Both AI calls stream Server-Sent Events over a POST (EventSource can't POST
 * or send an Authorization header, so this is a small fetch-based SSE reader).
 */
import { API_URL, getAuthToken } from "@/services/api";
import { authFetch } from "@/services/authFetch";
import { readSSE } from "@/lib/sse";

export interface GuideBlockPayload {
  id: string;
  kind: string;
  text: string;
}

/** One beat of the walkthrough: point at `block` (underlining `quote`) and say `say`. */
export interface GuideChartPoint {
  label: string;
  value: number;
}

/** A small chart the whiteboard draws for a step about numbers, ratios or series. */
export interface GuideChart {
  type: "bar" | "line" | "pie";
  title?: string;
  unit?: string;
  data: GuideChartPoint[];
}

/** A process (flow), cycle or tree diagram of labelled nodes. */
export interface GuideDiagram {
  type: "flow" | "cycle" | "tree";
  title?: string;
  nodes: string[];
  edges?: { from: number; to: number; label?: string }[];
}

/** A Bohr-model atom. */
export interface GuideAtom {
  protons: number;
  neutrons: number;
  electrons: number;
  symbol?: string;
  name?: string;
}

/** A y = f(x) function graph. Everything beyond `fn` is computed from it: the
    shaded area, the marked points, a second curve, a tangent, the asymptotes. */
export interface GuideGraph {
  fn: string;
  domain?: [number, number];
  title?: string;
  xlabel?: string;
  ylabel?: string;
  /** A second curve drawn alongside, for comparison. */
  fn2?: string;
  /** Shade the area under the curve between these two x values. */
  shade?: [number, number];
  /** Points to mark: a root, an intercept, a turning point. `y` defaults to f(x). */
  points?: { x: number; y?: number; label?: string }[];
  /** Draw the tangent to the curve at this x. */
  tangent_at?: number;
  /** Dashed asymptotes, vertical (x) or horizontal (y). */
  asymptotes?: { x?: number; y?: number }[];
}

/** A molecular structure drawn from SMILES. */
export interface GuideMolecule {
  smiles: string;
  title?: string;
}

/** A real picture (photo or textbook diagram) the backend finds on the web for a real subject. */
export interface GuideImage {
  query: string;
  caption?: string;
  /** Words the picture must be about ("concave"), so a picture of the wrong kind is never shown. */
  match?: string[];
  /** The picture the server already found and checked for this step (lesson steps carry it). */
  url?: string;
  /** The page it came from. */
  source?: string;
}

/** A "did you know" card: a few striking facts about the subject, each a short value and one line. */
export interface GuideFacts {
  title?: string;
  items: { value: string; text: string }[];
}

/** How a step is said (from the backend's speaking_styles.json): the id plus the prosody for the browser voice. */
export interface GuideTone {
  rate: number;
  pitch: number;
}

/** A comparison table: 2-4 columns, 2-8 rows. The first column header may be blank. */
export interface GuideTable {
  title?: string;
  columns: string[];
  rows: string[][];
}

/** The principles, laws, stages or key points a passage sets out, listed on the board. */
export interface GuideList {
  title?: string;
  items: { label: string; detail?: string }[];
  /** The item being explained right now; omitted when the whole list is introduced or recapped. */
  focus?: number;
  /** Put up by the server from the notes' own bullets (the voice doesn't announce it). */
  auto?: boolean;
}

/** A dated timeline; events are placed by their real year, so the gaps show. */
export interface GuideTimeline {
  title?: string;
  events: { year: number; label: string; date?: string }[];
}

/** A number line or scale strip: an interval, an inequality, or where something sits. */
export interface GuideScale {
  title?: string;
  unit?: string;
  min: number;
  max: number;
  log?: boolean;
  marks: { at: number; label: string }[];
  ranges: { from: number; to: number; label: string; open?: boolean }[];
}

/** A 2- or 3-set Venn diagram; `regions` keys are a, b, c, ab, ac, bc, abc. */
export interface GuideVenn {
  title?: string;
  sets: string[];
  regions: Record<string, string[]>;
}

/** One element lit up on a mini periodic table (all fields from the real table). */
export interface GuidePeriodic {
  z: number;
  symbol: string;
  name: string;
  mass: number;
  /** 1-18, or 0 for the lanthanide/actinide rows. */
  group: number;
  period: number;
  category: string;
}

/** A circuit: components in series, or a battery feeding parallel branches. */
export interface GuideCircuitPart {
  type: string;
  label?: string;
}
export interface GuideCircuit {
  title?: string;
  layout: "series" | "parallel";
  components: GuideCircuitPart[];
  branches?: GuideCircuitPart[][];
}

/** A free-body diagram, or tip-to-tail vector addition with the resultant. */
export interface GuideForces {
  title?: string;
  mode: "forces" | "vectors";
  body?: string;
  unit?: string;
  /** Angles are degrees anticlockwise from east (right 0, up 90, left 180, down 270). */
  vectors: { label: string; angle: number; magnitude?: number }[];
  resultant?: { magnitude: number; angle: number };
}

/** A labelled geometric figure, constructed from real side lengths when given. */
export interface GuideGeometry {
  title?: string;
  shape: "triangle" | "right_triangle" | "circle" | "rectangle" | "square";
  values: Record<string, number>;
  labels: Record<string, string>;
  show: string[];
}

/** A code snippet with the explained line highlighted, and an optional variable trace. */
export interface GuideCode {
  title?: string;
  language?: string;
  lines: string[];
  highlight: number[];
  trace?: { columns: string[]; rows: string[][] };
}

/** What each symbol in a drawn formula means. */
export interface GuideLabel {
  part: string;
  meaning: string;
}

/** A line of LaTeX on the board, optionally with its symbols named. */
export interface GuideMath {
  latex: string;
  labels?: GuideLabel[] | null;
  replace?: boolean;
}

/**
 * Something on the board the voice names ("the gold band", "side c"). `part` is the
 * anchor id inside a drawn visual ("sides.c", "items.2"); a picture has none, its
 * parts are found by label (see fetchImageParts). Kept outside the visual's own data,
 * so pointing at another part never counts as a new visual and never redraws it.
 */
export interface GuidePoint {
  label: string;
  part?: string;
}

/**
 * Where a named part sits inside a picture, 0-1 of the picture as displayed:
 * `box` is [x, y, w, h] from its top-left corner, `point` a spot on the part itself.
 */
export interface GuideRegion {
  box: [number, number, number, number];
  point: [number, number];
  confidence: "high" | "medium";
}

export interface GuideStep {
  block: string | null;
  quote: string;
  say: string;
  /** The parts of the visual this step talks about, in the order they're named (at most 3). */
  point?: GuidePoint[] | null;
  /** Speaking style id ("curious", "story", "calm", …) the line was written in. */
  style?: string;
  /** That style's rate and pitch, applied when the browser's own voice is speaking. */
  tone?: GuideTone;
  /** Optional line of LaTeX to write on the Teach mode whiteboard for this step. */
  draw?: string | null;
  /** "replace" starts a fresh board (a new, unrelated equation); otherwise the line is appended. */
  draw_mode?: string;
  /** Optional chart to show the step's numbers graphically. */
  chart?: GuideChart | null;
  /** Optional process/cycle diagram. */
  diagram?: GuideDiagram | null;
  /** Optional Bohr-model atom. */
  atom?: GuideAtom | null;
  /** Optional function graph. */
  graph?: GuideGraph | null;
  /** Optional molecular structure (SMILES). */
  molecule?: GuideMolecule | null;
  /** Optional real photo (resolved from the web by query). */
  image?: GuideImage | null;
  /** Optional names for the symbols in `draw`. */
  draw_labels?: GuideLabel[] | null;
  /** Optional comparison table. */
  table?: GuideTable | null;
  /** Optional list of principles / key points, with the one being explained highlighted. */
  list?: GuideList | null;
  /** Optional dated timeline. */
  timeline?: GuideTimeline | null;
  /** Optional number line / scale strip. */
  scale?: GuideScale | null;
  /** Optional Venn diagram. */
  venn?: GuideVenn | null;
  /** Optional mini periodic table with one element lit up. */
  periodic?: GuidePeriodic | null;
  /** Optional circuit diagram. */
  circuit?: GuideCircuit | null;
  /** Optional free-body / vector diagram. */
  forces?: GuideForces | null;
  /** Optional labelled geometric figure. */
  geometry?: GuideGeometry | null;
  /** Optional code snippet with a highlighted line. */
  code?: GuideCode | null;
  /** Optional "did you know" card of facts about the subject. */
  facts?: GuideFacts | null;
}

/**
 * Everything the whiteboard can draw, in the one shape the board, the notes and
 * the "pin this" path all speak. A step carries at most one.
 */
export type VisualSpec =
  | { kind: "math"; data: GuideMath }
  | { kind: "table"; data: GuideTable }
  | { kind: "list"; data: GuideList }
  | { kind: "chart"; data: GuideChart }
  | { kind: "timeline"; data: GuideTimeline }
  | { kind: "scale"; data: GuideScale }
  | { kind: "diagram"; data: GuideDiagram }
  | { kind: "venn"; data: GuideVenn }
  | { kind: "graph"; data: GuideGraph }
  | { kind: "atom"; data: GuideAtom }
  | { kind: "periodic"; data: GuidePeriodic }
  | { kind: "molecule"; data: GuideMolecule }
  | { kind: "circuit"; data: GuideCircuit }
  | { kind: "forces"; data: GuideForces }
  | { kind: "geometry"; data: GuideGeometry }
  | { kind: "code"; data: GuideCode }
  | { kind: "facts"; data: GuideFacts }
  | { kind: "image"; data: GuideImage };

export type VisualKind = VisualSpec["kind"];

/** Short, human name per kind — the minimized board's label and the pin's caption. */
export const VISUAL_LABEL: Record<VisualKind, string> = {
  math: "Equation",
  table: "Table",
  list: "List",
  chart: "Chart",
  timeline: "Timeline",
  scale: "Scale",
  diagram: "Diagram",
  venn: "Venn diagram",
  graph: "Graph",
  atom: "Atom",
  periodic: "Periodic table",
  molecule: "Molecule",
  circuit: "Circuit",
  forces: "Forces",
  geometry: "Figure",
  code: "Code",
  facts: "Fast facts",
  image: "Picture",
};

/** The one visual a step carries, if any. Order matches the server's priority. */
export function visualOf(step: GuideStep): VisualSpec | null {
  if (step.table) return { kind: "table", data: step.table };
  if (step.list) return { kind: "list", data: step.list };
  if (step.chart) return { kind: "chart", data: step.chart };
  if (step.timeline) return { kind: "timeline", data: step.timeline };
  if (step.scale) return { kind: "scale", data: step.scale };
  if (step.diagram) return { kind: "diagram", data: step.diagram };
  if (step.venn) return { kind: "venn", data: step.venn };
  if (step.graph) return { kind: "graph", data: step.graph };
  if (step.atom) return { kind: "atom", data: step.atom };
  if (step.periodic) return { kind: "periodic", data: step.periodic };
  if (step.molecule) return { kind: "molecule", data: step.molecule };
  if (step.circuit) return { kind: "circuit", data: step.circuit };
  if (step.forces) return { kind: "forces", data: step.forces };
  if (step.geometry) return { kind: "geometry", data: step.geometry };
  if (step.code) return { kind: "code", data: step.code };
  if (step.facts) return { kind: "facts", data: step.facts };
  if (step.image) return { kind: "image", data: step.image };
  if (step.draw) return { kind: "math", data: { latex: step.draw, labels: step.draw_labels, replace: step.draw_mode === "replace" } };
  return null;
}

/** Identity of a visual, so the board can tell "the same thing again" from "something new". */
export function visualKey(spec: VisualSpec | null): string {
  if (!spec) return "";
  if (spec.kind === "math") return "math:" + spec.data.latex;
  if (spec.kind === "molecule") return "molecule:" + spec.data.smiles;
  if (spec.kind === "image") return "image:" + spec.data.query;
  // the same list with the highlight on another item is still the same list
  if (spec.kind === "list") return "list:" + JSON.stringify({ ...spec.data, focus: undefined });
  return spec.kind + ":" + JSON.stringify(spec.data);
}


export interface GuideTarget {
  block: string | null;
  quote: string;
  /** "Draw me that": the answer may also put a visual on the board. */
  visual?: VisualSpec | null;
  /** The parts of that visual the answer names ("point at the gold band"). */
  point?: GuidePoint[] | null;
}

export interface GuideTurn {
  role: "user" | "assistant";
  text: string;
}

async function post(path: string, body: unknown, signal?: AbortSignal): Promise<Response> {
  const token = getAuthToken();
  const res = await authFetch(`${API_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(typeof err.detail === "string" ? err.detail : `Request failed (${res.status})`);
  }
  return res;
}

/**
 * Stream the walkthrough for one section. Steps arrive one at a time so the
 * guide can start talking before the whole script exists. Resolves with every
 * step once the stream ends; rejects only if nothing usable arrived.
 */
export async function streamGuideScript(
  sessionId: string,
  topicDbId: number,
  body: { title: string; blocks: GuideBlockPayload[]; outline: string[]; force?: boolean },
  handlers: { onStep: (step: GuideStep) => void; signal?: AbortSignal },
): Promise<{ steps: GuideStep[]; cached: boolean }> {
  const res = await post(`/study-sessions/${sessionId}/topics/${topicDbId}/guide/script`, body, handlers.signal);
  const steps: GuideStep[] = [];
  let cached = false;
  let error: string | null = null;
  await readSSE(res, (event, data) => {
    if (event === "step") {
      const s = JSON.parse(data) as GuideStep;
      steps.push(s);
      handlers.onStep(s);
    } else if (event === "done") {
      cached = Boolean(JSON.parse(data).cached);
    } else if (event === "error") {
      error = JSON.parse(data).message ?? "AnotherNotes AI couldn't prepare this section.";
    }
  });
  if (!steps.length && error) throw new Error(error);
  return { steps, cached };
}

/**
 * Ask a question about the section. `onTarget` fires first (move the pointer),
 * then `onText` for each spoken delta. Resolves with the full answer.
 */
export async function streamGuideAnswer(
  sessionId: string,
  topicDbId: number,
  body: {
    title: string;
    blocks: GuideBlockPayload[];
    question: string;
    current_block: string | null;
    history: GuideTurn[];
  },
  handlers: {
    onTarget: (t: GuideTarget) => void;
    onText: (delta: string) => void;
    /** The answer wasn't in the notes, so it was appended to the section; `notes` is the new full text. */
    onNotesUpdated?: (u: { notes: string; addition: string }) => void;
    signal?: AbortSignal;
  },
): Promise<string> {
  const res = await post(`/study-sessions/${sessionId}/topics/${topicDbId}/guide/ask`, body, handlers.signal);
  let answer = "";
  let collected = "";
  let error: string | null = null;
  await readSSE(res, (event, data) => {
    if (event === "target") handlers.onTarget(JSON.parse(data) as GuideTarget);
    else if (event === "text") {
      const delta = String(JSON.parse(data).delta ?? "");
      collected += delta;
      handlers.onText(delta);
    } else if (event === "notes_updated") {
      const u = JSON.parse(data);
      handlers.onNotesUpdated?.({ notes: String(u.notes ?? ""), addition: String(u.addition ?? "") });
    } else if (event === "done") answer = String(JSON.parse(data).answer ?? "");
    else if (event === "error") error = JSON.parse(data).message ?? "AnotherNotes AI couldn't answer that.";
  });
  if (!collected && error) throw new Error(error);
  return answer || collected;
}

export interface GuideVoice {
  id: string;
  name: string;
  lang: string;
  desc: string;
  gender?: "female" | "male" | null;
}

export interface GuideVoices {
  /** "speechify" | "elevenlabs" | "edge" | "openai", or "browser" when no natural voice is available. */
  provider: string;
  default: string | null;
  /** The two voices on offer: a woman's and a man's, the default first. */
  voices: GuideVoice[];
}

/** The natural voice serving Teach mode right now. Never throws. */
export async function fetchGuideVoices(): Promise<GuideVoices> {
  const token = getAuthToken();
  try {
    const res = await authFetch(`${API_URL}/guide/voices`, { headers: token ? { Authorization: `Bearer ${token}` } : undefined });
    if (!res.ok) throw new Error(String(res.status));
    return (await res.json()) as GuideVoices;
  } catch {
    return { provider: "browser", default: null, voices: [] };
  }
}

/**
 * One sentence → an MP3 clip in the chosen natural voice. Resolves as soon as the
 * headers are in: the server sends the audio as it is synthesised, and the narrator
 * (src/lib/guide/speech.ts) plays the body while it is still arriving.
 */
export async function synthesizeSpeech(text: string, voice: string | null, signal?: AbortSignal): Promise<Response> {
  const token = getAuthToken();
  const res = await authFetch(`${API_URL}/guide/tts`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ text, voice }),
    signal,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(typeof err.detail === "string" ? err.detail : `Speech failed (${res.status})`);
  }
  return res;
}

/** Short facts about the material being turned into notes, to read while it builds. Never throws. */
export async function fetchLoadingFacts(
  input: { text?: string; youtube_url?: string; title?: string },
  signal?: AbortSignal,
): Promise<{ facts: string[]; subject: string }> {
  const token = getAuthToken();
  try {
    const res = await authFetch(`${API_URL}/guide/facts`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(input),
      signal,
    });
    if (!res.ok) throw new Error(String(res.status));
    const data = await res.json();
    return { facts: Array.isArray(data.facts) ? data.facts.map(String) : [], subject: String(data.subject ?? "") };
  } catch {
    return { facts: [], subject: "" };
  }
}

/* ---- Where the parts of a picture are ------------------------------------------
   The lesson writer can't see, so a step only says which part it's about ("the gold
   band"). The server asks a vision model where that part is in the picture and
   caches the answer; until the model is switched on it answers `enabled: false`, and
   from then on this session stops asking. Nothing here ever throws: without a region
   the board outlines the whole picture and the pointer waits beside it. */

/** What the server (or the dev gallery's stand-in) answers for one picture. */
export type ImagePartsSource = (
  url: string,
  labels: string[],
  ctx: ImagePartsContext,
) => Promise<{ enabled: boolean; regions: Record<string, unknown> } | null>;

/** Helps the locator tell the right thing apart: what the picture was searched for, and what's being said. */
export interface ImagePartsContext {
  query?: string;
  match?: string[];
  caption?: string;
  context?: string;
}

/** Set once the server says the locator is off (or isn't there): no more calls this session. */
let visionOff = false;
/** One answer per picture + label, so a part is only looked up once. Null = not found. */
const partCache = new Map<string, Promise<GuideRegion | null>>();
const partKey = (url: string, label: string) => `${label.trim().toLowerCase()}\n${url}`;
let partsSource: ImagePartsSource | null = null;
const PARTS_TIMEOUT_MS = 25_000;

/** Dev gallery only: answer part lookups from `fn` instead of the server (null puts the server back). */
export function overrideImageParts(fn: ImagePartsSource | null): void {
  partsSource = fn;
  visionOff = false;
  partCache.clear();
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/** A region the board can trust: four numbers inside the picture, a point on it, and no guesses. */
function cleanRegion(v: unknown): GuideRegion | null {
  if (!v || typeof v !== "object") return null;
  const r = v as { box?: unknown; point?: unknown; confidence?: unknown };
  const nums = (a: unknown, n: number): a is number[] =>
    Array.isArray(a) && a.length === n && a.every((x) => typeof x === "number" && Number.isFinite(x));
  if (!nums(r.box, 4) || !nums(r.point, 2)) return null;
  if (r.confidence !== "high" && r.confidence !== "medium") return null;
  const x = clamp01(r.box[0]);
  const y = clamp01(r.box[1]);
  const w = Math.min(r.box[2], 1 - x);
  const h = Math.min(r.box[3], 1 - y);
  if (!(w > 0) || !(h > 0)) return null;
  // the point belongs on the part, so it's kept inside the box
  const px = Math.max(x, Math.min(x + w, r.point[0]));
  const py = Math.max(y, Math.min(y + h, r.point[1]));
  return { box: [x, y, w, h], point: [px, py], confidence: r.confidence };
}

/** Ask the server once for several labels. Null when the call failed (so it can be tried again). */
async function requestParts(url: string, labels: string[], ctx: ImagePartsContext): Promise<Record<string, GuideRegion> | null> {
  let data: { enabled?: unknown; regions?: unknown } | null = null;
  if (partsSource) {
    const source = partsSource;
    data = await Promise.resolve()
      .then(() => source(url, labels, ctx))
      .catch(() => null);
  } else {
    const token = getAuthToken();
    const abort = new AbortController();
    const timer = window.setTimeout(() => abort.abort(), PARTS_TIMEOUT_MS);
    try {
      const res = await authFetch(`${API_URL}/guide/image/parts`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ url, labels, ...ctx }),
        signal: abort.signal,
      });
      // A server without the endpoint can't locate anything, today or on the next step.
      if (res.status === 404) visionOff = true;
      if (!res.ok) return res.status === 404 ? {} : null;
      data = await res.json();
    } catch {
      return null;
    } finally {
      window.clearTimeout(timer);
    }
  }
  if (!data || typeof data !== "object") return null;
  if (data.enabled === false) {
    visionOff = true;
    return {};
  }
  const out: Record<string, GuideRegion> = {};
  const regions = data.regions && typeof data.regions === "object" ? (data.regions as Record<string, unknown>) : {};
  const byLower = new Map(Object.entries(regions).map(([k, v]) => [k.trim().toLowerCase(), v]));
  for (const label of labels) {
    const region = cleanRegion(regions[label] ?? byLower.get(label.trim().toLowerCase()));
    if (region) out[label] = region;
  }
  return out;
}

/**
 * Where each named part is in the picture at `url`, keyed by label; labels it couldn't
 * find are left out. One lookup per picture + label, however often it's asked for.
 * Never throws, and answers {} straight away once the locator is known to be off.
 */
export async function fetchImageParts(url: string, labels: string[], ctx: ImagePartsContext = {}): Promise<Record<string, GuideRegion>> {
  const wanted = [...new Set(labels.map((l) => (typeof l === "string" ? l.trim() : "")).filter(Boolean))].slice(0, 3);
  if (!url || !wanted.length || visionOff) return {};
  const missing = wanted.filter((l) => !partCache.has(partKey(url, l)));
  if (missing.length) {
    const request = requestParts(url, missing, ctx);
    for (const label of missing) {
      const key = partKey(url, label);
      const one: Promise<GuideRegion | null> = request.then((found) => {
        if (!found && partCache.get(key) === one) partCache.delete(key); // a failed call shouldn't stick
        return found?.[label] ?? null;
      });
      partCache.set(key, one);
    }
  }
  const found = await Promise.all(wanted.map((l) => partCache.get(partKey(url, l)) ?? Promise.resolve(null)));
  const out: Record<string, GuideRegion> = {};
  wanted.forEach((label, i) => {
    const region = found[i];
    if (region) out[label] = region;
  });
  return out;
}

/** What a step's picture can tell the locator about itself. */
export function imagePartsContext(step: Pick<GuideStep, "image" | "say">): ImagePartsContext {
  const image = step.image;
  return { query: image?.query, match: image?.match, caption: image?.caption, context: step.say ? step.say.slice(0, 400) : undefined };
}

/** Start finding a coming step's picture parts while the current step is still being explained. */
export function prefetchImageParts(step: Pick<GuideStep, "image" | "point" | "say"> | null | undefined): void {
  const url = step?.image?.url;
  const labels = (step?.point ?? []).map((p) => p?.label).filter((l): l is string => typeof l === "string" && !!l.trim());
  if (!step || !url || !labels.length || visionOff) return;
  void fetchImageParts(url, labels, imagePartsContext(step));
}

/** Speech → text via the backend's local whisper (fallback when the browser has no recognizer). */
export async function transcribeAudio(blob: Blob, language?: string): Promise<string> {
  const token = getAuthToken();
  const form = new FormData();
  const ext = blob.type.includes("ogg") ? "ogg" : blob.type.includes("mp4") ? "m4a" : blob.type.includes("wav") ? "wav" : "webm";
  form.append("audio", blob, `question.${ext}`);
  const qs = language ? `?language=${encodeURIComponent(language)}` : "";
  const res = await authFetch(`${API_URL}/guide/transcribe${qs}`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: form,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(typeof err.detail === "string" ? err.detail : "Couldn't transcribe that.");
  }
  return String((await res.json()).text ?? "");
}
