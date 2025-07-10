import React from "react";

import { Button, Grid2 as Grid, Typography } from "@mui/material";
import { Modal } from ".";

interface ValidationModalProps {
  errorMsg: string;
  onClose: () => void;
  open: boolean;
}

const ValidationModal: React.FC<ValidationModalProps> = ({
  errorMsg,
  onClose,
  open,
}) => (
  <Modal open={open} handleClose={onClose}>
    <Grid alignItems="center" spacing={2} direction="column" container>
      <Grid paddingBottom={4}>
        <Typography color="error" variant="h6">
          Data Invalid!
        </Typography>
      </Grid>
      <Grid>
        <Typography textAlign="center">{errorMsg}</Typography>
      </Grid>
      <Grid>
        <Button onClick={onClose}>Close</Button>
      </Grid>
    </Grid>
  </Modal>
);

export default ValidationModal;
