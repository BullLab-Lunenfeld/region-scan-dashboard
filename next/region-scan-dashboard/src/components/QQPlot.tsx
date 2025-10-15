"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Box } from "@mui/material";
import { select, Selection, BaseType, selectAll } from "d3-selection";
import { groups, max, min, range } from "d3-array";
import { randomUniform } from "d3-random";
import { scaleLinear, ScaleOrdinal } from "d3-scale";
import { axisBottom, axisLeft } from "d3-axis";
import LoadingOverlay from "./LoadingOverlay";
import { RegionResult, VariantResult } from "@/lib/ts/types";
import { drawDottedLine, getEntries, showToolTip } from "@/lib/ts/util";
import useDownloadPlot from "@/lib/hooks/useDownloadPlot";
import { PlotDownloadButton } from "@/components";

interface Pval {
  region: number;
  pValType: keyof RegionResult;
  pval: number;
  chr: number;
}

const getPs = <T extends (VariantResult | RegionResult)[]>(
  data: T,
  variables: (keyof RegionResult | keyof VariantResult | "")[],
) =>
  data.flatMap((d) => {
    return getEntries(d)
      .filter(([k, v]) => variables.includes(k) && !!v)
      .flatMap(([pValType, pval]) => {
        return {
          region: d.region,
          pValType,
          chr: d.chr,
          pval,
        } as Pval;
      });
  });

const marginBottom = 40;
const yLabelMargin = 28;
const yAxisMargin = 20;
const marginLeft = yLabelMargin + yAxisMargin;
const marginTop = 25;

type PvalLineData = {
  chr: number;
  region: number;
  test: keyof RegionResult;
  x: number;
  y: number;
};

const buildChart = (
  pvalScale: ScaleOrdinal<string, string, never>,
  qqData: PvalRef,
  selector: string,
  variables: (keyof RegionResult)[],
  width: number,
) => {
  const mainWidth = width * 0.7;

  const height = mainWidth;

  let chartData: PvalLineData[] = [];

  let minP = 0;
  let minRef = 0;

  getEntries(qqData).map(([test, v]) => {
    if (variables.includes(test)) {
      chartData = chartData.concat(
        v.ref.map((r, i) => {
          const x = -Math.log10(r);
          const y = -Math.log10(v.pvals[i].pval);
          const region = v.pvals[i].region;
          const chr = v.pvals[i].chr;

          if (x > minRef) minRef = x;
          if (y > minP) minP = y;

          return {
            chr,
            region,
            test,
            x,
            y,
          };
        }),
      );
    }
  });

  const xScale = scaleLinear()
    .range([marginLeft, mainWidth])
    .domain([0, minRef]);

  //ensure that axes have the same domain
  const yScale = scaleLinear()
    .range([marginTop, height - marginBottom])
    .domain([minP, 0])
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

  container
    .selectAll<SVGCircleElement, PvalLineData>("circle.qq-data")
    .data(chartData, (d) => `${d.x}-${d.y}`)
    .join("circle")
    .attr("class", "qq-data")
    .attr("cx", (d) => xScale(d.x))
    .attr("cy", (d) => yScale(d.y))
    .attr("fill", (d) => pvalScale(d.test))
    .attr("r", 3)
    .attr("opacity", 0.6)
    .on("mouseover", (e: MouseEvent, d) =>
      showToolTip(e, [`Chr${d.chr}, Region ${d.region}`]),
    )
    .on("mouseout", () => selectAll(".tooltip").style("visibility", "hidden"));

  //we want to ensure the same precision for each axis, so we'll use the larger range as a basis
  const xDomainRange = Math.ceil(xScale.domain()[1] - xScale.domain()[0]);
  const yDomainRange = Math.ceil(yScale.domain()[0] - yScale.domain()[1]);
  const maxDomainRange = max([xDomainRange, yDomainRange]) as number;

  const tickType = maxDomainRange > 4 ? "integer" : "decimal";

  const formatter = tickType === "integer" ? "d" : ".1";

  container
    .selectAll<SVGGElement, number>("g.x-axis")
    .data([1], () => xScale.range().toString())
    .join("g")
    .attr("class", "x-axis")
    .attr("transform", `translate(0,${height - marginBottom})`)
    .transition()
    .duration(500)
    .call(
      axisBottom(xScale).ticks(
        xDomainRange < 10 ? xDomainRange : 10,
        formatter,
      ),
    )
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
    .text(`Uniform dist (-log10(p))`)
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
    .call(
      axisLeft(yScale).ticks(yDomainRange < 10 ? yDomainRange : 10, formatter),
    )
    .selection();

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
    .text("-log10(p)")
    .attr("transform", "rotate(-90)")
    .attr("font-size", "12px")
    .attr("text-anchor", "middle");

  container
    .selectAll("text.title")
    .data([1])
    .join("text")
    .attr("class", "title")
    .attr("font-size", "16px")
    .text("QQ Plot")
    .attr("transform", `translate(${mainWidth / 2}, 12)`);

  drawDottedLine(
    container,
    "true-line",
    yScale.range()[1],
    yScale(xScale.domain()[1]),
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

type PvalRef = Record<
  keyof RegionResult,
  { ref: number[]; pvals: { pval: number; region: number; chr: number }[] }
>;

interface QQPlotProps {
  regionData: RegionResult[];
  variantData: VariantResult[];
  pvalScale: ScaleOrdinal<string, string, never>;
  selector: string;
  variables: (keyof RegionResult | keyof VariantResult | "")[];
  visibleVariables: (keyof RegionResult | keyof VariantResult | "")[];
  width: number;
}

const QQPlot: React.FC<QQPlotProps> = ({
  pvalScale,
  regionData,
  variantData,
  selector,
  variables,
  visibleVariables,
  width,
}) => {
  const [loading, setLoading] = useState(true);

  //we need a full tick and render to show the initial loading indicator
  const [renderFlag, setRenderFlag] = useState(false);

  const { anchorEl, handlePopoverOpen } = useDownloadPlot();

  const pvals = useMemo(() => {
    const ps = getPs(regionData, variables).concat(
      getPs(variantData, variables),
    );

    return ps;
  }, [variables, variantData, regionData]);

  //we want to wait a tick so we can show the loading indicator while calculating these
  useEffect(() => {
    setTimeout(() => setRenderFlag(true));
  }, []);

  //we'll precompute the reference dist since it can take a while
  const qqData: PvalRef | null = useMemo(() => {
    if (renderFlag) {
      const grouped = groups(pvals, (p) => p.pValType);

      const pvalRefs = {} as PvalRef;

      for (let i = 0; i < grouped.length; i++) {
        const [key, vals] = grouped[i];
        const pvals = vals
          .map(({ region, pval, chr }) => ({ region, pval, chr }))
          .sort((a, b) => (a.pval < b.pval ? -1 : 1));
        const rv = randomUniform(
          min(pvals.map((v) => v.pval)) as number,
          max(pvals.map((v) => v.pval)) as number,
        );
        const ref = range(pvals.length)
          .map(() => rv())
          .sort((a, b) => (a < b ? -1 : 1));

        pvalRefs[key] = {
          ref,
          pvals,
        };
      }
      setLoading(false);
      return pvalRefs;
    } else {
      return null;
    }
  }, [pvals, renderFlag]);

  useEffect(() => {
    if (!!qqData) {
      buildChart(
        pvalScale,
        qqData,
        selector,
        visibleVariables.filter(Boolean) as (keyof RegionResult)[],
        width,
      );
    }
  }, [pvalScale, pvals, qqData, selector, visibleVariables, width, renderFlag]);

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
