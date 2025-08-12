/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        // 匹配所有 API 路由
        source: "/api/:path*",
        headers: [
          {
            key: "Access-Control-Allow-Origin",
            value: "*", // 允许所有域名，生产环境建议设置具体域名
          },
          {
            key: "Access-Control-Allow-Methods",
            value: "GET, POST, PUT, DELETE, OPTIONS",
          },
          {
            key: "Access-Control-Allow-Headers",
            value: "Content-Type, Authorization, x-yunxiao-token",
          },
          {
            key: "Access-Control-Max-Age",
            value: "86400",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
