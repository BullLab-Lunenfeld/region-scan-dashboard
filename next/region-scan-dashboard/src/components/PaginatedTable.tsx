"use client";

import React, { useContext, useMemo, useState } from "react";
import { format } from "d3-format";
import { Download, TuneOutlined } from "@mui/icons-material";
import {
  Box,
  Button,
  Grid2 as Grid,
  lighten,
  MenuItem,
  TextField,
} from "@mui/material";
import {
  DataGrid,
  GridColumnVisibilityModel,
  GridFilterModel,
  GridPaginationModel,
  GridPreferencePanelsValue,
  GridSlots,
  GridToolbarContainer,
  GridToolbarFilterButton,
  GridValidRowModel,
  PropsFromSlot,
  useGridApiContext,
} from "@mui/x-data-grid";
import { GridBaseColDef, isNumber } from "@mui/x-data-grid/internals";
import { VisualizationDataContext } from "./AppContainer";
import { getEntries } from "@/lib/ts/util";

export type PaginatedTableColumn<T extends GridValidRowModel> =
  GridBaseColDef<T> & {
    hideOnLoad?: boolean;
    searchable?: boolean;
  };

//todo: bring to life
const dummyDownload = () => null;

interface PaginatedTableProps<T extends GridValidRowModel> {
  cols: PaginatedTableColumn<T>[];
  data: T[];
  filterModel?: GridFilterModel;
  loading?: boolean;
  onFilterModelChange?: (filterModel?: GridFilterModel) => void;
  onSelect?: (model: T) => void;
  selected?: number;
  total?: number;
}

function PaginatedTable<T extends GridValidRowModel>({
  cols,
  data,
  filterModel,
  loading,
  onFilterModelChange,
  onSelect,
  selected,
  total,
}: PaginatedTableProps<T>) {
  const DEFAULT_PAGE_SIZE = 20;

  const [activeThreshold, setActiveThreshold] = useState<string | number>("");

  const [paginationModel, setPaginationModel] = useState<GridPaginationModel>({
    page: 0,
    pageSize: DEFAULT_PAGE_SIZE,
  });

  const columnVisibilityModel = useMemo(() => {
    return cols.reduce<GridColumnVisibilityModel>(
      (acc, curr) => ({
        [curr.field]: curr.hideOnLoad ? false : true,
        ...acc,
      }),
      {},
    );
  }, [cols]);

  const onPaginationModelChange = (model: GridPaginationModel) => {
    setPaginationModel(model);
  };

  return (
    <DataGrid
      columns={cols}
      density="compact"
      filterMode="client"
      filterModel={filterModel}
      getCellClassName={({ field, value }) => {
        let cn = "";
        if (isNumber(activeThreshold)) {
          if (
            field.endsWith("_p") &&
            isNumber(value) &&
            value < activeThreshold
          ) {
            cn = "region-scane-theme--PvalBold";
          }
        }
        return cn;
      }}
      getRowClassName={({ row }) => {
        let cn = "";
        if (isNumber(activeThreshold)) {
          getEntries(row).forEach(([k, v]) => {
            if (
              typeof k === "string" &&
              k.endsWith("_p") &&
              v < activeThreshold
            ) {
              cn = "region-scane-theme--PvalHighlight";
            }
          });
        }
        return cn;
      }}
      initialState={{
        columns: {
          columnVisibilityModel,
        },
      }}
      loading={loading}
      onFilterModelChange={onFilterModelChange}
      onPaginationModelChange={onPaginationModelChange}
      onRowClick={(params) => (onSelect ? onSelect(params.row) : () => null)}
      pageSizeOptions={[10, 20]}
      paginationMode="client"
      paginationModel={paginationModel}
      resetPageOnSortFilter
      rowCount={total}
      rowHeight={32}
      rows={data}
      rowSelection={!!selected}
      rowSelectionModel={selected ? [selected] : selected}
      slots={{
        toolbar: RSGridToolbar as PropsFromSlot<GridSlots["toolbar"]>,
      }}
      slotProps={{
        toolbar: {
          activeThreshold,
          setActiveThreshold,
        } as PropsFromSlot<GridSlots["toolbar"]>,
      }}
      sortingMode="client"
      sx={(theme) => ({
        "& .region-scane-theme--PvalHighlight": {
          backgroundColor: lighten(theme.palette.primary.light, 0.7),
        },
        "& .region-scane-theme--PvalBold": {
          fontWeight: theme.typography.fontWeightBold,
        },
      })}
    />
  );
}

export default PaginatedTable;

interface RSGridToolbarProps extends PropsFromSlot<GridSlots["toolbar"]> {
  activeThreshold: string | number;
  setActiveThreshold: (thresh: string | number) => void;
}

const formatSci = format(".1e");

const RSGridToolbar: React.FC<RSGridToolbarProps> = ({
  activeThreshold,
  setActiveThreshold,
}) => {
  const { thresholds } = useContext(VisualizationDataContext);

  const uniqueThresholds: number[] = useMemo(
    () => [...new Set(Object.values(thresholds))],
    [thresholds],
  );

  return (
    <GridToolbarContainer>
      <Grid container direction="row" wrap="nowrap" alignItems="center">
        <Grid container alignItems="center" spacing={3}>
          <Grid>
            <GridToolbarFilterButton />
          </Grid>
          <Grid>
            <RSColumnsButton />
          </Grid>
          <Grid>
            <RSExportButton download={dummyDownload} />
          </Grid>
          <Grid width={200} padding={1}>
            <TextField
              select
              value={activeThreshold}
              label="p-val threshold"
              fullWidth
              onChange={(e) => setActiveThreshold(+e.target.value || "")}
            >
              {uniqueThresholds.map((t) => (
                <MenuItem value={t} selected={t === activeThreshold} key={t}>
                  {formatSci(t)}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
        </Grid>
      </Grid>
    </GridToolbarContainer>
  );
};

const RSColumnsButton: React.FC = () => {
  const api = useGridApiContext();
  return (
    <Button
      variant="text"
      onClick={() =>
        api.current.showPreferences(GridPreferencePanelsValue.columns)
      }
    >
      <Box display="flex" gap={1}>
        <TuneOutlined /> Toggle Column Visibility
      </Box>
    </Button>
  );
};

const RSExportButton: React.FC<{ download: () => void }> = ({ download }) => {
  return (
    <Button title="Download Results" onClick={() => download()}>
      <Box display="flex" gap={1} alignItems="center">
        <Download /> Download Table
      </Box>
    </Button>
  );
};
