"use client";

import React, { createContext, useState } from "react";
import { Box, Container } from "@mui/material";
import Header from "./Header";
import { RegionResult, VariantResult } from "@/lib/ts/types";

export interface PlotThresholds {
  miamiBottom: number;
  miamiTop: number;
  regionRegion: number;
  regionVariant: number;
}

interface VisualizationDataContext {
  regionData: RegionResult[];
  regionVariantData: VariantResult[];
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
    regionData: [],
    regionVariantData: [],
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
        regionData,
        regionVariantData,
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
