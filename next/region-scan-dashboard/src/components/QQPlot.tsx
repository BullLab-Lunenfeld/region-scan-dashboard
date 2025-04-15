"use client";

import React, { useLayoutEffect } from "react";
import { Box } from "@mui/material";
import { select, Selection, BaseType } from "d3-selection";
import { quantile, range, zip, extent, min, max } from "d3-array";
import { randomUniform } from "d3-random";
import { scaleLinear } from "d3-scale";
import { axisBottom, axisLeft } from "d3-axis";

const marginBottom = 30;
const yLabelMargin = 28;
const yAxisMargin = 20;
const marginLeft = yLabelMargin + yAxisMargin;
const marginTop = 25;
const marginRight = 15;

const getQuartiles = (data: number[], qcount: number = 25) => {
  if (qcount > data.length) {
    throw "Data cannot be longer than qcount";
  }

  const step = 100 / qcount;

  return range(qcount - 1).map((d) =>
    quantile(data, (d + 1) * 0.01 * step)
  ) as number[];
};

const buildChart = (
  color: string,
  pvals: number[],
  selector: string,
  variable: string,
  width: number
) => {
  const height = 0.5 * width;

  const filteredPvals = pvals.filter(Boolean).sort();

  const pvalQuartiles = getQuartiles(
    filteredPvals,
    min([250, filteredPvals.length])
  );

  const rv = randomUniform(max(filteredPvals));

  const refDist = range(2000).map(() => rv());

  const refQuartiles = getQuartiles(refDist, min([250, pvalQuartiles.length]));
  const chartData = zip(refQuartiles, pvalQuartiles) as number[][];

  const xScale = scaleLinear()
    .range([marginLeft, width - marginRight])
    .domain(extent(refQuartiles) as number[]);

  const yScale = scaleLinear()
    .range([marginTop, height - marginBottom])
    .domain(extent(pvalQuartiles).reverse() as number[]);

  const svg = select(`.${selector}`)
    .selectAll<SVGElement, number>("svg")
    .data([1], () => filteredPvals.toString())
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

  container
    .selectAll<SVGCircleElement, number[]>("circle")
    .data<number[]>(chartData, (d: number[]) => d[0])
    .join("circle")
    .attr("class", "upper")
    .attr("r", 3)
    .attr("fill", color)
    .attr("opacity", 0.5)
    .attr("cx", (d) => xScale(d[0]))
    .attr("cy", (d) => yScale(d[1]));

  container
    .selectAll<SVGGElement, number>("g.x-axis")
    .data([1], () => xScale.range().toString())
    .join("g")
    .attr("class", "x-axis")
    .attr("transform", `translate(0,${height - marginBottom})`)
    .transition()
    .duration(500)
    .call(axisBottom(xScale))
    .selection();

  container
    .selectAll("g.y-label")
    .data([variable])
    .join("g")
    .attr("class", "y-label")
    .transition()
    .duration(500)
    .attr("transform", `translate(5,${height / 2})`)
    .selection()
    .selectAll("text")
    .data([variable])
    .join("text")
    .text(variable)
    .attr("font-size", 12)
    .attr("transform", "rotate(90)")
    .attr("text-anchor", "middle");

  container
    .selectAll<SVGGElement, string>("g.x-label")
    .data([variable], (d) => d)
    .join("g")
    .attr("class", "x-label")
    .attr("transform", `translate(${width / 2},${height})`)
    .selection()
    .selectAll<SVGGElement, string>("text")
    .data([1], (d) => d)
    .join("text")
    .text("Uniform dist")
    .attr("font-size", 12)
    .attr("text-anchor", "middle");

  container
    .selectAll<SVGGElement, number>("g.y-axis")
    .data([1], () => yScale.range().toString())
    .join("g")
    .attr("class", "y-axis")
    .attr("transform", `translate(${marginLeft},0)`)
    .transition()
    .duration(500)
    .call(axisLeft(yScale))
    .selection();
};

interface QQPlotProps {
  color: string;
  pvals: number[];
  selector: string;
  variable: string;
  width: number;
}

const QQPlot: React.FC<QQPlotProps> = ({
  color,
  pvals,
  selector,
  variable,
  width,
}) => {
  useLayoutEffect(() => {
    buildChart(color, pvals, selector, variable, width);
  }, [color, pvals, selector, variable, width]);

  return <Box className={selector} />;
};

export default QQPlot;
