"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import moment from "moment";
import {
  Box,
  Button,
  TextField,
  Typography,
  Paper,
  CircularProgress,
  Backdrop,
  LinearProgress,
  InputAdornment,
  IconButton,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import { Search, Refresh } from "@mui/icons-material";

import {
  useTokenConfig,
  useTokenMessage,
  useRepoChange,
  useGlobalLoading,
} from "../../contexts/TokenContext";

export default function HomePage() {
  const { token, orgId } = useTokenConfig();
  const { showMessage } = useTokenMessage();
  const { selectedRepo, repoChangeTimestamp } = useRepoChange();
  const { globalLoading } = useGlobalLoading();
  const [branches, setBranches] = useState([]);

  // 分页相关状态
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [searchTerm, setSearchTerm] = useState("");
  const [totalCount, setTotalCount] = useState(0);
  const searchTimerRef = useRef(null);

  // 合并状态检测相关状态
  const [targetBranch, setTargetBranch] = useState("prod");
  const [mergeStatus, setMergeStatus] = useState({});
  const [selectedBranchNames, setSelectedBranchNames] = useState([]);

  // Loading状态 - 移除repos相关状态
  const [loading, setLoading] = useState({
    branches: false,
    merge: false,
  });

  // 监听全局代码库选择变化
  useEffect(() => {
    // 监听仓库变更
    if (selectedRepo && repoChangeTimestamp) {
      // 清空当前分支数据和状态
      setBranches([]);
      setPage(0);
      setSearchTerm("");
      setSelectedBranchNames([]);
      setMergeStatus({});
      // 如果有选择的代码库且有token，立即获取分支
    }
    if (token && selectedRepo) {
      fetchBranches(selectedRepo, 1, rowsPerPage, "");
    }
  }, [selectedRepo, repoChangeTimestamp, token]);

  // 带分页与搜索的分支请求
  const fetchBranches = async (
    repoId,
    pageNum = 1,
    perPage = rowsPerPage,
    search = searchTerm
  ) => {
    if (!token) return showMessage("请先配置 Token", "error");

    setLoading((prev) => ({ ...prev, branches: true }));
    try {
      const params = new URLSearchParams({
        token,
        orgId,
        repoId,
        page: pageNum.toString(),
        perPage: perPage.toString(),
        sort: "updated_desc",
      });
      if (search) params.append("search", search);

      const res = await fetch(`/api/codeup/branches?${params.toString()}`);

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const data = await res.json();

      // 兼容两种返回结构
      let list = [];
      let total = 0;
      if (Array.isArray(data)) {
        list = data;
        total = data.length;
      } else if (data?.result) {
        list = Array.isArray(data.result) ? data.result : [];
        total = data.total ?? data.totalCount ?? list.length;
      }

      setBranches(list);
      setTotalCount(total);
    } catch (error) {
      console.error("获取分支失败:", error);
      setBranches([]);
      setTotalCount(0);
      showMessage("获取分支失败", "error");
    } finally {
      setLoading((prev) => ({ ...prev, branches: false }));
    }
  };

  // 搜索事件（300ms 防抖）
  const handleSearchChange = (event) => {
    const value = event.target.value;
    setSearchTerm(value);
    setPage(0);
    if (!selectedRepo) return;
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      fetchBranches(selectedRepo, 1, rowsPerPage, value);
    }, 500);
  };

  // 检测合并状态
  const checkMergeStatus = async () => {
    if (!selectedRepo || !targetBranch.trim()) {
      showMessage("请选择代码库并输入目标分支", "warning");
      return;
    }

    // 使用受控选择集合
    const selectedBranches = branches.filter((branch) =>
      selectedBranchNames.includes(branch.name)
    );

    if (selectedBranches.length === 0) {
      showMessage("请先选择要检测的分支", "warning");
      return;
    }

    setLoading((prev) => ({ ...prev, merge: true }));

    // 清空选中分支的合并状态，让用户看到加载效果
    const clearedStatus = { ...mergeStatus };
    selectedBranches.forEach((branch) => {
      delete clearedStatus[branch.name];
    });
    setMergeStatus(clearedStatus);

    const newMergeStatus = {};

    try {
      // 组装批量请求payload，避免逐个分支调用接口
      const payload = {
        token,
        orgId,
        repoId: selectedRepo,
        target: targetBranch.trim(),
        branches: selectedBranches.map((b) => ({
          name: b.name,
          commitId: b.commit?.id || "",
        })),
      };

      const res = await fetch("/api/codeup/merge-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json();
        showMessage(
          `检测合并状态失败: ${
            errorData.errorDescription || errorData.errorMessage
          }`,
          "error"
        );
        return;
      }

      const data = await res.json();

      if (!data || !Array.isArray(data.results)) {
        // 如果批量接口异常，给所有选中分支标记为检测失败
        selectedBranches.forEach((b) => {
          newMergeStatus[b.name] = "检测失败";
        });
      } else {
        // 根据返回结果更新每个分支的合并状态
        data.results.forEach((item) => {
          let status = "未知";
          if (item.merged === true || item.status === "merged")
            status = "已合并";
          else if (item.merged === false || item.status === "not_merged")
            status = "未合并";
          else status = "检测失败";
          newMergeStatus[item.branchName || ""] = status;
        });

        // 兜底：若返回结果中缺少某些分支，标记为检测失败
        selectedBranches.forEach((b) => {
          if (!(b.name in newMergeStatus)) newMergeStatus[b.name] = "检测失败";
        });
      }

      // 合并新的状态和保留的旧状态
      setMergeStatus((prevStatus) => ({ ...prevStatus, ...newMergeStatus }));
      showMessage(
        `合并状态检测完成，共检测 ${selectedBranches.length} 个分支`,
        "success"
      );
    } catch (error) {
      console.error("检测合并状态失败:", error);
      // 给所有选中分支标记为检测失败
      const failedStatus = {};
      selectedBranches.forEach((b) => {
        failedStatus[b.name] = "检测失败";
      });
      setMergeStatus((prevStatus) => ({ ...prevStatus, ...failedStatus }));
      showMessage("检测合并状态失败", "error");
    } finally {
      setLoading((prev) => ({ ...prev, merge: false }));
    }
  };

  // handleCreateChangeRequest函数已移除，该功能已移至代码合并页面

  // DataGrid 列定义
  const columns = [
    {
      field: "name",
      headerName: "分支名",
      flex: 2,
      minWidth: 200,
      sortable: true,
      renderCell: (params) => {
        const branchName = params.row.name;
        const webUrl = params.row.webUrl;
        if (webUrl) {
          return (
            <Typography
              component="a"
              href={webUrl}
              target="_blank"
              rel="noopener noreferrer"
              sx={{
                color: "#1565c0",
                textDecoration: "none",
                fontWeight: 500,
                fontSize: 14,
                "&:hover": {
                  textDecoration: "underline",
                  color: "#0d47a1",
                },
                cursor: "pointer",
              }}
            >
              {branchName}
            </Typography>
          );
        }

        return branchName;
      },
    },
    {
      field: "lastCommitter",
      headerName: "最近一个提交人",
      flex: 1,
      minWidth: 150,
      filterable: true,
      sortable: false,
      renderCell: (params) => {
        const committerName =
          params.row.commit?.committerName || params.row.commit?.authorName;
        return committerName || "-";
      },
    },
    {
      field: "commitTime",
      headerName: "提交时间",
      flex: 1,
      minWidth: 160,
      sortable: false,
      renderCell: (params) => {
        const committedDate =
          params.row.commit?.committedDate || params.row.commit?.authoredDate;
        if (!committedDate) return "-";

        // 使用moment.js进行时间格式化
        try {
          return moment(committedDate).format('YYYY-MM-DD HH:mm');
        } catch (error) {
          return committedDate;
        }
      },
    },
    {
      field: "mergeStatus",
      headerName: "合并状态",
      flex: 1,
      minWidth: 120,
      sortable: true,
      filterable: true,
      valueGetter: (params, row) => {
        return mergeStatus[row?.name] || "";
      },
      renderCell: (params) => {
        const branchName = params.row.name;
        const status = mergeStatus[branchName];
        const isSelected = selectedBranchNames.includes(branchName);
        const isChecking = loading.merge && isSelected;

        // 如果正在检测且该分支被选中，显示加载状态
        if (isChecking) {
          return <CircularProgress size={16} />;
        }

        // 如果没有状态，显示默认值
        if (!status) return "-";

        const getStatusColor = (status) => {
          switch (status) {
            case "已合并":
              return "#4caf50";
            case "未合并":
              return "#ff9800";
            case "检测失败":
              return "#f44336";
            default:
              return "#9e9e9e";
          }
        };

        return (
          <Box
            sx={{
              color: getStatusColor(status),
              fontWeight: "bold",
              fontSize: "0.875rem",
            }}
          >
            {status}
          </Box>
        );
      },
    },
    // 操作列已移除，合并功能已移至代码合并页面
  ];

  return (
    <Box
      sx={{
        minHeight: "100vh",
      }}
    >
      {/* Loading进度条 - 始终保留空间，避免页面抖动 */}
      <Box sx={{ width: "100%", height: "4px" }}>
        {(loading.merge || loading.branches) && <LinearProgress />}
      </Box>
      {/* 选择代码库 + 合并状态检测区域 + 搜索 */}
      <Paper
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 2,
          p: 2,
          backgroundColor: "rgba(255, 255, 255, 0.95)",
          boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
          borderRadius: 2,
          border: "1px solid rgba(255,255,255,0.3)",
          backdropFilter: "blur(10px)",
        }}
      >
        <Box display="flex" alignItems="center" gap={2} flexWrap="wrap">
          {/* 仓库选择器已移动到全局顶部，这里仅保留合并检测相关控件 */}
          <Typography
            variant="subtitle2"
            sx={{ minWidth: "auto", fontWeight: "bold" }}
          >
            合并检测：
          </Typography>
          <TextField
            size="small"
            label="目标分支"
            value={targetBranch}
            onChange={(e) => setTargetBranch(e.target.value)}
            placeholder="输入目标分支名称"
            sx={{ minWidth: 160 }}
            disabled={loading.merge}
          />
          <Button
            variant="contained"
            color="primary"
            onClick={checkMergeStatus}
            disabled={
              loading.merge ||
              !targetBranch.trim() ||
              selectedBranchNames.length === 0
            }
            sx={{ minWidth: 100 }}
            startIcon={loading.merge ? <CircularProgress size={16} /> : null}
          >
            {loading.merge ? "检测中..." : "检测合并"}
          </Button>
        </Box>

        <Box sx={{ minWidth: 240 }}>
          <TextField
            size="small"
            placeholder="搜索分支名称..."
            value={searchTerm}
            onChange={handleSearchChange}
            disabled={loading.branches}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  {loading.branches ? (
                    <CircularProgress size={16} />
                  ) : (
                    <Search fontSize="small" />
                  )}
                </InputAdornment>
              ),
            }}
            fullWidth
          />
        </Box>
      </Paper>

      <Paper
        sx={{
          width: "100%",
          mt: 3,
          p: 2,
          backgroundColor: "rgba(255, 255, 255, 0.95)",
          boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
          borderRadius: 2,
          border: "1px solid rgba(255,255,255,0.3)",
          backdropFilter: "blur(10px)",
          height: "calc(100vh - 220px)", // 固定高度
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            mb: 2,
          }}
        >
          <Typography variant="h6" sx={{ fontWeight: "bold" }}>
            分支列表
          </Typography>
          <IconButton
            onClick={() => {
              if (selectedRepo) {
                fetchBranches(selectedRepo, page + 1, rowsPerPage, searchTerm);
              }
            }}
            disabled={loading.branches}
            size="small"
            sx={{
              color: "primary.main",
              "&:hover": {
                backgroundColor: "primary.light",
                color: "white",
              },
            }}
            title="刷新列表"
          >
            <Refresh />
          </IconButton>
        </Box>

        <Box sx={{ flex: 1, minHeight: 0 }}>
          <DataGrid
            rows={branches}
            columns={columns}
            getRowId={(row) => row.name}
            pagination
            paginationModel={{ page: page, pageSize: rowsPerPage }}
            paginationMode="server"
            rowCount={totalCount}
            onPaginationModelChange={(model) => {
              const { page: newPage, pageSize: newPageSize } = model;
              if (newPageSize !== rowsPerPage) {
                setRowsPerPage(newPageSize);
                setPage(0);
                if (selectedRepo) {
                  fetchBranches(selectedRepo, 1, newPageSize, searchTerm);
                }
              } else if (newPage !== page) {
                setPage(newPage);
                if (selectedRepo) {
                  fetchBranches(
                    selectedRepo,
                    newPage + 1,
                    rowsPerPage,
                    searchTerm
                  );
                }
              }
            }}
            pageSizeOptions={[25, 50, 100]}
            checkboxSelection
            disableRowSelectionOnClick
            rowSelectionModel={selectedBranchNames}
            onRowSelectionModelChange={(model) => setSelectedBranchNames(model)}
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
            }}
            localeText={{
              noRowsLabel: loading.branches ? "加载中..." : "暂无数据",
              MuiTablePagination: {
                labelRowsPerPage: "每页显示",
                labelDisplayedRows: ({ from, to, count }) =>
                  `${from}-${to} 共 ${count} 条`,
              },
            }}
            slotProps={{
              pagination: {
                showFirstButton: true,
                showLastButton: true,
              },
            }}
          />
        </Box>
      </Paper>

      {/* 全局Loading遮罩 */}
      <Backdrop
        sx={{ color: "#fff", zIndex: (theme) => theme.zIndex.drawer + 1 }}
        open={globalLoading}
      >
        <Box display="flex" flexDirection="column" alignItems="center" gap={2}>
          <CircularProgress color="inherit" />
          <Typography variant="h6">初始化中...</Typography>
        </Box>
      </Backdrop>
    </Box>
  );
}
