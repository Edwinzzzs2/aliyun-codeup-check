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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Switch,
  FormControlLabel,
  Chip,
  IconButton,
  Tabs,
  Tab,
  Grid,
  Autocomplete,
  CircularProgress,
  LinearProgress,
} from "@mui/material";
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  PlayArrow as PlayIcon,
  Schedule as ScheduleIcon,
  History as HistoryIcon,
  Refresh as RefreshIcon,
} from "@mui/icons-material";
import moment from "moment";
import {
  useTokenConfig,
  useTokenMessage,
  useRepoChange,
} from "../../contexts/TokenContext";
import BranchSelector from "../../components/BranchSelector";

export default function AutoMergePage() {
  const { token, orgId } = useTokenConfig();
  const { showMessage } = useTokenMessage();
  const { selectedRepo } = useRepoChange();

  const [tasks, setTasks] = useState([]);
  const [logs, setLogs] = useState([]);
  const [executionLogs, setExecutionLogs] = useState([]); // 新增：执行日志
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [activeTab, setActiveTab] = useState(0);

  // 简化的loading状态管理
  const [loading, setLoading] = useState({
    data: false,    // 数据加载（tasks, logs）
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
  });

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

  // 获取执行日志
  const fetchLogs = async () => {
    setLoading(prev => ({ ...prev, data: true }));
    try {
      const response = await fetch("/api/automerge/execute");
      const data = await response.json();
      if (data.success) {
        setLogs(data.data || []);
      }
    } catch (error) {
      console.error("获取执行日志失败:", error);
    } finally {
      setLoading(prev => ({ ...prev, data: false }));
    }
  };

  // 根据activeTab加载对应数据，包括初始化
  useEffect(() => {
    console.log('AutoMergePage: activeTab changed to:', activeTab);
    if (activeTab === 0) {
      console.log('AutoMergePage: Loading tasks...');
      fetchTasks();
    } else if (activeTab === 1) {
      console.log('AutoMergePage: Loading logs...');
      fetchLogs();
    }
  }, [activeTab]);





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
    setExecutionLogs(prev => [logEntry, ...prev.slice(0, 49)]); // 保留最新50条
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
        fetchLogs();
      } else {
        const errorMsg = `任务执行失败: ${data.message}${data.error ? ` (${data.error})` : ''}`;
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

  const getStatusColor = (status) => {
    switch (status) {
      case "success":
        return "success";
      case "failed":
        return "error";
      case "conflict":
        return "warning";
      case "info":
        return "info";
      default:
        return "default";
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case "success":
        return "成功";
      case "failed":
        return "失败";
      case "conflict":
        return "冲突";
      case "info":
        return "无变动";
      default:
        return status;
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Loading进度条 - 始终保留空间，避免页面抖动 */}
      <Box sx={{ width: "100%", height: "4px", mb: 2 }}>
        {(loading.data || loading.action) && <LinearProgress />}
      </Box>
      
      <Typography variant="h4" gutterBottom>
        自动合并管理
      </Typography>



      {/* {(!token || !selectedRepo) && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          请先配置访问令牌并选择代码仓库才能使用自动合并功能
        </Alert>
      )} */}

      <Tabs
        value={activeTab}
        onChange={(e, newValue) => setActiveTab(newValue)}
        sx={{ mb: 3 }}
      >
        <Tab label="任务管理" />
        <Tab label="执行日志" />
        <Tab label="实时日志" />
      </Tabs>

      {activeTab === 0 && (
        <Box>
          <Box
            sx={{
              mb: 3,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Typography variant="h6">自动合并任务</Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => handleOpenDialog()}
              disabled={!token || !selectedRepo}
            >
              新建任务
            </Button>
          </Box>

          <TableContainer 
            component={Paper} 
            sx={{ 
              maxHeight: 'calc(100vh - 400px)', 
              overflow: 'auto',
              '& .MuiTableCell-head': {
                backgroundColor: '#f5f5f5',
                fontWeight: 'bold',
                fontSize: '0.875rem'
              }
            }}
          >
            <Table stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ minWidth: 120 }}>任务名称</TableCell>
                  <TableCell sx={{ minWidth: 100 }}>仓库</TableCell>
                  <TableCell sx={{ minWidth: 180 }}>分支合并</TableCell>
                  <TableCell sx={{ minWidth: 80 }}>间隔</TableCell>
                  <TableCell sx={{ minWidth: 80 }}>状态</TableCell>
                  <TableCell sx={{ minWidth: 140 }}>执行时间</TableCell>
                  <TableCell sx={{ minWidth: 100, textAlign: 'center' }}>操作</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading.data ? (
                  <TableRow>
                    <TableCell colSpan={7} sx={{ textAlign: 'center', py: 4 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                        <CircularProgress size={20} />
                        <Typography variant="body2" color="text.secondary">
                          加载数据中...
                        </Typography>
                      </Box>
                    </TableCell>
                  </TableRow>
                ) : tasks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} sx={{ textAlign: 'center', py: 4 }}>
                      <Typography variant="body2" color="text.secondary">
                        暂无任务
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  tasks.map((task) => (
                  <TableRow key={task.id} hover>
                    <TableCell sx={{ fontWeight: 500 }}>{task.name}</TableCell>
                    <TableCell>
                      <Chip
                        label={task.repository_name || "未设置"}
                        size="small"
                        variant="outlined"
                        sx={{ fontSize: '0.75rem' }}
                      />
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Chip
                          label={task.source_branch}
                          size="small"
                          color="primary"
                          sx={{ fontSize: '0.75rem' }}
                        />
                        <Typography variant="caption" sx={{ mx: 0.5 }}>→</Typography>
                        <Chip
                          label={task.target_branch}
                          size="small"
                          color="secondary"
                          sx={{ fontSize: '0.75rem' }}
                        />
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{task.interval_minutes}分钟</Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={task.enabled ? "启用" : "禁用"}
                        color={task.enabled ? "success" : "default"}
                        size="small"
                        sx={{ fontSize: '0.75rem' }}
                      />
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                        <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
                          <Typography component="span" variant="caption" color="text.secondary">上次: </Typography>
                          {formatTime(task.last_run)}
                        </Typography>
                        <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
                          <Typography component="span" variant="caption" color="text.secondary">下次: </Typography>
                          {formatTime(task.next_run)}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
                        <IconButton
                          size="small"
                          onClick={() => handleExecute(task.id)}
                          disabled={!task.enabled || loading.action}
                          title="立即执行"
                          sx={{ color: task.enabled && !loading.action ? 'success.main' : 'disabled' }}
                        >
                          {loading.action ? <CircularProgress size={16} /> : <PlayIcon fontSize="small" />}
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => handleOpenDialog(task)}
                          title="编辑"
                          disabled={loading.action}
                          sx={{ color: 'primary.main' }}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => handleDelete(task.id)}
                          title="删除"
                          disabled={loading.action}
                          sx={{ color: 'error.main' }}
                        >
                          {loading.action ? <CircularProgress size={16} /> : <DeleteIcon fontSize="small" />}
                        </IconButton>
                      </Box>
                    </TableCell>
                  </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}

      {activeTab === 1 && (
        <Box>
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              mb: 2,
            }}
          >
            <Typography variant="h6">执行日志</Typography>
            <Button
              variant="outlined"
              size="small"
              startIcon={loading.data ? <CircularProgress size={16} /> : <RefreshIcon />}
              onClick={fetchLogs}
              disabled={loading.data}
            >
              {loading.data ? "刷新中..." : "刷新"}
            </Button>
          </Box>

          <TableContainer 
            component={Paper} 
            sx={{ 
              maxHeight: 'calc(100vh - 350px)', 
              overflow: 'auto',
              '& .MuiTableCell-head': {
                backgroundColor: '#f5f5f5',
                fontWeight: 'bold',
                fontSize: '0.875rem'
              }
            }}
          >
            <Table stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ minWidth: 100 }}>任务名称</TableCell>
                  <TableCell sx={{ minWidth: 80 }}>执行状态</TableCell>
                  <TableCell sx={{ minWidth: 150, maxWidth: 300 }}>执行信息</TableCell>
                  <TableCell sx={{ minWidth: 100 }}>合并请求ID</TableCell>
                  <TableCell sx={{ minWidth: 120 }}>执行时间</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading.data ? (
                  <TableRow>
                    <TableCell colSpan={5} sx={{ textAlign: 'center', py: 4 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                        <CircularProgress size={20} />
                        <Typography variant="body2" color="text.secondary">
                          加载数据中...
                        </Typography>
                      </Box>
                    </TableCell>
                  </TableRow>
                ) : logs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} sx={{ textAlign: 'center', py: 4 }}>
                      <Typography variant="body2" color="text.secondary">
                        暂无执行日志
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>{log.task_name}</TableCell>
                      <TableCell>
                        <Chip
                          label={getStatusText(log.status)}
                          color={getStatusColor(log.status)}
                          size="small"
                        />
                      </TableCell>
                      <TableCell sx={{ 
                        maxWidth: 300, 
                        overflow: 'hidden', 
                        textOverflow: 'ellipsis', 
                        whiteSpace: 'nowrap' 
                      }} title={log.message}>{log.message}</TableCell>
                      <TableCell>
                        {log.merge_request_id ? (
                          log.merge_request_detail_url ? (
                            <a 
                              href={log.merge_request_detail_url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              style={{
                                 color: '#1976d2',
                                 textDecoration: 'underline',
                                 cursor: 'pointer'
                               }}
                            >
                              {parseInt(log.merge_request_id).toString()}
                            </a>
                          ) : (
                            parseInt(log.merge_request_id).toString()
                          )
                        ) : "-"}
                      </TableCell>
                      <TableCell>{formatTime(log.executed_at)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}

      {activeTab === 2 && (
        <Box>
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              mb: 2,
            }}
          >
            <Typography variant="h6">实时执行日志</Typography>
            <Button
              variant="outlined"
              size="small"
              startIcon={<RefreshIcon />}
              onClick={() => setExecutionLogs([])}
            >
              清空日志
            </Button>
          </Box>

          <Paper sx={{ maxHeight: 600, overflow: 'auto' }}>
            {executionLogs.length === 0 ? (
              <Box sx={{ p: 3, textAlign: 'center', color: 'text.secondary' }}>
                暂无实时日志，执行任务后将显示详细过程
              </Box>
            ) : (
              executionLogs.map((log) => (
                <Box
                  key={log.id}
                  sx={{
                    p: 2,
                    borderBottom: '1px solid #e0e0e0',
                    '&:last-child': { borderBottom: 'none' }
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <Chip
                      label={log.type}
                      size="small"
                      color={
                        log.type === 'success' ? 'success' :
                        log.type === 'error' ? 'error' :
                        log.type === 'warning' ? 'warning' : 'default'
                      }
                      sx={{ mr: 1 }}
                    />
                    <Typography variant="caption" color="text.secondary">
                      {formatTime(log.timestamp)}
                    </Typography>
                  </Box>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    {log.message}
                  </Typography>
                  {log.data && (
                    <Box
                      component="pre"
                      sx={{
                        backgroundColor: '#f5f5f5',
                        p: 1,
                        borderRadius: 1,
                        fontSize: '0.75rem',
                        overflow: 'auto',
                        maxHeight: 200,
                        fontFamily: 'monospace'
                      }}
                    >
                      {log.data}
                    </Box>
                  )}
                </Box>
              ))
            )}
          </Paper>
        </Box>
      )}

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
