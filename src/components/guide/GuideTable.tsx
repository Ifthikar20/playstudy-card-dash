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
  // Part anchors for the tutor's pointer: a column is its header cell, a row is the
  // whole <tr> (named by its row label, so that label cell needs no anchor of its
  // own), and cells.r.c counts c the same way as the columns, so cells.1.2 sits
  // under columns.2.
  return (
    <div className="guide-table">
      {title && <div className="guide-chart-title">{title}</div>}
      <table className="guide-table-grid">
        <thead>
          <tr>
            {columns.map((c, i) => (
              <th
                key={i}
                scope="col"
                style={i > 0 ? { color: COLORS[(i - 1) % COLORS.length] } : undefined}
                data-board-part={`columns.${i}`}
                data-board-label={c || undefined}
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} data-board-part={`rows.${i}`} data-board-label={row[0] || undefined}>
              {row.map((cell, j) =>
                j === 0 ? (
                  <th key={j} scope="row">
                    {cell}
                  </th>
                ) : (
                  <td key={j} data-board-part={`cells.${i}.${j}`} data-board-label={cell || undefined}>
                    {cell}
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
