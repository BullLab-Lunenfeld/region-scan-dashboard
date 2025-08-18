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

export const transformPLog10 = (pval: number) => -Math.log10(pval);
export const transformPLog10Log10 = (pval: number) =>
  Math.log10(-Math.log10(pval));

interface VisualizationDataContext {
  transformPValue: (pval: number) => number;
  regionData: RegionResult[];
  regionVariantData: VariantResult[];
  setTransformPValue: Dispatch<SetStateAction<(pval: number) => number>>;
  setRegionData: (data: RegionResult[]) => void;
  setRegionVariantData: (data: VariantResult[]) => void;
  setThreshold: (name: keyof PlotThresholds, val: number) => void;
  thresholds: PlotThresholds;
}

interface AppContainerProps {
  children: React.ReactNode;
}

export const VisualizationDataContext = createContext<VisualizationDataContext>(
  {
    transformPValue: () => 0,
    regionData: [],
    regionVariantData: [],
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

  const setThreshold = (name: keyof PlotThresholds, val: number) =>
    setThresholds((thresholds) => ({ ...thresholds, [name]: val }));

  return (
    <VisualizationDataContext.Provider
      value={{
        transformPValue,
        regionData,
        regionVariantData,
        setTransformPValue,
        setRegionData,
        setRegionVariantData,
        setThreshold,
        thresholds,
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
