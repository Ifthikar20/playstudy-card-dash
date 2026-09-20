import type { GuideGeometry as GuideGeometryData } from "@/services/guide";

/*
  A labelled geometric figure for the Teach mode whiteboard: Pythagoras, circle
  theorems, an area derivation.

  When real side lengths are given the triangle is CONSTRUCTED from them (law of
  cosines) rather than sketched, so a 3-4-5 really is right-angled on screen and
  the drawing can never contradict the numbers being spoken.
*/

const W = 480;
const H = 268;
const INK = "#ec4899";
const FILL = "rgba(236,72,153,0.10)";

const val = (g: GuideGeometryData, k: string) => g.values[k];
const text = (g: GuideGeometryData, k: string, fallback = "") => g.labels[k] || (val(g, k) != null ? String(val(g, k)) : fallback);

/** Fit a set of points into the drawing area, flipping y so maths-up is screen-up. */
function fit(pts: { x: number; y: number }[], pad = 58) {
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const k = Math.min((W - pad * 2) / (maxX - minX || 1), (H - pad * 2) / (maxY - minY || 1));
  const ox = (W - (maxX - minX) * k) / 2 - minX * k;
  const oy = (H - (maxY - minY) * k) / 2 + maxY * k;
  return (p: { x: number; y: number }) => ({ x: ox + p.x * k, y: oy - p.y * k });
}

function Triangle({ geo }: { geo: GuideGeometryData }) {
  const right = geo.shape === "right_triangle" || geo.show.includes("right_angle");
  let a = val(geo, "a");
  let b = val(geo, "b");
  let c = val(geo, "c");
  // a right triangle given only its legs: the hypotenuse follows
  if (right && a && b && !c) c = Math.hypot(a, b);
  if (right && a && c && !b) b = Math.sqrt(Math.max(0, c * c - a * a));
  const valid = a && b && c && a + b > c && a + c > b && b + c > a;
  let A = { x: 0, y: 0 };
  let B = { x: 4, y: 0 };
  let C = { x: right ? 0 : 1.4, y: 3 };
  if (valid) {
    // side a is opposite A, b opposite B, c opposite C: put c along the base
    const cosA = (b! * b! + c! * c! - a! * a!) / (2 * b! * c!);
    const angA = Math.acos(Math.max(-1, Math.min(1, cosA)));
    A = { x: 0, y: 0 };
    B = { x: c!, y: 0 };
    C = { x: b! * Math.cos(angA), y: b! * Math.sin(angA) };
  }
  const t = fit([A, B, C]);
  const [pA, pB, pC] = [t(A), t(B), t(C)];
  const mid = (p: { x: number; y: number }, q: { x: number; y: number }) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
  const centroid = { x: (pA.x + pB.x + pC.x) / 3, y: (pA.y + pB.y + pC.y) / 3 };
  const out = (p: { x: number; y: number }, by = 20) => {
    const dx = p.x - centroid.x;
    const dy = p.y - centroid.y;
    const len = Math.hypot(dx, dy) || 1;
    return { x: p.x + (dx / len) * by, y: p.y + (dy / len) * by + 4 };
  };
  // the right angle sits at whichever vertex is opposite the longest side
  const rightAt = right ? (valid ? (c! >= a! && c! >= b! ? pC : a! >= b! ? pA : pB) : pA) : null;
  const sides: [string, { x: number; y: number }][] = [
    ["a", mid(pB, pC)],
    ["b", mid(pA, pC)],
    ["c", mid(pA, pB)],
  ];
  return (
    <>
      <polygon points={`${pA.x},${pA.y} ${pB.x},${pB.y} ${pC.x},${pC.y}`} fill={FILL} stroke={INK} strokeWidth={2.5} strokeLinejoin="round" />
      {rightAt && (
        <rect
          x={rightAt.x - (rightAt === pB ? 16 : 0)}
          y={rightAt.y - (rightAt === pC ? 0 : 16)}
          width={16}
          height={16}
          fill="none"
          stroke={INK}
          strokeWidth={1.8}
        />
      )}
      {sides.map(([k, p]) => {
        const label = text(geo, k);
        return label ? (
          <text key={k} x={out(p, 16).x} y={out(p, 16).y} className="guide-geo-label" textAnchor="middle">
            {label}
          </text>
        ) : null;
      })}
      {(["A", "B", "C"] as const).map((k, i) => {
        const p = [pA, pB, pC][i];
        const label = geo.labels[k] || (val(geo, k) != null ? `${val(geo, k)}°` : "");
        return label ? (
          <text key={k} x={out(p).x} y={out(p).y} className="guide-geo-vertex" textAnchor="middle">
            {label}
          </text>
        ) : null;
      })}
    </>
  );
}

function Circle({ geo }: { geo: GuideGeometryData }) {
  const cx = W / 2;
  const cy = H / 2;
  const r = 92;
  const show = geo.show;
  const rLabel = text(geo, "radius", "r");
  return (
    <>
      <circle cx={cx} cy={cy} r={r} fill={FILL} stroke={INK} strokeWidth={2.5} />
      <circle cx={cx} cy={cy} r={3.5} fill={INK} />
      {show.includes("diameter") && (
        <>
          <line x1={cx - r} y1={cy} x2={cx + r} y2={cy} stroke={INK} strokeWidth={2} />
          <text x={cx} y={cy - 10} className="guide-geo-label" textAnchor="middle">
            {geo.labels.diameter || "d"}
          </text>
        </>
      )}
      {(show.includes("radius") || !show.length) && (
        <>
          <line x1={cx} y1={cy} x2={cx + r * Math.cos(-0.6)} y2={cy + r * Math.sin(-0.6)} stroke={INK} strokeWidth={2} />
          <text x={cx + 46} y={cy - 24} className="guide-geo-label" textAnchor="middle">
            {rLabel}
          </text>
        </>
      )}
      {show.includes("chord") && <line x1={cx - r * 0.8} y1={cy + r * 0.6} x2={cx + r * 0.8} y2={cy + r * 0.6} stroke={INK} strokeWidth={2} strokeDasharray="6 4" />}
      {show.includes("tangent") && <line x1={cx - r - 20} y1={cy - r} x2={cx + r + 20} y2={cy - r} stroke={INK} strokeWidth={2} strokeDasharray="6 4" />}
    </>
  );
}

function Box({ geo }: { geo: GuideGeometryData }) {
  const wv = val(geo, "width") ?? 4;
  const hv = geo.shape === "square" ? wv : val(geo, "height") ?? 3;
  const k = Math.min(300 / wv, 150 / hv);
  const bw = wv * k;
  const bh = hv * k;
  const x = (W - bw) / 2;
  const y = (H - bh) / 2;
  return (
    <>
      <rect x={x} y={y} width={bw} height={bh} fill={FILL} stroke={INK} strokeWidth={2.5} rx={2} />
      {geo.show.includes("diagonal") && <line x1={x} y1={y + bh} x2={x + bw} y2={y} stroke={INK} strokeWidth={2} strokeDasharray="6 4" />}
      <text x={x + bw / 2} y={y + bh + 24} className="guide-geo-label" textAnchor="middle">
        {text(geo, "width")}
      </text>
      <text x={x - 12} y={y + bh / 2 + 5} className="guide-geo-label" textAnchor="end">
        {text(geo, "height")}
      </text>
    </>
  );
}

export function GuideGeometry({ geometry }: { geometry: GuideGeometryData }) {
  const { title, shape } = geometry;
  return (
    <div className="guide-geometry">
      {title && <div className="guide-chart-title">{title}</div>}
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" className="guide-chart-svg" role="img">
        {shape === "circle" ? <Circle geo={geometry} /> : shape === "rectangle" || shape === "square" ? <Box geo={geometry} /> : <Triangle geo={geometry} />}
      </svg>
    </div>
  );
}
