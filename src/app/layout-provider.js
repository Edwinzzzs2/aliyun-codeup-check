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
} from "@mui/material";
import { Assessment, MergeType, Settings, Sync } from "@mui/icons-material";

const drawerWidth = 200;

const menuItems = [
  {
    text: "检测合并",
    icon: <Assessment />,
    path: "/",
  },
  {
    text: "代码合并",
    icon: <MergeType />,
    path: "/merge",
  },
];

export function LayoutProvider({ children }) {
  const router = useRouter();
  const pathname = usePathname();

  // 共享状态 - Token配置与代码库列表
  const [token, setToken] = useState("");
  const [orgId, setOrgId] = useState("5f9a23913a5188f27f3f344b");
  const [repos, setRepos] = useState([]);
  const [selectedRepo, setSelectedRepo] = useState("");
  const [loading, setLoading] = useState({ repos: false, global: false });
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "info" });

  const showMessage = (message, severity = "info") => {
    setSnackbar({ open: true, message, severity });
  };

  // 初始化Token、OrgId和选中的代码库
  useEffect(() => {
    const savedToken = localStorage.getItem("codeup_token");
    const savedOrgId =
      localStorage.getItem("codeup_orgid") || "5f9a23913a5188f27f3f344b";
    const savedRepo = localStorage.getItem("codeup_selected_repo");

    if (savedToken) {
      setToken(savedToken);
      setOrgId(savedOrgId);
    }
    
    if (savedRepo) {
      setSelectedRepo(savedRepo);
    }
  }, []);

  // 自动获取代码库列表
  useEffect(() => {
    if (token && orgId) {
      fetchRepos();
    }
  }, [token, orgId]);

  // 监听全局loading状态变化
  useEffect(() => {
    const handleGlobalLoadingChange = (event) => {
      const { loading: isLoading } = event.detail;
      setLoading((prev) => ({ ...prev, global: isLoading }));
    };

    window.addEventListener('globalLoadingChange', handleGlobalLoadingChange);
    return () => {
      window.removeEventListener('globalLoadingChange', handleGlobalLoadingChange);
    };
  }, []);

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
      showMessage("获取代码库失败", "error");
      setRepos([]);
    } finally {
      setLoading((prev) => ({ ...prev, repos: false }));
    }
  };

  const handleRepoChange = (e) => {
    const value = e.target.value;
    setSelectedRepo(value);
    localStorage.setItem("codeup_selected_repo", value);
    // 通知子页面仓库发生变化
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("repoChange", { detail: { repoId: value } })
      );
    }
  };

  const handleNavigation = (path) => {
    router.push(path);
  };

  const openConfigDialog = () => {
    // 触发全局配置对话框（通过事件或共享状态）
    window.dispatchEvent(new CustomEvent("openConfigDialog"));
  };

  return (
    <Box sx={{ display: "flex" }}>
      {/* 全局Loading进度条 - 始终保留空间，避免页面抖动 */}
      <Box sx={{ 
        position: "fixed", 
        top: 0, 
        left: 0, 
        right: 0, 
        height: "4px", 
        zIndex: 1300,
        backgroundColor: "transparent"
      }}>
        {(loading.repos || loading.global) && (
          <LinearProgress sx={{ position: "absolute", top: 0, left: 0, right: 0 }} />
        )}
      </Box>
      
      {/* 左侧导航栏 */}
      <Drawer
        variant="permanent"
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          "& .MuiDrawer-paper": {
            width: drawerWidth,
            boxSizing: "border-box",
            backgroundColor: "#fafbfc",
            borderRight: "1px solid rgba(0, 0, 0, 0.12)",
          },
        }}
      >
        <Toolbar>
          <Typography
            variant="h6"
            noWrap
            component="div"
            sx={{ fontSize: "1rem", fontWeight: 600 }}
          >
            CodeUp 工具
          </Typography>
        </Toolbar>
        <Divider />
        <List>
          {menuItems.map((item) => (
            <ListItem key={item.text} disablePadding>
              <ListItemButton
                selected={pathname === item.path}
                onClick={() => handleNavigation(item.path)}
                sx={{
                  "&.Mui-selected": {
                    backgroundColor: "rgba(25, 118, 210, 0.08)",
                    "&:hover": {
                      backgroundColor: "rgba(25, 118, 210, 0.12)",
                    },
                  },
                }}
              >
                <ListItemIcon
                  sx={{ color: pathname === item.path ? "#1976d2" : "inherit" }}
                >
                  {item.icon}
                </ListItemIcon>
                <ListItemText
                  primary={item.text}
                  sx={{
                    "& .MuiListItemText-primary": {
                      color: pathname === item.path ? "#1976d2" : "inherit",
                      fontWeight: pathname === item.path ? 600 : 400,
                    },
                  }}
                />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      </Drawer>

      {/* 主内容区域 */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          height: "100vh",
          backgroundColor: "#fafbfc",
          backgroundImage: "linear-gradient(135deg, #ffffff 0%, #f0f2f5 100%)",
          overflow: "hidden", // 防止主容器滚动
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* 顶部工具栏 */}
        <AppBar
          position="fixed"
          elevation={0}
          sx={{
            backgroundColor: "#ffffff",
            backdropFilter: "blur(20px)",
            borderBottom: "1px solid #e0e0e0",
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.08)",
            zIndex: 1200,
            top: "4px", // 为loading进度条留出空间
            left: `${drawerWidth}px`, // 避开左侧导航栏
            width: `calc(100% - ${drawerWidth}px)`, // 调整宽度
          }}
        >
          <Toolbar sx={{ justifyContent: "space-between", minHeight: "56px !important", py: 1 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
              <FormControl size="small" sx={{ minWidth: 300 }}>
                <InputLabel id="global-repo-select-label">
                  选择代码库
                </InputLabel>
                <Select
                  labelId="global-repo-select-label"
                  value={selectedRepo}
                  label="选择代码库"
                  onChange={handleRepoChange}
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
            </Box>

            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Button
                variant="outlined"
                size="small"
                startIcon={
                  loading.repos ? <CircularProgress size={16} /> : <Sync />
                }
                onClick={fetchRepos}
                disabled={loading.repos || !token}
                sx={{ color: "#1976d2", borderColor: "#1976d2" }}
              >
                {loading.repos ? "同步中..." : "同步"}
              </Button>
              <Button
                variant="outlined"
                size="small"
                startIcon={<Settings />}
                onClick={openConfigDialog}
                sx={{ color: "#1976d2", borderColor: "#1976d2" }}
              >
                配置 Token
              </Button>
            </Box>
          </Toolbar>
        </AppBar>

        {/* 页面内容 */}
        <Box sx={{ 
          minHeight: 'calc(100vh - 100px)', // 内容区域最小高度=视口高度-头部占用，内容不足不滚动
          mt: '100px', // 将内容整体下移，避开固定AppBar
          overflowY: 'auto', // 仅超出时出现滚动
          overflowX: 'hidden',
          p: 1,
          '& > *': { mb: 1.5 } 
        }}>{children}</Box>
      </Box>

      {/* 全局消息提示 */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar((s) => ({ ...s, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
