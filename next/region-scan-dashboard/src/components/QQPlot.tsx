"use client";

import React, { useContext, useEffect, useMemo, useState } from "react";
import { Box } from "@mui/material";
import { select, Selection, BaseType } from "d3-selection";
import { groups, quantile, range, extent, min, max } from "d3-array";
import { line } from "d3-shape";
import { randomUniform } from "d3-random";
import { scaleLinear, ScaleOrdinal } from "d3-scale";
import { axisBottom, axisLeft } from "d3-axis";
import LoadingOverlay from "./LoadingOverlay";
import { VisualizationDataContext } from "./AppContainer";
import { RegionResult, VariantResult } from "@/lib/ts/types";
import { drawDottedLine, getEntries, makePvalAxisLabel } from "@/lib/ts/util";
import useDownloadPlot from "@/lib/hooks/useDownloadPlot";
import { PlotDownloadButton } from "@/components";

const marginBottom = 40;
const yLabelMargin = 28;
const yAxisMargin = 20;
const marginLeft = yLabelMargin + yAxisMargin;
const marginTop = 25;

const getQuantiles = (data: number[], qcount: number) => {
  if (qcount > data.length) {
    throw "Data cannot be longer than qcount";
  }

  const step = 100 / qcount;

  return range(qcount - 1).map((d) =>
    quantile(data, (d + 1) * 0.01 * step),
  ) as number[];
};

type PvalLineData = {
  test: keyof RegionResult;
  x: number;
  y: number;
};

const buildChart = (
  pvalScale: ScaleOrdinal<string, string, never>,
  quantiles: QuantileResults,
  selector: string,
  variables: (keyof RegionResult)[],
  width: number,
  transformPValue: (pval: number) => number,
) => {
  const mainWidth = width * 0.7;

  const height = 0.75 * mainWidth;

  const chartData: PvalLineData[][] = [];

  getEntries(quantiles).map(([k, v]) => {
    if (variables.includes(k)) {
      chartData.push(
        v.ref.map((r, i) => ({
          test: k,
          x: transformPValue(r),
          y: transformPValue(v.quan[i]),
        })),
      );
    }
  });

  const xScale = scaleLinear()
    .range([marginLeft, mainWidth])
    .domain(extent(chartData.flat().map((d) => d.x)) as [number, number]);

  const yScale = scaleLinear()
    .range([marginTop, height - marginBottom])
    .domain(extent(chartData.flat().map((c) => c.y)).reverse() as number[])
    .clamp(true);

  const svg = select(`.${selector}`)
    .selectAll<SVGElement, number>("svg")
    .data([1])
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

  const qLine = line<PvalLineData>()
    .x((d) => xScale(d.x))
    .y((d) => yScale(d.y));

  container
    .selectAll("path.line")
    .data(chartData)
    .join("path")
    .attr("class", "line")
    .attr("d", (d) => qLine(d))
    .attr("stroke", (d) => pvalScale(d[0].test))
    .attr("stroke-width", 3)
    .style("fill", "none")
    .attr("opacity", 0.6);

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
    .selectAll<SVGGElement, string>("g.x-label")
    .data([0])
    .join("g")
    .attr("class", "x-label")
    .attr("transform", `translate(${mainWidth / 2},${height - 5})`)
    .selection()
    .selectAll<SVGGElement, string>("text")
    .data([1])
    .join("text")
    .text(`Uniform dist (${makePvalAxisLabel(transformPValue)})`)
    .attr("font-size", "12px")
    .attr("text-anchor", "middle");

  container
    .selectAll("g.y-label")
    .data([0])
    .join("g")
    .attr("class", "y-label")
    .transition()
    .duration(500)
    .attr("transform", `translate(15,${height / 2})`)
    .selection()
    .selectAll("text")
    .data(["pValue"])
    .join("text")
    .text(makePvalAxisLabel(transformPValue))
    .attr("transform", "rotate(-90)")
    .attr("font-size", "12px")
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

  container
    .selectAll("text.title")
    .data([1])
    .join("text")
    .attr("class", "title")
    .text("QQ Plot")
    .attr("transform", `translate(${mainWidth / 2}, 12)`);

  drawDottedLine(
    container,
    "true-line",
    yScale.range()[1],
    yScale.range()[0],
    xScale.range()[0],
    xScale.range()[1],
  );

  const legendContainer = container
    .selectAll("g.legend")
    .data([1])
    .join("g")
    .attr("class", "legend")
    .attr("transform", `translate(${mainWidth + 12},${marginTop})`);

  legendContainer
    .selectAll("rect")
    .data(variables)
    .join("rect")
    .attr("width", 10)
    .attr("height", 10)
    .attr("x", 0)
    .attr("y", (_, i) => 5 + i * 18)
    .attr("fill", (d) => pvalScale(d));

  legendContainer
    .selectAll("text")
    .data(variables)
    .join("text")
    .text((d) => d)
    .attr("text-anchor", "right")
    .attr("transform", (_, i) => `translate(15,${16 + i * 18})`);
};

interface DisplayPVal {
  pValType: keyof RegionResult;
  value: number;
}

type QuantileResults = Record<
  keyof RegionResult,
  { ref: number[]; quan: number[] }
>;

interface QQPlotProps {
  data: (RegionResult | VariantResult)[];
  pvalScale: ScaleOrdinal<string, string, never>;
  selector: string;
  variables: (keyof RegionResult | keyof VariantResult | "")[];
  visibleVariables: (keyof RegionResult | keyof VariantResult | "")[];
  width: number;
}

const QQPlot: React.FC<QQPlotProps> = ({
  data,
  pvalScale,
  selector,
  variables,
  visibleVariables,
  width,
}) => {
  const [loading, setLoading] = useState(true);

  //we need a full tick and render to show the initial loading indicator
  const [renderFlag, setRenderFlag] = useState(false);

  const { anchorEl, handlePopoverOpen } = useDownloadPlot();

  const { transformPValue } = useContext(VisualizationDataContext);

  const pvals = useMemo(
    () =>
      data.flatMap((d) =>
        getEntries(d)
          .filter(([k, v]) => !!v && variables.includes(k))
          .map(([k, v]) => ({ pValType: k, value: v }) as DisplayPVal),
      ),

    [variables, data],
  );

  //we want to wait a tick so we can show the loading indicator while calculating these
  useEffect(() => {
    setTimeout(() => setRenderFlag(true));
  }, []);

  //we'll precompute these since they take a while
  const quantiles: QuantileResults | undefined = useMemo(() => {
    if (renderFlag) {
      const grouped = groups(pvals, (p) => p.pValType);

      const quantileResults = {} as QuantileResults;

      for (let i = 0; i < grouped.length; i++) {
        const [key, vals] = grouped[i];
        const pvals = vals.map((v) => v.value).sort((a, b) => (a < b ? -1 : 1));
        const quantiles = getQuantiles(
          pvals,
          min([250, vals.length]) as number,
        );
        const rv = randomUniform(max(pvals));
        const refDist = range(vals.length).map(() => rv());
        //const refDist = range(1000).map(() => rv());
        //const refDist = linspace(0, max(pvals) as number, 250);

        const refQuantiles = getQuantiles(
          refDist,
          min([250, vals.length]) as number,
        );

        quantileResults[key] = {
          ref: refQuantiles,
          quan: quantiles,
        };
      }
      setLoading(false);
      return quantileResults;
    }
  }, [pvals, renderFlag]);

  useEffect(() => {
    if (!!quantiles) {
      buildChart(
        pvalScale,
        quantiles,
        selector,
        visibleVariables.filter(Boolean) as (keyof RegionResult)[],
        width,
        transformPValue,
      );
    }
  }, [
    pvalScale,
    pvals,
    quantiles,
    selector,
    visibleVariables,
    width,
    renderFlag,
    transformPValue,
  ]);

  return (
    <>
      <Box className={selector} onMouseEnter={handlePopoverOpen} />
      <LoadingOverlay open={loading} />
      <PlotDownloadButton
        anchorEl={anchorEl}
        plotType="QQ Plot"
        selector={`.${selector}`}
      />
    </>
  );
};

export default QQPlot;
