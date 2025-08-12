"use client";

import { useState, useEffect, useRef } from "react";
import {
  Box,
  Button,
  TextField,
  Typography,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Snackbar,
  Alert,
  InputAdornment,
  IconButton,
  CircularProgress,
  Backdrop,
  LinearProgress,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import {
  Visibility,
  VisibilityOff,
  Settings,
  Search,
  Sync,
  ExpandMore,
} from "@mui/icons-material";
import moment from "moment";

export default function HomePage() {
  const [token, setToken] = useState("");
  const [orgId, setOrgId] = useState("5f9a23913a5188f27f3f344b");
  const [repos, setRepos] = useState([]);
  const [selectedRepo, setSelectedRepo] = useState("");
  const [branches, setBranches] = useState([]);
  const [configDialog, setConfigDialog] = useState(false);
  const [tempToken, setTempToken] = useState("");
  const [tempOrgId, setTempOrgId] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [showTokenGuide, setShowTokenGuide] = useState(false);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "info",
  });

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

  // Loading状态 - 合并为一个对象
  const [loading, setLoading] = useState({
    repos: false,
    branches: false,
    global: false,
    merge: false,
  });

  // 页面加载时检查本地存储
  useEffect(() => {
    const savedToken = localStorage.getItem("codeup_token");
    const savedOrgId =
      localStorage.getItem("codeup_orgid") || "5f9a23913a5188f27f3f344b";

    if (savedToken) {
      setToken(savedToken);
      setOrgId(savedOrgId);
      setTempToken(savedToken);
      setTempOrgId(savedOrgId);
    } else {
      // 没有token时自动弹出配置弹窗，并设置默认OrgId
      setTempOrgId(savedOrgId);
      setConfigDialog(true);
    }
  }, []);

  const showMessage = (message, severity = "info") => {
    setSnackbar({ open: true, message, severity });
  };

  const handleConfigSave = () => {
    if (!tempToken.trim()) {
      showMessage("请输入 Token", "error");
      return;
    }

    // 保存到本地存储
    localStorage.setItem("codeup_token", tempToken);
    localStorage.setItem("codeup_orgid", tempOrgId);

    // 更新状态
    setToken(tempToken);
    setOrgId(tempOrgId);
    setConfigDialog(false);

    showMessage("配置保存成功", "success");
  };

  const handleConfigCancel = () => {
    if (!token) {
      // 如果没有已保存的token，不允许取消
      showMessage("请先配置 Token", "warning");
      return;
    }

    // 恢复原值
    setTempToken(token);
    setTempOrgId(orgId);
    setConfigDialog(false);
  };

  const openConfigDialog = () => {
    setTempToken(token);
    setTempOrgId(orgId);
    setConfigDialog(true);
  };

  const fetchRepos = async () => {
    if (!token) return showMessage("请先配置 Token", "error");

    setLoading((prev) => ({ ...prev, repos: true }));
    try {
      const res = await fetch(
        `/api/codeup/repositories?token=${token}&orgId=${orgId}`
      );

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const data = await res.json();

      const list = Array.isArray(data)
        ? data
        : Array.isArray(data?.result)
        ? data.result
        : [];

      const filteredRepos = list
        .filter((repo) => repo.accessLevel && repo.accessLevel !== 0)
        .map((repo) => ({ id: repo.id, name: repo.name }));

      setRepos(filteredRepos);
      showMessage(
        `代码库获取成功，共找到 ${filteredRepos.length} 个有权限的代码库`,
        "success"
      );
    } catch (error) {
      console.error("获取代码库失败:", error);
      showMessage("获取代码库失败", "error");
      setRepos([]);
    } finally {
      setLoading((prev) => ({ ...prev, repos: false }));
    }
  };

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

  const handleRepoChange = (event) => {
    const value = event.target.value;
    setSelectedRepo(value);
    setPage(0);
    setSearchTerm("");
    setSelectedBranchNames([]);
    setMergeStatus({});
    fetchBranches(value, 1, rowsPerPage, "");
  };

  // 当token存在时自动刷新仓库列表
  useEffect(() => {
    if (token && orgId) {
      setLoading((prev) => ({ ...prev, global: true }));
      fetchRepos().finally(() =>
        setLoading((prev) => ({ ...prev, global: false }))
      );
    }
  }, [token, orgId]);

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
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
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

  // DataGrid 列定义
  const columns = [
    {
      field: "name",
      headerName: "分支名",
      flex: 1,
      minWidth: 400,
      sortable: true,
      renderCell: (params) => {
        const branchName = params.row.name;
        const webUrl = params.row.webUrl;
        console.log(params, 22222222222222);
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
      width: 350,
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
      width: 280,
      sortable: false,
      renderCell: (params) => {
        const committedDate =
          params.row.commit?.committedDate || params.row.commit?.authoredDate;
        if (!committedDate) return "-";

        // 使用 moment 进行格式化，兼容 "YYYY-MM-DD HH:mm:ss" 字符串
        const m = moment(
          committedDate,
          [moment.ISO_8601, "YYYY-MM-DD HH:mm:ss"],
          true
        );
        if (!m.isValid()) return committedDate;
        return m.format("YYYY-MM-DD HH:mm");
      },
    },
    {
      field: "mergeStatus",
      headerName: "合并状态",
      width: 220,
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
  ];

  return (
    <Box
      p={3}
      sx={{
        minHeight: "100vh",
        backgroundColor: "#fafbfc",
        backgroundImage: "linear-gradient(135deg, #ffffff 0%, #f0f2f5 100%)",
      }}
    >
      <Box
        display="flex"
        alignItems="center"
        justifyContent="space-between"
        mb={2}
      >
        <Typography
          variant="h5"
          gutterBottom
          sx={{
            m: 0,
            color: "#2c3e50",
            fontWeight: 600,
            textShadow: "0 1px 2px rgba(0,0,0,0.1)",
          }}
        >
          阿里云 Codeup 分支统计检测
        </Typography>
        <Box display="flex" alignItems="center" gap={1}>
          <Button
            variant="outlined"
            size="small"
            startIcon={
              loading.repos ? <CircularProgress size={16} /> : <Sync />
            }
            onClick={fetchRepos}
            disabled={loading.repos || !token}
          >
            {loading.repos ? "同步中..." : "同步"}
          </Button>
          <Button
            variant="outlined"
            size="small"
            startIcon={<Settings />}
            onClick={openConfigDialog}
          >
            配置 Token
          </Button>
        </Box>
      </Box>

      {/* Loading进度条 - 始终保留空间，避免页面抖动 */}
      <Box sx={{ width: "100%", mb: 2, height: "4px" }}>
        {(loading.merge || loading.branches || loading.repos) && (
          <LinearProgress />
        )}
      </Box>
      {/* 选择代码库 + 合并状态检测区域 + 搜索 */}
      <Box
        display="flex"
        alignItems="center"
        justifyContent="space-between"
        flexWrap="wrap"
        gap={2}
        mb={2}
        p={2}
        sx={{
          backgroundColor: "rgba(255, 255, 255, 0.9)",
          borderRadius: 2,
          boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
          border: "1px solid rgba(255,255,255,0.2)",
          backdropFilter: "blur(10px)",
        }}
      >
        <Box display="flex" alignItems="center" gap={2} flexWrap="wrap">
          <FormControl size="small" sx={{ minWidth: 300 }}>
            <InputLabel id="repo-select-label">选择代码库</InputLabel>
            <Select
              labelId="repo-select-label"
              value={selectedRepo}
              label="选择代码库"
              onChange={handleRepoChange}
              disabled={loading.repos}
            >
              {repos.map((repo) => (
                <MenuItem key={repo.id} value={repo.id}>
                  {repo.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Typography
            variant="subtitle2"
            sx={{ minWidth: "auto", marginLeft: "48px", fontWeight: "bold" }}
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
      </Box>

      <Paper
        sx={{
          height: "calc(100dvh - 280px)",
          width: "100%",
          mt: 2,
          minHeight: 400,
          backgroundColor: "rgba(255, 255, 255, 0.95)",
          boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
          borderRadius: 2,
          border: "1px solid rgba(255,255,255,0.3)",
          backdropFilter: "blur(10px)",
        }}
      >
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
          sx={{ border: 0 }}
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
      </Paper>

      {/* 全局Loading遮罩 */}
      <Backdrop
        sx={{ color: "#fff", zIndex: (theme) => theme.zIndex.drawer + 1 }}
        open={loading.global}
      >
        <Box display="flex" flexDirection="column" alignItems="center" gap={2}>
          <CircularProgress color="inherit" />
          <Typography variant="h6">初始化中...</Typography>
        </Box>
      </Backdrop>

      {/* 配置弹窗 */}
      <Dialog
        open={configDialog}
        onClose={handleConfigCancel}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>配置阿里云 Codeup Token</DialogTitle>
        <DialogContent>
          {/* Token获取指引区域 */}
          <Box
            sx={{
              mb: 3,
              p: 2,
              backgroundColor: showTokenGuide ? "#e3f2fd" : "#f5f5f5",
              borderRadius: 2,
              border: "1px solid #e1ecf7",
              transition: "all 0.3s ease",
            }}
          >
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                cursor: "pointer",
              }}
              onClick={() => setShowTokenGuide(!showTokenGuide)}
            >
              <Typography
                variant="subtitle2"
                sx={{
                  color: "#1565c0",
                  fontWeight: "bold",
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                }}
              >
                📋 Token 获取指引
              </Typography>
              <ExpandMore
                sx={{
                  transform: showTokenGuide ? "rotate(180deg)" : "rotate(0deg)",
                  transition: "transform 0.3s ease",
                  color: "#1565c0",
                }}
              />
            </Box>

            {showTokenGuide && (
              <Box sx={{ mt: 2, animation: "fadeIn 0.3s ease" }}>
                <Typography variant="body2" sx={{ mb: 2, color: "#666" }}>
                  <strong>步骤 1:</strong> 访问阿里云 DevOps 个人访问令牌页面
                </Typography>
                <Box
                  sx={{
                    mb: 2,
                    p: 2,
                    backgroundColor: "#fff",
                    borderRadius: 1,
                    border: "1px solid #ddd",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                  }}
                >
                  <Typography
                    variant="body2"
                    component="a"
                    href="https://account-devops.aliyun.com/settings/personalAccessToken"
                    target="_blank"
                    rel="noopener noreferrer"
                    sx={{
                      color: "#1976d2",
                      textDecoration: "none",
                      fontWeight: 500,
                      wordBreak: "break-all",
                      "&:hover": {
                        textDecoration: "underline",
                        color: "#0d47a1",
                      },
                    }}
                  >
                    https://account-devops.aliyun.com/settings/personalAccessToken
                  </Typography>
                </Box>
                <Typography variant="body2" sx={{ color: "#666", mb: 1 }}>
                  <strong>步骤 2:</strong>{" "}
                  创建新的个人访问令牌，并为代码管理分配
                  <strong>最低只读权限</strong>
                </Typography>
                <Typography variant="body2" sx={{ color: "#666", mb: 1 }}>
                  <strong>步骤 3:</strong> 复制生成的Token并粘贴到下方输入框中
                </Typography>
                <Typography
                  variant="caption"
                  sx={{ color: "#f57c00", fontWeight: "bold" }}
                >
                  ⚠️ 注意：Token只会显示一次，请妥善保存
                </Typography>
                <Typography
                  variant="caption"
                  sx={{ color: "#4caf50", fontWeight: "bold", display: "block", mt: 1 }}
                >
                  🔒 隐私保护：Token仅存储在您的浏览器本地，服务器不存储任何数据
                </Typography>
              </Box>
            )}
          </Box>

          <TextField
            margin="normal"
            label="Codeup Token"
            type={showPassword ? "text" : "password"}
            value={tempToken}
            onChange={(e) => setTempToken(e.target.value)}
            fullWidth
            placeholder="请输入阿里云 Codeup Token"
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    onClick={() => setShowPassword((p) => !p)}
                    edge="end"
                  >
                    {showPassword ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />

          <TextField
            margin="normal"
            label="组织 OrgId（可选）"
            value={tempOrgId}
            onChange={(e) => setTempOrgId(e.target.value)}
            fullWidth
            placeholder="不填则使用默认组织"
            helperText="默认使用5f9a23913a5188f27f3f344b"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleConfigCancel}>取消</Button>
          <Button variant="contained" onClick={handleConfigSave}>
            保存
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          sx={{ width: "100%" }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
