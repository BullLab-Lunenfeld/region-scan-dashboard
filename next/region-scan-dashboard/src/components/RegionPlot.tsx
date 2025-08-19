"use client";

import React, {
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { extent, groups, max, mean, min } from "d3-array";
import { axisBottom, axisLeft, axisRight } from "d3-axis";
import { drag } from "d3-drag";
import { format } from "d3-format";
import "d3-transition"; // must be imported before selection
import { BaseType, pointer, select, selectAll, Selection } from "d3-selection";
import { ScaleLinear, scaleLinear, ScaleOrdinal } from "d3-scale";
import { line } from "d3-shape";
import {
  Box,
  Button,
  Checkbox,
  Divider,
  FormControl,
  FormControlLabel,
  Grid2 as Grid,
  Menu,
  MenuItem,
  Typography,
} from "@mui/material";
import { CompareArrows } from "@mui/icons-material";
import { VisualizationDataContext } from "./AppContainer";
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
  ErrorModal,
  LoadingOverlay,
  NumberInput,
  PlotDownloadButton,
  PvarCheckbox,
  UploadButtonSingle,
} from "@/components";
import {
  drawDottedLine,
  fillRange,
  formatComma,
  getEntries,
  makePvalAxisLabel,
  parseTsv,
  showToolTip,
} from "@/lib/ts/util";
import { fetchGenes } from "@/util/fetchGenes";
import useDownloadPlot from "@/lib/hooks/useDownloadPlot";

interface RegionPeak {
  region: number;
  start_bp: number;
  end_bp: number;
  min_p: number;
}

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
  chr: number,
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
      (v) =>
        v.chrom === chr &&
        v.pos > posRange[0] &&
        v.pos < posRange[1] &&
        v.test === "ADD",
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
  dragCb: (dist: number) => void;
  height: number;
  mainWidth: number;
  pvalScale: ScaleOrdinal<string, string, never>;
  pvalThresholdRegion: number;
  pvalThresholdVariant: number;
  selector: string;
  selectedGeneRange: [[number, number]] | null;
  svg: Selection<SVGElement, number, BaseType, unknown>;
  width: number;

  constructor(
    pvalScale: ScaleOrdinal<string, string, never>,
    pvalThresholdRegion: number,
    pvalThresholdVariant: number,
    selector: string,
    mainWidth: number,
    dragCb: (dist: number) => void,
  ) {
    //display properties
    this.pvalScale = pvalScale;
    this.pvalThresholdRegion = pvalThresholdRegion;
    this.pvalThresholdVariant = pvalThresholdVariant;
    this.selector = selector;
    this.mainWidth = mainWidth;
    this.width = this.mainWidth + 240;
    this.height = 0.4 * this.width;
    this.selectedGeneRange = null;
    this.dragCb = dragCb;

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

  render = (
    data: RegionResult[],
    { plinkVariants, regionVariants }: ChartVariants,
    genes: EnsemblGeneResult[],
    wheelCb: (delta: number, pos: number) => void,
    setCenterRegion: (region: number) => void,
    recombData: LocalRecombData[],
    geneLabelsVisible: boolean,
    visiblePvars: (keyof RegionResult)[],
    unconveredRegions: number[],
    regionPeaks: RegionPeak[],
    transformPval: (pval: number) => number,
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
              transformPval(v) < Number.MAX_VALUE, //some are smaller than the js max and get converted to infinity...
          )
          .map(([variable, pvalue]) => ({
            region,
            start,
            end,
            variable,
            pvalue: transformPval(pvalue),
          })) as RegionData[];
      },
    );

    const xScale = scaleLinear()
      .range([marginLeft, this.mainWidth - marginRight])
      .domain(extent(regionData.flatMap((d) => [d.start, d.end])) as number[])
      .clamp(true);

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

    const filteredRegionLabels = regionPeaks.filter(
      (v) => v.start_bp >= xScale.domain()[0] && v.end_bp <= xScale.domain()[1],
    );

    const filteredPlinkVariants = plinkVariants.filter(
      (v) =>
        !!v.pos &&
        !!v.p &&
        v.pos >= xScale.domain()[0] &&
        v.pos <= xScale.domain()[1],
    );

    const pvalExtent = extent(
      regionData
        .map((d) => d.pvalue)
        .concat(filteredRegionVariants.map((v) => transformPval(v.sglm_pvalue)))
        .concat(filteredPlinkVariants.map((v) => transformPval(v.p!))),
    ).reverse() as [number, number];

    const yScalePval = scaleLinear()
      .range([
        marginTop + (regionPeaks.length ? 10 : 0), //10 is for topmost region label
        this.height - marginBottom - geneSpace - 0.5 * regionRectHeight,
      ])
      .domain(pvalExtent);

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

    this.container
      .selectAll<SVGRectElement, number>("rect.drag-rect")
      .data([1], () => (mean(data.map((d) => d.region)) as number).toString())
      .join("rect")
      .attr("class", "drag-rect")
      .attr("x", xScale.range()[0])
      .attr("y", 0)
      .attr("width", xScale.range()[1] - xScale.range()[0])
      .attr("height", yScalePval.range()[1])
      .attr("fill", "white")
      .lower()
      .call(
        drag<SVGRectElement, number, SVGRectElement>().on(
          "start",
          (e: DragEvent) => {
            const startPos = e.x;
            let dist = 0;
            //eslint-disable-next-line
            //@ts-ignore "on" is not included in types...
            e.on("drag", (e: DragEvent) => {
              const _dist = e.x - startPos;
              dist = dist + Math.abs(_dist);
              if (dist > (xScale.range()[1] - xScale.range()[0]) / 2.5) {
                this.dragCb(_dist);
                dist = 0;
              }
            });
          },
        ),
      );

    // draw plink variants
    this.container
      .selectAll<SVGCircleElement, PlinkVariant>("circle.variant")
      .data(filteredPlinkVariants, (v) => v.p!)
      .join("circle")
      .attr("class", "variant")
      .attr("cx", (d) => xScale(d.pos!))
      .attr("cy", (d) => yScalePval(transformPval(d.p!)))
      .attr("fill", (d) =>
        unconveredRegions.includes(d.pos!) ? "none" : "black",
      )
      .attr("stroke", (d) =>
        unconveredRegions.includes(d.pos!) ? "black" : "none",
      )
      .transition()
      .duration(300)
      .selection()
      .attr("r", circleWidthScale(xScale.domain()[1] - xScale.domain()[0]))
      .on("mouseover", (e: MouseEvent, d: PlinkVariant) =>
        showToolTip(e, [
          `Pos: ${formatComma(d.pos!)}`,
          `Ref: ${d.ref}`,
          `Alt: ${d.alt}`,
          `P-values: ${d.p}`,
        ]),
      )
      .on("mouseout", () =>
        selectAll(".tooltip").style("visibility", "hidden"),
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

    //draw region labels
    this.container
      .selectAll<SVGRectElement, number[]>("text.region-label")
      .data(filteredRegionLabels)
      .join("text")
      .attr("font-size", "8px")
      .attr("text-anchor", "middle")
      .attr("class", "region-label")
      .attr("x", (d) => xScale((d.end_bp + d.start_bp) / 2))
      .attr("y", (d) => yScalePval(transformPval(d.min_p)) - 8)
      .transition()
      .duration(200)
      .text((d) => d.region)
      .selection()
      .on("mouseover", (e: MouseEvent, d) =>
        showToolTip(e, [
          `Region: ${d.region}`,
          `Start pos: ${formatComma(d.start_bp)}`,
          `End pos: ${formatComma(d.end_bp)}`,
        ]),
      )
      .on("mouseout", () =>
        selectAll(".tooltip").style("visibility", "hidden"),
      );

    // add region variants
    this.container
      .selectAll<SVGCircleElement, VariantResult>("circle.region-variant")
      .data(filteredRegionVariants, (v) => v.sglm_pvalue)
      .join("circle")
      .attr("class", "region-variant")
      .attr("cx", (d) => xScale(d.bp))
      .attr("cy", (d) => yScalePval(transformPval(d.sglm_pvalue)))
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
        if (
          !!this.selectedGeneRange &&
          d.start === this.selectedGeneRange[0][0] &&
          d.end === this.selectedGeneRange[0][1]
        ) {
          this.selectedGeneRange = null;
        } else {
          this.selectedGeneRange = [[d.start, d.end]];
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
          unconveredRegions,
          regionPeaks,
          transformPval,
        );
      });

    // add gene labels
    this.container
      .selectAll<SVGRectElement, EnsemblGeneResult>("text.gene-label")
      .data(geneLabelsVisible ? visibleGenes : [])
      .join("text")
      .attr("class", "gene-label")
      .attr("x", (d) => getGeneLabelXCoord(d, xScale))
      .attr("y", (d) => yScaleGene(geneHeightMap[d.id]) - 1)
      .text((d) => d.external_name)
      .style("font-size", "9px")
      .style("font-style", "italic")
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
      .attr("font-size", "14px")
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
      .text(makePvalAxisLabel(transformPval))
      .attr("font-size", "12px")
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
      .attr("font-size", "12px")
      .selection()
      .attr("text-anchor", "middle");

    const recombLine = line<LocalRecombData>()
      .x((d) => xScale(d.pos))
      .y((d) => yScaleRecomb(d.recomb_rate));

    //draw recomb line
    this.container
      .selectAll("path.recomb")
      .data([recombData], () => recombData.length)
      .join("path")
      .attr("class", "recomb")
      .style("fill", "none")
      .style("stroke", "lightsteelblue")
      .attr("d", (d) => recombLine(d));

    this.container
      .selectAll("rect.selected-gene")
      .data(this.selectedGeneRange || [])
      .join("rect")
      .attr("width", (d) => xScale(d[1]) - xScale(d[0]))
      .attr("height", yScalePval.range()[1] - yScalePval.range()[0])
      .attr("x", (d) => xScale(d[0]))
      .attr("y", yScalePval.range()[0])
      .attr("class", "selected-gene")
      .style("fill", "gold")
      .style("opacity", 0.4);

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
        filteredPlinkVariants.length ? { text: "ADD_p", color: "black" } : null,
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
      yScalePval(transformPval(this.pvalThresholdRegion)),
      yScalePval(transformPval(this.pvalThresholdRegion)),
      xScale.range()[0],
      xScale.range()[1],
    );

    if (!!regionVariants.length) {
      drawDottedLine(
        this.container,
        "variant-p-line",
        yScalePval(transformPval(this.pvalThresholdVariant)),
        yScalePval(transformPval(this.pvalThresholdVariant)),
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
  const [annotationMenuOpen, setAnnotationMenuOpen] = useState(false);

  const [chart, setChart] = useState<RegionChart>();

  const [genes, setGenes] = useState<EnsemblGeneResult[]>([]);

  const [geneLabelsVisible, setGeneLabelsVisible] = useState(false);

  const [loading, setLoading] = useState(false);

  const [plinkVariants, setPlinkVariants] = useState<PlinkVariant[]>([]);

  const [proteinGenesOnly, setProteinGenesOnly] = useState(true);

  const [recombData, setRecombData] = useState<LocalRecombData[]>([]);

  const [recombVisible, setRecombVisible] = useState(false);

  const [regionLabelsVisible, setRegionLabelsVisible] = useState(false);

  const [uploadKey, setUploadKey] = useState<string>(
    Math.random().toString(36).slice(2),
  );

  const [variantsVisible, setVariantsVisible] = useState<boolean>(false);

  const [visibleData, setVisibleData] = useState<RegionResult[]>([]);

  const [visiblePvars, setVisiblePvars] = useState<(keyof RegionResult)[]>([]);

  const [warningMessage, setWarningMessage] = useState("");

  const { anchorEl, handlePopoverOpen } = useDownloadPlot();

  // pull data for convenience
  const data = useMemo(
    () =>
      selectedRegionDetailData.data.sort((a, b) =>
        a.region < b.region ? -1 : 1,
      ),
    [selectedRegionDetailData],
  );

  const setInitialDataRange = (regionDetailData: SelectedRegionDetailData) => {
    const {
      region: { region },
      regions,
      data,
    } = regionDetailData;

    const maxInitialRegion = region + 20;
    const minInitialRegion = region - 20;

    const initialStartRegion = Math.max(
      minInitialRegion,
      min(regions) as number,
    );

    const initialEndRegion = Math.min(maxInitialRegion, max(regions) as number);

    setVisibleData(
      data.filter((region) =>
        isWithinRegions(initialStartRegion, initialEndRegion, region.region),
      ),
    );
  };

  //we keep this in a ref so we don't have to redefine the drag callback over and over
  const visibleRegions = useRef([...new Set(visibleData.map((v) => v.region))]);

  useEffect(() => {
    visibleRegions.current = [...new Set(visibleData.map((v) => v.region))];
  }, [visibleData]);

  // start with view at +/- 20 regions
  useEffect(() => {
    setInitialDataRange(selectedRegionDetailData);
  }, [selectedRegionDetailData]);

  const uncoveredRegions = useMemo(() => {
    let missing: number[] = [];

    if (!!plinkVariants.length) {
      for (let i = 0; i < data.length; i++) {
        if (i === 0) {
          continue;
        }

        missing = missing.concat(
          fillRange(data[i - 1].end_bp + 1, data[i].start_bp),
        );
      }
    }

    return missing;
  }, [data, plinkVariants]);

  const regionPeaks: RegionPeak[] = useMemo(() => {
    return data.map((d) => ({
      region: d.region,
      start_bp: d.start_bp,
      end_bp: d.end_bp,
      min_p: min(
        getEntries(d)
          .filter(([k, v]) => !!v && visiblePvars.includes(k))
          .map(([, v]) => (v ? +v : 0)),
      ) as number,
    }));
  }, [data, visiblePvars]);

  //grab chr for convenience, only 1 will be visible at a time, prevent fetching the same data if data changes
  //but chr stays the same
  const chr = useMemo(() => (data.length ? data[0].chr : null), [data]);

  // grab the range of basepairs for convenience
  const posRange = useMemo(
    () => extent(data.map((d) => d.start_bp)) as [number, number],
    [data],
  );

  // get a base filter of variants that can be visible with this data
  const filteredVariants = useMemo(
    () => variants.filter((v) => v.bp >= posRange[0] && v.bp <= posRange[1]),
    [variants, posRange],
  );

  // get the visible genes (depends on protein coding only option)
  const visibleGenes = useMemo(() => {
    if (proteinGenesOnly) {
      return genes.filter((g) => g.biotype === "protein_coding");
    } else {
      return genes;
    }
  }, [genes, proteinGenesOnly]);

  // get the visible variants (depends on variants visible option)
  const visibleVariants: ChartVariants = useMemo(() => {
    if (variantsVisible) {
      return { regionVariants: filteredVariants, plinkVariants: plinkVariants };
    } else {
      return { regionVariants: [], plinkVariants: [] };
    }
  }, [plinkVariants, filteredVariants, variantsVisible]);

  // get thresholds from context
  const {
    thresholds: {
      regionRegion: pvalThresholdRegion,
      regionVariant: pvalThresholdVariant,
    },
    transformPValue,
  } = useContext(VisualizationDataContext);

  // fetch all recomb rates that might be displayed with this data
  useEffect(() => {
    if (chr) {
      fetch(`${process.env.NEXT_PUBLIC_APP_URL}/recomb/chr${chr}`).then((d) =>
        d.json().then((d) => setRecombData(d)),
      );
    }
  }, [chr]);

  // filter the recomb data by range
  const filteredRecombData = useMemo(
    () => recombData.filter((d) => d.pos > posRange[0] && d.pos < posRange[1]),
    [recombData, posRange],
  );

  // toggle recomb data for chart depending on choice
  const visibleRecomb = useMemo(() => {
    if (recombVisible) {
      return filteredRecombData;
    } else {
      return [];
    }
  }, [filteredRecombData, recombVisible]);

  // callback for when a user clicks on a region
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

  const dragCb = useCallback(
    (bpChange: number) => {
      const { regions: allRegions } = selectedRegionDetailData;
      const [visibleRegionMin, visibleRegionMax] = extent(
        visibleRegions.current,
      ) as [number, number];

      if (bpChange < 0) {
        if ((max(allRegions) as number) > visibleRegionMax) {
          setVisibleData(
            data.filter(
              (d) =>
                d.region > visibleRegionMin && d.region <= visibleRegionMax + 1,
            ),
          );
        }
      } else if ((min(allRegions) as number) < visibleRegionMin) {
        setVisibleData(
          data.filter(
            (d) =>
              d.region < visibleRegionMax && d.region >= visibleRegionMin - 1,
          ),
        );
      }
    },
    [data],
  );

  //zoom callback
  //todo: move copy visibleData into a ref so we can remove the dependency
  //update with same useEffect call as visibleRegion ref
  const updateRange = useCallback(
    (delta: number, pos: number) => {
      const [visibleStart, visibleEnd] = getRegionResultRange(visibleData);
      const visibleRange = visibleEnd - visibleStart;
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

      let zoomed = false;
      if (targetRegion) {
        //if mouse is hovering over the end, don't zoom in any further on that side
        if (targetRegion.region === visibleEnd) {
          if (delta < 0) {
            if (visibleStart < totalEnd) {
              newVisibleStart++;
              zoomed = true;
            }
          }
        }
        //if mouse is hovering over the start, don't zoom in any further on that side
        else if (targetRegion.region === visibleStart) {
          if (delta < 0) {
            if (visibleEnd > visibleStart + 1) {
              newVisibleEnd--;
              zoomed = true;
            }
          }
        }
      }

      if (!zoomed) {
        //zooming in
        if (delta < 0) {
          if (newVisibleStart < totalEnd) {
            newVisibleStart++;
          }
          if (newVisibleEnd > newVisibleStart) {
            newVisibleEnd--;
          }
        } else if (delta > 0) {
          //zooming out
          if (newVisibleStart >= totalStart) {
            newVisibleStart--;
          }
          if (newVisibleEnd <= totalEnd) {
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

  // List of visible p-values for the checkboxes and legend
  useEffect(() => {
    setVisiblePvars((pvars) => [
      ...new Set(pvars.concat(regionVars).filter(Boolean)),
    ]);
  }, [regionVars]);

  //initial render
  useLayoutEffect(() => {
    const Chart = new RegionChart(
      pvalScale,
      pvalThresholdRegion,
      pvalThresholdVariant,
      selector,
      mainWidth,
      dragCb,
    );
    setChart(Chart);
  }, [mainWidth]);

  //new data
  useEffect(() => {
    if (chart) {
      setGenes([]);
      setVariantsVisible(true);
      setInitialDataRange(selectedRegionDetailData);
      chart.selectedGeneRange = null;
      chart.dragCb = dragCb;
    }
    /* only clear out if the chart exists */
  }, [selectedRegionDetailData, assemblyInfo]);

  //update chart with new data
  useEffect(() => {
    if (!!chart && !!visibleData.length) {
      chart.render(
        visibleData,
        visibleVariants,
        visibleGenes,
        updateRange,
        setCenterRegion,
        visibleRecomb,
        geneLabelsVisible,
        visiblePvars,
        uncoveredRegions,
        regionLabelsVisible ? regionPeaks : [],
        transformPValue,
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
    pvalThresholdRegion,
    pvalThresholdVariant,
    uncoveredRegions,
    regionPeaks,
    regionLabelsVisible,
    transformPValue,
  ]);

  const toggleAnnotationsButtonRef = useRef<HTMLButtonElement | null>(null);

  return (
    <Grid container spacing={2} direction="row" size={{ xs: 12 }}>
      {/* Region controls */}
      <Grid
        container
        size={{ xs: 2, xl: 1.5 }}
        spacing={1}
        alignItems="flex-start"
        direction="column"
      >
        <Grid>
          <Typography textAlign="center">
            Total range: {getRegionResultRange(data).join("-")}
          </Typography>
        </Grid>
        <Grid container flexWrap="wrap" direction="row">
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
        </Grid>
        <Grid width="100%" marginY={2}>
          <Divider
            orientation="horizontal"
            sx={(theme) => ({ color: theme.palette.grey[400] })}
          />
        </Grid>
        <Grid>
          <Button
            ref={toggleAnnotationsButtonRef}
            onClick={() => setAnnotationMenuOpen(true)}
            variant="contained"
          >
            Annotation Controls
          </Button>
          <Menu
            anchorEl={toggleAnnotationsButtonRef.current}
            open={annotationMenuOpen}
            onClose={() => setAnnotationMenuOpen(false)}
          >
            <AnnotationItem
              onChange={() => setRecombVisible(!recombVisible)}
              title="Recombination visible"
              value={recombVisible}
            />
            <AnnotationItem
              onChange={() => setRegionLabelsVisible(!regionLabelsVisible)}
              title="Region labels visible"
              value={regionLabelsVisible}
            />
            {(!!filteredVariants.length || !!plinkVariants.length) && (
              <AnnotationItem
                onChange={() => setVariantsVisible(!variantsVisible)}
                title="Variants visible"
                value={variantsVisible}
              />
            )}
            {!!genes.length && (
              <AnnotationItem
                onChange={() => setGeneLabelsVisible(!geneLabelsVisible)}
                title="Gene names visible"
                value={geneLabelsVisible}
              />
            )}
            {!!genes.length && (
              <AnnotationItem
                onChange={() => setProteinGenesOnly(!proteinGenesOnly)}
                title="Protein coding only"
                value={proteinGenesOnly}
              />
            )}
          </Menu>
        </Grid>
        <Grid width="100%" marginY={2}>
          <Divider
            orientation="horizontal"
            sx={(theme) => ({ color: theme.palette.grey[400] })}
          />
        </Grid>
        {/* plink variant upload */}
        <Grid>
          <UploadButtonSingle
            key={uploadKey}
            fileType="plink variant"
            onUpload={async (file) => {
              setLoading(true);
              const mapped = await processPlinkVariants(file, chr!, posRange);
              if (mapped.length === 0) {
                setWarningMessage("No variants found for this region!");
              }
              setLoading(false);
              setVariantsVisible(true);
              setPlinkVariants(mapped);
            }}
            variant="text"
          />
        </Grid>
        <Grid>
          <Button
            startIcon={<CompareArrows />}
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
                    setWarningMessage("No genes found for this region!");
                  }
                } else {
                  setWarningMessage(
                    "There was an error fetching the genes for this region!",
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
      </Grid>
      {/* Region plot */}
      <Grid container size={{ xs: 9, lg: 7.5, xl: 7.5 }}>
        <Box className={selector} onMouseEnter={handlePopoverOpen} />
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
        plotType="Region Plot"
        selector={`.${selector}`}
      />
      <LoadingOverlay open={loading} />
      <ErrorModal
        open={!!warningMessage}
        onClose={() => setWarningMessage("")}
        message={warningMessage}
      />
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
      width="90px"
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
      width="90px"
    />
  );
};

interface AnnotationItemProps {
  onChange: () => void;
  title: string;
  value: boolean;
}

const AnnotationItem: React.FC<AnnotationItemProps> = ({
  onChange,
  title,
  value,
}) => (
  <MenuItem>
    <FormControl>
      <FormControlLabel
        label={title}
        control={
          <Checkbox
            size="small"
            onChange={onChange}
            checked={value}
            title={title}
          />
        }
      />
    </FormControl>
  </MenuItem>
);
