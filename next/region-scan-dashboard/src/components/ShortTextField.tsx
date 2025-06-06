import React from "react";
import { TextField, TextFieldProps } from "@mui/material";

const ShortTextField: React.FC<TextFieldProps & { width?: string }> = ({
  sx,
  width,
  ...props
}) => (
  <TextField {...props} sx={{ ...sx, width: width ?? "150px" }} size="small" />
);

export default ShortTextField;
