"use client";

import React, { useEffect, useRef, useState } from "react";
import { Grid2 as Grid, IconButton, MenuItem, TextField } from "@mui/material";
import { ArrowBack, UndoSharp } from "@mui/icons-material";
import { GridFilterModel } from "@mui/x-data-grid";
import {
  MiamiPlot,
  NumberInput,
  PaginatedTable,
  QQPlot,
  UploadButton,
} from "@/components";
import { parseTsv } from "@/lib/ts/util";
import { RegionResult } from "@/lib/ts/types";
import { RegionResultCols } from "@/util/columnConfigs";
import { BrushFilter } from "@/components/MiamiPlot";

export default function Home() {
  const [regionData, setRegionData] = useState<RegionResult[]>([]);
  const [regionDisplayData, setRegionDisplayData] = useState<RegionResult[]>(
    []
  );

  const [brushFilterHistory, setBrushFilterHistory] = useState<BrushFilter[]>(
    []
  );

  const [filterModel, setFilterModel] = useState<GridFilterModel>();

  const [upperVariable, setUpperVariale] = useState<keyof RegionResult | "">(
    ""
  );
  const [lowerVariable, setLowerVariable] = useState<keyof RegionResult | "">(
    ""
  );

  const [upperThresh, setUpperThresh] = useState<number>(10e-5);
  const [lowerThresh, setLowerThresh] = useState<number>(10e-5);

  const [qqDist, setQqDist] = useState<string>("normal");

  const chartContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // we filter the positions here so it's updated in the chart
    // but the pvals are filtered in the viz, since we don't want to remove
    // the whole model from the dataset, since one var might pass and the other might not
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
              }}
            />
          </Grid>
          <Grid>
            {!!regionData.length && (
              <TextField
                fullWidth
                onChange={(e) =>
                  setUpperVariale(e.target.value as keyof RegionResult)
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
                      onChange={() => setUpperVariale(k as keyof RegionResult)}
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
          <Grid>
            {!!regionData.length && (
              <NumberInput
                value={lowerThresh}
                onChange={(v: number) => !!v && setLowerThresh(v)}
                label="Lower Threshold"
              />
            )}
          </Grid>
          <Grid>
            {!!regionData.length && (
              <TextField
                label="QQ Distribution"
                onChange={(e) => setQqDist(e.target.value)}
                select
                fullWidth
                value={qqDist}
              >
                <MenuItem value="normal">Normal</MenuItem>
                <MenuItem value="uniform">Uniform</MenuItem>
              </TextField>
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
                bottomThresh={lowerThresh}
                data={regionDisplayData}
                filter={brushFilterHistory[brushFilterHistory.length - 1]}
                filterCb={(f) =>
                  setBrushFilterHistory(brushFilterHistory.concat(f))
                }
                topCol={upperVariable}
                topThresh={upperThresh}
                width={chartContainerRef.current.clientWidth}
              />
            )}
        </Grid>
      </Grid>
      <Grid container>
        {!!regionDisplayData && (
          <>
            <Grid>
              {!!upperVariable && (
                <QQPlot
                  distribution="normal"
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
                  distribution="normal"
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
