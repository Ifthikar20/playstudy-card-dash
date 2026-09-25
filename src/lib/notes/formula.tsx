import { Children, isValidElement, type ReactElement, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/*
  Formulas in the notes, set like formulas rather than like a sentence.

  Two kinds of paragraph get it:
  - one that is nothing but maths ($$…$$ on its own line in the Markdown, which
    remark-math turns into inline KaTeX — pinned formulas look like this): shown
    as a centred display formula instead of a small inline one;
  - one that is nothing but a bold formula written as plain text
    ("**Rₙ = (Band 1 digit)(Band 2 digit) × Multiplier**"), which is how notes were
    written before the notes prompt asked for LaTeX: shown in the maths font, centred,
    so existing notes read right without being regenerated.

  The element stays a <p> with every attribute react-markdown passes (the
  data-an-unit stamps the editor needs), so Teach mode's block finder still
  treats it as a paragraph it can point at.
*/

type ParagraphProps = { node?: unknown; children?: ReactNode; className?: string } & Record<string, unknown>;

/** The children that aren't just whitespace. */
function solid(children: ReactNode): ReactNode[] {
  return Children.toArray(children).filter((c) => !(typeof c === "string" && !c.trim()));
}

function textOf(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (isValidElement(node)) return textOf((node as ReactElement<{ children?: ReactNode }>).props.children);
  return "";
}

const classOf = (el: ReactNode) =>
  isValidElement(el) ? String((el as ReactElement<{ className?: string }>).props.className ?? "") : "";

/** An equals sign and at least one operator, short, and not a sentence. */
export function looksLikeFormula(text: string): boolean {
  const t = text.trim();
  if (t.length < 5 || t.length > 140 || !t.includes("=")) return false;
  if (!/[×÷±·∙*/^+−\-√∑∫]|[₀-ₜ²³¹⁰-ⁿ]/.test(t)) return false;
  // A sentence has several ordinary words after the last "=" ending in a full stop.
  return !/[.!?]$/.test(t) || /\d\.$/.test(t);
}

export function NoteParagraph({ node, children, className, ...rest }: ParagraphProps) {
  const parts = solid(children);
  const only = parts.length === 1 ? parts[0] : null;
  const mathOnly = only != null && /\bkatex\b/.test(classOf(only));
  const boldFormula =
    only != null && isValidElement(only) && (only as ReactElement).type === "strong" && looksLikeFormula(textOf(only));

  if (!mathOnly && !boldFormula) {
    return (
      <p className={className} {...rest}>
        {children}
      </p>
    );
  }
  return (
    <p
      className={cn(
        className,
        "an-formula !my-5 overflow-x-auto rounded-xl border border-border/60 bg-muted/35 px-4 py-3 text-center",
        mathOnly && "[&_.katex]:text-[1.2em]",
        // A plain-text formula: the maths font, and not bolded like an ordinary term.
        boldFormula && "text-[1.12em] [font-family:KaTeX_Main,'Times_New_Roman',serif] [&_strong]:font-normal",
      )}
      data-formula={mathOnly ? "math" : "text"}
      {...rest}
    >
      {children}
    </p>
  );
}
