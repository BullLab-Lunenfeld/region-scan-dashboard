import React from "react";
import { TextField, TextFieldProps } from "@mui/material";

const ShortTextField: React.FC<TextFieldProps> = ({ sx, ...props }) => (
  <TextField {...props} sx={{ ...sx, width: "150px" }} size="small" />
);

export default ShortTextField;
