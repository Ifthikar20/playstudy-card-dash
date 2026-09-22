import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GlobalWorkerOptions, getDocument, type PDFDocumentProxy, type PDFPageProxy, type RenderTask } from "pdfjs-dist";
import type { TextItem } from "pdfjs-dist/types/src/display/api";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { Loader2 } from "lucide-react";
import { BLOCKS_ROOT_ATTR } from "@/lib/guide/blocks";
import { buildBlocks, edgeKey, placeItems, repeatedEdgeLines, type PdfBlock, type PlacedText } from "@/lib/pdf/textBlocks";

GlobalWorkerOptions.workerSrc = workerUrl;

/*
  The uploaded PDF itself, for Teach mode to explain.

  Each page is a canvas (the real page, drawn by PDF.js) under an invisible text
  layer built from the page's own text: paragraphs, headings and bullets as real
  <p>/<h2>/<li> elements, each a box over its lines on the canvas. That layer is
  shaped exactly like a section of notes (`data-guide-notes="-N"` for page N,
  blocks indexed by lib/guide/blocks), so Teach mode's pointer can glide over the
  PDF's lines, underline a phrase and outline a paragraph the same way it does in
  the notes. The text is transparent but selectable.

  Every page's text layer is built up front (Teach mode indexes all sections when it
  opens); canvases are drawn as they near the screen and let go when far away, so a
  200-page PDF doesn't hold 200 bitmaps.
*/

function bytesOf(b64: string): Uint8Array {
  const bin = atob(b64.replace(/^data:[^,]*,/, "").replace(/\s+/g, ""));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

let measureCtx: CanvasRenderingContext2D | null = null;
/** Width of `text` in the text layer's font at `size` px, to stretch each span over its glyphs. */
function measure(text: string, size: number): number {
  measureCtx ??= document.createElement("canvas").getContext("2d");
  if (!measureCtx) return text.length * size * 0.5;
  measureCtx.font = `${size}px sans-serif`;
  return measureCtx.measureText(text).width;
}

function Piece({ p, next, origin }: { p: PlacedText; next?: PlacedText; origin: { left: number; top: number } }) {
  const text = p.text + p.after;
  // A separator space belongs to the gap it spans, so a range across words
  // underlines one continuous line rather than a word, a hole, a word.
  const sameLine = !!next && Math.abs(next.top - p.top) < p.height * 0.5;
  const target = p.after && sameLine ? Math.max(p.width, next.left - p.left) : p.width + (p.after ? p.height * 0.25 : 0);
  const natural = measure(text, p.height);
  return (
    <span
      style={{
        left: p.left - origin.left,
        top: p.top - origin.top,
        fontSize: p.height,
        transform: natural > 0 ? `scaleX(${target / natural})` : undefined,
      }}
    >
      {text}
    </span>
  );
}

/** What a block is once the whole document is known: a line repeated at the edge of several pages is a running header or footer. */
function kindOf(b: PdfBlock, edges: Set<string>): PdfBlock["kind"] {
  return edges.size && edges.has(edgeKey(b.text)) ? "furniture" : b.kind;
}

function Block({ b, edges }: { b: PdfBlock; edges: Set<string> }) {
  // Running headers and footers are plain divs: on the page, but not handed to Teach mode.
  const kind = kindOf(b, edges);
  const Tag = kind === "h2" ? "h2" : kind === "li" ? "li" : kind === "furniture" ? "div" : "p";
  return (
    <Tag className="pdf-block" data-pdf-kind={kind} style={{ left: b.left, top: b.top, width: b.width, height: b.height }}>
      {b.pieces.map((p, i) => (
        <Piece key={i} p={p} next={b.pieces[i + 1]} origin={b} />
      ))}
    </Tag>
  );
}

/** Blocks in reading order, with each run of bullets inside one <ul> so they are real list items. */
function TextLayer({ page, blocks, edges }: { page: number; blocks: PdfBlock[]; edges: Set<string> }) {
  const groups: PdfBlock[][] = [];
  for (const b of blocks) {
    const last = groups[groups.length - 1];
    if (last && kindOf(b, edges) === "li" && kindOf(last[0], edges) === "li") last.push(b);
    else groups.push([b]);
  }
  return (
    <div className="pdf-text" {...{ [BLOCKS_ROOT_ATTR]: String(-page) }}>
      {groups.map((g, i) =>
        kindOf(g[0], edges) === "li" ? (
          <ul key={i}>
            {g.map((b, j) => (
              <Block key={j} b={b} edges={edges} />
            ))}
          </ul>
        ) : (
          <Fragment key={i}>
            <Block b={g[0]} edges={edges} />
          </Fragment>
        ),
      )}
    </div>
  );
}

interface Layout {
  height: number;
  scale: number;
  blocks: PdfBlock[];
}

/** A page's text layer, as reported up once it's built. */
interface BuiltPage {
  blocks: PdfBlock[];
  height: number;
}

function PdfPage({
  doc,
  pageNumber,
  width,
  edges,
  onBuilt,
}: {
  doc: PDFDocumentProxy;
  pageNumber: number;
  width: number;
  edges: Set<string>;
  onBuilt: (page: number, built: BuiltPage) => void;
}) {
  const [layout, setLayout] = useState<Layout | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pageRef = useRef<PDFPageProxy | null>(null);
  const built = useRef(onBuilt);
  built.current = onBuilt;

  // The text layer: now, for every page.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const page = await doc.getPage(pageNumber);
      pageRef.current = page;
      const scale = width / page.getViewport({ scale: 1 }).width;
      const vp = page.getViewport({ scale });
      const content = await page.getTextContent();
      const items = content.items.filter((i): i is TextItem => "str" in i);
      const blocks = buildBlocks(placeItems(items, vp.transform, scale), vp.width, vp.height);
      if (cancelled) return;
      setLayout({ height: vp.height, scale, blocks });
      built.current(pageNumber, { blocks, height: vp.height });
    })().catch(() => {
      if (cancelled) return;
      setLayout({ height: width * 1.294, scale: 1, blocks: [] });
      built.current(pageNumber, { blocks: [], height: width * 1.294 });
    });
    return () => {
      cancelled = true;
    };
  }, [doc, pageNumber, width]);

  // The picture: drawn near the screen, released far from it.
  useEffect(() => {
    const el = boxRef.current;
    if (!layout || !el) return;
    let task: RenderTask | null = null;
    let drawn = false;
    const draw = async () => {
      if (drawn) return;
      drawn = true;
      const page = pageRef.current ?? (await doc.getPage(pageNumber));
      const canvas = canvasRef.current;
      if (!canvas || !drawn) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const vp = page.getViewport({ scale: layout.scale * dpr });
      canvas.width = Math.floor(vp.width);
      canvas.height = Math.floor(vp.height);
      task = page.render({ canvas, viewport: vp });
      await task.promise.catch(() => undefined);
    };
    const release = () => {
      if (!drawn) return;
      drawn = false;
      task?.cancel();
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.width = 0;
        canvas.height = 0;
      }
    };
    const near = new IntersectionObserver(([e]) => e.isIntersecting && void draw(), { rootMargin: "900px 0px" });
    const far = new IntersectionObserver(([e]) => !e.isIntersecting && release(), { rootMargin: "3200px 0px" });
    near.observe(el);
    far.observe(el);
    return () => {
      near.disconnect();
      far.disconnect();
      task?.cancel();
    };
  }, [layout, doc, pageNumber]);

  return (
    <div
      ref={boxRef}
      id={`pdf-page-${pageNumber}`}
      className="pdf-page"
      style={{ width, height: layout?.height ?? width * 1.294 }}
      aria-label={`Page ${pageNumber}`}
    >
      <canvas ref={canvasRef} className="pdf-canvas" aria-hidden />
      {layout && <TextLayer page={pageNumber} blocks={layout.blocks} edges={edges} />}
      <span className="pdf-page-num" aria-hidden>
        {pageNumber}
      </span>
    </div>
  );
}

export interface PdfPageInfo {
  page: number;
  /** The page's first heading, when it has one: a label for the outline. */
  heading: string | null;
}

/** Widest a page is drawn: past this, lines get too long to follow. */
const MAX_PAGE_WIDTH = 980;

/**
 * The whole PDF, one page under another, fitted to the column's width. `file` is
 * the PDF as base64 (what the session JSON carries) or as bytes (fetchSessionPdf).
 * `onReady` fires once every page's text layer is in place (Teach mode needs all
 * of them), and again after a re-layout.
 */
export function PdfDocument({ file, onReady }: { file: string | ArrayBuffer; onReady?: (pages: PdfPageInfo[]) => void }) {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [width, setWidth] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const built = useRef(new Map<number, BuiltPage>());
  // Running headers and footers, found across all pages (as edgeKey()s, one per line).
  const [edgeList, setEdgeList] = useState("");
  const edges = useMemo(() => new Set(edgeList ? edgeList.split("\n") : []), [edgeList]);
  const ready = useRef(onReady);
  ready.current = onReady;

  useEffect(() => {
    let cancelled = false;
    setDoc(null);
    setError(null);
    let task: ReturnType<typeof getDocument> | null = null;
    try {
      // PDF.js takes ownership of the bytes it's given (they move to its worker),
      // so it always gets a copy: the caller's buffer stays usable for next time.
      const data = typeof file === "string" ? bytesOf(file) : new Uint8Array(file.slice(0));
      task = getDocument({ data, isEvalSupported: false });
      task.promise.then(
        (d) => !cancelled && setDoc(d),
        () => !cancelled && setError("This PDF couldn't be opened."),
      );
    } catch {
      setError("This PDF couldn't be opened.");
    }
    return () => {
      cancelled = true;
      void task?.destroy();
    };
  }, [file]);

  // Fit to the column; re-lay the pages only when the width really changes.
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    // Measure now rather than waiting a frame for the observer's first report.
    setWidth(Math.min(MAX_PAGE_WIDTH, Math.round(el.getBoundingClientRect().width)));
    let t: number | undefined;
    const ro = new ResizeObserver(([entry]) => {
      window.clearTimeout(t);
      t = window.setTimeout(
        () =>
          setWidth((w) => {
            const next = Math.min(MAX_PAGE_WIDTH, Math.round(entry.contentRect.width));
            return Math.abs(next - w) > 8 ? next : w;
          }),
        120,
      );
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
      window.clearTimeout(t);
    };
  }, []);

  useEffect(() => {
    built.current = new Map();
  }, [doc, width]);

  const onBuilt = useCallback(
    (page: number, result: BuiltPage) => {
      built.current.set(page, result);
      if (!doc || built.current.size !== doc.numPages) return;
      const pages = Array.from({ length: doc.numPages }, (_, i) => built.current.get(i + 1) ?? { blocks: [], height: 0 });
      const found = repeatedEdgeLines(pages);
      setEdgeList([...found].sort().join("\n"));
      ready.current?.(
        pages.map((p, i) => {
          const heading = p.blocks.find((b) => b.kind === "h2" && !found.has(edgeKey(b.text)))?.text ?? null;
          return { page: i + 1, heading: heading && heading.length > 70 ? `${heading.slice(0, 68)}…` : heading };
        }),
      );
    },
    [doc],
  );

  return (
    <div ref={boxRef} className="pdf-doc">
      {error && <p className="rounded-xl border border-border bg-muted/40 p-6 text-center text-sm text-muted-foreground">{error}</p>}
      {!doc && !error && (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Opening the PDF…
        </div>
      )}
      {doc &&
        width > 0 &&
        Array.from({ length: doc.numPages }, (_, i) => (
          <PdfPage key={i + 1} doc={doc} pageNumber={i + 1} width={width} edges={edges} onBuilt={onBuilt} />
        ))}
    </div>
  );
}
