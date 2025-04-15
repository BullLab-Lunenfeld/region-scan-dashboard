"use client";

import React, { useEffect, useRef, useState } from "react";
import { Grid2 as Grid, IconButton, MenuItem, TextField } from "@mui/material";
import { schemeDark2 } from "d3-scale-chromatic";
import { UndoSharp } from "@mui/icons-material";
import { GridFilterModel } from "@mui/x-data-grid";
import {
  MiamiPlot,
  NumberInput,
  PaginatedTable,
  QQPlot,
  RegionPlot,
  UploadButton,
} from "@/components";
import { parseTsv } from "@/lib/ts/util";
import { RegionResult } from "@/lib/ts/types";
import { RegionResultCols } from "@/util/columnConfigs";
import { BrushFilter } from "@/components/MiamiPlot";

const TOP_COLOR = schemeDark2[0];
const BOTTOM_COLOR = schemeDark2[1];

export default function Home() {
  const [regionData, setRegionData] = useState<RegionResult[]>([]);
  const [regionDisplayData, setRegionDisplayData] = useState<RegionResult[]>(
    []
  );

  const [brushFilterHistory, setBrushFilterHistory] = useState<BrushFilter[]>(
    []
  );

  const [filterModel, setFilterModel] = useState<GridFilterModel>();

  const [upperVariable, setUpperVariable] = useState<keyof RegionResult | "">(
    ""
  );
  const [lowerVariable, setLowerVariable] = useState<keyof RegionResult | "">(
    ""
  );

  const [upperThresh, setUpperThresh] = useState<number>(10e-5);
  const [lowerThresh, setLowerThresh] = useState<number>(10e-5);

  const [regionDetailData, setRegionDetailData] = useState<RegionResult[]>([]);

  const chartContainerRef = useRef<HTMLDivElement>(null);

  const _setRegionDetailData = (d: RegionResult) => {
    //we need 100k basepairs in either direction from the (non-filtered) data
    const chr = d.chr;
    const start = d.start_bp - 100000;
    const end = d.end_bp + 100000;

    const regionDetailData = regionData.filter(
      (d) => d.start_bp >= start && d.end_bp <= end && d.chr == chr
    );

    setRegionDetailData(regionDetailData);
  };

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
  }, [brushFilterHistory, upperVariable, lowerVariable]);

  return (
    <Grid container direction="column" spacing={2}>
      <Grid container direction="row" spacing={2}>
        <Grid size={{ xs: 4, lg: 2 }} direction="column" container spacing={2}>
          <Grid>
            <UploadButton
              fileType="region"
              onUpload={async (files: File[]) => {
                let results: RegionResult[] = [];

                for (const file of files) {
                  const parsed = await parseTsv<RegionResult>(file);
                  results = [
                    ...results,
                    ...parsed.map((val) =>
                      Object.fromEntries(
                        Object.entries(val)
                          .map(([k, v]) => [k.replaceAll(".", "_"), +v])
                          .filter(([k, v]) => {
                            //for now we'll filter out negative p values
                            //but we may want to correct them later
                            if (
                              typeof k == "string" &&
                              k.toLowerCase().endsWith("_p")
                            ) {
                              return !!+v && +v > 0;
                            } else return true;
                          })
                      )
                    ),
                  ] as RegionResult[];
                }

                results = results.map((r, i) => {
                  r.id = i;
                  return r;
                });

                setRegionData(results);
                setRegionDisplayData(results);
                setBrushFilterHistory([]);
                setRegionDetailData([]);
              }}
            />
          </Grid>
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
                bottomCol={lowerVariable}
                bottomColor={BOTTOM_COLOR}
                bottomThresh={lowerThresh}
                data={regionDisplayData}
                onCircleClick={_setRegionDetailData}
                filter={brushFilterHistory[brushFilterHistory.length - 1]}
                filterCb={(f) =>
                  setBrushFilterHistory(brushFilterHistory.concat(f))
                }
                topCol={upperVariable}
                topColor={TOP_COLOR}
                topThresh={upperThresh}
                width={chartContainerRef.current.clientWidth}
              />
            )}
        </Grid>
      </Grid>
      <Grid container direction="row">
        <Grid container direction="column">
          {!!regionDisplayData && (
            <>
              <Grid>
                {!!upperVariable && (
                  <QQPlot
                    color={TOP_COLOR}
                    pvals={regionDisplayData.map((v) => v[upperVariable])}
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
                    pvals={regionDisplayData.map(
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
        {!!regionDetailData.length && !!upperVariable && !!lowerVariable && (
          <Grid>
            <RegionPlot
              data={regionDetailData}
              selector="region-plot"
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
        {/* Ideally we don't need controlled filters at all, if we could just get the filtered data out of it... */}
        {!!regionDisplayData.length && (
          <PaginatedTable
            cols={RegionResultCols}
            data={regionDisplayData}
            filterModel={filterModel}
            onFilterModelChange={(m) => console.log(m)}
            onSelect={(m) => null}
          />
        )}
      </Grid>
    </Grid>
  );
}
