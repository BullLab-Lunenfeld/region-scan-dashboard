import React, { useLayoutEffect, useState } from "react";
import { extent, groups, max } from "d3-array";
import { axisBottom, axisLeft } from "d3-axis";
import { schemeSet3 } from "d3-scale-chromatic";
import { BaseType, select, selectAll, Selection } from "d3-selection";
import { scaleLinear, ScaleOrdinal, scaleOrdinal } from "d3-scale";
import { Box } from "@mui/material";
import { RegionResult } from "@/lib/ts/types";
import { format } from "d3-format";

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

//need this as a class so that we can store the active variables
class RegionChart {
  selector: string;
  var1: keyof RegionResult;
  var1Color: string;
  var2: keyof RegionResult;
  var2Color: string;
  width: number;
  activeVariables: (keyof RegionResult)[];
  mainWidth: number;
  height: number;
  legendWidth: number;
  container: Selection<SVGGElement, number, SVGElement, unknown>;

  constructor(
    selector: string,
    var1: keyof RegionResult,
    var1Color: string,
    var2: keyof RegionResult,
    var2Color: string,
    width: number
  ) {
    //display properties
    this.selector = selector;
    this.var1 = var1;
    this.var1Color = var1Color;
    this.var2 = var2;
    this.var2Color = var2Color;
    this.width = width;
    this.activeVariables = [var1, var2];
    this.mainWidth = 0.75 * width;
    this.height = 0.5 * width;
    this.legendWidth = 0.25 * width;

    const svg = select(`.${this.selector}`)
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

    this.container = svg
      .selectAll<SVGGElement, number>("g.container")
      .data([1])
      .join("g")
      .attr("class", "container");
  }

  remove = () => this.container.selectChildren().remove();

  updateActiveVariables = (variables: (keyof RegionResult)[]) =>
    (this.activeVariables = variables);

  getRectFill = (
    variable: keyof RegionResult,
    regionColorScale: ScaleOrdinal<string, string, never>
  ) => {
    if (variable === this.var1) {
      return this.var1Color;
    }
    if (variable === this.var2) {
      return this.var2Color;
    } else return regionColorScale(variable);
  };

  getRectOpacity = (variable: keyof RegionResult) => {
    if (this.activeVariables.includes(variable)) {
      return 1;
    } else return 0.4;
  };

  showTooltip = (data: RegionData, e: MouseEvent) => {
    select(".tooltip")
      .style("left", `${e.pageX + 15}px`)
      .style("top", `${e.pageY - 15}px`)
      .style("visibility", "visible")
      .select<HTMLUListElement>("ul")
      .selectAll<HTMLLIElement, string>("li")
      .data<string>(
        [
          `Variable: ${data.variable}`,
          `Region: ${data.region}`,
          `Start pos: ${format(",")(data.start)}`,
          `End pos: ${format(",")(data.end)}`,
          `Pval: ${data.pvalue}`,
        ],
        (d) => d
      )
      .join("li")
      .style("font-size", "15px")
      .text((d) => d);
  };

  render = (data: RegionResult[]) => {
    // ensure miami plot variables are rendered first
    const variables = [this.var1, this.var2].concat(
      Object.keys(data[0]).filter(
        (k) =>
          ![this.var1, this.var2].includes(k as keyof RegionResult) &&
          k.toLowerCase().endsWith("_p")
      ) as (keyof RegionResult)[]
    );

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

    const xScale = scaleLinear()
      .range([marginLeft, this.mainWidth - marginRight])
      .domain(extent(regionData.flatMap((d) => [d.start, d.end])) as number[]);

    //updatabale, goes in render method, along with legend, or at least has its own
    const regionColorScale = scaleOrdinal<string, string>()
      .range(schemeSet3)
      .domain(
        Object.entries(data[0])
          .filter(([k, _]) => k.toLowerCase().endsWith("_p"))
          .map(([k, _]) => k)
          .filter((k, i, a) => a.findIndex((d) => d === k) === i) as string[]
      );

    const yScale = scaleLinear()
      .range([marginTop, this.height - marginBottom])
      .domain([max(regionData.map((d) => d.pvalue)) as number, -0.05]);
    //draw region rectangles
    this.container
      .selectAll<SVGRectElement, RegionData>("rect.region")
      .data(regionData, (d) => d.pvalue)
      .join("rect")
      .attr("class", "region")
      //x and y are upper-left corner
      .attr("x", (d) => xScale(d.start))
      .attr("y", (d) => yScale(d.pvalue))
      .attr("fill", (d) => this.getRectFill(d.variable, regionColorScale))
      .attr("opacity", (d) => this.getRectOpacity(d.variable))
      .attr("height", regionRectHeight)
      .attr("width", (d) => xScale(d.end) - xScale(d.start))
      .on("mouseover", (e: MouseEvent, d: RegionData) => this.showTooltip(d, e))
      .on("mouseout", () =>
        selectAll(".tooltip").style("visibility", "hidden")
      );

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
      .selectAll<SVGGElement, number>("g.x-axis")
      .data([1])
      .join("g")
      .attr("class", "x-axis")
      .attr("transform", `translate(0,${this.height - marginBottom})`)
      .transition()
      .duration(500)
      .call(axisBottom(xScale).ticks(5))
      .selection();

    this.container
      .selectAll<SVGGElement, string>("g.x-label")
      .data([1])
      .join("g")
      .attr("class", "x-label")
      .attr("transform", `translate(${this.mainWidth / 2},${this.height})`)
      .selection()
      .selectAll<SVGGElement, string>("text")
      .data([1])
      .join("text")
      .text(`Chr${chr}`)
      .attr("font-size", 12)
      .attr("text-anchor", "middle");

    this.container
      .selectAll<SVGGElement, number>("g.y-axis")
      .data([1])
      .join("g")
      .attr("class", "y-axis")
      .attr("transform", `translate(${marginLeft},0)`)
      .transition()
      .duration(500)
      .call(axisLeft(yScale))
      .selection();

    const legendContainer = this.container
      .selectAll("g.legend")
      .data([1])
      .join("g")
      .attr("class", "legend")
      .attr("transform", `translate(${this.mainWidth + 5},0)`);

    legendContainer
      .selectAll("rect")
      .data(variables)
      .join("rect")
      .attr("width", 10)
      .attr("height", 10)
      .attr("x", 0)
      .attr("y", (_, i) => 5 + i * 18)
      .attr("fill", (d) => this.getRectFill(d, regionColorScale))
      .attr("opacity", (d) => this.getRectOpacity(d))
      .on("click", (e: MouseEvent, d) => {
        if (this.activeVariables.includes(d)) {
          this.activeVariables = this.activeVariables.filter((a) => a !== d);
        } else {
          this.activeVariables = this.activeVariables.concat(d);
        }
        this.render(data);
      });

    legendContainer
      .selectAll("text")
      .data(variables)
      .join("text")
      .text((d) => d)
      .attr("text-anchor", "right")
      .attr("transform", (_, i) => `translate(15,${16 + i * 18})`);
  };
}

interface RegionPlotProps {
  data: RegionResult[];
  selectedDatum?: RegionResult;
  selector: string;
  var1: keyof RegionResult;
  var1Color: string;
  var2: keyof RegionResult;
  var2Color: string;
  width: number;
}

const RegionPlot: React.FC<RegionPlotProps> = ({
  data,
  selectedDatum,
  selector,
  var1,
  var1Color,
  var2,
  var2Color,
  width,
}) => {
  const [chart, setChart] = useState<RegionChart>();

  useLayoutEffect(() => {
    if (chart) {
      chart.remove();
    }
    if (selectedDatum) {
      const Chart = new RegionChart(
        selector,
        var1,
        var1Color,
        var2,
        var2Color,
        width
      );
      Chart.render(data);
      setChart(Chart);
    }
  }, [selectedDatum]);

  return <Box className={selector} />;
};

export default RegionPlot;
