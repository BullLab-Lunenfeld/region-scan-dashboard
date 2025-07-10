"use client";

import React from "react";
import { Button, Grid2 as Grid, Typography } from "@mui/material";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";

import viz1 from "../../public/viz-ss-1.png";

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
        <Typography textAlign="center" variant="h5">
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
      <Grid textAlign="center">
        <Image
          alt={"visualization"}
          height={793}
          priority={false}
          src={viz1}
          width={879}
        />
      </Grid>
    </Grid>
  );
};

export default LandingPage;
