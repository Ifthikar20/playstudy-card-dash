import type { GuideForces as GuideForcesData } from "@/services/guide";

/*
  A free-body diagram, or tip-to-tail vector addition, for the Teach mode whiteboard.

  Two drawings that share all their machinery: arrows at real angles, scaled by
  real magnitudes. "forces" puts them on a body (weight down, normal up, friction
  back); "vectors" chains them tip to tail and shows the resultant the backend
  worked out. Because both are computed from the numbers, the picture can't
  disagree with the arithmetic.
*/

const W = 480;
const H = 300;
const COLORS = ["#ec4899", "#3b82f6", "#14b8a6", "#f59e0b", "#8b5cf6", "#84cc16"];

/** Screen delta for an angle in degrees anticlockwise from east (SVG y grows down). */
const dir = (deg: number) => ({ dx: Math.cos((deg * Math.PI) / 180), dy: -Math.sin((deg * Math.PI) / 180) });

function Arrow({ x1, y1, x2, y2, color, dashed }: { x1: number; y1: number; x2: number; y2: number; color: string; dashed?: boolean }) {
  return (
    <line
      x1={x1}
      y1={y1}
      x2={x2}
      y2={y2}
      stroke={color}
      strokeWidth={3}
      strokeLinecap="round"
      strokeDasharray={dashed ? "7 5" : undefined}
      markerEnd={`url(#gf-head-${color.replace("#", "")})`}
    />
  );
}

export function GuideForces({ forces }: { forces: GuideForcesData }) {
  const { title, mode, body, unit, vectors, resultant } = forces;
  const mags = vectors.map((v) => v.magnitude ?? 1);
  const maxMag = Math.max(...mags, 1);
  const palette = [...new Set([...COLORS.slice(0, vectors.length), "#64748b"])];
  const label = (v: { label: string; magnitude?: number }) => {
    // the model often writes the size into the label already ("3 N east") — don't repeat it
    const size = v.magnitude != null ? `${v.magnitude}${unit ? " " + unit : ""}` : "";
    const dup = size && v.label.includes(String(v.magnitude));
    return [v.label, dup ? "" : size].filter(Boolean).join(" ");
  };

  const defs = (
    <defs>
      {palette.map((c) => (
        <marker key={c} id={`gf-head-${c.replace("#", "")}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" fill={c} />
        </marker>
      ))}
    </defs>
  );

  if (mode === "vectors") {
    // tip to tail from a fixed origin, then the resultant straight across
    const scale = 150 / maxMag;
    let x = 96;
    let y = 214;
    const legs = vectors.map((v, i) => {
      const { dx, dy } = dir(v.angle);
      const len = (v.magnitude ?? 1) * scale;
      const seg = { x1: x, y1: y, x2: x + dx * len, y2: y + dy * len, color: COLORS[i % COLORS.length], v };
      x = seg.x2;
      y = seg.y2;
      return seg;
    });
    return (
      <div className="guide-forces">
        {title && <div className="guide-chart-title">{title}</div>}
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" className="guide-chart-svg" role="img">
          {defs}
          {legs.map((s, i) => (
            <g key={i}>
              <Arrow {...s} />
              <text x={(s.x1 + s.x2) / 2 + 8} y={(s.y1 + s.y2) / 2 - 8} className="guide-chart-label" style={{ fill: s.color }}>
                {label(s.v)}
              </text>
            </g>
          ))}
          {resultant && (
            <>
              <Arrow x1={96} y1={214} x2={x} y2={y} color="#64748b" dashed />
              <text x={(96 + x) / 2 - 6} y={(214 + y) / 2 + 22} className="guide-chart-value" textAnchor="middle" style={{ fill: "#64748b" }}>
                {`resultant ${resultant.magnitude}${unit ? " " + unit : ""} at ${resultant.angle}°`}
              </text>
            </>
          )}
        </svg>
      </div>
    );
  }

  // free body: arrows leaving a block at the centre
  const cx = W / 2;
  const cy = H / 2 - 6;
  const box = 56;
  const scale = 104 / maxMag;
  return (
    <div className="guide-forces">
      {title && <div className="guide-chart-title">{title}</div>}
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" className="guide-chart-svg" role="img">
        {defs}
        <rect x={cx - box / 2} y={cy - box / 2} width={box} height={box} rx={8} className="guide-forces-body" />
        {body && (
          <text x={cx} y={cy + 4} className="guide-chart-label" textAnchor="middle">
            {body.length > 9 ? body.slice(0, 8) + "…" : body}
          </text>
        )}
        {vectors.map((v, i) => {
          const { dx, dy } = dir(v.angle);
          const len = Math.max(44, (v.magnitude ?? 1) * scale);
          const start = box / 2 + 4;
          const x1 = cx + dx * start;
          const y1 = cy + dy * start;
          const x2 = cx + dx * (start + len);
          const y2 = cy + dy * (start + len);
          const color = COLORS[i % COLORS.length];
          // an up or down arrow gets its label beside the head, not above or below it:
          // centred there it would collide with the title or the body's own label
          const upright = Math.abs(dx) < 0.3;
          return (
            <g key={i}>
              <Arrow x1={x1} y1={y1} x2={x2} y2={y2} color={color} />
              <text
                x={upright ? x2 + 10 : x2 + dx * 8}
                y={upright ? y2 + dy * 6 + 4 : y2 + 4}
                className="guide-chart-label"
                textAnchor={upright || dx > 0 ? "start" : "end"}
                style={{ fill: color }}
              >
                {label(v)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
