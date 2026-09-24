import type { GuideScale as GuideScaleData } from "@/services/guide";

/*
  A number line / scale strip for the Teach mode whiteboard.

  One component for two jobs that look the same once drawn: a maths number line
  (an inequality, an interval) and a "where does this sit" scale (pH, the
  spectrum, a magnitude, orders of magnitude). Everything is placed by arithmetic
  on the numbers given, so the position is exact.
*/

const W = 480;
const PAD = 46;
const BAR_Y = 118;
const COLORS = ["#ec4899", "#3b82f6", "#14b8a6", "#f59e0b"];
const BAND = ["rgba(236,72,153,0.16)", "rgba(59,130,246,0.16)", "rgba(20,184,166,0.16)", "rgba(245,158,11,0.16)"];

const fmt = (v: number, unit?: string) => {
  const n = Number.isInteger(v) ? String(v) : Math.abs(v) < 1 ? String(Number(v.toFixed(3))) : String(Number(v.toFixed(1)));
  return unit ? `${n}${unit === "%" ? "%" : " " + unit}` : n;
};

/** Where the tutor's pointer touches a part (data-part-at), in this SVG's own units. */
const partAt = (x: number, y: number) => `${x.toFixed(1)} ${y.toFixed(1)}`;

export function GuideScale({ scale }: { scale: GuideScaleData }) {
  const { title, unit, min, max, log, marks, ranges } = scale;
  // a log scale (pH-like, or orders of magnitude) positions by the exponent
  const usable = log && min > 0 && max > 0;
  const t = (v: number) => {
    const f = usable ? (Math.log10(Math.max(v, Number.MIN_VALUE)) - Math.log10(min)) / (Math.log10(max) - Math.log10(min)) : (v - min) / (max - min);
    return PAD + Math.max(0, Math.min(1, f)) * (W - PAD * 2);
  };
  const ticks = usable ? [min, Math.sqrt(min * max), max] : [min, (min + max) / 2, max];

  // marks alternate above and below so two close values don't collide
  const placed = marks.map((m, i) => ({ ...m, i, x: t(m.at), above: i % 2 === 0 }));

  return (
    <div className="guide-scale">
      {title && <div className="guide-chart-title">{title}</div>}
      <svg viewBox={`0 0 ${W} 196`} width="100%" className="guide-chart-svg" role="img">
        {/* a range is pointed at in its middle, on the bar itself; a mark at its pin's base */}
        {ranges.map((r, i) => (
          <g
            key={"r" + i}
            data-board-part={`ranges.${i}`}
            data-board-label={r.label || undefined}
            data-part-at={partAt((t(r.from) + t(r.to)) / 2, BAR_Y)}
          >
            <rect x={t(r.from)} y={BAR_Y - 13} width={Math.max(2, t(r.to) - t(r.from))} height={26} rx={7} fill={BAND[i % BAND.length]} />
            <text x={(t(r.from) + t(r.to)) / 2} y={BAR_Y + 34} className="guide-chart-label" textAnchor="middle" style={{ fill: COLORS[i % COLORS.length] }}>
              {r.label}
            </text>
          </g>
        ))}
        <line x1={PAD} y1={BAR_Y} x2={W - PAD} y2={BAR_Y} className="guide-scale-bar" />
        {[PAD, W - PAD].map((x, i) => (
          <line key={"cap" + i} x1={x} y1={BAR_Y - 9} x2={x} y2={BAR_Y + 9} className="guide-scale-bar" />
        ))}
        {ticks.map((v, i) => (
          <text key={"t" + i} x={t(v)} y={BAR_Y + 58} className="guide-chart-tick" textAnchor="middle">
            {fmt(v, unit)}
          </text>
        ))}
        {ranges
          .filter((r) => r.open)
          .map((r, i) => (
            <circle key={"o" + i} cx={t(r.from)} cy={BAR_Y} r={5} className="guide-scale-open" />
          ))}
        {placed.map((m) => {
          const color = COLORS[m.i % COLORS.length];
          const dir = m.above ? -1 : 1;
          return (
            <g
              key={"m" + m.i}
              data-board-part={`marks.${m.i}`}
              data-board-label={m.label ? `${m.label} ${fmt(m.at, unit)}` : fmt(m.at, unit)}
              data-part-at={partAt(m.x, BAR_Y)}
            >
              <line x1={m.x} y1={BAR_Y} x2={m.x} y2={BAR_Y + dir * 30} className="guide-scale-pin" style={{ stroke: color }} />
              <circle cx={m.x} cy={BAR_Y} r={6} fill={color} />
              <text
                x={Math.max(30, Math.min(W - 30, m.x))}
                y={BAR_Y + dir * 40 + (m.above ? 0 : 10)}
                className="guide-chart-value"
                textAnchor="middle"
                style={{ fill: color }}
              >
                {m.label || fmt(m.at, unit)}
              </text>
              {m.label && (
                <text x={Math.max(30, Math.min(W - 30, m.x))} y={BAR_Y + dir * 40 + (m.above ? -16 : 26)} className="guide-chart-tick" textAnchor="middle">
                  {fmt(m.at, unit)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
