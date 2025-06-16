"use client";

import React, { useEffect } from "react";
import { Button, Grid2 as Grid, Typography } from "@mui/material";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <Grid container direction="column" alignItems="center">
      <Grid>
        <Typography color="error" textAlign="center" variant="h3">
          Something went wrong!
        </Typography>
      </Grid>
      <Grid>
        <Button onClick={() => reset()}>Try again</Button>
      </Grid>
    </Grid>
  );
}
