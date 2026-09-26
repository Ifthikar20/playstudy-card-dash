/**
 * Cutting spoken text into the pieces the voice reads one at a time.
 *
 * Each piece becomes one clip from the server, so the pieces decide how soon the first
 * words are heard (a short first piece starts fast), how the captions step along, and
 * that no request is ever too long for the voice (the server takes at most 2,000
 * characters; Speechify reads a clip of that size in one go). The rules:
 *  - a sentence ends at . ! ? … and at the other scripts' full stops and question marks:
 *    Arabic and Urdu ؟ ۔, Devanagari । ॥, Ethiopic ። and Armenian ։, each followed by a
 *    space like a full stop; and the ideographic 。！？, after which Chinese and Japanese
 *    put no space at all;
 *  - a sentence over the limit is split at its clauses (; : , and the Arabic ، ؛ and
 *    ideographic 、，；： marks) and the parts joined back into pieces under the target.
 *    Text without spaces (Chinese, Japanese, Thai) gets a lower limit: each character is
 *    a syllable, so eighty of them already take a while to say;
 *  - anything still longer than MAX_PIECE is cut at the last space before the limit,
 *    or at the limit itself when there is no usable space. So a piece is never longer
 *    than MAX_PIECE, whatever the text - a 100,000-word note reads as thousands of small
 *    clips, never one the server refuses;
 *  - a very short fragment ("Dr.", a lone "3.") joins the piece before it, as does one
 *    that starts with a lower-case letter (a false split after an abbreviation).
 *
 * Pure, no DOM: Node runs scripts/tests/sentences.test.ts against it directly.
 */

/** No piece is longer than this: well under the server's limit, and short enough that a
 *  clip starts quickly even when a paragraph has no punctuation at all. */
export const MAX_PIECE = 300;

// Sentence ends followed by a space (with an optional closing quote or bracket first).
// A split needs the next piece not to start with a lower-case Latin letter: "e.g. this"
// is one sentence.
const SPACED_END = /(?<=[.!?…؟۔।॥።։]["”’)»]?)\s+(?=[^a-z])/u;
// Ideographic sentence ends: no space follows them.
const IDEOGRAPHIC_END = /(?<=[。！？])/u;
// Clause marks: the Latin and Arabic ones need a space after them ("1,000" stays whole);
// the ideographic ones have none.
const CLAUSE_SPACED = /(?<=[;:,،؛])\s+/u;
const CLAUSE_IDEOGRAPHIC = /(?<=[、，；：])/u;

/** Split spoken text into the pieces the voice reads one at a time (see above). */
export function splitSentences(text: string): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return [];
  const parts = clean.split(SPACED_END).flatMap((p) => p.split(IDEOGRAPHIC_END));
  const out: string[] = [];
  for (const raw of parts) {
    const s = raw.trim();
    if (!s) continue;
    if (out.length && (s.length < 14 || /^[a-z]/.test(s))) out[out.length - 1] += ` ${s}`;
    else out.push(s);
  }
  return out.flatMap(byClauses).flatMap(capped);
}

/** A sentence over the limit, broken at its clauses and joined back into pieces under
 *  the target; shorter limits for text that has no spaces. */
function byClauses(s: string): string[] {
  const spaced = s.includes(" ");
  const limit = spaced ? 220 : 80;
  const target = spaced ? 180 : 60;
  if (s.length <= limit) return [s];
  const pieces = s.split(CLAUSE_SPACED).flatMap((p) => p.split(CLAUSE_IDEOGRAPHIC));
  return pieces.reduce<string[]>((acc, piece) => {
    const p = piece.trim();
    if (!p) return acc;
    const last = acc[acc.length - 1];
    if (last && last.length + p.length < target) acc[acc.length - 1] = spaced ? `${last} ${p}` : `${last}${p}`;
    else acc.push(p);
    return acc;
  }, []);
}

/** Never longer than MAX_PIECE: cut at the last space before the limit, or at the limit
 *  itself when there is no usable one (a run of Chinese with no punctuation at all),
 *  keeping a surrogate pair (an emoji, a rare character) together. */
function capped(s: string): string[] {
  const out: string[] = [];
  let rest = s;
  while (rest.length > MAX_PIECE) {
    let cut = rest.lastIndexOf(" ", MAX_PIECE);
    if (cut < MAX_PIECE / 2) {
      cut = MAX_PIECE;
      const code = rest.charCodeAt(cut - 1);
      if (code >= 0xd800 && code <= 0xdbff) cut--; // a high surrogate: its pair comes next
    }
    out.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) out.push(rest);
  return out;
}
