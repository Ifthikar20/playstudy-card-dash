import type { GuideCircuit as GuideCircuitData, GuideCircuitPart } from "@/services/guide";

/*
  A circuit diagram for the Teach mode whiteboard.

  Physics students draw these constantly, and a spoken "a battery, a resistor and
  a bulb in series" is exactly the sentence that needs a picture. The symbols are
  the standard ones and the wiring is laid out by us from the component list, so
  only the parts themselves come from the model.
*/

const W = 480;
const H = 232;
const STROKE = "#ec4899";

/** One component symbol, drawn horizontally in a 44px gap in the wire. */
function Symbol({ part }: { part: GuideCircuitPart }) {
  const s = { stroke: STROKE, strokeWidth: 2.4, fill: "none", strokeLinecap: "round" as const };
  switch (part.type) {
    case "battery":
      return (
        <g {...s}>
          <line x1={-22} y1={0} x2={-10} y2={0} />
          <line x1={-10} y1={-13} x2={-10} y2={13} />
          <line x1={-4} y1={-7} x2={-4} y2={7} />
          <line x1={2} y1={-13} x2={2} y2={13} />
          <line x1={8} y1={-7} x2={8} y2={7} />
          <line x1={8} y1={0} x2={22} y2={0} />
        </g>
      );
    case "resistor":
      return (
        <g {...s}>
          <line x1={-22} y1={0} x2={-15} y2={0} />
          <rect x={-15} y={-9} width={30} height={18} rx={2} />
          <line x1={15} y1={0} x2={22} y2={0} />
        </g>
      );
    case "bulb":
      return (
        <g {...s}>
          <line x1={-22} y1={0} x2={-13} y2={0} />
          <circle cx={0} cy={0} r={13} />
          <line x1={-9} y1={-9} x2={9} y2={9} />
          <line x1={-9} y1={9} x2={9} y2={-9} />
          <line x1={13} y1={0} x2={22} y2={0} />
        </g>
      );
    case "switch":
      return (
        <g {...s}>
          <line x1={-22} y1={0} x2={-12} y2={0} />
          <line x1={-12} y1={0} x2={9} y2={-13} />
          <circle cx={-12} cy={0} r={2.6} fill={STROKE} />
          <circle cx={12} cy={0} r={2.6} fill={STROKE} />
          <line x1={12} y1={0} x2={22} y2={0} />
        </g>
      );
    case "capacitor":
      return (
        <g {...s}>
          <line x1={-22} y1={0} x2={-4} y2={0} />
          <line x1={-4} y1={-12} x2={-4} y2={12} />
          <line x1={4} y1={-12} x2={4} y2={12} />
          <line x1={4} y1={0} x2={22} y2={0} />
        </g>
      );
    case "fuse":
      return (
        <g {...s}>
          <line x1={-22} y1={0} x2={-15} y2={0} />
          <rect x={-15} y={-8} width={30} height={16} rx={2} />
          <line x1={-15} y1={0} x2={15} y2={0} />
          <line x1={15} y1={0} x2={22} y2={0} />
        </g>
      );
    case "led":
      return (
        <g {...s}>
          <line x1={-22} y1={0} x2={-10} y2={0} />
          <path d="M-10 -11 L10 0 L-10 11 Z" />
          <line x1={10} y1={-11} x2={10} y2={11} />
          <line x1={-2} y1={-14} x2={6} y2={-20} />
          <line x1={4} y1={-11} x2={12} y2={-17} />
          <line x1={10} y1={0} x2={22} y2={0} />
        </g>
      );
    default: {
      // meters and the motor: a circle with its letter
      const letter = part.type === "ammeter" ? "A" : part.type === "voltmeter" ? "V" : "M";
      return (
        <g {...s}>
          <line x1={-22} y1={0} x2={-13} y2={0} />
          <circle cx={0} cy={0} r={13} />
          <text x={0} y={1} className="guide-circuit-letter" textAnchor="middle" dominantBaseline="middle" style={{ stroke: "none" }}>
            {letter}
          </text>
          <line x1={13} y1={0} x2={22} y2={0} />
        </g>
      );
    }
  }
}

/** How the tutor's pointer names a part: its label with what it is ("10 ohm resistor"). */
const partName = (p: GuideCircuitPart) => (!p.label ? p.type : p.label.toLowerCase().includes(p.type) ? p.label : `${p.label} ${p.type}`);

/**
 * A symbol placed on the loop, with its label outside the wire.
 *
 * `anchor` is the part id the tutor's pointer aims at. It sits on the translated group
 * so the outline hugs the symbol, not its label, and the tip lands on the symbol's
 * centre, which is 0 0 in that group's own units. `alias` is a second id for the same
 * symbol: the battery is "battery" and also its place in the component list. The alias
 * carries no label of its own: two anchors with the same words tie when the pointer
 * matches a spoken name ("the battery"), and a tie points at nothing.
 */
function Placed({
  part,
  anchor,
  alias,
  cx,
  cy,
  vertical,
  labelBelow = true,
}: {
  part: GuideCircuitPart;
  anchor: string;
  alias?: string;
  cx: number;
  cy: number;
  vertical?: boolean;
  labelBelow?: boolean;
}) {
  const name = partName(part);
  const symbol = (
    <g transform={`translate(${cx} ${cy})${vertical ? " rotate(-90)" : ""}`} data-board-part={anchor} data-board-label={name} data-part-at="0 0">
      <Symbol part={part} />
    </g>
  );
  return (
    <g>
      {alias ? (
        <g data-board-part={alias} data-board-label="" data-part-at={`${cx} ${cy}`}>
          {symbol}
        </g>
      ) : (
        symbol
      )}
      {part.label && (
        <text x={vertical ? cx - 30 : cx} y={vertical ? cy + 4 : labelBelow ? cy + 30 : cy - 22} className="guide-chart-label" textAnchor={vertical ? "end" : "middle"}>
          {part.label}
        </text>
      )}
    </g>
  );
}

export function GuideCircuit({ circuit }: { circuit: GuideCircuitData }) {
  const { title, layout, components, branches } = circuit;
  const wire = { stroke: STROKE, strokeWidth: 2.4, fill: "none" };
  const battery = components.find((c) => c.type === "battery") || { type: "battery" };
  const rest = components.filter((c) => c !== battery);
  // Pointer ids use a part's place in the ORIGINAL list (what the lesson step and the
  // server see), not its place on the drawing, which pulls the battery out first.
  const cid = (p: GuideCircuitPart) => `components.${components.indexOf(p)}`;
  const batteryAlias = components.includes(battery) ? cid(battery) : undefined;

  if (layout === "parallel" && branches && branches.length >= 2) {
    const left = 56;
    const railA = 190;
    const railB = 400;
    const rows = branches.map((_, i) => 74 + i * 56);
    const top = rows[0];
    const bottom = rows[rows.length - 1];
    return (
      <div className="guide-circuit">
        {title && <div className="guide-chart-title">{title}</div>}
        <svg viewBox={`0 0 ${W} ${Math.max(H, bottom + 60)}`} width="100%" className="guide-chart-svg" role="img">
          <path d={`M${left} ${top} L${left} ${bottom}`} {...wire} />
          <path d={`M${left} ${top} L${railA} ${top}`} {...wire} />
          <path d={`M${left} ${bottom} L${railA} ${bottom}`} {...wire} />
          <path d={`M${railA} ${top} L${railA} ${bottom}`} {...wire} />
          <path d={`M${railB} ${top} L${railB} ${bottom}`} {...wire} />
          {rows.map((y, i) => (
            <g key={i}>
              <path d={`M${railA} ${y} L${railB} ${y}`} {...wire} />
              {branches[i].map((p, j) => (
                <Placed
                  key={j}
                  part={p}
                  anchor={`branches.${i}.${j}`}
                  cx={railA + ((j + 1) * (railB - railA)) / (branches[i].length + 1)}
                  cy={y}
                  labelBelow={false}
                />
              ))}
            </g>
          ))}
          <Placed part={battery} anchor="battery" alias={batteryAlias} cx={left} cy={(top + bottom) / 2} vertical />
        </svg>
      </div>
    );
  }

  // series: the battery on the left rail, everything else spread along the top
  const left = 66;
  const right = W - 46;
  const top = 62;
  const bottom = 176;
  const mid = (top + bottom) / 2;
  const onTop = rest.slice(0, 3);
  const onBottom = rest.slice(3);
  const spread = (items: GuideCircuitPart[], i: number) => left + ((i + 1) * (right - left)) / (items.length + 1);

  return (
    <div className="guide-circuit">
      {title && <div className="guide-chart-title">{title}</div>}
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" className="guide-chart-svg" role="img">
        <path d={`M${left} ${top} L${right} ${top} L${right} ${bottom} L${left} ${bottom} L${left} ${top}`} {...wire} />
        <Placed part={battery} anchor="battery" alias={batteryAlias} cx={left} cy={mid} vertical />
        {onTop.map((p, i) => (
          <Placed key={"t" + i} part={p} anchor={cid(p)} cx={spread(onTop, i)} cy={top} labelBelow={false} />
        ))}
        {onBottom.map((p, i) => (
          <Placed key={"b" + i} part={p} anchor={cid(p)} cx={spread(onBottom, i)} cy={bottom} />
        ))}
      </svg>
    </div>
  );
}
