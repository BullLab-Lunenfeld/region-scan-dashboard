"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Grid2 as Grid } from "@mui/material";
import ShortTextField from "./ShortTextField";

interface NumberInputProps {
  error?: string;
  label: string;
  onChange: (arg: number) => void;
  value: number;
  width?: string;
}

export const NumberInput: React.FC<NumberInputProps> = ({
  error,
  label,
  onChange,
  value,
  width,
}) => {
  const [internalValue, setInternalValue] = useState<
    number | string | undefined
  >(+value || 0);

  useEffect(() => {
    setInternalValue(value);
  }, [value]);

  const localOnChange = useCallback(
    (arg: string) => {
      // allow only valid or potentially valid numeric inputs
      if (
        /^-?.*(\.|(\.[0-9]*)0|e-?)$/.test(arg) ||
        ["", "-", "-.", "-0."].includes(arg) ||
        (!isNaN(+arg) && !isNaN(parseFloat(arg)))
      ) {
        setInternalValue(arg);
        if (!isNaN(+arg) && !isNaN(parseFloat(arg))) {
          onChange(+arg);
        }
      }
      //otherwise (e.g., input is not a number or number-like) do nothing
    },
    [onChange],
  );

  return (
    <Grid container wrap="nowrap" spacing={1} alignItems="center">
      <Grid>
        <ShortTextField
          onChange={(e) => localOnChange(e.currentTarget.value)}
          value={internalValue}
          label={label}
          error={!!error}
          helperText={error}
          width={width}
        />
      </Grid>
    </Grid>
  );
};

export default NumberInput;
