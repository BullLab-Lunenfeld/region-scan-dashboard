"use client";

import React, { createContext, useState } from "react";
import { Box, Container } from "@mui/material";
import Header from "./Header";
import { RegionResult, VariantResult } from "@/lib/ts/types";

interface VisualizationDataContext {
  regionData: RegionResult[];
  regionVariantData: VariantResult[];
  setRegionData: (data: RegionResult[]) => void;
  setRegionVariantData: (data: VariantResult[]) => void;
}

interface AppContainerProps {
  children: React.ReactNode;
}

export const VisualizationDataContext = createContext<VisualizationDataContext>(
  {
    regionData: [],
    regionVariantData: [],
    setRegionData: () => null,
    setRegionVariantData: () => null,
  },
);

const AppContainer: React.FC<AppContainerProps> = ({ children }) => {
  const [regionData, setRegionData] = useState<RegionResult[]>([]);
  const [regionVariantData, setRegionVariantData] = useState<VariantResult[]>(
    [],
  );

  return (
    <VisualizationDataContext.Provider
      value={{
        regionData,
        regionVariantData,
        setRegionData,
        setRegionVariantData,
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
