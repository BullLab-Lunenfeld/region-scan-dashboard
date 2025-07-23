import { select, Selection } from "d3-selection";
import { line } from "d3-shape";
import { format } from "d3-format";
import Papa from "papaparse";
import {
  VariantResult,
  VariantResultRawNew,
  VariantResultRawOld,
} from "./types";

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

export const unique = <
  T extends Record<string | number, any>,
  K extends keyof T,
>(
  arr: T[],
  k: K,
): T[K][] => [...new Set(arr.map((d) => d[k]))];

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
    .data(coords.slice(1).filter((_, i) => i % 2))
    .join("path")
    .attr("d", (d) => lineGen(d))
    .attr("stroke", "grey");
};

export const getEntries = <T extends Record<any, any>>(obj: T) =>
  Object.entries(obj) as [keyof T, T[keyof T]][];

export const linspace = (
  start: number,
  stop: number,
  num: number,
  endpoint = true,
) => {
  const div = endpoint ? num - 1 : num;
  const step = (stop - start) / div;
  return Array.from({ length: num }, (_, i) => start + step * i);
};

export const fillRange = (min: number, max: number) => {
  const res = [];
  for (let i = min; i <= max; i++) {
    res.push(i);
  }
  return res;
};

const regionVariantRenameMap: Partial<
  Record<keyof VariantResultRawOld, keyof VariantResultRawNew>
> = {
  "sg.beta": "sglm.beta",
  "sg.se": "sglm.se",
  "sg.pval": "sglm.pvalue",
  "MLC.flip": "MLC.codechange",
  VIF: "mglm.vif",
  "glm.beta": "mglm.beta",
  "glm.se": "mglm.se",
  "glm.pval": "mglm.pvalue",
  pos: "bp",
  multiallelicSNP: "multiallelic",
};

const regionVariantColsToDrop = [
  "LCBbin",
  "LCBbin_p",
  "LCZbin",
  "LCZbin_p",
  "vifbin",
  "glmbin_beta",
  "glmbin_se",
  "glmbin_pval",
  "LCBbin_glmByBin",
  "LCBbin_glmByBin_p",
  "LCZbin_glmByBin",
  "LCZbin_glmByBin_p",
];

export const transformRegionVariants = (
  parsed: VariantResult[],
  chrs: number[] | null = null,
  posRange: [number, number] | null = null,
  selectedRegions: number[] | null = null,
) =>
  parsed
    .map(
      (v) =>
        Object.fromEntries(
          Object.entries(v)
            .map(([k, v]) => {
              let k_ =
                regionVariantRenameMap[k as keyof VariantResultRawOld] || k;
              k_ = k_.replaceAll(".", "_") as keyof VariantResult;
              return [
                k_,
                v
                  ? v
                    ? ["ref", "alt", "variant"].includes(k)
                      ? v
                      : +v
                    : v
                  : null,
              ];
            })
            .filter(([k]) => !regionVariantColsToDrop.includes(k)),
        ) as unknown as VariantResult,
    )
    .filter((v) => {
      if (selectedRegions && !selectedRegions.includes(v.region)) {
        return false;
      }
      if (posRange && (v.start_bp < posRange[0] || v.end_bp > posRange[1])) {
        return false;
      }
      if (chrs && !chrs.includes(v.chr)) {
        return false;
      }

      return true;
    });

export const processRegionVariants = async (
  file: File,
  chrs: number[] | null = null,
  posRange: [number, number] | null = null,
  selectedRegions: number[] | null = null,
) => {
  const parsed = await parseTsv<VariantResult>(file);
  return transformRegionVariants(parsed, chrs, posRange, selectedRegions);
};

export const showToolTip = (e: MouseEvent, text: string[]) =>
  select(".tooltip")
    .style("left", `${e.pageX + 15}px`)
    .style("top", `${e.pageY - 15}px`)
    .style("visibility", "visible")
    .select<HTMLUListElement>("ul")
    .selectAll<HTMLLIElement, string>("li")
    .data<string>(text, (d) => d)
    .join("li")
    .style("font-size", "15px")
    .text((d) => d);

export const formatComma = format(",");

export const downloadCsv = <T extends Record<string, string | number>>(
  data: T[],
  filename?: string,
) => {
  const filtered = data.map((d) =>
    Object.fromEntries(
      Object.entries(d).filter(
        /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
        ([k, v]) => v === null || typeof v !== "object",
      ),
    ),
  );

  const headers = Object.keys(filtered[0]).join(",");

  const csv = `${headers}\n${filtered
    .map((row) =>
      Object.values(row)
        .map((item) => `"${item}"`)
        .join(","),
    )
    .join("\n")}`;

  const file = encodeURI(`data:application/csv,${csv}`);

  downloadFile(file, filename || "table-export.csv");
};

const downloadFile = (file: string, filename: string) => {
  const a = document.createElement("a");
  a.download = filename;
  a.target = "_blank";
  a.href = file;
  document.body.append(a);
  a.click();
  a.remove();
};
