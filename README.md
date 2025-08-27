# 阿里云 Codeup 自动化管理工具

一个功能完整的阿里云 Codeup 代码仓库管理工具，支持分支检测、自动合并、飞书通知等功能。

## 🚀 功能特性

- 🔍 **分支状态检测** - 实时检测代码仓库分支的合并状态和差异对比
- 🤖 **自动合并管理** - 创建和管理自动合并任务，支持定时执行
- 📊 **可视化界面** - 直观的 Web 界面展示检测结果和任务状态
- 🔔 **飞书通知** - 集成飞书机器人，支持任务状态通知
- 🕐 **定时任务** - 支持 Webhook 和 Cron 定时触发任务执行
- 🎨 **现代化设计** - 基于 Material-UI 的美观界面
- 🌙 **主题切换** - 支持明暗主题切换
- 📱 **响应式设计** - 适配各种设备屏幕

## 🛠️ 技术栈

- **前端框架**: Next.js 15.4.6
- **UI 组件库**: Material-UI (MUI) v7.3.1
- **数据库**: Supabase
- **定时任务**: node-cron
- **时间处理**: Moment.js
- **样式方案**: CSS Modules + Material-UI
- **构建工具**: Turbopack
- **部署**: Vercel

## 📦 快速开始

### 环境要求

- Node.js >= 18.0.0
- npm 或 yarn 或 pnpm

### 安装依赖

```bash
npm install
# 或
yarn install
# 或
pnpm install
```

### 开发模式

```bash
npm run build
npm run dev
# 或
yarn build
yarn dev
# 或
pnpm build
pnpm dev
```

访问 [http://localhost:3000](http://localhost:3000) 查看应用。

### 生产构建

```bash
npm run build
npm start
```

## 🚀 部署

### Vercel 自动部署（推荐）

项目已配置 Vercel 自动构建和部署：

1. **GitHub 集成**: 推送到 `main` 分支自动构建，支持预览部署和自动生成URL
2. **环境变量**: 在 Vercel Dashboard 配置 `CODEUP_TOKEN`、`CODEUP_ORG_ID`、`NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. **自动化功能**: 定时任务（Cron Jobs）、Webhook 触发、函数超时配置（5分钟）

### Docker 部署

```bash
# 构建镜像
docker build -t aliyun-codeup-check .

# 运行容器
docker run -p 3000:3000 aliyun-codeup-check
```

## 📁 项目结构

```
aliyun-codeup-check/
├── src/
│   ├── app/
│   │   ├── api/              # API 路由
│   │   │   ├── automerge/    # 自动合并相关API
│   │   │   ├── codeup/       # Codeup API封装
│   │   │   ├── cron/         # 定时任务API
│   │   │   ├── feishu/       # 飞书通知API
│   │   │   └── webhook/      # Webhook API
│   │   ├── automerge/        # 自动合并管理页面
│   │   ├── check/            # 分支检测页面
│   │   ├── feishu/           # 飞书配置页面
│   │   ├── merge/            # 合并请求页面
│   │   ├── webhook-test/     # Webhook测试页面
│   │   ├── globals.css       # 全局样式
│   │   ├── layout.js         # 根布局
│   │   └── theme-provider.js # 主题提供者
│   ├── components/           # 可复用组件
│   └── contexts/             # React Context
├── lib/                      # 工具库
│   ├── database.supabase.js  # 数据库操作
│   ├── scheduler.js          # 任务调度器
│   └── supabase.js           # Supabase客户端
├── public/                   # 静态资源
├── .env.local.example        # 环境变量示例
├── package.json             # 项目配置
├── next.config.mjs          # Next.js 配置
├── ecosystem.config.js      # PM2 配置
├── vercel.json              # Vercel 配置
└── supabase-schema.sql      # 数据库结构
```

## 🔧 配置说明

### 环境变量

复制 `.env.local.example` 为 `.env.local` 文件并配置以下变量：

```env
# 代码仓库token
CODEUP_TOKEN=你的token

# 代码组织id
CODEUP_ORG_ID=你的组织id

# Supabase数据库连接设置
NEXT_PUBLIC_SUPABASE_URL=你的数据库url
NEXT_PUBLIC_SUPABASE_ANON_KEY=你的数据库tokenKey
```

#### 配置说明

1. **CODEUP_TOKEN**: 阿里云 Codeup 的访问令牌
2. **CODEUP_ORG_ID**: 阿里云 Codeup 的组织ID
3. **NEXT_PUBLIC_SUPABASE_URL**: Supabase 项目URL
4. **NEXT_PUBLIC_SUPABASE_ANON_KEY**: Supabase 匿名访问密钥

## 📖 功能使用说明

### 分支检测 (/check)
- 选择代码仓库和目标分支
- 查看所有分支与目标分支的合并状态
- 支持分支搜索和分页
- 实时显示分支差异和提交信息

### 自动合并管理 (/automerge)
- 创建和管理自动合并任务
- 设置源分支和目标分支
- 查看任务执行历史和日志
- 支持手动触发和定时执行

### 合并请求 (/merge)
- 创建合并请求
- 查看分支差异对比
- 管理合并请求状态

### 飞书通知 (/feishu)
- 配置飞书机器人
- 设置通知规则
- 测试通知功能

### Webhook测试 (/webhook-test)
- 测试Webhook触发
- 验证定时任务执行

## 🔌 API 文档

### Codeup API
- `GET /api/codeup/repositories` - 获取仓库列表
- `GET /api/codeup/branches` - 获取分支列表
- `POST /api/codeup/compare` - 分支差异对比
- `POST /api/codeup/merge` - 创建合并请求
- `GET /api/codeup/merge-status` - 获取合并状态

### 自动合并 API
- `GET /api/automerge/tasks` - 获取自动合并任务
- `POST /api/automerge/tasks` - 创建自动合并任务
- `POST /api/automerge/execute` - 执行自动合并
- `GET /api/automerge/logs` - 获取执行日志

### 飞书通知 API
- `GET /api/feishu/config` - 获取飞书配置
- `POST /api/feishu/config` - 保存飞书配置
- `POST /api/feishu/notify` - 发送飞书通知

### Webhook API
- `POST /api/webhook/check-tasks` - Webhook触发任务检查
- `GET /api/cron/check-tasks` - 定时任务触发

### PM2 配置

项目包含 `ecosystem.config.js` 配置文件，支持：
- 自动重启
- 日志管理
- 集群模式
- 环境变量配置

## 🤝 贡献指南

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 🙏 致谢

感谢以下开源项目：

- [Next.js](https://nextjs.org/) - React 全栈框架
- [Material-UI](https://mui.com/) - React UI 组件库
- [React](https://reactjs.org/) - 用户界面库
- [Supabase](https://supabase.com/) - 开源 Firebase 替代方案
- [Moment.js](https://momentjs.com/) - 时间处理库
- [node-cron](https://github.com/node-cron/node-cron) - Node.js 定时任务

---

⭐ 如果这个项目对你有帮助，请给它一个星标！
