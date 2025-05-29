import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";
import { extent, groups, max } from "d3-array";
import { axisBottom, axisLeft, axisRight } from "d3-axis";
import { format } from "d3-format";
import "d3-transition"; // must be imported before selection
import { BaseType, pointer, select, selectAll, Selection } from "d3-selection";
import { ScaleLinear, scaleLinear, ScaleOrdinal, scaleOrdinal } from "d3-scale";
import { line } from "d3-shape";
import {
  Box,
  Button,
  Checkbox,
  FormControl,
  FormControlLabel,
  Grid2 as Grid,
} from "@mui/material";
import {
  AssembyInfo,
  EnsemblGeneResult,
  PlinkVariant,
  RegionResult,
  SelectedRegionDetailData,
  UCSCRecombTrackResult,
  VariantResult,
} from "@/lib/ts/types";
import { LoadingOverlay, PvarCheckbox, UploadButtonSingle } from "@/components";
import { drawDottedLine, parseTsv } from "@/lib/ts/util";
import { fetchGenes } from "@/util/fetchGenes";
import { fetchRecomb } from "@/util/fetchRecomb";

const processPlinkVariants = async (
  file: File,
  posRange: [number, number],
): Promise<PlinkVariant[]> => {
  const parsed = await parseTsv<PlinkVariant>(file);
  return parsed
    .map((v) =>
      Object.fromEntries(
        Object.entries(v).map(([k, v]) => {
          const _k = k.toLowerCase().replace("#", "");
          return [
            _k.toLowerCase().replace("#", ""),
            v !== "."
              ? ["ref", "alt", "id", "a1", "test"].includes(_k)
                ? v
                : +v
              : null,
          ];
        }),
      ),
    )
    .filter(
      (v) => v.pos > posRange[0] && v.pos < posRange[1] && v.test === "ADD",
    ) as PlinkVariant[];
};

interface ChartVariants {
  plinkVariants: PlinkVariant[];
  regionVariants: VariantResult[];
}

interface RegionData {
  region: number;
  start: number;
  end: number;
  variable: keyof RegionResult;
  pvalue: number;
}

interface RecombLineData {
  x: number;
  recomb: number;
}

const circleWidthScale = scaleLinear().range([1, 2.5]).domain([5e6, 5e4]);

const showToolTip = (e: MouseEvent, text: string[]) =>
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

const variantColorScale = scaleOrdinal<string>()
  .range(["teal", "orange"])
  .domain(["0", "1"]);

const getGeneLabelXCoord = (
  gene: EnsemblGeneResult,
  xScale: ScaleLinear<number, number, number>,
) => {
  const x1 = Math.max(xScale(gene.start), xScale.range()[0]);
  const x2 = Math.min(xScale(gene.end), xScale.range()[1]);

  return (x1 + x2) / 2;
};

const regionRectHeight = 5;
const marginBottom = 35;
const yLabelMargin = 28;
const yAxisMargin = 20;
const marginLeft = yLabelMargin + yAxisMargin;
const marginTop = 25;
const marginRight = 15;
const geneRectHeight = 3;

const getVisibleDataRange = (data: RegionResult[]) =>
  extent(data.map((d) => d.region));

class RegionChart {
  container: Selection<SVGGElement, number, SVGElement, unknown>;
  height: number;
  hiddenGeneLabels: string[];
  mainWidth: number;
  pvalScale: ScaleOrdinal<string, string, never>;
  selector: string;
  svg: Selection<SVGElement, number, BaseType, unknown>;
  width: number;
  xScale: ScaleLinear<number, number, never> | null = null;

  constructor(
    pvalScale: ScaleOrdinal<string, string, never>,
    selector: string,
    regionVars: (keyof RegionResult)[],
    mainWidth: number,
  ) {
    //display properties
    this.pvalScale = pvalScale;
    this.selector = selector;
    this.mainWidth = mainWidth;
    this.width = this.mainWidth + 130;
    this.height = 0.4 * this.width;
    this.hiddenGeneLabels = [];

    this.svg = select(`.${this.selector}`)
      .selectAll<SVGElement, number>("svg")
      .data([1])
      .join("svg")
      .attr("viewBox", [0, 0, this.width, this.height])
      .attr("width", this.width)
      .attr("height", this.height)
      .attr("style", "max-width: 100%; height: auto;") as Selection<
      SVGElement,
      number,
      BaseType,
      unknown
    >;

    this.container = this.svg
      .selectAll<SVGGElement, number>("g.container")
      .data([1])
      .join("g")
      .attr("class", "container");
  }

  resetHiddenGeneLabels = () => (this.hiddenGeneLabels = []);

  render = (
    data: RegionResult[],
    { plinkVariants, regionVariants }: ChartVariants,
    genes: EnsemblGeneResult[],
    wheelCb: (delta: number, pos: number) => void,
    setCenterRegion: (region: number) => void,
    recombData: UCSCRecombTrackResult[],
    geneLabelsVisible: boolean,
    visiblePvars: (keyof RegionResult)[],
  ) => {
    const regionData = groups(data, (d) => d.region).flatMap(
      ([region, members]) => {
        const [start, end] = extent(
          members.flatMap((m) => [m.start_bp, m.end_bp]),
        ) as [number, number];

        return Object.entries(members[0])
          .filter(([k]) => k.toLowerCase().endsWith("_p"))
          .map(([variable, pvalue]) => ({
            region,
            start,
            end,
            variable,
            pvalue: -Math.log10(pvalue),
          })) as RegionData[];
      },
    );

    const xScale = scaleLinear()
      .range([marginLeft, this.mainWidth - marginRight])
      .domain(extent(regionData.flatMap((d) => [d.start, d.end])) as number[])
      .clamp(true);

    this.xScale = xScale; //ts, could just initialize empty

    const visibleGenes = genes.filter(
      (g) => g.end >= xScale.domain()[0] && g.start <= xScale.domain()[1],
    );

    const geneHeightMap = visibleGenes.reduce<Record<string, number>>(
      (acc, curr) => ({
        ...acc,
        [curr.id]: 0,
      }),
      {},
    );

    if (visibleGenes.length) {
      const sorted = visibleGenes.sort((a, b) => (a.start < b.start ? -1 : 1));
      sorted.forEach((outerG, i) => {
        for (let j = i; j < sorted.length; j++) {
          if (outerG.end > sorted[j].start) {
            let height = geneHeightMap[outerG.id] + 1;
            if (geneHeightMap[outerG.id] > 1) {
              const covered = sorted
                .slice(0, i)
                .sort((a, b) => (a.end < b.end ? -1 : 1));
              for (let k = geneHeightMap[outerG.id]; k > 0; k--) {
                for (let l = i - 1; l >= 0; l--) {
                  if (geneHeightMap[covered[l].id] === k) {
                    if (covered[l].end < sorted[j].start) {
                      height = k;
                    }
                    break;
                  }
                }
              }
            }
            geneHeightMap[visibleGenes[j].id] = height;
          }
        }
      });
    }

    const geneHeightCount = !!visibleGenes.length
      ? max(Object.values(geneHeightMap)) || 1
      : 0;

    const geneSpace = !!geneHeightCount
      ? geneHeightCount * (geneRectHeight + (geneLabelsVisible ? 12 : 3))
      : 0; //padding

    const chr = data[0].chr;

    const filteredRegionVariants = regionVariants.filter(
      (v) => v.start_bp >= xScale.domain()[0] && v.end_bp <= xScale.domain()[1],
    );

    const filteredPlinkVariants = plinkVariants.filter(
      (v) =>
        !!v.pos &&
        !!v.p &&
        v.pos >= xScale.domain()[0] &&
        v.pos <= xScale.domain()[1],
    );

    const yScalePval = scaleLinear()
      .range([marginTop, this.height - marginBottom - geneSpace])
      .domain([
        max(
          regionData
            .map((d) => d.pvalue)
            .concat(
              filteredRegionVariants.map((v) => -Math.log10(v.sglm_pvalue)),
            )
            .concat(filteredPlinkVariants.map((v) => -Math.log10(v.p!))),
        ) as number,
        -0.05,
      ]);

    const yScaleGene = scaleLinear()
      .range([
        this.height - geneSpace - marginBottom,
        this.height - marginBottom - geneRectHeight - 1,
      ])
      .domain([geneHeightCount ? geneHeightCount + 1 : geneHeightCount, 1]); // add an extra for padding

    const filteredRecomb = recombData.filter(
      (r) => r.end <= xScale.domain()[1] && r.start >= xScale.domain()[0],
    );

    const yScaleRecomb = scaleLinear()
      .range(yScalePval.range())
      .domain(
        !filteredRecomb.length
          ? [0, 0]
          : (extent(filteredRecomb.map((d) => d.value)).reverse() as [
              number,
              number,
            ]),
      );

    //draw region rectangles
    this.container
      .selectAll<SVGRectElement, RegionData>("rect.region")
      .data(
        regionData.filter((d) => visiblePvars.includes(d.variable)),
        (d) => d.pvalue,
      )
      .join("rect")
      .attr("class", "region")
      //x and y are upper-left corner
      .transition()
      .duration(100)
      .attr("x", (d) => xScale(d.start))
      .attr("y", (d) => yScalePval(d.pvalue))
      .attr("fill", (d) => this.pvalScale(d.variable))
      .transition()
      .duration(250)
      .attr("height", regionRectHeight)
      .attr("width", (d) => xScale(d.end) - xScale(d.start))
      .selection()
      .on("mouseover", (e: MouseEvent, d: RegionData) =>
        showToolTip(e, [
          `Variable: ${d.variable}`,
          `Region: ${d.region}`,
          `Start pos: ${format(",")(d.start)}`,
          `End pos: ${format(",")(d.end)}`,
          `Pval: ${format(".5")(d.pvalue)}`,
        ]),
      )
      .on("mouseout", () => selectAll(".tooltip").style("visibility", "hidden"))
      .on("click", (e, d) => setCenterRegion(d.region));

    // add region variants
    this.container
      .selectAll<SVGCircleElement, VariantResult>("circle.region-variant")
      .data(filteredRegionVariants, (v) => v.sglm_pvalue)
      .join("circle")
      .attr("class", "region-variant")
      .attr("cx", (d) => xScale(d.bp))
      .attr("cy", (d) => yScalePval(-Math.log10(d.sglm_pvalue)))
      .attr("fill", (d) => variantColorScale((d.region % 2) + ""))
      .transition()
      .duration(300)
      .selection()
      .attr("opacity", 0.7)
      .attr("r", circleWidthScale(xScale.domain()[1] - xScale.domain()[0]))
      .on("mouseover", (e: MouseEvent, d: VariantResult) =>
        showToolTip(e, [
          `Variant: ${d.variant}`,
          `Region: ${d.region}`,
          `Pos: ${format(",")(d.bp)}`,
          `sglm pval: ${format(".5")(d.sglm_pvalue)}`,
        ]),
      )
      .on("mouseout", () =>
        selectAll(".tooltip").style("visibility", "hidden"),
      );

    // add plink variants
    this.container
      .selectAll<SVGCircleElement, PlinkVariant>("circle.variant")
      .data(filteredPlinkVariants, (v) => v.p!)
      .join("circle")
      .attr("class", "variant")
      .attr("cx", (d) => xScale(d.pos!))
      .attr("cy", (d) => yScalePval(-Math.log10(d.p!)))
      .attr("fill", () => "purple")
      .transition()
      .duration(300)
      .selection()
      .attr("opacity", 0.7)
      .attr("r", circleWidthScale(xScale.domain()[1] - xScale.domain()[0]))
      .on("mouseover", (e: MouseEvent, d: PlinkVariant) =>
        showToolTip(e, [
          `Pos: ${d.pos}`,
          `Ref: ${d.ref}`,
          `Alt: ${d.alt}`,
          `P-values: ${d.p}`,
        ]),
      )
      .on("mouseout", () =>
        selectAll(".tooltip").style("visibility", "hidden"),
      );

    // add genes
    this.container
      .selectAll<SVGRectElement, EnsemblGeneResult>("rect.gene")
      .data(visibleGenes)
      .join("rect")
      .attr("class", "gene")
      //x and y are upper-left corner
      .attr("x", (d) => xScale(d.start))
      .attr("y", (d) => yScaleGene(geneHeightMap[d.id]))
      .attr("fill", "blue")
      .attr("height", geneRectHeight)
      .attr("width", (d) => xScale(d.end) - xScale(d.start))
      .on("mouseover", (e: MouseEvent, d: EnsemblGeneResult) =>
        showToolTip(e, [
          `Gene: ${d.external_name}`,
          `Type: ${d.biotype}`,
          `ID: ${d.gene_id}`,
          `Start pos: ${format(",")(d.start)}`,
          `End pos: ${format(",")(d.end)}`,
        ]),
      )
      .on("mouseout", () => selectAll(".tooltip").style("visibility", "hidden"))
      .on("click", (e, d) => {
        if (this.hiddenGeneLabels.includes(d.external_name)) {
          this.hiddenGeneLabels = this.hiddenGeneLabels.filter(
            (g) => g !== d.external_name,
          );
        } else {
          this.hiddenGeneLabels.push(d.external_name);
        }

        this.render(
          data,
          { plinkVariants, regionVariants },
          genes,
          wheelCb,
          setCenterRegion,
          recombData,
          geneLabelsVisible,
          visiblePvars,
        );
      });

    // add gene labels
    this.container
      .selectAll<SVGRectElement, EnsemblGeneResult>("text.gene-label")
      .data(
        geneLabelsVisible
          ? visibleGenes.filter(
              (g) => !this.hiddenGeneLabels.includes(g.external_name),
            )
          : [],
      )
      .join("text")
      .attr("class", "gene-label")
      .attr("x", (d) => getGeneLabelXCoord(d, xScale))
      .attr("y", (d) => yScaleGene(geneHeightMap[d.id]) - 1)
      .text((d) => d.external_name)
      .style("font-size", 9)
      .style("text-anchor", "middle")
      .on("mouseover", (e: MouseEvent, d: EnsemblGeneResult) =>
        showToolTip(e, [
          `Gene: ${d.external_name}`,
          `Type: ${d.biotype}`,
          `ID: ${d.gene_id}`,
          `Start pos: ${format(",")(d.start)}`,
          `End pos: ${format(",")(d.end)}`,
        ]),
      )
      .on("mouseout", () =>
        selectAll(".tooltip").style("visibility", "hidden"),
      );

    this.container
      .selectAll<SVGGElement, number>("g.x-axis")
      .data([1])
      .join("g")
      .attr("class", "x-axis")
      .attr("transform", `translate(0,${this.height - marginBottom})`)
      .transition()
      .duration(500)
      .call(axisBottom(xScale).ticks(5));

    const visibleDataRange = getVisibleDataRange(data);

    this.container
      .selectAll<SVGGElement, string>("text.title")
      .data([1], () => `${visibleDataRange[0]}-${visibleDataRange[1]}`)
      .join("text")
      .attr("class", "title")
      .attr("font-size", 14)
      .text(`Chr${chr} Regions ${visibleDataRange[0]}-${visibleDataRange[1]}`)
      .attr("text-anchor", "middle")
      .attr("transform", `translate(${this.mainWidth / 2}, 12)`);

    this.container
      .selectAll<SVGGElement, number>("g.y-axis")
      .data([1])
      .join("g")
      .attr("class", "y-axis")
      .attr("transform", `translate(${marginLeft},0)`)
      .transition()
      .duration(500)
      .call(axisLeft(yScalePval));

    this.container
      .selectAll("g.y-label")
      .data([1])
      .join("g")
      .attr("class", "y-label")
      .transition()
      .duration(500)
      .attr("transform", `translate(5,${this.height / 2})`)
      .selection()
      .selectAll("text")
      .data([1])
      .join("text")
      .text("-log p-value")
      .attr("font-size", 12)
      .attr("transform", "rotate(90)")
      .attr("text-anchor", "middle");

    this.container
      .selectAll<SVGGElement, number>("g.y-axis-r")
      .data([1])
      .join("g")
      .attr("class", "y-axis-r")
      .attr("transform", `translate(${this.mainWidth - marginRight},0)`)
      .transition()
      .duration(500)
      .call(axisRight(yScaleRecomb));

    this.container
      .selectAll("g.y-label-r")
      .data([1])
      .join("g")
      .attr("class", "y-label-r")
      .transition()
      .duration(500)
      .attr("transform", `translate(${this.mainWidth + 12},${this.height / 2})`)
      .selection()
      .selectAll("text")
      .data([1])
      .join("text")
      .text("Recombination Rate")
      .attr("font-size", 12)
      .attr("transform", "rotate(90)")
      .attr("text-anchor", "middle");

    const recombLineData = filteredRecomb.flatMap((d) => [
      { recomb: d.value, x: d.start },
      { recomb: d.value, x: d.end },
    ]);

    const recombLine = line<RecombLineData>()
      .x((d) => xScale(d.x))
      .y((d) => yScaleRecomb(d.recomb));

    this.container
      .selectAll("path.recomb")
      .data([recombLineData], () => recombLineData.length)
      .join("path")
      .attr("class", "recomb")
      .style("fill", "none")
      .style("stroke", "lightsteelblue")
      .attr("d", (d) => recombLine(d));

    const legendContainer = this.container
      .selectAll("g.legend")
      .data([1])
      .join("g")
      .attr("class", "legend")
      .attr("transform", `translate(${this.mainWidth + 28}, ${marginTop})`);

    legendContainer
      .selectAll("rect")
      .data(visiblePvars)
      .join("rect")
      .attr("width", 10)
      .attr("height", 10)
      .attr("x", 0)
      .attr("y", (_, i) => 5 + i * 18)
      .attr("fill", (d) => this.pvalScale(d));

    legendContainer
      .selectAll("text")
      .data(visiblePvars)
      .join("text")
      .text((d) => d)
      .attr("text-anchor", "right")
      .attr("transform", (_, i) => `translate(15,${16 + i * 18})`);

    this.svg.on("wheel", function (e: WheelEvent) {
      e.preventDefault();
      const [x] = pointer(e);
      wheelCb(e.deltaY, xScale.invert(x));
    });

    drawDottedLine(
      this.container,
      "region-p-line",
      yScalePval(-Math.log10(5e-6)),
      yScalePval(-Math.log10(5e-6)),
      xScale.range()[0],
      xScale.range()[1],
    );

    if (!!regionVariants.length) {
      drawDottedLine(
        this.container,
        "variant-p-line",
        yScalePval(-Math.log10(5e-7)),
        yScalePval(-Math.log10(5e-7)),
        xScale.range()[0],
        xScale.range()[1],
      );
    } else {
      this.container.select("g.variant-p-line").remove();
    }
  };
}

interface RegionPlotProps {
  assemblyInfo: AssembyInfo;
  mainWidth: number;
  pvalScale: ScaleOrdinal<string, string, never>;
  pvars: (keyof RegionResult)[];
  regionVars: (keyof RegionResult)[];
  selectedRegionDetailData: SelectedRegionDetailData;
  selector: string;
  variants: VariantResult[];
}

const RegionPlot: React.FC<RegionPlotProps> = ({
  assemblyInfo,
  pvalScale,
  pvars,
  regionVars,
  selectedRegionDetailData,
  selector,
  mainWidth,
  variants,
}) => {
  const [centerRegion, setCenterRegion] = useState(
    selectedRegionDetailData.region.region,
  );

  const [chart, setChart] = useState<RegionChart>();

  const [genes, setGenes] = useState<EnsemblGeneResult[]>([]);

  const [geneLabelsVisible, setGeneLabelsVisible] = useState(false);

  const [loading, setLoading] = useState(false);

  const [plinkVariants, setPlinkVariants] = useState<PlinkVariant[]>([]);

  const [proteinGenesOnly, setProteinGenesOnly] = useState(true);

  const [recombData, setRecombData] = useState<UCSCRecombTrackResult[]>([]);

  const [recombVisible, setRecombVisible] = useState(false);

  const [uploadKey, setUploadKey] = useState<string>(
    Math.random().toString(36).slice(2),
  );

  const [variantsVisible, setVariantsVisible] = useState<boolean>(false);

  const [visibleData, setVisibleData] = useState<RegionResult[]>([]);

  const [visiblePvars, setVisiblePvars] = useState<(keyof RegionResult)[]>([]);

  const [wheelTick, setWheelTick] = useState<number | null>(null);

  const data = useMemo(
    () => selectedRegionDetailData.data,
    [selectedRegionDetailData],
  );

  const chr = useMemo(() => (data.length ? data[0].chr : null), [data]);

  const posRange = useMemo(
    () => extent(data.map((d) => d.start_bp)) as [number, number],
    [data],
  );

  const filteredVariants = useMemo(
    () => variants.filter((v) => v.bp >= posRange[0] && v.bp <= posRange[1]),
    [variants, posRange],
  );

  const visibleGenes = useMemo(() => {
    if (proteinGenesOnly) {
      return genes.filter((g) => g.biotype === "protein_coding");
    } else {
      return genes;
    }
  }, [genes, proteinGenesOnly]);

  const visibleVariants: ChartVariants = useMemo(() => {
    if (variantsVisible) {
      return { regionVariants: filteredVariants, plinkVariants: plinkVariants };
    } else {
      return { regionVariants: [], plinkVariants: [] };
    }
  }, [plinkVariants, filteredVariants, variantsVisible]);

  const visibleRecomb = useMemo(() => {
    if (recombVisible) {
      return recombData;
    } else {
      return [];
    }
  }, [recombData, recombVisible]);

  const maxWheelTick = useMemo(
    () =>
      max(
        selectedRegionDetailData.regions.map((r) => Math.abs(r - centerRegion)),
      ) as number,
    [selectedRegionDetailData, centerRegion],
  );

  useEffect(() => {
    // fetch the recomb rate data and merge with region data, this means only 1 api call per chart
    const [start, end] = posRange;

    if (chr && start !== end) {
      fetchRecomb(chr, start, end, assemblyInfo.assembly).then((r) => {
        if (r) {
          r.sort((a, b) => (a.start < b.start ? -1 : 1));
          setRecombData(r);
        } else {
          alert("Error fetching recombination data");
          setRecombData([]);
        }
      });
    }
  }, [data, assemblyInfo, chr, posRange]);

  //set visible data depending on zoom and center
  useEffect(() => {
    if (!!data.length) {
      if (wheelTick !== null) {
        const [_startReg, _endReg] = [
          centerRegion - wheelTick,
          centerRegion + wheelTick,
        ];

        const visibleData = data.filter(
          (d) => d.region >= _startReg && d.region <= _endReg,
        );

        setVisibleData(visibleData);
      } else {
        setWheelTick(maxWheelTick);
      }
    }
  }, [centerRegion, data, wheelTick, maxWheelTick]);

  const updateRange = useCallback(
    (delta: number, pos: number) => {
      if (wheelTick !== null && wheelTick <= 1 && delta < 0) {
        return;
      }

      const targetRegion = visibleData.find(
        (d) => pos >= d.start_bp && pos <= d.end_bp,
      );

      //maxwheeltick ("zoom out") is max distance from center region to most distant region
      //ensuring we can use the full frame
      if (wheelTick !== null) {
        if (wheelTick > maxWheelTick && delta > 0) {
          return;
        } else {
          if (targetRegion && wheelTick !== null) {
            if (targetRegion.region > centerRegion) {
              setCenterRegion(centerRegion + 1);
            } else {
              setCenterRegion(centerRegion - 1);
            }
          }

          setWheelTick((wt) => {
            if (wt !== null) {
              return delta > 0 ? wt + 1 : wt - 1;
            } else return null;
          });
        }
      }
    },
    [wheelTick, maxWheelTick, centerRegion, visibleData],
  );

  useEffect(() => {
    setVisiblePvars((pvars) => [
      ...new Set(pvars.concat(regionVars).filter(Boolean)),
    ]);
  }, [regionVars]);

  //initial render
  useLayoutEffect(() => {
    const Chart = new RegionChart(pvalScale, selector, regionVars, mainWidth);
    setChart(Chart);
  }, [mainWidth, regionVars]);

  //new data
  useEffect(() => {
    if (chart) {
      setGenes([]);
      setWheelTick(null);
      setVariantsVisible(true);
      setCenterRegion(selectedRegionDetailData.region.region);
    }
    /* only clear out if the chart exists */
  }, [selectedRegionDetailData, assemblyInfo]);

  //update
  useEffect(() => {
    if (!!chart && !!visibleData.length) {
      chart.resetHiddenGeneLabels();

      chart.render(
        visibleData,
        visibleVariants,
        visibleGenes,
        updateRange,
        setCenterRegion,
        visibleRecomb,
        geneLabelsVisible,
        visiblePvars,
      );
    }
    setUploadKey(Math.random().toString(36).slice(2));
  }, [
    chart,
    geneLabelsVisible,
    updateRange,
    setCenterRegion,
    visibleData,
    visibleGenes,
    visiblePvars,
    visibleRecomb,
    visibleVariants,
    mainWidth,
  ]);

  return (
    <Grid container spacing={2} direction="row" size={{ xs: 12 }}>
      {/* Region controls */}
      <Grid container size={{ xs: 2, xl: 1.5 }} spacing={0} direction="column">
        <Grid>
          {/* plink variant upload */}
          <UploadButtonSingle
            key={uploadKey}
            fileType="plink variant"
            onUpload={async (file) => {
              setLoading(true);
              const mapped = await processPlinkVariants(file, posRange);
              if (mapped.length === 0) {
                alert("no variants found for this region");
              }
              setLoading(false);
              setPlinkVariants(mapped);
            }}
            variant="text"
          />
        </Grid>
        <Grid>
          {(!!filteredVariants.length || !!plinkVariants.length) && (
            <Button onClick={() => setVariantsVisible(!variantsVisible)}>
              {variantsVisible ? "Hide " : " Show"} Variants
            </Button>
          )}
        </Grid>
        <Grid>
          <Button onClick={() => setRecombVisible(!recombVisible)}>
            {recombVisible ? "Hide " : " Show"} Recombination
          </Button>
        </Grid>
        <Grid>
          <Button
            onClick={async () => {
              if (chr) {
                setLoading(true);
                const _genes = await fetchGenes(
                  chr,
                  posRange[0],
                  posRange[1],
                  assemblyInfo.assembly,
                );
                if (_genes !== null) {
                  setGenes(_genes);
                  if (_genes.length === 0) {
                    alert("No genes found for this region");
                  }
                } else {
                  alert(
                    "there was an error fetching the genes for this region",
                  );
                  setGenes([]);
                }
                setLoading(false);
              }
            }}
          >
            Fetch genes
          </Button>
        </Grid>
        {!!genes.length && (
          <Grid>
            <FormControl>
              <FormControlLabel
                label="Protein Coding Only"
                control={
                  <Checkbox
                    onChange={() => setProteinGenesOnly(!proteinGenesOnly)}
                    checked={proteinGenesOnly}
                    title="Protein Coding only"
                  />
                }
              />
            </FormControl>
          </Grid>
        )}
        {!!genes.length && (
          <Grid>
            <Button onClick={() => setGeneLabelsVisible(!geneLabelsVisible)}>
              {`${geneLabelsVisible ? "Hide " : "Show "}`}Gene Names
            </Button>
          </Grid>
        )}
      </Grid>
      {/* Region plot */}
      <Grid container size={{ xs: 8, xl: 6 }}>
        <Box className={selector} />
      </Grid>
      {/* Region line selector */}
      <Grid
        container
        size={{ xs: 2, xl: 4 }}
        direction="column"
        spacing={0}
        alignItems="flex-start"
      >
        {pvars.map((v) => (
          <Grid key={v}>
            <PvarCheckbox
              checked={visiblePvars.includes(v)}
              onChange={(_, checked) =>
                checked
                  ? setVisiblePvars(visiblePvars.concat(v))
                  : setVisiblePvars(visiblePvars.filter((c) => c !== v))
              }
              pvalScale={pvalScale}
              value={v}
            />
          </Grid>
        ))}
      </Grid>
      <LoadingOverlay open={loading} />
    </Grid>
  );
};

export default RegionPlot;
