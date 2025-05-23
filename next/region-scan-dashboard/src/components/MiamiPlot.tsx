"use client";

import React, { useEffect, useMemo, useState } from "react";
import "d3-transition"; // must be imported before selection
import { symbolDiamond, symbol } from "d3-shape";
import { cumsum, extent, sum } from "d3-array";
import { axisBottom, axisLeft } from "d3-axis";
import { brushX, D3BrushEvent } from "d3-brush";
import { format } from "d3-format";
import {
  ScaleLinear,
  scaleLinear,
  ScaleOrdinal,
  scaleThreshold,
} from "d3-scale";
import { BaseType, select, selectAll, Selection } from "d3-selection";
import { Box } from "@mui/material";
import LoadingOverlay from "./LoadingOverlay";
import {
  AssembyInfo,
  RegionResult,
  SelectedRegionDetailData,
} from "@/lib/ts/types";
import { drawDottedLine, getEntries } from "@/lib/ts/util";

const className = "miami-plot";

const showTooltip = (data: RegionResult, e: MouseEvent) => {
  select(".tooltip")
    .style("left", `${e.pageX + 15}px`)
    .style("top", `${e.pageY - 15}px`)
    .style("visibility", "visible")
    .select<HTMLUListElement>("ul")
    .selectAll<HTMLLIElement, string>("li")
    .data<string>(
      [
        `Chromosome: ${data.chr}`,
        `Start pos: ${format(",")(data.start_bp)}`,
        `End pos: ${format(",")(data.end_bp)}`,
        `Region: ${data.region}`,
      ],
      (d) => d,
    )
    .join("li")
    .style("font-size", "15px")
    .text((d) => d);
};

const circleWidthScale = scaleLinear().range([1, 5]).domain([80000, 1]);

export interface BrushFilter {
  x0Lim: {
    chr: string;
    pos: number;
  };
  x1Lim: {
    chr: string;
    pos: number;
  };
}

const marginMiddle = 10;
const marginBottom = 25;
const yLabelMargin = 28;
const yAxisMargin = 20;
const marginLeft = yLabelMargin + yAxisMargin;
const marginTop = 25;

const buildChart = (
  assemblyInfo: AssembyInfo,
  bottomCol: keyof RegionResult,
  _bottomThresh: number,
  data: RegionResult[],
  filter: BrushFilter | undefined,
  filterCb: (filter: BrushFilter) => void,
  height: number,
  onCircleClick: (d: RegionResult) => void,
  pvalScale: ScaleOrdinal<string, string, never>,
  selector: string,
  topCol: keyof RegionResult,
  _topThresh: number,
  width: number,
  selectedRegionDetailData?: SelectedRegionDetailData,
) => {
  const topThresh = -Math.log10(_topThresh);
  const bottomThresh = -Math.log10(_bottomThresh);

  // get unique chromosomes, convert to string, sort asc
  const chrs = data
    .map((d) => d.chr)
    .filter((d, i, a) => (a.indexOf(d) === i ? true : false))
    .map((d) => d.toString())
    .sort((a, b) => (+a < +b ? -1 : 1));

  //make an array of the corresponding lengths

  const chrLengths = chrs.map((c) => assemblyInfo.lengths[c]);

  //find total base pairs
  const totalLength = sum(chrLengths);

  // create linear scale mapping bps to pixels
  const allChrScale = scaleLinear()
    .range([marginLeft, width])
    .domain([0, totalLength]);

  // creat cumsum of lengths
  const cumsums = cumsum(chrLengths);

  // create a cumsum mapping so we know when each chr starts and ends in relation to all displayed chrs
  const chrSumMapping = chrs.reduce<Record<string, [number, number]>>(
    (acc, curr, i) => ({
      ...acc,
      [curr]: [i === 0 ? 0 : cumsums[i - 1] + 1, cumsums[i]],
    }),
    {},
  );

  //create a scale keyed by chromosome (for plotting)
  const chrCumSumScale = Object.entries(chrSumMapping)
    .sort((a, b) => (+a[0] > +b[0] ? 1 : -1))
    .reduce<Record<string, ScaleLinear<number, number, never>>>(
      (acc, [k, v]) => ({
        ...acc,
        [k]: scaleLinear()
          .range([allChrScale(v[0]), allChrScale(v[1])])
          .domain([0, assemblyInfo.lengths[k]]),
      }),
      {},
    );

  const transformedData = data.map((d) =>
    Object.fromEntries(
      getEntries(d)
        .filter(([, v]) => !!v)
        .map(([k, v]) => {
          if ([topCol, bottomCol].includes(k)) {
            return [k, -1 * Math.log10(v as number)];
          } else {
            return [k, v];
          }
        }),
    ),
  ) as unknown as RegionResult[];

  const upperData = transformedData.filter((d) => !!d[topCol]);

  const lowerData = transformedData.filter((d) => !!d[bottomCol]);

  const singleChrXScale = scaleLinear()
    .range([marginLeft, width])
    .domain(
      extent(
        upperData
          .map((d) => d.start_bp)
          .concat(lowerData.map((d) => d.start_bp)),
      ) as [number, number],
    );

  const getPlottingXScale = (chr: string) =>
    chrs.length > 1
      ? chrCumSumScale[chr]
      : (singleChrXScale as ScaleLinear<number, number, never>);

  const xAxisScale =
    chrs.length > 1
      ? scaleThreshold()
          .range(
            [marginLeft].concat(
              Object.entries(chrCumSumScale)
                .sort((a, b) => (+a[0] > +b[0] ? 1 : -1))
                .map((kv) => kv[1].range()[1]),
            ),
          )
          .domain(
            Object.entries(chrCumSumScale)
              .sort((a, b) => (+a[0] > +b[0] ? 1 : -1))
              .map(([k]) => +k),
          )
      : singleChrXScale;

  //todo: we need 2 yscales, one up, one down
  //we don't need margin bottom, or we can bake in

  const yScaleLower = scaleLinear()
    .range([marginTop + height / 2 + marginMiddle, height - marginBottom])
    .domain(
      extent(upperData.map((d) => d[bottomCol]) as number[]) as [
        number,
        number,
      ],
    );

  const yScaleUpper = scaleLinear()
    .range([marginTop, height - height / 2 - marginMiddle])
    .domain(
      extent(upperData.map((d) => d[topCol]) as number[]).reverse() as [
        number,
        number,
      ],
    );

  const svg = select(selector)
    .selectAll<SVGElement, number>("svg")
    .data([1], () => transformedData.length)
    .join("svg")
    .attr("viewBox", [0, 0, width, height])
    .attr("width", width)
    .attr("height", height)
    .attr("style", "max-width: 100%; height: auto;") as Selection<
    SVGElement,
    number,
    BaseType,
    unknown
  >;

  const container: Selection<SVGGElement, number, SVGElement, number> = svg
    .selectAll<SVGGElement, number>("g.container")
    .data([1])
    .join("g")
    .attr("class", "container");

  const xAxis = axisBottom(xAxisScale)
    .tickFormat((t) => (chrs.length > 1 ? "" : format(",")(t)))
    .tickSize(3)
    .ticks(chrs.length > 1 ? chrs.length : 7);

  const xAxisSelection = container
    .selectAll<SVGGElement, number>("g.x-axis")
    .data([1], () => xAxisScale.range().toString())
    .join("g")
    .attr("class", "x-axis")
    .attr("transform", `translate(0,${height - height / 2 + marginMiddle})`)
    .transition()
    .duration(500)
    .selection();

  xAxisSelection.call(xAxis);

  xAxisSelection
    .selectAll(".tick line")
    .attr("transform", `translate(0,${-2})`);

  const midpoints = Object.entries(chrCumSumScale)
    .sort((a, b) => (+a > +b ? 1 : -1))
    .map(([chr, scale]) => ({
      chr,
      midpoint: (scale.range()[0] + scale.range()[1]) / 2,
    }));

  xAxisSelection
    .selectAll<SVGGElement, { chr: string; midpoint: number }>("g.tick-rr")
    .data<{ chr: string; midpoint: number }>(midpoints, (d) => d.midpoint)
    .join("g")
    .attr("class", "tick-rr")
    .attr("transform", (d) => `translate(${d.midpoint},11)`)
    .selectAll("text.label-rr")
    .data((d) => [d])
    .join("text")
    .attr("class", "label-rr")
    .attr("fill", "black")
    .text((d) => (chrs.length > 1 ? `Chr ${d.chr}` : ""));

  const yAxisUpper = axisLeft(yScaleUpper)
    .tickFormat((t) => Math.abs(+t).toString())
    .ticks(7);
  const yAxisLower = axisLeft(yScaleLower)
    .tickFormat((t) => Math.abs(+t).toString())
    .ticks(7);

  container
    .selectAll<SVGGElement, number>("g.y-axis-upper")
    .data([1], () => yScaleUpper.range().toString())
    .join("g")
    .attr("class", "y-axis-upper")
    .attr("transform", `translate(${marginLeft},0)`)
    .transition()
    .duration(500)
    .call(yAxisUpper)
    .selection();

  container
    .selectAll<SVGGElement, number>("g.y-axis-lower")
    .data([1], () => yScaleLower.range().toString())
    .join("g")
    .attr("class", "y-axis-lower")
    .attr("transform", `translate(${marginLeft},0)`)
    .transition()
    .duration(500)
    .call(yAxisLower)
    .selection();

  // Add y axis labels

  const upperMidPoint = (yScaleUpper.range()[0] + yScaleUpper(0)) / 2;
  const lowerMidPoint = (yScaleLower.range()[1] + yScaleLower(0)) / 2;

  container
    .selectAll("g.y-upper-label")
    .data([1])
    .join("g")
    .attr("class", "y-upper-label")
    .transition()
    .duration(500)
    .attr("transform", `translate(5,${upperMidPoint})`)
    .selection()
    .selectAll("text")
    .data([1])
    .join("text")
    .text("-log10 P")
    .attr("transform", "rotate(90)")
    .attr("font-size", 12)
    .attr("text-anchor", "middle");

  container
    .selectAll("g.y-lower-label")
    .data([1])
    .join("g")
    .attr("class", "y-lower-label")
    .transition()
    .duration(500)
    .attr("transform", `translate(5,${lowerMidPoint})`)
    .selection()
    .selectAll("text")
    .data([1])
    .join("text")
    .text("-log10 P")
    .attr("font-size", 12)
    .attr("transform", "rotate(90)")
    .attr("text-anchor", "middle");

  const posRange = selectedRegionDetailData
    ? selectedRegionDetailData.bpRange.map((d) =>
        getPlottingXScale(selectedRegionDetailData.region.chr.toString())(d),
      )
    : null;

  container
    .selectAll("rect.selected")
    .data([posRange])
    .join("rect")
    .attr("class", "selected")
    .attr("width", (d) => !!d && d[1] - d[0])
    .attr("x", () => posRange && posRange[0])
    .attr("y", marginTop)
    .attr("height", height - marginBottom - marginTop)
    .attr("stroke", "gold")
    .attr("stroke-width", "3px")
    .attr("fill", "none")
    .attr("opacity", 0.5);

  const circleContainer = container
    .selectAll<SVGGElement, number>("g.circles")
    .data([1], () => allChrScale.range().toString())
    .join("g")
    .attr("class", "circles");

  //this should come before the tooltip events to prevent the overlay from capturing the mouseenter events
  circleContainer.call(
    brushX<number>()
      .extent([
        [marginLeft, marginTop],
        [width, height - marginBottom],
      ])
      .on("start brush end", function (event: D3BrushEvent<number>) {
        if (!event.sourceEvent || !event.selection) return;
        if (event.selection) {
          const [x0, x1] = event.selection as [number, number];

          if (event.type === "end") {
            const bp0 = allChrScale.invert(x0);
            const bp1 = allChrScale.invert(x1);
            let chr0: string = chrs[0],
              chr1: string = chrs[0];

            cumsums.forEach((c, i) => {
              if (bp0 > c) {
                chr0 = chrs[i + 1];
              }
              if (bp1 > c) {
                chr1 = chrs[i + 1];
              }
            });

            const posScale = getPlottingXScale(chr0);
            const pos0 = posScale.invert(x0);
            const pos1 = posScale.invert(x1);

            const filter: BrushFilter = {
              x0Lim: {
                chr: chr0,
                pos: pos0,
              },
              x1Lim: {
                chr: chr1,
                pos: pos1,
              },
            };

            filterCb(filter);

            event.target.clear(select(this));
          }
        }
      }),
  );

  circleContainer
    .selectAll<SVGCircleElement, RegionResult>("circle.upper")
    .data(upperData.filter((d) => !!d[topCol] && d[topCol] < topThresh))
    .join("circle")
    .attr("class", "upper")
    .attr("r", circleWidthScale(transformedData.length))
    .attr("fill", pvalScale(topCol))
    .attr("opacity", 0.5)
    .attr("cx", (d) => getPlottingXScale(d.chr.toString())(d.end_bp))
    .attr("cy", (d) => yScaleUpper(d[topCol]!));

  circleContainer
    .selectAll("circle.lower")
    .data(
      lowerData.filter((d) => !!d[bottomCol] && d[bottomCol] < bottomThresh),
      (_, i) => `${i}-${topCol}`,
    )
    .join("circle")
    .attr("class", "lower")
    .attr("r", circleWidthScale(transformedData.length))
    .attr("fill", pvalScale(bottomCol))
    .attr("opacity", 0.5)
    .attr("cx", (d) => getPlottingXScale(d.chr.toString())(d.end_bp))
    .attr("cy", (d) => yScaleLower(d[bottomCol]!));

  circleContainer
    .selectAll<SVGPathElement, RegionResult>("path.upper")
    .data(upperData.filter((d) => !!d[topCol] && d[topCol] > topThresh))
    .join("path")
    .attr("class", "upper")
    .attr("d", symbol(symbolDiamond))
    .attr("opacity", 0.5)
    .attr("fill", pvalScale(topCol))
    .attr(
      "transform",
      (d) =>
        `translate(${getPlottingXScale(d.chr.toString())(
          d.end_bp,
        )}, ${yScaleUpper(d[topCol] as number)})`,
    );

  circleContainer
    .selectAll("path.lower")
    .data(
      lowerData.filter((d) => !!d[bottomCol] && d[bottomCol] > bottomThresh),
      (_, i) => `${i}-${topCol}`,
    )
    .join("path")
    .attr("class", "lower")
    .attr("opacity", 0.5)
    .attr("d", symbol(symbolDiamond))
    .attr("fill", pvalScale(bottomCol))
    .attr(
      "transform",
      (d) =>
        `translate(${getPlottingXScale(d.chr.toString())(
          d.end_bp,
        )}, ${yScaleLower(d[bottomCol] as number)})`,
    );

  circleContainer
    .selectAll<BaseType, RegionResult>("circle, path")
    .on("click", (_, d: RegionResult) => onCircleClick(d))
    .on("mouseover", (e: MouseEvent, d: RegionResult) => showTooltip(d, e))
    .on("mouseout", () => selectAll(".tooltip").style("visibility", "hidden"));

  drawDottedLine(
    container,
    "top-thresh",
    yScaleUpper(topThresh),
    yScaleUpper(topThresh),
    marginLeft,
    width,
  );

  drawDottedLine(
    container,
    "bottom-thresh",
    yScaleLower(bottomThresh),
    yScaleLower(bottomThresh),
    marginLeft,
    width,
  );

  container
    .selectAll("text.title")
    .data([1], () => chrs.toString())
    .join("text")
    .attr("class", "title")
    .text(`Miami Plot${chrs.length === 1 ? ` Chr ${chrs[0]}` : ""}`)
    .attr("text-anchor", "middle")
    .attr("transform", `translate(${width / 2}, 12)`);

  //append tooltip
  select("body")
    .selectAll("div.tooltip")
    .data([1])
    .join("div")
    .attr("class", "tooltip")
    .style("z-index", 999)
    .style("position", "absolute")
    .style("background-color", "black")
    .style("opacity", 0.85)
    .style("color", "white")
    .style("border-radius", "5px")
    .style("visibility", "hidden")
    .style("padding", "2px")
    .selectAll("ul")
    .data([1])
    .join("ul")
    .style("list-style", "none")
    .style("padding", "2px")
    .style("margin", "2px");
};

interface MiamiPlotProps {
  assemblyInfo: AssembyInfo;
  bottomCol: keyof RegionResult;
  bottomThresh: number;
  data: RegionResult[];
  filterCb: (filter: BrushFilter) => void;
  filter?: BrushFilter;
  onCircleClick: (d: RegionResult) => void;
  pvalScale: ScaleOrdinal<string, string, never>;
  selectedRegionDetailData?: SelectedRegionDetailData;
  topThresh: number;
  topCol: keyof RegionResult;
  width: number;
}

const MiamiPlot: React.FC<MiamiPlotProps> = ({
  assemblyInfo,
  bottomCol,
  bottomThresh,
  data,
  filter,
  filterCb,
  onCircleClick,
  pvalScale,
  selectedRegionDetailData,
  topCol,
  topThresh,
  width,
}) => {
  const [loading, setLoading] = useState(true);

  //we need a full tick and render to show the loading indicator
  const [renderFlag, setRenderFlag] = useState(false);

  const _width = useMemo(() => width, [width]);

  useEffect(() => {
    setTimeout(() => setRenderFlag(true));
  }, []);

  useEffect(() => {
    if (renderFlag) {
      Promise.resolve(
        buildChart(
          assemblyInfo,
          bottomCol,
          bottomThresh,
          data,
          filter,
          filterCb,
          0.5 * width,
          onCircleClick,
          pvalScale,
          `.${className}`,
          topCol,
          topThresh,
          _width,
          selectedRegionDetailData,
        ),
      ).finally(() => setLoading(false));
    }
  }, [
    assemblyInfo,
    bottomCol,
    bottomThresh,
    data,
    filter,
    filterCb,
    pvalScale,
    selectedRegionDetailData,
    topCol,
    topThresh,
    width,
    renderFlag,
    _width,
  ]);

  return (
    <>
      <Box className={className} />
      <LoadingOverlay open={loading} />
    </>
  );
};

export default MiamiPlot;
