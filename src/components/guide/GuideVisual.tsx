import { useMemo } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";
import "katex/dist/contrib/mhchem.mjs"; // \ce{...} chemistry
import type { VisualSpec, VisualKind, GuideMath } from "@/services/guide";
import { VISUAL_LABEL } from "@/services/guide";
import { GuideChart } from "./GuideChart";
import { GuideDiagram } from "./GuideDiagram";
import { GuideAtom } from "./GuideAtom";
import { GuideGraph } from "./GuideGraph";
import { GuideMolecule } from "./GuideMolecule";
import { GuideImage } from "./GuideImage";
import { GuideTable } from "./GuideTable";
import { GuideList } from "./GuideList";
import { GuideTimeline } from "./GuideTimeline";
import { GuideScale } from "./GuideScale";
import { GuideVenn } from "./GuideVenn";
import { GuidePeriodic } from "./GuidePeriodic";
import { GuideCircuit } from "./GuideCircuit";
import { GuideForces } from "./GuideForces";
import { GuideGeometry } from "./GuideGeometry";
import { GuideCode } from "./GuideCode";
import { GuideFacts } from "./GuideFacts";
import { VISUAL_FENCE } from "@/lib/notes/fences";

/*
  One place that turns a VisualSpec into a drawing.

  The board draws these live and erases them; the notes render the ones a student
  pinned. Both go through here, so a pinned visual looks exactly like the one they
  were shown — and every new kind only has to be added once.
*/

/** Whether a symbol is written in LaTeX (\ce{CO2}, v_0, x^2) rather than as plain letters. */
const looksTex = (s: string) => /\\[a-zA-Z]+|[\^_{]/.test(s);

/**
 * A symbol's LaTeX as plain letters: \ce{C6H12O6} -> C6H12O6, \Delta H -> Delta H,
 * v_0 -> v0. For what the pointer matches spoken names against, and for a chip whose
 * LaTeX doesn't render (the server cuts a long symbol short, which can leave a brace
 * open).
 */
function plainTex(tex: string): string {
  return tex
    .replace(/\\(?:ce|text|mathrm|mathbf|mathit|operatorname)\s*\{([^{}]*)\}?/g, "$1")
    .replace(/\\([a-zA-Z]+)/g, "$1")
    .replace(/\\./g, " ")
    .replace(/[{}$^_]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * One symbol in a formula's key. The lesson writes symbols the way it writes the
 * formula, so chemistry comes as \ce{CO2}: set it as maths (CO₂), not as the code
 * that writes it. Plain words ("light") stay words.
 */
function SymbolText({ text }: { text: string }) {
  const html = useMemo(() => {
    if (!looksTex(text)) return null;
    try {
      const out = katex.renderToString(text, { throwOnError: false, displayMode: false, output: "html" });
      return out.includes("katex-error") ? null : out;
    } catch {
      return null;
    }
  }, [text]);
  if (html) return <span className="guide-math-part" dangerouslySetInnerHTML={{ __html: html }} />;
  return <span className="guide-math-part">{looksTex(text) ? plainTex(text) : text}</span>;
}

/** A line of maths, with each symbol named underneath when the step said what they mean. */
export function GuideMathLine({ math }: { math: GuideMath }) {
  const html = useMemo(() => {
    try {
      return katex.renderToString(math.latex, { throwOnError: false, displayMode: true, output: "html" });
    } catch {
      return "";
    }
  }, [math.latex]);
  const labels = math.labels?.length ? math.labels : null;
  // Pointer anchors: "formula" is the rendered line itself, "labels.i" each named symbol.
  return (
    <div className={`guide-math${labels ? " guide-math-labelled" : ""}`}>
      {html ? (
        <span dangerouslySetInnerHTML={{ __html: html }} data-board-part="formula" data-board-label={math.latex} />
      ) : (
        <span className="guide-board-raw" data-board-part="formula" data-board-label={math.latex}>
          {math.latex}
        </span>
      )}
      {labels && (
        <div className="guide-math-keys">
          {labels.map((l, i) => (
            <span key={i} className="guide-math-key" data-board-part={`labels.${i}`} data-board-label={`${plainTex(l.part)} ${l.meaning}`}>
              <SymbolText text={l.part} />
              <span className="guide-math-meaning">{l.meaning}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function GuideVisual({ spec }: { spec: VisualSpec }) {
  switch (spec.kind) {
    case "math":
      return <GuideMathLine math={spec.data} />;
    case "table":
      return <GuideTable table={spec.data} />;
    case "list":
      return <GuideList list={spec.data} />;
    case "chart":
      return <GuideChart chart={spec.data} />;
    case "timeline":
      return <GuideTimeline timeline={spec.data} />;
    case "scale":
      return <GuideScale scale={spec.data} />;
    case "diagram":
      return <GuideDiagram diagram={spec.data} />;
    case "venn":
      return <GuideVenn venn={spec.data} />;
    case "graph":
      return <GuideGraph graph={spec.data} />;
    case "atom":
      return <GuideAtom atom={spec.data} />;
    case "periodic":
      return <GuidePeriodic periodic={spec.data} />;
    case "molecule":
      return <GuideMolecule molecule={spec.data} />;
    case "circuit":
      return <GuideCircuit circuit={spec.data} />;
    case "forces":
      return <GuideForces forces={spec.data} />;
    case "geometry":
      return <GuideGeometry geometry={spec.data} />;
    case "code":
      return <GuideCode code={spec.data} />;
    case "facts":
      return <GuideFacts facts={spec.data} />;
    case "image":
      return <GuideImage image={spec.data} />;
  }
}

/* --------------------------------------------------------------------------
   Blank-label drill: the same visual with its labels hidden.

   A diagram you've just been walked through feels learned; naming its parts from
   memory is what proves it. Blanking is a pure transform of the data, so the
   drawing is identical — only the words are gone until you reveal them.
-------------------------------------------------------------------------- */
const BLANK = "?";
const BLANKABLE: VisualKind[] = ["table", "list", "chart", "timeline", "scale", "diagram", "venn", "periodic", "circuit", "forces", "geometry", "code", "facts"];

export const canBlank = (spec: VisualSpec | null): boolean => !!spec && BLANKABLE.includes(spec.kind);

export function blankVisual(spec: VisualSpec): VisualSpec {
  const clone = JSON.parse(JSON.stringify(spec)) as VisualSpec;
  switch (clone.kind) {
    case "table":
      // keep the headers and the row labels; the comparisons are the answer
      clone.data.rows = clone.data.rows.map((r) => r.map((c, i) => (i === 0 ? c : c ? BLANK : c)));
      break;
    case "list":
      // name each principle from its description
      clone.data.items = clone.data.items.map((it) => ({ ...it, label: BLANK }));
      break;
    case "chart":
      clone.data.data = clone.data.data.map((d) => ({ ...d, label: BLANK }));
      break;
    case "timeline":
      clone.data.events = clone.data.events.map((e) => ({ ...e, label: BLANK }));
      break;
    case "scale":
      clone.data.marks = clone.data.marks.map((m) => ({ ...m, label: BLANK }));
      clone.data.ranges = clone.data.ranges.map((r) => ({ ...r, label: BLANK }));
      break;
    case "diagram":
      clone.data.nodes = clone.data.nodes.map(() => BLANK);
      clone.data.edges = clone.data.edges?.map((e) => ({ ...e, label: e.label ? BLANK : undefined }));
      break;
    case "venn":
      clone.data.regions = Object.fromEntries(Object.entries(clone.data.regions).map(([k, v]) => [k, v.map(() => BLANK)]));
      break;
    case "periodic":
      clone.data = { ...clone.data, symbol: BLANK, name: BLANK, category: BLANK };
      break;
    case "circuit":
      clone.data.components = clone.data.components.map((c) => ({ ...c, label: c.label ? BLANK : undefined }));
      clone.data.branches = clone.data.branches?.map((b) => b.map((c) => ({ ...c, label: c.label ? BLANK : undefined })));
      break;
    case "forces":
      clone.data.vectors = clone.data.vectors.map((v) => ({ ...v, label: BLANK }));
      break;
    case "geometry":
      clone.data.labels = Object.fromEntries(Object.keys(clone.data.labels).map((k) => [k, BLANK]));
      break;
    case "code":
      if (clone.data.trace) clone.data.trace.rows = clone.data.trace.rows.map((r) => r.map(() => BLANK));
      break;
    case "facts":
      // remember the number from what it's about
      clone.data.items = clone.data.items.map((it) => ({ ...it, value: BLANK }));
      break;
  }
  return clone;
}

/* --------------------------------------------------------------------------
   Pin to notes: a visual written into the Markdown of a section, so it's still
   there at the next revision. Maths and tables become native Markdown; the rest
   ride in a fenced block the notes renderer knows how to draw.
-------------------------------------------------------------------------- */
/* The fence names live in lib/notes/fences.ts — one module the writer here, the
   reader in render.tsx and the writing surface in sheet.ts all agree on. */

/** `space` is handed to JSON.stringify for the fenced kinds. The AI's own pin
 *  path leaves it 0 (one dense line); the `/` menu passes 2, because a block a
 *  student inserted is a block a student is about to edit by hand. Both parse
 *  back through `parseVisualFence` identically. */
export function visualToMarkdown(spec: VisualSpec, space = 0): string {
  if (spec.kind === "math") {
    // A LaTeX symbol goes in as maths ($$…$$ inline, as the notes render it), so the
    // pinned key reads CO₂ there too, not \ce{CO2}.
    const sym = (p: string) => (looksTex(p) ? `$$${p}$$` : `**${p}**`);
    const keys = spec.data.labels?.length ? "\n" + spec.data.labels.map((l) => `- ${sym(l.part)} — ${l.meaning}`).join("\n") : "";
    return `\n$$${spec.data.latex}$$\n${keys}\n`;
  }
  if (spec.kind === "table") {
    const esc = (s: string) => s.replace(/\|/g, "\\|");
    const head = `| ${spec.data.columns.map(esc).join(" | ")} |`;
    const rule = `| ${spec.data.columns.map(() => "---").join(" | ")} |`;
    const body = spec.data.rows.map((r) => `| ${r.map(esc).join(" | ")} |`).join("\n");
    return `\n${spec.data.title ? `**${spec.data.title}**\n\n` : ""}${head}\n${rule}\n${body}\n`;
  }
  if (spec.kind === "list") {
    const items = spec.data.items.map((it, i) => `${i + 1}. **${it.label}**${it.detail ? ` — ${it.detail}` : ""}`).join("\n");
    return `\n${spec.data.title ? `**${spec.data.title}**\n\n` : ""}${items}\n`;
  }
  if (spec.kind === "facts") {
    const items = spec.data.items.map((it) => `- **${it.value}** — ${it.text}`).join("\n");
    return `\n**${spec.data.title || "Fast facts"}**\n\n${items}\n`;
  }
  return `\n\`\`\`${VISUAL_FENCE}\n${JSON.stringify(spec, null, space)}\n\`\`\`\n`;
}

/** Read a pinned visual back out of the notes; null if the block isn't one. */
export function parseVisualFence(text: string): VisualSpec | null {
  try {
    const spec = JSON.parse(text) as VisualSpec;
    return spec && typeof spec === "object" && spec.kind in VISUAL_LABEL && spec.data ? spec : null;
  } catch {
    return null;
  }
}

/** A few words identifying one visual, for the board's history strip. */
export function visualSummary(spec: VisualSpec): string {
  const clip = (s: string, n = 30) => (s.length > n ? s.slice(0, n - 1) + "…" : s);
  switch (spec.kind) {
    case "math":
      return clip(plainTex(spec.data.latex));
    case "graph":
      return clip("y = " + spec.data.fn);
    case "atom":
      return clip(spec.data.name || spec.data.symbol || "atom");
    case "periodic":
      return clip(`${spec.data.name} · group ${spec.data.group || "f"}`);
    case "molecule":
      return clip(spec.data.title || spec.data.smiles);
    case "image":
      return clip(spec.data.caption || spec.data.query);
    case "chart":
      return clip(spec.data.title || spec.data.data.map((d) => d.label).join(", "));
    case "diagram":
      return clip(spec.data.title || spec.data.nodes.join(" → "));
    case "timeline":
      return clip(spec.data.title || spec.data.events.map((e) => e.label).join(", "));
    case "venn":
      return clip(spec.data.title || spec.data.sets.join(" vs "));
    case "table":
      return clip(spec.data.title || spec.data.columns.filter(Boolean).join(" vs "));
    case "list":
      return clip(spec.data.title || spec.data.items.map((it) => it.label).join(", "));
    case "code":
      return clip(spec.data.title || spec.data.language || spec.data.lines[0]);
    case "facts":
      return clip(spec.data.title || spec.data.items.map((it) => it.value).join(", "));
    case "forces":
      return clip(spec.data.title || spec.data.vectors.map((v) => v.label).filter(Boolean).join(", ") || "forces");
    case "geometry":
      return clip(spec.data.title || spec.data.shape.replace("_", " "));
    case "circuit":
      return clip(spec.data.title || spec.data.components.map((c) => c.type).join(", "));
    case "scale":
      return clip(spec.data.title || spec.data.marks.map((m) => m.label).join(", "));
  }
}
