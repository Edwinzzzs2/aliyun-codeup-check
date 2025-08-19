"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  Box,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  AppBar,
  Toolbar,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  CircularProgress,
  Divider,
  Snackbar,
  Alert,
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  InputAdornment,
  IconButton,
} from "@mui/material";
import {
  Assessment,
  MergeType,
  Settings,
  Sync,
  Visibility,
  VisibilityOff,
  ExpandMore,
} from "@mui/icons-material";
import { TokenProvider, useToken, useTokenDialog, useTokenMessage, useGlobalLoading, useRepoChange, useTokenConfigDialog } from "../contexts/TokenContext";

const drawerWidth = 200;

const menuItems = [
  {
    text: "检测合并",
    icon: <Assessment />,
    path: "/check",
  },
  {
    text: "代码合并",
    icon: <MergeType />,
    path: "/merge",
  },
];

// 内部布局组件
function LayoutContent({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const { token, orgId } = useToken();
  const { snackbar, setSnackbar, showMessage } = useTokenMessage();
  const { globalLoading, setGlobalLoadingState } = useGlobalLoading();
  const { selectedRepo, setSelectedRepo, handleRepoChange } = useRepoChange();
  const { openConfigDialog: openConfigDialogFromContext } = useTokenConfigDialog();

  // 代码库相关状态
  const [repos, setRepos] = useState([]);
  const [loading, setLoading] = useState({ repos: false });

  // 初始化选中的代码库
  useEffect(() => {
    const savedRepo = localStorage.getItem("codeup_selected_repo");
    if (savedRepo) {
      setSelectedRepo(savedRepo);
    }
  }, []);

  // 自动获取代码库列表（先读缓存，无缓存再请求）
  useEffect(() => {
    if (token && orgId) {
      const cacheKey = `codeup_repos_cache_${orgId || 'default'}`;
      try {
        const cached = JSON.parse(localStorage.getItem(cacheKey) || 'null');
        if (Array.isArray(cached) && cached.length > 0) {
          setRepos(cached);
          return; // 有缓存则不发起请求
        }
      } catch (_) {}
      fetchRepos();
    }
  }, [token, orgId]);

  // 默认重定向到第一个菜单项
  useEffect(() => {
    if (pathname === '/' && menuItems.length > 0) {
      router.push(menuItems[0].path);
    }
  }, [pathname, router]);

  // 全局加载状态已通过Context管理，无需事件监听

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
      try {
        const cacheKey = `codeup_repos_cache_${orgId || 'default'}`;
        localStorage.setItem(cacheKey, JSON.stringify(filteredRepos));
      } catch (_) {}
    } catch (error) {
      showMessage("获取代码库失败", "error");
      setRepos([]);
    } finally {
      setLoading((prev) => ({ ...prev, repos: false }));
    }
  };

  const handleRepoSelection = (e) => {
    const value = e.target.value;
    localStorage.setItem("codeup_selected_repo", value);
    // 使用Context方法通知仓库变化
    handleRepoChange(value);
  };

  const handleNavigation = (path) => {
    router.push(path);
  };

  const openConfigDialog = () => {
    // 直接调用Context中的openConfigDialog方法
    openConfigDialogFromContext();
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          backgroundColor: "#ffffff",
          backdropFilter: "blur(12px)",
          boxShadow: "0 2px 8px rgba(0, 0, 0, 0.06)",
          borderBottom: "1px solid #eaeef5",
          zIndex: (theme) => theme.zIndex.drawer + 1,
        }}
      >
        <Toolbar sx={{ justifyContent: "space-between", minHeight: "64px !important", px: 3 }}>
          {/* 左侧：应用标题 + 代码库选择 */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Typography variant="h6" noWrap component="div" sx={{ fontSize: "1.25rem", fontWeight: 700, color: "#1976d2" }}>
              CodeUp 工具
            </Typography>
            <FormControl size="small" sx={{ minWidth: 320 }}>
              <InputLabel id="global-repo-select-label">选择代码库</InputLabel>
              <Select labelId="global-repo-select-label" value={selectedRepo} label="选择代码库" onChange={handleRepoSelection} disabled={loading.repos} sx={{ backgroundColor: "white" }}>
                {repos.map((repo) => (
                  <MenuItem key={repo.id} value={repo.id}>
                    {repo.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
          {/* 右侧：操作按钮 */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Button variant="outlined" size="small" startIcon={loading.repos ? <CircularProgress size={16} /> : <Sync />} onClick={fetchRepos} disabled={loading.repos || !token} sx={{ color: "#1976d2", borderColor: "#1976d2" }}>
              {loading.repos ? "同步中..." : "同步"}
            </Button>
            <Button variant="outlined" size="small" startIcon={<Settings />} onClick={openConfigDialog} sx={{ color: "#1976d2", borderColor: "#1976d2" }}>
              配置 Token
            </Button>
          </Box>
        </Toolbar>
        {(loading.repos || globalLoading) && (
          <LinearProgress sx={{ position: "absolute", bottom: 0, left: 0, right: 0 }} />
        )}
      </AppBar>
      {/* 下方区域：左侧导航 + 右侧内容 */}
      <Box sx={{ display: "flex", flexGrow: 1, mt: 8 }}>
        {/* 左侧导航栏 */}
        <Drawer
          variant="permanent"
          sx={{
            width: drawerWidth,
            flexShrink: 0,
            "& .MuiDrawer-paper": {
              width: drawerWidth,
              boxSizing: "border-box",
              backgroundColor: "#f7f9fc",
              borderRight: "1px solid rgba(0, 0, 0, 0.08)",
              position: "relative",
              mt: 0,
            },
          }}
        >
          <List sx={{ pt: 2 }}>
            {menuItems.map((item) => (
              <ListItem key={item.text} disablePadding>
                <ListItemButton
                  selected={pathname === item.path}
                  onClick={() => handleNavigation(item.path)}
                  sx={{
                    "&.Mui-selected": {
                      backgroundColor: "rgba(25, 118, 210, 0.08)",
                      "&:hover": { backgroundColor: "rgba(25, 118, 210, 0.12)" },
                    },
                  }}
                >
                  <ListItemIcon sx={{ color: pathname === item.path ? "#1976d2" : "inherit" }}>
                    {item.icon}
                  </ListItemIcon>
                  <ListItemText
                    primary={item.text}
                    sx={{ "& .MuiListItemText-primary": { color: pathname === item.path ? "#1976d2" : "inherit", fontWeight: pathname === item.path ? 600 : 400 } }}
                  />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        </Drawer>

        {/* 右侧主内容区域 */}
        <Box component="main" sx={{ flexGrow: 1, height: "calc(100vh - 64px)",  overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <Box sx={{ flexGrow: 1, overflow: "hidden", p: 3, backgroundColor: "#f5f7fb" }}>{children}</Box>
        </Box>
      </Box>
      {/* Token配置弹窗组件 */}
      <TokenConfigDialog />

      {/* 消息提示组件 */}
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

// Token配置弹窗组件
function TokenConfigDialog() {
  const {
    configDialog,
    tempToken,
    setTempToken,
    tempOrgId,
    setTempOrgId,
    showPassword,
    setShowPassword,
    showTokenGuide,
    setShowTokenGuide,
    handleConfigSave,
    handleConfigCancel,
  } = useTokenDialog();

  return (
    <Dialog
      open={configDialog}
      onClose={handleConfigCancel}
      fullWidth
      maxWidth="sm"
    >
      <DialogTitle>配置阿里云 CodeUp Token</DialogTitle>
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
                sx={{
                  color: "#4caf50",
                  fontWeight: "bold",
                  display: "block",
                  mt: 1,
                }}
              >
                🔒 隐私保护：Token仅存储在您的浏览器本地，服务器不存储任何数据
              </Typography>
            </Box>
          )}
        </Box>

        <TextField
          margin="normal"
          label="CodeUp Token"
          type={showPassword ? "text" : "password"}
          value={tempToken}
          onChange={(e) => setTempToken(e.target.value)}
          fullWidth
          placeholder="请输入阿里云 CodeUp Token"
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
  );
}

// 主布局Provider组件
export function LayoutProvider({ children }) {
  return (
    <TokenProvider>
      <LayoutContent>{children}</LayoutContent>
    </TokenProvider>
  );
}
