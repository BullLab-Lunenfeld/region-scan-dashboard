"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Grid2 as Grid, IconButton, MenuItem, TextField } from "@mui/material";
import { schemeDark2 } from "d3-scale-chromatic";
import { group, groups, max } from "d3-array";
import { UndoSharp } from "@mui/icons-material";
import { GridFilterModel } from "@mui/x-data-grid";
import {
  MiamiPlot,
  NumberInput,
  PaginatedTable,
  QQPlot,
  RegionPlot,
  UploadButtonMulti,
} from "@/components";
import { parseTsv } from "@/lib/ts/util";
import { AssembyInfo, RegionResult } from "@/lib/ts/types";
import { RegionResultCols } from "@/util/columnConfigs";
import { BrushFilter } from "@/components/MiamiPlot";
import { chromLengths37, chromLengths38 } from "@/util/chromLengths";

const TOP_COLOR = schemeDark2[0];
const BOTTOM_COLOR = schemeDark2[1];

export default function Home() {
  const [assemblyInfo, setAssemblyInfo] = useState<AssembyInfo>({
    assembly: "GRCh38",
    lengths: chromLengths38,
  });

  const [brushFilterHistory, setBrushFilterHistory] = useState<BrushFilter[]>(
    []
  );

  //  const [filterModel, setFilterModel] = useState<GridFilterModel>();
  const [lowerThresh, setLowerThresh] = useState<number>(5e-6);
  const [lowerVariable, setLowerVariable] = useState<keyof RegionResult | "">(
    ""
  );

  const [regionData, setRegionData] = useState<RegionResult[]>([]);
  const [regionDetailData, setRegionDetailData] = useState<RegionResult[]>([]);
  const [regionDisplayData, setRegionDisplayData] = useState<RegionResult[]>(
    []
  );

  const [selectedRegion, setSelectedRegion] = useState<RegionResult>();

  const [uploadKey, setUploadKey] = useState(
    Math.random().toString(36).slice(2)
  );

  const [upperThresh, setUpperThresh] = useState<number>(5e-6);
  const [upperVariable, setUpperVariable] = useState<keyof RegionResult | "">(
    ""
  );

  const chartContainerRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (selectedRegion && regionRestartPoints) {
      const chr = selectedRegion.chr;
      let minBp = 0;
      let maxBp = Infinity;
      const start = selectedRegion.region - 50;
      const end = selectedRegion.region + 50;

      if (regionRestartPoints[chr]) {
        const chrPart = regionRestartPoints[chr];
        if (selectedRegion.end_bp < chrPart) {
          maxBp = regionRestartPoints[chr];
        } else {
          minBp = regionRestartPoints[chr];
        }
      }

      const regionDetailData = regionDisplayData.filter(
        (d) =>
          d.end_bp < maxBp &&
          d.start_bp >= minBp &&
          d.region >= start &&
          d.region <= end &&
          d.chr == chr
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

  const resetVisualizationVariables = () => {
    setRegionDetailData([]);
    setSelectedRegion(undefined);
    setBrushFilterHistory([]);
    setRegionDetailData([]);
  };

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
                  const parsed = await parseTsv<RegionResult>(file);
                  results = [
                    ...results,
                    ...parsed.map((val, j) => {
                      val.id = +`${i}${j}`;
                      return Object.fromEntries(
                        Object.entries(val)
                          .map(([k, v]) => [k.replaceAll(".", "_"), +v])
                          .filter(([k, v]) => {
                            // these are old and redundant values
                            if (["MLCZ_p", "LCZ_p"].includes(k + "")) {
                              return false;
                            }
                            //for now we'll filter out negative p values
                            //but we may want to correct them later
                            else if (
                              typeof k == "string" &&
                              k.toLowerCase().endsWith("_p")
                            ) {
                              return !!+v && +v > 0;
                            } else return true;
                          })
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
                setBrushFilter
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
        <Grid ref={chartContainerRef} size={{ xs: 8, lg: 10 }}>
          {!!regionData.length &&
            !!upperVariable &&
            !!lowerVariable &&
            !!chartContainerRef.current && (
              <MiamiPlot
                assemblyInfo={assemblyInfo}
                bottomCol={lowerVariable}
                bottomColor={BOTTOM_COLOR}
                bottomThresh={lowerThresh}
                data={regionDisplayData}
                onCircleClick={(d) => setSelectedRegion(d)}
                filter={brushFilterHistory[brushFilterHistory.length - 1]}
                filterCb={(f) =>
                  setBrushFilterHistory(brushFilterHistory.concat(f))
                }
                selectedRegion={selectedRegion}
                topCol={upperVariable}
                topColor={TOP_COLOR}
                topThresh={upperThresh}
                width={chartContainerRef.current.clientWidth}
              />
            )}
        </Grid>
      </Grid>
      <Grid
        container
        direction="row"
        justifyContent="space-between"
        alignItems="center"
      >
        <Grid container direction="column">
          {!!regionDisplayData && (
            <>
              <Grid>
                {!!upperVariable && (
                  <QQPlot
                    color={TOP_COLOR}
                    pvals={regionData.map((v) => v[upperVariable])}
                    selector="upper-qq"
                    variable={upperVariable}
                    width={400}
                  />
                )}
              </Grid>
              <Grid>
                {!!lowerVariable && (
                  <QQPlot
                    color={BOTTOM_COLOR}
                    pvals={regionData.map(
                      (v) => v[lowerVariable as keyof RegionResult]
                    )}
                    selector="lower-qq"
                    variable={lowerVariable}
                    width={400}
                  />
                )}
              </Grid>
            </>
          )}
        </Grid>
        {!!regionDetailData.length &&
          !!upperVariable &&
          !!lowerVariable &&
          !!selectedRegion && (
            <Grid>
              <RegionPlot
                assemblyInfo={assemblyInfo}
                data={regionDetailData}
                selector="region-plot"
                selectedRegion={selectedRegion}
                var1={upperVariable}
                var1Color={TOP_COLOR}
                var2={lowerVariable}
                var2Color={BOTTOM_COLOR}
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
