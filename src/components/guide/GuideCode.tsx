import type { GuideCode as GuideCodeData } from "@/services/guide";

/*
  A code snippet on the Teach mode whiteboard, with the line being explained
  marked, and optionally a trace of the variables as the code runs — the two
  things a spoken explanation of a loop can never hold still.

  Monospace here rather than the board's handwriting: indentation is the meaning.
*/

export function GuideCode({ code }: { code: GuideCodeData }) {
  const { title, language, lines, highlight, trace } = code;
  const lit = new Set(highlight);
  // Pointer anchors: a line is named by its line NUMBER (lines.1 is the first, as the
  // gutter and `highlight` count them), a trace row by its place in the trace. A line's
  // label keeps its gutter number, so a spoken "line 4" finds it as well as its code.
  return (
    <div className="guide-code">
      {(title || language) && <div className="guide-chart-title">{title || language}</div>}
      <pre className="guide-code-pre">
        {lines.map((line, i) => (
          <div
            key={i}
            className={`guide-code-line${lit.has(i + 1) ? " guide-code-lit" : ""}`}
            data-board-part={`lines.${i + 1}`}
            data-board-label={`line ${i + 1}${line.trim() ? `: ${line.trim()}` : ""}`}
          >
            <span className="guide-code-num">{i + 1}</span>
            <code>{line || " "}</code>
          </div>
        ))}
      </pre>
      {trace && (
        <table className="guide-table-grid guide-code-trace">
          <thead>
            <tr>
              {trace.columns.map((c, i) => (
                <th key={i} scope="col">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {trace.rows.map((row, i) => (
              <tr key={i} data-board-part={`trace.${i}`} data-board-label={row.join(" ")}>
                {row.map((cell, j) => (
                  <td key={j}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
