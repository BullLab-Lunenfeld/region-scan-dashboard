"use client";

import React from "react";
import {
  Button,
  Grid2 as Grid,
  lighten,
  Typography,
  Link as MuiLink,
  Divider,
  Link,
} from "@mui/material";
import { useRouter } from "next/navigation";
import Image, { StaticImageData } from "next/image";

import qqPlot from "/public/qq-plot.png";
import regionBasic from "/public/region-basic.png";
import regionDetail from "/public/region-detail.png";
import miamiPlot from "/public/miami-plot.png";
import dsiLogo from "/public/dsi-logo.png";
import ltLogo from "/public/105h300w_LunenfeldTanenbaumLogo.png";

const plots = [
  {
    height: 525,
    plot: miamiPlot,
    title: "Miami Plot",
    width: 1066,
  },
  {
    height: 535,
    plot: qqPlot,
    title: "QQ Plot",
    width: 1155,
  },
  {
    height: 526,
    plot: regionBasic,
    title: "Region Plot (Basic)",
    width: 1191,
  },
  {
    height: 522,
    plot: regionDetail,
    title: "Region Plot (Detail)",
    width: 1194,
  },
];

const LandingPage: React.FC = () => {
  const router = useRouter();

  return (
    <Grid
      container
      alignItems="center"
      justifyContent="center"
      direction="column"
      maxWidth="1500px"
      spacing={3}
      marginTop={4}
    >
      <Grid
        container
        justifyContent="center"
        direction="column"
        alignContent="center"
        spacing={4}
        size={{ xs: 12, md: 8 }}
      >
        <Grid>
          <Typography variant="h6" textAlign="center">
            RegionScan Visualization allows users to interact with the results
            of RegionScan analyses. You can learn more about RegionScan by
            reading the{" "}
            <MuiLink
              target="_blank"
              href="https://academic.oup.com/bioinformaticsadvances/article/5/1/vbaf052/8075147?login=false"
            >
              paper
            </MuiLink>
            , visiting the{" "}
            <MuiLink
              target="_blank"
              href="https://github.com/brossardMyriam/RegionScan"
            >
              GitHub repository
            </MuiLink>
            , or viewing the{" "}
            <MuiLink
              target="_blank"
              href="https://github.com/brossardMyriam/RegionScan/blob/main/vignettes/RegionScan.pdf"
            >
              Tutorial
            </MuiLink>
            .
          </Typography>
        </Grid>
        <Grid textAlign="center" marginBottom={2}>
          <Button
            onClick={() => router.push("/visualization")}
            variant="contained"
            size="large"
            sx={(theme) => ({
              padding: 2,
              fontSize: 16,
              borderRadius: 3,
              backgroundColor: theme.palette.primary.main,
            })}
          >
            Get Started
          </Button>
        </Grid>
      </Grid>
      <Grid
        container
        direction="row"
        size={{ xs: 12, md: 12 }}
        alignItems="flex-start"
      >
        {plots.map(({ height, plot, title, width }) => (
          <LandingPageImage
            key={title}
            alt={title}
            height={height}
            src={plot}
            title={title}
            width={width}
          />
        ))}
      </Grid>
      <Grid
        marginTop={5}
        container
        alignItems="center"
        direction="row"
        justifyContent="center"
        spacing={2}
        width="100%"
      >
        <Grid
          sx={(theme) => ({
            [theme.breakpoints.up("md")]: { textAlign: "right" },
            [theme.breakpoints.down("md")]: { textAlign: "center" },
          })}
          size={{ xs: 12, md: 4 }}
        >
          <Link href="https://www.lunenfeld.ca/" target="_blank">
            <Image
              style={{ width: 300, height: "auto" }}
              width={300}
              height={105}
              alt="LTRI Logo"
              src={ltLogo}
            />
          </Link>
        </Grid>
        <Grid
          sx={{ opacity: 0.4, display: { xs: "none", md: "block" } }}
          textAlign="center"
          size={{ md: 2 }}
        >
          |
        </Grid>
        <Grid
          sx={(theme) => ({
            [theme.breakpoints.up("md")]: { textAlign: "left" },
            [theme.breakpoints.down("md")]: { textAlign: "center" },
          })}
          size={{ xs: 12, md: 4 }}
        >
          <Link href="https://datasciences.utoronto.ca/" target="_blank">
            <Image
              style={{ width: 300, height: "auto" }}
              width={1576}
              height={251}
              alt="DSI Loo"
              src={dsiLogo}
            />
          </Link>
        </Grid>
      </Grid>
    </Grid>
  );
};

interface LandingPageImageProps {
  alt: string;
  height: number;
  src: StaticImageData;
  title: string;
  width: number;
}

const LandingPageImage: React.FC<LandingPageImageProps> = ({
  alt,
  height,
  src,
  title,
  width,
}) => (
  <Grid
    container
    direction="column"
    spacing={2}
    size={{ xs: 6 }}
    sx={{
      border: "solid lightgrey 1px",
      borderRadius: "4px",
      img: { width: "100%", height: "auto" },
    }}
  >
    <Grid
      padding={2}
      sx={(theme) => ({
        backgroundColor: lighten(theme.palette.primary.light, 0.2),
      })}
    >
      <Typography
        sx={(theme) => ({
          color: theme.palette.getContrastText(theme.palette.primary.light),
        })}
        textAlign="center"
        variant="h5"
      >
        {title}
      </Typography>
    </Grid>
    <Grid textAlign="center">
      <Image
        alt={alt}
        height={height}
        priority={false}
        src={src}
        width={width}
      />
    </Grid>
  </Grid>
);

export default LandingPage;
