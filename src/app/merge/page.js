'use client'
import { Autocomplete, Button, TextField, Grid, Paper, Box, Typography } from '@mui/material';
import { useState, useEffect, useRef } from 'react';

export default function MergeRequest() {
  const [sourceBranch, setSourceBranch] = useState(null);
  const [targetBranch, setTargetBranch] = useState(null);
  const [sourceBranches, setSourceBranches] = useState([]);
  const [targetBranches, setTargetBranches] = useState([]);
  const [loadingSource, setLoadingSource] = useState(false);
  const [loadingTarget, setLoadingTarget] = useState(false);
  const [token, setToken] = useState("");
  const [orgId, setOrgId] = useState("");
  const [repoId, setRepoId] = useState("");
  const [searchSource, setSearchSource] = useState("");
  const [searchTarget, setSearchTarget] = useState("");
  const searchTimerRef = useRef(null);

  useEffect(() => {
    const savedToken = localStorage.getItem("codeup_token");
    const savedOrgId = localStorage.getItem("codeup_orgid") || "5f9a23913a5188f27f3f344b";
    const selected = localStorage.getItem("codeup_selected_repo");
    if (savedToken) setToken(savedToken);
    if (savedOrgId) setOrgId(savedOrgId);
    if (selected) setRepoId(selected);
  }, []);

  const fetchBranches = async (kind, q = "") => {
    if (!token || !repoId) return;
    if (kind === 'source') setLoadingSource(true);
    else setLoadingTarget(true);

    const params = new URLSearchParams({ token, orgId, repoId, search: q });
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
    if (token && repoId) {
        fetchBranches("source", "");
        fetchBranches("target", "");
    }
  }, [token, orgId, repoId]);

  const handleSearchChange = (kind, value) => {
    if (kind === 'source') setSearchSource(value);
    else setSearchTarget(value);

    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      fetchBranches(kind, value);
    }, 400);
  };

  const handleCreateMergeRequest = () => {
    // Handle merge request creation logic here
    console.log('Source Branch:', sourceBranch);
    console.log('Target Branch:', targetBranch);
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
          disabled={!sourceBranch || !targetBranch}
        >
          新建合并
        </Button>
      </Box>
    </Paper>
  );
}