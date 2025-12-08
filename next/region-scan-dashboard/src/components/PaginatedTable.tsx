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
  gridExpandedSortedRowEntriesSelector,
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
import { downloadCsv, getEntries } from "@/lib/ts/util";

export type PaginatedTableColumn<T extends GridValidRowModel> =
  GridBaseColDef<T> & {
    hideOnLoad?: boolean;
    searchable?: boolean;
  };

interface PaginatedTableProps<T extends GridValidRowModel> {
  cols: PaginatedTableColumn<T>[];
  data: T[];
  loading?: boolean;
  onSelect?: (model: T) => void;
  selected?: number;
  total?: number;
}

function PaginatedTable<T extends GridValidRowModel>({
  cols,
  data,
  loading,
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

  const key = useMemo(() => {
    return Math.random().toString(36).slice(2);
  }, [data]);

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
      //reset on data change
      key={key}
      columns={cols}
      density="compact"
      filterMode="client"
      getCellClassName={({ field, value }) => {
        let cn = "";
        if (isNumber(activeThreshold)) {
          if (
            field.endsWith("_p") &&
            isNumber(value) &&
            value < activeThreshold
          ) {
            cn = "region-scan-theme--PvalBold";
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
              cn = "region-scan-theme--PvalHighlight";
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
      onPaginationModelChange={onPaginationModelChange}
      onRowClick={(params) => (onSelect ? onSelect(params.row) : () => null)}
      pageSizeOptions={[10, 20, 50]}
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
      sx={(theme) => ({
        "& .region-scan-theme--PvalHighlight": {
          backgroundColor: lighten(theme.palette.primary.light, 0.7),
        },
        "& .region-scan-theme--PvalBold": {
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

  const apiRef = useGridApiContext();

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
            <RSExportButton
              download={() => {
                downloadCsv(
                  [...gridExpandedSortedRowEntriesSelector(apiRef)].map(
                    (v) => v.model,
                  ),
                );
              }}
            />
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
