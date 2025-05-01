import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { extent, groups, max } from "d3-array";
import { axisBottom, axisLeft, axisRight } from "d3-axis";
import { schemeSet3 } from "d3-scale-chromatic";
import { format } from "d3-format";
import { BaseType, pointer, select, selectAll, Selection } from "d3-selection";
import { ScaleLinear, scaleLinear, ScaleOrdinal, scaleOrdinal } from "d3-scale";
import { line } from "d3-shape";
import {
  Box,
  Button,
  Checkbox,
  FormControl,
  FormControlLabel,
  Grid2 as Grid,
} from "@mui/material";
import {
  AssembyInfo,
  EnsemblGeneResult,
  RegionPlotRegionResult,
  RegionResult,
  VariantResultRow,
} from "@/lib/ts/types";
import { LoadingOverlay, UploadButtonSingle } from "@/components";
import { drawDottedLine, parseTsv } from "@/lib/ts/util";
import { fetchGenes } from "@/util/fetchGenes";
import { fetchRecomb } from "@/util/fetchRecomb";

interface RegionData {
  region: number;
  start: number;
  end: number;
  variable: keyof RegionResult;
  pvalue: number;
}

const showRegionTooltip = (data: RegionData, e: MouseEvent) => {
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
        `Pval: ${format(".5")(data.pvalue)}`,
      ],
      (d) => d,
    )
    .join("li")
    .style("font-size", "15px")
    .text((d) => d);
};

const showVariantTooltip = (data: VariantResultRow, e: MouseEvent) => {
  select(".tooltip")
    .style("left", `${e.pageX + 15}px`)
    .style("top", `${e.pageY - 15}px`)
    .style("visibility", "visible")
    .select<HTMLUListElement>("ul")
    .selectAll<HTMLLIElement, string>("li")
    .data<string>(
      [
        `Variant: ${data.variant}`,
        `Region: ${data.region}`,
        `Pos: ${format(",")(data.pos)}`,
        `sg pval: ${format(".5")(data.sg_pval)}`,
      ],
      (d) => d,
    )
    .join("li")
    .style("font-size", "15px")
    .text((d) => d);
};

const showGeneTooltip = (data: EnsemblGeneResult, e: MouseEvent) => {
  select(".tooltip")
    .style("left", `${e.pageX + 15}px`)
    .style("top", `${e.pageY - 15}px`)
    .style("visibility", "visible")
    .select<HTMLUListElement>("ul")
    .selectAll<HTMLLIElement, string>("li")
    .data<string>(
      [
        `Gene: ${data.external_name}`,
        `Type: ${data.biotype}`,
        `ID: ${data.gene_id}`,
        `Start pos: ${format(",")(data.start)}`,
        `End pos: ${format(",")(data.end)}`,
      ],
      (d) => d,
    )
    .join("li")
    .style("font-size", "15px")
    .text((d) => d);
};

const variantColorScale = scaleOrdinal<string>()
  .range(["teal", "orange"])
  .domain(["0", "1"]);

const regionRectHeight = 5;
const marginBottom = 35;
const yLabelMargin = 28;
const yAxisMargin = 20;
const marginLeft = yLabelMargin + yAxisMargin;
const marginTop = 25;
const marginRight = 15;
const geneHeight = 3;

class RegionChart {
  activeVariables: (keyof RegionResult)[];
  container: Selection<SVGGElement, number, SVGElement, unknown>;
  height: number;
  mainWidth: number;
  selector: string;
  svg: Selection<SVGElement, number, BaseType, unknown>;
  var1: keyof RegionResult;
  var1Color: string;
  var2: keyof RegionResult;
  var2Color: string;
  width: number;
  xScale: ScaleLinear<number, number, never> | null = null;

  constructor(
    selector: string,
    var1: keyof RegionResult,
    var1Color: string,
    var2: keyof RegionResult,
    var2Color: string,
    width: number,
  ) {
    //display properties
    this.selector = selector;
    this.var1 = var1;
    this.var1Color = var1Color;
    this.var2 = var2;
    this.var2Color = var2Color;
    this.width = width;
    this.activeVariables = [var1, var2];
    this.mainWidth = 0.8 * width;
    this.height = 0.5 * width;

    this.svg = select(`.${this.selector}`)
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

    this.container = this.svg
      .selectAll<SVGGElement, number>("g.container")
      .data([1])
      .join("g")
      .attr("class", "container");
  }

  updateActiveVariables = (variables: (keyof RegionResult)[]) =>
    (this.activeVariables = variables);

  getRectFill = (
    variable: keyof RegionResult,
    regionColorScale: ScaleOrdinal<string, string, never>,
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

  render = (
    data: RegionPlotRegionResult[],
    variants: VariantResultRow[],
    genes: EnsemblGeneResult[],
    wheelCb: (delta: number, pos: number) => void,
    setCenterRegion: (region: number) => void,
    regionRange: number[],
  ) => {
    const variables = [this.var1, this.var2].concat(
      Object.keys(data[0]).filter(
        (k) =>
          ![this.var1, this.var2].includes(k as keyof RegionResult) &&
          k.toLowerCase().endsWith("_p"),
      ) as (keyof RegionResult)[],
    );

    const geneHeightMap = genes.reduce<Record<string, number>>(
      (acc, curr) => ({
        ...acc,
        [curr.id]: 1,
      }),
      {},
    );

    if (genes.length) {
      const sorted = genes.sort((a, b) => (a.start < b.start ? -1 : 1));
      sorted.forEach((outerG, i) => {
        for (let j = i; j < sorted.length; j++) {
          if (outerG.end > sorted[j].start) {
            let height = geneHeightMap[outerG.id] + 1;
            if (geneHeightMap[outerG.id] > 1) {
              const covered = sorted
                .slice(0, i)
                .sort((a, b) => (a.end < b.end ? -1 : 1));
              for (let k = geneHeightMap[outerG.id]; k > 0; k--) {
                for (let l = i - 1; l >= 0; l--) {
                  if (geneHeightMap[covered[l].id] === k) {
                    if (covered[l].end < sorted[j].start) {
                      height = k;
                    }
                    break;
                  }
                }
              }
            }
            geneHeightMap[genes[j].id] = height;
          }
        }
      });
    }

    const geneHeightCount = !!genes.length
      ? max(Object.values(geneHeightMap)) || 1
      : 0;

    const geneSpace = !!geneHeightCount
      ? geneHeightCount * (geneHeight + 3)
      : 0; //padding

    const chr = data[0].chr;
    const regionData = groups(data, (d) => d.region).flatMap(
      ([region, members]) => {
        const [start, end] = extent(
          members.flatMap((m) => [m.start_bp, m.end_bp]),
        ) as [number, number];

        return Object.entries(members[0])
          .filter(([k]) => k.toLowerCase().endsWith("_p"))
          .map(([variable, pvalue]) => ({
            region,
            start,
            end,
            variable,
            pvalue: -Math.log10(pvalue),
          })) as RegionData[];
      },
    );

    const xScale = scaleLinear()
      .range([marginLeft, this.mainWidth - marginRight])
      .domain(extent(regionData.flatMap((d) => [d.start, d.end])) as number[])
      .clamp(true);

    this.xScale = xScale;

    const regionColorScale = scaleOrdinal<string, string>()
      .range(schemeSet3)
      .domain(
        Object.entries(data[0])
          .filter(([k]) => k.toLowerCase().endsWith("_p"))
          .map(([k]) => k)
          .filter((k, i, a) => a.findIndex((d) => d === k) === i) as string[],
      );

    const yScalePval = scaleLinear()
      .range([marginTop, this.height - marginBottom - geneSpace])
      .domain([
        max(
          regionData
            .map((d) => d.pvalue)
            .concat(
              variants ? variants.map((v) => -Math.log10(v.sg_pval)) : [],
            ),
        ) as number,
        -0.05,
      ]);

    const yScaleGene = scaleLinear()
      .range([
        this.height - geneSpace - marginBottom + geneHeight,
        this.height - marginBottom,
      ])
      .domain([geneHeightCount, 0]);

    const yScaleRecomb = scaleLinear()
      .range(yScalePval.range())
      .domain(
        extent(data.map((d) => d.recombRate)).reverse() as [number, number],
      );

    const filteredVariants = variants.filter(
      (v) => v.start_bp >= xScale.domain()[0] && v.end_bp <= xScale.domain()[1],
    );

    //draw region rectangles
    this.container
      .selectAll<SVGRectElement, RegionData>("rect.region")
      .data(
        regionData.filter((d) => this.activeVariables.includes(d.variable)),
        (d) => d.pvalue,
      )
      .join("rect")
      .attr("class", "region")
      //x and y are upper-left corner
      .transition()
      .duration(100)
      .attr("x", (d) => xScale(d.start))
      .attr("y", (d) => yScalePval(d.pvalue))
      .attr("fill", (d) => this.getRectFill(d.variable, regionColorScale))
      .transition()
      .duration(250)
      .attr("opacity", (d) => this.getRectOpacity(d.variable))
      .attr("height", regionRectHeight)
      .attr("width", (d) => xScale(d.end) - xScale(d.start))
      .selection()
      .on("mouseover", (e: MouseEvent, d: RegionData) =>
        showRegionTooltip(d, e),
      )
      .on("mouseout", () => selectAll(".tooltip").style("visibility", "hidden"))
      .on("click", (e, d) => setCenterRegion(d.region));

    // add variants
    this.container
      .selectAll<SVGCircleElement, VariantResultRow>("circle.variant")
      .data(filteredVariants, (v) => v.sg_pval)
      .join("circle")
      .attr("class", "variant")
      .attr("cx", (d) => xScale(d.pos))
      .attr("cy", (d) => yScalePval(-Math.log10(d.sg_pval)))
      .attr("fill", (d) => variantColorScale((d.region % 2) + ""))
      .transition()
      .duration(300)
      .selection()
      .attr("opacity", 0.7)
      .attr("r", 1.5)
      .on("mouseover", (e: MouseEvent, d: VariantResultRow) =>
        showVariantTooltip(d, e),
      )
      .on("mouseout", () =>
        selectAll(".tooltip").style("visibility", "hidden"),
      );

    // add genes
    this.container
      .selectAll<SVGRectElement, EnsemblGeneResult>("rect.gene")
      .data(genes)
      .join("rect")
      .attr("class", "gene")
      //x and y are upper-left corner
      .attr("x", (d) => xScale(d.start))
      .attr("y", (d) => yScaleGene(geneHeightMap[d.id]))
      .attr("fill", "blue")
      .attr("height", geneHeight)
      .attr("width", (d) => xScale(d.end) - xScale(d.start))
      .on("mouseover", (e: MouseEvent, d: EnsemblGeneResult) =>
        showGeneTooltip(d, e),
      )
      .on("mouseout", () =>
        selectAll(".tooltip").style("visibility", "hidden"),
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
      .attr("transform", `translate(${this.mainWidth / 2},${this.height - 3})`)
      .selection()
      .selectAll<SVGGElement, string>("text")
      .data([1])
      .join("text")
      .text(
        `Chr${chr} Regions ${regionRange[0]}-${
          regionRange[regionRange.length - 1]
        }`,
      )
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
      .call(axisLeft(yScalePval));

    this.container
      .selectAll<SVGGElement, number>("g.y-axis-r")
      .data([1])
      .join("g")
      .attr("class", "y-axis-r")
      .attr("transform", `translate(${this.mainWidth - marginRight},0)`)
      .transition()
      .duration(500)
      .call(axisRight(yScaleRecomb));

    this.container
      .selectAll("g.y-label-r")
      .data([1])
      .join("g")
      .attr("class", "y-label-r")
      .transition()
      .duration(500)
      .attr("transform", `translate(${this.mainWidth + 12},${this.height / 2})`)
      .selection()
      .selectAll("text")
      .data([1])
      .join("text")
      .text("Recombination Rate")
      .attr("font-size", 12)
      .attr("transform", "rotate(90)")
      .attr("text-anchor", "middle");

    const recombLine = line<RegionPlotRegionResult>()
      .x((d) => xScale(d.start_bp))
      .y((d) => yScaleRecomb(d.recombRate));

    this.container
      .selectAll("path.recomb")
      .data([data.sort((a, b) => (a.start_bp < b.start_bp ? -1 : 1))])
      .join("path")
      .attr("class", "recomb")
      .style("fill", "none")
      .style("stroke", "lightsteelblue")
      .attr("d", (d) => recombLine(d));

    const legendContainer = this.container
      .selectAll("g.legend")
      .data([1])
      .join("g")
      .attr("class", "legend")
      .attr("transform", `translate(${this.mainWidth + 12},0)`);

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
        this.render(
          data,
          variants,
          genes,
          wheelCb,
          setCenterRegion,
          regionRange,
        );
      });

    legendContainer
      .selectAll("text")
      .data(variables)
      .join("text")
      .text((d) => d)
      .attr("text-anchor", "right")
      .attr("transform", (_, i) => `translate(15,${16 + i * 18})`);

    this.svg.on("wheel", function (e: WheelEvent) {
      e.preventDefault();
      const [x] = pointer(e);
      wheelCb(e.deltaY, xScale.invert(x));
    });

    drawDottedLine(
      this.container,
      "region-p-line",
      yScalePval(-Math.log10(5e-6)),
      xScale.range()[0],
      xScale.range()[1],
    );

    if (!!variants.length) {
      drawDottedLine(
        this.container,
        "variant-p-line",
        yScalePval(-Math.log10(5e-7)),
        xScale.range()[0],
        xScale.range()[1],
      );
    } else {
      this.container.select("g.variant-p-line").remove();
    }
  };
}

interface RegionPlotProps {
  assemblyInfo: AssembyInfo;
  data: RegionResult[];
  selectedRegion: RegionResult;
  selector: string;
  var1: keyof RegionResult;
  var1Color: string;
  var2: keyof RegionResult;
  var2Color: string;
  width: number;
}

const RegionPlot: React.FC<RegionPlotProps> = ({
  assemblyInfo,
  data,
  selectedRegion,
  selector,
  var1,
  var1Color,
  var2,
  var2Color,
  width,
}) => {
  const [annotatedData, setAnnotatedData] = useState<RegionPlotRegionResult[]>(
    [],
  );

  const [centerRegion, setCenterRegion] = useState(selectedRegion.region);

  const [chart, setChart] = useState<RegionChart>();

  const [genes, setGenes] = useState<EnsemblGeneResult[]>([]);

  const [loading, setLoading] = useState(true);

  const [proteinGenesOnly, setProteinGenesOnly] = useState(true);

  const [wheelTick, setWheelTick] = useState(10);

  const [variantsVisible, setVariantsVisible] = useState<boolean>(true);

  const [variants, setVariants] = useState<VariantResultRow[]>([]);

  const [visibleData, setVisibleData] = useState<RegionPlotRegionResult[]>([]);

  const [uploadKey, setUploadKey] = useState<string>(
    Math.random().toString(36).slice(2),
  );

  const containerRef = useRef<HTMLDivElement | null>(null);

  const chr = useMemo(() => data[0].chr, [data]);

  const posRange = useMemo(
    () => extent(data.map((d) => d.start_bp)) as [number, number],
    [data],
  );

  const visibleGenes = useMemo(() => {
    if (proteinGenesOnly) {
      return genes.filter((g) => g.biotype === "protein_coding");
    } else {
      return genes;
    }
  }, [genes, proteinGenesOnly]);

  const visibleVariants = useMemo(() => {
    if (variantsVisible) {
      return variants;
    } else {
      return [];
    }
  }, [variants, variantsVisible]);

  useEffect(() => {
    // fetch the recomb rate data and merge with region data, this means only 1 api call per chart
    const [start, end] = posRange;

    fetchRecomb(chr, start, end, assemblyInfo.assembly).then((r) => {
      if (r) {
        r.sort((a, b) => (a.start < b.start ? -1 : 1));
        let j = 0;
        const annotated = data.slice() as RegionPlotRegionResult[];
        for (const v of r) {
          for (const d of annotated.slice(j)) {
            if (d.end_bp < v.end) {
              d.recombRate = v.value;
              j++;
            } else {
              break;
            }
          }
        }
        setAnnotatedData(annotated);
      } else {
        alert("Error fetching recombination data");
        setAnnotatedData(data.map((d) => ({ ...d, recombRate: 0 })));
      }
    });
  }, [data, assemblyInfo, chr, posRange]);

  //set visible data depending on zoom and center
  useEffect(() => {
    if (!!annotatedData.length) {
      const [_startReg, _endReg] = [
        centerRegion - wheelTick,
        centerRegion + wheelTick,
      ];

      const visibleData = annotatedData.filter(
        (d) => d.region >= _startReg && d.region <= _endReg,
      );

      setVisibleData(visibleData);
    }
  }, [centerRegion, annotatedData, wheelTick]);

  const regionRange = useMemo(
    () => [...new Set(annotatedData.map((d) => d.region))] as number[],
    [annotatedData],
  );

  const updateRange = useCallback(
    (delta: number, pos: number) => {
      if (wheelTick <= 1 && delta < 0) {
        return;
      }

      const targetRegion = visibleData.find(
        (d) => pos >= d.start_bp && pos <= d.end_bp,
      );

      //maxwheeltick ("zoom out") is max distance from center region to most distant region
      //ensuring we can use the full frame
      const maxWheelTick = max(
        regionRange.map((r) => Math.abs(r - centerRegion)),
      ) as number;

      if (wheelTick > maxWheelTick && delta > 0) {
        return;
      } else {
        if (targetRegion && centerRegion != targetRegion.region) {
          if (targetRegion.region > centerRegion) {
            setCenterRegion(centerRegion + 1);
          } else {
            setCenterRegion(centerRegion - 1);
          }
        }

        setWheelTick((wt) => (delta > 0 ? wt + 1 : wt - 1));
      }
    },
    [wheelTick, centerRegion, regionRange, visibleData],
  );

  //initial render
  useLayoutEffect(() => {
    const Chart = new RegionChart(
      selector,
      var1,
      var1Color,
      var2,
      var2Color,
      width,
    );
    setChart(Chart);
    setLoading(false);
  }, []);

  //new data
  useEffect(() => {
    if (selectedRegion) {
      setVariants([]);
      setGenes([]);
      setWheelTick(10);
      setVariantsVisible(true);
      setCenterRegion(selectedRegion.region);
    }
  }, [selectedRegion, assemblyInfo]);

  //update
  useEffect(() => {
    if (!!chart && !!visibleData.length) {
      chart.render(
        visibleData,
        visibleVariants,
        visibleGenes,
        updateRange,
        setCenterRegion,
        regionRange,
      );
    }
    setUploadKey(Math.random().toString(36).slice(2));
  }, [
    chart,
    visibleGenes,
    visibleVariants,
    visibleData,
    updateRange,
    setCenterRegion,
    regionRange,
  ]);

  return (
    <Grid container>
      <Grid>
        <Box ref={containerRef} className={selector} />
      </Grid>
      <Grid spacing={2} direction="column">
        <Grid>
          <UploadButtonSingle
            key={uploadKey}
            fileType="variant"
            onUpload={async (file) => {
              const parsed = await parseTsv<VariantResultRow>(file);
              const mapped = parsed
                .map(
                  (v) =>
                    Object.fromEntries(
                      Object.entries(v).map(([k, v]) => [
                        k.replace(".", "_"),
                        k === "variant" ? v : +v,
                      ]),
                    ) as unknown as VariantResultRow,
                )
                .filter(
                  (v) =>
                    regionRange.includes(v.region) &&
                    v.start_bp > posRange[0] &&
                    v.end_bp < posRange[1],
                );
              if (mapped.length === 0) {
                alert("no variants found for this region");
              }
              setVariants(mapped);
            }}
            variant="text"
          />
        </Grid>
        <Grid>
          {!!variants.length && (
            <Button onClick={() => setVariantsVisible(!variantsVisible)}>
              {variantsVisible ? "Hide " : " Show"} Variants
            </Button>
          )}
        </Grid>
        <Grid>
          <Button
            onClick={async () => {
              setLoading(true);
              const _genes = await fetchGenes(
                chr,
                posRange[0],
                posRange[1],
                assemblyInfo.assembly,
              );
              if (_genes !== null) {
                setGenes(_genes);
                if (_genes.length === 0) {
                  alert("No genes found for this region");
                }
              } else {
                alert("there was an error fetching the genes for this region");
                setGenes([]);
              }
              setLoading(false);
            }}
          >
            Fetch genes
          </Button>
        </Grid>
        {!!genes.length && (
          <Grid>
            <FormControl>
              <FormControlLabel
                label="Protein Coding Only"
                control={
                  <Checkbox
                    onChange={() => setProteinGenesOnly(!proteinGenesOnly)}
                    checked={proteinGenesOnly}
                    title="Protein Coding only"
                  />
                }
              />
            </FormControl>
          </Grid>
        )}
      </Grid>
      {!!loading && <LoadingOverlay open={true} />}
    </Grid>
  );
};

export default RegionPlot;
