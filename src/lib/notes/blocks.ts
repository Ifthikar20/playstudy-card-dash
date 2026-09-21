/**
 * The block catalogue behind the `/` menu.
 *
 * One entry per thing a student can drop into their notes. Every entry is
 * literal Markdown — there is no builder, no template engine and no
 * serialiser — because the whole safety story of the writing surface is that
 * `textarea.value` IS the stored Markdown, byte for byte. A `/` command
 * therefore does exactly what typing those bytes would have done, which is
 * why it can be proved by the same `guardDoc` that proves free typing.
 *
 * TWO KINDS OF ENTRY
 *   Ordinary    Headings, lists, quotes, links, highlights. They insert plain
 *               Markdown, land the caret inside it, and the student carries on
 *               typing. `atomSignature` does not track them, so they declare
 *               nothing and the guard sees an ordinary edit.
 *
 *   Locked      Tables, code fences, `$$` formulas and the pinned
 *               `playstudy-visual` diagrams. These parse as ATOMS: the caret
 *               may not enter their source and no keystroke may touch it. So
 *               inserting one is a declared change (`addAtoms`), and the block
 *               editor opens on it immediately — the block arrives already
 *               filled in with something that renders, and the panel is where
 *               it gets changed. Inserting a table you could never type in
 *               would be worse than not offering tables at all.
 *
 * The visual specs below are deliberately REAL examples rather than empty
 * shells: a Venn with two named sets, a circuit that actually lights a bulb, a
 * carbon atom. A student edits by analogy in the panel; an empty skeleton would
 * teach them nothing about the shape they are editing.
 */

import {
  Atom,
  BarChart3,
  CalendarRange,
  CircuitBoard,
  Code,
  Code2,
  FlaskConical,
  Grid3x3,
  Heading1,
  Heading2,
  Heading3,
  Highlighter,
  Image,
  LineChart,
  Link2,
  List,
  ListChecks,
  ListOrdered,
  type LucideIcon,
  Minus,
  Move,
  Quote,
  Ruler,
  Sigma,
  Table,
  Triangle,
  Workflow,
} from "lucide-react";
import { visualToMarkdown } from "@/components/guide/GuideVisual";
import type { VisualSpec } from "@/services/guide";

export type BlockGroup = "Basics" | "Lists" | "Blocks" | "Maths & science";

export interface BlockItem {
  id: string;
  label: string;
  hint: string;
  group: BlockGroup;
  /** Extra search words. The label is always searched too. */
  keywords: string;
  icon: LucideIcon;
  /** The exact bytes to insert, with no surrounding blank lines — the caller
   *  adds those, because only it knows what the block is landing between. */
  md: string;
  /** Offset into `md` where the caret should end up. */
  caret: number;
  /** Characters to SELECT from `caret`, so the first thing typed replaces a
   *  placeholder. Mark-up needs it: an empty `<mark></mark>` is two frozen tags
   *  with nothing between them, which merge into one range the caret cannot
   *  enter — so the highlight has to arrive with a word already in it. */
  select?: number;
  /** Mark-up that belongs inside a sentence, not a block of its own. */
  inline?: boolean;
  /** Inserting this creates a locked block, so the editor opens on it. */
  atom?: boolean;
}

/* NUL marks the caret in a template. It cannot occur in typed Markdown, and
   atomSignature already reserves it as a field separator, so it is the one
   byte that is safe to use as a sentinel here. */
const CARET = "\u0000";

type Template = Omit<BlockItem, "md" | "caret"> & { t: string };

const make = ({ t, ...rest }: Template): BlockItem => {
  const i = t.indexOf(CARET);
  return i < 0 ? { ...rest, md: t, caret: t.length } : { ...rest, md: t.slice(0, i) + t.slice(i + 1), caret: i };
};

const visual = (
  id: string,
  label: string,
  hint: string,
  keywords: string,
  icon: LucideIcon,
  spec: VisualSpec,
): BlockItem => ({
  id,
  label,
  hint,
  group: "Maths & science",
  keywords,
  icon,
  // `.trim()` strips the blank lines visualToMarkdown pads with; the inserter
  // works out the spacing this block actually needs where it is landing.
  md: visualToMarkdown(spec, 2).trim(),
  caret: 0,
  atom: true,
});

export const BLOCKS: BlockItem[] = [
  /* ---- Basics ---- */
  make({ id: "h1", label: "Heading 1", hint: "Section title", group: "Basics", keywords: "title big", icon: Heading1, t: `# ${CARET}` }),
  make({ id: "h2", label: "Heading 2", hint: "The coloured headings in your notes", group: "Basics", keywords: "title subhead", icon: Heading2, t: `## ${CARET}` }),
  make({ id: "h3", label: "Heading 3", hint: "A smaller coloured heading", group: "Basics", keywords: "title subhead", icon: Heading3, t: `### ${CARET}` }),
  make({ id: "quote", label: "Quote", hint: "Set a passage apart", group: "Basics", keywords: "blockquote cite", icon: Quote, t: `> ${CARET}` }),
  make({ id: "divider", label: "Divider", hint: "A line across the page", group: "Basics", keywords: "rule separator hr line", icon: Minus, t: `---` }),
  make({ id: "mark", label: "Highlight", hint: "Amber marker over the words", group: "Basics", keywords: "marker yellow emphasise", icon: Highlighter, inline: true, select: 9, t: `<mark>${CARET}highlight</mark>` }),
  make({ id: "link", label: "Link", hint: "Text that opens a page", group: "Basics", keywords: "url href web", icon: Link2, inline: true, select: 4, t: `[${CARET}text](https://)` }),
  make({ id: "inlinecode", label: "Inline code", hint: "A word in code type", group: "Basics", keywords: "monospace tt", icon: Code, inline: true, select: 4, t: "`" + CARET + "code`" }),

  /* ---- Lists ---- */
  make({ id: "ul", label: "Bulleted list", hint: "Points, in no order", group: "Lists", keywords: "bullet unordered dash", icon: List, t: `- ${CARET}` }),
  make({ id: "ol", label: "Numbered list", hint: "Steps, in order", group: "Lists", keywords: "ordered steps number", icon: ListOrdered, t: `1. ${CARET}` }),
  make({ id: "todo", label: "To-do list", hint: "Tick things off as you revise", group: "Lists", keywords: "todo checkbox task tick check", icon: ListChecks, t: `- [ ] ${CARET}` }),

  /* ---- Blocks (locked) ---- */
  make({
    id: "table",
    label: "Table",
    hint: "Rows and columns",
    group: "Blocks",
    keywords: "grid compare columns rows",
    icon: Table,
    atom: true,
    t: ["| Term | Meaning |", "| --- | --- |", "| First | What it means |", "| Second | What it means |"].join("\n"),
  }),
  make({
    id: "code",
    label: "Code block",
    hint: "A snippet, kept exactly as typed",
    group: "Blocks",
    keywords: "fence program snippet monospace",
    icon: Code2,
    atom: true,
    t: "```python\nprint(\"hello\")\n```",
  }),
  make({
    id: "equation",
    label: "Equation",
    hint: "Maths on its own line",
    group: "Blocks",
    keywords: "latex formula maths math katex",
    icon: Sigma,
    atom: true,
    t: "$$E = mc^2$$",
  }),

  /* ---- Maths & science (locked; drawn by the same renderer as Teach mode) ---- */
  visual("chart", "Chart", "Bars, a line or a pie", "graph data bar pie line plot", BarChart3, {
    kind: "chart",
    data: { type: "bar", title: "Results", unit: "%", data: [{ label: "First", value: 40 }, { label: "Second", value: 75 }, { label: "Third", value: 55 }] },
  }),
  visual("graph", "Graph", "y = f(x), drawn from the formula", "function curve plot parabola axis", LineChart, {
    kind: "graph",
    data: { fn: "x^2", domain: [-3, 3], title: "y = x²", xlabel: "x", ylabel: "y" },
  }),
  visual("timeline", "Timeline", "Dated events, spaced by their real gaps", "history dates years events", CalendarRange, {
    kind: "timeline",
    data: { title: "Key dates", events: [{ year: 1687, label: "Principia" }, { year: 1905, label: "Special relativity" }, { year: 1915, label: "General relativity" }] },
  }),
  visual("scale", "Number line", "A range, an interval or an inequality", "scale interval inequality range strip", Ruler, {
    kind: "scale",
    data: { title: "Solution", min: 0, max: 10, marks: [{ at: 0, label: "0" }, { at: 5, label: "5" }, { at: 10, label: "10" }], ranges: [{ from: 2, to: 7, label: "2 ≤ x ≤ 7" }] },
  }),
  visual("diagram", "Diagram", "A flow, a cycle or a tree", "process flowchart cycle tree steps", Workflow, {
    kind: "diagram",
    data: { type: "flow", title: "Process", nodes: ["Start", "Middle", "End"], edges: [{ from: 0, to: 1 }, { from: 1, to: 2 }] },
  }),
  visual("venn", "Venn diagram", "What two things share, and what they don't", "sets overlap compare circles", Grid3x3, {
    kind: "venn",
    data: { title: "Compare", sets: ["First", "Second"], regions: { a: ["only the first"], b: ["only the second"], ab: ["both"] } },
  }),
  visual("geometry", "Figure", "A labelled shape, drawn to its real sizes", "triangle circle rectangle shape geometry", Triangle, {
    kind: "geometry",
    data: { title: "3-4-5 triangle", shape: "right_triangle", values: { a: 3, b: 4, c: 5 }, labels: { a: "3 cm", b: "4 cm", c: "5 cm" }, show: ["a", "b", "c"] },
  }),
  visual("atom", "Atom", "A Bohr model with its shells", "bohr shells electrons protons chemistry", Atom, {
    kind: "atom",
    data: { protons: 6, neutrons: 6, electrons: 6, symbol: "C", name: "Carbon" },
  }),
  visual("periodic", "Periodic table", "One element lit up in the table", "element chemistry group period", Grid3x3, {
    kind: "periodic",
    data: { z: 6, symbol: "C", name: "Carbon", mass: 12.011, group: 14, period: 2, category: "nonmetal" },
  }),
  visual("molecule", "Molecule", "A structure drawn from SMILES", "chemistry smiles bond structure organic", FlaskConical, {
    kind: "molecule",
    data: { smiles: "CCO", title: "Ethanol" },
  }),
  visual("circuit", "Circuit", "Components in series or in parallel", "physics electricity battery resistor bulb", CircuitBoard, {
    kind: "circuit",
    data: { title: "Series circuit", layout: "series", components: [{ type: "battery", label: "6 V" }, { type: "resistor", label: "10 Ω" }, { type: "bulb" }] },
  }),
  visual("forces", "Forces", "A free-body diagram, or vectors tip to tail", "physics vector arrow free body resultant", Move, {
    kind: "forces",
    data: { title: "Free body", mode: "forces", body: "box", unit: "N", vectors: [{ label: "weight", angle: 270, magnitude: 10 }, { label: "normal", angle: 90, magnitude: 10 }] },
  }),
  visual("image", "Picture", "A real photo, found from what you name", "photo picture wikipedia image", Image, {
    kind: "image",
    data: { query: "mitochondrion", caption: "A mitochondrion" },
  }),
];

/* The query can only ever be letters, digits and spaces (see `slashStart`), so
   the labels are flattened the same way before matching. Without it `/todo`
   finds nothing at all, because the label is spelled "To-do list". */
const flat = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();

/**
 * Rank the catalogue against what has been typed after the `/`.
 *
 * Word-start matches beat mid-word ones, and the label beats the keywords, so
 * `/table` offers Table before Periodic table and `/li` offers Link and List
 * before Highlight. Ties keep catalogue order, which is the order a reader
 * would expect to find them in.
 */
export function searchBlocks(query: string): BlockItem[] {
  const q = flat(query);
  if (!q) return BLOCKS;
  const scored: Array<{ item: BlockItem; score: number; i: number }> = [];
  BLOCKS.forEach((item, i) => {
    const label = flat(item.label);
    const words = `${label} ${flat(item.keywords)}`;
    const word = new RegExp(`\\b${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`);
    let score = -1;
    if (label.startsWith(q)) score = 4;
    else if (word.test(label)) score = 3;
    else if (label.includes(q)) score = 2;
    else if (word.test(words)) score = 1;
    else if (words.includes(q)) score = 0;
    if (score >= 0) scored.push({ item, score, i });
  });
  scored.sort((a, b) => b.score - a.score || a.i - b.i);
  return scored.map((s) => s.item);
}
