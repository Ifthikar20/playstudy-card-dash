/**
 * Proves the two note-rendering defences hold against the payloads from the security
 * audit. Runs with plain Node (type stripping), no test runner needed:
 *
 *   npm run check:safety
 *
 * 1. Markdown → HTML through the same rehype chain the app uses (remark-gfm,
 *    remark-math, rehype-raw, rehype-sanitize with NOTE_SCHEMA): nothing but <mark>
 *    may survive as HTML, whatever text tricks the source contains.
 * 2. The graph expression evaluator: letter-free JavaScript and every other non-maths
 *    input must fail to compile, while ordinary expressions evaluate correctly.
 */
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkRehype from "remark-rehype";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import { NOTE_SCHEMA } from "../src/lib/notes/sanitizeSchema.ts";
import { MATH_OPTS, newTagRe } from "../src/lib/notes/units.ts";
import { compileExpression, isSafeExpression } from "../src/lib/guide/mathExpr.ts";

let failures = 0;
const check = (ok: boolean, what: string) => {
  console.log(`${ok ? "ok  " : "FAIL"} ${what}`);
  if (!ok) failures++;
};

/* The single-pass text strip from render.tsx, kept here byte for byte. */
const sanitizeNotes = (md: string) =>
  md.replace(newTagRe(), (m, tag: string) => (/^mark$/i.test(tag) ? (m.startsWith("</") ? "</mark>" : "<mark>") : ""));

/* The sanitized tree, flattened to (tag, properties) pairs: the same tree react-markdown
   hands to React, so this is checked one step closer to the DOM than any HTML string. */
type Flat = { tag: string; props: Record<string, unknown> };
const flatten = (node: { type: string; tagName?: string; properties?: Record<string, unknown>; children?: unknown[] }, out: Flat[] = []) => {
  if (node.type === "element" && node.tagName) out.push({ tag: node.tagName, props: node.properties ?? {} });
  for (const child of (node.children ?? []) as Array<Parameters<typeof flatten>[0]>) flatten(child, out);
  return out;
};
const render = async (md: string) => {
  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkMath, MATH_OPTS)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)
    .use(rehypeSanitize, NOTE_SCHEMA);
  const tree = await processor.run(processor.parse(sanitizeNotes(md)));
  return flatten(tree as Parameters<typeof flatten>[0]);
};
/* <img> is ordinary Markdown (the GitHub schema keeps it, with src limited to http/https), so
   it is not dangerous by itself; its attributes are covered by the handler/URL checks. */
const DANGEROUS_TAGS = new Set(["iframe", "svg", "object", "embed", "script", "style", "form", "input", "meta", "link", "base", "video", "audio", "math"]);
const describe = (els: Flat[]) => els.map((e) => `${e.tag}${Object.keys(e.props).length ? JSON.stringify(e.props) : ""}`).join(" ");

const hostile = [
  '<<b>iframe srcdoc="&lt;script&gt;alert(1)&lt;/script&gt;">',
  "<<b>img src=x onerror=alert(1)>",
  '<<b>a href="javascript:alert(1)">x</a>',
  "<mark onclick=alert(1)>hi</mark>",
  "[x](javascript:alert(1))",
  "<<i>svg onload=alert(1)>",
  '<<b>object data="data:text/html,<script>alert(1)</script>">',
  "<<b>style>body{display:none}</style>",
  "<<b>script>alert(1)</script>",
];
for (const md of hostile) {
  const els = await render(md);
  const bad = els.some(
    (e) =>
      DANGEROUS_TAGS.has(e.tag) ||
      Object.entries(e.props).some(
        ([k, v]) => /^on[a-z]/i.test(k) || k === "srcDoc" || (typeof v === "string" && /^\s*(javascript|data|vbscript):/i.test(v)),
      ),
  );
  check(!bad, `no live HTML from ${JSON.stringify(md)} → [${describe(els)}]`);
}

const benign = await render(
  "Water is <mark>H2O</mark>, see [docs](https://example.com) and\n\n$$\nE = mc^2\n$$\n\n```playstudy-visual\n{\"kind\":\"graph\"}\n```",
);
const has = (tag: string, test: (p: Record<string, unknown>) => boolean = () => true) => benign.some((e) => e.tag === tag && test(e.props));
check(has("mark"), "mark survives");
check(has("a", (p) => p.href === "https://example.com"), "https link survives");
check(has("code", (p) => Array.isArray(p.className) && (p.className as string[]).includes("math-display")), "math source survives for KaTeX");
check(has("code", (p) => Array.isArray(p.className) && (p.className as string[]).includes("language-playstudy-visual")), "pinned visual fence keeps its class");
check(benign.every((e) => !Object.keys(e.props).some((k) => /^on/i.test(k))), "no handler attributes anywhere");

/* 2. the expression evaluator */
const near = (a: number, b: number) => Math.abs(a - b) < 1e-9;
const f1 = compileExpression("x^2 - 2*x + 1");
check(!!f1 && near(f1(3), 4), "x^2 - 2*x + 1 at 3 = 4");
const f2 = compileExpression("sin(pi/2) + cos(0) + 2**3");
check(!!f2 && near(f2(0), 10), "sin(pi/2) + cos(0) + 2**3 = 10");
const f3 = compileExpression("-x^2");
check(!!f3 && near(f3(2), -4), "-x^2 at 2 = -4 (unary minus binds looser than ^)");
const f4 = compileExpression("2^3^2");
check(!!f4 && near(f4(0), 512), "2^3^2 is right-associative");
const f5 = compileExpression("max(x, 1) / min(x, 1) + sqrt(abs(x))");
check(!!f5 && near(f5(4), 6), "two-argument functions");
const f6 = compileExpression("1/x");
check(!!f6 && !Number.isFinite(f6(0)), "1/x at 0 is not finite");
for (const bad of [
  "[]+[]",
  "(![]+[])[+[]]",
  "x; alert(1)",
  "this.constructor.constructor('alert(1)')()",
  "x.constructor",
  "window",
  "2x",
  "sin(x, 1)",
  "foo(x)",
  "x^",
  "",
  "x".repeat(300),
  "import('x')",
  "x`",
]) {
  check(compileExpression(bad) === null, `rejects ${JSON.stringify(bad.length > 40 ? bad.slice(0, 40) + "…" : bad)}`);
}
check(!isSafeExpression("(![]+[])[+[]]"), "isSafeExpression refuses letter-free JS");
check(isSafeExpression("x*sin(x)"), "isSafeExpression accepts maths");

console.log(failures ? `\n${failures} check(s) FAILED` : "\nall checks passed");
process.exit(failures ? 1 : 0);
