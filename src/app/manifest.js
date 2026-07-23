export default function manifest() {
  return {
    name: "阿里云 CodeUp 工具",
    short_name: "CodeUp",
    description: "移动端友好的 CodeUp 分支检测与代码合并工具",
    id: "/check",
    start_url: "/check",
    scope: "/",
    display: "standalone",
    background_color: "#f5f7fb",
    theme_color: "#1565c0",
    orientation: "any",
    lang: "zh-CN",
    categories: ["developer", "productivity", "utilities"],
    icons: [
      {
        src: "/pwa-icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/pwa-icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/pwa-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "合并状态",
        short_name: "状态",
        url: "/check",
        icons: [{ src: "/pwa-icon-192.png", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "代码合并",
        short_name: "合并",
        url: "/merge",
        icons: [{ src: "/pwa-icon-192.png", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "执行日志",
        short_name: "日志",
        url: "/logs",
        icons: [{ src: "/pwa-icon-192.png", sizes: "192x192", type: "image/png" }],
      },
    ],
  };
}
