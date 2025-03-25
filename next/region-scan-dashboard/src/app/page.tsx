"use client";

import React, { useState } from "react";
import { Grid2 as Grid, MenuItem, TextField } from "@mui/material";
import { GridFilterModel } from "@mui/x-data-grid";
import {
  MiamiPlot,
  NumberInput,
  PaginatedTable,
  UploadButton,
} from "@/components";
import { parseTsv } from "@/lib/ts/util";
import { RegionResult } from "@/lib/ts/types";
import { RegionResultCols } from "@/util/columnConfigs";

export default function Home() {
  const [regionData, setRegionData] = useState<RegionResult[]>([]);
  const [regionDisplayData, setRegionDisplayData] = useState<RegionResult[]>(
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

  return (
    <Grid container direction="column" spacing={2}>
      <Grid container direction="row" spacing={2}>
        <Grid size={2} direction="column" container spacing={2}>
          <Grid>
            <UploadButton
              fileType="region"
              onUpload={async (files: File[]) => {
                let results: RegionResult[] = [];

                for (const file of files) {
                  const parsed = await parseTsv<RegionResult>(file);
                  results = [
                    ...results,
                    ...parsed.map(
                      (val) =>
                        Object.fromEntries(
                          Object.entries(val).map(([k, v]) => [
                            k.replaceAll(".", "_"),
                            v,
                          ])
                        ) as RegionResult
                    ),
                  ];
                }

                results = results.map((r, i) => {
                  r.id = i;
                  return r;
                });

                setRegionData(results);
                setRegionDisplayData(results);
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
        </Grid>
        <Grid size={10}>
          {!!regionData.length && !!upperVariable && !!lowerVariable && (
            <MiamiPlot
              bottomCol={lowerVariable}
              bottomThresh={lowerThresh}
              data={regionData}
              topCol={upperVariable}
              topThresh={upperThresh}
            />
          )}
        </Grid>
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
