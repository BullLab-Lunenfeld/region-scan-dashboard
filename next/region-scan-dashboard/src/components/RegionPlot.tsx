import React, { useLayoutEffect } from "react";
import { extent, groups, max, mean } from "d3-array";
import { axisBottom, axisLeft } from "d3-axis";
import { schemeSet3 } from "d3-scale-chromatic";
import { BaseType, select, Selection } from "d3-selection";
import { scaleLinear, scaleOrdinal } from "d3-scale";
import { Box } from "@mui/material";
import { RegionResult } from "@/lib/ts/types";

// TODO: upper and lower regions should have same colors as in the miami plot
// they should be the only ones activated by default
// then we can have an internal clickable legend that allows to turn on other pvals
// also need to note the clicked dot in the miami plot (just add a stroke)

interface RegionData {
  region: number;
  start: number;
  end: number;
  variable: keyof RegionResult;
  pvalue: number;
}

const regionRectHeight = 5;
const marginBottom = 35;
const yLabelMargin = 28;
const yAxisMargin = 20;
const marginLeft = yLabelMargin + yAxisMargin;
const marginTop = 25;
const marginRight = 15;

const buildChart = (
  data: RegionResult[],
  selector: string,
  var1: keyof RegionResult,
  var1Color: string,
  var2: keyof RegionResult,
  var2Color: string,
  width: number
) => {
  const height = 0.5 * width;

  const chr = data[0].chr;

  const regionData = groups(data, (d) => d.region).flatMap(
    ([region, members]) => {
      const [start, end] = extent(
        members.flatMap((m) => [m.start_bp, m.end_bp])
      ) as [number, number];

      return Object.entries(members[0])
        .filter(([k, _]) => k.toLowerCase().endsWith("_p"))
        .map(([variable, pvalue]) => ({
          region,
          start,
          end,
          variable,
          pvalue: -Math.log10(pvalue),
        })) as RegionData[];
    }
  );
  const pMean = mean(regionData.filter(Boolean).map((d) => d.pvalue)) as number;

  const xScale = scaleLinear()
    .range([marginLeft, width - marginRight])
    .domain(extent(regionData.flatMap((d) => [d.start, d.end])) as number[]);

  const regionColorScale = scaleOrdinal<string, string>()
    .range(schemeSet3)
    .domain(
      Object.entries(data[0])
        .filter(([k, _]) => k.toLowerCase().endsWith("_p"))
        .map(([k, _]) => k)
        .filter((k, i, a) => a.findIndex((d) => d === k) === i) as string[]
    );

  const getRectFill = (d: RegionData) => {
    if (d.variable === var1) {
      return var1Color;
    }
    if (d.variable === var2) {
      return var2Color;
    } else return regionColorScale(d.variable);
  };

  const getRectOpacity = (d: RegionData) => {
    if ([var1, var2].includes(d.variable)) {
      return 1;
    } else return 0.2;
  };

  const dEnd = max(regionData.map((d) => d.pvalue)) as number;

  const yScale = scaleLinear()
    .range([marginTop, height - marginBottom])
    .domain([dEnd, -0.05]);

  const svg = select(`.${selector}`)
    .selectAll<SVGElement, number>("svg")
    .data([1], () => mean(regionData.map((d) => d.pvalue)) as number)
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

  //draw region rectangles
  container
    .selectAll<SVGRectElement, RegionData>("rect.region")
    .data(regionData, (d) => d.pvalue)
    .join("rect")
    .attr("class", "region")
    //x and y are upper-left corner
    .attr("x", (d) => xScale(d.start))
    .attr("y", (d) => yScale(d.pvalue))
    .attr("fill", (d) => getRectFill(d))
    .attr("opacity", (d) => getRectOpacity(d))
    .attr("height", regionRectHeight)
    .attr("width", (d) => xScale(d.end) - xScale(d.start));

  container
    .selectAll("g.y-label")
    .data([1], () => pMean)
    .join("g")
    .attr("class", "y-label")
    .transition()
    .duration(500)
    .attr("transform", `translate(5,${height / 2})`)
    .selection()
    .selectAll("text")
    .data([1], () => pMean)
    .join("text")
    .text("-log p-value")
    .attr("font-size", 12)
    .attr("transform", "rotate(90)")
    .attr("text-anchor", "middle");

  container
    .selectAll<SVGGElement, number>("g.x-axis")
    .data([1], () => pMean)
    .join("g")
    .attr("class", "x-axis")
    .attr("transform", `translate(0,${height - marginBottom})`)
    .transition()
    .duration(500)
    .call(axisBottom(xScale).ticks(5))
    .selection();

  container
    .selectAll<SVGGElement, string>("g.x-label")
    .data([1], () => pMean)
    .join("g")
    .attr("class", "x-label")
    .attr("transform", `translate(${width / 2},${height})`)
    .selection()
    .selectAll<SVGGElement, string>("text")
    .data([1], () => pMean)
    .join("text")
    .text(`Chr${chr}`)
    .attr("font-size", 12)
    .attr("text-anchor", "middle");

  container
    .selectAll<SVGGElement, number>("g.y-axis")
    .data([1], () => pMean)
    .join("g")
    .attr("class", "y-axis")
    .attr("transform", `translate(${marginLeft},0)`)
    .transition()
    .duration(500)
    .call(axisLeft(yScale))
    .selection();
};

interface RegionPlotProps {
  data: RegionResult[];
  selector: string;
  var1: keyof RegionResult;
  var1Color: string;
  var2: keyof RegionResult;
  var2Color: string;
  width: number;
}

const RegionPlot: React.FC<RegionPlotProps> = ({
  data,
  selector,
  var1,
  var1Color,
  var2,
  var2Color,
  width,
}) => {
  useLayoutEffect(() => {
    buildChart(data, selector, var1, var1Color, var2, var2Color, width);
  }, [data, selector, var1, var1Color, var2, var2Color, width]);

  return <Box className={selector} />;
};

export default RegionPlot;
