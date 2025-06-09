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
import { ScaleLinear, scaleLinear, ScaleOrdinal } from "d3-scale";
import { line } from "d3-shape";
import {
  Box,
  Button,
  Checkbox,
  FormControl,
  FormControlLabel,
  Grid2 as Grid,
  Typography,
} from "@mui/material";
import {
  AssembyInfo,
  EnsemblGeneResult,
  LocalRecombData,
  PlinkVariant,
  RegionResult,
  SelectedRegionDetailData,
  VariantResult,
} from "@/lib/ts/types";
import {
  LoadingOverlay,
  NumberInput,
  PlotDownloadButton,
  PvarCheckbox,
  UploadButtonSingle,
} from "@/components";
import {
  drawDottedLine,
  formatComma,
  parseTsv,
  showToolTip,
} from "@/lib/ts/util";
import { fetchGenes } from "@/util/fetchGenes";
import useDownloadPlot from "@/lib/hooks/useDownloadPlot";
import { downloadSvg } from "@/lib/ts/export";

//so these need to return pixel values, like a char is 6px, so how many bp is that?
//we habe to take the wider width

const getEndPos = (
  gene: EnsemblGeneResult,
  labelVisible: boolean,
  charWidthInBp: number,
) => {
  if (
    !labelVisible ||
    !gene.external_name ||
    gene.end - gene.start > charWidthInBp * gene.external_name?.length ||
    0
  ) {
    return gene.end;
  } else {
    return (
      (gene.end + gene.start) / 2 +
        (charWidthInBp * gene.external_name?.length) / 2 || 0
    );
  }
};

const getStartPos = (
  gene: EnsemblGeneResult,
  labelVisible: boolean,
  charWidthInBp: number,
) => {
  if (
    !labelVisible ||
    !gene.external_name ||
    gene.end - gene.start > charWidthInBp * gene.external_name?.length ||
    0
  ) {
    return gene.start;
  } else {
    return (
      (gene.end + gene.start) / 2 -
        (charWidthInBp * gene.external_name?.length) / 2 || 0
    );
  }
};

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

const circleWidthScale = scaleLinear().range([1, 2.5]).domain([5e6, 5e4]);

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

const getRegionResultRange = (data: RegionResult[]) =>
  extent(data.map((d) => d.region)) as [number, number];

const isWithinRegions = (
  startRegion: number,
  endRegion: number,
  region: number,
) => region >= startRegion && region <= endRegion;

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
    mainWidth: number,
  ) {
    //display properties
    this.pvalScale = pvalScale;
    this.selector = selector;
    this.mainWidth = mainWidth;
    this.width = this.mainWidth + 140;
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
    recombData: LocalRecombData[],
    geneLabelsVisible: boolean,
    visiblePvars: (keyof RegionResult)[],
  ) => {
    const regionData = groups(data, (d) => d.region).flatMap(
      ([region, members]) => {
        const [start, end] = extent(
          members.flatMap((m) => [m.start_bp, m.end_bp]),
        ) as [number, number];

        return Object.entries(members[0])
          .filter(
            ([k, v]) =>
              k.toLowerCase().endsWith("_p") &&
              -Math.log10(v) < Number.MAX_VALUE, //some are smaller than the max and get converted to infinity...
          )
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
        [curr.id]: 1,
      }),
      {},
    );

    const charWidthInBp =
      Math.round(xScale.invert(xScale.range()[0] + 10)) - xScale.domain()[0];

    if (visibleGenes.length) {
      const sorted = visibleGenes.sort((a, b) =>
        getStartPos(a, geneLabelsVisible, charWidthInBp) <
        getStartPos(b, geneLabelsVisible, charWidthInBp)
          ? -1
          : 1,
      );

      // we'll iterate through each gene, lifting the ones that overlap,
      // then checking if the gene itself has been lifted and can be dropped into a lower position
      sorted.forEach((outerG, i) => {
        for (let j = i + 1; j < sorted.length; j++) {
          if (
            getEndPos(outerG, geneLabelsVisible, charWidthInBp) >
            getStartPos(sorted[j], geneLabelsVisible, charWidthInBp)
          ) {
            geneHeightMap[sorted[j].id] = geneHeightMap[sorted[j].id] + 1;

            if (geneHeightMap[outerG.id] > 1) {
              const covered = sorted
                .slice(0, j)
                .sort((a, b) =>
                  getEndPos(a, geneLabelsVisible, charWidthInBp) >
                  getEndPos(b, geneLabelsVisible, charWidthInBp)
                    ? -1
                    : 1,
                );

              for (let k = 1; k < geneHeightMap[outerG.id]; k++) {
                for (let l = 0; l < covered.length; l++) {
                  if (geneHeightMap[covered[l].id] === k) {
                    if (
                      getEndPos(covered[l], geneLabelsVisible, charWidthInBp) <
                      getStartPos(outerG, geneLabelsVisible, charWidthInBp)
                    ) {
                      geneHeightMap[outerG.id] = k;
                      break;
                    }
                    break;
                  }
                }
              }
            }
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
      .range([
        marginTop,
        this.height - marginBottom - geneSpace - 0.5 * regionRectHeight,
      ])
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
      (r) => r.pos <= xScale.domain()[1] && r.pos >= xScale.domain()[0],
    );

    const yScaleRecomb = scaleLinear()
      .range(yScalePval.range())
      .domain(
        !filteredRecomb.length
          ? [0, 0]
          : [
              max([
                120,
                max(filteredRecomb.map((f) => f.recomb_rate))!,
              ]) as number,
              0,
            ], //observed max is 1100 but this appears to be an outlier, there are a few higher than 120, so we'll be dynamic only as needed
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
          `Start pos: ${formatComma(d.start)}`,
          `End pos: ${formatComma(d.end)}`,
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
      .attr("fill", this.pvalScale("sglm_pvalue"))
      .transition()
      .duration(300)
      .selection()
      .attr("opacity", 0.7)
      .attr("r", circleWidthScale(xScale.domain()[1] - xScale.domain()[0]))
      .on("mouseover", (e: MouseEvent, d: VariantResult) =>
        showToolTip(e, [
          `Variant: ${d.variant}`,
          `Region: ${d.region}`,
          `Pos: ${formatComma(d.bp)}`,
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
      .attr("fill", () => "gray")
      .transition()
      .duration(300)
      .selection()
      .attr("opacity", 0.3)
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
          `Start pos: ${formatComma(d.start)}`,
          `End pos: ${formatComma(d.end)}`,
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
          `Start pos: ${formatComma(d.start)}`,
          `End pos: ${formatComma(d.end)}`,
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

    const visibleDataRange = getRegionResultRange(data);

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
      .attr("transform", `translate(15,${(this.height - geneSpace) / 2})`)
      .selection()
      .selectAll("text")
      .data([1])
      .join("text")
      .text("p-value (-log 10)")
      .attr("font-size", 12)
      .attr("transform", "rotate(-90)")
      .attr("text-anchor", "middle");

    this.container
      .selectAll<SVGGElement, number>("g.y-axis-r")
      .data([filteredRecomb.length].filter(Boolean))
      .join("g")
      .attr("class", "y-axis-r")
      .attr("transform", `translate(${this.mainWidth - marginRight},0)`)
      .transition()
      .duration(500)
      .call(axisRight(yScaleRecomb));

    this.container
      .selectAll("g.y-label-r")
      .data([filteredRecomb.length].filter(Boolean))
      .join("g")
      .attr("class", "y-label-r")
      .attr(
        "transform",
        `translate(${this.mainWidth + 18},${(this.height - geneSpace) / 2})`,
      )
      .selection()
      .selectAll("text")
      .data([1])
      .join("text")
      .text("Recombination Rate (Cm/Mb)")
      .attr("transform", "rotate(90)")
      .transition()
      .duration(500)
      .attr("font-size", 12)
      .selection()
      .attr("text-anchor", "middle");

    const recombLine = line<LocalRecombData>()
      .x((d) => xScale(d.pos))
      .y((d) => yScaleRecomb(d.recomb_rate));

    this.container
      .selectAll("path.recomb")
      .data([recombData], () => recombData.length)
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
      .selectAll("text.region")
      .data(visiblePvars)
      .join("text")
      .text((d) => d)
      .attr("class", "region")
      .attr("text-anchor", "right")
      .attr("transform", (_, i) => `translate(15,${16 + i * 18})`);

    const lowest = (visiblePvars.length - 1) * 18 + 5;
    const variantLegendData = ([] as ({ text: string; color: string } | null)[])
      .concat(
        filteredPlinkVariants.length ? { text: "ADD_p", color: "gray" } : null,
      )
      .concat(
        filteredRegionVariants.length
          ? { text: "sglm_p", color: this.pvalScale("sglm_pvalue") }
          : null,
      )
      .filter(Boolean);

    legendContainer
      .selectAll("circle.variant")
      .data(variantLegendData)
      .join("circle")
      .attr("class", "variant")
      .attr("r", 5)
      .attr("cx", 5)
      .attr("cy", (_, i) => lowest + 5 + (i + 1) * 18)
      .attr("fill", (d) => d!.color);

    legendContainer
      .selectAll("text.variant")
      .data(variantLegendData)
      .join("text")
      .text((d) => d!.text)
      .attr("class", "variant")
      .attr("text-anchor", "right")
      .attr(
        "transform",
        (_, i) => `translate(15,${lowest + 10 + (i + 1) * 18})`,
      );

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
  const [chart, setChart] = useState<RegionChart>();

  const [genes, setGenes] = useState<EnsemblGeneResult[]>([]);

  const [geneLabelsVisible, setGeneLabelsVisible] = useState(false);

  const [loading, setLoading] = useState(false);

  const [plinkVariants, setPlinkVariants] = useState<PlinkVariant[]>([]);

  const [proteinGenesOnly, setProteinGenesOnly] = useState(true);

  const [recombData, setRecombData] = useState<LocalRecombData[]>([]);

  const [recombVisible, setRecombVisible] = useState(false);

  const [uploadKey, setUploadKey] = useState<string>(
    Math.random().toString(36).slice(2),
  );

  const [variantsVisible, setVariantsVisible] = useState<boolean>(false);

  const [visibleData, setVisibleData] = useState<RegionResult[]>(
    selectedRegionDetailData.data,
  );

  const [visiblePvars, setVisiblePvars] = useState<(keyof RegionResult)[]>([]);

  const { anchorEl, buttonRef, handlePopoverOpen, handlePopoverClose } =
    useDownloadPlot();

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

  useEffect(() => {
    if (chr) {
      fetch(`${process.env.NEXT_PUBLIC_APP_URL}/recomb/chr${chr}`).then((d) =>
        d.json().then((d) => setRecombData(d)),
      );
    }
  }, [chr]);

  const filteredRecombData = useMemo(
    () => recombData.filter((d) => d.pos > posRange[0] && d.pos < posRange[1]),
    [recombData, posRange],
  );

  const visibleRecomb = useMemo(() => {
    if (recombVisible) {
      return filteredRecombData;
    } else {
      return [];
    }
  }, [filteredRecombData, recombVisible]);

  const setCenterRegion = useCallback(
    (newCenterRegion: number) => {
      const [selectedRegionStart, selectedRegionEnd] =
        getRegionResultRange(data);
      const visibleRegionFlankSize = Math.round(
        (selectedRegionEnd - selectedRegionStart - 1) / 2,
      );

      const newStart =
        newCenterRegion - visibleRegionFlankSize < selectedRegionStart
          ? selectedRegionStart
          : newCenterRegion - visibleRegionFlankSize;

      const newEnd =
        newCenterRegion + visibleRegionFlankSize > selectedRegionEnd
          ? selectedRegionEnd
          : newCenterRegion + visibleRegionFlankSize;

      setVisibleData(
        data.filter((d) => isWithinRegions(newStart, newEnd, d.region)),
      );
    },
    [data],
  );

  const updateRange = useCallback(
    (delta: number, pos: number) => {
      const [visibleStart, visibleEnd] = getRegionResultRange(visibleData);
      const visibleRange = visibleEnd - visibleStart;
      const visibleCenter = Math.round((visibleEnd + visibleStart) / 2);
      const [totalStart, totalEnd] = getRegionResultRange(data);
      const totalRange = totalEnd - totalStart;

      let [newVisibleStart, newVisibleEnd] = [visibleStart, visibleEnd];

      if (visibleRange <= 1 && delta < 0) {
        return;
      } else if (visibleRange === totalRange && delta > 0) {
        return;
      }

      const targetRegion = visibleData.find(
        (d) => pos >= d.start_bp && pos <= d.end_bp,
      );

      //target region is not in center, limit this or that side and zoom in, until it becomes the center or we run out of room
      let zoomed = false;
      if (targetRegion) {
        if (targetRegion.region > visibleCenter) {
          //zoom in rhs
          if (delta < 0) {
            if (visibleStart < totalEnd) {
              newVisibleStart++;
              zoomed = true;
            }
          }
          // zoom out rhs
          else if (visibleStart < totalStart) {
            newVisibleStart--;
            zoomed = true;
          }
        } else if (targetRegion.region < visibleCenter) {
          //zoom in lhs
          if (delta < 0) {
            if (visibleEnd > visibleStart + 1) {
              newVisibleEnd--;
              zoomed = true;
            }
          } else if (visibleEnd < totalEnd) {
            // zoom out lhs
            newVisibleEnd++;
            zoomed = true;
          }
        }
      }

      if (!zoomed) {
        //zooming in
        if (delta < 0) {
          if (newVisibleStart < totalEnd) {
            newVisibleStart++;
          }
          if (newVisibleEnd < newVisibleStart) {
            newVisibleEnd--;
          }
        } else if (delta > 0) {
          //zooming out
          if (newVisibleStart > totalStart) {
            newVisibleStart--;
          }
          if (newVisibleEnd < totalEnd) {
            newVisibleEnd++;
          }
        }
      }

      setVisibleData(
        data.filter((d) =>
          isWithinRegions(newVisibleStart, newVisibleEnd, d.region),
        ),
      );
    },
    [data, visibleData],
  );

  useEffect(() => {
    setVisiblePvars((pvars) => [
      ...new Set(pvars.concat(regionVars).filter(Boolean)),
    ]);
  }, [regionVars]);

  //initial render
  useLayoutEffect(() => {
    const Chart = new RegionChart(pvalScale, selector, mainWidth);
    setChart(Chart);
  }, [mainWidth]);

  //new data
  useEffect(() => {
    if (chart) {
      setGenes([]);
      setVariantsVisible(true);
      setVisibleData(selectedRegionDetailData.data);
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
        setCenterRegion, //this should be dynamic --- look at the span of the current view and shift so this is in the middle, then reset
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
      <Grid container size={{ xs: 2, xl: 1.5 }} spacing={2} direction="column">
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
        {(!!filteredVariants.length || !!plinkVariants.length) && (
          <Grid>
            <Button onClick={() => setVariantsVisible(!variantsVisible)}>
              {variantsVisible ? "Hide " : " Show"} Variants
            </Button>
          </Grid>
        )}
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
                    size="small"
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
        <Grid>
          <RegionRangeInputStart
            allData={data}
            setVisibleData={setVisibleData}
            visibleData={visibleData}
          />
        </Grid>
        <Grid>
          <RegionRangeInputEnd
            allData={data}
            setVisibleData={setVisibleData}
            visibleData={visibleData}
          />
        </Grid>
        <Grid>
          <Typography>
            Max range: {getRegionResultRange(data).join("-")}
          </Typography>
        </Grid>
      </Grid>
      {/* Region plot */}
      <Grid container size={{ xs: 9, lg: 7.5, xl: 7.5 }}>
        <Box
          className={selector}
          onMouseEnter={handlePopoverOpen}
          onMouseLeave={handlePopoverClose}
        />
      </Grid>
      {/* Region line selector */}
      <Grid
        container
        size={{ xs: 1, lg: 1.5, xl: 2 }}
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
      <PlotDownloadButton
        anchorEl={anchorEl}
        buttonRef={buttonRef}
        download={() => downloadSvg(`.${selector}`, "region-plot-export.svg")}
      />
      <LoadingOverlay open={loading} />
    </Grid>
  );
};

export default RegionPlot;

interface RegionRangeInputProps {
  allData: RegionResult[];
  setVisibleData: (data: RegionResult[]) => void;
  visibleData: RegionResult[];
}

const RegionRangeInputStart: React.FC<RegionRangeInputProps> = ({
  allData,
  setVisibleData,
  visibleData,
}) => {
  const [error, setError] = useState("");

  const onChange = useCallback(
    (v: number) => {
      setError("");
      const [outerStart, outerEnd] = getRegionResultRange(allData);
      const currentEnd = getRegionResultRange(visibleData)[1];
      if (isWithinRegions(outerStart, outerEnd, v) && v < currentEnd) {
        setVisibleData(
          allData.filter((d) => isWithinRegions(v, currentEnd, d.region)),
        );
      } else {
        setError("Invalid value");
      }
    },
    [allData, visibleData, setVisibleData],
  );

  return (
    <NumberInput
      label="Start Region"
      error={error}
      value={getRegionResultRange(visibleData)[0] || 0}
      onChange={onChange}
      width="100px"
    />
  );
};

const RegionRangeInputEnd: React.FC<RegionRangeInputProps> = ({
  allData,
  setVisibleData,
  visibleData,
}) => {
  const [error, setError] = useState("");

  const onChange = useCallback(
    (v: number) => {
      setError("");
      const [outerStart, outerEnd] = getRegionResultRange(allData);
      const [currentStart] = getRegionResultRange(visibleData);

      if (isWithinRegions(outerStart, outerEnd, v) && v > currentStart) {
        setVisibleData(
          allData.filter((d) => isWithinRegions(currentStart, v, d.region)),
        );
      } else {
        setError("Invalid value");
      }
    },
    [allData, visibleData, setVisibleData],
  );

  return (
    <NumberInput
      label="End Region"
      error={error}
      value={getRegionResultRange(visibleData)[1] || 0}
      onChange={onChange}
      width="100px"
    />
  );
};
