# 阿里云 Codeup 自动化管理工具

一个功能完整的阿里云 Codeup 代码仓库管理工具，支持分支检测、自动合并、飞书通知等功能。

## 🚀 功能特性

- 🔍 **分支状态检测** - 实时检测代码仓库分支的合并状态和差异对比
- 🤖 **自动合并管理** - 创建和管理自动合并任务，支持定时执行
- 📊 **可视化界面** - 直观的 Web 界面展示检测结果和任务状态
- 🔔 **飞书通知** - 集成飞书机器人，支持任务状态通知
- 🕐 **定时任务** - 支持 Webhook 和 Cron 定时触发任务执行
- ⚡ **流水线监听** - 定时比较 Codeup 分支提交，发现新提交后通过 Token 自动触发云效 Flow
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
3. **自动化功能**: 定时任务（Cron Jobs）、Webhook 触发、Hobby 计划函数最长运行 60 秒

### Docker 部署

项目使用 Next.js standalone 输出和多阶段构建，最终容器以非 root 用户运行。

#### 使用 GHCR 镜像

```bash
# 拉取 main 分支的最新镜像
docker pull ghcr.io/edwinzzzs2/aliyun-codeup-check:latest

# 准备运行配置
cp .env.docker.example .env

# 启动并在后台运行
docker compose up -d
```

默认访问地址为 [http://localhost:3000](http://localhost:3000)。修改 `.env` 中的 `APP_PORT` 可以更换宿主机端口。

如果 GHCR 包尚未设为公开，需要先使用具有 `read:packages` 权限的 GitHub Token 登录：

```bash
echo "$GHCR_TOKEN" | docker login ghcr.io -u YOUR_GITHUB_USERNAME --password-stdin
```

#### 本地构建

```bash
docker build -t aliyun-codeup-check:local .

docker run --rm \
  --name aliyun-codeup-check \
  -p 3000:3000 \
  --env-file .env \
  aliyun-codeup-check:local
```

#### GitHub 自动发布

`.github/workflows/docker-publish.yml` 会自动构建 `linux/amd64` 和 `linux/arm64`：

- 推送到 `main`：发布 `latest`、`main` 和提交 SHA 标签。
- 推送 `v*` 标签：发布对应版本标签，例如 `v1.0.0`。
- Pull Request：只验证镜像构建，不推送。
- 手动运行：可在 GitHub Actions 页面通过 `workflow_dispatch` 触发。

工作流使用仓库自带的 `GITHUB_TOKEN` 写入 GHCR。首次发布后，可在 GitHub Packages 页面将镜像设为 Public。

发布版本示例：

```bash
git tag v1.0.0
git push origin v1.0.0
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
├── .github/workflows/        # GitHub Actions 工作流
├── Dockerfile                # 多阶段容器镜像构建
├── compose.yaml              # GHCR 镜像启动配置
├── .dockerignore             # Docker 构建上下文排除项
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

# 可选：Codeup 服务端请求代理，不配置则保持直连
CODEUP_PROXY_URL=http://你的阿里云公网IP:3000
# 可选：代理目标未加入 PROXY_AUTH_WHITELIST 时才需要配置
CODEUP_PROXY_TOKEN=与代理服务器PROXY_AUTH_TOKEN相同的密码

# Supabase数据库连接设置
NEXT_PUBLIC_SUPABASE_URL=你的数据库url
NEXT_PUBLIC_SUPABASE_ANON_KEY=你的数据库tokenKey
```

#### 配置说明

1. **CODEUP_TOKEN**: 阿里云 Codeup 的访问令牌
2. **CODEUP_ORG_ID**: 阿里云 Codeup 的组织ID
3. **NEXT_PUBLIC_SUPABASE_URL**: Supabase 项目URL
4. **NEXT_PUBLIC_SUPABASE_ANON_KEY**: Supabase 匿名访问密钥
5. **CODEUP_PROXY_URL**: 可选的 Codeup 请求代理地址，例如 `http://1.2.3.4:3000`
6. **CODEUP_PROXY_TOKEN**: 可选的代理鉴权密码；配置时必须与代理服务器的 `PROXY_AUTH_TOKEN` 完全一致。目标域名已加入代理的 `PROXY_AUTH_WHITELIST` 时可不配置

代理变量仅供服务端使用，不要添加 `NEXT_PUBLIC_` 前缀。Vercel 修改环境变量后需要重新部署。

流水线监听复用 `CODEUP_TOKEN`，令牌还需授予“流水线运行实例读写”权限。可配置 `CRON_SECRET` 保护 `/api/cron/check-pipelines`；任务创建时会记录当前提交作为基线，只有之后提交 ID 发生变化才自动触发。

已有数据库升级时，请先在 Supabase SQL Editor 执行仓库根目录的 `pipeline-schema.sql`；全新数据库仍可直接执行 `supabase-schema.sql`。

Vercel 部署通过 `vercel.json` 每分钟调用 Cron API；Docker/PM2 常驻部署设置 `ENABLE_INTERNAL_PIPELINE_SCHEDULER=true` 后，由服务进程内部每分钟扫描。不要在同一部署中同时启用两种调度方式。

本地开发也需要在 `.env.local` 配置 `ENABLE_INTERNAL_PIPELINE_SCHEDULER=true`，修改后重启开发服务；页面每 15 秒静默刷新任务和日志。

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

### 流水线管理 (/pipelines)
- 配置流水线 ID、Codeup 仓库 Git 地址、监听分支和检查间隔
- 支持手动检测变更与忽略变更判断的“立即运行”
- 查看最近提交、Flow 运行 ID、下次检查时间和触发日志

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

### 流水线 API
- `GET/POST/PUT/DELETE /api/pipelines/tasks` - 管理流水线监听任务
- `POST /api/pipelines/execute` - 手动检测或立即触发流水线
- `GET /api/pipelines/logs` - 查询监听与触发日志
- `GET /api/cron/check-pipelines` - 定时扫描到期任务

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
