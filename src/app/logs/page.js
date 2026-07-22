"use client";

import { useCallback, useEffect, useState } from "react";
import { Box, LinearProgress } from "@mui/material";
import ExecutionLogsTab from "../automerge/ExecutionLogsTab";

export default function ExecutionLogsPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState({ data: false });
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 20,
    totalCount: 0,
    totalPages: 0,
    hasNext: false,
    hasPrev: false,
  });

  const fetchLogs = useCallback(async (page = 1, pageSize = 20) => {
    setLoading({ data: true });
    try {
      const response = await fetch(
        `/api/automerge/execute?page=${page}&pageSize=${pageSize}`
      );
      const data = await response.json();
      if (data.success) {
        setLogs(data.data || []);
        if (data.pagination) setPagination(data.pagination);
      }
    } catch (error) {
      console.error("获取执行日志失败:", error);
    } finally {
      setLoading({ data: false });
    }
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  return (
    <Box sx={{ minHeight: "100vh" }}>
      <Box sx={{ width: "100%", height: 4 }}>
        {loading.data && <LinearProgress />}
      </Box>
      <ExecutionLogsTab
        logs={logs}
        loading={loading}
        onRefresh={fetchLogs}
        pagination={pagination}
        onPaginationChange={(page, pageSize) => {
          setPagination((previous) => ({ ...previous, page, pageSize }));
          fetchLogs(page, pageSize);
        }}
      />
    </Box>
  );
}
