import type { GuideAtom as GuideAtomData } from "@/services/guide";

/*
  A Bohr-model atom for the Teach mode whiteboard: a nucleus (proton/neutron count),
  concentric electron shells, and electrons as dots, filled by the simple shell rule.
*/

const SHELL_CAP = [2, 8, 8, 18, 18, 32, 32];

function shellCounts(electrons: number): number[] {
  const out: number[] = [];
  let left = electrons;
  for (const cap of SHELL_CAP) {
    if (left <= 0) break;
    out.push(Math.min(cap, left));
    left -= cap;
  }
  if (left > 0) out.push(left);
  return out;
}

export function GuideAtom({ atom }: { atom: GuideAtomData }) {
  const { protons, neutrons, electrons, symbol, name } = atom;
  const shells = shellCounts(electrons);
  const nucleusR = 26;
  const step = 26;
  const first = 48;
  const maxR = first + (shells.length - 1) * step;
  const size = (maxR + 22) * 2;
  const cx = size / 2;
  const cy = size / 2;
  // The tutor's pointer names a shell by touching its ring at -45° (upper right): the
  // shells are nested, so their outlines overlap, but that spot is on one ring only.
  const ringAt = -Math.PI / 4;
  return (
    <div className="guide-atom">
      {(name || symbol) && <div className="guide-chart-title">{name || symbol}</div>}
      <svg viewBox={`0 0 ${size} ${size}`} width="100%" style={{ maxHeight: 300 }} className="guide-chart-svg" role="img">
        {shells.map((count, i) => {
          const r = first + i * step;
          const where = shells.length > 1 && i === 0 ? " (inner)" : shells.length > 1 && i === shells.length - 1 ? " (outer)" : "";
          return (
            <g
              key={i}
              data-board-part={`shells.${i}`}
              data-board-label={`shell ${i + 1}${where}, ${count} electron${count === 1 ? "" : "s"}`}
              data-part-at={`${cx + r * Math.cos(ringAt)} ${cy + r * Math.sin(ringAt)}`}
            >
              <circle cx={cx} cy={cy} r={r} className="guide-atom-shell" />
              {Array.from({ length: count }).map((_, k) => {
                const a = -Math.PI / 2 + (k / count) * Math.PI * 2;
                return <circle key={k} cx={cx + r * Math.cos(a)} cy={cy + r * Math.sin(a)} r={5} className="guide-atom-electron" />;
              })}
            </g>
          );
        })}
        <g
          data-board-part="nucleus"
          data-board-label={`${symbol || name || ""} nucleus, ${protons} protons, ${neutrons} neutrons`.trim()}
          data-part-at={`${cx} ${cy}`}
        >
          <circle cx={cx} cy={cy} r={nucleusR} className="guide-atom-nucleus" />
          <text x={cx} y={cy} className="guide-atom-symbol" textAnchor="middle" dominantBaseline="central">
            {symbol || protons}
          </text>
        </g>
      </svg>
      <div className="guide-atom-caption">
        {protons} proton{protons === 1 ? "" : "s"} · {neutrons} neutron{neutrons === 1 ? "" : "s"} · {electrons} electron{electrons === 1 ? "" : "s"}
      </div>
    </div>
  );
}
