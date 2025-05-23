"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Grid2 as Grid, IconButton, MenuItem } from "@mui/material";
import { schemeSet3 } from "d3-scale-chromatic";
import { scaleOrdinal } from "d3-scale";
import { extent, groups } from "d3-array";
import { UndoSharp } from "@mui/icons-material";
import {
  LoadingOverlay,
  MiamiPlot,
  NumberInput,
  PaginatedTable,
  PvarCheckbox,
  QQPlot,
  RegionPlot,
  ShortTextField,
  UploadButtonMulti,
} from "@/components";
import { getEntries, parseTsv } from "@/lib/ts/util";
import {
  AssembyInfo,
  RegionResult,
  RegionResultRaw,
  RegionResultRawNew,
  RegionResultRawOld,
  SelectedRegionDetailData,
} from "@/lib/ts/types";
import { RegionResultCols } from "@/util/columnConfigs";
import { BrushFilter } from "@/components/MiamiPlot";
import { chromLengths37, chromLengths38 } from "@/util/chromLengths";

const colMap: Partial<
  Record<keyof RegionResultRawOld, keyof RegionResultRawNew>
> = {
  "max.VIF": "maxVIF",
  "SKAT.pDavies": "SKAT.p",
};

const oldColsToDrop = ["GATES.df", "SKAT.pLiu", "SKAT"];

export default function Home() {
  const [assemblyInfo, setAssemblyInfo] = useState<AssembyInfo>({
    assembly: "GRCh38",
    lengths: chromLengths38,
  });

  const [brushFilterHistory, setBrushFilterHistory] = useState<BrushFilter[]>(
    [],
  );

  const [loading, setLoading] = useState(false);

  //  const [filterModel, setFilterModel] = useState<GridFilterModel>();
  const [lowerThresh, setLowerThresh] = useState<number>(5e-6);
  const [lowerVariable, setLowerVariable] = useState<keyof RegionResult | "">(
    "",
  );

  const [qqVariables, setQqVariables] = useState<(keyof RegionResult)[]>([]);

  const [regionData, setRegionData] = useState<RegionResult[]>([]);
  const [selectedRegionDetailData, setSelectedRegionDetailData] =
    useState<SelectedRegionDetailData>();
  const [regionDisplayData, setRegionDisplayData] = useState<RegionResult[]>(
    [],
  );

  const [selectedRegion, setSelectedRegion] = useState<RegionResult>();

  const [uploadKey, setUploadKey] = useState(
    Math.random().toString(36).slice(2),
  );

  const [upperThresh, setUpperThresh] = useState<number>(5e-6);
  const [upperVariable, setUpperVariable] = useState<keyof RegionResult | "">(
    "",
  );

  const miamiChartContainerRef = useRef<HTMLDivElement>(null);

  const qqChartContainerRef = useRef<HTMLDivElement>(null);

  const pvalScale = useMemo(() => {
    if (regionData.length) {
      return scaleOrdinal<string, string>()
        .range(schemeSet3.filter((c) => c !== "#ffffb3")) // this yellow is barely visible
        .domain(
          Object.keys(regionData[0])
            .filter((k) => k.toLowerCase().endsWith("_p"))
            .map((k) => k)
            .filter((k, i, a) => a.findIndex((d) => d === k) === i) as string[],
        );
    }
  }, [regionData]);

  // save where the regions restart (centromeres)
  const regionRestartPoints = useMemo(() => {
    const mapping: Record<number, number> = {};
    if (regionData.length) {
      const grouped = groups(regionData, (d) => d.chr);
      for (let i = 0; i < grouped.length; i++) {
        const chr = grouped[i][0];
        grouped[i][1].sort().forEach((d, j) => {
          if (j > 1 && d.region === 1) {
            mapping[chr] = d.start_bp;
          }
        });
      }
    }

    return mapping;
  }, [regionData]);

  // compute regionPlot data
  useEffect(() => {
    if (selectedRegion && regionRestartPoints) {
      const chr = selectedRegion.chr;
      let minBp = 0;
      let maxBp = Infinity;

      // first trim in case there's a nearby half-chromosome cutoff
      if (regionRestartPoints[chr]) {
        const chrPart = regionRestartPoints[chr];
        if (selectedRegion.end_bp < chrPart) {
          maxBp = regionRestartPoints[chr];
        } else {
          minBp = regionRestartPoints[chr];
        }
      }

      // we have to have <= 5 mb for gene fetch API, so trim there too
      if (selectedRegion.start_bp - minBp > 2500000) {
        minBp = selectedRegion.start_bp - 2500000;
      }

      if (maxBp - selectedRegion.start_bp > 2500000) {
        maxBp = selectedRegion.start_bp + 2500000;
      }

      // finally, if we're already zoomed in to single chr, trim to that range
      if (regionDisplayData.length) {
        if ([...new Set([regionDisplayData.map((r) => r.chr)])].length === 1) {
          const [minVisibleBp, maxVisibleBp] = extent(
            regionDisplayData.flatMap((d) => [d.start_bp, d.end_bp]),
          ) as [number, number];
          if (maxVisibleBp < maxBp) {
            maxBp = maxVisibleBp;
          }
          if (minVisibleBp > minBp) {
            minBp = minVisibleBp;
          }
        }
      }

      const regionDetailData = regionData.filter(
        (d) => d.end_bp < maxBp && d.start_bp >= minBp && d.chr == chr,
      );

      setSelectedRegionDetailData({
        data: regionDetailData,
        region: selectedRegion,
        regions: [
          ...new Set(regionDetailData.map((d) => d.region)),
        ] as number[],
        bpRange: extent(
          regionDetailData.flatMap((d) => [d.start_bp, d.end_bp]),
        ) as [number, number],
      });
    }
  }, [regionData, regionDisplayData, regionRestartPoints, selectedRegion]);

  useEffect(() => {
    setSelectedRegionDetailData(undefined);
  }, [upperVariable, lowerVariable]);

  useEffect(() => {
    if (upperVariable && lowerVariable) {
      if (!!brushFilterHistory.length) {
        const { x0Lim, x1Lim } =
          brushFilterHistory[brushFilterHistory.length - 1];

        const newDisplayData = regionData.filter((d) => {
          const x0Pass =
            d.chr > +x0Lim.chr ||
            (d.chr === +x0Lim.chr && d.start_bp >= x0Lim.pos);

          const x1Pass =
            d.chr < +x1Lim.chr ||
            (d.chr === +x1Lim.chr && d.end_bp <= x1Lim.pos);

          return x0Pass && x1Pass;
        });

        //optionally reset region chart data if we've zoomed out of range
        if (selectedRegionDetailData) {
          const { chr } = selectedRegionDetailData.region;
          const { bpRange } = selectedRegionDetailData;
          //if selected chr is no longer in view
          if (+x0Lim.chr > chr || +x1Lim.chr < chr) {
            setSelectedRegionDetailData(undefined);
          } else if (
            +x0Lim.chr == +x1Lim.chr &&
            +x1Lim.chr === chr &&
            (x0Lim.pos > bpRange[0] || x1Lim.pos < bpRange[0])
          ) {
            setSelectedRegionDetailData(undefined);
          }
        }

        if (newDisplayData.length) {
          setRegionDisplayData(newDisplayData);
        }
      } else {
        setRegionDisplayData(regionData);
      }
    }
  }, [brushFilterHistory, upperVariable, lowerVariable, regionData]);

  useEffect(() => {
    setQqVariables(
      [upperVariable, lowerVariable].filter(Boolean) as (keyof RegionResult)[],
    );
  }, [upperVariable, lowerVariable]);

  const pVars = useMemo(
    () =>
      [
        ...new Set(
          regionData.flatMap((r) =>
            Object.keys(r).filter((k) => k.endsWith("_p")),
          ),
        ),
      ] as (keyof RegionResult)[],
    [regionData],
  );

  const resetVisualizationVariables = () => {
    setSelectedRegion(undefined);
    setBrushFilterHistory([]);
    setSelectedRegionDetailData(undefined);
    setQqVariables([]);
    setUpperVariable("");
    setLowerVariable("");
  };

  const filterCb = useCallback(
    (f: BrushFilter) => setBrushFilterHistory(brushFilterHistory.concat(f)),
    [brushFilterHistory],
  );

  return (
    /* Main column container */
    <Grid container direction="column" spacing={3}>
      {/* First row container */}
      <Grid container direction="row" spacing={2}>
        {/* miami plot controls */}
        <Grid
          size={{ xs: 2, xl: 1.5 }}
          direction="column"
          container
          spacing={2}
        >
          <Grid>
            <UploadButtonMulti
              key={uploadKey}
              fileType="region"
              onUpload={async (files: File[]) => {
                let results: RegionResult[] = [];
                resetVisualizationVariables();
                setLoading(true);
                let i = 1;
                for (const file of files) {
                  const parsed = await parseTsv<RegionResultRaw>(file);
                  results = [
                    ...results,
                    ...parsed.map((val, j) => {
                      val.id = +`${i}${j}`;
                      return Object.fromEntries(
                        getEntries(val)
                          .map<[keyof RegionResultRaw, number | null]>(
                            ([k, v]) => {
                              let k_ =
                                colMap[k as keyof RegionResultRawOld] || k;
                              k_ = k_.replaceAll(
                                ".",
                                "_",
                              ) as keyof RegionResultRaw;
                              return [k_, v ? +v : null];
                            },
                          )
                          .filter(([k, v]) => {
                            if (oldColsToDrop.includes(k)) {
                              return false;
                            }

                            // these are old and redundant values? Keeping this here.
                            if (["MLCZ_p", "LCZ_p"].includes(k + "")) {
                              return false;
                            }
                            //for now we'll filter out negative p values as errors
                            //but we may want to correct them later
                            else if (
                              !!v &&
                              typeof k == "string" &&
                              k.toLowerCase().endsWith("_p")
                            ) {
                              return !!+v && +v > 0;
                            } else return true;
                          }),
                      );
                    }),
                  ] as RegionResult[];
                  i++;
                }

                setRegionData(results);
                setLoading(false);
                setUploadKey(Math.random().toString(36).slice(2));
              }}
            />
          </Grid>
          {!!regionData.length && (
            <Grid>
              <ShortTextField
                label="Assembly"
                select
                value={assemblyInfo.assembly}
                onChange={(e) =>
                  e.target.value === "GRCh37"
                    ? setAssemblyInfo({
                        assembly: "GRCh37",
                        lengths: chromLengths37,
                      })
                    : setAssemblyInfo({
                        assembly: "GRCh38",
                        lengths: chromLengths38,
                      })
                }
              >
                <MenuItem value="GRCh37">GRCh37</MenuItem>
                <MenuItem value="GRCh38">GRCh38</MenuItem>
              </ShortTextField>
            </Grid>
          )}
          <Grid>
            {!!regionData.length && (
              <ShortTextField
                fullWidth
                onChange={(e) =>
                  setUpperVariable(e.target.value as keyof RegionResult)
                }
                label="Upper Variable"
                select
                value={upperVariable}
              >
                {Object.keys(regionData[0])
                  .filter((k) => k.endsWith("_p"))
                  .filter((k) => k !== lowerVariable)
                  .map((k) => (
                    <MenuItem
                      value={k}
                      onChange={() => setUpperVariable(k as keyof RegionResult)}
                      key={k}
                    >
                      {k}
                    </MenuItem>
                  ))}
              </ShortTextField>
            )}
          </Grid>
          <Grid>
            {!!regionData.length && (
              <ShortTextField
                fullWidth
                value={lowerVariable}
                onChange={(e) =>
                  setLowerVariable(e.target.value as keyof RegionResult)
                }
                label="Lower Variable"
                select
              >
                {Object.keys(regionData[0])
                  .filter((k) => k.endsWith("_p"))
                  .filter((k) => k !== upperVariable)
                  .map((k) => (
                    <MenuItem value={k} key={k}>
                      {k}
                    </MenuItem>
                  ))}
              </ShortTextField>
            )}
          </Grid>
          <Grid>
            {!!regionData.length && (
              <NumberInput
                value={upperThresh}
                onChange={(v: number) => !!v && setUpperThresh(v)}
                label="Upper Threshold"
              />
            )}
          </Grid>
          <Grid>
            {!!regionData.length && (
              <NumberInput
                value={lowerThresh}
                onChange={(v: number) => !!v && setLowerThresh(v)}
                label="Lower Threshold"
              />
            )}
          </Grid>
          <Grid container alignItems="center" justifyContent="center">
            {!!upperVariable && !!lowerVariable && (
              <IconButton
                onClick={() =>
                  setBrushFilterHistory(brushFilterHistory.slice(0, -1))
                }
                disabled={brushFilterHistory.length == 0}
                size="large"
                title="Undo Zoom"
                color="primary"
              >
                <UndoSharp fontSize="large" />
              </IconButton>
            )}
          </Grid>
        </Grid>
        {/* Miami plot container */}
        <Grid
          container
          ref={miamiChartContainerRef}
          size={{ xs: 5, lg: 6, xl: 6.25 }}
        >
          <Grid>
            {!!pvalScale &&
              !!upperVariable &&
              !!lowerVariable &&
              !!miamiChartContainerRef.current && (
                <MiamiPlot
                  assemblyInfo={assemblyInfo}
                  pvalScale={pvalScale}
                  bottomCol={lowerVariable}
                  bottomThresh={lowerThresh}
                  data={regionDisplayData}
                  onCircleClick={(d) => setSelectedRegion(d)}
                  filter={brushFilterHistory[brushFilterHistory.length - 1]}
                  filterCb={filterCb}
                  selectedRegionDetailData={selectedRegionDetailData}
                  topCol={upperVariable}
                  topThresh={upperThresh}
                  width={miamiChartContainerRef.current.clientWidth}
                />
              )}
          </Grid>
        </Grid>
        {/* QQ Plot */}
        {!!pvalScale && (
          <Grid
            ref={qqChartContainerRef}
            size={{ xs: 5, lg: 4, xl: 4.25 }}
            container
            direction="column"
            spacing={1}
            justifyContent="center"
          >
            {!!regionData.length && !!qqChartContainerRef.current && (
              <>
                <Grid>
                  <QQPlot
                    pvalScale={pvalScale}
                    data={regionData}
                    selector="qq"
                    visibleVariables={qqVariables}
                    variables={pVars}
                    width={qqChartContainerRef.current.clientWidth}
                  />
                </Grid>

                {!!regionData.length && (
                  <Grid
                    marginLeft={2}
                    container
                    spacing={0}
                    direction="row"
                    wrap="wrap"
                  >
                    {pVars.map((v) => (
                      <Grid key={v}>
                        <PvarCheckbox
                          checked={qqVariables.includes(v)}
                          onChange={(_, checked) =>
                            checked
                              ? setQqVariables(qqVariables.concat(v))
                              : setQqVariables(
                                  qqVariables.filter((c) => c !== v),
                                )
                          }
                          pvalScale={pvalScale}
                          value={v}
                        />
                      </Grid>
                    ))}
                  </Grid>
                )}
              </>
            )}
          </Grid>
        )}
      </Grid>
      {/* Region polt row */}
      {!!pvalScale &&
        !!miamiChartContainerRef.current &&
        !!selectedRegionDetailData &&
        !!upperVariable &&
        !!lowerVariable &&
        !!selectedRegion && (
          <RegionPlot
            assemblyInfo={assemblyInfo}
            pvalScale={pvalScale}
            pvars={pVars}
            selector="region-plot"
            selectedRegionDetailData={selectedRegionDetailData}
            var1={upperVariable}
            var2={lowerVariable}
            mainWidth={miamiChartContainerRef.current.clientWidth}
          />
        )}
      {/* Ideally we don't need controlled filters at all*/}
      {!!regionDisplayData.length && (
        <Grid size={{ xs: 12 }} container flexWrap="nowrap">
          <Grid sx={{ width: "100%" }}>
            <PaginatedTable
              cols={RegionResultCols}
              data={regionDisplayData}
              //filterModel={filterModel}
              //onFilterModelChange={(m) => console.log(m)}
              //onSelect={(m) => null}
            />
          </Grid>
        </Grid>
      )}
      <LoadingOverlay open={loading} />
    </Grid>
  );
}
