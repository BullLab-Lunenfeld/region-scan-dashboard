"use client";

import React from "react";
import { styled } from "@mui/material/styles";
import Button, { ButtonProps } from "@mui/material/Button";
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

const UploadButton: React.FC<ButtonProps> = ({ children, variant }) => (
  <Button
    component="label"
    role={undefined}
    variant={variant}
    tabIndex={-1}
    startIcon={<CloudUploadIcon />}
  >
    {children}
  </Button>
);

interface BaseUploadButtonProps {
  fileType: FileType;
  variant?: ButtonProps["variant"];
}

interface UploadButtonSingleProps extends BaseUploadButtonProps {
  onUpload: (file: File) => void;
}

export const UploadButtonSingle: React.FC<UploadButtonSingleProps> = ({
  fileType,
  onUpload,
  variant,
}) => (
  <UploadButton variant={variant}>
    Upload {capitalize(fileType)} File
    <VisuallyHiddenInput
      type="file"
      onChange={({ target: { files } }) => files?.length && onUpload(files[0])}
      multiple
    />
  </UploadButton>
);

interface UploadButtonMultiProps extends BaseUploadButtonProps {
  onUpload: (files: File[]) => void;
}

export const UploadButtonMulti: React.FC<UploadButtonMultiProps> = ({
  fileType,
  onUpload,
}) => (
  <UploadButton>
    Upload {capitalize(fileType)} Files
    <VisuallyHiddenInput
      type="file"
      onChange={({ target: { files } }) =>
        files ? onUpload([...files]) : onUpload([])
      }
      multiple
    />
  </UploadButton>
);
