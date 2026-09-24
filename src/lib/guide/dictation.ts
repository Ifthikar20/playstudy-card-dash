/*
  Dictation: talking a page of notes into existence.

  Teach mode listens for ONE question and then stops. Dictation is the other shape —
  it keeps going until the student says they're done — so it restarts the browser's
  recogniser after every pause (it ends itself on silence), and in browsers without
  one it records in 15-second pieces and sends each to the server's whisper.

  Every finished phrase is handed to `onText`, which puts it on the page. Notes are
  Markdown, so with `{ markdown: true }` a phrase arrives already made safe for it
  (see markdownPhrase): nothing the student SAYS can turn into a heading, a list or
  a formula. `joinPhrase` then fits it against the text before the caret.
*/
import { useCallback, useEffect, useRef, useState } from "react";
import {
  createNativeRecognizer,
  micBlockedByInsecurePage,
  secureUrlForThisPage,
  startRecording,
  sttSupport,
  type Recognizer,
  type Recording,
  type SttMode,
} from "@/lib/guide/speech";
import { transcribeAudio } from "@/services/guide";

export type DictationState = "off" | "listening" | "writing";

export interface Dictation {
  /** "off" when idle, "listening" while the mic is open, "writing" while a clip is transcribed. */
  state: DictationState;
  /** The words as they're being recognised, before the phrase is finished. */
  interim: string;
  /** What this browser can do: a live recogniser, recorded clips, or nothing. */
  mode: SttMode;
  /** Why it stopped, when it stopped itself. */
  error: string | null;
  start: () => Promise<void>;
  stop: () => void;
  toggle: () => void;
}

/** How long one recorded piece runs before it's sent off and a new one starts. */
const PIECE_MS = 15_000;

/*
  What makes a line mean something in Markdown when it STARTS with it: a heading (#),
  a list (-, *, +, "1." or "1)"), a quote (>), a table row (|), a thematic break or a
  setext underline (===, ___), a ~~~ code fence. Only the first character needs its
  backslash; `1.` needs it on the dot. (Backticks are escaped everywhere, below.)
*/
const LEADING_MARKER = /^(#{1,6}(?=\s|$)|[-*+>|=_~]|\d{1,9}[.)](?=\s|$))/;

/**
 * A spoken phrase made safe to drop into Markdown notes, anywhere on a line.
 *
 * Whisper and the browser's recogniser write numbers and symbols the way people
 * mean them - "- 5 degrees", "1. first", "$20 and $30" - and in Markdown those are
 * structure: a list, a numbered list, an inline formula between the two dollar signs.
 * A backslash in front of a punctuation character is Markdown for "just this
 * character", so the student sees exactly what they said and nothing else changes.
 *
 * Also: line breaks become spaces (one phrase is one run of text; a new paragraph is
 * the student's call), and anything that looks like an HTML tag is escaped, because
 * the notes render raw HTML (a stray `<mark>` would break the highlighter).
 */
export function markdownPhrase(text: string): string {
  let t = text.replace(/\s+/g, " ").trim();
  if (!t) return "";
  const lead = LEADING_MARKER.exec(t);
  if (lead) {
    const m = lead[0];
    // "1." -> "1\.", everything else gets the backslash in front.
    t = /^\d/.test(m) ? `${m.slice(0, -1)}\\${m.slice(-1)}${t.slice(m.length)}` : `\\${t}`;
  }
  return t
    .replace(/(^|[^\\])\$/g, "$1\\$") // a lone $ is a formula's opening fence
    .replace(/(^|[^\\])\$/g, "$1\\$") // twice: "$$" has two, and a match can't overlap
    .replace(/<(?=[A-Za-z/!?])/g, "\\<") // "<b", "</", "<!--" - never a tag
    .replace(/`/g, "\\`"); // an inline code span
}

/**
 * The text to insert for a dictated `phrase`, given what comes right before the caret.
 * It adds the space between words when the caret is right after one, and starts a new
 * sentence with a capital: the browser's recogniser writes "the cell wall is rigid"
 * with no capital and no full stop, and a page of that reads like one long sentence.
 */
export function joinPhrase(before: string, phrase: string): string {
  if (!phrase) return "";
  const tail = before.slice(-200);
  const sentenceStart = !tail.trim() || /[.!?:]["”’)\]]*\s*$/.test(tail) || /\n\s*$/.test(tail);
  const body = sentenceStart ? phrase.replace(/^(\\?)(\p{Ll})/u, (_m, esc: string, ch: string) => esc + ch.toUpperCase()) : phrase;
  const needsSpace = tail.length > 0 && !/\s$/.test(tail) && !/^[.,!?;:)\]]/.test(body);
  return `${needsSpace ? " " : ""}${body}`;
}

export function useDictation(onText: (text: string) => void, opts: { markdown?: boolean } = {}): Dictation {
  const [state, setState] = useState<DictationState>("off");
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const mode = useRef<SttMode>(sttSupport()).current;

  const recognizer = useRef<Recognizer | null>(null);
  const recording = useRef<Recording | null>(null);
  // Set while the student is dictating, so a recogniser that ends on a pause knows
  // to start listening again instead of falling silent.
  const wanted = useRef(false);
  const onTextRef = useRef(onText);
  onTextRef.current = onText;
  const markdown = useRef(!!opts.markdown);
  markdown.current = !!opts.markdown;

  /*
    Hand a finished phrase to the page. Whatever the page does with it must not take
    the microphone down: this runs inside the recogniser's own callbacks, and an
    exception there would skip the restart below it and leave the button saying
    "listening" to a recogniser that has gone. So a failed insert is reported, and
    dictation carries on.
  */
  const write = useRef((raw: string) => {
    const phrase = markdown.current ? markdownPhrase(raw) : raw.replace(/\s+/g, " ").trim();
    if (!phrase) return;
    try {
      onTextRef.current(phrase);
    } catch (e) {
      console.error("dictation: couldn't put a phrase on the page", e);
      setError("That last bit couldn't be written into the page.");
    }
  });

  const transcribe = useCallback(async (blob: Blob) => {
    setState((s) => (s === "off" ? s : "writing"));
    try {
      const text = await transcribeAudio(blob, navigator.language);
      if (text.trim()) write.current(text.trim());
    } catch {
      setError("That last bit didn't come through.");
    } finally {
      setState(() => (wanted.current ? "listening" : "off"));
    }
  }, []);

  const listenOnce = useCallback(async () => {
    if (!wanted.current) return;
    if (mode === "recorder") {
      try {
        recording.current = await startRecording({
          maxMs: PIECE_MS,
          onAutoStop: (blob) => {
            recording.current = null;
            void transcribe(blob).then(() => listenOnce()); // straight into the next piece
          },
        });
        setState("listening");
      } catch {
        wanted.current = false;
        setState("off");
        setError(micBlockedByInsecurePage() ? "The microphone needs an https page." : "Couldn't use the microphone.");
      }
      return;
    }
    const rec = createNativeRecognizer({
      lang: navigator.language || "en-US",
      onInterim: (t) => setInterim(t),
      onFinal: (t) => {
        recognizer.current = null;
        setInterim("");
        if (t.trim()) write.current(t.trim());
        // It ends itself after a pause; while they're still dictating, go again.
        if (wanted.current) void listenOnce();
        else setState("off");
      },
      onError: async (code) => {
        recognizer.current = null;
        if (code === "no-speech" && wanted.current) {
          void listenOnce();
          return;
        }
        if (!wanted.current) return setState("off");
        // Chromium builds without Google's speech service fail with "network";
        // recording and sending the audio still works.
        try {
          recording.current = await startRecording({
            maxMs: PIECE_MS,
            onAutoStop: (blob) => {
              recording.current = null;
              void transcribe(blob).then(() => listenOnce());
            },
          });
          setState("listening");
        } catch {
          wanted.current = false;
          setState("off");
          setError("Couldn't use the microphone — type instead.");
        }
      },
    });
    recognizer.current = rec;
    try {
      rec.start();
      setState("listening");
    } catch {
      recognizer.current = null;
      wanted.current = false;
      setState("off");
      setError("Couldn't start listening.");
    }
  }, [mode, transcribe]);

  const start = useCallback(async () => {
    if (wanted.current) return;
    if (mode === "none") {
      setError(
        micBlockedByInsecurePage() && secureUrlForThisPage()
          ? "Browsers only hand out the microphone on https pages."
          : "This browser can't do voice input — type instead.",
      );
      return;
    }
    setError(null);
    wanted.current = true;
    await listenOnce();
  }, [listenOnce, mode]);

  const stop = useCallback(() => {
    wanted.current = false;
    setInterim("");
    const rec = recognizer.current;
    recognizer.current = null;
    rec?.stop(); // the last phrase still arrives through onFinal
    const r = recording.current;
    recording.current = null;
    if (r) void r.stop().then(transcribe);
    else setState((s) => (s === "writing" ? s : "off"));
  }, [transcribe]);

  const toggle = useCallback(() => {
    if (wanted.current) stop();
    else void start();
  }, [start, stop]);

  // Leaving the page must not leave the microphone open.
  useEffect(
    () => () => {
      wanted.current = false;
      recognizer.current?.abort();
      recording.current?.cancel();
    },
    [],
  );

  return { state, interim, mode, error, start, stop, toggle };
}
