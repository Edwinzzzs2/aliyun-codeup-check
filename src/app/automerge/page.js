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
  Alert,
  Tabs,
  Tab,
  Grid,
  Autocomplete,
  CircularProgress,
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

export default function AutoMergePage() {
  const { token, orgId } = useTokenConfig();
  const { showMessage } = useTokenMessage();
  const { selectedRepo } = useRepoChange();

  const [tasks, setTasks] = useState([]);
  const [branches, setBranches] = useState([]);
  const [logs, setLogs] = useState([]);
  const [executionLogs, setExecutionLogs] = useState([]); // 新增：执行日志
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [activeTab, setActiveTab] = useState(0);
  const [alert, setAlert] = useState({
    show: false,
    message: "",
    severity: "info",
  });

  // 时间格式化函数，与其他页面保持一致
  const formatTime = (timeStr) => {
    if (!timeStr) return '-';
    try {
      const m = moment(timeStr, [moment.ISO_8601, "YYYY-MM-DD HH:mm:ss"], true);
      if (!m.isValid()) return timeStr;
      return m.format("YYYY-MM-DD HH:mm:ss");
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

  // 获取分支列表
  const fetchBranches = async (repoId = null) => {
    const targetRepoId = repoId || selectedRepo;
    if (!token || !targetRepoId) {
      console.log("缺少token或repoId，跳过分支获取");
      return;
    }

    try {
      const params = new URLSearchParams({
        token,
        orgId,
        repoId: targetRepoId,
        page: "1",
        perPage: "100",
      });

      const response = await fetch(`/api/codeup/branches?${params.toString()}`);
      const data = await response.json();

      if (response.ok) {
        // 兼容两种返回结构
        let list = [];
        if (Array.isArray(data)) {
          list = data;
        } else if (data?.result) {
          list = Array.isArray(data.result) ? data.result : [];
        }
        setBranches(list);
      } else {
        console.error("获取分支列表失败:", data);
        showMessage("获取分支列表失败", "error");
      }
    } catch (error) {
      console.error("获取分支列表失败:", error);
      showMessage("获取分支列表失败", "error");
    }
  };

  // 获取任务列表
  const fetchTasks = async () => {
    try {
      const response = await fetch("/api/automerge/tasks");
      const data = await response.json();
      if (data.success) {
        setTasks(data.data || []);
      }
    } catch (error) {
      console.error("获取任务列表失败:", error);
      showAlert("获取任务列表失败", "error");
    } finally {
    }
  };

  // 获取执行日志
  const fetchLogs = async () => {
    try {
      const response = await fetch("/api/automerge/execute");
      const data = await response.json();
      if (data.success) {
        setLogs(data.data || []);
      }
    } catch (error) {
      console.error("获取执行日志失败:", error);
    }
  };

  useEffect(() => {
    fetchTasks();
    fetchLogs();
  }, []);

  useEffect(() => {
    if (token && selectedRepo) {
      fetchBranches();
    }
  }, [token, selectedRepo]);

  const showAlert = (message, severity = "info") => {
    setAlert({ show: true, message, severity });
    setTimeout(
      () => setAlert({ show: false, message: "", severity: "info" }),
      3000
    );
  };

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
      // 根据任务的repository_id获取分支
      fetchBranches(task.repository_id);
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
      // 新建任务时清空分支列表，等待用户选择代码仓库
      setBranches([]);
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingTask(null);
  };

  const handleSubmit = async () => {
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
        showAlert(data.message, "success");
        handleCloseDialog();
        fetchTasks();
      } else {
        showAlert(data.message, "error");
      }
    } catch (error) {
      console.error("保存任务失败:", error);
      showAlert("保存任务失败", "error");
    }
  };

  const handleDelete = async (taskId) => {
    if (!confirm("确定要删除这个自动合并任务吗？")) {
      return;
    }

    try {
      const response = await fetch(`/api/automerge/tasks?id=${taskId}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (data.success) {
        showAlert(data.message, "success");
        fetchTasks();
      } else {
        showAlert(data.message, "error");
      }
    } catch (error) {
      console.error("删除任务失败:", error);
      showAlert("删除任务失败", "error");
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
        showAlert(successMsg, "success");
        fetchTasks();
        fetchLogs();
      } else {
        const errorMsg = `任务执行失败: ${data.message}${data.error ? ` (${data.error})` : ''}`;
        console.error('❌', errorMsg);
        addExecutionLog(errorMsg, 'error', data);
        showAlert(errorMsg, "error");
      }
    } catch (error) {
      const exceptionMsg = `执行任务异常: ${error.message}`;
      console.error('💥', exceptionMsg);
      console.error('📊 错误详情:', error.message, error.stack);
      addExecutionLog(exceptionMsg, 'error', { message: error.message, stack: error.stack });
      showAlert(exceptionMsg, "error");
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
      default:
        return status;
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        自动合并管理
      </Typography>

      {alert.show && (
        <Alert severity={alert.severity} sx={{ mb: 2 }}>
          {alert.message}
        </Alert>
      )}

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
        <Tab label={`任务管理 (${tasks.length})`} />
        <Tab label={`执行日志 (${logs.length})`} />
        <Tab label={`实时日志 (${executionLogs.length})`} />
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
              maxHeight: 'calc(100vh - 300px)', 
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
                {tasks.map((task) => (
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
                      <Box>
                        <Typography variant="caption" color="text.secondary">上次:</Typography>
                        <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
                          {formatTime(task.last_run)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">下次:</Typography>
                        <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
                          {formatTime(task.next_run)}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
                        <IconButton
                          size="small"
                          onClick={() => handleExecute(task.id)}
                          disabled={!task.enabled}
                          title="立即执行"
                          sx={{ color: task.enabled ? 'success.main' : 'disabled' }}
                        >
                          <PlayIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => handleOpenDialog(task)}
                          title="编辑"
                          sx={{ color: 'primary.main' }}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => handleDelete(task.id)}
                          title="删除"
                          sx={{ color: 'error.main' }}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
                {tasks.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                      <Typography variant="body2" color="text.secondary">
                        暂无自动合并任务
                      </Typography>
                    </TableCell>
                  </TableRow>
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
              startIcon={<RefreshIcon />}
              onClick={fetchLogs}
            >
              刷新
            </Button>
          </Box>

          <TableContainer 
            component={Paper} 
            sx={{ 
              maxHeight: 'calc(100vh - 300px)', 
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
                  <TableCell sx={{ minWidth: 100 }}>执行状态</TableCell>
                  <TableCell sx={{ minWidth: 200 }}>执行信息</TableCell>
                  <TableCell sx={{ minWidth: 120 }}>合并请求ID</TableCell>
                  <TableCell sx={{ minWidth: 140 }}>执行时间</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>{log.task_name}</TableCell>
                    <TableCell>
                      <Chip
                        label={getStatusText(log.status)}
                        color={getStatusColor(log.status)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>{log.message}</TableCell>
                    <TableCell>{log.merge_request_id ? parseInt(log.merge_request_id).toString() : "-"}</TableCell>
                    <TableCell>{formatTime(log.executed_at)}</TableCell>
                  </TableRow>
                ))}
                {logs.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} align="center">
                      暂无执行日志
                    </TableCell>
                  </TableRow>
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
                  // 选择代码仓库后获取该仓库的分支
                  fetchBranches(selectedRepoId);
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
            <FormControl fullWidth margin="normal" required>
              <InputLabel>源分支</InputLabel>
              <Select
                value={formData.source_branch}
                onChange={(e) =>
                  setFormData({ ...formData, source_branch: e.target.value })
                }
                label="源分支"
              >
                {branches.map((branch) => (
                  <MenuItem key={branch.name} value={branch.name}>
                    {branch.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth margin="normal" required>
              <InputLabel>目标分支</InputLabel>
              <Select
                value={formData.target_branch}
                onChange={(e) =>
                  setFormData({ ...formData, target_branch: e.target.value })
                }
                label="目标分支"
              >
                {branches.map((branch) => (
                  <MenuItem key={branch.name} value={branch.name}>
                    {branch.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

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
          <Button onClick={handleCloseDialog}>取消</Button>
          <Button onClick={handleSubmit} variant="contained">
            {editingTask ? "更新" : "创建"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
