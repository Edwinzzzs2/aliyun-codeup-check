"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";

// 创建Token Context
const TokenContext = createContext();

// Token Provider组件
export function TokenProvider({ children }) {
  const [token, setToken] = useState("");
  const [orgId, setOrgId] = useState("5f9a23913a5188f27f3f344b");
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
  
  // 仓库变更状态
  const [selectedRepo, setSelectedRepo] = useState("");
  const [repoChangeTimestamp, setRepoChangeTimestamp] = useState(0);
  
  // 全局加载状态
  const [globalLoading, setGlobalLoading] = useState(false);

  // 页面加载时检查本地存储和自动弹出配置弹窗
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
      // 如果没有本地token，自动弹出配置弹窗
      setConfigDialog(true);
      setTempOrgId("5f9a23913a5188f27f3f344b");
    }
  }, []);

  const showMessage = useCallback((message, severity = "info") => {
    setSnackbar({ open: true, message, severity });
  }, []);

  const handleConfigSave = useCallback(() => {
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
  }, [tempToken, tempOrgId, showMessage]);

  const handleConfigCancel = useCallback(() => {
    if (!token) {
      // 如果没有已保存的token，不允许取消
      showMessage("请先配置 Token", "warning");
      return;
    }

    // 恢复原值
    setTempToken(token);
    setTempOrgId(orgId);
    setConfigDialog(false);
  }, [token, orgId, showMessage]);

  const openConfigDialog = useCallback(() => {
    setTempToken(token);
    setTempOrgId(orgId);
    setConfigDialog(true);
  }, [token, orgId]);
  
  // 仓库变更处理函数
  const handleRepoChange = useCallback((repoId) => {
    setSelectedRepo(repoId);
    setRepoChangeTimestamp(Date.now());
  }, []);
  
  // 全局加载状态处理函数
  const setGlobalLoadingState = useCallback((loading) => {
    setGlobalLoading(loading);
  }, []);

  const value = {
    // Token相关状态
    token,
    orgId,
    setToken,
    setOrgId,
    
    // 配置弹窗相关状态
    configDialog,
    setConfigDialog,
    tempToken,
    setTempToken,
    tempOrgId,
    setTempOrgId,
    showPassword,
    setShowPassword,
    showTokenGuide,
    setShowTokenGuide,
    
    // 消息提示相关状态
    snackbar,
    setSnackbar,
    showMessage,
    
    // 仓库变更相关状态
    selectedRepo,
    setSelectedRepo,
    repoChangeTimestamp,
    handleRepoChange,
    
    // 全局加载状态
    globalLoading,
    setGlobalLoadingState,
    
    // 配置弹窗操作方法
    handleConfigSave,
    handleConfigCancel,
    openConfigDialog,
  };

  return (
    <TokenContext.Provider value={value}>
      {children}
    </TokenContext.Provider>
  );
}

// 自定义Hook：使用Token Context
export function useToken() {
  const context = useContext(TokenContext);
  if (!context) {
    throw new Error("useToken must be used within a TokenProvider");
  }
  return context;
}

// 自定义Hook：仅获取token和orgId（用于API调用）
export function useTokenConfig() {
  const { token, orgId } = useToken();
  return { token, orgId };
}

// 自定义Hook：配置弹窗管理
export function useTokenDialog() {
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
    openConfigDialog,
  } = useToken();
  
  return {
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
    openConfigDialog,
  };
}

// 自定义Hook：消息提示管理
export function useTokenMessage() {
  const { snackbar, setSnackbar, showMessage } = useToken();
  return { snackbar, setSnackbar, showMessage };
}

// 自定义Hook：仓库变更管理
export function useRepoChange() {
  const { selectedRepo, setSelectedRepo, repoChangeTimestamp, handleRepoChange } = useToken();
  return { selectedRepo, setSelectedRepo, repoChangeTimestamp, handleRepoChange };
}

// 自定义Hook：全局加载状态管理
export function useGlobalLoading() {
  const { globalLoading, setGlobalLoadingState } = useToken();
  return { globalLoading, setGlobalLoadingState };
}

// 自定义Hook：配置弹窗操作
export function useTokenConfigDialog() {
  const { openConfigDialog } = useToken();
  return { openConfigDialog };
}