"use client";

import React from "react";
import { Button, Grid2 as Grid, Typography } from "@mui/material";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image, { StaticImageData } from "next/image";

import miamiPlot from "../../public/miami-plot.png";
import qqPlot from "../../public/qq-plot.png";
import regionBasic from "../../public/region-basic.png";
import regionDetail from "../../public/region-detail.png";

const plots = [
  {
    height: 362,
    plot: miamiPlot,
    title: "Miami Plot",
    width: 718,
  },
  {
    cssWidth: "auto",
    cssHeight: "auto",
    height: 476,
    plot: qqPlot,
    title: "QQ Plot",
    width: 488,
  },
  {
    height: 357,
    plot: regionBasic,
    title: "Region Plot (Basic)",
    width: 869,
  },
  {
    height: 384,
    plot: regionDetail,
    title: "Region Plot (Detail)",
    width: 895,
  },
];

const LandingPage: React.FC = () => {
  const router = useRouter();

  return (
    <Grid
      container
      direction="column"
      alignContent="center"
      spacing={4}
      wrap="nowrap"
    >
      <Grid offset={3} size={{ xs: 6 }}>
        <Typography textAlign="center" variant="h4">
          RegionScan Visualization allows users to interact with the results of{" "}
          <Link
            target="_blank"
            href="https://academic.oup.com/bioinformaticsadvances/article/5/1/vbaf052/8075147?login=false"
          >
            RegionScan analyses
          </Link>
          .
        </Typography>
      </Grid>
      <Grid textAlign="center">
        <Button
          onClick={() => router.push("/visualization")}
          variant="contained"
        >
          Get Started
        </Button>
      </Grid>
      <Grid container direction="row">
        {plots.map(({ cssHeight, cssWidth, height, plot, title, width }) => (
          <LandingPageImage
            key={title}
            alt={title}
            cssHeight={cssHeight}
            cssWidth={cssWidth}
            height={height}
            src={plot}
            title={title}
            width={width}
          />
        ))}
      </Grid>
    </Grid>
  );
};

interface LandingPageImageProps {
  alt: string;
  cssHeight?: string | number;
  cssWidth?: string | number;
  height: number;
  src: StaticImageData;
  title: string;
  width: number;
}

const LandingPageImage: React.FC<LandingPageImageProps> = ({
  alt,
  cssHeight,
  cssWidth,
  height,
  src,
  title,
  width,
}) => (
  <Grid
    container
    direction="column"
    spacing={2}
    sx={{
      border: "solid lightgrey 1px",
      borderRadius: "4px",
      img: { width: cssWidth ?? "100%", height: cssHeight ?? "auto" },
    }}
    size={{ xs: 12, md: 6 }}
  >
    <Grid
      padding={2}
      sx={(theme) => ({ backgroundColor: theme.palette.primary.light })}
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
