"use client";

import React, { useEffect, useState } from "react";
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
import { BrushFilter } from "@/components/MiamiPlot";

export default function Home() {
  const [regionData, setRegionData] = useState<RegionResult[]>([]);
  const [regionDisplayData, setRegionDisplayData] = useState<RegionResult[]>(
    []
  );

  const [brushFilter, setBrushFilter] = useState<BrushFilter>();

  const [filterModel, setFilterModel] = useState<GridFilterModel>();

  const [upperVariable, setUpperVariale] = useState<keyof RegionResult | "">(
    ""
  );
  const [lowerVariable, setLowerVariable] = useState<keyof RegionResult | "">(
    ""
  );

  const [upperThresh, setUpperThresh] = useState<number>(10e-5);
  const [lowerThresh, setLowerThresh] = useState<number>(10e-5);

  useEffect(() => {
    // we filter the positions here so it's updated in the chart
    // but the pvals are filtered in the viz, since we don't want to remove
    // the whole model from the dataset, since one var might pass and the other might not
    if (brushFilter && upperVariable && lowerVariable) {
      const { x0Lim, x1Lim } = brushFilter;

      const newDisplayData = regionDisplayData.filter((d) => {
        const x0Pass =
          d.chr > +x0Lim.chr ||
          (d.chr === +x0Lim.chr && d.start_bp >= x0Lim.pos);

        const x1Pass =
          d.chr < +x1Lim.chr || (d.chr === +x1Lim.chr && d.end_bp <= x1Lim.pos);

        return x0Pass && x1Pass;
      });

      setRegionDisplayData(newDisplayData);
    }
  }, [brushFilter, upperVariable, lowerVariable]);

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
                    ...parsed.map((val) =>
                      Object.fromEntries(
                        Object.entries(val).map(([k, v]) => [
                          k.replaceAll(".", "_"),
                          +v,
                        ])
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
                setBrushFilter(undefined);
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
              data={regionDisplayData}
              filter={brushFilter}
              filterCb={(f) => setBrushFilter(f)}
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
