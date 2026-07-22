"use client";

import React, { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Paper,
  Switch,
  FormControlLabel,
  Grid,
  Autocomplete,
  CircularProgress,
  LinearProgress,
} from "@mui/material";
import moment from "moment";
import {
  useTokenConfig,
  useTokenMessage,
  useRepoChange,
} from "../../contexts/TokenContext";
import BranchSelector from "../../components/BranchSelector";
import TaskManagementTab from "./TaskManagementTab";

export default function AutoMergePage() {
  const { token, orgId } = useTokenConfig();
  const { showMessage } = useTokenMessage();
  const { selectedRepo } = useRepoChange();

  const [tasks, setTasks] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);

  // 简化的loading状态管理
  const [loading, setLoading] = useState({
    data: false,    // 任务数据加载
    action: false,  // 操作加载（creating, updating, deleting, executing）
  });

  // 时间格式化函数，与其他页面保持一致
  const formatTime = (timeStr) => {
    if (!timeStr) return '-';
    try {
      // 统一处理ISO格式时间，转换为北京时间显示
      const m = moment(timeStr);
      if (!m.isValid()) return timeStr;
      return m.utcOffset(8).format("YYYY-MM-DD HH:mm:ss");
    } catch (error) {
      return timeStr;
    }
  };

  const [formData, setFormData] = useState({
    name: "",
    source_branch: "",
    target_branch: "",
    interval_minutes: 5,
    enabled: true,
    repository_id: "",
    repository_name: "",
    feishu_config_id: "",
  });

  // 飞书配置列表状态
  const [feishuConfigs, setFeishuConfigs] = useState([]);

  // 获取仓库列表
  const fetchRepos = () => {
    if (typeof window === "undefined") return null;
    const cacheKey = `codeup_repos_cache_${orgId || "default"}`;
    try {
      const cached = JSON.parse(localStorage.getItem(cacheKey) || "null");
      return cached;
    } catch (error) {
      console.error("Error reading repos cache:", error);
      return null;
    }
  };

  // 获取飞书配置列表
  const fetchFeishuConfigs = async () => {
    try {
      const response = await fetch("/api/feishu/configs");
      const data = await response.json();
      if (data.success) {
        setFeishuConfigs(data.data || []);
      }
    } catch (error) {
      console.error("获取飞书配置列表失败:", error);
    }
  };

  // 获取任务列表
  const fetchTasks = async () => {
    console.log('AutoMergePage: fetchTasks called');
    setLoading(prev => ({ ...prev, data: true }));
    try {
      const response = await fetch("/api/automerge/tasks");
      const data = await response.json();
      console.log('AutoMergePage: fetchTasks response:', data);
      if (data.success) {
        setTasks(data.data || []);
        console.log('AutoMergePage: tasks set to:', data.data || []);
      } else {
        console.log('AutoMergePage: fetchTasks failed:', data);
      }
    } catch (error) {
      console.error("获取任务列表失败:", error);
      showMessage("获取任务列表失败", "error");
    } finally {
      setLoading(prev => ({ ...prev, data: false }));
    }
  };

  // 页面初始化时加载任务列表，执行日志由独立菜单页面负责加载。
  useEffect(() => {
    fetchTasks();
  }, []);

  // 组件加载时获取飞书配置列表
  useEffect(() => {
    fetchFeishuConfigs();
  }, []);

  const handleOpenDialog = (task = null) => {
    const repos = fetchRepos() || [];
    const taskRepo = task ? repos.find((r) => r.id === Number(task.repository_id)) : null;
    if (task) {
      setEditingTask(task);
      setFormData({
        name: task.name,
        source_branch: task.source_branch,
        target_branch: task.target_branch,
        interval_minutes: task.interval_minutes,
        enabled: task.enabled,
        repository_id: task.repository_id || selectedRepo || "",
        repository_name: taskRepo ? taskRepo.name : task.repository_name || "",
        feishu_config_id: task.feishu_config_id || "",
      });

    } else {
      setEditingTask(null);
      setFormData({
        name: "",
        source_branch: "",
        target_branch: "",
        interval_minutes: 5,
        enabled: true,
        repository_id: "",
        repository_name: "",
        feishu_config_id: "",
      });

    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingTask(null);
  };

  const handleSubmit = async () => {
    setLoading(prev => ({ ...prev, action: true }));
    try {
      const url = editingTask
        ? `/api/automerge/tasks?id=${editingTask.id}`
        : "/api/automerge/tasks";

      const method = editingTask ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (data.success) {
        showMessage(data.message, "success");
        handleCloseDialog();
        fetchTasks();
      } else {
        showMessage(data.message, "error");
      }
    } catch (error) {
      console.error("保存任务失败:", error);
      showMessage("保存任务失败", "error");
    } finally {
      setLoading(prev => ({ ...prev, action: false }));
    }
  };

  const handleDelete = async (taskId) => {
    if (!confirm("确定要删除这个自动合并任务吗？")) {
      return;
    }

    setLoading(prev => ({ ...prev, action: true }));
    try {
      const response = await fetch(`/api/automerge/tasks?id=${taskId}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (data.success) {
        showMessage(data.message, "success");
        fetchTasks();
      } else {
        showMessage(data.message, "error");
      }
    } catch (error) {
      console.error("删除任务失败:", error);
      showMessage("删除任务失败", "error");
    } finally {
      setLoading(prev => ({ ...prev, action: false }));
    }
  };

  const addExecutionLog = (message, type = 'info', data = null) => {
    const logEntry = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: moment().format("YYYY-MM-DD HH:mm:ss"),
      message,
      type, // 'info', 'success', 'error', 'warning'
      data: data ? JSON.stringify(data, null, 2) : null
    };
  };

  const handleExecute = async (taskId) => {
    setLoading(prev => ({ ...prev, action: true }));
    try {
      const startMsg = `开始执行自动合并任务，taskId: ${taskId}`;
      console.log('🚀', startMsg);
      addExecutionLog(startMsg, 'info');
      
      const response = await fetch("/api/automerge/execute", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ taskId }),
      });

      const statusMsg = `执行任务响应状态: ${response.status} ${response.statusText}`;
      console.log('📡', statusMsg);
      addExecutionLog(statusMsg, response.ok ? 'info' : 'warning');
      
      const data = await response.json();
      const dataMsg = '执行任务返回数据:';
      console.log('📋', dataMsg, JSON.stringify(data, null, 2));
      addExecutionLog(dataMsg, 'info', data);

      if (data.success) {
        const successMsg = `任务执行成功！${data.data?.mergeRequestId ? `合并请求ID: ${data.data.mergeRequestId}` : ''}`;
        console.log('✅', successMsg);
        addExecutionLog(successMsg, 'success', data.data);
        showMessage(successMsg, "success");
        fetchTasks();
      } else {
        // 检查是否是409冲突错误，提供更具体的错误信息
        let errorMsg = `任务执行失败: ${data.message}`;
        if (data.error) {
          errorMsg += ` (${data.error})`;
        }
        
        // 如果响应状态是409，说明是合并请求冲突
        if (data.message && data.message.includes('409') && data.message.includes('CONFLICT')) {
          errorMsg = '创建合并请求失败：已存在未合并的合并请求，请先处理现有合并请求后再试';
        }
        
        console.error('❌', errorMsg);
        addExecutionLog(errorMsg, 'error', data);
        showMessage(errorMsg, "error");
      }
    } catch (error) {
      const exceptionMsg = `执行任务异常: ${error.message}`;
      console.error('💥', exceptionMsg);
      console.error('📊 错误详情:', error.message, error.stack);
      addExecutionLog(exceptionMsg, 'error', { message: error.message, stack: error.stack });
      showMessage(exceptionMsg, "error");
    } finally {
      setLoading(prev => ({ ...prev, action: false }));
    }
  };

  // 更新任务状态
  const handleToggleTaskStatus = async (taskId, currentEnabled) => {
    setLoading(prev => ({ ...prev, action: true }));
    try {
      const response = await fetch(`/api/automerge/tasks?id=${taskId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ enabled: !currentEnabled }),
      });

      const data = await response.json();

      if (data.success) {
        showMessage(`任务已${!currentEnabled ? '启用' : '禁用'}`, "success");
        fetchTasks();
      } else {
        showMessage(data.message, "error");
      }
    } catch (error) {
      console.error("更新任务状态失败:", error);
      showMessage("更新任务状态失败", "error");
    } finally {
      setLoading(prev => ({ ...prev, action: false }));
    }
  };



  return (
    <Box
      sx={{
        minHeight: "100vh",
      }}
    >
      <Box sx={{ width: "100%", height: "4px" }}>
        {(loading.data || loading.action) && <LinearProgress />}
      </Box>
      
      {/* 页面标题部分 */}
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
        <Typography variant="h6" sx={{ fontWeight: "bold" }}>
          自动合并
        </Typography>
      </Paper>

      <TaskManagementTab
        tasks={tasks}
        loading={loading}
        token={token}
        selectedRepo={selectedRepo}
        onOpenDialog={handleOpenDialog}
        onExecute={handleExecute}
        onDelete={handleDelete}
        onToggleStatus={handleToggleTaskStatus}
        formatTime={formatTime}
        feishuConfigs={feishuConfigs}
      />

      {/* 新建/编辑任务对话框 */}
      <Dialog
        open={dialogOpen}
        onClose={handleCloseDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {editingTask ? "编辑自动合并任务" : "新建自动合并任务"}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <TextField
              fullWidth
              label="任务名称"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              margin="normal"
              required
            />
            <FormControl fullWidth margin="normal" required>
              <InputLabel>代码仓库</InputLabel>
              <Select
                value={formData.repository_id}
                onChange={(e) => {
                  const selectedRepoId = e.target.value;
                  const repos = fetchRepos() || [];
                  const selectedRepo = repos.find(
                    (repo) => repo.id === selectedRepoId
                  );
                  setFormData({
                    ...formData,
                    repository_id: selectedRepoId,
                    repository_name: selectedRepo ? selectedRepo.name : "",
                    source_branch: "",
                    target_branch: "",
                  });

                }}
                label="代码仓库"
                // disabled
              >
                {(fetchRepos() || []).map((repo) => (
                  <MenuItem key={repo.id} value={repo.id}>
                    {repo.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Box sx={{ mt: 2, mb: 1 }}>
              <BranchSelector
                token={token}
                orgId={orgId}
                repoId={formData.repository_id}
                label="源分支"
                placeholder="输入或选择源分支..."
                value={formData.source_branch ? { name: formData.source_branch } : null}
                onChange={(branch) => {
                  setFormData({ 
                    ...formData, 
                    source_branch: branch ? branch.name : "" 
                  });
                }}
                onError={showMessage}
                sx={{ width: '100%' }}
              />
            </Box>

            <Box sx={{ mt: 2, mb: 1 }}>
              <BranchSelector
                token={token}
                orgId={orgId}
                repoId={formData.repository_id}
                label="目标分支"
                placeholder="输入或选择目标分支..."
                value={formData.target_branch ? { name: formData.target_branch } : null}
                onChange={(branch) => {
                  setFormData({ 
                    ...formData, 
                    target_branch: branch ? branch.name : "" 
                  });
                }}
                onError={showMessage}
                sx={{ width: '100%' }}
              />
            </Box>

            <TextField
              fullWidth
              label="执行间隔（分钟）"
              type="number"
              value={formData.interval_minutes}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  interval_minutes: parseInt(e.target.value) || 1,
                })
              }
              margin="normal"
              required
              inputProps={{ min: 1 }}
            />

            <FormControl fullWidth margin="normal">
              <InputLabel>飞书通知配置</InputLabel>
              <Select
                value={formData.feishu_config_id}
                onChange={(e) =>
                  setFormData({ ...formData, feishu_config_id: e.target.value })
                }
                label="飞书通知配置"
              >
                <MenuItem value="">
                  <em>不使用飞书通知</em>
                </MenuItem>
                {feishuConfigs.map((config) => (
                  <MenuItem key={config.id} value={config.id}>
                    {config.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControlLabel
              control={
                <Switch
                  checked={formData.enabled}
                  onChange={(e) =>
                    setFormData({ ...formData, enabled: e.target.checked })
                  }
                />
              }
              label="启用任务"
              sx={{ mt: 2 }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog} disabled={loading.action}>
            取消
          </Button>
          <Button 
            onClick={handleSubmit} 
            variant="contained"
            disabled={loading.action}
            startIcon={loading.action ? <CircularProgress size={16} /> : null}
          >
            {loading.action ? (editingTask ? "更新中..." : "创建中...") : (editingTask ? "更新" : "创建")}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
