import type { GuideVenn as GuideVennData } from "@/services/guide";

/*
  A 2- or 3-set Venn diagram for the Teach mode whiteboard: the other half of
  compare-and-contrast (what's shared, what isn't), and the standard picture for
  sets and probability. The circles are ours; the items in each region are the
  model's, at the same trust level as a chart.
*/

const W = 480;
const COLORS = ["#ec4899", "#3b82f6", "#14b8a6"];
const FILLS = ["rgba(236,72,153,0.16)", "rgba(59,130,246,0.16)", "rgba(20,184,166,0.16)"];

/** Where each region's items are written, per set count. */
const SPOTS2: Record<string, [number, number]> = { a: [138, 132], b: [342, 132], ab: [240, 132] };
const SPOTS3: Record<string, [number, number]> = {
  a: [158, 92], b: [322, 92], c: [240, 232], ab: [240, 88], ac: [176, 176], bc: [304, 176], abc: [240, 146],
};

function Region({ items, at }: { items: string[]; at: [number, number] }) {
  const [x, y] = at;
  const top = y - ((items.length - 1) * 15) / 2;
  return (
    <>
      {items.map((it, i) => (
        <text key={i} x={x} y={top + i * 15} className="guide-venn-item" textAnchor="middle" dominantBaseline="middle">
          {it.length > 18 ? it.slice(0, 17) + "…" : it}
        </text>
      ))}
    </>
  );
}

export function GuideVenn({ venn }: { venn: GuideVennData }) {
  const { title, sets, regions } = venn;
  const three = sets.length >= 3;
  const spots = three ? SPOTS3 : SPOTS2;
  const circles: { cx: number; cy: number; r: number }[] = three
    ? [
        { cx: 190, cy: 128, r: 92 },
        { cx: 290, cy: 128, r: 92 },
        { cx: 240, cy: 200, r: 92 },
      ]
    : [
        { cx: 178, cy: 132, r: 104 },
        { cx: 302, cy: 132, r: 104 },
      ];
  const height = three ? 316 : 268;

  return (
    <div className="guide-venn">
      {title && <div className="guide-chart-title">{title}</div>}
      <svg viewBox={`0 0 ${W} ${height}`} width="100%" className="guide-chart-svg" role="img">
        {circles.map((c, i) => (
          <circle key={i} cx={c.cx} cy={c.cy} r={c.r} fill={FILLS[i]} stroke={COLORS[i]} strokeWidth={2} />
        ))}
        {sets.slice(0, 3).map((label, i) => {
          const c = circles[i];
          const y = i === 2 ? c.cy + c.r + 20 : c.cy - c.r - 10;
          const x = i === 0 ? c.cx - 26 : i === 1 ? c.cx + 26 : c.cx;
          return (
            <text key={"s" + i} x={x} y={y} className="guide-venn-set" textAnchor="middle" style={{ fill: COLORS[i] }}>
              {label}
            </text>
          );
        })}
        {Object.entries(regions).map(([key, items]) =>
          spots[key] && items.length ? <Region key={key} items={items} at={spots[key]} /> : null,
        )}
      </svg>
    </div>
  );
}
