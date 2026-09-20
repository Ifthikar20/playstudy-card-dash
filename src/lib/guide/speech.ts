/**
 * Speech in and out for Teach mode, all driven from the browser.
 *
 *  - Narrator: text → speech. The preferred path is the backend's natural
 *    neural voice (`/guide/tts`): each sentence is fetched as a small MP3 clip,
 *    upcoming sentences are prefetched so playback has no gaps, and the speed
 *    control is applied client-side. If that voice is unavailable it falls back
 *    to the browser's own speechSynthesis, and with no synthesizer at all it
 *    paces the captions so the walkthrough still works silently.
 *  - Speech → text: the on-device recognizer where the browser has one
 *    (Chrome/Edge/Safari), else a short MediaRecorder clip the backend
 *    transcribes with local whisper. `sttSupport()` tells you which.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

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

/** Best-sounding browser voice for `lang` (defaults to the browser language). */
export function pickVoice(voices: SpeechSynthesisVoice[], lang = navigator.language || "en-US"): SpeechSynthesisVoice | null {
  if (!voices.length) return null;
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
  return [...voices].sort((a, b) => score(b) - score(a))[0] ?? null;
}

/** Split spoken text into sentence-sized utterances; very long ones break at clauses. */
export function splitSentences(text: string): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return [];
  const parts = clean.split(/(?<=[.!?…]["”’)]?)\s+(?=[^a-z])/);
  const out: string[] = [];
  for (const raw of parts) {
    const s = raw.trim();
    if (!s) continue;
    if (out.length && (s.length < 14 || /^[a-z]/.test(s))) out[out.length - 1] += ` ${s}`;
    else out.push(s);
  }
  return out.flatMap((s) => {
    if (s.length <= 220) return [s];
    return s.split(/(?<=[;:,])\s+/).reduce<string[]>((acc, piece) => {
      const last = acc[acc.length - 1];
      if (last && last.length + piece.length < 180) acc[acc.length - 1] = `${last} ${piece}`;
      else acc.push(piece);
      return acc;
    }, []);
  });
}

/** Fetch one sentence as an audio clip in the given server voice. */
export type SynthFn = (text: string, voice: string, signal?: AbortSignal) => Promise<Blob>;

const CLIP_CACHE_MAX = 80;

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
 * the "Teach mode" button — so later clips can play on their own. Safe to call repeatedly.
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

  private rateValue = 1;
  private synth?: SynthFn;
  /** Set once the natural voice has failed for good; see `one()`. */
  private serverDown = false;
  private clips = new Map<string, Promise<Blob>>();
  private gen = 0;
  private keep: SpeechSynthesisUtterance[] = []; // Chrome GCs utterances mid-speech otherwise
  private timer: number | undefined;
  private onCaption?: (text: string | null) => void;

  constructor(opts: { onCaption?: (text: string | null) => void } = {}) {
    this.onCaption = opts.onCaption;
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
  set rate(r: number) {
    this.rateValue = r;
    if (sharedAudio) sharedAudio.playbackRate = r;
  }

  /** Route speech through the backend's natural voice. */
  useServer(fn: SynthFn): void {
    this.synth = fn;
  }

  get serverActive(): boolean {
    return !!(this.serverVoice && this.synth) && !this.serverDown;
  }

  /** Called when the student picks a voice: give the natural one another chance. */
  resetServer(): void {
    this.serverDown = false;
  }

  /** Warm the clip cache for text that will be spoken soon. */
  prefetch(text: string, sentences = 1): void {
    if (!this.serverActive) return;
    for (const s of splitSentences(text).slice(0, sentences)) void this.clip(s).catch(() => undefined);
  }

  /** Stop speaking immediately; any in-flight `speak()` resolves false. */
  cancel(): void {
    this.gen++;
    if (this.timer) {
      window.clearTimeout(this.timer);
      this.timer = undefined;
    }
    if (sharedAudio) {
      try {
        sharedAudio.pause();
      } catch {
        /* ignore */
      }
      sharedAudio.onended = null;
      sharedAudio.onerror = null;
    }
    if (this.available) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        /* ignore */
      }
    }
    this.keep = [];
  }

  /** Speak `text` sentence by sentence. Resolves true when it finished, false if cancelled. */
  async speak(text: string): Promise<boolean> {
    const gen = ++this.gen;
    if (this.available) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        /* ignore */
      }
    }
    const parts = splitSentences(text);
    if (this.serverActive) parts.slice(1, 4).forEach((s) => void this.clip(s).catch(() => undefined));
    for (const sentence of parts) {
      if (gen !== this.gen) return false;
      this.onCaption?.(sentence);
      const ok = await this.one(sentence, gen);
      if (!ok) return false;
    }
    return gen === this.gen;
  }

  /*
    One failed clip is usually a blip rather than an outage, so try the sentence
    again before giving up on the natural voice - and once we have given up, stay
    on the browser voice for the rest of the lesson instead of flipping back a
    minute later. A narration that changes voice halfway through is harder to
    follow than one plain voice all the way.
  */
  private async one(sentence: string, gen: number): Promise<boolean> {
    if (this.serverActive) {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          return await this.oneServer(sentence, gen);
        } catch {
          if (gen !== this.gen) return false;
        }
      }
      this.serverDown = true;
    }
    return this.oneBrowser(sentence, gen);
  }

  private inflight = 0;
  private waiting: Array<() => void> = [];

  /** Fetch (or reuse) the clip for a sentence. At most two synth requests run at
   *  once so prefetches never slow down the sentence that's needed right now. */
  private clip(sentence: string, urgent = false): Promise<Blob> {
    const voice = this.serverVoice!;
    const key = `${voice}|${sentence}`;
    const hit = this.clips.get(key);
    if (hit) return hit;
    const run = async (): Promise<Blob> => {
      if (this.inflight >= 2) await new Promise<void>((r) => (urgent ? this.waiting.unshift(r) : this.waiting.push(r)));
      this.inflight++;
      try {
        return await this.synth!(sentence, voice);
      } finally {
        this.inflight--;
        this.waiting.shift()?.();
      }
    };
    const p = run();
    this.clips.set(key, p);
    p.catch(() => this.clips.delete(key));
    if (this.clips.size > CLIP_CACHE_MAX) {
      const oldest = this.clips.keys().next().value;
      if (oldest) this.clips.delete(oldest);
    }
    return p;
  }

  private async oneServer(sentence: string, gen: number): Promise<boolean> {
    const blob = await this.clip(sentence, true);
    if (gen !== this.gen) return false;
    const url = URL.createObjectURL(blob);
    const a = speechAudioElement();
    a.onended = null;
    a.onerror = null;
    try {
      a.pause();
    } catch {
      /* ignore */
    }
    a.src = url;
    try {
      a.currentTime = 0;
    } catch {
      /* ignore */
    }
    a.muted = false;
    a.playbackRate = this.rateValue;
    (a as HTMLAudioElement & { preservesPitch?: boolean }).preservesPitch = true;
    try {
      await a.play();
    } catch (e) {
      URL.revokeObjectURL(url);
      throw e; // autoplay blocked or undecodable → browser fallback
    }
    return new Promise<boolean>((resolve) => {
      let settled = false;
      const finish = (ok: boolean) => {
        if (settled) return;
        settled = true;
        window.clearInterval(guard);
        a.onended = null;
        a.onerror = null;
        URL.revokeObjectURL(url);
        resolve(ok && gen === this.gen);
      };
      a.onended = () => finish(true);
      a.onerror = () => finish(true);
      const guard = window.setInterval(() => {
        if (gen !== this.gen) {
          try {
            a.pause();
          } catch {
            /* ignore */
          }
          finish(false);
        }
      }, 150);
    });
  }

  private oneBrowser(sentence: string, gen: number): Promise<boolean> {
    if (!this.available) {
      // No synthesizer: pace the caption as if it were being read.
      return new Promise((resolve) => {
        const ms = Math.max(1800, (sentence.split(/\s+/).length * 330) / this.rateValue);
        this.timer = window.setTimeout(() => resolve(gen === this.gen), ms);
      });
    }
    return new Promise((resolve) => {
      const synth = window.speechSynthesis;
      const u = new SpeechSynthesisUtterance(sentence);
      u.rate = this.rateValue;
      u.pitch = this.pitch;
      if (this.voice) {
        u.voice = this.voice;
        u.lang = this.voice.lang;
      }
      let settled = false;
      const finish = (ok: boolean) => {
        if (settled) return;
        settled = true;
        window.clearInterval(guard);
        this.keep = this.keep.filter((k) => k !== u);
        resolve(ok && gen === this.gen);
      };
      u.onend = () => finish(true);
      u.onerror = (e) => finish(e.error !== "interrupted" && e.error !== "canceled");
      this.keep.push(u);
      const startedAt = Date.now();
      // Chrome occasionally never fires onend; poll so the walkthrough never stalls.
      const guard = window.setInterval(() => {
        if (gen !== this.gen) return finish(false);
        if (Date.now() - startedAt > 800 && !synth.speaking && !synth.pending) finish(true);
      }, 300);
      try {
        if (synth.paused) synth.resume();
        synth.speak(u);
      } catch {
        finish(true);
      }
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
