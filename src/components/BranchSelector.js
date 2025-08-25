"use client";
import {
  Autocomplete,
  TextField,
  CircularProgress,
  Typography,
} from "@mui/material";
import { useState, useEffect, useRef, useCallback } from "react";

/**
 * 分支选择组件
 * @param {Object} props
 * @param {string} props.token - API token
 * @param {string} props.orgId - 组织ID
 * @param {string} props.repoId - 仓库ID
 * @param {string} props.label - 输入框标签
 * @param {string} props.placeholder - 输入框占位符
 * @param {Object} props.value - 当前选中的分支对象
 * @param {Function} props.onChange - 分支选择变化回调
 * @param {Function} props.onError - 错误处理回调
 * @param {Object} props.sx - 样式对象
 * @param {boolean} props.disabled - 是否禁用
 * @param {string} props.size - 组件大小 (small, medium)
 */
export default function BranchSelector({
  token,
  orgId,
  repoId,
  label = "分支",
  placeholder = "输入或选择分支...",
  value = null,
  onChange,
  onError,
  sx = {},
  disabled = false,
  size = "small",
}) {
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const searchTimerRef = useRef(null);

  // 获取分支列表
  const fetchBranches = useCallback(
    async (searchQuery = "") => {
      if (!token || !repoId) {
        setBranches([]);
        return;
      }

      setLoading(true);
      const params = new URLSearchParams({
        token,
        orgId,
        repoId,
        search: searchQuery,
      });

      try {
        const response = await fetch(`/api/codeup/branches?${params.toString()}`);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const data = await response.json();
        setBranches(data.result || []);
      } catch (error) {
        console.error("获取分支列表失败:", error);
        setBranches([]);
        if (onError) {
          onError("获取分支列表失败");
        }
      } finally {
        setLoading(false);
      }
    },
    [token, orgId, repoId, onError]
  );

  // 处理搜索输入变化
  const handleInputChange = useCallback(
    (event, newInputValue) => {
      setInputValue(newInputValue);

      // 清除之前的定时器
      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current);
      }

      // 设置新的定时器，延迟搜索
      searchTimerRef.current = setTimeout(() => {
        fetchBranches(newInputValue);
      }, 400);
    },
    [fetchBranches]
  );

  // 处理分支选择变化
  const handleChange = useCallback(
    (event, newValue) => {
      if (onChange) {
        onChange(newValue);
      }
    },
    [onChange]
  );

  // 当repoId变化时重新获取分支
  useEffect(() => {
    if (token && repoId) {
      fetchBranches("");
    } else {
      setBranches([]);
    }
    // 清空输入值
    setInputValue("");
  }, [token, repoId, fetchBranches]);

  // 组件卸载时清除定时器
  useEffect(() => {
    return () => {
      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current);
      }
    };
  }, []);

  return (
    <Autocomplete
      options={branches}
      getOptionLabel={(option) => option.name || ""}
      loading={loading}
      value={value}
      inputValue={inputValue}
      onInputChange={handleInputChange}
      onChange={handleChange}
      disabled={disabled || !token || !repoId}
      sx={sx}
      size={size}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          placeholder={placeholder}
          InputProps={{
            ...params.InputProps,
            endAdornment: (
              <>
                {loading ? <CircularProgress color="inherit" size={20} /> : null}
                {params.InputProps.endAdornment}
              </>
            ),
          }}
        />
      )}
      renderOption={(props, option) => (
        <li {...props}>
          <Typography variant="body2">{option.name}</Typography>
        </li>
      )}
      noOptionsText={
        !token || !repoId
          ? "请先选择代码仓库"
          : loading
          ? "加载中..."
          : "暂无分支"
      }
    />
  );
}