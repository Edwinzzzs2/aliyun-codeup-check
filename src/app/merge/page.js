'use client'
import { Autocomplete, Button, TextField, Grid, Paper, Box, Typography, CircularProgress } from '@mui/material';
import ErrorMessage from '../../components/ErrorMessage';
import { useState, useEffect, useRef } from 'react';
import { useTokenConfig, useTokenMessage, useRepoChange } from '../../contexts/TokenContext';

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
  const [errorMessage, setErrorMessage] = useState(null);
  const searchTimerRef = useRef(null);

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

  const fetchBranches = async (kind, q = "") => {
    if (!token || !selectedRepo) return;
    if (kind === 'source') setLoadingSource(true);
    else setLoadingTarget(true);

    const params = new URLSearchParams({ token, orgId, repoId: selectedRepo, search: q });
    try {
      const res = await fetch(`/api/codeup/branches?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (kind === 'source') {
        setSourceBranches(data.result || []);
      } else {
        setTargetBranches(data.result || []);
      }
    } catch (e) {
      console.error(e);
      if (kind === 'source') setSourceBranches([]);
      else setTargetBranches([]);
    } finally {
      if (kind === 'source') setLoadingSource(false);
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
    if (kind === 'source') setSearchSource(value);
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
    setCreatingMR(true);
    try {
      const payload = {
        token,
        orgId,
        repoId: selectedRepo,
        sourceBranch: sourceBranch.name,
        targetBranch: targetBranch.name,
        title: `Merge ${sourceBranch.name} -> ${targetBranch.name}`,
        description: `Created by aliyun-codeup-check at ${new Date().toLocaleString()}`,
      };

      const res = await fetch("/api/codeup/change-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        let errMsg = `HTTP ${res.status}: ${res.statusText}`;
        try {
          const err = await res.json();
          errMsg = err?.message || errMsg;
        } catch (_) {}
        throw new Error(errMsg);
      }

      const data = await res.json();
      const id =
        data?.localId ?? data?.result?.localId ?? data?.iid ?? data?.result?.id;
      showMessage(
        `合并请求创建成功${id ? `（ID: ${id}）` : ""}`,
        "success"
      );
      
      // 创建成功后清空选择
      setSourceBranch(null);
      setTargetBranch(null);
      setErrorMessage(null); // 清除旧错误
    } catch (error) {
      console.error("创建合并请求失败:", error);
      setErrorMessage(error.errorMessage || "发生未知错误"); // 设置错误信息
    } finally {
      setCreatingMR(false);
    }
  };

  return (
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
        backdropFilter: "blur(10px)"
      }}
    >
      <Box display="flex" alignItems="center" gap={2} flexWrap="wrap" sx={{ flex: 1 }}>
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
            handleSearchChange('source', newInputValue);
          }}
          onChange={(event, newValue) => {
            setSourceBranch(newValue);
          }}
          sx={{ minWidth: 200, flex: 1 }}
          renderInput={(params) => <TextField {...params} label="源分支" placeholder="输入或选择源分支..." size="small" />}
        />
        <Autocomplete
          options={targetBranches}
          getOptionLabel={(option) => option.name}
          loading={loadingTarget}
          inputValue={searchTarget}
          onInputChange={(event, newInputValue) => {
            handleSearchChange('target', newInputValue);
          }}
          onChange={(event, newValue) => {
            setTargetBranch(newValue);
          }}
          sx={{ minWidth: 200, flex: 1 }}
          renderInput={(params) => <TextField {...params} label="目标分支" placeholder="输入或选择目标分支..." size="small" />}
        />
        <Button 
          variant="contained" 
          onClick={handleCreateMergeRequest}
          sx={{ minWidth: 100 }}
          disabled={!sourceBranch || !targetBranch || creatingMR}
          startIcon={creatingMR ? <CircularProgress size={16} /> : null}
        >
          {creatingMR ? "创建中..." : "新建合并"}
        </Button>
      </Box>
      <ErrorMessage error={errorMessage} onClear={() => setErrorMessage(null)} />
    </Paper>
  );
}