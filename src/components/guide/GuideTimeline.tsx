import type { GuideTimeline as GuideTimelineData } from "@/services/guide";

/*
  A dated timeline for the Teach mode whiteboard.

  A flow diagram spaces events evenly and throws away the thing that actually
  teaches: the gaps. Here every event sits at its real year, so 1914→1918 is tight
  and 1918→1939 is a long walk. Positions are computed, so the spacing is exact.
*/

const W = 480;
const PAD = 40;
const AXIS_Y = 132;
const COLORS = ["#ec4899", "#3b82f6", "#14b8a6", "#f59e0b", "#8b5cf6", "#84cc16"];

/** Where the tutor's pointer touches a part (data-part-at), in this SVG's own units. */
const partAt = (x: number, y: number) => `${x.toFixed(1)} ${y.toFixed(1)}`;

/** 1914 → "1914", -3000 → "3000 BC". Fractional years (a month) lose the fraction. */
function yearLabel(y: number): string {
  const whole = Math.trunc(y);
  return whole < 0 ? `${Math.abs(whole)} BC` : String(whole);
}

/** Break a label into at most two lines of roughly `max` characters. */
function wrap(text: string, max = 18): string[] {
  if (text.length <= max) return [text];
  const words = text.split(" ");
  const lines: string[] = [""];
  for (const w of words) {
    const line = lines[lines.length - 1];
    if (!line) lines[lines.length - 1] = w;
    else if ((line + " " + w).length <= max) lines[lines.length - 1] = line + " " + w;
    else if (lines.length < 2) lines.push(w);
    else break;
  }
  return lines;
}

export function GuideTimeline({ timeline }: { timeline: GuideTimelineData }) {
  const { title, events } = timeline;
  const lo = events[0].year;
  const hi = events[events.length - 1].year;
  const span = hi - lo || 1;
  const x = (year: number) => PAD + ((year - lo) / span) * (W - PAD * 2);

  // Labels alternate above and below the line; within each side, nudge any that
  // would collide so two close dates stay readable (the dots never move).
  const placed = events.map((e, i) => ({ ...e, i, above: i % 2 === 0, dotX: x(e.year), labelX: x(e.year) }));
  for (const side of [true, false]) {
    const row = placed.filter((p) => p.above === side);
    for (let i = 1; i < row.length; i++) {
      const gap = row[i].labelX - row[i - 1].labelX;
      if (gap < 96) row[i].labelX = row[i - 1].labelX + 96;
    }
    const overflow = row.length ? row[row.length - 1].labelX - (W - 8) : 0;
    if (overflow > 0) for (const p of row) p.labelX -= overflow;
  }

  return (
    <div className="guide-timeline">
      {title && <div className="guide-chart-title">{title}</div>}
      <svg viewBox={`0 0 ${W} 232`} width="100%" className="guide-chart-svg" role="img">
        <line x1={PAD - 22} y1={AXIS_Y} x2={W - PAD + 22} y2={AXIS_Y} className="guide-timeline-axis" />
        {[lo, hi].map((v, i) => (
          <text key={"end" + i} x={i === 0 ? PAD - 26 : W - PAD + 26} y={AXIS_Y + 4} className="guide-chart-tick" textAnchor={i === 0 ? "end" : "start"}>
            {yearLabel(v)}
          </text>
        ))}
        {placed.map((e) => {
          const color = COLORS[e.i % COLORS.length];
          const dir = e.above ? -1 : 1;
          const labelY = AXIS_Y + dir * 52;
          const lines = wrap(e.label);
          // events.i counts the events as they arrive (the server sorts them by year);
          // the pointer touches the event's dot on the line, which never moves
          return (
            <g
              key={e.i}
              data-board-part={`events.${e.i}`}
              data-board-label={`${e.date || yearLabel(e.year)} ${e.label}`}
              data-part-at={partAt(e.dotX, AXIS_Y)}
            >
              <path
                d={`M${e.dotX} ${AXIS_Y + dir * 6} L${e.dotX} ${AXIS_Y + dir * 26} L${e.labelX} ${AXIS_Y + dir * 38}`}
                className="guide-timeline-leader"
                fill="none"
              />
              <circle cx={e.dotX} cy={AXIS_Y} r={5.5} fill={color} className="guide-timeline-dot" />
              <text x={e.labelX} y={labelY} className="guide-timeline-year" textAnchor="middle" style={{ fill: color }}>
                {e.date || yearLabel(e.year)}
              </text>
              {lines.map((ln, k) => (
                <text key={k} x={e.labelX} y={labelY + 17 + k * 15} className="guide-chart-label" textAnchor="middle">
                  {ln}
                </text>
              ))}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
