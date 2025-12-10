"use client";

import React, { useCallback, useContext, useState } from "react";
import {
  AppBar,
  Button,
  Checkbox,
  FormControlLabel,
  Grid2 as Grid,
  IconButton,
  ListSubheader,
  Menu,
  MenuItem,
  Radio,
  RadioGroup,
  Toolbar,
  Typography,
} from "@mui/material";
import { extent } from "d3-array";
import { schemeTableau10 } from "d3-scale-chromatic";
import { Settings, Upload } from "@mui/icons-material";
import { usePathname } from "next/navigation";
import NavLink from "./NavLink";
import {
  MiamiType,
  MiamiYType,
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
  parseTabular,
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
    val.id = +`${i + 1}${j + 1}` * Math.random();
    return Object.fromEntries(
      getEntries(val)
        .map<[keyof RegionResultRaw, number | string | null]>(([k, v]) => {
          let k_ = colMap[k as keyof RegionResultRawOld] || k;
          k_ = k_.replaceAll(".", "_") as keyof RegionResultRaw;
          return [k_, v ? (["gene"].includes(k_) ? v : +v) : null];
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
    const parsed = await parseTabular<RegionResultRaw>(file);
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

// https://davidmathlogic.com/colorblind/#%23332288-%23117733-%2344AA99-%2388CCEE-%23CC6677-%23AA4499-%23882255-%232ff55d-%237b40c1-%23457df4
const COLOR_BLIND_PALETTE: readonly string[] = [
  "#332288",
  "#117733",
  "#44AA99",
  "#88CCEE",
  "#CC6677",
  "#AA4499",
  "#882255",
  "#2FF55D",
  "#7B40C1",
  "#457DF4",
];

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
          size={{ xs: 4, lg: 3 }}
        >
          <Grid>
            <NavLink href="/user-guide">User Guide</NavLink>
          </Grid>
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
        <Grid flexGrow={1} size={{ xs: 4, lg: 6 }}>
          <NavLink noDecoration href="/">
            <Typography textAlign="center" variant="h3">
              RegionScan Visualization
            </Typography>
          </NavLink>
        </Grid>
        <Grid
          flexGrow={1}
          size={{ xs: 4, lg: 3 }}
          justifyContent="flex-end"
          container
          spacing={3}
        >
          <Grid>
            <NavLink href="/visualization">Visualizations</NavLink>
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

  const {
    miamiType,
    miamiYType,
    setMiamiType,
    setMiamiYType,
    overflows,
    setOverflows,
    palette,
    qqPlotVisible,
    setPalette,
    setQqPlotVisible,
  } = useContext(VisualizationDataContext);
  const [upperPThresh, setUpperPThresh] = useState(overflows.upper.pThresh);
  const [lowerPThresh, setLowerPThresh] = useState(overflows.lower.pThresh);
  const [upperRange, setUpperRange] = useState(overflows.upper.range);
  const [lowerRange, setLowerRange] = useState(overflows.lower.range);
  const [overfloweErrorUpper, setOverflowErrorUpper] = useState(false);
  const [overfloweErrorLower, setOverflowErrorLower] = useState(false);

  const submitOverflowSettings = () =>
    setOverflows({
      upper: { range: upperRange, pThresh: upperPThresh },
      lower: { range: lowerRange, pThresh: lowerPThresh },
    });

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
        onClose={() => {
          setUpperPThresh(overflows.upper.pThresh);
          setLowerPThresh(overflows.lower.pThresh);
          setUpperRange(overflows.upper.range);
          setLowerRange(overflows.lower.range);
          setAnchorEl(null);
        }}
        anchorOrigin={{
          vertical: "top",
          horizontal: "left",
        }}
        transformOrigin={{
          vertical: "top",
          horizontal: "left",
        }}
      >
        <ListSubheader>PALETTE</ListSubheader>
        <MenuItem>
          <RadioGroup
            onChange={(e) => {
              if (e.currentTarget.value === "default") {
                setPalette(schemeTableau10);
              } else {
                setPalette(COLOR_BLIND_PALETTE);
              }
            }}
          >
            <FormControlLabel
              checked={palette === schemeTableau10}
              value={"default"}
              control={<Radio size="small" />}
              label="Default"
            />
            <FormControlLabel
              checked={palette === COLOR_BLIND_PALETTE}
              value="color-blind"
              control={<Radio size="small" />}
              label="Colour Blind"
            />
          </RadioGroup>
        </MenuItem>
        <ListSubheader>QQ PLOT</ListSubheader>
        <MenuItem>
          <FormControlLabel
            control={
              <Checkbox
                checked={qqPlotVisible}
                onChange={() => setQqPlotVisible(!qqPlotVisible)}
              />
            }
            label="Show QQ Plot"
          />
        </MenuItem>
        <ListSubheader>MIAMI Y-AXIS Type</ListSubheader>
        <MenuItem>
          <RadioGroup
            onChange={(e) => {
              setMiamiYType(e.currentTarget.value as MiamiYType);
            }}
          >
            <FormControlLabel
              checked={miamiYType === "dynamic"}
              value={"dynamic"}
              control={<Radio size="small" />}
              label="Dynamic"
            />
            <FormControlLabel
              checked={miamiYType === "static"}
              value="static"
              control={<Radio size="small" />}
              label="Static"
            />
          </RadioGroup>
        </MenuItem>
        <ListSubheader>MIAMI Plot Type</ListSubheader>
        <MenuItem>
          <RadioGroup
            onChange={(e) => {
              setMiamiType(e.currentTarget.value as MiamiType);
            }}
          >
            <FormControlLabel
              checked={miamiType === "scatter"}
              value={"scatter"}
              control={<Radio size="small" />}
              label="Scatter"
            />
            <FormControlLabel
              checked={miamiType === "area"}
              value="area"
              control={<Radio size="small" />}
              label="Area"
            />
          </RadioGroup>
        </MenuItem>
        <ListSubheader>MIAMI Y-AXIS OVERFLOW</ListSubheader>
        <OverflowMenuItem
          title="Upper variable"
          onChangePThresh={setUpperPThresh}
          onChangeRange={setUpperRange}
          pThresh={upperPThresh}
          range={upperRange}
          setError={setOverflowErrorUpper}
        />
        <OverflowMenuItem
          title="Lower variable"
          onChangePThresh={setLowerPThresh}
          onChangeRange={setLowerRange}
          pThresh={lowerPThresh}
          range={lowerRange}
          setError={setOverflowErrorLower}
        />
        <Grid textAlign="center">
          <Button
            onClick={submitOverflowSettings}
            disabled={overfloweErrorLower || overfloweErrorUpper}
          >
            Submit
          </Button>
        </Grid>
      </Menu>
    </>
  );
};

interface OverflowMenuItemProps {
  onChangePThresh: (val: number) => void;
  onChangeRange: (val: number) => void;
  pThresh: number;
  range: number;
  setError: (hasError: boolean) => void;
  title: string;
}

const OverflowMenuItem: React.FC<OverflowMenuItemProps> = ({
  onChangePThresh,
  onChangeRange,
  pThresh,
  range,
  setError,
  title,
}) => {
  const [rangeError, setRangeError] = useState(false);
  const [threshError, setThreshError] = useState(false);

  const setRange = (range: number) => {
    if (range > 100 || range < 0) {
      setRangeError(true);
      setError(true);
    } else {
      if (rangeError) {
        setRangeError(false);
        setError(false);
      }
      onChangeRange(range);
    }
  };

  const setPThresh = (thresh: number) => {
    if (thresh < 0) {
      setThreshError(true);
      setError(true);
    } else {
      if (threshError) {
        setError(false);
        setThreshError(false);
      }
      onChangePThresh(thresh);
    }
  };

  return (
    <MenuItem
      onKeyDown={(e) => {
        //prevent closing the menu on tab
        if (e.key === "Tab") {
          e.stopPropagation();
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
            error={threshError ? "Threshold cannot be negative" : undefined}
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
    </MenuItem>
  );
};

export default Header;
