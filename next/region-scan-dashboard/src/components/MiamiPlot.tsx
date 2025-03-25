"use client";

import React, { useLayoutEffect } from "react";
import "d3-transition"; // must be imported before selection
import { cumsum, extent, range, sum } from "d3-array";
import { axisBottom, axisLeft } from "d3-axis";
import { line } from "d3-shape";
import { ScaleLinear, scaleLinear, scaleThreshold } from "d3-scale";
import { BaseType, select, Selection } from "d3-selection";
import { Box } from "@mui/material";
import { RegionResult } from "@/lib/ts/types";
import { chromLengths } from "@/util/chromLengths";

interface MiamiPlotProps {
  bottomCol: keyof RegionResult;
  bottomThresh: number;
  data: RegionResult[];
  topThresh: number;
  topCol: keyof RegionResult;
}

const className = "miami-plot";

const drawDottedLine = (
  svg: Selection<SVGElement, number, BaseType, unknown>,
  cls: string,
  y: number,
  x1: number,
  x2: number
) => {
  //We'll have 10px intervals for a 5px line segment and 5px gap
  const lineCount = Math.round((x2 - x1) / 10);

  svg
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

const buildChart = (
  bottomCol: keyof RegionResult,
  bottomThresh: number,
  data: RegionResult[],
  height: number,
  selector: string,
  topCol: keyof RegionResult,
  topThresh: number,
  width: number
) => {
  const marginBottom = 25;
  const yLabelMargin = 20;
  const yAxisMargin = 20;
  const marginLeft = yLabelMargin + yAxisMargin;
  const marginTop = 25;

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

  const xScale = scaleThreshold()
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
    );

  const transformedData = data
    .filter((d) => !!d[topCol] && !!d[bottomCol])
    .map((d) => {
      const _d = { ...d };
      _d[topCol] = -1 * Math.log10(_d[topCol]);
      _d[bottomCol] = Math.log10(_d[bottomCol]);
      return _d;
    });

  const yScale = scaleLinear()
    .range([marginTop, height - marginBottom])
    .domain(
      extent([
        ...transformedData.map((d) => d[bottomCol]),
        ...transformedData.map((d) => d[topCol]),
      ]).reverse() as [number, number]
    );

  const svg = select(
    select(selector)
      .selectAll<SVGElement, number>("svg")
      .data([1])
      .join("svg")
      .attr("viewBox", [0, 0, width, height])
      .attr("width", width)
      .attr("height", height)
      .attr("style", "max-width: 100%; height: auto;")
      .node()
  ) as Selection<SVGElement, number, BaseType, unknown>;

  const xAxis = svg
    .selectAll<SVGGElement, number>("g.x-axis")
    .data([1], () => allChrScale.range().toString())
    .join("g")
    .attr("class", "x-axis")
    .attr("transform", `translate(0,${height - marginBottom})`)
    .transition()
    .duration(500)
    .call(axisBottom(xScale).tickFormat(() => ""));

  const midpoints = Object.entries(chrCumSumScale)
    .sort((a, b) => (+a > +b ? 1 : -1))
    .map(([chr, scale]) => ({
      chr,
      midpoint: (scale.range()[0] + scale.range()[1]) / 2,
    }));

  xAxis
    .selection()
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
    .text((d) => `Chr ${d.chr}`);

  const yAxis = svg
    .selectAll<SVGGElement, number>("g.y-axis")
    .data([1], () => yScale.range().toString())
    .join("g")
    .attr("class", "y-axis")
    .attr("transform", `translate(${marginLeft},0)`)
    .transition()
    .duration(500)
    .call(axisLeft(yScale).tickFormat((t) => Math.abs(+t).toString()));

  // Add y axis labels

  const upperMidPoint = (yScale.range()[0] + yScale(0)) / 2;
  const lowerMidPoint = (yScale.range()[1] + yScale(0)) / 2;

  svg
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

  svg
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

  const circleContainer = svg
    .selectAll<SVGGElement, number>("g.circles")
    .data([1], () => allChrScale.range().toString())
    .join("g")
    .attr("class", "circles");

  circleContainer
    .selectAll("circle.upper")
    .data(transformedData, (_, i) => `${i}-${topCol}`)
    .join("circle")
    .attr("class", "upper")
    .attr("r", 1)
    .attr("fill", "red")
    .attr("opacity", 0.5)
    .attr("cx", (d) => chrCumSumScale[d.chr.toString()](d.end_bp))
    .attr("cy", (d) => yScale(d[topCol]));

  circleContainer
    .selectAll("circle.lower")
    .data(transformedData, (_, i) => `${i}-${topCol}`)
    .join("circle")
    .attr("class", "lower")
    .attr("r", 1)
    .attr("fill", "blue")
    .attr("opacity", 0.5)
    .attr("cx", (d) => allChrScale(d.end_bp))
    .attr("cy", (d) => yScale(d[bottomCol]));

  drawDottedLine(
    svg,
    "top-thresh",
    yScale(-Math.log10(topThresh)),
    marginLeft,
    width
  );

  drawDottedLine(
    svg,
    "bottom-thresh",
    yScale(Math.log10(bottomThresh)),
    marginLeft,
    width
  );
};

const MiamiPlot: React.FC<MiamiPlotProps> = ({
  bottomCol,
  bottomThresh,
  data,
  topCol,
  topThresh,
}) => {
  useLayoutEffect(() => {
    buildChart(
      bottomCol,
      bottomThresh,
      data,
      400,
      `.${className}`,
      topCol,
      topThresh,
      850
    );
  }, [data, bottomCol, topCol, topThresh, bottomThresh]);

  return <Box className={className} />;
};

export default MiamiPlot;
