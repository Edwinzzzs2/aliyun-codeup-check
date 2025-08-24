# Webhook 触发方案

由于 Vercel 免费版的 Cron Jobs 限制（每天只能执行一次），我们提供了 Webhook 方案来实现更频繁的任务检查。

## Webhook 端点

- **URL**: `https://your-domain.vercel.app/api/webhook/check-tasks`
- **方法**: `POST` 或 `GET`
- **功能**: 触发自动合并任务检查和执行

## 安全配置（可选）

在 Vercel 环境变量中设置 `WEBHOOK_SECRET`：

```bash
WEBHOOK_SECRET=your-secret-key-here
```

## 使用方式

### 1. POST 请求（推荐）

```bash
curl -X POST https://your-domain.vercel.app/api/webhook/check-tasks \
  -H "Content-Type: application/json" \
  -d '{"secret": "your-secret-key-here"}'
```

### 2. GET 请求（简单测试）

```bash
curl "https://your-domain.vercel.app/api/webhook/check-tasks?secret=your-secret-key-here"
```

## 外部触发方案

### 方案一：GitHub Actions（推荐）

创建 `.github/workflows/trigger-webhook.yml`：

```yaml
name: Trigger Auto Merge Check

on:
  schedule:
    # 每小时执行一次
    - cron: '0 * * * *'
  workflow_dispatch: # 允许手动触发

jobs:
  trigger:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Webhook
        run: |
          curl -X POST ${{ secrets.WEBHOOK_URL }} \
            -H "Content-Type: application/json" \
            -d '{"secret": "${{ secrets.WEBHOOK_SECRET }}"}'
```

在 GitHub 仓库的 Settings > Secrets 中添加：
- `WEBHOOK_URL`: `https://your-domain.vercel.app/api/webhook/check-tasks`
- `WEBHOOK_SECRET`: 你的密钥

### 方案二：免费 Cron 服务

使用 [cron-job.org](https://cron-job.org) 等免费服务：

1. 注册账号
2. 创建新的 Cron Job
3. 设置 URL: `https://your-domain.vercel.app/api/webhook/check-tasks?secret=your-secret`
4. 设置执行频率（如每小时）

### 方案三：UptimeRobot 监控

使用 [UptimeRobot](https://uptimerobot.com) 的监控功能：

1. 创建 HTTP(s) 监控
2. URL: `https://your-domain.vercel.app/api/webhook/check-tasks?secret=your-secret`
3. 监控间隔设置为 5-60 分钟
4. 这样既能监控网站可用性，又能定期触发任务

### 方案四：Zapier/IFTTT 自动化

使用 Zapier 或 IFTTT 创建定时触发：

1. 创建定时触发器（Schedule）
2. 添加 Webhook 动作
3. 设置 POST 请求到你的端点

### 方案五：其他服务器定时任务

如果你有其他服务器，可以设置 crontab：

```bash
# 每小时执行一次
0 * * * * curl -X POST https://your-domain.vercel.app/api/webhook/check-tasks -H "Content-Type: application/json" -d '{"secret": "your-secret"}'
```

## 响应格式

成功响应：
```json
{
  "success": true,
  "message": "任务检查完成",
  "data": {
    "executedTasks": 2,
    "totalTasks": 5
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

错误响应：
```json
{
  "success": false,
  "message": "无效的webhook密钥",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## 监控和日志

- 所有 Webhook 调用都会在 Vercel 函数日志中记录
- 可以在应用的日志页面查看执行结果
- 建议设置适当的调用频率，避免过于频繁

## 注意事项

1. **频率控制**: 建议不要超过每分钟一次，避免资源浪费
2. **安全性**: 务必设置 `WEBHOOK_SECRET` 防止恶意调用
3. **监控**: 定期检查 Webhook 是否正常工作
4. **备份方案**: 保留 Vercel Cron（每天一次）作为备份

## 推荐配置

- **开发/测试**: 使用 GET 请求手动触发
- **生产环境**: 使用 GitHub Actions 或 cron-job.org
- **高可用**: 结合多种方案，确保任务不会遗漏

这样就可以绕过 Vercel 免费版的限制，实现更灵活的任务调度！