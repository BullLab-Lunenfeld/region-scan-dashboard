"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Checkbox,
  FormControlLabel,
  Grid2 as Grid,
  IconButton,
  MenuItem,
  TextField,
} from "@mui/material";
import { schemeSet3 } from "d3-scale-chromatic";
import { scaleOrdinal } from "d3-scale";
import { groups } from "d3-array";
import { UndoSharp } from "@mui/icons-material";
import {
  MiamiPlot,
  NumberInput,
  PaginatedTable,
  QQPlot,
  RegionPlot,
  UploadButtonMulti,
} from "@/components";
import { getEntries, parseTsv } from "@/lib/ts/util";
import {
  AssembyInfo,
  RegionResult,
  RegionResultRaw,
  RegionResultRawNew,
  RegionResultRawOld,
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

  //  const [filterModel, setFilterModel] = useState<GridFilterModel>();
  const [lowerThresh, setLowerThresh] = useState<number>(5e-6);
  const [lowerVariable, setLowerVariable] = useState<keyof RegionResult | "">(
    "",
  );

  const [qqVariables, setQqVariables] = useState<(keyof RegionResult)[]>([]);

  const [regionData, setRegionData] = useState<RegionResult[]>([]);
  const [regionDetailData, setRegionDetailData] = useState<RegionResult[]>([]);
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

  const chartContainerRef = useRef<HTMLDivElement>(null);

  const pvalScale = useMemo(() => {
    if (regionData.length) {
      return scaleOrdinal<string, string>()
        .range(schemeSet3)
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

      // first trim, in case there's a half-chromosome cutoff
      if (regionRestartPoints[chr]) {
        const chrPart = regionRestartPoints[chr];
        if (selectedRegion.end_bp < chrPart) {
          maxBp = regionRestartPoints[chr];
        } else {
          minBp = regionRestartPoints[chr];
        }
      }

      //we have to have <= 5 mb for gene fetch API
      if (selectedRegion.start_bp - minBp > 2500000) {
        minBp = selectedRegion.start_bp - 2500000;
      }

      if (maxBp - selectedRegion.start_bp > 2500000) {
        maxBp = selectedRegion.start_bp + 2500000;
      }

      const regionDetailData = regionDisplayData.filter(
        (d) => d.end_bp < maxBp && d.start_bp >= minBp && d.chr == chr,
      );

      setRegionDetailData(regionDetailData);
    }
  }, [regionDisplayData, regionRestartPoints, selectedRegion]);

  useEffect(() => {
    setRegionDetailData([]);
  }, [upperVariable, lowerVariable]);

  useEffect(() => {
    if (upperVariable && lowerVariable) {
      setRegionDetailData([]);

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
      ([upperVariable, lowerVariable].filter(Boolean) as (keyof RegionResult)[])
        .concat(qqVariables)
        .filter((v, i, a) => a.findIndex((_a) => _a === v) === i),
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
    setRegionDetailData([]);
    setSelectedRegion(undefined);
    setBrushFilterHistory([]);
    setRegionDetailData([]);
  };

  const filterCb = useCallback(
    (f: BrushFilter) => setBrushFilterHistory(brushFilterHistory.concat(f)),
    [brushFilterHistory],
  );

  return (
    <Grid container direction="column" spacing={2}>
      <Grid container direction="row" spacing={2}>
        <Grid size={{ xs: 4, lg: 2 }} direction="column" container spacing={2}>
          <Grid>
            <UploadButtonMulti
              key={uploadKey}
              fileType="region"
              onUpload={async (files: File[]) => {
                let results: RegionResult[] = [];
                resetVisualizationVariables();
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
                            //for now we'll filter out negative p values
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
                setRegionDisplayData(results);
                setUploadKey(Math.random().toString(36).slice(2));
              }}
            />
          </Grid>
          {!!regionData.length && (
            <Grid>
              <TextField
                label="Assembly"
                fullWidth={true}
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
              </TextField>
            </Grid>
          )}
          <Grid>
            {!!regionData.length && (
              <TextField
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
              </TextField>
            )}
          </Grid>
          <Grid>
            {!!regionData.length && (
              <TextField
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
              </TextField>
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
        <Grid ref={chartContainerRef} size={{ xs: 4, lg: 6 }}>
          {!!pvalScale &&
            !!upperVariable &&
            !!lowerVariable &&
            !!chartContainerRef.current && (
              <MiamiPlot
                assemblyInfo={assemblyInfo}
                pvalScale={pvalScale}
                bottomCol={lowerVariable}
                bottomThresh={lowerThresh}
                data={regionDisplayData}
                onCircleClick={(d) => setSelectedRegion(d)}
                filter={brushFilterHistory[brushFilterHistory.length - 1]}
                filterCb={filterCb}
                selectedRegion={selectedRegion}
                topCol={upperVariable}
                topThresh={upperThresh}
                width={chartContainerRef.current.clientWidth}
              />
            )}
        </Grid>
        {!!pvalScale && (
          <Grid size={{ xs: 4 }} justifyContent="flex-end">
            {!!regionData.length && (
              <Grid direction="column" spacing={3} alignItems="flex-end">
                <Grid>
                  <QQPlot
                    pvalScale={pvalScale}
                    data={regionData}
                    selector="qq"
                    visibleVariables={qqVariables}
                    variables={pVars}
                    width={400}
                  />
                </Grid>
                <Grid container direction="row" wrap="wrap">
                  {!!qqVariables.length &&
                    pVars.map((v) => (
                      <Grid key={v}>
                        <FormControlLabel
                          label={v}
                          control={
                            <Checkbox
                              sx={{
                                color: pvalScale(v),
                                "&.Mui-checked": {
                                  color: pvalScale(v),
                                },
                              }}
                              value={v}
                              checked={qqVariables.includes(v)}
                              onChange={(_, checked) =>
                                checked
                                  ? setQqVariables(qqVariables.concat(v))
                                  : setQqVariables(
                                      qqVariables.filter((c) => c !== v),
                                    )
                              }
                            />
                          }
                        />
                      </Grid>
                    ))}
                </Grid>
              </Grid>
            )}
          </Grid>
        )}
      </Grid>
      <Grid
        container
        direction="row"
        justifyContent="space-between"
        alignItems="center"
      >
        {!!pvalScale &&
          !!regionDetailData.length &&
          !!upperVariable &&
          !!lowerVariable &&
          !!selectedRegion && (
            <Grid>
              <RegionPlot
                assemblyInfo={assemblyInfo}
                data={regionDetailData}
                pvalScale={pvalScale}
                selector="region-plot"
                selectedRegion={selectedRegion}
                var1={upperVariable}
                var2={lowerVariable}
                width={800}
              />
            </Grid>
          )}
      </Grid>
      <Grid width="100%">
        {/* Ideally we don't need controlled filters at all*/}
        {!!regionDisplayData.length && (
          <PaginatedTable
            cols={RegionResultCols}
            data={regionDisplayData}
            //filterModel={filterModel}
            //onFilterModelChange={(m) => console.log(m)}
            //onSelect={(m) => null}
          />
        )}
      </Grid>
    </Grid>
  );
}
