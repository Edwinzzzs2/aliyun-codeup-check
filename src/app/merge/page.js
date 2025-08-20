"use client";
import {
  Autocomplete,
  Button,
  TextField,
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
import { DataGrid } from "@mui/x-data-grid";
import { useState, useEffect, useRef } from "react";
import {
  useTokenConfig,
  useTokenMessage,
  useRepoChange,
} from "../../contexts/TokenContext";
export default function MergeRequest() {
  const { token, orgId } = useTokenConfig();
  const { selectedRepo, repoChangeTimestamp } = useRepoChange();
  const { showMessage } = useTokenMessage();
  const [sourceBranch, setSourceBranch] = useState(null);
  const [targetBranch, setTargetBranch] = useState(null);
  const [sourceBranches, setSourceBranches] = useState([]);
  const [targetBranches, setTargetBranches] = useState([]);
  const [loadingSource, setLoadingSource] = useState(false);
  const [loadingTarget, setLoadingTarget] = useState(false);
  const [creatingMR, setCreatingMR] = useState(false);
  const [searchSource, setSearchSource] = useState("");
  const [searchTarget, setSearchTarget] = useState("");
  const searchTimerRef = useRef(null);

  // 合并请求列表相关状态
  const [mergeRequests, setMergeRequests] = useState([]);
  const [loadingMRList, setLoadingMRList] = useState(false);
  const [mrPage, setMrPage] = useState(1);
  const [mrTotal, setMrTotal] = useState(0);
  const [mrPerPage, setMrPerPage] = useState(10);
  const [mergingIds, setMergingIds] = useState(new Set());
  const [closingIds, setClosingIds] = useState(new Set());
  const [checkingMergeStatus, setCheckingMergeStatus] = useState(false);
  const [canCreateMerge, setCanCreateMerge] = useState(false);

  useEffect(() => {
    // 监听仓库变更，清空分支选择和数据
    if (selectedRepo && repoChangeTimestamp) {
      setSourceBranch(null);
      setTargetBranch(null);
      setSourceBranches([]);
      setTargetBranches([]);
      setSearchSource("");
      setSearchTarget("");
    }
  }, [selectedRepo, repoChangeTimestamp]);

  // 监听仓库变更，获取合并请求列表
  useEffect(() => {
    if (selectedRepo && token && orgId) {
      fetchMergeRequests(1);
      setMrPage(1);
    }
  }, [selectedRepo, token, orgId]);

  // 监听分支选择变化，重置检测状态
  useEffect(() => {
    setCanCreateMerge(false);
  }, [sourceBranch, targetBranch]);

  // 获取合并请求列表
  const fetchMergeRequests = async (page = 1, pageSize = mrPerPage) => {
    if (!selectedRepo || !token || !orgId) return;

    setLoadingMRList(true);
    try {
      const params = new URLSearchParams({
        token,
        orgId,
        repoId: selectedRepo,
        page: page.toString(),
        perPage: pageSize.toString(),
      });

      const response = await fetch(
        `/api/codeup/change-requests?${params.toString()}`
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
      setLoadingMRList(false);
    }
  };

  const fetchBranches = async (kind, q = "") => {
    if (!token || !selectedRepo) return;
    if (kind === "source") setLoadingSource(true);
    else setLoadingTarget(true);

    const params = new URLSearchParams({
      token,
      orgId,
      repoId: selectedRepo,
      search: q,
    });
    try {
      const res = await fetch(`/api/codeup/branches?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (kind === "source") {
        setSourceBranches(data.result || []);
      } else {
        setTargetBranches(data.result || []);
      }
    } catch (e) {
      console.error(e);
      if (kind === "source") setSourceBranches([]);
      else setTargetBranches([]);
    } finally {
      if (kind === "source") setLoadingSource(false);
      else setLoadingTarget(false);
    }
  };

  useEffect(() => {
    if (token && selectedRepo) {
      fetchBranches("source", "");
      fetchBranches("target", "");
    }
  }, [token, orgId, selectedRepo]);

  const handleSearchChange = (kind, value) => {
    if (kind === "source") setSearchSource(value);
    else setSearchTarget(value);

    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      fetchBranches(kind, value);
    }, 400);
  };

  const handleCreateMergeRequest = async () => {
    if (!sourceBranch || !targetBranch) {
      showMessage("请选择源分支和目标分支", "warning");
      return;
    }

    if (sourceBranch.name === targetBranch.name) {
      showMessage("源分支和目标分支不能相同", "warning");
      return;
    }

    setCreatingMR(true);

    try {
      const payload = {
        token,
        orgId,
        repoId: selectedRepo,
        sourceBranch: sourceBranch.name,
        targetBranch: targetBranch.name,
        title: `${
          sourceBranch.commit?.message
            ? `${sourceBranch.commit.message}`
            : `${sourceBranch.name}-->${targetBranch.name}`
        }`,
        description: `created by aliyun-codeup-check`,
      };

      const res = await fetch("/api/codeup/change-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json();
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

      // 创建成功后清空选择并刷新合并请求列表
      setSourceBranch(null);
      setTargetBranch(null);
      fetchMergeRequests(mrPage);
    } catch (error) {
      console.error("创建合并请求时发生错误:", error);
      showMessage("创建合并请求时发生错误", "error");
    } finally {
      setCreatingMR(false);
    }
  };

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

  // 检测合并状态
  const handleCheckMergeStatus = async () => {
    if (!token || !orgId || !selectedRepo || !sourceBranch || !targetBranch) {
      showMessage("请先选择源分支和目标分支", "warning");
      return;
    }

    setCheckingMergeStatus(true);

    try {
      const response = await fetch("/api/codeup/merge-status", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token: token,
          orgId: orgId,
          repoId: selectedRepo,
          target: targetBranch.name,
          branches: [
            {
              name: sourceBranch.name,
              commitId: sourceBranch.commit?.id || "",
            },
          ],
        }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        // API返回的是批量检测结果，取第一个分支的结果
        const branchResult = result?.results?.[0];
        const isMerged = branchResult?.merged || false;
        // 只有检测通过且分支未合并时才允许新建合并
        setCanCreateMerge(!isMerged);

        if (isMerged) {
          showMessage("分支已合并，无需重复创建合并请求", "info");
        } else {
          showMessage("分支未合并，可以创建合并请求", "success");
        }
      } else {
        showMessage(
          result.errorDescription || result.error || "检测合并状态失败",
          "error"
        );
        setCanCreateMerge(true); // 检测失败时允许创建
      }
    } catch (error) {
      console.error("检测合并状态错误:", error);
      showMessage("检测合并状态时发生错误", "error");
      setCanCreateMerge(true); // 检测失败时允许创建
    } finally {
      setCheckingMergeStatus(false);
    }
  };

  // 处理合并请求
  const handleMergeRequest = async (rowData) => {
    if (!token || !orgId || !selectedRepo) {
      showMessage("缺少必要的配置信息", "error");
      return;
    }

    const requestId = rowData.id;
    const originalData = rowData.originalData;

    // 添加到正在合并的集合中
    setMergingIds((prev) => new Set([...prev, requestId]));

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
      setMergingIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(requestId);
        return newSet;
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
    setClosingIds((prev) => new Set([...prev, requestId]));

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
      setClosingIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(requestId);
        return newSet;
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
        {loadingMRList && <LinearProgress />}
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
        <Box display="flex" alignItems="center" gap={2} flexWrap="wrap">
          <Typography
            variant="subtitle2"
            sx={{ minWidth: "auto", fontWeight: "bold" }}
          >
            合并请求：
          </Typography>
          <Autocomplete
            options={sourceBranches}
            getOptionLabel={(option) => option.name}
            loading={loadingSource}
            inputValue={searchSource}
            onInputChange={(event, newInputValue) => {
              handleSearchChange("source", newInputValue);
            }}
            onChange={(event, newValue) => {
              setSourceBranch(newValue);
            }}
            sx={{ minWidth: 200, flex: 1 }}
            renderInput={(params) => (
              <TextField
                {...params}
                label="源分支"
                placeholder="输入或选择源分支..."
                size="small"
              />
            )}
          />
          <Autocomplete
            options={targetBranches}
            getOptionLabel={(option) => option.name}
            loading={loadingTarget}
            inputValue={searchTarget}
            onInputChange={(event, newInputValue) => {
              handleSearchChange("target", newInputValue);
            }}
            onChange={(event, newValue) => {
              setTargetBranch(newValue);
            }}
            sx={{ minWidth: 200, flex: 1 }}
            renderInput={(params) => (
              <TextField
                {...params}
                label="目标分支"
                placeholder="输入或选择目标分支..."
                size="small"
              />
            )}
          />
          <Button
            variant="outlined"
            onClick={handleCheckMergeStatus}
            sx={{ minWidth: 80 }}
            disabled={
              !sourceBranch ||
              !targetBranch ||
              checkingMergeStatus ||
              creatingMR
            }
            startIcon={
              checkingMergeStatus ? <CircularProgress size={16} /> : null
            }
          >
            {checkingMergeStatus ? "检测中..." : "检测"}
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
              !sourceBranch || !targetBranch || creatingMR || !canCreateMerge
            }
            startIcon={creatingMR ? <CircularProgress size={16} /> : null}
          >
            {creatingMR ? "创建中..." : "新建合并"}
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
            disabled={loadingMRList}
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
              flex: 2.5,
              minWidth: 250,
              renderCell: (params) => (
                <Box
                  sx={{
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: params.row.description
                      ? "flex-start"
                      : "center",
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
              minWidth: 120,
            },
            {
              field: "targetBranch",
              headerName: "目标分支",
              flex: 1,
              minWidth: 120,
            },
            {
              field: "state",
              headerName: "状态",
              flex: 1,
              minWidth: 100,
              renderCell: (params) => {
                const status = getMergeRequestStatus(params.value);
                return (
                  <Chip label={status.text} color={status.color} size="small" />
                );
              },
            },
            {
              field: "author",
              headerName: "创建者",
              flex: 1,
              minWidth: 100,
            },
            {
              field: "updatedAt",
              headerName: "更新时间",
              flex: 1,
              minWidth: 150,
              renderCell: (params) =>
                params.value
                  ? new Date(params.value).toLocaleString("zh-CN")
                  : "-",
            },
            {
              field: "detailUrl",
              headerName: "URL链接",
              flex: 1,
              minWidth: 120,
              renderCell: (params) =>
                params.value ? (
                  <Button
                    variant="text"
                    size="small"
                    onClick={() => window.open(params.value, "_blank")}
                    sx={{
                      minWidth: "auto",
                      padding: "2px 8px",
                      fontSize: "12px",
                      textTransform: "none",
                    }}
                  >
                    查看
                  </Button>
                ) : (
                  "-"
                ),
            },
            {
              field: "hasConflict",
              headerName: "冲突状态",
              flex: 1,
              minWidth: 100,
              renderCell: (params) => (
                <Chip
                  label={params.value ? "有冲突" : "无冲突"}
                  color={params.value ? "error" : "success"}
                  size="small"
                  variant="outlined"
                />
              ),
            },
            {
              field: "actions",
              headerName: "操作",
              flex: 1.5,
              minWidth: 150,
              sortable: false,
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
                      gap: 0.5,
                      alignItems: "center",
                      justifyContent: "flex-start",
                    }}
                  >
                    {canMerge && (
                      <Button
                        variant="contained"
                        color="success"
                        size="small"
                        onClick={() => handleMergeRequest(params.row)}
                        disabled={
                          mergingIds.has(params.row.id) ||
                          closingIds.has(params.row.id)
                        }
                        sx={{
                          minWidth: "60px",
                          height: "28px",
                          fontSize: "12px",
                          fontWeight: "medium",
                          borderRadius: "6px",
                          textTransform: "none",
                          boxShadow: "none",
                          "&:hover": {
                            boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                          },
                        }}
                      >
                        {mergingIds.has(params.row.id) ? "合并中..." : "合并"}
                      </Button>
                    )}
                    {canClose && (
                      <Button
                        variant="outlined"
                        color="error"
                        size="small"
                        onClick={() => handleCloseRequest(params.row)}
                        disabled={
                          mergingIds.has(params.row.id) ||
                          closingIds.has(params.row.id)
                        }
                        sx={{
                          minWidth: "60px",
                          height: "28px",
                          fontSize: "12px",
                          fontWeight: "medium",
                          borderRadius: "6px",
                          textTransform: "none",
                          borderWidth: "1px",
                          "&:hover": {
                            backgroundColor: "rgba(211, 47, 47, 0.04)",
                            borderWidth: "1px",
                          },
                        }}
                      >
                        {closingIds.has(params.row.id) ? "关闭中..." : "关闭"}
                      </Button>
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
          loading={loadingMRList}
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
    </Box>
  );
}
