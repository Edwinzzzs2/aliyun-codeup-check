# ===== 构建阶段 =====
FROM node:20-slim AS builder

WORKDIR /app

# 安装 Playwright 浏览器依赖
RUN apt-get update && apt-get install -y \
    libnspr4 \
    libnss3 \
    libdbus-1-3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libxkbcommon0 \
    libatspi2.0-0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    curl \
    unzip \
    && rm -rf /var/lib/apt/lists/*

# 拷贝依赖文件并安装
COPY package.json package-lock.json* yarn.lock* ./
RUN npm install

# 拷贝代码
COPY . .

# 安装 Chromium（Linux 版本）
RUN npx playwright install chromium

# 构建 Next.js
RUN npm run build

# ===== 运行阶段 =====
FROM node:20-slim

WORKDIR /app

# 安装运行时依赖（Playwright 运行库）
RUN apt-get update && apt-get install -y \
    libnspr4 \
    libnss3 \
    libdbus-1-3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libxkbcommon0 \
    libatspi2.0-0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    curl \
    unzip \
    && rm -rf /var/lib/apt/lists/*

# 从构建阶段复制文件
COPY --from=builder /app /app

# 暴露端口
EXPOSE 3000

# 启动 Next.js
CMD ["npm", "start"]
