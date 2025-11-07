"use client";

import React, {
  createContext,
  Dispatch,
  SetStateAction,
  useState,
} from "react";
import { Box, Container } from "@mui/material";
import { schemeTableau10 } from "d3-scale-chromatic";
import Header from "./Header";
import { RegionResult, VariantResult } from "@/lib/ts/types";

export interface PlotThresholds {
  miamiBottom: number;
  miamiTop: number;
  regionRegion: number;
  regionVariant: number;
}

export interface OverflowSetting {
  pThresh: number;
  range: number;
}

export interface OverflowScaleSettings {
  upper: OverflowSetting;
  lower: OverflowSetting;
}

export const transformPLog10 = (pval: number) => -Math.log10(pval);
export const transformPLog10Log10 = (pval: number) =>
  Math.log10(-Math.log10(pval));

export type MiamiYType = "dynamic" | "static";
export type MiamiType = "area" | "scatter";

interface VisualizationDataContext {
  miamiType: MiamiType;
  miamiYType: MiamiYType;
  overflows: OverflowScaleSettings;
  palette: readonly string[];
  qqPlotVisible: boolean;
  regionData: RegionResult[];
  regionVariantData: VariantResult[];
  setMiamiType: (type: MiamiType) => void;
  setMiamiYType: (type: MiamiYType) => void;
  setOverflows: (data: OverflowScaleSettings) => void;
  setPalette: (palette: readonly string[]) => void;
  setQqPlotVisible: (visible: boolean) => void;
  setRegionData: (data: RegionResult[]) => void;
  setRegionVariantData: (data: VariantResult[]) => void;
  setThreshold: (name: keyof PlotThresholds, val: number) => void;
  setTransformPValue: Dispatch<SetStateAction<(pval: number) => number>>;
  thresholds: PlotThresholds;
  transformPValue: (pval: number) => number;
}

interface AppContainerProps {
  children: React.ReactNode;
}

const DEFAULT_THRESHOLDS = {
  miamiBottom: 5e-6,
  miamiTop: 5e-6,
  regionRegion: 5e-6,
  regionVariant: 5e-6,
};

const DEFAULT_OVERFLOWS = {
  upper: {
    pThresh: 250,
    range: 50,
  },
  lower: {
    pThresh: 250,
    range: 50,
  },
};

export const VisualizationDataContext = createContext<VisualizationDataContext>(
  {
    miamiType: "scatter",
    miamiYType: "dynamic",
    overflows: DEFAULT_OVERFLOWS,
    palette: schemeTableau10,
    qqPlotVisible: true,
    regionData: [],
    regionVariantData: [],
    setMiamiType: () => null,
    setMiamiYType: () => null,
    setOverflows: () => null,
    setPalette: () => null,
    setQqPlotVisible: () => null,
    setTransformPValue: () => null,
    setThreshold: () => null,
    setRegionData: () => null,
    setRegionVariantData: () => null,
    thresholds: DEFAULT_THRESHOLDS,
    transformPValue: () => 0,
  },
);

const AppContainer: React.FC<AppContainerProps> = ({ children }) => {
  const [miamiType, setMiamiType] = useState<MiamiType>("scatter");
  const [miamiYType, setMiamiYType] = useState<MiamiYType>("dynamic");

  const [qqPlotVisible, setQqPlotVisible] = useState(true);
  const [palette, setPalette] = useState<readonly string[]>(schemeTableau10);
  const [transformPValue, setTransformPValue] = useState<
    (pval: number) => number
  >(() => transformPLog10);
  const [regionData, setRegionData] = useState<RegionResult[]>([]);
  const [regionVariantData, setRegionVariantData] = useState<VariantResult[]>(
    [],
  );
  const [thresholds, setThresholds] =
    useState<PlotThresholds>(DEFAULT_THRESHOLDS);

  const [overflows, setOverflows] =
    useState<OverflowScaleSettings>(DEFAULT_OVERFLOWS);

  const setThreshold = (name: keyof PlotThresholds, val: number) =>
    setThresholds((thresholds) => ({ ...thresholds, [name]: val }));

  return (
    <VisualizationDataContext.Provider
      value={{
        miamiType,
        miamiYType,
        overflows,
        palette,
        qqPlotVisible,
        regionData,
        regionVariantData,
        setMiamiType,
        setMiamiYType,
        setOverflows,
        setPalette,
        setQqPlotVisible,
        setRegionData,
        setRegionVariantData,
        setThreshold,
        setTransformPValue,
        thresholds,
        transformPValue,
      }}
    >
      <Container maxWidth={false} sx={{ minHeight: "92vh" }}>
        <Header />
        <Box flexGrow={1} overflow="auto" padding={2}>
          {children}
        </Box>
      </Container>
    </VisualizationDataContext.Provider>
  );
};

export default AppContainer;
