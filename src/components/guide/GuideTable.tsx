import type { GuideTable as GuideTableData } from "@/services/guide";

/*
  A comparison table for the Teach mode whiteboard.

  Compare-and-contrast is the shape most exam questions take — mitosis vs meiosis,
  DNA vs RNA, ionic vs covalent — and it's the one thing a spoken walkthrough can't
  hold in your head. The wording is copied from the notes, so nothing here is
  computed or invented; only the ruling is ours.
*/

const COLORS = ["#ec4899", "#3b82f6", "#14b8a6", "#f59e0b"];

export function GuideTable({ table }: { table: GuideTableData }) {
  const { title, columns, rows } = table;
  return (
    <div className="guide-table">
      {title && <div className="guide-chart-title">{title}</div>}
      <table className="guide-table-grid">
        <thead>
          <tr>
            {columns.map((c, i) => (
              <th key={i} scope="col" style={i > 0 ? { color: COLORS[(i - 1) % COLORS.length] } : undefined}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) =>
                j === 0 ? (
                  <th key={j} scope="row">
                    {cell}
                  </th>
                ) : (
                  <td key={j}>{cell}</td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
