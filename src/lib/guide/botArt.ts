import type { BotKind } from "../../components/guide/GuideBot";

/*
  The pixel tutor's art: one string per row of 20 pixels, per character, and the
  colours each letter stands for. GuideBot draws it on the page (and animates it
  from CSS); the data lives here, away from React, so anything else can draw the
  same figure.
*/

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

export const BOT_PALETTE: Record<BotKind, Record<string, string>> = {
  female: { k: "#1f1235", a: "#f472b6", d: "#db2777", l: "#fbcfe8", t: "#fbbf24", s: "#1e1b4b", g: "#312e81", e: "#7dd3fc", b: "#fb7185" },
  male: { k: "#1f1235", a: "#60a5fa", d: "#2563eb", l: "#bfdbfe", t: "#fbbf24", s: "#1e1b4b", g: "#312e81", e: "#7dd3fc", b: "#fb7185" },
  neutral: { k: "#1f1235", a: "#a78bfa", d: "#7c3aed", l: "#ddd6fe", t: "#fbbf24", s: "#1e1b4b", g: "#312e81", e: "#7dd3fc", b: "#fb7185" },
};

export interface Run {
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

/** The character for a voice, as rects: one per horizontal run of the same colour. */
export function botRuns(kind: BotKind): Run[] {
  return runsOf(ART[kind], BOT_PALETTE[kind]);
}
