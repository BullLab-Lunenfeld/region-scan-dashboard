"use client";

import React from "react";
import { styled } from "@mui/material/styles";
import Button from "@mui/material/Button";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import { capitalize } from "@mui/material";
import { FileType } from "@/lib/ts/types";

const VisuallyHiddenInput = styled("input")({
  clip: "rect(0 0 0 0)",
  clipPath: "inset(50%)",
  height: 1,
  overflow: "hidden",
  position: "absolute",
  bottom: 0,
  left: 0,
  whiteSpace: "nowrap",
  width: 1,
});

interface UploadButtonProps {
  fileType: FileType;
  onUpload: (files: File[]) => void;
}

const UploadButton: React.FC<UploadButtonProps> = ({ fileType, onUpload }) => (
  <Button
    component="label"
    role={undefined}
    variant="contained"
    tabIndex={-1}
    startIcon={<CloudUploadIcon />}
  >
    Upload {capitalize(fileType)} Files
    <VisuallyHiddenInput
      type="file"
      onChange={({ target: { files } }) =>
        files ? onUpload([...files]) : onUpload([])
      }
      multiple
    />
  </Button>
);

export default UploadButton;
