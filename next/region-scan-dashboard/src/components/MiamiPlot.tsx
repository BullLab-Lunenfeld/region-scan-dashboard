"use client";

import React, { useLayoutEffect } from "react";
import "d3-transition"; // must be imported before selection
import { cumsum, extent, range, sum } from "d3-array";
import { axisBottom, axisLeft } from "d3-axis";
import { brush, D3BrushEvent } from "d3-brush";
import { schemeDark2 } from "d3-scale-chromatic";
import { format } from "d3-format";
import { line } from "d3-shape";
import { ScaleLinear, scaleLinear, scaleThreshold } from "d3-scale";
import { BaseType, select, selectAll, Selection } from "d3-selection";
import { Box } from "@mui/material";
import { RegionResult } from "@/lib/ts/types";
import { chromLengths } from "@/util/chromLengths";

const TOP_COLOR = schemeDark2[0];
const BOTTOM_COLOR = schemeDark2[1];

const className = "miami-plot";

const drawDottedLine = (
  container: Selection<SVGGElement, number, SVGElement, number>,
  cls: string,
  y: number,
  x1: number,
  x2: number
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
        .y(() => 0)([d * 10, d * 10 + 5])
    )
    .attr("stroke", "grey");
};

const showTooltip = (data: RegionResult, e: MouseEvent) => {
  select(".tooltip")
    .style("left", `${e.pageX + 15}px`)
    .style("top", `${e.pageY - 15}px`)
    .style("visibility", "visible")
    .select<HTMLUListElement>("ul")
    .selectAll<HTMLLIElement, string>("li")
    .data<string>(
      [`Chromosome: ${data.chr}`, `Start pos: ${format(",")(data.start_bp)}`],
      (d) => d
    )
    .join("li")
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
  upperRange: [number, number];
  lowerRange: [number, number];
}

const marginBottom = 25;
const yLabelMargin = 28;
const yAxisMargin = 20;
const marginLeft = yLabelMargin + yAxisMargin;
const marginTop = 25;

const buildChart = (
  bottomCol: keyof RegionResult,
  bottomThresh: number,
  data: RegionResult[],
  filter: BrushFilter | undefined,
  filterCb: (filter: BrushFilter) => void,
  height: number,
  selector: string,
  topCol: keyof RegionResult,
  topThresh: number,
  width: number
) => {
  //TODO: once the features are done, convert to object

  // get unique chromosomes, convert to string, sort asc
  const chrs = data
    .map((d) => d.chr)
    .filter((d, i, a) => (a.indexOf(d) === i ? true : false))
    .map((d) => d.toString())
    .sort((a, b) => (+a < +b ? -1 : 1));

  //make an array of the corresponding lengths
  const chrLengths = chrs.map((c) => chromLengths[c]);

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
    {}
  );

  //create a scale keyed by chromosome (for plotting)
  const chrCumSumScale = Object.entries(chrSumMapping)
    .sort((a, b) => (+a[0] > +b[0] ? 1 : -1))
    .reduce<Record<string, ScaleLinear<number, number, never>>>(
      (acc, [k, v]) => ({
        ...acc,
        [k]: scaleLinear()
          .range([allChrScale(v[0]), allChrScale(v[1])])
          .domain([0, chromLengths[k]]),
      }),
      {}
    );

  const transformedData = data.map((d) => {
    const _d = { ...d };
    _d[topCol] = -1 * Math.log10(_d[topCol]);
    _d[bottomCol] = Math.log10(_d[bottomCol]);
    return _d;
  });

  const upperData = transformedData.filter((d) => {
    const exists = !!d[topCol];
    let brushPass = true;
    if (filter) {
      brushPass =
        d[topCol] >= filter.upperRange[0] && d[topCol] <= filter.upperRange[1];
    }
    return exists && brushPass;
  });

  const lowerData = transformedData.filter((d) => {
    const exists = !!d[bottomCol];
    let brushPass = true;
    if (filter) {
      brushPass =
        d[bottomCol] <= filter.lowerRange[0] &&
        d[bottomCol] >= filter.lowerRange[1];
    }
    return exists && brushPass;
  });

  const xScale =
    chrs.length > 1
      ? scaleThreshold()
          .range(
            [marginLeft].concat(
              Object.entries(chrCumSumScale)
                .sort((a, b) => (+a[0] > +b[0] ? 1 : -1))
                .map(([_, v]) => v.range()[1])
            )
          )
          .domain(
            Object.entries(chrCumSumScale)
              .sort((a, b) => (+a[0] > +b[0] ? 1 : -1))
              .map(([k, _]) => +k)
          )
      : scaleLinear()
          .range([marginLeft, width])
          .domain(
            extent(
              upperData
                .map((d) => d.start_bp)
                .concat(lowerData.map((d) => d.start_bp))
            ) as [number, number]
          );

  const yScale = scaleLinear()
    .range([marginTop, height - marginBottom])
    .domain(
      extent([
        ...upperData.map((d) => d[topCol]),
        ...lowerData.map((d) => d[bottomCol]),
      ]).reverse() as [number, number]
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
    chrs.length > 1 ? "" : format(",")(t)
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
          const [[x0, y0], [x1, y1]] = event.selection as [
            [number, number],
            [number, number]
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

            //if both are positive, we have upper only, if both are negative, we have lower only
            const highPoint = yScale.invert(y0); // as -logp
            const lowPoint = yScale.invert(y1); // as logp

            const upperRange = [0, 0] as [number, number];
            const lowerRange = [0, 0] as [number, number];

            if (highPoint > 0) {
              upperRange[1] = highPoint;
            } else {
              lowerRange[0] = highPoint;
            }

            if (lowPoint < 0) {
              lowerRange[1] = lowPoint;
            } else {
              upperRange[0] = lowPoint;
            }

            const filter: BrushFilter = {
              x0Lim: {
                chr: chr0,
                pos: pos0,
              },
              x1Lim: {
                chr: chr1,
                pos: pos1,
              },
              upperRange,
              lowerRange,
            };

            filterCb(filter);

            event.target.clear(select(this));
          }
        }
      }
    )
  );

  circleContainer
    .selectAll("circle.upper")
    .data(upperData, (_, i) => `${i}-${topCol}`)
    .join("circle")
    .attr("class", "upper")
    .attr("r", circleWidthScale(transformedData.length))
    .attr("fill", TOP_COLOR)
    .attr("opacity", 0.5)
    .attr("cx", (d) =>
      chrs.length > 1
        ? chrCumSumScale[d.chr.toString()](d.end_bp)
        : xScale(d.end_bp)
    )
    .attr("cy", (d) => yScale(d[topCol]))
    .selection()
    .on("mouseover", (e: MouseEvent, d: RegionResult) => showTooltip(d, e))
    .on("mouseout", () => selectAll(".tooltip").style("visibility", "hidden"));

  circleContainer
    .selectAll("circle.lower")
    .data(lowerData, (_, i) => `${i}-${topCol}`)
    .join("circle")
    .attr("class", "lower")
    .attr("r", circleWidthScale(transformedData.length))
    .attr("fill", BOTTOM_COLOR)
    .attr("opacity", 0.5)
    .attr("cx", (d) =>
      chrs.length > 1
        ? chrCumSumScale[d.chr.toString()](d.end_bp)
        : xScale(d.end_bp)
    )
    .attr("cy", (d) => yScale(d[bottomCol]))
    .on("mouseover", (e: MouseEvent, d: RegionResult) => showTooltip(d, e))
    .on("mouseout", () => selectAll(".tooltip").style("visibility", "hidden"));

  drawDottedLine(
    container,
    "top-thresh",
    yScale(-Math.log10(topThresh)),
    marginLeft,
    width
  );

  drawDottedLine(
    container,
    "bottom-thresh",
    yScale(Math.log10(bottomThresh)),
    marginLeft,
    width
  );

  //append tooltip
  select("body")
    .select("div.tooltip")
    .data([1])
    .join("div")
    .attr("class", "tooltip")
    .style("z-index", 999)
    .style("position", "absolute")
    .style("background-color", "black")
    .style("font-size", "10px")
    .style("color", "white")
    .style("border-radius", "5px")
    .style("visibility", "hidden")
    .style("padding", "2px")
    .append("ul")
    .style("list-style", "none")
    .style("padding", "2px")
    .style("margin", "2px");
};

interface MiamiPlotProps {
  bottomCol: keyof RegionResult;
  bottomThresh: number;
  data: RegionResult[];
  filterCb: (filter: BrushFilter) => void;
  filter?: BrushFilter;
  topThresh: number;
  topCol: keyof RegionResult;
  width: number;
}

const MiamiPlot: React.FC<MiamiPlotProps> = ({
  bottomCol,
  bottomThresh,
  data,
  filter,
  filterCb,
  topCol,
  topThresh,
  width,
}) => {
  useLayoutEffect(() => {
    buildChart(
      bottomCol,
      bottomThresh,
      data,
      filter,
      filterCb,
      0.5 * width,
      `.${className}`,
      topCol,
      topThresh,
      width
    );
  }, [
    bottomCol,
    bottomThresh,
    data,
    filter,
    filterCb,
    topCol,
    topThresh,
    width,
  ]);

  return <Box className={className} />;
};

export default MiamiPlot;
