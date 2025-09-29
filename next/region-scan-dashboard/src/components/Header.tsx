"use client";

import React, { useCallback, useContext, useEffect, useState } from "react";
import {
  AppBar,
  Button,
  Grid2 as Grid,
  IconButton,
  ListSubheader,
  Menu,
  MenuItem,
  Toolbar,
  Typography,
} from "@mui/material";
import { extent } from "d3-array";
import { Check, Settings, Upload } from "@mui/icons-material";
import { usePathname } from "next/navigation";
import NavLink from "./NavLink";
import {
  OverflowSetting,
  transformPLog10,
  transformPLog10Log10,
  VisualizationDataContext,
} from "./AppContainer";
import LoadingOverlay from "./LoadingOverlay";
import ValidationModal from "./ValidationModal";
import { UploadButtonMulti } from "./UploadButton";
import NumberInput from "./NumberInput";
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
  const [loading, setLoading] = useState(false);
  const [uploadErrors, setUploadErrors] = useState("");

  const pathname = usePathname();

  const { regionData, setRegionData, setRegionVariantData } = useContext(
    VisualizationDataContext,
  );

  const handleRegionUpload = useCallback(
    async (files: File[]) => {
      setLoading(true);
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
        <Grid
          alignItems="center"
          spacing={2}
          container
          flexGrow={1}
          size={{ xs: 4 }}
        >
          {pathname === "/visualization" && (
            <>
              <Grid>
                <UploadDataDropdown
                  handleRegionUpload={handleRegionUpload}
                  handleVariantUpload={handleRegionVariantUpload}
                  showVariantUpload={!!regionData.length}
                />
              </Grid>
              <Grid>
                <SettingsDropdown />
              </Grid>
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

interface UploadDataDropdownProps {
  handleRegionUpload: (files: File[]) => void;
  handleVariantUpload: (files: File[]) => void;
  showVariantUpload: boolean;
}

const UploadDataDropdown: React.FC<UploadDataDropdownProps> = ({
  handleRegionUpload,
  handleVariantUpload,
  showVariantUpload,
}) => {
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  return (
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
          <UploadButtonMulti
            fileType="region"
            onUpload={(files) => {
              handleRegionUpload(files);
              setAnchorEl(null);
            }}
          />
        </MenuItem>
        {showVariantUpload && (
          <MenuItem>
            <UploadButtonMulti
              fileType="variant"
              onUpload={(files) => {
                handleVariantUpload(files);
                setAnchorEl(null);
              }}
            />
          </MenuItem>
        )}
      </Menu>
    </>
  );
};

const SettingsDropdown: React.FC = () => {
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);

  const { transformPValue, setTransformPValue, overflows, setOverflows } =
    useContext(VisualizationDataContext);

  return (
    <>
      <IconButton
        onClick={(e) => setAnchorEl(e.currentTarget)}
        sx={(theme) => ({
          color: theme.palette.getContrastText(theme.palette.primary.dark),
        })}
      >
        <Settings />
      </IconButton>

      <Menu
        id="settings-menu"
        aria-labelledby="settings-menu"
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
        <ListSubheader>P VALUE FORMAT</ListSubheader>
        <Log10MenuItem
          val="-log10"
          selected={transformPValue == transformPLog10}
          onClick={() => setTransformPValue(() => transformPLog10)}
        />
        <Log10MenuItem
          val="log10(-log10)"
          selected={transformPValue == transformPLog10Log10}
          onClick={() => setTransformPValue(() => transformPLog10Log10)}
        />
        <ListSubheader>MIAMI Y-AXIS OVERFLOW</ListSubheader>
        <OverflowMenuItem
          title="Upper variable"
          onChange={(d) => setOverflows({ ...overflows, ...{ upper: d } })}
          values={overflows["upper"]}
        />
        <OverflowMenuItem
          title="Lower variable"
          onChange={(d) => setOverflows({ ...overflows, ...{ lower: d } })}
          values={overflows["lower"]}
        />
      </Menu>
    </>
  );
};

interface Log10MenuItemProps {
  onClick: () => void;
  selected?: boolean;
  val: string;
}

const Log10MenuItem: React.FC<Log10MenuItemProps> = ({
  onClick,
  selected,
  val,
}) => (
  <MenuItem onClick={onClick}>
    <Grid
      container
      flexGrow={1}
      justifyContent="space-between"
      alignItems="center"
    >
      <Grid>{val}</Grid>
      <Grid>{selected ? <Check fontSize="small" /> : ""}</Grid>
    </Grid>
  </MenuItem>
);

interface OverflowMenuItemProps {
  onChange: (setting: OverflowSetting) => void;
  title: string;
  values: OverflowSetting;
}

const OverflowMenuItem: React.FC<OverflowMenuItemProps> = ({
  onChange,
  title,
  values,
}) => {
  const [pThresh, setPThresh] = useState(values.pThresh);
  const [range, setRange] = useState(values.range);
  const [rangeError, setRangeError] = useState(false);

  useEffect(() => {
    if (range > 100 || range < 0) {
      setRangeError(true);
    } else if (rangeError) {
      setRangeError(false);
    }
  }, [range, rangeError]);

  return (
    <MenuItem
      onKeyDown={(e) => {
        //prevent closing the menu
        if (e.key === "Tab") {
          e.stopPropagation();
        }
      }}
    >
      {/* submit on enter keypress */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!rangeError) {
            onChange({ pThresh, range });
          }
        }}
      >
        <Grid
          container
          flexGrow={1}
          justifyContent="space-between"
          alignItems="center"
          direction="column"
          spacing={1}
        >
          <Grid>{title}</Grid>
          <Grid>
            <NumberInput
              label="P-threshold (-log10)"
              onChange={setPThresh}
              value={pThresh}
            />
          </Grid>
          <Grid>
            <NumberInput
              label="Pixel range"
              onChange={setRange}
              value={range}
              error={rangeError ? "Range must be betwee 1 and 100" : undefined}
            />
          </Grid>
          <Button type="submit" sx={{ display: "none" }} />
        </Grid>
      </form>
    </MenuItem>
  );
};

export default Header;
