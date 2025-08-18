"use client";

import { useEffect, useRef, useState } from "react";
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  InputAdornment,
  CircularProgress,
  Snackbar,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from "@mui/material";
import { Search } from "@mui/icons-material";

export default function MergePage() {
  const [token, setToken] = useState("");
  const [orgId, setOrgId] = useState("5f9a23913a5188f27f3f344b");
  const [repoId, setRepoId] = useState("");

  const [sourceList, setSourceList] = useState([]);
  const [targetList, setTargetList] = useState([]);
  const [sourceBranch, setSourceBranch] = useState("");
  const [targetBranch, setTargetBranch] = useState("");

  const [searchSource, setSearchSource] = useState("");
  const [searchTarget, setSearchTarget] = useState("");
  const searchTimerRef = useRef(null);

  const [loading, setLoading] = useState({ branches: false, creating: false });
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "info" });
  const [createdInfo, setCreatedInfo] = useState(null);

  useEffect(() => {
    const savedToken = localStorage.getItem("codeup_token");
    const savedOrgId = localStorage.getItem("codeup_orgid") || "5f9a23913a5188f27f3f344b";
    const selected = localStorage.getItem("codeup_selected_repo");
    if (savedToken) setToken(savedToken);
    if (savedOrgId) setOrgId(savedOrgId);
    if (selected) setRepoId(selected);
  }, []);

  // 监听全局仓库选择变更（由 LayoutProvider 触发）
  useEffect(() => {
    const handler = (e) => {
      const repo = e.detail?.repoId;
      if (repo) {
        setRepoId(repo);
      }
    };
    window.addEventListener("repoChange", handler);
    return () => window.removeEventListener("repoChange", handler);
  }, []);

  // 加载两侧分支列表（最多100条，按更新时间）
  const fetchBranches = async (q = "") => {
    if (!token || !repoId) return;
    setLoading((p) => ({ ...p, branches: true }));
    try {
      const params = new URLSearchParams({ token, orgId, repoId, page: "1", perPage: "100", sort: "updated_desc" });
      if (q) params.append("search", q);
      const res = await fetch(`/api/codeup/branches?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const list = Array.isArray(data) ? data : Array.isArray(data?.result) ? data.result : [];
      setSourceList(list);
      setTargetList(list);
    } catch (e) {
      console.error(e);
      setSourceList([]);
      setTargetList([]);
      setSnackbar({ open: true, message: "加载分支失败", severity: "error" });
    } finally {
      setLoading((p) => ({ ...p, branches: false }));
    }
  };

  useEffect(() => {
    fetchBranches("");
  }, [token, orgId, repoId]);

  const handleSearchChange = (kind, value) => {
    if (kind === "source") setSearchSource(value);
    else setSearchTarget(value);

    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      fetchBranches(value);
    }, 400);
  };

  const handleCreate = async () => {
    if (!repoId || !sourceBranch || !targetBranch) {
      setSnackbar({ open: true, message: "请选择仓库、源分支和目标分支", severity: "warning" });
      return;
    }

    setLoading((p) => ({ ...p, creating: true }));
    setCreatedInfo(null);

    try {
      const title = `${sourceBranch} -> ${targetBranch}`;
      const description = `从 ${sourceBranch} 合并到 ${targetBranch}`;
      const payload = { token, orgId, repoId, sourceBranch, targetBranch, title, description };
      const res = await fetch("/api/codeup/change-requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.message || "创建失败");
      }
      setCreatedInfo(data);
      setSnackbar({ open: true, message: `创建成功：#${data?.id || data?.iid || ""}`.trim(), severity: "success" });
    } catch (e) {
      setSnackbar({ open: true, message: e.message || "创建失败", severity: "error" });
    } finally {
      setLoading((p) => ({ ...p, creating: false }));
    }
  };

  const BranchSelect = ({ label, value, onChange, list, searchValue, onSearch }) => (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1, flex: 1 }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>{label}</Typography>
      <TextField
        size="small"
        placeholder="输入过滤分支..."
        value={searchValue}
        onChange={(e) => onSearch(e.target.value)}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              {loading.branches ? <CircularProgress size={16} /> : <Search fontSize="small" />}
            </InputAdornment>
          ),
        }}
      />
      <FormControl size="small">
        <InputLabel id={`${label}-select-label`}>选择分支</InputLabel>
        <Select
          labelId={`${label}-select-label`}
          value={value}
          label="选择分支"
          onChange={(e) => onChange(e.target.value)}
        >
          {list.map((b) => (
            <MenuItem key={b.name} value={b.name}>{b.name}</MenuItem>
          ))}
        </Select>
      </FormControl>
    </Box>
  );

  return (
    <Box>
-      <Typography variant="h6" sx={{ mb: 2, color: '#2c3e50', fontWeight: 600 }}>代码合并</Typography>
+      {/* 页面标题由全局 AppBar 提供，此处移除重复标题 */}

      <Paper sx={{ p: 2, borderRadius: 2, boxShadow: "0 2px 8px rgba(0,0,0,0.1)" }}>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <BranchSelect
            label="源分支"
            value={sourceBranch}
            onChange={setSourceBranch}
            list={sourceList}
            searchValue={searchSource}
            onSearch={(v) => handleSearchChange('source', v)}
          />
          <BranchSelect
            label="目标分支"
            value={targetBranch}
            onChange={setTargetBranch}
            list={targetList}
            searchValue={searchTarget}
            onSearch={(v) => handleSearchChange('target', v)}
          />
          <Box sx={{ display: 'flex', alignItems: 'flex-end' }}>
            <Button
              variant="contained"
              onClick={handleCreate}
              disabled={!repoId || !sourceBranch || !targetBranch || loading.creating}
              startIcon={loading.creating ? <CircularProgress size={16} /> : null}
            >
              {loading.creating ? '创建中...' : '新建合并'}
            </Button>
          </Box>
        </Box>

        {createdInfo && (
          <Box sx={{ mt: 3, p: 2, borderRadius: 1, backgroundColor: '#f5f7fa', border: '1px solid #e1ecf7' }}>
            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>合并请求信息</Typography>
            <Typography variant="body2">ID: {createdInfo?.id || createdInfo?.iid || '-'}</Typography>
            <Typography variant="body2">标题: {createdInfo?.title || '-'}</Typography>
            <Typography variant="body2">源分支: {sourceBranch}</Typography>
            <Typography variant="body2">目标分支: {targetBranch}</Typography>
          </Box>
        )}
      </Paper>

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