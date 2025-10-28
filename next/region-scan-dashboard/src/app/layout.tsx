import React from "react";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v14-appRouter";
import CssBaseline from "@mui/material/CssBaseline";

import { ThemeProvider } from "@mui/material/styles";

import theme from "../lib/mui/theme";
import { AppContainer } from "@/components";
import { Footer } from "@/components";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "RegionScan Visualization",
  description: "A visualization suite for RegionScan results",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
      </head>
      <body className={inter.className}>
        <AppRouterCacheProvider options={{ enableCssLayer: true }}>
          <ThemeProvider theme={theme}>
            <CssBaseline />
            <AppContainer>{children}</AppContainer>
            <Footer />
          </ThemeProvider>
        </AppRouterCacheProvider>
      </body>
    </html>
  );
}
