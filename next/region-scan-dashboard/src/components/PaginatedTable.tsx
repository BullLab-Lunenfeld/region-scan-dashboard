"use client";

import React, { useMemo, useState } from "react";
import { Download, TuneOutlined } from "@mui/icons-material";
import { Box, Button, Grid2 as Grid } from "@mui/material";
import {
  DataGrid,
  GridColumnVisibilityModel,
  GridFilterModel,
  GridPaginationModel,
  GridPreferencePanelsValue,
  GridToolbarContainer,
  GridToolbarFilterButton,
  GridValidRowModel,
  useGridApiContext,
} from "@mui/x-data-grid";
import { GridBaseColDef } from "@mui/x-data-grid/internals";

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
    <Grid container direction="column" flexWrap="nowrap">
      <DataGrid
        columns={cols}
        density="compact"
        filterMode="client"
        filterModel={filterModel}
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
          toolbar: RSGridToolbar,
        }}
        sortingMode="client"
      />
    </Grid>
  );
}

export default PaginatedTable;

const RSGridToolbar: React.FC = () => {
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
