import { useMemo } from "react";
import type { GuideGraph as GuideGraphData } from "@/services/guide";
import { compileExpression } from "@/lib/guide/mathExpr";

/*
  A y = f(x) function graph for the Teach mode whiteboard. The expression is parsed
  and evaluated by lib/guide/mathExpr (never handed to the JavaScript engine: a
  pinned graph inside a note is not checked by the server), sampled across the
  domain, and plotted with light axes.

  Everything on top of the curve is computed from the same expression — the shaded
  area under it, the marked roots and turning points, a second curve to compare, the
  tangent at a point, the asymptotes — so none of it can disagree with the function.
  That's what makes calculus and stats drawable here rather than merely described.
*/

const W = 480;
const H = 300;
const PAD = { l: 34, r: 14, t: 14, b: 28 };
const CURVE = "#ec4899";
const CURVE2 = "#3b82f6";
const fmtTick = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1));
/** Where the tutor's pointer touches a part (data-part-at), in this SVG's own units. */
const partAt = (x: number, y: number) => `${x.toFixed(1)} ${y.toFixed(1)}`;
const sample = (f: (x: number) => number, x: number): number | null => {
  try {
    const v = f(x);
    return Number.isFinite(v) ? v : null;
  } catch {
    return null;
  }
};

export function GuideGraph({ graph }: { graph: GuideGraphData }) {
  const model = useMemo(() => {
    const f = compileExpression(graph.fn);
    const g = graph.fn2 ? compileExpression(graph.fn2) : null;
    const [x0, x1] = graph.domain && graph.domain.length === 2 ? graph.domain : [-6, 6];
    if (!f) return null;
    const N = 200;
    const pts: { x: number; y: number | null }[] = [];
    const pts2: { x: number; y: number | null }[] = [];
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i <= N; i++) {
      const x = x0 + ((x1 - x0) * i) / N;
      const y = sample(f, x);
      if (y != null) {
        lo = Math.min(lo, y);
        hi = Math.max(hi, y);
      }
      pts.push({ x, y });
      if (g) {
        const y2 = sample(g, x);
        if (y2 != null) {
          lo = Math.min(lo, y2);
          hi = Math.max(hi, y2);
        }
        pts2.push({ x, y: y2 });
      }
    }
    if (!Number.isFinite(lo) || !Number.isFinite(hi)) return null;
    // A curve that runs off to infinity (1/x, tan) would otherwise flatten everything
    // else against the axis, so frame the bulk of the samples instead of the extremes.
    if (graph.asymptotes?.length) {
      const ys = [...pts, ...pts2].map((p) => p.y).filter((y): y is number => y != null).sort((a, b) => a - b);
      if (ys.length > 8) {
        lo = ys[Math.floor(ys.length * 0.06)];
        hi = ys[Math.ceil(ys.length * 0.94) - 1];
      }
    }
    if (lo === hi) {
      lo -= 1;
      hi += 1;
    }
    // clamp an extreme range (asymptotes) to something readable
    const span = hi - lo;
    const pad = span * 0.1;
    let yMin = lo - pad;
    let yMax = hi + pad;
    if (yMax - yMin > 1e4) {
      yMin = Math.max(yMin, -50);
      yMax = Math.min(yMax, 50);
    }
    // a shaded area is measured from the x axis, so make sure zero is on screen
    if (graph.shade) {
      yMin = Math.min(yMin, 0);
      yMax = Math.max(yMax, 0);
    }
    return { f, pts, pts2, x0, x1, yMin, yMax };
  }, [graph.fn, graph.fn2, graph.domain, graph.shade]);

  if (!model) {
    return (
      <div className="guide-graph">
        {graph.title && <div className="guide-chart-title">{graph.title}</div>}
        <div className="guide-board-raw">y = {graph.fn}</div>
      </div>
    );
  }

  const { f, pts, pts2, x0, x1, yMin, yMax } = model;
  const sx = (x: number) => PAD.l + ((x - x0) / (x1 - x0)) * (W - PAD.l - PAD.r);
  const sy = (y: number) => PAD.t + (1 - (y - yMin) / (yMax - yMin)) * (H - PAD.t - PAD.b);
  const clampY = (y: number) => Math.max(yMin, Math.min(yMax, y));

  // build a path, breaking on gaps and big jumps (asymptotes)
  const pathOf = (samples: { x: number; y: number | null }[]) => {
    let d = "";
    let prev: number | null = null;
    for (const p of samples) {
      if (p.y == null || Math.abs(p.y) > 1e6) {
        prev = null;
        continue;
      }
      const cmd = prev == null || Math.abs(p.y - prev) > (yMax - yMin) * 1.5 ? "M" : "L";
      d += `${cmd}${sx(p.x).toFixed(1)},${sy(clampY(p.y)).toFixed(1)} `;
      prev = p.y;
    }
    return d;
  };

  const xAxis = yMin <= 0 && yMax >= 0 ? sy(0) : null;
  const yAxis = x0 <= 0 && x1 >= 0 ? sx(0) : null;
  const xticks = [x0, x0 + (x1 - x0) / 2, x1];
  const yticks = [yMax, (yMax + yMin) / 2, yMin];

  // the area under the curve between a and b, as a filled band down to y = 0
  let shadePath = "";
  let shadeAt: string | undefined;
  if (graph.shade) {
    const [a, b] = [Math.max(x0, graph.shade[0]), Math.min(x1, graph.shade[1])];
    if (b > a) {
      const steps = 80;
      const top: string[] = [];
      // The pointer touches the band near its centroid: the area-weighted middle across,
      // then halfway up the band there, so the tip is always on the shading itself (an
      // area that dips below the axis would otherwise put a plain centroid on the axis).
      const base = sy(clampY(0));
      const strips: { x: number; h: number; mid: number }[] = [];
      for (let i = 0; i <= steps; i++) {
        const x = a + ((b - a) * i) / steps;
        const y = sample(f, x);
        const ty = sy(clampY(y ?? 0));
        top.push(`${sx(x).toFixed(1)},${ty.toFixed(1)}`);
        strips.push({ x: sx(x), h: Math.abs(base - ty), mid: (base + ty) / 2 });
      }
      shadePath = `M${sx(a).toFixed(1)},${sy(clampY(0)).toFixed(1)} L${top.join(" L")} L${sx(b).toFixed(1)},${sy(clampY(0)).toFixed(1)} Z`;
      const area = strips.reduce((s, p) => s + p.h, 0);
      const cxs = area > 0 ? strips.reduce((s, p) => s + p.x * p.h, 0) / area : sx((a + b) / 2);
      // Only a strip at least half as tall as the tallest can take the tip: an even band
      // (x^2 from -1 to 1, sin x from -pi to pi) has its centroid right where the curve
      // meets the axis, and the band there has no height at all.
      const tallest = Math.max(...strips.map((p) => p.h));
      const solid = strips.filter((p) => p.h >= tallest / 2);
      const near = solid.reduce((best, p) => (Math.abs(p.x - cxs) < Math.abs(best.x - cxs) ? p : best), solid[0]);
      shadeAt = partAt(near.x, near.mid);
    }
  }

  // A point on a curve about 70% of the way across, for the pointer to touch; if the
  // curve is off the plot there, the nearest sample that is on it.
  const onCurve = (samples: { x: number; y: number | null }[]) => {
    const start = Math.round((samples.length - 1) * 0.7);
    for (let k = 0; k < samples.length; k++) {
      for (const j of [start + k, start - k]) {
        const p = samples[j];
        if (p && p.y != null && p.y >= yMin && p.y <= yMax) return partAt(sx(p.x), sy(p.y));
      }
    }
    return undefined;
  };

  // A vertical asymptote is touched a third of the way down (or two thirds, or halfway),
  // wherever no horizontal line crosses it. Halfway down is where the x axis crosses in
  // a curve centred on zero (1/x, tan x), so the tip would sit on a crossing of lines.
  const plotH = H - PAD.t - PAD.b;
  const flats = [
    xAxis,
    ...(graph.asymptotes ?? []).map((a) =>
      !(a.x != null && a.x >= x0 && a.x <= x1) && a.y != null && a.y >= yMin && a.y <= yMax ? sy(a.y) : null,
    ),
  ].filter((v): v is number => v != null);
  const upright =
    [1 / 3, 2 / 3, 1 / 2].map((k) => PAD.t + plotH * k).find((y) => flats.every((v) => Math.abs(v - y) >= 16)) ?? PAD.t + plotH / 3;

  // the tangent at a point, from a central difference — the derivative of the drawn curve
  let tangent: { x1: number; y1: number; x2: number; y2: number; px: number; py: number } | null = null;
  if (graph.tangent_at != null) {
    const a = graph.tangent_at;
    const h = (x1 - x0) / 1000;
    const ya = sample(f, a);
    const yl = sample(f, a - h);
    const yr = sample(f, a + h);
    if (ya != null && yl != null && yr != null) {
      const m = (yr - yl) / (2 * h);
      const reach = (x1 - x0) / 5;
      tangent = {
        x1: sx(a - reach),
        y1: sy(clampY(ya - m * reach)),
        x2: sx(a + reach),
        y2: sy(clampY(ya + m * reach)),
        px: sx(a),
        py: sy(clampY(ya)),
      };
    }
  }

  return (
    <div className="guide-graph">
      {graph.title && <div className="guide-chart-title">{graph.title}</div>}
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" className="guide-chart-svg" role="img">
        {yticks.map((v, i) => (
          <g key={"y" + i}>
            <line x1={PAD.l} y1={sy(v)} x2={W - PAD.r} y2={sy(v)} className="guide-chart-grid" />
            <text x={PAD.l - 4} y={sy(v)} className="guide-chart-tick" textAnchor="end" dominantBaseline="middle">
              {fmtTick(v)}
            </text>
          </g>
        ))}
        {xticks.map((v, i) => (
          <text key={"x" + i} x={sx(v)} y={H - 8} className="guide-chart-tick" textAnchor="middle">
            {fmtTick(v)}
          </text>
        ))}
        {/* Part anchors for the tutor's pointer. The shading, tangent, asymptotes and
            curves have no writing of their own, so each is named the way a teacher would
            say it; points keep their own labels and indices match graph.points. */}
        {shadePath && (
          <path
            d={shadePath}
            className="guide-graph-shade"
            data-board-part="shade"
            data-board-label={graph.shade ? `shaded area from x = ${graph.shade[0]} to x = ${graph.shade[1]}` : undefined}
            data-part-at={shadeAt}
          />
        )}
        {/* a vertical asymptote is touched clear of any horizontal line, a horizontal one
            a third of the way across, so the two in the usual 1/x picture don't share a spot */}
        {graph.asymptotes?.map((a, i) =>
          a.x != null && a.x >= x0 && a.x <= x1 ? (
            <line
              key={"a" + i}
              x1={sx(a.x)}
              y1={PAD.t}
              x2={sx(a.x)}
              y2={H - PAD.b}
              className="guide-graph-asymptote"
              data-board-part={`asymptotes.${i}`}
              data-board-label={`asymptote x = ${a.x}`}
              data-part-at={partAt(sx(a.x), upright)}
            />
          ) : a.y != null && a.y >= yMin && a.y <= yMax ? (
            <line
              key={"a" + i}
              x1={PAD.l}
              y1={sy(a.y)}
              x2={W - PAD.r}
              y2={sy(a.y)}
              className="guide-graph-asymptote"
              data-board-part={`asymptotes.${i}`}
              data-board-label={`asymptote y = ${a.y}`}
              data-part-at={partAt(PAD.l + (W - PAD.l - PAD.r) / 3, sy(a.y))}
            />
          ) : null,
        )}
        {xAxis != null && <line x1={PAD.l} y1={xAxis} x2={W - PAD.r} y2={xAxis} className="guide-graph-axis" />}
        {yAxis != null && <line x1={yAxis} y1={PAD.t} x2={yAxis} y2={H - PAD.b} className="guide-graph-axis" />}
        {graph.fn2 && (
          <path
            d={pathOf(pts2)}
            className="guide-graph-curve"
            fill="none"
            stroke={CURVE2}
            strokeDasharray="7 5"
            data-board-part="curve2"
            data-board-label={`y = ${graph.fn2}`}
            data-part-at={onCurve(pts2)}
          />
        )}
        <path
          d={pathOf(pts)}
          className="guide-graph-curve"
          fill="none"
          stroke={CURVE}
          data-board-part="curve"
          data-board-label={`y = ${graph.fn}`}
          data-part-at={onCurve(pts)}
        />
        {tangent && (
          <g data-board-part="tangent" data-board-label={`tangent at x = ${graph.tangent_at}`} data-part-at={partAt(tangent.px, tangent.py)}>
            <line x1={tangent.x1} y1={tangent.y1} x2={tangent.x2} y2={tangent.y2} className="guide-graph-tangent" />
            <circle cx={tangent.px} cy={tangent.py} r={4.5} fill={CURVE} />
          </g>
        )}
        {graph.points?.map((p, i) => {
          const y = p.y ?? sample(f, p.x);
          if (y == null || p.x < x0 || p.x > x1) return null;
          return (
            <g key={"p" + i} data-board-part={`points.${i}`} data-board-label={p.label || undefined} data-part-at={partAt(sx(p.x), sy(clampY(y)))}>
              <circle cx={sx(p.x)} cy={sy(clampY(y))} r={5} className="guide-graph-point" />
              {p.label && (
                <text x={sx(p.x)} y={sy(clampY(y)) - 12} className="guide-chart-label" textAnchor="middle">
                  {p.label}
                </text>
              )}
            </g>
          );
        })}
        <text x={W - PAD.r} y={PAD.t + 12} className="guide-graph-fnlabel" textAnchor="end">
          y = {graph.fn}
        </text>
        {graph.fn2 && (
          <text x={W - PAD.r} y={PAD.t + 30} className="guide-graph-fnlabel" textAnchor="end" style={{ fill: CURVE2 }}>
            y = {graph.fn2}
          </text>
        )}
      </svg>
    </div>
  );
}
