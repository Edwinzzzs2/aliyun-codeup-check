"use client";

import React from "react";
import {
  Box,
  Typography,
  Button,
  Paper,
  Chip,
  CircularProgress,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import {
  Refresh as RefreshIcon,
} from "@mui/icons-material";
import moment from "moment";

export default function ExecutionLogsTab({
  logs,
  loading,
  pagination,
  onRefresh,
  onPaginationChange,
}) {
  // 时间格式化函数，与其他页面保持一致
  const formatTime = (timeStr) => {
    if (!timeStr) return '-';
    try {
      // 统一处理ISO格式时间，转换为北京时间显示
      const m = moment(timeStr);
      if (!m.isValid()) return timeStr;
      return m.utcOffset(8).format("YYYY-MM-DD HH:mm:ss");
    } catch (error) {
      return timeStr;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "success":
        return "success";
      case "failed":
        return "error";
      case "conflict":
        return "warning";
      case "info":
        return "info";
      default:
        return "default";
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case "success":
        return "成功";
      case "failed":
        return "失败";
      case "conflict":
        return "冲突";
      case "info":
        return "无变动";
      default:
        return status;
    }
  };

  return (
    <Paper
      sx={{
        width: "100%",
        mt: 2,
        p: 2,
        backgroundColor: "rgba(255, 255, 255, 0.95)",
        boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
        borderRadius: 2,
        border: "1px solid rgba(255,255,255,0.3)",
        backdropFilter: "blur(10px)",
        height: "calc(100vh - 220px)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 2,
        }}
      >
        <Typography variant="h6" sx={{ fontWeight: "bold" }}>执行日志</Typography>
        <Button
          variant="outlined"
          size="small"
          startIcon={loading.data ? <CircularProgress size={16} /> : <RefreshIcon />}
          onClick={() => onRefresh(pagination.page, pagination.pageSize)}
          disabled={loading.data}
        >
          {loading.data ? "刷新中..." : "刷新"}
        </Button>
      </Box>

      <Box sx={{ flex: 1, minHeight: 0 }}>
        <DataGrid
          rows={(logs || []).map((log) => ({
            id: log.id,
            task_name: log.task_name,
            status: log.status,
            message: log.message,
            merge_request_id: log.merge_request_id,
            merge_request_detail_url: log.merge_request_detail_url,
            executed_at: log.executed_at,
          }))}
          columns={[
            {
              field: "task_name",
              headerName: "任务名称",
              flex: 1,
              minWidth: 120,
              renderCell: (params) => (
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  {params.value}
                </Typography>
              ),
            },
            {
              field: "status",
              headerName: "执行状态",
              width: 120,
              renderCell: (params) => (
                <Chip
                  label={getStatusText(params.value)}
                  color={getStatusColor(params.value)}
                  size="small"
                />
              ),
            },
            {
              field: "message",
              headerName: "执行信息",
              flex: 2,
              minWidth: 200,
              renderCell: (params) => (
                <Typography
                  variant="body2"
                  sx={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                  title={params.value}
                >
                  {params.value}
                </Typography>
              ),
            },
            {
              field: "merge_request_id",
              headerName: "合并请求ID",
              width: 130,
              renderCell: (params) => {
                const { merge_request_id, merge_request_detail_url } = params.row;
                if (!merge_request_id) return "-";
                
                if (merge_request_detail_url) {
                  return (
                    <Typography
                      component="a"
                      href={merge_request_detail_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      sx={{
                        color: '#1976d2',
                        textDecoration: 'underline',
                        cursor: 'pointer',
                        '&:hover': {
                          color: '#0d47a1',
                        },
                      }}
                    >
                      {parseInt(merge_request_id).toString()}
                    </Typography>
                  );
                }
                
                return parseInt(merge_request_id).toString();
              },
            },
            {
              field: "executed_at",
              headerName: "执行时间",
              width: 160,
              renderCell: (params) => (
                <Typography variant="body2">
                  {formatTime(params.value)}
                </Typography>
              ),
            },
          ]}
          paginationModel={{ page: pagination.page - 1, pageSize: pagination.pageSize }}
          pageSizeOptions={[10, 20, 50, 100]}
          pagination
          paginationMode="server"
          rowCount={pagination.totalCount}
          onPaginationModelChange={(model) => {
            const newPage = model.page + 1;
            const newPageSize = model.pageSize;
            onPaginationChange(newPage, newPageSize);
          }}
          loading={loading.data}
          disableSelectionOnClick
          localeText={{
            noRowsLabel: "暂无执行日志",
            footerRowSelected: (count) => `已选择 ${count} 行`,
            footerTotalRows: "总行数:",
            footerPaginationRowsPerPage: "每页行数:",
          }}
          sx={{
            border: 0,
            width: "100%",
            height: "100%",
            "& .MuiDataGrid-main": {
              overflow: "hidden",
            },
            "& .MuiDataGrid-virtualScroller": {
              overflow: "auto",
              "& .MuiDataGrid-cell": {
                display: "flex",
                alignItems: "center",
              },
              "& .MuiDataGrid-columnHeader": {
                display: "flex",
                alignItems: "center",
              },
            },
          }}
        />
      </Box>
    </Paper>
  );
}