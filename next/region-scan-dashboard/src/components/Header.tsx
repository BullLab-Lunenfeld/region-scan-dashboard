"use client";

import React, { useCallback, useContext, useState } from "react";
import {
  AppBar,
  Button,
  Grid2 as Grid,
  Menu,
  MenuItem,
  Toolbar,
  Typography,
} from "@mui/material";
import { extent } from "d3-array";
import { Upload } from "@mui/icons-material";
import { usePathname } from "next/navigation";
import NavLink from "./NavLink";
import { VisualizationDataContext } from "./AppContainer";
import LoadingOverlay from "./LoadingOverlay";
import ValidationModal from "./ValidationModal";
import { UploadButtonMulti } from "./UploadButton";
import {
  RegionResult,
  RegionResultRaw,
  RegionResultRawNew,
  RegionResultRawOld,
  VariantResult,
} from "@/lib/ts/types";
import {
  getEntries,
  parseTsv,
  processRegionVariants,
  unique,
} from "@/lib/ts/util";

const colMap: Partial<
  Record<keyof RegionResultRawOld, keyof RegionResultRawNew>
> = {
  "max.VIF": "maxVIF",
  "SKAT.pDavies": "SKAT.p",
};

const oldColsToDrop = ["GATES.df", "SKAT.pLiu", "SKAT"];

export const transformRegionUpload = (parsed: RegionResultRaw[], i: number) =>
  parsed.map((val, j) => {
    val.id = +`${i}${j}`;
    return Object.fromEntries(
      getEntries(val)
        .map<[keyof RegionResultRaw, number | null]>(([k, v]) => {
          let k_ = colMap[k as keyof RegionResultRawOld] || k;
          k_ = k_.replaceAll(".", "_") as keyof RegionResultRaw;
          return [k_, v ? +v : null];
        })
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
    ) as unknown as RegionResult;
  });

const _handleRegionUpload = async (files: File[]) => {
  let results: RegionResult[] = [];
  let i = 1;
  for (const file of files) {
    const parsed = await parseTsv<RegionResultRaw>(file);
    results = [...results, ...transformRegionUpload(parsed, i)];
    i++;
  }
  return results;
};

const validateRegionResultUpload = (uploadedData: any[]) => {
  if (!uploadedData.length) {
    return "Region file is empty";
  }

  const fields = Object.keys(uploadedData[0]);
  const missing = ["chr", "end_bp", "start_bp", "region"].filter(
    (k) => !fields.includes(k),
  );

  if (missing.length) {
    return `The following fields are missing: ${missing.join(", ")}`;
  } else return "";
};

const _handleRegionVariantUpload = async (
  files: File[],
  regionData: RegionResult[],
) => {
  let results: VariantResult[] = [];
  const chrs = unique(regionData, "chr");

  const range =
    chrs.length == 1
      ? null
      : (extent(regionData.flatMap((r) => [r.start_bp, r.end_bp])) as [
          number,
          number,
        ]);

  // we need chr and range
  for (const file of files) {
    const variants = await processRegionVariants(file, chrs, range);
    results = results.concat(variants);
  }
  return results;
};

const validateRegionVariantUpload = (uploadedData: any[]) => {
  if (!uploadedData.length) {
    return "Variant file is empty or has no variants that match the current regions.";
  }

  const fields = Object.keys(uploadedData[0]);
  const missing = [
    "chr",
    "end_bp",
    "start_bp",
    "bp",
    "region",
    "sglm_pvalue",
  ].filter((k) => !fields.includes(k));

  if (missing.length) {
    return `The following fields are missing: ${missing.join(", ")}`;
  } else return "";
};

const Header: React.FC = () => {
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const [loading, setLoading] = useState(false);
  const [uploadErrors, setUploadErrors] = useState("");

  const pathname = usePathname();

  const { regionData, setRegionData, setRegionVariantData } = useContext(
    VisualizationDataContext,
  );

  const handleRegionUpload = useCallback(
    async (files: File[]) => {
      setLoading(true);
      setAnchorEl(null);
      const results = await _handleRegionUpload(files);
      const errors = validateRegionResultUpload(results);
      setLoading(false);

      if (errors) {
        return setUploadErrors(errors);
      }

      setRegionData(results);
    },
    [setRegionData],
  );

  const handleRegionVariantUpload = useCallback(
    async (files: File[]) => {
      setLoading(true);
      setAnchorEl(null);
      const results = await _handleRegionVariantUpload(files, regionData);
      const errors = validateRegionVariantUpload(results);
      setLoading(false);

      if (errors) {
        return setUploadErrors(errors);
      }

      setRegionVariantData(results);
    },
    [regionData, setRegionVariantData],
  );

  return (
    <AppBar position="static" color="primary" sx={{ marginBottom: 3 }}>
      <Toolbar component={Grid} container justifyContent="center">
        <Grid flexGrow={1} size={{ xs: 4 }}>
          {pathname === "/visualization" && (
            <>
              <Button
                onClick={(e) => setAnchorEl(e.currentTarget)}
                sx={{ color: "white" }}
                startIcon={<Upload />}
              >
                Upload Data
              </Button>
              <Menu
                id="upload-menu"
                aria-labelledby="upload-menu"
                anchorEl={anchorEl}
                open={!!anchorEl}
                onClose={() => setAnchorEl(null)}
                anchorOrigin={{
                  vertical: "top",
                  horizontal: "left",
                }}
                transformOrigin={{
                  vertical: "top",
                  horizontal: "left",
                }}
              >
                <MenuItem>
                  {" "}
                  <UploadButtonMulti
                    fileType="region"
                    onUpload={handleRegionUpload}
                  />
                </MenuItem>
                {!!regionData.length && (
                  <MenuItem>
                    {" "}
                    <UploadButtonMulti
                      fileType="variant"
                      onUpload={handleRegionVariantUpload}
                    />
                  </MenuItem>
                )}
              </Menu>
            </>
          )}
        </Grid>

        <Grid flexGrow={1} size={{ xs: 4 }}>
          <NavLink noDecoration href="/">
            <Typography textAlign="center" variant="h4">
              RegionScan Visualization
            </Typography>
          </NavLink>
        </Grid>
        <Grid
          flexGrow={1}
          size={{ xs: 4 }}
          justifyContent="flex-end"
          container
          spacing={3}
        >
          <Grid>
            <NavLink href="/visualization">Visualizations</NavLink>
          </Grid>
          <Grid>
            <NavLink href="/about">About</NavLink>
          </Grid>
        </Grid>
      </Toolbar>
      <LoadingOverlay open={loading} />
      <ValidationModal
        open={!!uploadErrors}
        errorMsg={uploadErrors}
        onClose={() => setUploadErrors("")}
      />
    </AppBar>
  );
};

export default Header;
