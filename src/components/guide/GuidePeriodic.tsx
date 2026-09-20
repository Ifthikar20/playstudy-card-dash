import type { GuidePeriodic as GuidePeriodicData } from "@/services/guide";

/*
  A mini periodic table with one element lit up, for the Teach mode whiteboard.

  The natural partner to the atom the board already draws: the atom says what the
  element IS, this says where it LIVES — which group, which period, which family.
  The element's group, period, category and mass all come from the backend's real
  periodic table, and the empty grid below is the table's true shape, so the cell
  that lights up is always the right one.
*/

const CELL = 24;
const GAP = 2;
const LEFT = 6;
const TOP = 22;
const FROW_GAP = 12; // breathing room above the lanthanide / actinide rows

const CATEGORY_COLOR: Record<string, string> = {
  "alkali metal": "#ef4444",
  "alkaline earth metal": "#f59e0b",
  "transition metal": "#3b82f6",
  "post-transition metal": "#14b8a6",
  metalloid: "#84cc16",
  nonmetal: "#22c55e",
  halogen: "#8b5cf6",
  "noble gas": "#ec4899",
  lanthanide: "#0ea5e9",
  actinide: "#f97316",
};

/** Which (group, period) cells the real table actually has. */
function mainCells(): { group: number; period: number }[] {
  const out: { group: number; period: number }[] = [];
  for (let period = 1; period <= 7; period++) {
    for (let group = 1; group <= 18; group++) {
      if (period === 1 && group !== 1 && group !== 18) continue;
      if ((period === 2 || period === 3) && group > 2 && group < 13) continue;
      if ((period === 6 || period === 7) && group === 3) continue; // the f-block sits below
      out.push({ group, period });
    }
  }
  return out;
}

const x = (group: number) => LEFT + (group - 1) * (CELL + GAP);
const y = (period: number) => TOP + (period - 1) * (CELL + GAP);
const fRowY = (row: 0 | 1) => TOP + 7 * (CELL + GAP) + FROW_GAP + row * (CELL + GAP);

export function GuidePeriodic({ periodic }: { periodic: GuidePeriodicData }) {
  const { z, symbol, name, mass, group, period, category } = periodic;
  const color = CATEGORY_COLOR[category] || "#ec4899";
  const fBlock = group === 0;
  const fRow: 0 | 1 = period === 6 ? 0 : 1;
  const fCol = period === 6 ? z - 57 : z - 89; // 0-14 along the row
  const cellX = fBlock ? LEFT + (2 + fCol) * (CELL + GAP) : x(group);
  const cellY = fBlock ? fRowY(fRow) : y(period);
  const W = LEFT * 2 + 18 * (CELL + GAP);
  const H = fRowY(1) + CELL + 46;

  return (
    <div className="guide-periodic">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" className="guide-chart-svg" role="img">
        {/* the element's group and period, tinted so "where it sits" is the picture */}
        {!fBlock && (
          <>
            <rect x={x(group) - 1} y={TOP - 1} width={CELL + 2} height={7 * (CELL + GAP)} rx={4} fill={color} opacity={0.12} />
            <rect x={LEFT - 1} y={y(period) - 1} width={18 * (CELL + GAP)} height={CELL + 2} rx={4} fill={color} opacity={0.12} />
          </>
        )}
        {mainCells().map((c) => (
          <rect key={`${c.group}-${c.period}`} x={x(c.group)} y={y(c.period)} width={CELL} height={CELL} rx={3} className="guide-periodic-cell" />
        ))}
        {[0, 1].map((row) =>
          Array.from({ length: 15 }, (_, i) => (
            <rect
              key={`f${row}-${i}`}
              x={LEFT + (2 + i) * (CELL + GAP)}
              y={fRowY(row as 0 | 1)}
              width={CELL}
              height={CELL}
              rx={3}
              className="guide-periodic-cell guide-periodic-fcell"
            />
          )),
        )}
        <rect x={cellX - 2} y={cellY - 2} width={CELL + 4} height={CELL + 4} rx={4} fill={color} className="guide-periodic-live" />
        <text x={cellX + CELL / 2} y={cellY + CELL / 2 + 1} className="guide-periodic-symbol" textAnchor="middle" dominantBaseline="middle">
          {symbol}
        </text>
        <text x={LEFT} y={14} className="guide-chart-tick">
          {fBlock ? `${category}` : `group ${group} · period ${period}`}
        </text>
        <text x={W / 2} y={H - 16} className="guide-periodic-caption" textAnchor="middle">
          {`${symbol} — ${name} · ${z} protons · mass ${mass} · ${category}`}
        </text>
      </svg>
    </div>
  );
}
