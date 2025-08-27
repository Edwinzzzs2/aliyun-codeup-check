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
} from "@mui/material";
import {
  Notifications,
  Send,
  Save,
  Delete,
  Science,
} from "@mui/icons-material";
import { useTokenMessage } from "../../contexts/TokenContext";

export default function FeishuConfigPage() {
  const { showMessage } = useTokenMessage();

  const [config, setConfig] = useState({
    webhook_url: "",
    enabled: true,
    notify_on_success: true,
    notify_on_failure: true,
    custom_message_template: "",
  });

  const [loading, setLoading] = useState({
    fetch: false,
    save: false,
    test: false,
    delete: false,
  });

  const [testDialogOpen, setTestDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // 加载配置
  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    setLoading((prev) => ({ ...prev, fetch: true }));
    try {
      const response = await fetch("/api/feishu/config");
      const result = await response.json();

      if (result.success) {
        setConfig(result.data);
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

  const handleSave = async () => {
    if (!config.webhook_url.trim()) {
      showMessage("Webhook URL 不能为空", "error");
      return;
    }

    setLoading((prev) => ({ ...prev, save: true }));
    try {
      const response = await fetch("/api/feishu/config", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(config),
      });

      const result = await response.json();

      if (result.success) {
        showMessage("配置保存成功", "success");
        setConfig(result.data);
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
    if (!config.webhook_url.trim()) {
      showMessage("请先配置 Webhook URL", "error");
      return;
    }

    setLoading((prev) => ({ ...prev, test: true }));
    try {
      const response = await fetch("/api/feishu/notify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "test",
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
    }
  };

  const handleDelete = async () => {
    setLoading((prev) => ({ ...prev, delete: true }));
    try {
      const response = await fetch("/api/feishu/config", {
        method: "DELETE",
      });

      const result = await response.json();

      if (result.success) {
        showMessage("配置删除成功", "success");
        setConfig({
          webhook_url: "",
          enabled: true,
          notify_on_success: true,
          notify_on_failure: true,
          custom_message_template: "",
        });
      } else {
        showMessage(result.message || "删除失败", "error");
      }
    } catch (error) {
      console.error("删除飞书配置错误:", error);
      showMessage("删除失败", "error");
    } finally {
      setLoading((prev) => ({ ...prev, delete: false }));
      setDeleteDialogOpen(false);
    }
  };

  const handleInputChange = (field, value) => {
    setConfig((prev) => ({
      ...prev,
      [field]: value,
    }));
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
    <Box sx={{ p: 3 }}>
      <Paper sx={{ p: 2, mb: 3 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Notifications color="primary" fontSize="medium" />
          <Typography variant="h6" component="h1" sx={{ fontWeight: 600 }}>
            飞书通知配置
          </Typography>
          <Chip
            label={config.enabled ? "已启用" : "已禁用"}
            color={config.enabled ? "success" : "default"}
            size="small"
          />
          <Box sx={{ flexGrow: 1 }} />
          <Box sx={{ display: "flex", gap: 1.5 }}>
            <Button
              variant="contained"
              startIcon={
                loading.save ? <CircularProgress size={16} /> : <Save />
              }
              onClick={handleSave}
              disabled={loading.save}
              sx={{ minWidth: 120 }}
            >
              {loading.save ? "保存中..." : "保存配置"}
            </Button>
            <Button
              variant="outlined"
              startIcon={
                loading.test ? <CircularProgress size={16} /> : <Send />
              }
              onClick={() => setTestDialogOpen(true)}
              disabled={loading.test || !config.webhook_url?.trim()}
              sx={{ minWidth: 120 }}
            >
              {loading.test ? "测试中..." : "发送测试消息"}
            </Button>
            <Button
              variant="outlined"
              color="error"
              startIcon={
                loading.delete ? <CircularProgress size={16} /> : <Delete />
              }
              onClick={() => setDeleteDialogOpen(true)}
              disabled={loading.delete}
              sx={{ minWidth: 120 }}
            >
              {loading.delete ? "删除中..." : "删除配置"}
            </Button>
          </Box>
        </Box>
      </Paper>

      {/* 基础配置（上下结构） */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600 }}>
          基础配置
        </Typography>

        <Box sx={{ mb: 2 }}>
          <TextField
            fullWidth
            label="Webhook URL"
            placeholder="https://open.feishu.cn/open-apis/bot/v2/hook/your-webhook-url"
            value={config.webhook_url ?? ""}
            onChange={(e) => handleInputChange("webhook_url", e.target.value)}
            helperText="请输入飞书机器人的 Webhook URL"
            required
          />
        </Box>

        <Box sx={{ mb: 2 }}>
          <FormControlLabel
            control={
              <Switch
                checked={config.enabled}
                onChange={(e) => handleInputChange("enabled", e.target.checked)}
              />
            }
            label="启用飞书通知"
          />
        </Box>

        <Divider sx={{ my: 2 }} />

        <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600 }}>
          通知类型
        </Typography>

        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, mb: 2 }}>
          <FormControlLabel
            control={
              <Switch
                checked={config.notify_on_success}
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
                checked={config.notify_on_failure}
                onChange={(e) =>
                  handleInputChange("notify_on_failure", e.target.checked)
                }
              />
            }
            label="自动合并失败时通知"
          />
        </Box>

        <Divider sx={{ my: 2 }} />

        <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600 }}>
          自定义消息模板（可选）
        </Typography>

        <TextField
          fullWidth
          multiline
          rows={6}
          label="消息模板"
          placeholder="留空使用默认模板。\n\n可用变量说明：\n{taskName} - 自动合并任务名称\n{repositoryName} - 仓库名称\n{sourceBranch} - 源分支名称\n{targetBranch} - 目标分支名称\n{mergeTitle} - 合并标题\n{status} - 执行状态（成功/失败）\n{message} - 详细消息\n{mergeRequestId} - 合并请求ID\n{mergeRequestUrl} - 合并请求链接"
          value={config.custom_message_template ?? ""}
          onChange={(e) =>
            handleInputChange("custom_message_template", e.target.value)
          }
          helperText="留空将使用默认的卡片消息模板。自定义模板将替换默认的交互式卡片，发送纯文本消息。"
        />
      </Paper>

      {/* 测试确认对话框 */}
      <Dialog open={testDialogOpen} onClose={() => setTestDialogOpen(false)}>
        <DialogTitle>发送测试消息</DialogTitle>
        <DialogContent>
          <Typography>确定要向配置的飞书群发送一条测试消息吗？</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTestDialogOpen(false)}>取消</Button>
          <Button
            onClick={handleTest}
            variant="contained"
            disabled={loading.test}
          >
            {loading.test ? "发送中..." : "确定发送"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 删除确认对话框 */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
      >
        <DialogTitle>删除配置</DialogTitle>
        <DialogContent>
          <Typography>确定要删除飞书通知配置吗？此操作不可撤销。</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>取消</Button>
          <Button
            onClick={handleDelete}
            color="error"
            variant="contained"
            disabled={loading.delete}
          >
            {loading.delete ? "删除中..." : "确定删除"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
