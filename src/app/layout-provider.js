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
  BottomNavigation,
  BottomNavigationAction,
} from "@mui/material";
import {
  Assessment,
  MergeType,
  Settings,
  Sync,
  Visibility,
  VisibilityOff,
  ExpandMore,
  Notifications,
  History,
  AccountTree,
} from "@mui/icons-material";
import { TokenProvider, useToken, useTokenDialog, useTokenMessage, useGlobalLoading, useRepoChange, useTokenConfigDialog } from "../contexts/TokenContext";
import BuildTime from "../components/BuildTime";

const drawerWidth = 200;

const menuItems = [
  {
    text: "合并状态",
    icon: <Assessment />,
    path: "/check",
  },
  {
    text: "代码合并",
    icon: <MergeType />,
    path: "/merge",
  },
  // 自动合并暂时不在导航中展示，仍可通过 /automerge 直接访问。
  {
    text: "执行日志",
    icon: <History />,
    path: "/logs",
  },
  {
    text: "流水线管理",
    icon: <AccountTree />,
    path: "/pipelines",
  },
  {
    text: "飞书通知",
    icon: <Notifications />,
    path: "/feishu",
  },
  // Webhook测试页面已隐藏，但仍可通过 /webhook-test URL 直接访问
  // {
  //   text: "Webhook测试",
  //   icon: <Sync />,
  //   path: "/webhook-test",
  // },
];

// 内部布局组件
function LayoutContent({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const { token, orgId } = useToken();
  const { snackbar, setSnackbar, showMessage } = useTokenMessage();
  const { globalLoading } = useGlobalLoading();
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
      const params = new URLSearchParams({ orgId });
      const res = await fetch(`/api/codeup/repositories?${params.toString()}`, {
        headers: { "x-yunxiao-token": token },
      });

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
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        minHeight: "100dvh",
        height: { md: "100dvh" },
      }}
    >
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
        <Toolbar
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "minmax(0, 1fr) auto",
              md: "auto minmax(280px, 420px) minmax(24px, 1fr) auto",
            },
            gridTemplateRows: { xs: "40px 48px", md: "64px" },
            alignItems: "center",
            columnGap: { xs: 1, md: 4 },
            rowGap: 1,
            minHeight: { xs: "112px !important", md: "64px !important" },
            px: { xs: 1.5, md: 3 },
            py: { xs: 1, md: 0 },
          }}
        >
          <Typography
            variant="h6"
            noWrap
            component="div"
            sx={{
              gridColumn: 1,
              gridRow: 1,
              fontSize: { xs: "1.05rem", md: "1.25rem" },
              fontWeight: 750,
              color: "#1565c0",
              letterSpacing: "-0.02em",
            }}
          >
            CodeUp 工具
          </Typography>

          <FormControl
            size="small"
            sx={{
              minWidth: 0,
              width: "100%",
              gridColumn: { xs: "1 / 3", md: 2 },
              gridRow: { xs: 2, md: 1 },
            }}
          >
            <InputLabel id="global-repo-select-label">选择代码库</InputLabel>
            <Select
              labelId="global-repo-select-label"
              value={selectedRepo}
              label="选择代码库"
              onChange={handleRepoSelection}
              disabled={loading.repos}
              sx={{ backgroundColor: "white" }}
            >
              {repos.map((repo) => (
                <MenuItem key={repo.id} value={repo.id}>
                  {repo.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              gap: 0.5,
              gridColumn: { xs: 2, md: 4 },
              gridRow: 1,
            }}
          >
            <IconButton
              onClick={fetchRepos}
              disabled={loading.repos || !token}
              aria-label={loading.repos ? "正在同步代码库" : "同步代码库"}
              sx={{ display: { md: "none" }, color: "primary.main" }}
            >
              {loading.repos ? <CircularProgress size={20} /> : <Sync />}
            </IconButton>
            <IconButton
              onClick={openConfigDialog}
              aria-label="配置 Token"
              sx={{ display: { md: "none" }, color: "primary.main" }}
            >
              <Settings />
            </IconButton>
            <Button
              variant="outlined"
              size="small"
              startIcon={
                loading.repos ? <CircularProgress size={16} /> : <Sync />
              }
              onClick={fetchRepos}
              disabled={loading.repos || !token}
              sx={{ display: { xs: "none", md: "inline-flex" } }}
            >
              {loading.repos ? "同步中..." : "同步"}
            </Button>
            <Button
              variant="outlined"
              size="small"
              startIcon={<Settings />}
              onClick={openConfigDialog}
              sx={{ display: { xs: "none", md: "inline-flex" } }}
            >
              配置 Token
            </Button>
          </Box>
        </Toolbar>
        {(loading.repos || globalLoading) && (
          <LinearProgress sx={{ position: "absolute", bottom: 0, left: 0, right: 0 }} />
        )}
      </AppBar>
      {/* 下方区域：左侧导航 + 右侧内容 */}
      <Box
        sx={{
          display: "flex",
          flexGrow: 1,
          minHeight: 0,
          mt: { xs: "112px", md: 8 },
          pb: { xs: "calc(64px + env(safe-area-inset-bottom))", md: 0 },
        }}
      >
        {/* 左侧导航栏 */}
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: "none", md: "block" },
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
          
          {/* 构建时间显示在侧边栏底部 */}
          <Box sx={{ 
            position: 'absolute', 
            bottom: 16, 
            left: 0, 
            right: 8,
            display: 'flex',
            justifyContent: 'center'
          }}>
            <BuildTime />
          </Box>
        </Drawer>

        {/* 右侧主内容区域 */}
        <Box
          component="main"
          sx={{
            minWidth: 0,
            flexGrow: 1,
            height: { md: "calc(100dvh - 64px)" },
            overflow: { xs: "visible", md: "hidden" },
            display: "flex",
            flexDirection: "column",
          }}
        >
          <Box
            sx={{
              flexGrow: 1,
              minWidth: 0,
              overflow: { xs: "visible", md: "hidden" },
              p: { xs: 1.25, sm: 2, md: 3 },
              backgroundColor: "#f5f7fb",
            }}
          >
            {children}
          </Box>
        </Box>
      </Box>
      <BottomNavigation
        showLabels
        value={menuItems.some((item) => item.path === pathname) ? pathname : false}
        onChange={(_, path) => handleNavigation(path)}
        sx={{
          display: { xs: "flex", md: "none" },
          position: "fixed",
          zIndex: (theme) => theme.zIndex.appBar,
          left: 0,
          right: 0,
          bottom: 0,
          height: "calc(64px + env(safe-area-inset-bottom))",
          pb: "env(safe-area-inset-bottom)",
          borderTop: "1px solid",
          borderColor: "divider",
          boxShadow: "0 -10px 30px rgba(31, 41, 55, 0.08)",
          "& .MuiBottomNavigationAction-root": {
            minWidth: 0,
            px: 0.5,
          },
          "& .MuiBottomNavigationAction-label": {
            fontSize: "0.68rem",
            whiteSpace: "nowrap",
          },
        }}
      >
        {menuItems.map((item) => (
          <BottomNavigationAction
            key={item.path}
            label={item.text}
            value={item.path}
            icon={item.icon}
          />
        ))}
      </BottomNavigation>
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
                <strong>只读权限</strong>；如需使用流水线管理，还要为
                <strong>流水线运行实例分配读写权限</strong>
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
                🔒 隐私保护：Token 仅保存在当前浏览器，请求时用于服务端权限校验且不会持久化
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
