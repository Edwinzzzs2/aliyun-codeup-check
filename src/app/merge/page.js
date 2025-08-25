"use client";
import {
  Button,
  Grid,
  Paper,
  Box,
  Typography,
  CircularProgress,
  Chip,
  LinearProgress,
  IconButton,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorIcon from "@mui/icons-material/Error";
import { DataGrid } from "@mui/x-data-grid";
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import moment from "moment";

import {
  useTokenConfig,
  useTokenMessage,
  useRepoChange,
} from "../../contexts/TokenContext";
import CompareDialog from "./CompareDialog";
import BranchSelector from "../../components/BranchSelector";

export default function MergeRequest() {
  const { token, orgId } = useTokenConfig();
  const { selectedRepo, repoChangeTimestamp } = useRepoChange();
  const { showMessage } = useTokenMessage();

  // 分支选择状态 - 简化为只保留选中的分支
  const [branchState, setBranchState] = useState({
    sourceBranch: null,
    targetBranch: null,
  });

  // 加载状态 - 移除分支加载状态
  const [loadingState, setLoadingState] = useState({
    creating: false,
    mrList: false,
  });



  // 合并请求列表相关状态
  const [mergeRequests, setMergeRequests] = useState([]);
  const [mrPage, setMrPage] = useState(1);
  const [mrTotal, setMrTotal] = useState(0);
  const [mrPerPage, setMrPerPage] = useState(10);
  const [operatingIds, setOperatingIds] = useState({
    merging: new Set(),
    closing: new Set(),
  });

  // 代码比较弹窗状态
  const [compareDialogOpen, setCompareDialogOpen] = useState(false);

  // 派生状态 - 使用 useMemo 计算
  const canCreateMerge = useMemo(() => {
    return branchState.sourceBranch && branchState.targetBranch;
  }, [branchState.sourceBranch, branchState.targetBranch]);

  useEffect(() => {
    // 监听仓库变更，清空分支选择
    if (selectedRepo && repoChangeTimestamp) {
      setBranchState({
        sourceBranch: null,
        targetBranch: null,
      });
    }
  }, [selectedRepo, repoChangeTimestamp]);

  // 监听仓库变更，获取合并请求列表
  useEffect(() => {
    if (selectedRepo && token && orgId) {
      fetchMergeRequests(1);
      setMrPage(1);
    }
  }, [selectedRepo, token, orgId]);

  // 获取合并请求列表
  const fetchMergeRequests = useCallback(
    async (page = 1, pageSize = mrPerPage) => {
      if (!selectedRepo || !token || !orgId) return;

      setLoadingState((prev) => ({ ...prev, mrList: true }));
      try {
        const params = new URLSearchParams({
          token,
          orgId,
          repoId: selectedRepo,
          page: page.toString(),
          perPage: pageSize.toString(),
        });

        const response = await fetch(
          `/api/codeup/create-request?${params.toString()}`
        );

        if (!response.ok) {
          const errorData = await response.json();
          showMessage(
            `获取合并请求列表失败: ${
              errorData.errorDescription || errorData.errorMessage
            }`,
            "error"
          );
          return;
        }

        const data = await response.json();

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

        setMergeRequests(list);
        setMrTotal(total);
      } catch (error) {
        console.error("获取合并请求列表时发生错误:", error);
        showMessage("获取合并请求列表时发生错误", "error");
      } finally {
        setLoadingState((prev) => ({ ...prev, mrList: false }));
      }
    },
    [selectedRepo, token, orgId, mrPerPage, showMessage]
  );

  // 处理分支选择变化
  const handleSourceBranchChange = useCallback((branch) => {
    setBranchState((prev) => ({ ...prev, sourceBranch: branch }));
  }, []);

  const handleTargetBranchChange = useCallback((branch) => {
    setBranchState((prev) => ({ ...prev, targetBranch: branch }));
  }, []);

  const handleCreateMergeRequest = useCallback(async () => {
    if (!branchState.sourceBranch || !branchState.targetBranch) {
      showMessage("请选择源分支和目标分支", "warning");
      return;
    }

    if (branchState.sourceBranch.name === branchState.targetBranch.name) {
      showMessage("源分支和目标分支不能相同", "warning");
      return;
    }

    setLoadingState((prev) => ({ ...prev, creating: true }));

    try {
      const payload = {
        token,
        orgId,
        repoId: selectedRepo,
        sourceBranch: branchState.sourceBranch.name,
        targetBranch: branchState.targetBranch.name,
        title: `${
          branchState.sourceBranch.commit?.message
            ? `${branchState.sourceBranch.commit.message}`
            : `${branchState.sourceBranch.name}-->${branchState.targetBranch.name}`
        }`,
        description: `created by aliyun-codeup-check`,
      };

      const res = await fetch("/api/codeup/create-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json();
        setLoadingState((prev) => ({ ...prev, creating: false }));
        showMessage(
          `创建合并请求失败: ${
            errorData.errorDescription || errorData.errorMessage
          }`,
          "error"
        );
        return;
      }

      const data = await res.json();
      const id =
        data?.localId ?? data?.result?.localId ?? data?.iid ?? data?.result?.id;
      showMessage(`合并请求创建成功${id ? `（ID: ${id}）` : ""}`, "success");

      // 创建成功后延迟1s刷新合并请求列表，解决冲突检测异步问题
      setTimeout(() => {
        fetchMergeRequests(mrPage);
      }, 1000);
    } catch (error) {
      console.error("创建合并请求时发生错误:", error);
      showMessage("创建合并请求时发生错误", "error");
    } finally {
      setLoadingState((prev) => ({ ...prev, creating: false }));
    }
  }, [
    branchState.sourceBranch,
    branchState.targetBranch,
    token,
    orgId,
    selectedRepo,
    showMessage,
    fetchMergeRequests,
    mrPage,
  ]);

  // 渲染合并请求状态的颜色和文本
  const getMergeRequestStatus = (state) => {
    switch (state) {
      case "UNDER_DEV":
        return { color: "info", text: "开发中" };
      case "UNDER_REVIEW":
        return { color: "warning", text: "评审中" };
      case "TO_BE_MERGED":
        return { color: "warning", text: "待合并" };
      case "MERGED":
        return { color: "success", text: "已合并" };
      case "CLOSED":
        return { color: "error", text: "已关闭" };
      case "OPEN":
        return { color: "info", text: "开放中" };
      case "DRAFT":
        return { color: "default", text: "草稿" };
      case "REVIEWING":
        return { color: "primary", text: "审核中" };
      default:
        return { color: "default", text: state || "未知" };
    }
  };

  // 打开代码比较弹窗
  const handleOpenCompareDialog = useCallback(() => {
    if (!branchState.sourceBranch || !branchState.targetBranch) {
      showMessage("请先选择源分支和目标分支", "warning");
      return;
    }
    setCompareDialogOpen(true);
  }, [branchState.sourceBranch, branchState.targetBranch, showMessage]);
  // 处理合并请求
  const handleMergeRequest = async (rowData) => {
    if (!token || !orgId || !selectedRepo) {
      showMessage("缺少必要的配置信息", "error");
      return;
    }

    const requestId = rowData.id;
    const originalData = rowData.originalData;

    // 添加到正在合并的集合中
    setOperatingIds((prev) => ({
      ...prev,
      merging: new Set([...prev.merging, requestId]),
    }));

    try {
      const response = await fetch("/api/codeup/merge", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-yunxiao-token": token,
        },
        body: JSON.stringify({
          organizationId: orgId,
          repositoryId: selectedRepo,
          localId: originalData.localId || originalData.id,
          mergeType: "no-fast-forward",
          removeSourceBranch: false,
        }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        showMessage("合并请求成功！", "success");

        // 只更新当前行的状态，不重新查询整个表格
        setMergeRequests((prevRequests) =>
          prevRequests.map((mr) =>
            (mr.localId || mr.id) === requestId
              ? { ...mr, state: "MERGED" }
              : mr
          )
        );
      } else {
        showMessage(result.details || result.error || "合并请求失败", "error");
      }
    } catch (error) {
      console.error("合并请求错误:", error);
      showMessage("合并请求失败: " + error.message, "error");
    } finally {
      // 从正在合并的集合中移除
      setOperatingIds((prev) => {
        const newMerging = new Set(prev.merging);
        newMerging.delete(requestId);
        return { ...prev, merging: newMerging };
      });
    }
  };

  // 处理关闭请求
  const handleCloseRequest = async (rowData) => {
    if (!token || !orgId || !selectedRepo) {
      showMessage("缺少必要的配置信息", "error");
      return;
    }

    const requestId = rowData.id;
    const originalData = rowData.originalData;

    // 添加到正在关闭的集合中
    setOperatingIds((prev) => ({
      ...prev,
      closing: new Set([...prev.closing, requestId]),
    }));

    try {
      const response = await fetch("/api/codeup/close-merge", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-yunxiao-token": token,
        },
        body: JSON.stringify({
          organizationId: orgId,
          repositoryId: selectedRepo,
          localId: originalData.localId || originalData.id,
        }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        showMessage("关闭请求成功！", "success");

        // 只更新当前行的状态，不重新查询整个表格
        setMergeRequests((prevRequests) =>
          prevRequests.map((mr) =>
            (mr.localId || mr.id) === requestId
              ? { ...mr, state: "CLOSED" }
              : mr
          )
        );
      } else {
        showMessage(
          result.errorDescription || result.error || "关闭请求失败",
          "error"
        );
      }
    } catch (error) {
      console.error("关闭请求错误:", error);
      showMessage("关闭请求失败: " + error.message, "error");
    } finally {
      // 从正在关闭的集合中移除
      setOperatingIds((prev) => {
        const newClosing = new Set(prev.closing);
        newClosing.delete(requestId);
        return { ...prev, closing: newClosing };
      });
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
      }}
    >
      <Box sx={{ width: "100%", height: "4px" }}>
        {loadingState.mrList && <LinearProgress />}
      </Box>
      {/* 创建合并请求部分 */}
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
        <Box
          display="flex"
          alignItems="center"
          gap={2}
          flexWrap="wrap"
          flex={1}
        >
          <Typography
            variant="subtitle2"
            sx={{ minWidth: "auto", fontWeight: "bold" }}
          >
            合并请求：
          </Typography>
          <BranchSelector
            token={token}
            orgId={orgId}
            repoId={selectedRepo}
            label="源分支"
            placeholder="输入或选择源分支..."
            value={branchState.sourceBranch}
            onChange={handleSourceBranchChange}
            onError={showMessage}
            sx={{ minWidth: 200, flex: 1 }}
            size="small"
          />
          <BranchSelector
            token={token}
            orgId={orgId}
            repoId={selectedRepo}
            label="目标分支"
            placeholder="输入或选择目标分支..."
            value={branchState.targetBranch}
            onChange={handleTargetBranchChange}
            onError={showMessage}
            sx={{ minWidth: 200, flex: 1 }}
            size="small"
          />
        </Box>
        <Box
          display="flex"
          alignItems="center"
          gap={2}
          flexWrap="wrap"
          justifyContent="flex-end"
        >
          <Button
            variant="outlined"
            onClick={handleOpenCompareDialog}
            sx={{ minWidth: 80 }}
            disabled={
              !branchState.sourceBranch ||
              !branchState.targetBranch ||
              loadingState.creating
            }
          >
            代码对比
          </Button>
          <Button
            variant="contained"
            onClick={handleCreateMergeRequest}
            sx={{
              minWidth: 100,
              opacity: canCreateMerge ? 1 : 0.6,
              backgroundColor: canCreateMerge ? undefined : "grey.400",
              "&:hover": {
                backgroundColor: canCreateMerge ? undefined : "grey.500",
              },
            }}
            disabled={
              !branchState.sourceBranch ||
              !branchState.targetBranch ||
              loadingState.creating ||
              !canCreateMerge
            }
            startIcon={
              loadingState.creating ? <CircularProgress size={16} /> : null
            }
          >
            {loadingState.creating ? "创建中..." : "新建合并"}
          </Button>
        </Box>
      </Paper>

      {/* 合并请求列表部分 */}
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
            合并请求列表
          </Typography>
          <IconButton
            onClick={() => fetchMergeRequests(mrPage)}
            disabled={loadingState.mrList}
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
            <RefreshIcon />
          </IconButton>
        </Box>
        <Box sx={{ flex: 1, minHeight: 0 }}>
          <DataGrid
            rows={mergeRequests.map((mr, index) => ({
              id: mr.localId || mr.id || index,
              title: mr.title,
              description: mr.description,
              sourceBranch: mr.sourceBranch,
              targetBranch: mr.targetBranch,
              state: mr.state,
              author: mr.author?.name || "未知",
              updatedAt: mr.updatedAt,
              detailUrl: mr.detailUrl || "",
              hasConflict: mr.hasConflict || false,
              localId: mr.localId,
              originalData: mr,
            }))}
            columns={[
              {
                field: "title",
                headerName: "标题",
                flex: 1.5,
                minWidth: 250,
                renderCell: (params) => (
                  <Box
                    sx={{
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "center",
                      alignItems: "flex-start",
                      height: "100%",
                      textAlign: "left",
                    }}
                    title={params.row.title}
                  >
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight: "medium",
                        whiteSpace: "normal",
                        wordBreak: "break-word",
                        lineHeight: 1.3,
                      }}
                    >
                      {params.row.title}
                    </Typography>
                    {params.row.description && (
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{
                          display: "block",
                          whiteSpace: "normal",
                          wordBreak: "break-word",
                          lineHeight: 1.2,
                          mt: 0.5,
                        }}
                      >
                        {params.row.description.length > 80
                          ? `${params.row.description.substring(0, 80)}...`
                          : params.row.description}
                      </Typography>
                    )}
                  </Box>
                ),
              },
              {
                field: "sourceBranch",
                headerName: "源分支",
                flex: 1,
                minWidth: 100,
              },
              {
                field: "targetBranch",
                headerName: "目标分支",
                flex: 1,
                minWidth: 100,
              },
              {
                field: "state",
                headerName: "状态",
                headerAlign: "center",
                align: "center",
                minWidth: 100,
                renderCell: (params) => {
                  const status = getMergeRequestStatus(params.value);
                  const colorMap = {
                    success: "#2e7d32",
                    error: "#d32f2f",
                    warning: "#ed6c02",
                    info: "#0288d1",
                    default: "#757575",
                  };
                  const color = colorMap[status.color] || colorMap.default;
                  return (
                    <Typography
                      variant="body2"
                      sx={{
                        color: color,
                        fontWeight: 500,
                        fontSize: "13px",
                        textAlign: "center",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        height: "100%",
                      }}
                    >
                      {status.text}
                    </Typography>
                  );
                },
              },
              {
                field: "author",
                headerName: "创建者",
                minWidth: 100,
              },
              {
                field: "updatedAt",
                headerName: "更新时间",
                flex: 1,
                minWidth: 120,
                headerAlign: "center",
                align: "center",
                renderCell: (params) => {
                  if (!params.value) return "-";

                  try {
                    return moment(params.value).format('YYYY-MM-DD HH:mm');
                  } catch (error) {
                    return "-";
                  }
                },
              },
              {
                field: "detailUrl",
                headerName: "URL链接",
                headerAlign: "center",
                align: "center",
                minWidth: 100,
                renderCell: (params) => (
                  <a
                    href={params.value}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      color: "#1976d2",
                      textDecoration: "none",
                      fontSize: "13px",
                      display: "block",
                      textAlign: "center",
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.textDecoration = "underline";
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.textDecoration = "none";
                    }}
                  >
                    查看
                  </a>
                ),
              },
              {
                field: "hasConflict",
                headerName: "冲突状态",
                width: 100,
                headerAlign: "center",
                align: "center",
                renderCell: (params) => {
                  const hasConflict = params.value;
                  const color = hasConflict ? "#d32f2f" : "#2e7d32";
                  const IconComponent = hasConflict
                    ? ErrorIcon
                    : CheckCircleIcon;
                  return (
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        height: "100%",
                      }}
                    >
                      <IconComponent
                        sx={{
                          color: color,
                          fontSize: "18px",
                        }}
                      />
                    </Box>
                  );
                },
              },
              {
                field: "actions",
                headerName: "操作",
                flex: 1,
                minWidth: 150,
                sortable: false,
                headerAlign: "center",
                align: "center",
                renderCell: (params) => {
                  const canMerge = params.row.state === "TO_BE_MERGED";
                  const canClose = [
                    "TO_BE_MERGED",
                    "UNDER_REVIEW",
                    "OPEN",
                    "DRAFT",
                    "REVIEWING",
                  ].includes(params.row.state);

                  return (
                    <Box
                      sx={{
                        display: "flex",
                        gap: 2,
                        alignItems: "center",
                        justifyContent: "center",
                        height: "100%",
                        minHeight: "52px",
                      }}
                    >
                      {canMerge && (
                        <Typography
                          variant="body2"
                          onClick={() => handleMergeRequest(params.row)}
                          sx={{
                            color:
                              operatingIds.merging.has(params.row.id) ||
                              operatingIds.closing.has(params.row.id)
                                ? "#9e9e9e"
                                : "#2e7d32",
                            fontWeight: 500,
                            fontSize: "13px",
                            cursor:
                              operatingIds.merging.has(params.row.id) ||
                              operatingIds.closing.has(params.row.id)
                                ? "not-allowed"
                                : "pointer",
                            "&:hover": {
                              color:
                                operatingIds.merging.has(params.row.id) ||
                                operatingIds.closing.has(params.row.id)
                                  ? "#9e9e9e"
                                  : "#1b5e20",
                              textDecoration: "underline",
                            },
                          }}
                        >
                          {operatingIds.merging.has(params.row.id)
                            ? "合并中..."
                            : "合并"}
                        </Typography>
                      )}
                      {canClose && (
                        <Typography
                          variant="body2"
                          onClick={() => handleCloseRequest(params.row)}
                          sx={{
                            color:
                              operatingIds.merging.has(params.row.id) ||
                              operatingIds.closing.has(params.row.id)
                                ? "#9e9e9e"
                                : "#d32f2f",
                            fontWeight: 500,
                            fontSize: "13px",
                            cursor:
                              operatingIds.merging.has(params.row.id) ||
                              operatingIds.closing.has(params.row.id)
                                ? "not-allowed"
                                : "pointer",
                            "&:hover": {
                              color:
                                operatingIds.merging.has(params.row.id) ||
                                operatingIds.closing.has(params.row.id)
                                  ? "#9e9e9e"
                                  : "#b71c1c",
                              textDecoration: "underline",
                            },
                          }}
                        >
                          {operatingIds.closing.has(params.row.id)
                            ? "关闭中..."
                            : "关闭"}
                        </Typography>
                      )}
                    </Box>
                  );
                },
              },
            ]}
            paginationModel={{
              page: mrPage - 1,
              pageSize: mrPerPage,
            }}
            pageSizeOptions={[10, 20, 50]}
            pagination
            paginationMode="server"
            rowCount={mrTotal}
            onPaginationModelChange={(model) => {
              const newPage = model.page + 1;
              const newPageSize = model.pageSize;

              if (newPage !== mrPage) {
                setMrPage(newPage);
                fetchMergeRequests(newPage, newPageSize);
              }

              if (newPageSize !== mrPerPage) {
                setMrPerPage(newPageSize);
                setMrPage(1);
                fetchMergeRequests(1, newPageSize);
              }
            }}
            loading={loadingState.mrList}
            disableSelectionOnClick
            localeText={{
              noRowsLabel: "暂无合并请求",
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
              },
            }}
          />
        </Box>
      </Paper>

      {/* 代码比较弹窗 */}
      <CompareDialog
        open={compareDialogOpen}
        onClose={() => setCompareDialogOpen(false)}
        sourceBranch={branchState.sourceBranch?.name}
        targetBranch={branchState.targetBranch?.name}
        token={token}
        orgId={orgId}
        repoId={selectedRepo}
      />
    </Box>
  );
}
