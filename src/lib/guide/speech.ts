/**
 * Speech in and out for Teach mode, all driven from the browser.
 *
 *  - Narrator: text → speech through the backend's natural voice (`/guide/tts`):
 *    each sentence is fetched as a small MP3 clip that starts playing while it is
 *    still arriving (the server streams it as Speechify synthesises it), upcoming
 *    sentences are prefetched so playback has no gaps, and the speed control is
 *    applied client-side. Every sentence is cut into runs by language
 *    (src/lib/guide/lang.ts) and each run is asked for in its own language, so
 *    Arabic notes are read by the Arabic voice and a French quote by the French
 *    one; the server says who read it (X-Voice-Name / X-Voice-Lang) and the
 *    narrator passes that on (`onVoice`). It is the tutor's only voice: when a
 *    clip can't be had, that line's caption is paced silently and the next line
 *    asks the server again. The browser's own voices are never used.
 *  - Speech → text: the on-device recognizer where the browser has one
 *    (Chrome/Edge/Safari), else a short MediaRecorder clip the backend
 *    transcribes with local whisper. `sttSupport()` tells you which.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { speechRuns } from "./lang";
import { splitSentences } from "./sentences";

// The sentence cutter lives in ./sentences (pure, tested under Node); re-exported for
// the callers that always took it from here.
export { splitSentences };

export function ttsAvailable(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined";
}

export function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    if (!ttsAvailable()) return resolve([]);
    const synth = window.speechSynthesis;
    const now = synth.getVoices();
    if (now.length) return resolve(now);
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      resolve(synth.getVoices());
    };
    synth.addEventListener?.("voiceschanged", finish, { once: true } as AddEventListenerOptions);
    window.setTimeout(finish, 1500);
  });
}

/** Browser voices best-sounding first for `lang` (defaults to the browser language). */
function rankVoices(voices: SpeechSynthesisVoice[], lang = navigator.language || "en-US"): SpeechSynthesisVoice[] {
  const base = lang.toLowerCase().split("-")[0];
  const score = (v: SpeechSynthesisVoice) => {
    const name = v.name.toLowerCase();
    let s = 0;
    if (v.lang.toLowerCase().startsWith(base)) s += 50;
    if (v.lang.toLowerCase() === lang.toLowerCase()) s += 8;
    if (/natural|neural|online|premium|enhanced/.test(name)) s += 30;
    if (/google (us|uk) english/.test(name)) s += 25;
    if (/aria|jenny|zira|samantha|karen|daniel|libby|sonia|ava|allison/.test(name)) s += 20;
    if (v.default) s += 5;
    if (/espeak|compact/.test(name)) s -= 20;
    return s;
  };
  return [...voices].sort((a, b) => score(b) - score(a));
}

/** Best-sounding browser voice for `lang` (defaults to the browser language). */
export function pickVoice(voices: SpeechSynthesisVoice[], lang?: string): SpeechSynthesisVoice | null {
  return rankVoices(voices, lang)[0] ?? null;
}

export type VoiceGender = "female" | "male";

// Browsers don't say whose voice it is, but the common ones are well known
// (Windows, Edge's online voices, Chrome's Google voices, macOS).
const FEMALE_VOICE =
  /\b(female|zira|aria|jenny|michelle|ava|emma|sonia|libby|natasha|neerja|heera|hazel|susan|catherine|linda|samantha|karen|moira|tessa|victoria|allison|fiona|serena|google us english)\b/i;
const MALE_VOICE = /\b(male|david|mark|guy|andrew|brian|christopher|eric|roger|steffan|ryan|george|james|ravi|richard|sean|daniel|alex|fred|oliver|thomas|aaron|arthur)\b/i;

/** Whose voice a browser voice is, going by its name; null when we can't tell. */
export function voiceGender(name: string): VoiceGender | null {
  if (FEMALE_VOICE.test(name)) return "female";
  if (MALE_VOICE.test(name)) return "male";
  return null;
}

/** "Microsoft Guy Online (Natural) - English (United States)" → "Guy". */
export function browserVoiceName(name: string): string {
  return (
    name
      .replace(/^(Microsoft|Google) /, "")
      .replace(/ - .*$/, "")
      .replace(/ (Online|Desktop)\b| \(.*\)$/g, "")
      .trim() || name
  );
}

/** The two browser voices to offer: the best woman's and man's voice (the top two when we can't tell). */
export function browserVoicePair(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice[] {
  const ranked = rankVoices(voices);
  const pair = (["female", "male"] as const)
    .map((g) => ranked.find((v) => voiceGender(v.name) === g))
    .filter((v): v is SpeechSynthesisVoice => !!v);
  for (const v of ranked) {
    if (pair.length >= 2) break;
    if (!pair.includes(v)) pair.push(v);
  }
  return pair;
}

/** Fetch one run of text, in `lang` (a base code such as "ar"), as an audio clip in the
 *  given server voice: a Response whose body streams the MP3 as the server synthesises
 *  it. A 422 for a language without a voice is thrown as an Error named "NoVoiceError". */
export type SynthFn = (text: string, voice: string, lang: string, signal?: AbortSignal) => Promise<Response>;

/** Who read a clip and in which language (a base code), from the server's headers. */
export interface SpokenBy {
  name: string;
  lang: string;
}

/** The X-Voice-Name / X-Voice-Lang headers of a clip (the name is percent-encoded when it
 *  isn't ASCII); null when the response doesn't say. */
function spokenBy(res: Response): SpokenBy | null {
  const raw = res.headers.get("x-voice-name");
  const lang = res.headers.get("x-voice-lang");
  if (!raw || !lang) return null;
  let name = raw;
  try {
    name = decodeURIComponent(raw);
  } catch {
    /* the plain header */
  }
  return { name, lang };
}

const CLIP_CACHE_MAX = 80;

/** What `clip()` hands back: the whole clip (for the cache and for replays), plus, when the
 *  request was made just now and this browser can play MP3 through MediaSource, the live
 *  byte stream so the sentence can start before it has all arrived. */
interface ClipRequest {
  blob: Promise<Blob>;
  live: Promise<ReadableStream<Uint8Array> | null>;
  /** Who read it, once the response headers are in. */
  spoken: Promise<SpokenBy | null>;
}

/** Can this browser play an MP3 that is still arriving? (iOS Safari before 17.1 cannot.) */
function canStreamMp3(): boolean {
  try {
    return typeof MediaSource !== "undefined" && MediaSource.isTypeSupported("audio/mpeg");
  } catch {
    return false;
  }
}

/**
 * Feed a byte stream into a MediaSource as it arrives. Returns a function that stops the
 * pump (the stream's reader is cancelled; a teed twin keeps filling the cache).
 */
function pumpIntoMediaSource(ms: MediaSource, stream: ReadableStream<Uint8Array>): () => void {
  const reader = stream.getReader();
  let cancelled = false;
  const endStream = (error?: EndOfStreamError) => {
    try {
      if (ms.readyState === "open") ms.endOfStream(error);
    } catch {
      /* already ended */
    }
  };
  ms.addEventListener(
    "sourceopen",
    async () => {
      let sb: SourceBuffer;
      try {
        sb = ms.addSourceBuffer("audio/mpeg");
        try {
          sb.mode = "sequence"; // MP3 frames carry no timestamps; play them in arrival order
        } catch {
          /* the default for this byte-stream format is already sequence */
        }
      } catch {
        endStream("decode");
        void reader.cancel().catch(() => undefined);
        return;
      }
      const append = (chunk: Uint8Array) =>
        new Promise<void>((resolve, reject) => {
          const done = () => {
            sb.removeEventListener("updateend", done);
            sb.removeEventListener("error", fail);
            resolve();
          };
          const fail = () => {
            sb.removeEventListener("updateend", done);
            sb.removeEventListener("error", fail);
            reject(new Error("append failed"));
          };
          sb.addEventListener("updateend", done);
          sb.addEventListener("error", fail);
          try {
            sb.appendBuffer(chunk);
          } catch (e) {
            fail();
            reject(e);
          }
        });
      try {
        for (;;) {
          const { value, done } = await reader.read();
          if (cancelled) return;
          if (done) break;
          if (value?.byteLength) await append(value);
        }
        if (!cancelled) endStream();
      } catch {
        if (!cancelled) endStream("network");
      }
    },
    { once: true },
  );
  return () => {
    cancelled = true;
    void reader.cancel().catch(() => undefined);
  };
}

/**
 * A single <audio> element, unlocked on the first user gesture and reused for every
 * server voice clip. Browsers block a programmatic `.play()` on a fresh element on a
 * real https origin (autoplay policy); an element that has already played once inside a
 * user gesture stays allowed, so we prime this one on any tap/click/key and reuse it.
 */
const SILENT_WAV_B64 =
  "UklGRgQCAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YeABAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIA=";
let silentClipUrl: string | null = null;
/** A short silent clip as a blob: URL (the deployed CSP allows blob: but not data: for media). */
function silentClip(): string {
  if (silentClipUrl === null) {
    try {
      const bin = atob(SILENT_WAV_B64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      silentClipUrl = URL.createObjectURL(new Blob([bytes], { type: "audio/wav" }));
    } catch {
      silentClipUrl = "";
    }
  }
  return silentClipUrl;
}
let sharedAudio: HTMLAudioElement | null = null;
let audioPrimed = false;
/** Which clip owns the shared <audio> right now: a finished or cancelled clip must never pause or unhook the next one. */
let clipToken = 0;

/*
  One voice at a time, everywhere. Every Narrator registers here, and whichever
  starts speaking silences the others first: a Teach mode that closed while its
  voice list was still loading, a second instance, or Teach mode open in another
  tab (told over a BroadcastChannel). Two voices talking over each other is never
  acceptable.
*/
const narrators = new Set<Narrator>();
const TAB_ID = Math.random().toString(36).slice(2);
let voiceChannel: BroadcastChannel | null | undefined;

function channel(): BroadcastChannel | null {
  if (voiceChannel !== undefined) return voiceChannel;
  voiceChannel = null;
  if (typeof BroadcastChannel === "undefined") return null;
  try {
    voiceChannel = new BroadcastChannel("anothernotes-voice");
    voiceChannel.onmessage = (e: MessageEvent) => {
      if (e.data?.type === "speaking" && e.data.tab !== TAB_ID) narrators.forEach((n) => n.preempt());
    };
  } catch {
    voiceChannel = null;
  }
  return voiceChannel;
}

/** `owner` is about to speak: everyone else, here and in other tabs, goes quiet. */
function claimVoice(owner: Narrator): void {
  narrators.forEach((n) => n !== owner && n.preempt());
  try {
    channel()?.postMessage({ type: "speaking", tab: TAB_ID });
  } catch {
    /* ignore */
  }
}

/** Stop whatever is sounding right now, whoever started it. */
function silenceAll(browserVoice: boolean): void {
  clipToken++;
  if (sharedAudio) {
    try {
      sharedAudio.pause();
    } catch {
      /* ignore */
    }
    sharedAudio.onended = null;
    sharedAudio.onerror = null;
  }
  if (browserVoice) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      /* ignore */
    }
  }
}

/** A speaking style's prosody (backend speaking_styles.json), relative to the lesson's own rate and pitch. */
export interface Tone {
  rate: number;
  pitch: number;
}

/**
 * The tutor always sounds relaxed: a speaking style may slow a line down or soften it,
 * but never hurry it or lift it much (the styles file asks up to 6% faster and 8% higher
 * for a "surprise" line). Applied to cached lessons too, since it happens when speaking.
 */
const RELAXED_MAX_RATE = 1.02;
const RELAXED_MAX_PITCH = 1.03;
const relaxed = (tone?: Tone | null): Tone | null =>
  tone ? { rate: Math.min(tone.rate, RELAXED_MAX_RATE), pitch: Math.min(tone.pitch, RELAXED_MAX_PITCH) } : null;

/** The shared audio element, created on first use. */
export function speechAudioElement(): HTMLAudioElement {
  if (!sharedAudio) {
    sharedAudio = new Audio();
    (sharedAudio as HTMLAudioElement & { preservesPitch?: boolean }).preservesPitch = true;
  }
  return sharedAudio;
}

/**
 * Unlock audio playback. Call synchronously from a user gesture (click/tap/key) — e.g.
 * the "Teach me" button — so later clips can play on their own. Safe to call repeatedly.
 */
export function primeSpeechAudio(): void {
  if (audioPrimed) return;
  const a = speechAudioElement();
  try {
    a.muted = true;
    a.src = silentClip();
    const p = a.play();
    if (p && typeof p.then === "function") {
      p.then(() => {
        try {
          a.pause();
          a.currentTime = 0;
        } catch {
          /* ignore */
        }
        a.muted = false;
        audioPrimed = true;
      }).catch(() => {
        a.muted = false;
      });
    } else {
      a.muted = false;
      audioPrimed = true;
    }
  } catch {
    a.muted = false;
  }
}

export class Narrator {
  pitch = 1.02;
  /** Browser voice: used when no server voice is set, or as the fallback. */
  voice: SpeechSynthesisVoice | null = null;
  /** Server (natural) voice id; null = speak with the browser voice. */
  serverVoice: string | null = null;
  /** False when there's no synthesizer (or it has no voices): captions are paced instead. */
  available = ttsAvailable();

  /** The language the lesson is in (a base code such as "en" or "ar"): the hint each
   *  sentence's runs are judged against. Set by whoever knows the notes (Teach mode, per
   *  section); "en" until then. */
  lang = "en";
  /** Called with who is reading and in which language, from the server's headers, each
   *  time that changes (the dock shows "in Arabic as Ismail"). */
  onVoice?: (voice: SpokenBy) => void;
  private lastSpoken = "";

  private rateValue = 1;
  private synth?: SynthFn;
  private clips = new Map<string, { blob: Promise<Blob>; spoken: Promise<SpokenBy | null> }>();
  private gen = 0;
  private keep: SpeechSynthesisUtterance[] = []; // Chrome GCs utterances mid-speech otherwise
  private timer: number | undefined;
  /** Settles a paced (voiceless) line early when it's cancelled. */
  private pacedDone: (() => void) | undefined;
  private onCaption?: (text: string | null) => void;
  /** True from the start of a `speak()` until it settles. */
  private active = false;
  /** Set by `dispose()`: this narrator never makes a sound again. */
  private disposed = false;
  /** The current line's speaking style. */
  private tone: Tone | null = null;
  /** While the browser voice is mid-sentence: pick the sentence up again at the new speed. */
  private rerate: (() => void) | undefined;
  /** Called when someone else (another narrator, another tab) takes the voice mid-line. */
  onPreempted?: () => void;

  constructor(opts: { onCaption?: (text: string | null) => void } = {}) {
    this.onCaption = opts.onCaption;
    narrators.add(this);
    channel();
    if (typeof document !== "undefined") {
      const events = ["pointerdown", "touchstart", "keydown"];
      const listenerOpts = { capture: true, passive: true } as AddEventListenerOptions;
      const prime = () => {
        primeSpeechAudio();
        for (const ev of events) document.removeEventListener(ev, prime, listenerOpts);
      };
      for (const ev of events) document.addEventListener(ev, prime, listenerOpts);
    }
  }

  get rate(): number {
    return this.rateValue;
  }
  /**
   * The speed button. It takes effect at once, not from the next sentence: the natural
   * voice's clip just plays faster or slower (keeping the line's own style), and the
   * browser voice - which can't change speed mid-utterance - carries on from the word
   * it's on at the new speed.
   */
  set rate(r: number) {
    this.rateValue = r;
    if (sharedAudio) sharedAudio.playbackRate = r * (this.tone?.rate ?? 1);
    this.rerate?.();
  }

  /** Route speech through the backend's natural voice. */
  useServer(fn: SynthFn): void {
    this.synth = fn;
  }

  get serverActive(): boolean {
    return !!(this.serverVoice && this.synth);
  }

  /** Kept for callers: a failed line no longer takes the natural voice away, so there is
   *  nothing to reset when the student picks one. */
  resetServer(): void {}

  /** Warm the clip cache for text that will be spoken soon. */
  prefetch(text: string, sentences = 1): void {
    if (!this.serverActive) return;
    for (const s of splitSentences(text).slice(0, sentences)) this.prefetchSentence(s);
  }

  private prefetchSentence(sentence: string): void {
    for (const run of speechRuns(sentence, this.lang)) void this.clip(run.text, run.lang).blob.catch(() => undefined);
  }

  /** Tell the page who is reading, once per change of voice. */
  private announce(v: SpokenBy): void {
    const key = `${v.name}|${v.lang}`;
    if (key === this.lastSpoken) return;
    this.lastSpoken = key;
    this.onVoice?.(v);
  }

  /** Stop speaking immediately; any in-flight `speak()` resolves false. */
  cancel(): void {
    this.gen++;
    this.active = false;
    if (this.timer) {
      window.clearTimeout(this.timer);
      this.timer = undefined;
    }
    const paced = this.pacedDone;
    this.pacedDone = undefined;
    paced?.();
    silenceAll(this.available);
    this.keep = [];
  }

  /** Someone else is about to speak: stop, and tell the owner if we were mid-line. */
  preempt(): void {
    const wasSpeaking = this.active;
    this.cancel();
    if (wasSpeaking) this.onPreempted?.();
  }

  /** For good: this narrator's lesson is gone. Nothing it was saying, or is asked to say, is heard. */
  dispose(): void {
    this.disposed = true;
    this.cancel();
    narrators.delete(this);
  }

  /**
   * Speak `text` sentence by sentence, in `tone` (a speaking style's pace and pitch).
   * Resolves true when it finished, false if cancelled. Whatever else was sounding -
   * this narrator's last line, another narrator, another tab - stops first.
   */
  async speak(text: string, tone?: Tone | null): Promise<boolean> {
    if (this.disposed) return false;
    const gen = ++this.gen;
    claimVoice(this);
    silenceAll(this.available);
    this.tone = relaxed(tone);
    this.active = true;
    try {
      const parts = splitSentences(text);
      if (this.serverActive) parts.slice(1, 4).forEach((s) => this.prefetchSentence(s));
      for (const sentence of parts) {
        if (gen !== this.gen) return false;
        this.onCaption?.(sentence);
        const ok = await this.one(sentence, gen);
        if (!ok) return false;
      }
      return gen === this.gen;
    } finally {
      if (gen === this.gen) this.active = false;
    }
  }

  /*
    A sentence is read run by run, each run in its own language's voice (an Arabic
    sentence is one run; "the French call it liberté" is two). One failed clip is
    usually a blip rather than an outage, so a run is tried again; if it still fails, or
    the server has no voice for that language (a 422 that says so - not worth a retry),
    its words are paced silently and the next run asks the server again. The browser's
    own voices are never used: Speechify is the tutor's only voice, and a tutor that
    switches to a Microsoft voice mid-lesson is worse than one that goes quiet for a
    line.
  */
  private async one(sentence: string, gen: number): Promise<boolean> {
    if (!this.serverActive) return this.paceCaption(sentence, gen);
    for (const run of speechRuns(sentence, this.lang)) {
      if (gen !== this.gen) return false;
      if (!(await this.oneRun(run.text, run.lang, gen))) return false;
    }
    return gen === this.gen;
  }

  private async oneRun(text: string, lang: string, gen: number): Promise<boolean> {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return await this.oneServer(text, lang, gen);
      } catch (e) {
        if (gen !== this.gen) return false;
        if ((e as Error)?.name === "NoVoiceError") break;
      }
    }
    return this.paceCaption(text, gen);
  }

  private inflight = 0;
  private waiting: Array<() => void> = [];

  /** Fetch (or reuse) the clip for one run of text in `lang`. At most two synth requests
   *  run at once so prefetches never slow down the sentence that's needed right now.
   *  For an urgent request the live byte stream is handed back too (see ClipRequest),
   *  teed off the same response the cache is filled from. */
  private clip(sentence: string, lang: string, urgent = false): ClipRequest {
    const voice = this.serverVoice!;
    const key = `${voice}|${lang}|${sentence}`;
    const hit = this.clips.get(key);
    if (hit) return { blob: hit.blob, live: Promise.resolve(null), spoken: hit.spoken };
    let resolveLive: (s: ReadableStream<Uint8Array> | null) => void = () => undefined;
    const live = new Promise<ReadableStream<Uint8Array> | null>((r) => (resolveLive = r));
    let resolveSpoken: (v: SpokenBy | null) => void = () => undefined;
    const spoken = new Promise<SpokenBy | null>((r) => (resolveSpoken = r));
    const run = async (): Promise<Blob> => {
      if (this.inflight >= 2) await new Promise<void>((r) => (urgent ? this.waiting.unshift(r) : this.waiting.push(r)));
      this.inflight++;
      try {
        const res = await this.synth!(sentence, voice, lang);
        resolveSpoken(spokenBy(res));
        const body = res.body;
        const headers = { "Content-Type": "audio/mpeg" };
        if (!body) {
          resolveLive(null);
          return await res.blob();
        }
        if (urgent && canStreamMp3()) {
          const [forPlayer, forCache] = body.tee();
          resolveLive(forPlayer);
          return await new Response(forCache, { headers }).blob();
        }
        resolveLive(null);
        return await new Response(body, { headers }).blob();
      } catch (e) {
        resolveLive(null);
        resolveSpoken(null);
        throw e;
      } finally {
        this.inflight--;
        this.waiting.shift()?.();
      }
    };
    const p = run();
    this.clips.set(key, { blob: p, spoken });
    p.catch(() => this.clips.delete(key));
    if (this.clips.size > CLIP_CACHE_MAX) {
      const oldest = this.clips.keys().next().value;
      if (oldest) this.clips.delete(oldest);
    }
    return { blob: p, live, spoken };
  }

  private async oneServer(text: string, lang: string, gen: number): Promise<boolean> {
    const { blob, live, spoken } = this.clip(text, lang, true);
    void spoken.then((v) => {
      if (v && gen === this.gen) this.announce(v);
    });
    // Resolves as soon as the response headers are in (a live stream), or once the
    // whole clip is here (cached, or a browser without MediaSource).
    let stream = await live;
    if (gen !== this.gen || this.disposed) {
      void stream?.cancel().catch(() => undefined);
      return false;
    }
    let url: string;
    let stopPump: () => void = () => undefined;
    if (stream) {
      const ms = new MediaSource();
      url = URL.createObjectURL(ms);
      stopPump = pumpIntoMediaSource(ms, stream);
    } else {
      const whole = await blob;
      if (gen !== this.gen || this.disposed) return false;
      url = URL.createObjectURL(whole);
    }
    const a = speechAudioElement();
    // This clip owns the element from here on. An earlier clip's guard or finish
    // checks the token and leaves this one alone: before, a cancelled line's
    // guard could pause the NEXT line (or unhook its onended) and freeze the lesson.
    const token = ++clipToken;
    const load = (src: string) => {
      a.onended = null;
      a.onerror = null;
      try {
        a.pause();
      } catch {
        /* ignore */
      }
      a.src = src;
      try {
        a.currentTime = 0;
      } catch {
        /* ignore */
      }
      a.muted = false;
      // A style's pace shows in the natural voice too (a calm line a touch slower,
      // a surprising one a touch quicker); its pitch only applies to the browser voice.
      a.playbackRate = this.rateValue * (this.tone?.rate ?? 1);
      (a as HTMLAudioElement & { preservesPitch?: boolean }).preservesPitch = true;
    };
    load(url);
    try {
      await a.play();
    } catch (e) {
      stopPump();
      URL.revokeObjectURL(url);
      if (!stream) throw e; // autoplay blocked or undecodable → browser fallback
      // MediaSource refused (some browsers claim MP3 support they don't have): play
      // the finished clip the ordinary way before giving up on the natural voice.
      stream = null;
      const whole = await blob;
      if (gen !== this.gen || this.disposed) return false;
      url = URL.createObjectURL(whole);
      load(url);
      try {
        await a.play();
      } catch (e2) {
        URL.revokeObjectURL(url);
        throw e2;
      }
    }
    return new Promise<boolean>((resolve) => {
      let settled = false;
      const finish = (ok: boolean) => {
        if (settled) return;
        settled = true;
        window.clearInterval(guard);
        if (clipToken === token) {
          a.onended = null;
          a.onerror = null;
        }
        stopPump();
        URL.revokeObjectURL(url);
        resolve(ok && gen === this.gen);
      };
      a.onended = () => finish(true);
      a.onerror = () => finish(true);
      const guard = window.setInterval(() => {
        if (gen !== this.gen || clipToken !== token) {
          if (clipToken === token) {
            try {
              a.pause();
            } catch {
              /* ignore */
            }
          }
          finish(false);
        }
      }, 150);
    });
  }

  /** No clip for this line: pace its caption as if it were being read. `cancel()` settles
   *  it (false) - clearing the timer alone left the line waiting forever. */
  private paceCaption(sentence: string, gen: number): Promise<boolean> {
    return new Promise((resolve) => {
      const ms = Math.max(1800, (sentence.split(/\s+/).length * 330) / this.rateValue);
      this.pacedDone = () => resolve(false);
      this.timer = window.setTimeout(() => {
        this.pacedDone = undefined;
        resolve(gen === this.gen);
      }, ms);
    });
  }
}

// ---------------------------------------------------------------------------
// Speech → text
// ---------------------------------------------------------------------------
const recognizerCtor = (): any =>
  (typeof window !== "undefined" && ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)) || null;

export type SttMode = "native" | "recorder" | "none";

/** Browsers only hand out the microphone on secure pages (https, or localhost). */
export const micBlockedByInsecurePage = (): boolean => typeof window !== "undefined" && !window.isSecureContext;

/**
 * The same page over https, when we're on a plain-http one.
 *
 * getUserMedia is refused on insecure origins by the browser itself — there is
 * no flag or permission we can ask for from here. The one thing we *can* do is
 * take the student to the https version of the page they're already on, which
 * the server also serves, and let them carry on there.
 */
export function secureUrlForThisPage(): string | null {
  if (typeof window === "undefined") return null;
  const loc = window.location;
  if (loc.protocol !== "http:") return null;
  if (loc.hostname === "localhost" || loc.hostname === "127.0.0.1") return null; // already a secure context
  return `https://${loc.host}${loc.pathname}${loc.search}${loc.hash}`;
}

export function sttSupport(): SttMode {
  if (micBlockedByInsecurePage()) return "none";
  if (recognizerCtor()) return "native";
  if (typeof navigator !== "undefined" && navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined") return "recorder";
  return "none";
}

export interface Recognizer {
  start(): void;
  /** Stop listening and deliver whatever was heard via onFinal. */
  stop(): void;
  /** Stop listening and discard the result. */
  abort(): void;
}

export function createNativeRecognizer(opts: {
  lang?: string;
  onInterim: (text: string) => void;
  onFinal: (text: string) => void;
  onError: (code: string) => void;
}): Recognizer {
  const Ctor = recognizerCtor();
  const rec = new Ctor();
  rec.lang = opts.lang || navigator.language || "en-US";
  rec.continuous = false; // ends itself after a pause: the fastest "done talking" signal
  rec.interimResults = true;
  rec.maxAlternatives = 1;
  let finalText = "";
  let ended = false;
  rec.onresult = (e: any) => {
    let interim = "";
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      if (r.isFinal) finalText += r[0].transcript;
      else interim += r[0].transcript;
    }
    opts.onInterim(`${finalText} ${interim}`.replace(/\s+/g, " ").trim());
  };
  rec.onerror = (e: any) => {
    if (ended) return;
    ended = true;
    opts.onError(String(e?.error || "unknown"));
  };
  rec.onend = () => {
    if (ended) return;
    ended = true;
    opts.onFinal(finalText.trim());
  };
  return {
    start: () => rec.start(),
    stop: () => {
      try {
        rec.stop();
      } catch {
        /* ignore */
      }
    },
    abort: () => {
      ended = true;
      try {
        rec.abort();
      } catch {
        /* ignore */
      }
    },
  };
}

export interface Recording {
  stop(): Promise<Blob>;
  cancel(): void;
}

/** Record a short clip from the microphone (for the whisper fallback). */
export async function startRecording(opts: { maxMs?: number; onAutoStop?: (blob: Blob) => void } = {}): Promise<Recording> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
  const mime =
    ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"].find((m) => MediaRecorder.isTypeSupported?.(m)) ?? "";
  const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
  const chunks: BlobPart[] = [];
  let finished = false;
  let cancelled = false;
  let blob: Blob | null = null;
  let resolveStop: ((b: Blob) => void) | null = null;

  rec.ondataavailable = (e) => {
    if (e.data.size) chunks.push(e.data);
  };
  rec.onstop = () => {
    if (finished) return;
    finished = true;
    stream.getTracks().forEach((t) => t.stop());
    if (cancelled) return;
    blob = new Blob(chunks, { type: rec.mimeType || mime || "audio/webm" });
    if (resolveStop) resolveStop(blob);
    else opts.onAutoStop?.(blob);
  };
  rec.start(250);
  const timer = window.setTimeout(() => {
    if (rec.state !== "inactive") rec.stop();
  }, opts.maxMs ?? 15_000);

  return {
    stop: () =>
      new Promise<Blob>((resolve) => {
        window.clearTimeout(timer);
        if (blob) return resolve(blob);
        resolveStop = resolve;
        if (rec.state !== "inactive") rec.stop();
      }),
    cancel: () => {
      cancelled = true;
      window.clearTimeout(timer);
      if (rec.state !== "inactive") rec.stop();
      else stream.getTracks().forEach((t) => t.stop());
    },
  };
}
