import { GridComparatorFn, GridSortDirection } from "@mui/x-data-grid";
import { format } from "d3-format";
import { PaginatedTableColumn } from "@/components/PaginatedTable";
import { RegionResult } from "@/lib/ts/types";

const formatPval = format(".3e");

const formatFloat = format(".3f");

const chromSort =
  (direction: GridSortDirection): GridComparatorFn<number> =>
  (v1, v2, cellParams1, cellParams2) => {
    const chr1: number = cellParams1.api.getRowParams(cellParams1.id).row.chr;
    const chr2: number = cellParams1.api.getRowParams(cellParams2.id).row.chr;

    if (direction === "asc" || !direction) {
      return chr1 < chr2
        ? -1
        : chr1 > chr2
          ? 1
          : v1 < v2
            ? -1
            : v1 > v2
              ? 1
              : 0;
    } else if (direction == "desc") {
      return chr1 < chr2
        ? 1
        : chr1 > chr2
          ? -1
          : v1 < v2
            ? 1
            : v1 > v2
              ? -1
              : 0;
    } else return 0;
  };

export const RegionResultCols: PaginatedTableColumn<RegionResult>[] = [
  { field: "chr", headerName: "chr", sortable: true },
  {
    field: "region",
    headerName: "region",
    sortable: true,
    getSortComparator: chromSort,
  },
  {
    field: "start_bp",
    headerName: "start_bp",
    sortable: true,
  },
  {
    field: "end_bp",
    headerName: "end_bp",
    sortable: true,
  },
  { field: "nSNPs", headerName: "nSNPs", sortable: true },
  { field: "nSNPs_kept", headerName: "nSNPs_kept", sortable: true },
  {
    field: "maxVIF",
    headerName: "maxVIF",
    sortable: true,
    valueFormatter: formatFloat,
  },
  { field: "Wald", hideOnLoad: true, headerName: "Wald", sortable: true },
  { field: "Wald_df", headerName: "Wald_df", sortable: true },
  {
    field: "Wald_p",
    headerName: "Wald_p",
    sortable: true,
    valueFormatter: formatPval,
  },
  { field: "PC80", hideOnLoad: true, headerName: "PC80", sortable: true },
  { field: "PC80_df", headerName: "PC80_df", sortable: true },
  {
    field: "PC80_p",
    headerName: "PC80_p",
    sortable: true,
    valueFormatter: formatPval,
  },
  { field: "MLCB", hideOnLoad: true, headerName: "MLCB", sortable: true },
  { field: "MLCB_df", headerName: "MLCB_df", sortable: true },
  {
    field: "MLCB_p",
    headerName: "MLCB_p",
    sortable: true,
    valueFormatter: formatPval,
  },
  { field: "LCB", hideOnLoad: true, headerName: "LCB", sortable: true },
  { field: "LCB_df", headerName: "LCB_df", sortable: true },
  {
    field: "LCB_p",
    headerName: "LCB_p",
    sortable: true,
    valueFormatter: formatPval,
  },
  {
    field: "SKAT_p",
    headerName: "SKAT_p",
    sortable: true,
    valueFormatter: formatPval,
  },
  {
    field: "SKATO_p",
    headerName: "SKATO_p",
    sortable: true,
    valueFormatter: formatPval,
  },
  {
    field: "simes_p",
    headerName: "simes_p",
    sortable: true,
    valueFormatter: formatPval,
  },
  { field: "simpleM_df", headerName: "simpleM_df", sortable: true },
  {
    field: "simpleM_p",
    headerName: "simpleM_p",
    sortable: true,
    valueFormatter: formatPval,
  },
  {
    field: "GATES_p",
    headerName: "GATES_p",
    sortable: true,
    valueFormatter: formatPval,
  },
  {
    field: "single_Wald_p",
    headerName: "single_Wald_p",
    sortable: true,
    valueFormatter: formatPval,
  },
];
