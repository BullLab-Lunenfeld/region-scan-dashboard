"use client";

import React from "react";
import { ScaleOrdinal } from "d3-scale";
import { Checkbox, FormControlLabel } from "@mui/material";

interface PvarCheckboxProps {
  checked: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement>, checked: boolean) => void;
  pvalScale: ScaleOrdinal<string, string, never>;
  value: string;
}

const PvarCheckbox: React.FC<PvarCheckboxProps> = ({
  checked,
  onChange,
  pvalScale,
  value,
}) => (
  <FormControlLabel
    label={value}
    control={
      <Checkbox
        size="small"
        sx={{
          padding: "4px",
          color: pvalScale(value),
          "&.Mui-checked": {
            color: pvalScale(value),
          },
        }}
        value={value}
        checked={checked}
        onChange={onChange}
      />
    }
  />
);

export default PvarCheckbox;
