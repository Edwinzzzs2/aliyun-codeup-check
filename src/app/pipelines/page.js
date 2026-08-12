"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  IconButton,
  MenuItem,
  Paper,
  Select,
  Skeleton,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  Add,
  AccountTree,
  Bolt,
  CheckCircleOutline,
  DeleteOutline,
  EditOutlined,
  OpenInNew,
  PlayArrow,
  Refresh,
  SyncAlt,
} from "@mui/icons-material";
import { useRepoChange, useToken, useTokenMessage } from "../../contexts/TokenContext";

const EMPTY_FORM = {
  name: "test 分支流水线监听",
  pipeline_id: "3817015",
  repository_id: "",
  repository_name: "",
  repository_url: "",
  branch_name: "test",
  interval_minutes: 5,
  enabled: true,
  force_update: true,
  extra_envs: "{}",
};

const STATUS_META = {
  ready: { label: "已建基线", color: "info" },
  success: { label: "已触发", color: "success" },
  no_change: { label: "无变更", color: "default" },
  failed: { label: "失败", color: "error" },
  skipped: { label: "已跳过", color: "warning" },
};

const RUN_STATUS_META = {
  RUNNING: { label: "运行中", color: "info" },
  SUCCESS: { label: "运行成功", color: "success" },
  FAIL: { label: "运行失败", color: "error" },
  CANCELED: { label: "已取消", color: "default" },
  WAITING: { label: "等待中", color: "warning" },
};

function shortCommit(commitId) {
  return commitId ? String(commitId).slice(0, 8) : "—";
}

function formatTime(value) {
  if (!value) return "—";
  return String(value).replace("T", " ").replace(/\.\d+Z?$/, "");
}

function toTimestamp(value) {
  if (!value) return null;
  const numericValue = Number(value);
  const timestamp = Number.isFinite(numericValue) ? numericValue : Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function formatDurationSeconds(totalSeconds) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours) return `${hours} 小时 ${minutes} 分`;
  if (minutes) return `${minutes} 分 ${seconds} 秒`;
  return `${seconds} 秒`;
}

function formatRunDuration(run, now) {
  const storedDuration = Number(run?.durationSeconds);
  if (Number.isFinite(storedDuration) && storedDuration >= 0) {
    return formatDurationSeconds(Math.floor(storedDuration));
  }

  const start = toTimestamp(run?.startTime);
  const end = toTimestamp(run?.endTime);
  if (start && end && end >= start) {
    return formatDurationSeconds(Math.floor((end - start) / 1000));
  }

  // 只有运行中或等待中的实例才能用当前时间计时；终态缺少结束时间时停止累加。
  if (start && ["RUNNING", "WAITING"].includes(run?.status)) {
    return formatDurationSeconds(Math.max(Math.floor((now - start) / 1000), 0));
  }
  return "待同步";
}

function StatusChip({ status }) {
  const meta = STATUS_META[status] || { label: status || "未知", color: "default" };
  return <Chip size="small" label={meta.label} color={meta.color} variant={status === "success" ? "filled" : "outlined"} />;
}

function getCommitUrl(task, commitId) {
  if (!task?.repository_url || !commitId) return null;
  return `${task.repository_url.replace(/\.git$/i, "")}/commit/${encodeURIComponent(commitId)}`;
}

function PipelineRunStatus({ run, now }) {
  const meta = RUN_STATUS_META[run?.status] || (run?.status
    ? { label: run.status, color: "default" }
    : null);
  if (!meta) return null;

  return (
    <Stack direction="row" alignItems="center" spacing={0.7} sx={{ minWidth: 0 }}>
      <Chip size="small" label={meta.label} color={meta.color} sx={{ height: 20, "& .MuiChip-label": { px: 0.8 } }} />
      <Typography variant="caption" color="text.secondary" noWrap>
        {["RUNNING", "WAITING"].includes(run.status) ? "已运行" : "总耗时"} {formatRunDuration(run, now)}
      </Typography>
    </Stack>
  );
}

function PipelineRunMetric({ task, runState, now }) {
  const runId = task.last_pipeline_run_id;
  const run = runState?.run;
  const runUrl = runId
    ? `https://flow.aliyun.com/pipelines/${encodeURIComponent(task.pipeline_id)}/builds/${encodeURIComponent(runId)}`
    : `https://flow.aliyun.com/pipelines/${encodeURIComponent(task.pipeline_id)}/history`;

  return (
    <Box sx={{ bgcolor: "#eef5f7", borderRadius: 2, px: 1.3, py: 1.1, minWidth: 0 }}>
      <Typography variant="caption" color="text.secondary">最近运行</Typography>
      <Stack direction="row" alignItems="center" spacing={0.5}>
        <Typography
          component="a"
          href={runUrl}
          target="_blank"
          rel="noopener noreferrer"
          sx={{ color: runId ? "primary.main" : "text.primary", fontFamily: "monospace", fontWeight: 800, textDecoration: "none", "&:hover": { textDecoration: "underline" } }}
          noWrap
        >
          {runId ? `#${runId}` : "查看流水线"}
        </Typography>
        <OpenInNew sx={{ fontSize: 14, color: "text.secondary", flexShrink: 0 }} />
      </Stack>
      {run && <Box sx={{ mt: 0.5 }}><PipelineRunStatus run={run} now={now} /></Box>}
      {runState?.error && (
        <Tooltip title={runState.error}>
          <Typography variant="caption" color="error.main" noWrap sx={{ display: "block", mt: 0.5 }}>状态获取失败</Typography>
        </Tooltip>
      )}
    </Box>
  );
}

function CommitLogCell({ log, task }) {
  const commitUrl = getCommitUrl(task, log.commit_id);
  return (
    <Box sx={{ minWidth: 180, maxWidth: 300 }}>
      {commitUrl ? (
        <Typography
          component="a"
          href={commitUrl}
          target="_blank"
          rel="noopener noreferrer"
          sx={{ color: "primary.main", fontFamily: "monospace", fontWeight: 700, textDecoration: "none", "&:hover": { textDecoration: "underline" } }}
        >
          {shortCommit(log.commit_id)} <OpenInNew sx={{ fontSize: 12, verticalAlign: "-1px" }} />
        </Typography>
      ) : (
        <Typography sx={{ fontFamily: "monospace", fontWeight: 700 }}>{shortCommit(log.commit_id)}</Typography>
      )}
      <Tooltip title={log.commit_message || "暂无提交信息"} placement="top-start">
        <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block" }}>
          {log.commit_message || "暂无提交信息"}
        </Typography>
      </Tooltip>
    </Box>
  );
}

function PipelineLogRunCell({ log, runState, now }) {
  const pipelineId = runState?.pipelineId || log.pipeline_id;
  const runId = log.pipeline_run_id;
  if (!runId) return <StatusChip status={log.status} />;

  const cachedRun = log.pipeline_status ? {
    status: log.pipeline_status,
    startTime: log.pipeline_start_time,
    endTime: log.pipeline_end_time,
    durationSeconds: log.pipeline_duration_seconds,
  } : null;
  const run = runState?.run || cachedRun;
  const runUrl = `https://flow.aliyun.com/pipelines/${encodeURIComponent(pipelineId)}/builds/${encodeURIComponent(runId)}`;
  return (
    <Stack spacing={0.5} sx={{ minWidth: 190 }}>
      <Typography
        component="a"
        href={runUrl}
        target="_blank"
        rel="noopener noreferrer"
        sx={{ color: "primary.main", fontFamily: "monospace", fontWeight: 800, textDecoration: "none", "&:hover": { textDecoration: "underline" } }}
      >
        运行 #{runId} <OpenInNew sx={{ fontSize: 12, verticalAlign: "-1px" }} />
      </Typography>
      {run ? <PipelineRunStatus run={run} now={now} /> : <StatusChip status={log.status} />}
      {runState?.error && <Typography variant="caption" color="error.main">{runState.error}</Typography>}
    </Stack>
  );
}

function PipelineTaskSkeleton() {
  return (
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", xl: "repeat(2, minmax(0, 1fr))" }, gap: 2 }}>
      {[0, 1].map((item) => (
        <Paper key={item} variant="outlined" sx={{ p: 2.2, borderRadius: 3 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2}>
            <Box sx={{ flex: 1 }}>
              <Skeleton width="42%" height={30} />
              <Skeleton width="68%" />
            </Box>
            <Skeleton variant="rounded" width={38} height={24} />
          </Stack>
          <Stack direction="row" spacing={1} sx={{ my: 2 }}>
            {[0, 1, 2].map((metric) => (
              <Skeleton key={metric} variant="rounded" height={58} sx={{ flex: 1 }} />
            ))}
          </Stack>
          <Skeleton width="72%" />
          <Skeleton width="38%" />
          <Divider sx={{ my: 1.7 }} />
          <Stack direction="row" spacing={1}>
            <Skeleton variant="rounded" width={100} height={31} />
            <Skeleton variant="rounded" width={100} height={31} />
          </Stack>
        </Paper>
      ))}
    </Box>
  );
}

export default function PipelineManagementPage() {
  const { token, orgId } = useToken();
  const { selectedRepo } = useRepoChange();
  const { showMessage } = useTokenMessage();
  const [tasks, setTasks] = useState([]);
  const [logs, setLogs] = useState([]);
  const [logSearch, setLogSearch] = useState("");
  const [logSearchQuery, setLogSearchQuery] = useState("");
  const [logPage, setLogPage] = useState(0);
  const [logPageSize, setLogPageSize] = useState(10);
  const [logTotalCount, setLogTotalCount] = useState(0);
  const [logsLoading, setLogsLoading] = useState(false);
  const [runStates, setRunStates] = useState({});
  const [logRunStates, setLogRunStates] = useState({});
  const [now, setNow] = useState(() => Date.now());
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionId, setActionId] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [pageError, setPageError] = useState("");
  const hasLoadedData = useRef(false);

  const repositories = useMemo(() => {
    if (typeof window === "undefined") return [];
    try {
      return JSON.parse(localStorage.getItem(`codeup_repos_cache_${orgId || "default"}`) || "[]");
    } catch {
      return [];
    }
  }, [orgId, dialogOpen]);

  const tasksById = useMemo(() => Object.fromEntries(
    tasks.map((task) => [String(task.id), task])
  ), [tasks]);

  const requestJson = useCallback(async (url, options = {}) => {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(token ? { "x-yunxiao-token": token } : {}),
        ...options.headers,
      },
    });
    const data = await response.json();
    if (!response.ok || data.success === false) {
      throw new Error(data.message || `请求失败（HTTP ${response.status}）`);
    }
    return data;
  }, [token]);

  const loadData = useCallback(async (mode = "background") => {
    // 首次加载显示内容骨架；后续刷新保留已有数据，只在操作入口反馈进度。
    if (mode === "initial") setInitialLoading(true);
    if (mode === "refresh") setRefreshing(true);
    if (mode === "table") setLogsLoading(true);
    setPageError("");
    try {
      const logParams = new URLSearchParams({
        compact: "true",
        page: String(logPage + 1),
        pageSize: String(logPageSize),
      });
      if (logSearchQuery) logParams.set("q", logSearchQuery);
      const [taskResult, logResult] = await Promise.all([
        requestJson("/api/pipelines/tasks"),
        requestJson(`/api/pipelines/logs?${logParams.toString()}`),
      ]);
      setTasks(taskResult.data || []);
      setLogs(logResult.data || []);
      setLogTotalCount(logResult.pagination?.totalCount || 0);
    } catch (error) {
      setPageError(error.message);
    } finally {
      if (mode === "initial") setInitialLoading(false);
      if (mode === "refresh") setRefreshing(false);
      if (mode === "table") setLogsLoading(false);
    }
  }, [logPage, logPageSize, logSearchQuery, requestJson]);

  const loadRunStates = useCallback(async () => {
    try {
      const result = await requestJson("/api/pipelines/runs");
      const taskRuns = Array.isArray(result.data) ? result.data : result.data?.taskRuns || [];
      const logRuns = Array.isArray(result.data) ? [] : result.data?.logRuns || [];
      setRunStates(Object.fromEntries(
        taskRuns.map((item) => [String(item.taskId), item])
      ));
      setLogRunStates(Object.fromEntries(
        logRuns.map((item) => [String(item.logId), item])
      ));
    } catch (error) {
      console.error("[Pipeline] 刷新运行状态失败:", error);
    }
  }, [requestJson]);

  useEffect(() => {
    const mode = hasLoadedData.current ? "table" : "initial";
    hasLoadedData.current = true;
    loadData(mode);
    loadRunStates();
  }, [loadData, loadRunStates]);

  useEffect(() => {
    const searchTimer = window.setTimeout(() => {
      setLogPage(0);
      setLogSearchQuery(logSearch.trim());
    }, 300);
    return () => window.clearTimeout(searchTimer);
  }, [logSearch]);

  useEffect(() => {
    // 运行中耗时在前端逐秒更新，云效状态则低频静默同步，避免频繁请求和页面闪烁。
    const durationTimer = window.setInterval(() => setNow(Date.now()), 1000);
    const statusTimer = window.setInterval(loadRunStates, 10000);
    return () => {
      window.clearInterval(durationTimer);
      window.clearInterval(statusTimer);
    };
  }, [loadRunStates]);

  useEffect(() => {
    // 自动检测在服务端执行，页面静默拉取任务和日志，让新记录无需手动刷新即可出现。
    const dataTimer = window.setInterval(() => loadData(), 15000);
    return () => window.clearInterval(dataTimer);
  }, [loadData]);

  const handleRefresh = () => Promise.all([loadData("refresh"), loadRunStates()]);

  const openCreateDialog = () => {
    const repository = repositories.find((item) => String(item.id) === String(selectedRepo));
    const repositoryName = repository?.name || "";
    setEditingTask(null);
    setForm({
      ...EMPTY_FORM,
      repository_id: selectedRepo || "",
      repository_name: repositoryName,
      repository_url: repositoryName
        ? `https://codeup.aliyun.com/${orgId}/web/${repositoryName}.git`
        : "",
    });
    setDialogOpen(true);
  };

  const openEditDialog = (task) => {
    setEditingTask(task);
    setForm({
      ...task,
      extra_envs: JSON.stringify(task.extra_envs || {}, null, 2),
    });
    setDialogOpen(true);
  };

  const handleRepositoryChange = (repositoryId) => {
    const repository = repositories.find((item) => String(item.id) === String(repositoryId));
    setForm((current) => ({
      ...current,
      repository_id: repositoryId,
      repository_name: repository?.name || "",
      repository_url: repository?.name
        ? `https://codeup.aliyun.com/${orgId}/web/${repository.name}.git`
        : current.repository_url,
    }));
  };

  const saveTask = async () => {
    let extraEnvs;
    try {
      extraEnvs = JSON.parse(form.extra_envs || "{}");
    } catch {
      showMessage("附加变量必须是有效 JSON", "error");
      return;
    }

    setActionId("save");
    try {
      const payload = {
        ...form,
        organization_id: orgId,
        interval_minutes: Number(form.interval_minutes),
        extra_envs: extraEnvs,
      };
      await requestJson(
        editingTask ? `/api/pipelines/tasks?id=${editingTask.id}` : "/api/pipelines/tasks",
        {
          method: editingTask ? "PUT" : "POST",
          body: JSON.stringify(payload),
        }
      );
      showMessage(editingTask ? "流水线任务已更新" : "流水线任务已创建并记录基线", "success");
      setDialogOpen(false);
      await loadData();
    } catch (error) {
      showMessage(error.message, "error");
    } finally {
      setActionId("");
    }
  };

  const executeTask = async (task, force) => {
    setActionId(`${force ? "run" : "check"}-${task.id}`);
    try {
      const result = await requestJson("/api/pipelines/execute", {
        method: "POST",
        body: JSON.stringify({ taskId: task.id, force }),
      });
      showMessage(result.data?.message || "任务执行完成", result.data?.status === "failed" ? "error" : "success");
      await Promise.all([loadData(), loadRunStates()]);
    } catch (error) {
      showMessage(error.message, "error");
    } finally {
      setActionId("");
    }
  };

  const toggleTask = async (task) => {
    setActionId(`toggle-${task.id}`);
    try {
      await requestJson(`/api/pipelines/tasks?id=${task.id}`, {
        method: "PUT",
        body: JSON.stringify({ enabled: !task.enabled }),
      });
      await loadData();
    } catch (error) {
      showMessage(error.message, "error");
    } finally {
      setActionId("");
    }
  };

  const deleteTask = async (task) => {
    if (!window.confirm(`确定删除流水线任务“${task.name}”吗？`)) return;
    setActionId(`delete-${task.id}`);
    try {
      await requestJson(`/api/pipelines/tasks?id=${task.id}`, { method: "DELETE" });
      showMessage("流水线任务已删除", "success");
      await loadData();
    } catch (error) {
      showMessage(error.message, "error");
    } finally {
      setActionId("");
    }
  };

  return (
    <Box sx={{ height: "100%", overflow: "auto", pb: 4 }}>
      <Paper
        elevation={0}
        sx={{
          mb: 2.5,
          p: 2,
          borderRadius: 2,
          backgroundColor: "rgba(255, 255, 255, 0.95)",
          border: "1px solid rgba(255, 255, 255, 0.3)",
          boxShadow: "0 4px 20px rgba(0, 0, 0, 0.1)",
          backdropFilter: "blur(10px)",
        }}
      >
        <Stack direction={{ xs: "column", sm: "row" }} alignItems={{ xs: "stretch", sm: "center" }} justifyContent="space-between" gap={2}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, minWidth: 0 }}>
            <Box
              sx={{
                width: 42,
                height: 42,
                display: "grid",
                placeItems: "center",
                flexShrink: 0,
                borderRadius: 1.5,
                color: "primary.main",
                backgroundColor: "rgba(25, 118, 210, 0.1)",
              }}
            >
              <AccountTree />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="h6" component="h1" sx={{ fontWeight: 600, lineHeight: 1.3 }}>
                流水线管理
              </Typography>
              <Typography variant="body2" color="text.secondary" noWrap>
                监听分支提交变化，自动触发云效 Flow
              </Typography>
            </Box>
          </Box>
          <Stack direction="row" alignItems="center" spacing={1.5} sx={{ flexShrink: 0 }}>
            <Button
              variant="outlined"
              startIcon={refreshing ? <CircularProgress size={16} /> : <Refresh />}
              onClick={handleRefresh}
              disabled={refreshing || Boolean(actionId)}
            >
              {refreshing ? "刷新中" : "刷新"}
            </Button>
            <Button variant="contained" startIcon={<Add />} onClick={openCreateDialog}>
              新建监听
            </Button>
          </Stack>
        </Stack>
      </Paper>

      {pageError && (
        <Alert severity="error" sx={{ mb: 2.5 }}>
          {pageError}。若是首次使用，请先在 Supabase 执行 pipeline-schema.sql。
        </Alert>
      )}

      {initialLoading ? (
        <PipelineTaskSkeleton />
      ) : tasks.length === 0 ? (
        <Paper variant="outlined" sx={{ p: 7, textAlign: "center", borderStyle: "dashed", borderRadius: 3 }}>
          <Bolt sx={{ fontSize: 44, color: "#f7a900", mb: 1 }} />
          <Typography variant="h6" fontWeight={800}>还没有流水线监听任务</Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5, mb: 2 }}>创建任务时会读取当前提交作为基线，不会立即触发流水线。</Typography>
          <Button variant="contained" onClick={openCreateDialog}>创建第一个任务</Button>
        </Paper>
      ) : (
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", xl: "repeat(2, minmax(0, 1fr))" }, gap: 2 }}>
          {tasks.map((task) => (
            <Paper key={task.id} variant="outlined" sx={{ p: 2.2, borderRadius: 3, borderColor: task.enabled ? "#b8d6df" : "divider", bgcolor: task.enabled ? "#fbfeff" : "#f6f7f8" }}>
              <Stack direction="row" justifyContent="space-between" gap={2}>
                <Box sx={{ minWidth: 0 }}>
                  <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
                    <StatusChip status={task.last_status} />
                    <Typography variant="h6" fontWeight={800} noWrap>{task.name}</Typography>
                  </Stack>
                  <Typography variant="body2" color="text.secondary">
                    Flow #{task.pipeline_id} · {task.repository_name || task.repository_id} / {task.branch_name}
                  </Typography>
                </Box>
                <Switch checked={Boolean(task.enabled)} onChange={() => toggleTask(task)} disabled={Boolean(actionId)} inputProps={{ "aria-label": `${task.name}启用状态` }} />
              </Stack>

              <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 1, my: 2 }}>
                <Box sx={{ bgcolor: "#eef5f7", borderRadius: 2, px: 1.3, py: 1.1 }}>
                  <Typography variant="caption" color="text.secondary">当前提交</Typography>
                  <Typography sx={{ fontFamily: "monospace", fontWeight: 800, mt: 0.2 }} noWrap>{shortCommit(task.last_commit_id)}</Typography>
                </Box>
                <PipelineRunMetric task={task} runState={runStates[String(task.id)]} now={now} />
                <Box sx={{ bgcolor: "#eef5f7", borderRadius: 2, px: 1.3, py: 1.1 }}>
                  <Typography variant="caption" color="text.secondary">监听频率</Typography>
                  <Typography sx={{ fontFamily: "monospace", fontWeight: 800, mt: 0.2 }} noWrap>{task.interval_minutes} 分钟</Typography>
                </Box>
              </Box>

              <Typography variant="body2" sx={{ minHeight: 40, color: task.last_status === "failed" ? "error.main" : "text.secondary" }}>
                {task.last_message || "等待首次检查"}
              </Typography>
              <Typography variant="caption" color="text.disabled">下次检查：{formatTime(task.next_run)}</Typography>

              <Divider sx={{ my: 1.7 }} />
              <Stack direction="row" flexWrap="wrap" gap={1}>
                <Button size="small" variant="outlined" startIcon={actionId === `check-${task.id}` ? <CircularProgress size={14} /> : <SyncAlt />} onClick={() => executeTask(task, false)} disabled={Boolean(actionId)}>
                  检测变更
                </Button>
                <Button size="small" variant="contained" color="warning" startIcon={actionId === `run-${task.id}` ? <CircularProgress size={14} /> : <PlayArrow />} onClick={() => executeTask(task, true)} disabled={Boolean(actionId)}>
                  立即运行
                </Button>
                <Box sx={{ flex: 1 }} />
                <Tooltip title="编辑"><IconButton size="small" onClick={() => openEditDialog(task)}><EditOutlined /></IconButton></Tooltip>
                <Tooltip title="删除"><IconButton size="small" color="error" onClick={() => deleteTask(task)} disabled={Boolean(actionId)}><DeleteOutline /></IconButton></Tooltip>
              </Stack>
            </Paper>
          ))}
        </Box>
      )}

      <Paper variant="outlined" sx={{ mt: 2.5, borderRadius: 3, overflow: "hidden" }}>
        <Box sx={{ px: 2.5, py: 2, display: "flex", alignItems: { xs: "stretch", md: "center" }, flexDirection: { xs: "column", md: "row" }, gap: 1.5 }}>
          <CheckCircleOutline color="primary" />
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6" fontWeight={800}>最近执行记录</Typography>
            <Typography variant="caption" color="text.secondary">
              每个任务仅展示最新自动检测，已触发的流水线历史完整保留
            </Typography>
          </Box>
          <TextField
            size="small"
            value={logSearch}
            onChange={(event) => setLogSearch(event.target.value)}
            placeholder="搜索任务、提交、运行 ID、状态或说明"
            aria-label="搜索最近执行记录"
            sx={{ width: { xs: "100%", md: 340 } }}
          />
          {logsLoading && <CircularProgress size={18} />}
        </Box>
        <TableContainer>
          <Table size="small">
            <TableHead sx={{ bgcolor: "#edf3f5" }}>
              <TableRow>
                <TableCell>时间</TableCell><TableCell>任务 / 流水线</TableCell><TableCell>方式</TableCell><TableCell>提交记录</TableCell><TableCell>流水线运行</TableCell><TableCell>说明</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {initialLoading ? (
                [0, 1].map((row) => (
                  <TableRow key={row}>
                    {[120, 160, 80, 80, 120, 260].map((width, cell) => (
                      <TableCell key={cell}><Skeleton width={width} /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : logs.length === 0 ? (
                <TableRow><TableCell colSpan={6} align="center" sx={{ py: 4, color: "text.secondary" }}>暂无执行记录</TableCell></TableRow>
              ) : logs.map((log) => (
                <TableRow key={log.id} hover>
                  <TableCell sx={{ whiteSpace: "nowrap" }}>{formatTime(log.executed_at)}</TableCell>
                  <TableCell sx={{ minWidth: 170 }}>
                    <Typography variant="body2">{log.task_name}</Typography>
                    <Typography
                      component="a"
                      href={`https://flow.aliyun.com/pipelines/${encodeURIComponent(log.pipeline_id || tasksById[String(log.task_id)]?.pipeline_id || "")}/history`}
                      target="_blank"
                      rel="noopener noreferrer"
                      variant="caption"
                      sx={{ color: "primary.main", textDecoration: "none", "&:hover": { textDecoration: "underline" } }}
                    >
                      Flow #{log.pipeline_id || tasksById[String(log.task_id)]?.pipeline_id || "—"}
                    </Typography>
                  </TableCell>
                  <TableCell>{log.trigger_type === "scheduled" ? "自动检测" : log.trigger_type === "manual" ? "手动运行" : log.trigger_type === "setup" ? "建立基线" : "手动检测"}</TableCell>
                  <TableCell><CommitLogCell log={log} task={tasksById[String(log.task_id)]} /></TableCell>
                  <TableCell><PipelineLogRunCell log={log} runState={logRunStates[String(log.id)]} now={now} /></TableCell>
                  <TableCell sx={{ minWidth: 260 }}>{log.message}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div"
          count={logTotalCount}
          page={logPage}
          onPageChange={(_, page) => setLogPage(page)}
          rowsPerPage={logPageSize}
          onRowsPerPageChange={(event) => {
            setLogPageSize(Number(event.target.value));
            setLogPage(0);
          }}
          rowsPerPageOptions={[10, 20, 50]}
          labelRowsPerPage="每页"
          labelDisplayedRows={({ from, to, count }) => `${from}-${to} / ${count}`}
        />
      </Paper>

      <Dialog open={dialogOpen} onClose={() => !actionId && setDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ fontWeight: 800 }}>{editingTask ? "编辑流水线监听" : "新建流水线监听"}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField label="任务名称" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField label="流水线 ID" value={form.pipeline_id} onChange={(event) => setForm({ ...form, pipeline_id: event.target.value })} required fullWidth />
              <TextField label="监听分支" value={form.branch_name} onChange={(event) => setForm({ ...form, branch_name: event.target.value })} required fullWidth />
            </Stack>
            <Select displayEmpty value={form.repository_id} onChange={(event) => handleRepositoryChange(event.target.value)}>
              <MenuItem value="" disabled>选择用于检测变更的代码库</MenuItem>
              {repositories.map((repository) => <MenuItem key={repository.id} value={String(repository.id)}>{repository.name}</MenuItem>)}
            </Select>
            <TextField label="仓库 Git 地址" value={form.repository_url} onChange={(event) => setForm({ ...form, repository_url: event.target.value })} required helperText="必须与 Flow 流水线代码源地址完全一致，例如 https://codeup.aliyun.com/.../xlb_fss_web.git" />
            <TextField label="监听间隔（分钟）" type="number" value={form.interval_minutes} onChange={(event) => setForm({ ...form, interval_minutes: event.target.value })} inputProps={{ min: 1 }} required />
            <TextField label="附加运行变量（JSON）" value={form.extra_envs} onChange={(event) => setForm({ ...form, extra_envs: event.target.value })} multiline minRows={3} placeholder={'{\n  "KEY": "VALUE"\n}'} />
            <Stack direction="row" spacing={3}>
              <FormControlLabel control={<Switch checked={Boolean(form.force_update)} onChange={(event) => setForm({ ...form, force_update: event.target.checked })} />} label="FORCE_UPDATE=1" />
              <FormControlLabel control={<Switch checked={Boolean(form.enabled)} onChange={(event) => setForm({ ...form, enabled: event.target.checked })} />} label="启用监听" />
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setDialogOpen(false)} disabled={actionId === "save"}>取消</Button>
          <Button variant="contained" onClick={saveTask} disabled={actionId === "save"} startIcon={actionId === "save" ? <CircularProgress size={16} /> : null}>
            {editingTask ? "保存修改" : "创建并记录基线"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
