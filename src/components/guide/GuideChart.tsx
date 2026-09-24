import type { GuideChart as GuideChartData } from "@/services/guide";

/*
  A small chart for the Teach mode whiteboard.

  When a walkthrough step carries numbers worth seeing — a ratio, a set of
  percentages, a comparison, or figures over time — it draws them here as a bar,
  pie or line chart, in the board's marker colours and handwriting labels, instead
  of (or as well as) saying the numbers out loud.
*/

const COLORS = ["#ec4899", "#3b82f6", "#14b8a6", "#f59e0b", "#8b5cf6", "#84cc16", "#ef4444"];
const W = 480;

/** Where the tutor's pointer touches a part (data-part-at), in this SVG's own units. */
const partAt = (x: number, y: number) => `${x.toFixed(1)} ${y.toFixed(1)}`;

function fmt(v: number, unit?: string): string {
  const abs = Math.abs(v);
  let n: string;
  if (Number.isInteger(v)) n = String(v);
  else if (abs < 1) n = v.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
  else if (abs < 10) n = v.toFixed(1);
  else n = v.toFixed(0);
  return unit ? `${n}${unit === "%" ? "%" : " " + unit}` : n;
}

function Bars({ data, unit }: { data: GuideChartData["data"]; unit?: string }) {
  const rowH = 34;
  const top = 6;
  const labelW = 132;
  const barX = labelW + 8;
  const valueW = 52;
  const barMax = W - barX - valueW;
  const max = Math.max(...data.map((d) => Math.abs(d.value)), 0) || 1;
  const h = top + data.length * rowH + 6;
  return (
    <svg viewBox={`0 0 ${W} ${h}`} width="100%" className="guide-chart-svg" role="img">
      {data.map((d, i) => {
        const y = top + i * rowH + rowH / 2;
        const bw = Math.max(2, (Math.abs(d.value) / max) * barMax);
        // the pointer touches the end of the bar, just inside it, where its value is read
        return (
          <g key={i} data-board-part={`data.${i}`} data-board-label={d.label} data-part-at={partAt(barX + bw - Math.min(4, bw / 2), y)}>
            <text x={labelW} y={y} className="guide-chart-label" textAnchor="end" dominantBaseline="middle">
              {d.label}
            </text>
            <rect x={barX} y={y - 10} width={barMax} height={20} rx={6} className="guide-chart-track" />
            <rect x={barX} y={y - 10} width={bw} height={20} rx={6} fill={COLORS[i % COLORS.length]} className="guide-chart-bar" style={{ transformOrigin: `${barX}px ${y}px` }} />
            <text x={barX + bw + 6} y={y} className="guide-chart-value" dominantBaseline="middle">
              {fmt(d.value, unit)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function Pie({ data, unit }: { data: GuideChartData["data"]; unit?: string }) {
  const total = data.reduce((s, d) => s + Math.max(0, d.value), 0) || 1;
  const cx = 108;
  const cy = 108;
  const r = 92;
  const inner = 46;
  let a0 = -Math.PI / 2;
  const arc = (a1: number, a2: number, rr: number) => {
    const x1 = cx + rr * Math.cos(a1);
    const y1 = cy + rr * Math.sin(a1);
    const x2 = cx + rr * Math.cos(a2);
    const y2 = cy + rr * Math.sin(a2);
    return { x1, y1, x2, y2, large: a2 - a1 > Math.PI ? 1 : 0 };
  };
  const h = 216;
  return (
    <svg viewBox={`0 0 ${W} ${h}`} width="100%" className="guide-chart-svg" role="img">
      {data.map((d, i) => {
        const frac = Math.max(0, d.value) / total;
        const a1 = a0;
        const a2 = a0 + frac * Math.PI * 2;
        a0 = a2;
        const o = arc(a1, a2, r);
        const inn = arc(a1, a2, inner);
        const path = `M ${o.x1} ${o.y1} A ${r} ${r} 0 ${o.large} 1 ${o.x2} ${o.y2} L ${inn.x2} ${inn.y2} A ${inner} ${inner} 0 ${o.large} 0 ${inn.x1} ${inn.y1} Z`;
        // halfway round the slice and inside the ring, so the tip is on this slice's colour
        const mid = (a1 + a2) / 2;
        return (
          <path
            key={i}
            d={path}
            fill={COLORS[i % COLORS.length]}
            className="guide-chart-slice"
            data-board-part={`data.${i}`}
            data-board-label={d.label}
            data-part-at={partAt(cx + 0.6 * r * Math.cos(mid), cy + 0.6 * r * Math.sin(mid))}
          />
        );
      })}
      {data.map((d, i) => {
        const y = 24 + i * 30;
        const pct = Math.round((Math.max(0, d.value) / total) * 100);
        return (
          <g key={"l" + i}>
            <rect x={244} y={y - 11} width={16} height={16} rx={4} fill={COLORS[i % COLORS.length]} />
            <text x={268} y={y} className="guide-chart-label" dominantBaseline="middle">
              {d.label}
            </text>
            <text x={W - 6} y={y} className="guide-chart-value" textAnchor="end" dominantBaseline="middle">
              {unit === "%" ? `${fmt(d.value, "%")}` : `${fmt(d.value, unit)} · ${pct}%`}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function Line({ data, unit }: { data: GuideChartData["data"]; unit?: string }) {
  const left = 20;
  const right = 14;
  const top = 16;
  const bottom = 34;
  const h = 210;
  const plotW = W - left - right;
  const plotH = h - top - bottom;
  const vals = data.map((d) => d.value);
  const max = Math.max(...vals);
  const min = Math.min(...vals, 0);
  const span = max - min || 1;
  const x = (i: number) => left + (data.length === 1 ? plotW / 2 : (i / (data.length - 1)) * plotW);
  const y = (v: number) => top + plotH - ((v - min) / span) * plotH;
  const pts = data.map((d, i) => `${x(i)},${y(d.value)}`).join(" ");
  const gridVals = [max, min + span / 2, min];
  return (
    <svg viewBox={`0 0 ${W} ${h}`} width="100%" className="guide-chart-svg" role="img">
      {gridVals.map((gv, i) => (
        <g key={"g" + i}>
          <line x1={left} y1={y(gv)} x2={W - right} y2={y(gv)} className="guide-chart-grid" />
          <text x={left - 4} y={y(gv)} className="guide-chart-tick" textAnchor="end" dominantBaseline="middle">
            {fmt(gv, unit)}
          </text>
        </g>
      ))}
      <polyline points={pts} className="guide-chart-line" fill="none" stroke={COLORS[0]} />
      {data.map((d, i) => (
        <g key={"p" + i}>
          {/* the dot is the part: its label sits down at the axis, too far away to outline with it */}
          <circle
            cx={x(i)}
            cy={y(d.value)}
            r={4.5}
            fill={COLORS[0]}
            className="guide-chart-dot"
            data-board-part={`data.${i}`}
            data-board-label={d.label}
            data-part-at={partAt(x(i), y(d.value))}
          />
          <text x={x(i)} y={h - 12} className="guide-chart-label" textAnchor="middle">
            {d.label}
          </text>
        </g>
      ))}
    </svg>
  );
}

export function GuideChart({ chart }: { chart: GuideChartData }) {
  const { type, title, unit, data } = chart;
  return (
    <div className="guide-chart">
      {title && <div className="guide-chart-title">{title}</div>}
      {type === "pie" ? <Pie data={data} unit={unit} /> : type === "line" ? <Line data={data} unit={unit} /> : <Bars data={data} unit={unit} />}
    </div>
  );
}
