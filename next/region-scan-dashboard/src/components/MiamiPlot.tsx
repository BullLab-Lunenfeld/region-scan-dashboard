"use client";

import React, { useLayoutEffect } from "react";
import "d3-transition"; // must be imported before selection
import { cumsum, extent, sum } from "d3-array";
import { axisBottom, axisLeft } from "d3-axis";
import { brush, D3BrushEvent } from "d3-brush";
import { format } from "d3-format";
import { ScaleLinear, scaleLinear, scaleThreshold } from "d3-scale";
import { BaseType, select, selectAll, Selection } from "d3-selection";
import { Box } from "@mui/material";
import { AssembyInfo, RegionResult } from "@/lib/ts/types";
import { drawDottedLine } from "@/lib/ts/util";

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

const marginBottom = 25;
const yLabelMargin = 28;
const yAxisMargin = 20;
const marginLeft = yLabelMargin + yAxisMargin;
const marginTop = 25;

const buildChart = (
  assemblyInfo: AssembyInfo,
  bottomCol: keyof RegionResult,
  bottomColor: string,
  bottomThresh: number,
  data: RegionResult[],
  filter: BrushFilter | undefined,
  filterCb: (filter: BrushFilter) => void,
  height: number,
  onCircleClick: (d: RegionResult) => void,
  selectedRegion: RegionResult | undefined,
  selector: string,
  topCol: keyof RegionResult,
  topColor: string,
  topThresh: number,
  width: number,
) => {
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

  const transformedData = data
    .map((d) => {
      const _d = { ...d };
      _d[topCol] = -1 * Math.log10(_d[topCol]);
      _d[bottomCol] = Math.log10(_d[bottomCol]);
      return _d;
    })
    .sort((a) =>
      !!selectedRegion && a.region === selectedRegion.region ? 1 : -1,
    );

  const upperData = transformedData.filter((d) => !!d[topCol]);

  const lowerData = transformedData.filter((d) => !!d[bottomCol]);

  const xScale =
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
      : scaleLinear()
          .range([marginLeft, width])
          .domain(
            extent(
              upperData
                .map((d) => d.start_bp)
                .concat(lowerData.map((d) => d.start_bp)),
            ) as [number, number],
          );

  const yScale = scaleLinear()
    .range([marginTop, height - marginBottom])
    .domain(
      extent([
        ...upperData.map((d) => d[topCol]),
        ...lowerData.map((d) => d[bottomCol]),
      ]).reverse() as [number, number],
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

  const xAxis = axisBottom(xScale).tickFormat((t) =>
    chrs.length > 1 ? "" : format(",")(t),
  );

  const xAxisSelection = container
    .selectAll<SVGGElement, number>("g.x-axis")
    .data([1], () => xScale.range().toString())
    .join("g")
    .attr("class", "x-axis")
    .attr("transform", `translate(0,${height - marginBottom})`)
    .transition()
    .duration(500)
    .call(xAxis)
    .selection();

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

  const yAxis = axisLeft(yScale).tickFormat((t) => Math.abs(+t).toString());

  container
    .selectAll<SVGGElement, number>("g.y-axis")
    .data([1], () => yScale.range().toString())
    .join("g")
    .attr("class", "y-axis")
    .attr("transform", `translate(${marginLeft},0)`)
    .transition()
    .duration(500)
    .call(yAxis)
    .selection();

  // Add y axis labels

  const upperMidPoint = (yScale.range()[0] + yScale(0)) / 2;
  const lowerMidPoint = (yScale.range()[1] + yScale(0)) / 2;

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

  const circleContainer = container
    .selectAll<SVGGElement, number>("g.circles")
    .data([1], () => allChrScale.range().toString())
    .join("g")
    .attr("class", "circles");

  //this should come before the tooltip events to prevent the overlay from capturing the mouseenter events
  circleContainer.call(
    brush<number>().on(
      "start brush end",
      function (event: D3BrushEvent<number>) {
        if (event.selection) {
          const [[x0], [x1]] = event.selection as [
            [number, number],
            [number, number],
          ];

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

            const posScale =
              chrs.length > 1
                ? chrCumSumScale[chr0]
                : (xScale as ScaleLinear<number, number, never>);

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
      },
    ),
  );

  circleContainer
    .selectAll("circle.upper")
    .data(upperData, (_, i) => `${i}-${topCol}`)
    .join("circle")
    .attr("class", "upper")
    .attr("r", circleWidthScale(transformedData.length))
    .attr("fill", topColor)
    .attr("opacity", 0.5)
    .attr("cx", (d) =>
      chrs.length > 1
        ? chrCumSumScale[d.chr.toString()](d.end_bp)
        : xScale(d.end_bp),
    )
    .attr("stroke-width", 2)
    .attr(
      "stroke",
      selectedRegion
        ? (d) =>
            d.chr === selectedRegion.chr &&
            d.start_bp === selectedRegion.start_bp
              ? "black"
              : "none"
        : "none",
    )
    .attr("cy", (d) => yScale(d[topCol]))
    .selection()
    .on("click", (_, d: RegionResult) => onCircleClick(d))
    .on("mouseover", (e: MouseEvent, d: RegionResult) => showTooltip(d, e))
    .on("mouseout", () => selectAll(".tooltip").style("visibility", "hidden"));

  circleContainer
    .selectAll("circle.lower")
    .data(lowerData, (_, i) => `${i}-${topCol}`)
    .join("circle")
    .attr("class", "lower")
    .attr("r", circleWidthScale(transformedData.length))
    .attr("fill", bottomColor)
    .attr("stroke-width", 2)
    .attr(
      "stroke",
      selectedRegion
        ? (d) =>
            d.chr === selectedRegion.chr &&
            d.start_bp === selectedRegion.start_bp
              ? "black"
              : "none"
        : "none",
    )
    .attr("opacity", 0.5)
    .attr("cx", (d) =>
      chrs.length > 1
        ? chrCumSumScale[d.chr.toString()](d.end_bp)
        : xScale(d.end_bp),
    )
    .attr("cy", (d) => yScale(d[bottomCol]))
    .on("click", (_, d: RegionResult) => onCircleClick(d))
    .on("mouseover", (e: MouseEvent, d: RegionResult) => showTooltip(d, e))
    .on("mouseout", () => selectAll(".tooltip").style("visibility", "hidden"));

  drawDottedLine(
    container,
    "top-thresh",
    yScale(-Math.log10(topThresh)),
    marginLeft,
    width,
  );

  drawDottedLine(
    container,
    "bottom-thresh",
    yScale(Math.log10(bottomThresh)),
    marginLeft,
    width,
  );

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
  bottomColor: string;
  bottomThresh: number;
  data: RegionResult[];
  filterCb: (filter: BrushFilter) => void;
  filter?: BrushFilter;
  onCircleClick: (d: RegionResult) => void;
  selectedRegion?: RegionResult;
  topThresh: number;
  topCol: keyof RegionResult;
  topColor: string;
  width: number;
}

const MiamiPlot: React.FC<MiamiPlotProps> = ({
  assemblyInfo,
  bottomCol,
  bottomColor,
  bottomThresh,
  data,
  filter,
  filterCb,
  onCircleClick,
  selectedRegion,
  topCol,
  topColor,
  topThresh,
  width,
}) => {
  useLayoutEffect(() => {
    buildChart(
      assemblyInfo,
      bottomCol,
      bottomColor,
      bottomThresh,
      data,
      filter,
      filterCb,
      0.4 * width,
      onCircleClick,
      selectedRegion,
      `.${className}`,
      topCol,
      topColor,
      topThresh,
      width,
    );
  }, [
    assemblyInfo,
    bottomCol,
    bottomColor,
    bottomThresh,
    data,
    filter,
    filterCb,
    selectedRegion,
    topCol,
    topColor,
    topThresh,
    width,
  ]);

  return <Box className={className} />;
};

export default MiamiPlot;
