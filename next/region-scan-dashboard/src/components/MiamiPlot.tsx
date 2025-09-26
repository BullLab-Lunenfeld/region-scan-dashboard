"use client";

import React, { useContext, useEffect, useMemo, useState } from "react";
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
import { VisualizationDataContext } from "./AppContainer";
import { LoadingOverlay, PlotDownloadButton } from "@/components";
import {
  AssembyInfo,
  isRegionResult,
  RegionResult,
  SelectedRegionDetailData,
  VariantResult,
} from "@/lib/ts/types";
import {
  drawDottedLine,
  formatComma,
  getEntries,
  makePvalAxisLabel,
  showToolTip,
} from "@/lib/ts/util";
import useDownloadPlot from "@/lib/hooks/useDownloadPlot";

const className = "miami-plot";

const getVariantOrRegionLocation = (datum: VariantResult | RegionResult) => {
  if (isRegionResult(datum)) {
    return (datum.end_bp + datum.start_bp) / 2;
  } else {
    return datum.bp;
  }
};

const showMiamiTooltip = (d: VariantResult | RegionResult, e: MouseEvent) => {
  const sharedText = [`Region: ${d.region}`, `Chr: ${d.chr}`];

  const regionText = [
    `Start: ${formatComma(d.start_bp)}`,
    `End: ${formatComma(d.end_bp)}`,
  ];

  const varText = [
    `Pos: ${formatComma((d as VariantResult).bp)}`,
    `Mglm_p: ${format(".5")((d as VariantResult).mglm_pvalue)}`,
    `Variant: ${(d as VariantResult).variant}`,
  ];

  const text = isRegionResult(d)
    ? sharedText.concat(regionText)
    : sharedText.concat(varText);

  return showToolTip(e, text);
};

const getPVal = (
  key: keyof VariantResult | keyof RegionResult,
  obj: VariantResult | RegionResult,
) => {
  const val = isRegionResult(obj)
    ? obj[key as keyof RegionResult]
    : obj[key as keyof VariantResult];

  return typeof val === "string" ? +val : val;
};

const circleWidthScale = scaleLinear()
  .range([3, 5])
  .domain([20000, 1])
  .clamp(true);

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

const legendSpace = 20;
const marginMiddle = 20;
const marginBottom = 25;
const marginRight = 20;
const yLabelMargin = 28;
const yAxisMargin = 20;
const marginLeft = yLabelMargin + yAxisMargin;
const marginTop = 25;

const buildChart = (
  assemblyInfo: AssembyInfo,
  bottomCol: keyof RegionResult | keyof VariantResult,
  _bottomThresh: number,
  data: (RegionResult | VariantResult)[],
  filterCb: (filter: BrushFilter) => void,
  height: number,
  onCircleClick: (d: RegionResult | VariantResult) => void,
  pvalScale: ScaleOrdinal<string, string, never>,
  selector: string,
  topCol: keyof RegionResult | keyof VariantResult,
  _topThresh: number,
  width: number,
  transformPval: (pval: number) => number,
  selectedRegionDetailData?: SelectedRegionDetailData,
) => {
  const topThresh = transformPval(_topThresh);
  const bottomThresh = transformPval(_bottomThresh);

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
    .range([marginLeft, width - marginRight])
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

  const transformedData = data
    .filter(
      (d) =>
        !!new Set(Object.keys(d)).intersection(new Set([topCol, bottomCol]))
          .size,
    )
    .map((d) =>
      Object.fromEntries(
        getEntries(d)
          .filter(([, v]) => !!v)
          .map(([k, v]) => {
            if ([topCol, bottomCol].includes(k)) {
              return [k, transformPval(v)];
            } else {
              return [k, v];
            }
          }),
      ),
    ) as unknown as (RegionResult | VariantResult)[];

  const circleRadius = circleWidthScale(transformedData.length);

  //create a scale keyed by chromosome (for plotting)
  const chrCumSumScale = Object.entries(chrSumMapping)
    .sort((a, b) => (+a[0] > +b[0] ? 1 : -1))
    .reduce<Record<string, ScaleLinear<number, number, never>>>(
      (acc, [k, v]) => ({
        ...acc,
        [k]: scaleLinear()
          .range([
            allChrScale(v[0]) + circleRadius * 1.5,
            allChrScale(v[1]) - circleRadius * 1.5,
          ])
          .domain([0, assemblyInfo.lengths[k]]),
      }),
      {},
    );

  const upperData = transformedData.filter((d) => Object.hasOwn(d, topCol));

  const lowerData = transformedData.filter((d) => Object.hasOwn(d, bottomCol));

  const singleChrXScale = scaleLinear()
    .range([marginLeft, width - marginRight])
    .domain(
      extent(
        upperData
          .flatMap((d) => [d.start_bp, d.end_bp])
          .concat(lowerData.flatMap((d) => [d.start_bp, d.end_bp])),
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

  const yScaleLower = scaleLinear()
    .range([
      marginTop + height / 2 + marginMiddle,
      height - marginBottom - legendSpace,
    ])
    .domain(
      extent(lowerData.map((d) => getPVal(bottomCol, d)) as number[]) as [
        number,
        number,
      ],
    );

  const yScaleUpper = scaleLinear()
    .range([marginTop, height / 2 - marginMiddle])
    .domain(
      extent(
        upperData.map((d) => getPVal(topCol, d)) as number[],
      ).reverse() as [number, number],
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
    .tickFormat((t) => (chrs.length > 1 ? "" : formatComma(t)))
    .tickSize(3)
    .ticks(chrs.length > 1 ? chrs.length : 7);

  const xAxisSelection = container
    .selectAll<SVGGElement, number>("g.x-axis")
    .data([1], () => xAxisScale.range().toString())
    .join("g")
    .attr("class", "x-axis")
    .attr("transform", `translate(0,${height / 2})`)
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
    .text((d) => (chrs.length > 1 ? `Chr ${d.chr}` : ""))
    .attr(
      "transform",
      Object.values(chrCumSumScale).filter(
        (s) => s.range()[1] - s.range()[0] < 50,
      ).length
        ? "rotate(90) translate(6,0)"
        : "",
    );

  const yAxisUpper = axisLeft(yScaleUpper)
    .tickFormat((t) => (+t).toString())
    .ticks(7);

  const yAxisLower = axisLeft(yScaleLower)
    .tickFormat((t) => (+t).toString())
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

  const upperMidPoint = (yScaleUpper.range()[0] + yScaleUpper.range()[1]) / 2;
  const lowerMidPoint = (yScaleLower.range()[0] + yScaleLower.range()[1]) / 2;

  container
    .selectAll("g.y-upper-label")
    .data([1])
    .join("g")
    .attr("class", "y-upper-label")
    .transition()
    .duration(500)
    .attr("transform", `translate(20,${upperMidPoint})`)
    .selection()
    .selectAll("text")
    .data([1])
    .join("text")
    .text(makePvalAxisLabel(transformPval))
    .attr("transform", "rotate(-90)")
    .attr("font-size", "12px")
    .attr("text-anchor", "middle");

  container
    .selectAll("g.y-lower-label")
    .data([1])
    .join("g")
    .attr("class", "y-lower-label")
    .transition()
    .duration(500)
    .attr("transform", `translate(20,${lowerMidPoint})`)
    .selection()
    .selectAll("text")
    .data([1])
    .join("text")
    .text(makePvalAxisLabel(transformPval))
    .attr("transform", "rotate(-90)")
    .attr("font-size", "12px")
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
    .attr("height", height - marginBottom - marginTop - legendSpace)
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
        [width - marginRight, height - marginBottom - legendSpace],
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

            const pos0Scale = getPlottingXScale(chr0);
            const pos0 = pos0Scale.invert(x0);
            const pos1Scale = getPlottingXScale(chr1);
            const pos1 = pos1Scale.invert(x1);

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

  const circleDataUpper: (VariantResult | RegionResult)[] = [];
  const circleDataLower: (VariantResult | RegionResult)[] = [];
  const diamondDataUpper: (VariantResult | RegionResult)[] = [];
  const diamondDataLower: (VariantResult | RegionResult)[] = [];

  upperData.forEach((d) => {
    const pval = getPVal(topCol, d);
    if (!!pval) {
      if (pval < topThresh) {
        circleDataUpper.push(d);
      } else {
        diamondDataUpper.push(d);
      }
    }
  });

  lowerData.forEach((d) => {
    const pval = getPVal(bottomCol, d);
    if (!!pval) {
      if (pval < bottomThresh) {
        circleDataLower.push(d);
      } else {
        diamondDataLower.push(d);
      }
    }
  });

  circleContainer
    .selectAll<SVGCircleElement, RegionResult>("circle.upper")
    .data(circleDataUpper)
    .join("circle")
    .attr("class", "upper")
    .attr("r", circleRadius)
    .attr("fill", pvalScale(topCol))
    .attr("opacity", 0.5)
    .attr("cx", (d) =>
      getPlottingXScale(d.chr.toString())(getVariantOrRegionLocation(d)),
    )
    .attr("cy", (d) => yScaleUpper(getPVal(topCol, d)!));

  circleContainer
    .selectAll("circle.lower")
    .data(circleDataLower)
    .join("circle")
    .attr("class", "lower")
    .attr("r", circleRadius)
    .attr("fill", pvalScale(bottomCol))
    .attr("opacity", 0.5)
    .attr("cx", (d) =>
      getPlottingXScale(d.chr.toString())(getVariantOrRegionLocation(d)),
    )
    .attr("cy", (d) => yScaleLower(getPVal(bottomCol, d)!));

  //diamonds
  circleContainer
    .selectAll<SVGPathElement, RegionResult>("path.upper")
    .data(diamondDataUpper)
    .join("path")
    .attr("class", "upper")
    .attr("d", symbol(symbolDiamond, circleRadius * 15))
    .attr("opacity", 0.5)
    .attr("fill", pvalScale(topCol))
    .attr(
      "transform",
      (d) =>
        `translate(${getPlottingXScale(d.chr.toString())(
          getVariantOrRegionLocation(d),
        )}, ${yScaleUpper(getPVal(topCol, d) as number)})`,
    );

  circleContainer
    .selectAll("path.lower")
    .data(diamondDataLower)
    .join("path")
    .attr("class", "lower")
    .attr("opacity", 0.5)
    .attr("d", symbol(symbolDiamond, circleRadius * 15))
    .attr("fill", pvalScale(bottomCol))
    .attr(
      "transform",
      (d) =>
        `translate(${getPlottingXScale(d.chr.toString())(
          getVariantOrRegionLocation(d),
        )}, ${yScaleLower(getPVal(bottomCol, d) as number)})`,
    );

  circleContainer
    .selectAll<BaseType, RegionResult>("circle, path")
    .on("click", (_, d: RegionResult) => onCircleClick(d))
    .on("mouseover", (e: MouseEvent, d: RegionResult) => showMiamiTooltip(d, e))
    .on("mouseout", () => selectAll(".tooltip").style("visibility", "hidden"));

  container
    .selectAll("g.legend")
    .data([1])
    .join("g")
    .attr("class", "legend")
    .selectAll<SVGGElement, string>("g.legend-item")
    //we'll just force a redraw rather than doing all the enters and joins
    .data([topCol, bottomCol], () => Math.random().toString(36).slice(2))
    .join("g")
    .attr("class", "legend-item")
    .each(function (d, i) {
      const item = select(this);
      const textOffset = i === 0 ? -100 : 100;
      item
        .attr(
          "transform",
          `translate(${width / 2 + textOffset}, ${height - legendSpace})`,
        )
        .append("circle")
        .attr("cx", -7)
        .attr("cy", -5)
        .attr("r", 5)
        .attr("fill", pvalScale(d));

      item.append("text").text(d);
    });

  drawDottedLine(
    container,
    "top-thresh",
    yScaleUpper(topThresh),
    yScaleUpper(topThresh),
    marginLeft,
    width - marginRight,
  );

  drawDottedLine(
    container,
    "bottom-thresh",
    yScaleLower(bottomThresh),
    yScaleLower(bottomThresh),
    marginLeft,
    width - marginRight,
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
    .style("background-color", "#262727")
    .style("opacity", 0.9)
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
  bottomCol: keyof RegionResult | keyof VariantResult;
  data: (RegionResult | VariantResult)[];
  filterCb: (filter: BrushFilter) => void;
  filter?: BrushFilter;
  onCircleClick: (d: RegionResult | VariantResult) => void;
  pvalScale: ScaleOrdinal<string, string, never>;
  selectedRegionDetailData?: SelectedRegionDetailData;
  topCol: keyof RegionResult | keyof VariantResult;
  width: number;
}

const MiamiPlot: React.FC<MiamiPlotProps> = ({
  assemblyInfo,
  bottomCol,
  data,
  filter,
  filterCb,
  onCircleClick,
  pvalScale,
  selectedRegionDetailData,
  topCol,
  width,
}) => {
  const [loading, setLoading] = useState(true);

  //we need a full tick and render to show the loading indicator
  const [renderFlag, setRenderFlag] = useState(false);

  const { anchorEl, handlePopoverOpen } = useDownloadPlot();

  const _width = useMemo(() => width, [width]);

  useEffect(() => {
    setTimeout(() => setRenderFlag(true));
  }, []);

  const {
    thresholds: { miamiTop: topThresh, miamiBottom: bottomThresh },
    transformPValue,
  } = useContext(VisualizationDataContext);

  useEffect(() => {
    if (renderFlag) {
      Promise.resolve(
        buildChart(
          assemblyInfo,
          bottomCol,
          bottomThresh,
          data,
          filterCb,
          0.5 * width,
          onCircleClick,
          pvalScale,
          `.${className}`,
          topCol,
          topThresh,
          _width,
          transformPValue,
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
    onCircleClick,
    pvalScale,
    selectedRegionDetailData,
    topCol,
    topThresh,
    width,
    renderFlag,
    _width,
    transformPValue,
  ]);

  return (
    <>
      <Box className={className} onMouseEnter={handlePopoverOpen} />
      <PlotDownloadButton
        anchorEl={anchorEl}
        selector={`.${className}`}
        plotType="Miami Plot"
      />
      <LoadingOverlay open={loading} />
    </>
  );
};

export default MiamiPlot;
