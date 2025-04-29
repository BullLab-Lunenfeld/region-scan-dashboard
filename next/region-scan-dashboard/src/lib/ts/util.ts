import { range } from "d3-array";
import { Selection } from "d3-selection";
import { line } from "d3-shape";
import Papa from "papaparse";

export const parseTsv = <T extends Record<string, any>>(
  tsv: File,
): Promise<T[]> => {
  return new Promise((resolve) =>
    Papa.parse<T>(tsv, {
      header: true,
      skipEmptyLines: true,
      complete: (v) => resolve(v.data),
    }),
  );
};

export const drawDottedLine = (
  container: Selection<SVGGElement, number, SVGElement, number>,
  cls: string,
  y: number,
  x1: number,
  x2: number,
) => {
  //We'll have 10px intervals for a 5px line segment and 5px gap
  const lineCount = Math.round((x2 - x1) / 10);

  container
    .selectAll(`g.${cls}`)
    .data([y])
    .join("g")
    .attr("class", cls)
    .transition()
    .duration(500)
    .attr("transform", `translate(0, ${y})`)
    .selection()
    .selectAll("path")
    .data(range(lineCount))
    .join("path")
    .attr("d", (d) =>
      line<number>()
        .x((d) => x1 + d)
        .y(() => 0)([d * 10, d * 10 + 5]),
    )
    .attr("stroke", "grey");
};
