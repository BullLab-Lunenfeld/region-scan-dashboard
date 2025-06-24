import React from "react";
import { Grid2 as Grid, Icon, Typography } from "@mui/material";
import { WarningOutlined } from "@mui/icons-material";
import { Modal } from ".";

interface ErrorModalProps {
  message: string;
  onClose: () => void;
  open: boolean;
}

const ErrorModal: React.FC<ErrorModalProps> = ({ message, onClose, open }) => (
  <Modal open={open} handleClose={onClose}>
    <Grid spacing={3} container direction="column" alignItems="center">
      <Grid>
        <Icon color="warning" fontSize="large">
          <WarningOutlined fontSize="large" />
        </Icon>
      </Grid>
      <Grid>
        <Typography>{message}</Typography>
      </Grid>
    </Grid>
  </Modal>
);

export default ErrorModal;
