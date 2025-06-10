import React from "react";
import { Modal as MuiModal } from "@mui/material";
import { Box } from "@mui/system";

const style = {
  position: "absolute",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  width: 400,
  bgcolor: "background.paper",
  border: "2px solid #000",
  boxShadow: 24,
  p: 3,
};

interface ModalProps {
  children: React.ReactNode;
  handleClose: () => void;
  open: boolean;
  width?: number;
}

const Modal: React.FC<ModalProps> = ({
  children,
  handleClose,
  open,
  width,
}) => {
  if (width) {
    style.width = width;
  }

  return (
    <MuiModal
      open={open}
      onClose={handleClose}
      aria-labelledby="modal-modal-title"
      aria-describedby="modal-modal-description"
    >
      <Box sx={style}>{children}</Box>
    </MuiModal>
  );
};

export default Modal;
