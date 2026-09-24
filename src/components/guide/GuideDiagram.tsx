import type { GuideDiagram as GuideDiagramData } from "@/services/guide";

/*
  A process / cycle / hierarchy diagram for the Teach mode whiteboard.
  - "flow" with no edges → a vertical sequence of boxes with arrows between them.
  - "cycle", or any diagram with explicit edges (e.g. a food web) → nodes placed on a
    ring with arrows drawn between them.
  - "tree" → levelled boxes with elbow connectors: a taxonomy, a classification, a
    family tree, a decision tree, the parts of a whole.
*/

const NODE_COLORS = ["#ec4899", "#3b82f6", "#14b8a6", "#f59e0b", "#8b5cf6", "#84cc16", "#ef4444"];
const W = 480;

/*
  Part anchors for the tutor's pointer: nodes.i is the node's box (the pointer touches
  its centre) and edges.i is the i-th of the edges the diagram was given. Arrows we add
  ourselves (a flow's chain, a cycle with no edges) aren't in the data, so they carry
  no anchor, and an edge is only named by the label written on it.
*/
const partAt = (x: number, y: number) => `${x.toFixed(1)} ${y.toFixed(1)}`;

function Flow({ nodes }: { nodes: string[] }) {
  return (
    <div className="guide-flow">
      {nodes.map((n, i) => (
        <div key={i} className="guide-flow-item">
          <div
            className="guide-flow-node"
            style={{ borderColor: NODE_COLORS[i % NODE_COLORS.length] }}
            data-board-part={`nodes.${i}`}
            data-board-label={n}
          >
            {n}
          </div>
          {i < nodes.length - 1 && (
            <svg className="guide-flow-arrow" viewBox="0 0 24 24" width="22" height="22" aria-hidden>
              <path d="M12 3 v14 M6 13 l6 6 l6 -6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </div>
      ))}
    </div>
  );
}

function Ring({ nodes, edges, cycle }: { nodes: string[]; edges?: GuideDiagramData["edges"]; cycle: boolean }) {
  const n = nodes.length;
  const cx = W / 2;
  const cy = 172;
  const R = 118;
  const chipW = 108;
  const chipH = 40;
  const pos = nodes.map((_, i) => {
    const a = -Math.PI / 2 + (i / n) * Math.PI * 2;
    return { x: cx + R * Math.cos(a), y: cy + R * Math.sin(a) };
  });
  const given = !!(edges && edges.length);
  const links: { from: number; to: number; label?: string }[] =
    edges && edges.length ? edges : cycle ? nodes.map((_, i) => ({ from: i, to: (i + 1) % n })) : nodes.slice(1).map((_, i) => ({ from: i, to: i + 1 }));
  // shorten each arrow so it ends at the chip edge, not the centre
  const arrow = (a: { x: number; y: number }, b: { x: number; y: number }) => {
    const dx = b.x - a.x, dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len, uy = dy / len;
    return { x1: a.x + ux * 42, y1: a.y + uy * 24, x2: b.x - ux * 42, y2: b.y - uy * 24 };
  };
  return (
    <svg viewBox={`0 0 ${W} 344`} width="100%" className="guide-chart-svg" role="img">
      <defs>
        <marker id="gd-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" fill="hsl(var(--muted-foreground))" />
        </marker>
      </defs>
      {links.map((e, i) => {
        const s = arrow(pos[e.from], pos[e.to]);
        const mx = (s.x1 + s.x2) / 2, my = (s.y1 + s.y2) / 2;
        return (
          <g
            key={i}
            data-board-part={given ? `edges.${i}` : undefined}
            data-board-label={given ? e.label || undefined : undefined}
            data-part-at={given ? partAt(mx, my) : undefined}
          >
            <line x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} className="guide-diagram-edge" markerEnd="url(#gd-arrow)" />
            {e.label && (
              <text x={mx} y={my - 3} className="guide-diagram-edge-label" textAnchor="middle">
                {e.label}
              </text>
            )}
          </g>
        );
      })}
      {nodes.map((label, i) => (
        <g key={"n" + i} data-board-part={`nodes.${i}`} data-board-label={label} data-part-at={partAt(pos[i].x, pos[i].y)}>
          <rect x={pos[i].x - chipW / 2} y={pos[i].y - chipH / 2} width={chipW} height={chipH} rx={10} className="guide-diagram-chip" style={{ stroke: NODE_COLORS[i % NODE_COLORS.length] }} />
          <text x={pos[i].x} y={pos[i].y} className="guide-diagram-chip-text" textAnchor="middle" dominantBaseline="middle">
            {label.length > 16 ? label.slice(0, 15) + "…" : label}
          </text>
        </g>
      ))}
    </svg>
  );
}

/** Levelled boxes joined by elbows: the parent sits above its children. */
function Tree({ nodes, edges }: { nodes: string[]; edges?: GuideDiagramData["edges"] }) {
  const given = !!(edges && edges.length);
  const links = edges && edges.length ? edges : nodes.slice(1).map((_, i) => ({ from: 0, to: i + 1 }));
  const parentOf = new Map<number, number>();
  for (const e of links) if (!parentOf.has(e.to)) parentOf.set(e.to, e.from);

  // depth of each node, guarding against a cycle the model might have sent
  const depth = nodes.map((_, i) => {
    let d = 0;
    let cur = i;
    const seen = new Set<number>([i]);
    while (parentOf.has(cur) && d < 6) {
      cur = parentOf.get(cur)!;
      if (seen.has(cur)) break;
      seen.add(cur);
      d++;
    }
    return d;
  });
  const levels: number[][] = [];
  nodes.forEach((_, i) => (levels[depth[i]] = [...(levels[depth[i]] || []), i]));

  const rowH = 66;
  const boxH = 34;
  const height = levels.length * rowH + 16;
  const pos = nodes.map((_, i) => {
    const row = levels[depth[i]];
    const k = row.indexOf(i);
    return { x: ((k + 1) * W) / (row.length + 1), y: 26 + depth[i] * rowH };
  });
  const boxW = Math.max(62, Math.min(124, W / (Math.max(...levels.map((l) => l.length)) + 0.6)));

  return (
    <svg viewBox={`0 0 ${W} ${height}`} width="100%" className="guide-chart-svg" role="img">
      {links.map((e, i) => {
        const a = pos[e.from];
        const b = pos[e.to];
        if (!a || !b) return null;
        const midY = (a.y + boxH / 2 + (b.y - boxH / 2)) / 2;
        // Siblings share the elbow's crossbar, so the pointer touches this edge halfway
        // down its own drop into the child, the one stretch no other edge runs along.
        // A tree writes no edge labels, so its edges carry no data-board-label.
        return (
          <path
            key={i}
            d={`M${a.x} ${a.y + boxH / 2} L${a.x} ${midY} L${b.x} ${midY} L${b.x} ${b.y - boxH / 2}`}
            className="guide-diagram-edge"
            fill="none"
            data-board-part={given ? `edges.${i}` : undefined}
            data-part-at={given ? partAt(b.x, (midY + b.y - boxH / 2) / 2) : undefined}
          />
        );
      })}
      {nodes.map((label, i) => {
        const fit = Math.floor(boxW / 7.2);
        return (
          <g key={"n" + i} data-board-part={`nodes.${i}`} data-board-label={label} data-part-at={partAt(pos[i].x, pos[i].y)}>
            <rect
              x={pos[i].x - boxW / 2}
              y={pos[i].y - boxH / 2}
              width={boxW}
              height={boxH}
              rx={9}
              className="guide-diagram-chip"
              style={{ stroke: NODE_COLORS[depth[i] % NODE_COLORS.length] }}
            />
            <text x={pos[i].x} y={pos[i].y} className="guide-diagram-chip-text" textAnchor="middle" dominantBaseline="middle">
              {label.length > fit ? label.slice(0, fit - 1) + "…" : label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function GuideDiagram({ diagram }: { diagram: GuideDiagramData }) {
  const { type, title, nodes, edges } = diagram;
  const ring = type === "cycle" || (type !== "tree" && edges != null && edges.length > 0);
  return (
    <div className="guide-diagram">
      {title && <div className="guide-chart-title">{title}</div>}
      {type === "tree" ? <Tree nodes={nodes} edges={edges} /> : ring ? <Ring nodes={nodes} edges={edges} cycle={type === "cycle"} /> : <Flow nodes={nodes} />}
    </div>
  );
}
