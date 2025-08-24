'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Play, CheckCircle, XCircle } from 'lucide-react';

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
    <div className="container mx-auto p-6 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Play className="h-5 w-5" />
            Webhook 测试
          </CardTitle>
          <CardDescription>
            手动触发自动合并任务检查，用于测试 Webhook 功能
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="secret">Webhook 密钥（可选）</Label>
            <Input
              id="secret"
              type="password"
              placeholder="如果设置了 WEBHOOK_SECRET 环境变量，请输入密钥"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
            />
          </div>

          <Button 
            onClick={triggerWebhook} 
            disabled={loading}
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                执行中...
              </>
            ) : (
              <>
                <Play className="mr-2 h-4 w-4" />
                触发任务检查
              </>
            )}
          </Button>

          {result && (
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                <div className="font-medium mb-2">{result.message}</div>
                <div className="text-sm space-y-1">
                  <div>执行时间: {new Date(result.timestamp).toLocaleString('zh-CN')}</div>
                  {result.data && (
                    <div>
                      执行结果: {JSON.stringify(result.data, null, 2)}
                    </div>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}

          {error && (
            <Alert className="border-red-200 bg-red-50">
              <XCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800">
                <div className="font-medium">执行失败</div>
                <div className="text-sm mt-1">{error}</div>
              </AlertDescription>
            </Alert>
          )}

          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <h3 className="font-medium mb-2">使用说明</h3>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• 此页面用于测试 Webhook 功能是否正常工作</li>
              <li>• 如果设置了 WEBHOOK_SECRET 环境变量，需要输入正确的密钥</li>
              <li>• 执行成功后会显示任务检查结果</li>
              <li>• 可以在应用日志中查看详细的执行信息</li>
            </ul>
          </div>

          <div className="mt-4 p-4 bg-blue-50 rounded-lg">
            <h3 className="font-medium mb-2 text-blue-800">Webhook URL</h3>
            <code className="text-sm bg-white p-2 rounded border block text-blue-600">
              {typeof window !== 'undefined' ? window.location.origin : ''}/api/webhook/check-tasks
            </code>
            <p className="text-sm text-blue-600 mt-2">
              外部服务可以通过 POST 或 GET 请求调用此 URL 来触发任务检查
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}