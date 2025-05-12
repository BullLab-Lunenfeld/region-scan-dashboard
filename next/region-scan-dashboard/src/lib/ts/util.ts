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
  y1: number,
  y2: number,
  x1: number,
  x2: number,
) => {
  const m = (y2 - y1) / (x2 - x1);

  const b = y1 - m * x1;

  const coords: [[number, number], [number, number]][] = [];
  let _x2: number = 0;
  let _y2: number = Infinity;
  let i = 0;
  while (_x2 <= x2 && _y2 >= y2) {
    const previous = i > 0 ? coords[i - 1] : null;
    const prevX1 = previous ? previous[1][0] : x1;
    const prevY1 = previous ? previous[1][1] : b;
    _x2 = prevX1 + 5;
    _y2 = m * _x2 + b;
    coords.push([
      [prevX1, prevY1],
      [_x2, _y2],
    ]);
    i++;
  }

  const lineGen = line()
    .x((d) => d[0])
    .y((d) => d[1]);

  container
    .selectAll(`g.${cls}`)
    .data([1], () => `${y1}-${y2}-${x1}-${x2}`)
    .join("g")
    .attr("class", cls)
    .transition()
    .duration(500)
    .selection()
    .selectAll("path")
    .data(coords.filter((_, i) => i % 2))
    .join("path")
    .attr("d", (d) => lineGen(d))
    .attr("stroke", "grey");
};

export const getEntries = <T extends Record<any, any>>(obj: T) =>
  Object.entries(obj) as [keyof T, T[keyof T]][];
