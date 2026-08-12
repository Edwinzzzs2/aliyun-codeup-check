"use client";

import React from "react";
import {
  Box,
  Checkbox,
  FormControl,
  MenuItem,
  Pagination,
  Select,
  Skeleton,
  Stack,
  Typography,
  useMediaQuery,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { DataGrid } from "@mui/x-data-grid";

function getRowId(row, getRowId) {
  return getRowId ? getRowId(row) : row.id;
}

function getCellValue(row, column) {
  const rawValue = row?.[column.field];

  if (!column.valueGetter) return rawValue;

  try {
    return column.valueGetter(rawValue, row, column, null);
  } catch {
    return rawValue;
  }
}

function renderCell(row, column, id) {
  const value = getCellValue(row, column);
  const params = {
    id,
    row,
    field: column.field,
    value,
    formattedValue: value,
    colDef: column,
    hasFocus: false,
    tabIndex: -1,
  };

  if (column.renderCell) {
    return column.renderCell(params);
  }

  if (column.valueFormatter) {
    try {
      return column.valueFormatter(value, row, column, null);
    } catch {
      return value ?? "-";
    }
  }

  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "boolean") return value ? "是" : "否";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function MobileDataCards({
  rows = [],
  columns = [],
  getRowId: getRowIdProp,
  checkboxSelection,
  rowSelectionModel = [],
  onRowSelectionModelChange,
  paginationModel,
  pageSizeOptions = [],
  rowCount,
  onPaginationModelChange,
  hideFooter,
  loading,
  localeText = {},
}) {
  const visibleColumns = columns.filter(
    (column) =>
      !column.hide && !column.hideOnMobile && column.field !== "__check__"
  );
  const primaryColumn = visibleColumns[0];
  const detailColumns = visibleColumns.slice(1);
  const selectedIds = Array.isArray(rowSelectionModel)
    ? rowSelectionModel
    : Array.from(rowSelectionModel?.ids || []);
  const currentIds = rows.map((row) => getRowId(row, getRowIdProp));
  const allCurrentSelected =
    currentIds.length > 0 && currentIds.every((id) => selectedIds.includes(id));
  const totalRows = rowCount ?? rows.length;
  const pageSize = paginationModel?.pageSize || rows.length || 1;
  const pageCount = Math.max(1, Math.ceil(totalRows / pageSize));

  const toggleSelection = (id) => {
    if (!onRowSelectionModelChange) return;
    const nextSelection = selectedIds.includes(id)
      ? selectedIds.filter((selectedId) => selectedId !== id)
      : [...selectedIds, id];
    onRowSelectionModelChange(nextSelection);
  };

  const toggleCurrentPage = () => {
    if (!onRowSelectionModelChange) return;
    const nextSelection = allCurrentSelected
      ? selectedIds.filter((id) => !currentIds.includes(id))
      : Array.from(new Set([...selectedIds, ...currentIds]));
    onRowSelectionModelChange(nextSelection);
  };

  return (
    <Box
      sx={{
        minHeight: 0,
        height: "auto",
        overflow: "visible",
        pb: 1,
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          minHeight: 40,
          mb: 1,
          px: 0.5,
          bgcolor: "background.paper",
        }}
      >
        <Typography variant="caption" color="text.secondary">
          共 {totalRows} 条
          {checkboxSelection && selectedIds.length > 0
            ? ` · 已选 ${selectedIds.length} 条`
            : ""}
        </Typography>
        {checkboxSelection && rows.length > 0 && (
          <Box
            component="label"
            sx={{
              display: "flex",
              alignItems: "center",
              minHeight: 40,
              cursor: "pointer",
            }}
          >
            <Checkbox
              size="small"
              checked={allCurrentSelected}
              indeterminate={
                !allCurrentSelected &&
                currentIds.some((id) => selectedIds.includes(id))
              }
              onChange={toggleCurrentPage}
            />
            <Typography variant="body2">全选本页</Typography>
          </Box>
        )}
      </Box>

      {loading ? (
        <Stack spacing={1.5}>
          {[0, 1, 2].map((item) => (
            <Skeleton
              key={item}
              variant="rounded"
              height={168}
              sx={{ borderRadius: 3 }}
            />
          ))}
        </Stack>
      ) : rows.length === 0 ? (
        <Box
          sx={{
            minHeight: 220,
            display: "grid",
            placeItems: "center",
            px: 3,
            textAlign: "center",
            color: "text.secondary",
          }}
        >
          <Typography variant="body2">
            {localeText.noRowsLabel || "暂无数据"}
          </Typography>
        </Box>
      ) : (
        <Stack spacing={1.5}>
          {rows.map((row) => {
            const id = getRowId(row, getRowIdProp);
            const selected = selectedIds.includes(id);

            return (
              <Box
                key={id}
                component="article"
                sx={{
                  position: "relative",
                  p: 2,
                  border: "1px solid",
                  borderColor: selected ? "primary.main" : "divider",
                  borderRadius: 3,
                  bgcolor: selected ? "rgba(25, 118, 210, 0.035)" : "#fff",
                  boxShadow: selected
                    ? "0 8px 24px rgba(25, 118, 210, 0.10)"
                    : "0 6px 18px rgba(35, 48, 67, 0.06)",
                  transition:
                    "border-color 160ms ease, box-shadow 160ms ease, transform 120ms ease",
                  "&:active": { transform: "scale(0.995)" },
                }}
              >
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 1,
                    pb: detailColumns.length ? 1.5 : 0,
                    borderBottom: detailColumns.length
                      ? "1px solid rgba(31, 41, 55, 0.08)"
                      : 0,
                  }}
                >
                  {checkboxSelection && (
                    <Checkbox
                      size="small"
                      checked={selected}
                      onChange={() => toggleSelection(id)}
                      inputProps={{ "aria-label": `选择 ${id}` }}
                      sx={{ mt: -0.75, ml: -0.75 }}
                    />
                  )}
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ display: "block", mb: 0.25 }}
                    >
                      {primaryColumn?.headerName || "详情"}
                    </Typography>
                    <Box
                      sx={{
                        minWidth: 0,
                        fontSize: 15,
                        fontWeight: 650,
                        overflowWrap: "anywhere",
                        "& .MuiTypography-root": {
                          whiteSpace: "normal",
                          overflowWrap: "anywhere",
                        },
                      }}
                    >
                      {primaryColumn
                        ? renderCell(row, primaryColumn, id)
                        : String(id)}
                    </Box>
                  </Box>
                </Box>

                {detailColumns.length > 0 && (
                  <Box
                    sx={{
                      display: "grid",
                      gridTemplateColumns: "minmax(76px, 0.34fr) minmax(0, 1fr)",
                      columnGap: 1.5,
                      rowGap: 1.25,
                      pt: 1.5,
                    }}
                  >
                    {detailColumns.map((column) => {
                      const isActionColumn = column.field === "actions";

                      return (
                        <React.Fragment key={column.field}>
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{
                              pt: 0.2,
                              ...(isActionColumn && {
                                gridColumn: "1 / -1",
                                pt: 1,
                                borderTop:
                                  "1px solid rgba(31, 41, 55, 0.08)",
                              }),
                            }}
                          >
                            {column.headerName || column.field}
                          </Typography>
                          <Box
                            sx={{
                              minWidth: 0,
                              ...(isActionColumn && {
                                gridColumn: "1 / -1",
                                "& > .MuiBox-root": {
                                  width: "100%",
                                  justifyContent: "stretch",
                                },
                              }),
                              fontSize: 14,
                              color: "text.primary",
                              overflowWrap: "anywhere",
                              "& .MuiTypography-root": {
                                whiteSpace: "normal",
                                overflow: "visible",
                                textOverflow: "clip",
                              },
                              "& .MuiButton-root": {
                                minHeight: 40,
                                ...(isActionColumn && { flex: 1 }),
                              },
                            }}
                          >
                            {renderCell(row, column, id)}
                          </Box>
                        </React.Fragment>
                      );
                    })}
                  </Box>
                )}
              </Box>
            );
          })}
        </Stack>
      )}

      {!hideFooter && paginationModel && onPaginationModelChange && (
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 1.5,
            pt: 2.5,
            pb: 1,
          }}
        >
          <Pagination
            count={pageCount}
            page={(paginationModel.page || 0) + 1}
            onChange={(_, nextPage) =>
              onPaginationModelChange({
                ...paginationModel,
                page: nextPage - 1,
              })
            }
            color="primary"
            size="small"
            siblingCount={0}
            boundaryCount={1}
          />
          {pageSizeOptions.length > 1 && (
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Typography variant="caption" color="text.secondary">
                每页
              </Typography>
              <FormControl size="small">
                <Select
                  value={paginationModel.pageSize}
                  onChange={(event) =>
                    onPaginationModelChange({
                      page: 0,
                      pageSize: Number(event.target.value),
                    })
                  }
                  sx={{ minWidth: 76, height: 36 }}
                >
                  {pageSizeOptions.map((option) => (
                    <MenuItem key={option} value={option}>
                      {option}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Typography variant="caption" color="text.secondary">
                条
              </Typography>
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
}

export default function ResponsiveDataGrid(props) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"), { noSsr: true });

  if (!isMobile) {
    return <DataGrid {...props} />;
  }

  return <MobileDataCards {...props} />;
}
