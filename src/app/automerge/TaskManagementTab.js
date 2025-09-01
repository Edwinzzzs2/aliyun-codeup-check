"use client";

import React, { useState } from "react";
import {
  Box,
  Typography,
  Button,
  Paper,
  Chip,
  IconButton,
  CircularProgress,
  Switch,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  PlayArrow as PlayIcon,
} from "@mui/icons-material";
import moment from "moment";
import { useTokenConfig, useRepoChange } from "../../contexts/TokenContext";

export default function TaskManagementTab({
  tasks,
  loading,
  onOpenDialog,
  onExecute,
  onDelete,
  onToggleStatus,
}) {
  const { token } = useTokenConfig();
  const { selectedRepo } = useRepoChange();
  const [executingTaskId, setExecutingTaskId] = useState(null);

  // 包装执行函数，添加独立的loading状态
  const handleExecute = async (taskId) => {
    setExecutingTaskId(taskId);
    try {
      await onExecute(taskId);
    } finally {
      setExecutingTaskId(null);
    }
  };

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
        <Typography variant="h6" sx={{ fontWeight: "bold" }}>
          任务管理
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => onOpenDialog()}
          disabled={!token || !selectedRepo}
        >
          新建任务
        </Button>
      </Box>

      <Box sx={{ flex: 1, minHeight: 0 }}>
        <DataGrid
          rows={(tasks || []).map((task) => ({
            id: task.id,
            name: task.name,
            repository_name: task.repository_name || "未设置",
            source_branch: task.source_branch,
            target_branch: task.target_branch,
            interval_minutes: task.interval_minutes,
            enabled: task.enabled,
            last_run: task.last_run,
            next_run: task.next_run,
            originalData: task,
          }))}
          columns={[
            {
              field: "name",
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
              field: "repository_name",
              headerName: "仓库",
              flex: 1,
              minWidth: 100,
              renderCell: (params) => (
                <Chip
                  label={params.value}
                  size="small"
                  variant="outlined"
                  sx={{ fontSize: "0.75rem" }}
                />
              ),
            },
            {
              field: "branches",
              headerName: "分支合并",
              flex: 1.5,
              minWidth: 180,
              sortable: false,
              renderCell: (params) => (
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                  <Chip
                    label={params.row.source_branch}
                    size="small"
                    color="primary"
                    sx={{ fontSize: "0.75rem" }}
                  />
                  <Typography variant="caption" sx={{ mx: 0.5 }}>
                    →
                  </Typography>
                  <Chip
                    label={params.row.target_branch}
                    size="small"
                    color="secondary"
                    sx={{ fontSize: "0.75rem" }}
                  />
                </Box>
              ),
            },
            {
              field: "interval_minutes",
              headerName: "自动合并间隔",
              flex: 0.8,
              minWidth: 80,
              renderCell: (params) => (
                <Typography variant="body2">{params.value}分钟</Typography>
              ),
            },
            {
              field: "enabled",
              headerName: "是否开启",
              flex: 0.8,
              minWidth: 80,
              renderCell: (params) => {
                const isAnyActionLoading = loading.action || executingTaskId !== null;
                return (
                  <Switch
                    checked={params.value}
                    onChange={() => onToggleStatus(params.row.id, params.value)}
                    disabled={isAnyActionLoading}
                    size="small"
                    color="success"
                  />
                );
              },
            },
            {
              field: "execution_time",
              headerName: "执行时间",
              flex: 1.5,
              minWidth: 180,
              sortable: false,
              renderCell: (params) => (
                <Box
                  sx={{ display: "flex", flexDirection: "column", gap: 0.3 }}
                >
                  {" "}
                  <Typography variant="body2" sx={{ fontSize: "0.75rem" }}>
                    {" "}
                    <Typography
                      component="span"
                      variant="caption"
                      color="text.secondary"
                    >
                      上次:{" "}
                    </Typography>{" "}
                    {formatTime(params.row.last_run)}{" "}
                    <Typography
                      component="span"
                      variant="caption"
                      color="text.secondary"
                      sx={{ ml: 1 }}
                    >
                      下次:{" "}
                    </Typography>{" "}
                    {formatTime(params.row.next_run)}{" "}
                  </Typography>{" "}
                </Box>
              ),
            },
            {
              field: "actions",
              headerName: "操作",
              flex: 1,
              minWidth: 100,
              sortable: false,
              headerAlign: "center",
              align: "center",
              renderCell: (params) => {
                const isExecuting = executingTaskId === params.row.id;
                const isAnyActionLoading =
                  loading.action || executingTaskId !== null;

                return (
                  <Box
                    sx={{ display: "flex", gap: 0.5, justifyContent: "center" }}
                  >
                    <IconButton
                      size="small"
                      onClick={() => handleExecute(params.row.id)}
                      disabled={!params.row.enabled || isAnyActionLoading}
                      title="立即执行"
                      sx={{
                        color:
                          params.row.enabled && !isAnyActionLoading
                            ? "success.main"
                            : "disabled",
                      }}
                    >
                      {isExecuting ? (
                        <CircularProgress size={16} />
                      ) : (
                        <PlayIcon fontSize="small" />
                      )}
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => onOpenDialog(params.row.originalData)}
                      title="编辑"
                      disabled={isAnyActionLoading}
                      sx={{ color: "primary.main" }}
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => onDelete(params.row.id)}
                      title="删除"
                      disabled={isAnyActionLoading}
                      sx={{ color: "error.main" }}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Box>
                );
              },
            },
          ]}
          loading={loading.data}
          disableSelectionOnClick
          hideFooter
          localeText={{
            noRowsLabel: "暂无任务",
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
            },
            "& .MuiDataGrid-cell": {
              display: "flex",
              alignItems: "center",
            },
            "& .MuiDataGrid-columnHeader": {
              display: "flex",
              alignItems: "center",
            },
          }}
        />
      </Box>
    </Paper>
  );
}