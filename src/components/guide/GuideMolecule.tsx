import { useEffect, useRef, useState } from "react";
import SmilesDrawer from "smiles-drawer";
import type { GuideMolecule as GuideMoleculeData } from "@/services/guide";

/*
  A 2D molecular structure for the Teach mode whiteboard, drawn from a SMILES string
  with smiles-drawer. Falls back to showing the SMILES text if it can't be parsed.
*/

export function GuideMolecule({ molecule }: { molecule: GuideMoleculeData }) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    setFailed(false);
    // clear any previous drawing
    while (el.firstChild) el.removeChild(el.firstChild);
    const dark = typeof document !== "undefined" && document.documentElement.classList.contains("dark");
    try {
      const Lib = SmilesDrawer as unknown as {
        SvgDrawer: new (opts: Record<string, unknown>) => { draw: (tree: unknown, target: SVGElement, theme: string) => void };
        parse: (smiles: string, ok: (tree: unknown) => void, err: (e: unknown) => void) => void;
      };
      const drawer = new Lib.SvgDrawer({ width: 440, height: 240, padding: 24, bondThickness: 1.3, compactDrawing: false, terminalCarbons: true });
      Lib.parse(
        molecule.smiles,
        (tree) => {
          try {
            drawer.draw(tree, el, dark ? "dark" : "light");
          } catch {
            setFailed(true);
          }
        },
        () => setFailed(true),
      );
    } catch {
      setFailed(true);
    }
  }, [molecule.smiles]);

  return (
    <div className="guide-molecule">
      {molecule.title && <div className="guide-chart-title">{molecule.title}</div>}
      <svg ref={svgRef} className="guide-molecule-svg" width="100%" viewBox="0 0 440 240" style={{ display: failed ? "none" : "block" }} role="img" />
      {failed && <div className="guide-board-raw">{molecule.smiles}</div>}
    </div>
  );
}
