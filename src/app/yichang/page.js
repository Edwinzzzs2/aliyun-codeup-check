"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Paper,
  Typography,
} from "@mui/material";
import { Refresh as RefreshIcon } from "@mui/icons-material";
import { DataGrid } from "@mui/x-data-grid";
import moment from "moment";

function parseJson(value) {
  if (!value) return {};
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

export default function ExceptionLogsPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 20,
    totalCount: 0,
  });

  const fetchLogs = useCallback(async (page = 1, pageSize = 20) => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/exceptions?page=${page}&pageSize=${pageSize}`,
        { cache: "no-store" }
      );
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || "查询异常日志失败");
      }
      setLogs(data.data || []);
      setPagination((previous) => ({
        ...previous,
        ...data.pagination,
      }));
    } catch (error) {
      console.error("查询异常日志失败:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const rows = useMemo(() => logs.map((log) => {
    const requestData = parseJson(log.request_data);
    const clientInfo = requestData.clientInfo || {};
    return {
      id: log.id,
      apiName: log.task_name,
      method: requestData.method || "-",
      endpoint: requestData.endpoint || "-",
      message: log.message || "-",
      details: log.error_details || "-",
      client: `${clientInfo.ip || "未知 IP"} | ${clientInfo.userAgent || "未知客户端"}`,
      executedAt: log.executed_at,
    };
  }), [logs]);

  const columns = [
    { field: "apiName", headerName: "接口", minWidth: 150, flex: 0.7 },
    {
      field: "method",
      headerName: "方法",
      width: 90,
      renderCell: (params) => (
        <Chip label={params.value} color="error" variant="outlined" size="small" />
      ),
    },
    {
      field: "endpoint",
      headerName: "请求路径",
      minWidth: 260,
      flex: 1.2,
      renderCell: (params) => (
        <Typography variant="body2" noWrap title={params.value}>
          {params.value}
        </Typography>
      ),
    },
    {
      field: "message",
      headerName: "异常信息",
      minWidth: 260,
      flex: 1.2,
      renderCell: (params) => (
        <Typography variant="body2" noWrap title={params.value}>
          {params.value}
        </Typography>
      ),
    },
    {
      field: "details",
      headerName: "错误详情",
      minWidth: 200,
      flex: 1,
      renderCell: (params) => (
        <Typography variant="body2" noWrap title={params.value}>
          {params.value}
        </Typography>
      ),
    },
    {
      field: "client",
      headerName: "客户端",
      minWidth: 220,
      flex: 1,
      renderCell: (params) => (
        <Typography variant="body2" noWrap title={params.value}>
          {params.value}
        </Typography>
      ),
    },
    {
      field: "executedAt",
      headerName: "发生时间",
      width: 170,
      valueFormatter: (value) => (
        value ? moment(value).utcOffset(8).format("YYYY-MM-DD HH:mm:ss") : "-"
      ),
    },
  ];

  return (
    <Paper
      sx={{
        height: "calc(100vh - 112px)",
        p: 2,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <Box
        sx={{
          mb: 2,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            接口异常日志
          </Typography>
          <Typography variant="body2" color="text.secondary">
            仅通过 /yichang 访问，不在左侧菜单展示
          </Typography>
        </Box>
        <Button
          variant="outlined"
          size="small"
          disabled={loading}
          startIcon={loading ? <CircularProgress size={16} /> : <RefreshIcon />}
          onClick={() => fetchLogs(pagination.page, pagination.pageSize)}
        >
          刷新
        </Button>
      </Box>

      <Box sx={{ flex: 1, minHeight: 0 }}>
        <DataGrid
          rows={rows}
          columns={columns}
          loading={loading}
          pagination
          paginationMode="server"
          rowCount={pagination.totalCount}
          paginationModel={{
            page: pagination.page - 1,
            pageSize: pagination.pageSize,
          }}
          pageSizeOptions={[10, 20, 50, 100]}
          onPaginationModelChange={({ page, pageSize }) => {
            fetchLogs(page + 1, pageSize);
          }}
          disableRowSelectionOnClick
          localeText={{
            noRowsLabel: "暂无接口异常日志",
            footerPaginationRowsPerPage: "每页行数:",
          }}
          sx={{ border: 0 }}
        />
      </Box>
    </Paper>
  );
}
