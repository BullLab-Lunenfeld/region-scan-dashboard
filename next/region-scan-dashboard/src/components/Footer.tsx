"use client";

import React from "react";
import { AppBar, Grid2 as Grid, Toolbar } from "@mui/material";

const Footer: React.FC = () => (
  <AppBar
    position="relative"
    color="primary"
    sx={{
      top: "auto",
      bottom: 0,
      marginTop: 2,
      backgroundColor: (theme) => theme.palette.grey["700"],
    }}
  >
    <Toolbar>
      <Grid container justifyContent="center" flexGrow={1}>
        Copyright {new Date().getFullYear()} RegionScan
      </Grid>
    </Toolbar>
  </AppBar>
);

export default Footer;
