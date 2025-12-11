import React from "react";
import { Autocomplete, TextField } from "@mui/material";

interface AutocompleteSearchProps<T> {
  error?: boolean;
  fullWidth?: boolean;
  getOptionLabel: (arg: T) => string;
  helperText?: string;
  label?: string;
  options: T[];
  onSearchChange: (text: string) => void;
  onSelect: (selectedOption: T | null) => void;
  searchText: string;
  value: T;
}

function AutocompleteSearch<T>({
  error,
  getOptionLabel,
  helperText,
  label,
  options,
  onSearchChange,
  onSelect,
  searchText,
  value,
}: AutocompleteSearchProps<T>) {
  return (
    <Autocomplete
      /* https://github.com/mui/material-ui/issues/4736#issuecomment-1122428108 */
      //key={refreshKey}
      clearOnBlur={false}
      clearOnEscape={false}
      fullWidth
      disablePortal
      getOptionLabel={getOptionLabel}
      openOnFocus={true}
      onInputChange={(_, v) => {
        onSearchChange(v);
      }}
      onChange={(_, v: T | null) => onSelect(v)}
      options={options}
      renderInput={(params) => (
        <TextField
          {...params}
          InputProps={{
            ...params.InputProps,
            sx: (theme) => ({
              "& fieldset": {
                borderWidth: "2 px",
                borderStyle: "solid",
                borderColor: theme.palette.primary.light,
                borderRadius: "5px",
              },
            }),
          }}
          sx={{ color: "green" }}
          error={error}
          helperText={helperText}
          label={label || "Search"}
          variant="outlined"
          value={searchText}
        />
      )}
      isOptionEqualToValue={(option, value) => option === value}
      value={value}
    />
  );
}
export default AutocompleteSearch;
