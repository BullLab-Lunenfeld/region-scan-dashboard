"use client";

import React, {
  createContext,
  Dispatch,
  SetStateAction,
  useState,
} from "react";
import { Box, Container } from "@mui/material";
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

interface VisualizationDataContext {
  overflows: OverflowScaleSettings;
  regionData: RegionResult[];
  regionVariantData: VariantResult[];
  setOverflows: (data: OverflowScaleSettings) => void;
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

export const VisualizationDataContext = createContext<VisualizationDataContext>(
  {
    transformPValue: () => 0,
    regionData: [],
    regionVariantData: [],
    setOverflows: () => null,
    setTransformPValue: () => null,
    setThreshold: () => null,
    setRegionData: () => null,
    setRegionVariantData: () => null,
    thresholds: {
      miamiBottom: 5e-6,
      miamiTop: 5e-6,
      regionRegion: 5e-6,
      regionVariant: 5e-6,
    },
    overflows: {
      upper: {
        pThresh: 250,
        range: 20,
      },
      lower: {
        pThresh: 250,
        range: 20,
      },
    },
  },
);

const AppContainer: React.FC<AppContainerProps> = ({ children }) => {
  const [transformPValue, setTransformPValue] = useState<
    (pval: number) => number
  >(() => transformPLog10);
  const [regionData, setRegionData] = useState<RegionResult[]>([]);
  const [regionVariantData, setRegionVariantData] = useState<VariantResult[]>(
    [],
  );
  const [thresholds, setThresholds] = useState<PlotThresholds>({
    miamiBottom: 5e-6,
    miamiTop: 5e-6,
    regionRegion: 5e-6,
    regionVariant: 5e-7,
  });

  const [overflows, setOverflows] = useState<OverflowScaleSettings>({
    upper: {
      pThresh: 250,
      range: 20,
    },
    lower: {
      pThresh: 250,
      range: 20,
    },
  });

  const setThreshold = (name: keyof PlotThresholds, val: number) =>
    setThresholds((thresholds) => ({ ...thresholds, [name]: val }));

  return (
    <VisualizationDataContext.Provider
      value={{
        overflows,
        regionData,
        regionVariantData,
        setOverflows,
        setRegionData,
        setRegionVariantData,
        setThreshold,
        setTransformPValue,
        thresholds,
        transformPValue,
      }}
    >
      <Container maxWidth={false}>
        <Header />
        <Box flexGrow={1} overflow="auto" padding={2}>
          {children}
        </Box>
      </Container>
    </VisualizationDataContext.Provider>
  );
};

export default AppContainer;
