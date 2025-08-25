'use client';

import { useState } from 'react';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  Button, 
  TextField, 
  Typography, 
  Alert, 
  CircularProgress, 
  Box,
  Paper
} from '@mui/material';
import { PlayArrow, CheckCircle, Error } from '@mui/icons-material';

export default function WebhookTestPage() {
  const [secret, setSecret] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const triggerWebhook = async () => {
    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const response = await fetch('/api/webhook/check-tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ secret }),
      });

      const data = await response.json();

      if (response.ok) {
        setResult(data);
      } else {
        setError(data.message || '请求失败');
      }
    } catch (err) {
      setError('网络错误: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', p: 3 }}>
      <Card>
        <CardHeader>
          <Typography variant="h5" component="h1" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <PlayArrow />
            Webhook 测试
          </Typography>
          <Typography variant="body2" color="text.secondary">
            手动触发自动合并任务检查，用于测试 Webhook 功能
          </Typography>
        </CardHeader>
        <CardContent>
          <Box sx={{ mb: 3 }}>
            <Typography variant="body2" sx={{ mb: 1 }}>Webhook 密钥（可选）</Typography>
            <TextField
              fullWidth
              type="password"
              placeholder="如果设置了 WEBHOOK_SECRET 环境变量，请输入密钥"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              size="small"
            />
          </Box>

          <Button 
            onClick={triggerWebhook} 
            disabled={loading}
            variant="contained"
            fullWidth
            startIcon={loading ? <CircularProgress size={16} /> : <PlayArrow />}
            sx={{ mb: 3 }}
          >
            {loading ? '执行中...' : '触发任务检查'}
          </Button>

          {result && (
            <Alert severity="success" sx={{ mb: 2 }}>
              <Typography variant="body2" sx={{ fontWeight: 'medium', mb: 1 }}>
                {result.message}
              </Typography>
              <Typography variant="caption" component="div">
                <div>执行时间: {new Date(result.timestamp).toLocaleString('zh-CN')}</div>
                {result.data && (
                  <div style={{ marginTop: 4 }}>
                    执行结果: {JSON.stringify(result.data, null, 2)}
                  </div>
                )}
              </Typography>
            </Alert>
          )}

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                执行失败
              </Typography>
              <Typography variant="caption" sx={{ mt: 0.5 }}>
                {error}
              </Typography>
            </Alert>
          )}

          <Paper sx={{ p: 2, mt: 3, bgcolor: 'grey.50' }}>
            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'medium' }}>
              使用说明
            </Typography>
            <Box component="ul" sx={{ m: 0, pl: 2, '& li': { mb: 0.5 } }}>
              <li>• 此页面用于测试 Webhook 功能是否正常工作</li>
              <li>• 如果设置了 WEBHOOK_SECRET 环境变量，需要输入正确的密钥</li>
              <li>• 执行成功后会显示任务检查结果</li>
              <li>• 可以在应用日志中查看详细的执行信息</li>
            </Box>
          </Paper>

          <Paper sx={{ p: 2, mt: 2, bgcolor: 'primary.50' }}>
            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'medium', color: 'primary.main' }}>
              Webhook URL
            </Typography>
            <Box 
              component="code" 
              sx={{ 
                display: 'block',
                p: 1, 
                bgcolor: 'white', 
                border: 1, 
                borderColor: 'divider',
                borderRadius: 1,
                fontSize: '0.875rem',
                color: 'primary.main',
                fontFamily: 'monospace'
              }}
            >
              {typeof window !== 'undefined' ? window.location.origin : ''}/api/webhook/check-tasks
            </Box>
            <Typography variant="caption" sx={{ mt: 1, display: 'block', color: 'primary.main' }}>
              外部服务可以通过 POST 或 GET 请求调用此 URL 来触发任务检查
            </Typography>
          </Paper>
        </CardContent>
      </Card>
    </Box>
  );
}