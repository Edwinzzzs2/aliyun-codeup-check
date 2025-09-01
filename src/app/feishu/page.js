"use client";

import { useState, useEffect } from "react";
import {
  Box,
  Typography,
  TextField,
  Switch,
  FormControlLabel,
  Button,
  Alert,
  CircularProgress,
  Divider,
  Grid,
  Paper,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  LinearProgress,
  IconButton,
  Tooltip,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import {
  Notifications,
  Send,
  Save,
  Delete,
  Science,
  Add,
  Edit,
  ContentCopy,
} from "@mui/icons-material";
import { useTokenMessage } from "../../contexts/TokenContext";

export default function FeishuConfigPage() {
  const { showMessage } = useTokenMessage();

  const [configs, setConfigs] = useState([]);
  const [loading, setLoading] = useState({
    fetch: false,
    save: false,
    test: false,
    delete: false,
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [testDialogOpen, setTestDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState(null);
  const [testingConfig, setTestingConfig] = useState(null);
  const [deletingConfig, setDeletingConfig] = useState(null);

  const [formData, setFormData] = useState({
    name: "",
    webhook_url: "",
    enabled: true,
    notify_on_success: true,
    notify_on_failure: true,
    custom_message_template: "",
  });

  // 加载所有配置
  useEffect(() => {
    fetchConfigs();
  }, []);

  const fetchConfigs = async () => {
    setLoading((prev) => ({ ...prev, fetch: true }));
    try {
      const response = await fetch("/api/feishu/configs");
      const result = await response.json();

      if (result.success) {
        setConfigs(result.data || []);
      } else {
        showMessage(result.message || "获取配置失败", "error");
      }
    } catch (error) {
      console.error("获取飞书配置错误:", error);
      showMessage("获取配置失败", "error");
    } finally {
      setLoading((prev) => ({ ...prev, fetch: false }));
    }
  };

  const handleOpenDialog = (config = null) => {
    if (config) {
      setEditingConfig(config);
      setFormData({
        name: config.name || "",
        webhook_url: config.webhook_url || "",
        enabled: config.enabled ?? true,
        notify_on_success: config.notify_on_success ?? true,
        notify_on_failure: config.notify_on_failure ?? true,
        custom_message_template: config.custom_message_template || "",
      });
    } else {
      setEditingConfig(null);
      setFormData({
        name: "",
        webhook_url: "",
        enabled: true,
        notify_on_success: true,
        notify_on_failure: true,
        custom_message_template: "",
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingConfig(null);
    setFormData({
      name: "",
      webhook_url: "",
      enabled: true,
      notify_on_success: true,
      notify_on_failure: true,
      custom_message_template: "",
    });
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      showMessage("配置名称不能为空", "error");
      return;
    }
    if (!formData.webhook_url.trim()) {
      showMessage("Webhook URL 不能为空", "error");
      return;
    }

    setLoading((prev) => ({ ...prev, save: true }));
    try {
      const url = editingConfig
        ? `/api/feishu/configs/${editingConfig.id}`
        : "/api/feishu/configs";
      const method = editingConfig ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (result.success) {
        showMessage(
          editingConfig ? "配置更新成功" : "配置创建成功",
          "success"
        );
        handleCloseDialog();
        fetchConfigs();
      } else {
        showMessage(result.message || "保存失败", "error");
      }
    } catch (error) {
      console.error("保存飞书配置错误:", error);
      showMessage("保存失败", "error");
    } finally {
      setLoading((prev) => ({ ...prev, save: false }));
    }
  };

  const handleTest = async () => {
    if (!testingConfig) return;

    setLoading((prev) => ({ ...prev, test: true }));
    try {
      const response = await fetch("/api/feishu/notify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "test",
          configId: testingConfig.id,
          taskName: "测试任务",
          status: "success",
          message: "这是一条测试消息，用于验证飞书通知配置是否正常工作。",
          mergeRequestId: "TEST-001",
          mergeRequestUrl: "https://example.com/merge-request/test",
          repositoryName: "示例仓库",
          sourceBranch: "feature/test",
          targetBranch: "master",
          mergeTitle: "自动合并: feature/test -> master",
        }),
      });

      const result = await response.json();

      if (result.success) {
        showMessage("测试消息发送成功", "success");
      } else {
        showMessage(result.message || "测试失败", "error");
      }
    } catch (error) {
      console.error("测试飞书通知错误:", error);
      showMessage("测试失败", "error");
    } finally {
      setLoading((prev) => ({ ...prev, test: false }));
      setTestDialogOpen(false);
      setTestingConfig(null);
    }
  };

  const handleDelete = async () => {
    if (!deletingConfig) return;

    setLoading((prev) => ({ ...prev, delete: true }));
    try {
      const response = await fetch(`/api/feishu/configs/${deletingConfig.id}`, {
        method: "DELETE",
      });

      const result = await response.json();

      if (result.success) {
        showMessage("配置删除成功", "success");
        fetchConfigs();
      } else {
        showMessage(result.message || "删除失败", "error");
      }
    } catch (error) {
      console.error("删除飞书配置错误:", error);
      showMessage("删除失败", "error");
    } finally {
      setLoading((prev) => ({ ...prev, delete: false }));
      setDeleteDialogOpen(false);
      setDeletingConfig(null);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleCopyConfig = (config) => {
    handleOpenDialog({
      ...config,
      name: `${config.name} - 副本`,
      id: null, // 清除ID，作为新配置创建
    });
  };

  if (loading.fetch) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="400px"
      >
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box
      sx={{
        minHeight: "100vh",
      }}
    >
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
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Notifications color="primary" fontSize="medium" />
          <Typography variant="h6" component="h1" sx={{ fontWeight: 600 }}>
            飞书通知配置管理
          </Typography>
          <Chip
            label={`${configs.length} 个配置`}
            color="primary"
            size="small"
          />
        </Box>
        <Box sx={{ flexGrow: 1 }} />
        <Box sx={{ display: "flex", gap: 1.5 }}>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => handleOpenDialog()}
            sx={{ minWidth: 120 }}
          >
            新增配置
          </Button>
        </Box>
      </Paper>

      {/* 配置列表 */}
      <Paper
        sx={{
          width: "100%",
          mt: 3,
          p: 2,
          backgroundColor: "rgba(255, 255, 255, 0.95)",
          boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
          borderRadius: 2,
          border: "1px solid rgba(255,255,255,0.3)",
          backdropFilter: "blur(10px)",
          height: "calc(100vh - 220px)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            mb: 2,
          }}
        >
          <Typography variant="h6" sx={{ fontWeight: "bold" }}>配置列表</Typography>
        </Box>

        <Box sx={{ flex: 1, minHeight: 0 }}>
          <DataGrid
            rows={configs.map((config) => ({
              id: config.id,
              name: config.name,
              webhook_url: config.webhook_url,
              enabled: config.enabled,
              notify_on_success: config.notify_on_success,
              notify_on_failure: config.notify_on_failure,
              originalData: config,
            }))}
            columns={[
              {
                field: "name",
                headerName: "配置名称",
                flex: 1,
                minWidth: 120,
                renderCell: (params) => (
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    {params.value}
                  </Typography>
                ),
              },
              {
                field: "webhook_url",
                headerName: "Webhook URL",
                flex: 3,
                minWidth: 400,
                renderCell: (params) => (
                  <Typography
                    variant="body2"
                    sx={{
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      width: "100%",
                    }}
                    title={params.value}
                  >
                    {params.value}
                  </Typography>
                ),
              },
              {
                field: "enabled",
                headerName: "状态",
                width: 100,
                headerAlign: "center",
                align: "center",
                renderCell: (params) => (
                  <Chip
                    label={params.value ? "已启用" : "已禁用"}
                    color={params.value ? "success" : "default"}
                    size="small"
                  />
                ),
              },
              {
                field: "notify_on_success",
                headerName: "成功通知",
                width: 100,
                headerAlign: "center",
                align: "center",
                renderCell: (params) => (
                  <Chip
                    label={params.value ? "是" : "否"}
                    color={params.value ? "success" : "default"}
                    size="small"
                    variant="outlined"
                  />
                ),
              },
              {
                field: "notify_on_failure",
                headerName: "失败通知",
                width: 100,
                headerAlign: "center",
                align: "center",
                renderCell: (params) => (
                  <Chip
                    label={params.value ? "是" : "否"}
                    color={params.value ? "error" : "default"}
                    size="small"
                    variant="outlined"
                  />
                ),
              },
              {
                field: "actions",
                headerName: "操作",
                width: 150,
                headerAlign: "center",
                align: "center",
                sortable: false,
                renderCell: (params) => (
                  <Box sx={{ display: "flex", gap: 0.5, justifyContent: "center" }}>
                    <Tooltip title="编辑">
                      <IconButton
                        size="small"
                        color="primary"
                        onClick={() => {
                          setEditingConfig(params.row.originalData);
                          setFormData({
                            name: params.row.originalData.name,
                            webhook_url: params.row.originalData.webhook_url,
                            enabled: params.row.originalData.enabled,
                            notify_on_success: params.row.originalData.notify_on_success,
                            notify_on_failure: params.row.originalData.notify_on_failure,
                            custom_message_template: params.row.originalData.custom_message_template || "",
                          });
                          setDialogOpen(true);
                        }}
                      >
                        <Edit fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="复制URL">
                      <IconButton
                        size="small"
                        color="info"
                        onClick={() => {
                          navigator.clipboard.writeText(params.row.originalData.webhook_url);
                          showMessage("URL已复制到剪贴板", "success");
                        }}
                      >
                        <ContentCopy fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="测试">
                      <IconButton
                        size="small"
                        color="success"
                        onClick={() => {
                          setTestingConfig(params.row.originalData);
                          setTestDialogOpen(true);
                        }}
                      >
                        <Science fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="删除">
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => {
                          setDeletingConfig(params.row.originalData);
                          setDeleteDialogOpen(true);
                        }}
                      >
                        <Delete fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                ),
              },
            ]}
            loading={loading.fetch}
            disableSelectionOnClick
            hideFooter
            localeText={{
              noRowsLabel: "暂无配置，点击\"新增配置\"创建第一个飞书通知配置",
            }}
            sx={{
              border: 0,
              width: "100%",
              height: "100%",
              "& .MuiDataGrid-main": {
                overflow: "hidden",
              },
              "& .MuiDataGrid-virtualScroller": {
                overflow: "auto",
              },
              "& .MuiDataGrid-cell": {
                display: "flex",
                alignItems: "center",
              },
              "& .MuiDataGrid-columnHeader": {
                display: "flex",
                alignItems: "center",
              },
            }}
          />
        </Box>
      </Paper>

      {/* 新增/编辑配置对话框 */}
      <Dialog
        open={dialogOpen}
        onClose={handleCloseDialog}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {editingConfig ? "编辑飞书配置" : "新增飞书配置"}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <TextField
              fullWidth
              label="配置名称"
              placeholder="例如：开发团队群、测试团队群"
              value={formData.name}
              onChange={(e) => handleInputChange("name", e.target.value)}
              sx={{ mb: 2 }}
              required
            />

            <TextField
              fullWidth
              label="Webhook URL"
              placeholder="https://open.feishu.cn/open-apis/bot/v2/hook/your-webhook-url"
              value={formData.webhook_url}
              onChange={(e) => handleInputChange("webhook_url", e.target.value)}
              helperText="请输入飞书机器人的 Webhook URL"
              sx={{ mb: 2 }}
              required
            />

            <FormControlLabel
              control={
                <Switch
                  checked={formData.enabled}
                  onChange={(e) => handleInputChange("enabled", e.target.checked)}
                />
              }
              label="启用飞书通知"
              sx={{ mb: 2 }}
            />

            <Divider sx={{ my: 2 }} />

            <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
              通知类型
            </Typography>

            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, mb: 2 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.notify_on_success}
                    onChange={(e) =>
                      handleInputChange("notify_on_success", e.target.checked)
                    }
                  />
                }
                label="自动合并成功时通知"
              />

              <FormControlLabel
                control={
                  <Switch
                    checked={formData.notify_on_failure}
                    onChange={(e) =>
                      handleInputChange("notify_on_failure", e.target.checked)
                    }
                  />
                }
                label="自动合并失败时通知"
              />
            </Box>

            <Divider sx={{ my: 2 }} />

            <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
              自定义消息模板（可选）
            </Typography>

            <TextField
              fullWidth
              multiline
              rows={4}
              label="消息模板"
              placeholder={`留空使用默认模板。可用变量：{taskName} - 任务名称 | {repositoryName} - 仓库名称 | {sourceBranch} - 源分支 | {targetBranch} - 目标分支 | {status} - 状态 | {message} - 详细消息`}
              value={formData.custom_message_template}
              onChange={(e) =>
                handleInputChange("custom_message_template", e.target.value)
              }
              helperText="留空将使用默认的卡片消息模板"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>取消</Button>
          <Button
            onClick={handleSave}
            variant="contained"
            disabled={loading.save}
            startIcon={loading.save ? <CircularProgress size={16} /> : <Save />}
          >
            {loading.save ? "保存中..." : "保存"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 测试确认对话框 */}
      <Dialog open={testDialogOpen} onClose={() => setTestDialogOpen(false)}>
        <DialogTitle>发送测试消息</DialogTitle>
        <DialogContent>
          <Typography>
            确定要向配置"{testingConfig?.name}"发送一条测试消息吗？
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTestDialogOpen(false)}>取消</Button>
          <Button
            onClick={handleTest}
            variant="contained"
            color="primary"
            disabled={loading.test}
            startIcon={loading.test ? <CircularProgress size={16} /> : <Science />}
          >
            {loading.test ? "发送中..." : "发送测试"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 删除确认对话框 */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>删除配置</DialogTitle>
        <DialogContent>
          <Typography>
            确定要删除配置"{deletingConfig?.name}"吗？此操作不可撤销。
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>取消</Button>
          <Button
            onClick={handleDelete}
            variant="contained"
            color="error"
            disabled={loading.delete}
            startIcon={loading.delete ? <CircularProgress size={16} /> : <Delete />}
          >
            {loading.delete ? "删除中..." : "删除"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
