import { useMemo } from "react";
import { cn } from "@/lib/utils";

/*
  The little tutor who is talking to you.

  Teach mode offers two voices, so there are two characters: a pink one for the
  woman's voice and a blue one for the man's (a violet one stands in when a
  browser voice doesn't say whose it is). They're drawn as pixel art — one <rect>
  per run of pixels — so they stay crisp at any size, from the 20px head in the
  speech bubble to the one standing above the controls.

  It bobs, blinks, and moves its mouth while the voice speaks, leans in while
  it's listening to you and looks away while it thinks. `mood` drives all of it
  from CSS (see .guide-bot in index.css); nothing here runs per frame.
*/

export type BotKind = "female" | "male" | "neutral";
export type BotMood = "idle" | "talking" | "listening" | "thinking";

/* Each string is one row of 20 pixels:
     .  nothing      k  outline     a  body      d  body shade   l  highlight
     t  bow/antenna  s  screen      g  screen glare            e  eye glow
     b  blush                                                             */
const HEAD = [
  ".....kkkkkkkkkk.....", // 5
  "....kllaaaaaaaak....",
  "...klaaaaaaaaaaak...",
  "...kakkkkkkkkkkdk...", // screen top bezel
];
const BODY = [
  "...kaaaaaaaaaaadk...", // 15
  "....kddddddddddk....",
  ".....kkkkkkkkkk.....",
  "", // 18: chest row, per character
  "...kaklaaaaaaakak...",
  "....kkddddddddkk....",
  "......kkkkkkkk......",
  "......kdk..kdk......",
  ".....kkkk..kkkk.....",
];
/** Screen rows 9-14: the face, with the eyes and mouth drawn separately. */
const FACE = [
  "..kkakggsssssskdkk..", // 9
  ".kdkakgssssssskdkdk.",
  ".kdkaksssssssskdkdk.",
  "..kkaksssssssskdkk..",
  "...kaksssssssskdk...",
  "...kakkkkkkkkkkdk...", // screen bottom bezel
];
/** Erica: lashes at the outer corners of the screen, blush below them. */
const FACE_F = [
  "..kkakegsssssekdkk..",
  ".kdkakgssssssskdkdk.",
  ".kdkaksssssssskdkdk.",
  "..kkakbssssssbkdkk..",
  "...kaksssssssskdk...",
  "...kakkkkkkkkkkdk...",
];
const TOP_BOW = [
  "....................",
  "......kk....kk......",
  ".....ktlkttkltk.....",
  ".....kttkttkttk.....",
  "........kkkk........",
];
const TOP_ANTENNA = [
  ".........kk.........",
  "........kltk........",
  "........kttk........",
  ".........kk.........",
  ".........kk.........",
];
const CHEST = {
  female: "....kkaaattaaakk....", // a little pendant
  male: "....kkattkkttakk....", // a bow tie
  neutral: "....kkaaaaaaaakk....",
};

const ART: Record<BotKind, string[]> = {
  female: [...TOP_BOW, ...HEAD, ...FACE_F, ...BODY.map((r, i) => (i === 3 ? CHEST.female : r))],
  male: [...TOP_ANTENNA, ...HEAD, ...FACE, ...BODY.map((r, i) => (i === 3 ? CHEST.male : r))],
  neutral: [...TOP_ANTENNA, ...HEAD, ...FACE, ...BODY.map((r, i) => (i === 3 ? CHEST.neutral : r))],
};

const PALETTE: Record<BotKind, Record<string, string>> = {
  female: { k: "#1f1235", a: "#f472b6", d: "#db2777", l: "#fbcfe8", t: "#fbbf24", s: "#1e1b4b", g: "#312e81", e: "#7dd3fc", b: "#fb7185" },
  male: { k: "#1f1235", a: "#60a5fa", d: "#2563eb", l: "#bfdbfe", t: "#fbbf24", s: "#1e1b4b", g: "#312e81", e: "#7dd3fc", b: "#fb7185" },
  neutral: { k: "#1f1235", a: "#a78bfa", d: "#7c3aed", l: "#ddd6fe", t: "#fbbf24", s: "#1e1b4b", g: "#312e81", e: "#7dd3fc", b: "#fb7185" },
};

interface Run {
  x: number;
  y: number;
  w: number;
  fill: string;
}

/** Rows of pixels → one rect per horizontal run of the same colour. */
function runsOf(rows: string[], palette: Record<string, string>): Run[] {
  const out: Run[] = [];
  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const ch = row[x];
      let w = 1;
      while (row[x + w] === ch) w++;
      if (ch !== ".") out.push({ x, y, w, fill: palette[ch] ?? palette.k });
      x += w;
    }
  });
  return out;
}

export function GuideBot({
  kind = "neutral",
  mood = "idle",
  size = 76,
  variant = "full",
  className,
  title,
}: {
  kind?: BotKind;
  mood?: BotMood;
  /** Width in pixels; the height follows the art. */
  size?: number;
  /** "head" crops to the face, for the speech bubble and the voice button. */
  variant?: "full" | "head";
  className?: string;
  title?: string;
}) {
  const palette = PALETTE[kind];
  const runs = useMemo(() => runsOf(ART[kind], palette), [kind, palette]);
  const head = variant === "head";
  const view = head ? "1 0 18 18" : "0 0 20 26";
  const height = size * (head ? 1 : 26 / 20);

  return (
    <span className={cn("guide-bot", className)} data-mood={mood} style={{ width: size, height }} title={title}>
      <svg viewBox={view} width="100%" height="100%" shapeRendering="crispEdges" aria-hidden focusable="false">
        {!head && <ellipse className="bot-shadow" cx="10" cy="25" rx="5.2" ry="0.8" fill="rgba(15, 8, 35, 0.18)" />}
        <g className="bot-float">
          <circle className="bot-glow" cx="10" cy="2" r="3.2" fill={palette.t} />
          <g className="bot-dots">
            <rect x="15.4" y="3.2" width="1" height="1" fill={palette.a} />
            <rect x="16.9" y="1.9" width="1.2" height="1.2" fill={palette.a} />
            <rect x="18.4" y="0.4" width="1.4" height="1.4" fill={palette.a} />
          </g>
          {runs.map((r, i) => (
            <rect key={i} x={r.x} y={r.y} width={r.w} height="1" fill={r.fill} />
          ))}
          <g className="bot-eyes" fill={palette.e}>
            <rect x="7" y="10" width="2" height="2" />
            <rect x="11" y="10" width="2" height="2" />
            <rect x="7" y="10" width="1" height="1" fill="#ffffff" />
            <rect x="11" y="10" width="1" height="1" fill="#ffffff" />
          </g>
          <g className="bot-mouth bot-mouth-shut" fill={palette.e}>
            <rect x="9" y="13" width="2" height="1" />
          </g>
          <g className="bot-mouth bot-mouth-open" fill={palette.e}>
            <rect x="9" y="12" width="2" height="1" />
            <rect x="8" y="13" width="4" height="1" />
          </g>
        </g>
      </svg>
    </span>
  );
}
