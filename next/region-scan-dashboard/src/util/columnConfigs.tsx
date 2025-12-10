import React, { useEffect, useState } from "react";
import {
  getGridNumericOperators,
  GridComparatorFn,
  GridFilterInputValueProps,
  GridFilterOperator,
  GridSortDirection,
} from "@mui/x-data-grid";
import { format } from "d3-format";
import { Grid2 as Grid } from "@mui/material";
import { PaginatedTableColumn } from "@/components/PaginatedTable";
import { RegionResult } from "@/lib/ts/types";
import { NumberInput } from "@/components";

export const formatPval = format(".3e");

export const formatFloat = format(".3f");

const regionSort =
  (direction: GridSortDirection): GridComparatorFn<number> =>
  (region1, region2, cellParams1, cellParams2) => {
    const chr1: number = cellParams1.api.getRowParams(cellParams1.id).row.chr;
    const chr2: number = cellParams1.api.getRowParams(cellParams2.id).row.chr;

    if (direction === "asc" || !direction) {
      return chr1 < chr2
        ? -1
        : chr1 > chr2
          ? 1
          : region1 < region2
            ? -1
            : region1 > region2
              ? 1
              : 0;
    } else if (direction == "desc") {
      return chr1 < chr2
        ? 1
        : chr1 > chr2
          ? -1
          : region1 < region2
            ? 1
            : region1 > region2
              ? -1
              : 0;
    } else return 0;
  };

interface IsBetweenValue {
  start: number;
  end: number;
}

const IsBetweenInput: React.FC<GridFilterInputValueProps> = ({
  item,
  applyValue,
}) => {
  const [startVal, setStartVal] = useState<number | null>(
    item?.value?.startVal || null,
  );
  const [endVal, setEndVal] = useState<number | null>(
    item?.value?.endVal || null,
  );

  useEffect(() => {
    if (startVal && endVal) {
      applyValue({ ...item, value: { startVal, endVal } });
    }
  }, [startVal, endVal]);

  return (
    <Grid container direction="row" spacing={2}>
      <Grid>
        <NumberInput
          onChange={setStartVal}
          label="Start"
          value={startVal || 0}
          width={"75px"}
        />
      </Grid>
      <Grid>
        <NumberInput
          onChange={setEndVal}
          label="End"
          value={endVal || 0}
          width={"75px"}
        />
      </Grid>
    </Grid>
  );
};

const isBetweenOperators: GridFilterOperator<RegionResult>[] = [
  {
    label: "is Between",
    value: "isBetween",
    getApplyFilterFn: (filterItem) => {
      if (!filterItem.field || !filterItem.value || !filterItem.operator) {
        return () => true;
      } else {
        return (value: IsBetweenValue) => {
          if (
            (value.start == 0 && value.end == 0) ||
            (filterItem.value.startVal <= value &&
              filterItem.value.endVal >= value)
          ) {
            return true;
          } else {
            return false;
          }
        };
      }
    },
    InputComponent: IsBetweenInput,
  },
];

export const regionResultCols: PaginatedTableColumn<RegionResult>[] = [
  { field: "chr", headerName: "chr", sortable: true },
  {
    field: "region",
    headerName: "region",
    sortable: true,
    getSortComparator: regionSort,
    filterOperators: isBetweenOperators.concat(getGridNumericOperators()),
  },

  {
    field: "start_bp",
    headerName: "start_bp",
    sortable: true,
    filterOperators: getGridNumericOperators(),
  },
  {
    field: "end_bp",
    headerName: "end_bp",
    sortable: true,
    filterOperators: getGridNumericOperators(),
  },
  { field: "nSNPs", headerName: "nSNPs", sortable: true },
  { field: "nSNPs_kept", headerName: "nSNPs_kept", sortable: true },
  {
    field: "maxVIF",
    headerName: "maxVIF",
    sortable: true,
    valueFormatter: formatFloat,
    filterOperators: getGridNumericOperators(),
  },
  { field: "Wald", hideOnLoad: true, headerName: "Wald", sortable: true },
  { field: "Wald_df", headerName: "Wald_df", sortable: true },
  {
    field: "Wald_p",
    headerName: "Wald_p",
    sortable: true,
    valueFormatter: formatPval,
    filterOperators: getGridNumericOperators(),
  },
  { field: "PC80", hideOnLoad: true, headerName: "PC80", sortable: true },
  { field: "PC80_df", headerName: "PC80_df", sortable: true },
  {
    field: "PC80_p",
    headerName: "PC80_p",
    sortable: true,
    valueFormatter: formatPval,
    filterOperators: getGridNumericOperators(),
  },
  { field: "MLCB", hideOnLoad: true, headerName: "MLCB", sortable: true },
  { field: "MLCB_df", headerName: "MLCB_df", sortable: true },
  {
    field: "MLCB_p",
    headerName: "MLCB_p",
    sortable: true,
    valueFormatter: formatPval,
    filterOperators: getGridNumericOperators(),
  },
  { field: "LCB", hideOnLoad: true, headerName: "LCB", sortable: true },
  { field: "LCB_df", headerName: "LCB_df", sortable: true },
  {
    field: "LCB_p",
    headerName: "LCB_p",
    sortable: true,
    valueFormatter: formatPval,
    filterOperators: getGridNumericOperators(),
  },
  {
    field: "SKAT_p",
    headerName: "SKAT_p",
    sortable: true,
    valueFormatter: formatPval,
    filterOperators: getGridNumericOperators(),
  },
  {
    field: "SKATO_p",
    headerName: "SKATO_p",
    sortable: true,
    valueFormatter: formatPval,
    filterOperators: getGridNumericOperators(),
  },
  {
    field: "simes_p",
    headerName: "simes_p",
    sortable: true,
    valueFormatter: formatPval,
    filterOperators: getGridNumericOperators(),
  },
  { field: "simpleM_df", headerName: "simpleM_df", sortable: true },
  {
    field: "simpleM_p",
    headerName: "simpleM_p",
    sortable: true,
    valueFormatter: formatPval,
    filterOperators: getGridNumericOperators(),
  },
  {
    field: "GATES_p",
    headerName: "GATES_p",
    sortable: true,
    valueFormatter: formatPval,
    filterOperators: getGridNumericOperators(),
  },
  {
    field: "single_Wald_p",
    headerName: "single_Wald_p",
    sortable: true,
    valueFormatter: formatPval,
    filterOperators: getGridNumericOperators(),
  },
];
