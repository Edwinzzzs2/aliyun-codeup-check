# 阿里云 Codeup 分支检测工具

用于检测阿里云 Codeup 代码仓库分支合并状态的 Web 应用工具。

## 🚀 功能特性

- 🔍 **分支状态检测** - 实时检测代码仓库分支的合并状态
- 📊 **可视化界面** - 直观的 Web 界面展示检测结果
- 🎨 **现代化设计** - 基于 Material-UI 的美观界面
- 🌙 **主题切换** - 支持明暗主题切换
- 📱 **响应式设计** - 适配各种设备屏幕

## 🛠️ 技术栈

- **前端框架**: Next.js 15.4.6
- **UI 组件库**: Material-UI (MUI)
- **样式方案**: CSS Modules + Material-UI
- **构建工具**: Turbopack
- **部署**: PM2 + 1Panel

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

### 使用 PM2 部署

1. 构建项目
```bash
npm run build
```

2. 使用 PM2 启动
```bash
pm2 start ecosystem.config.js
```

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
│   └── app/
│       ├── api/              # API 路由
│       ├── globals.css       # 全局样式
│       ├── layout.js         # 根布局
│       ├── page.js           # 首页
│       └── theme-provider.js # 主题提供者
├── public/                   # 静态资源
├── package.json             # 项目配置
├── next.config.mjs          # Next.js 配置
└── ecosystem.config.js      # PM2 配置
```

## 🔧 配置说明

### 环境变量

创建 `.env.local` 文件并配置以下变量：

```env
# 阿里云 Codeup 相关配置
CODEUP_ACCESS_TOKEN=your_access_token
CODEUP_API_BASE_URL=https://codeup.aliyun.com/api/v4
```

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

- [Next.js](https://nextjs.org/)
- [Material-UI](https://mui.com/)
- [React](https://reactjs.org/)

---

⭐ 如果这个项目对你有帮助，请给它一个星标！
