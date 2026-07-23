import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "./theme-provider";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v15-appRouter";
import { LayoutProvider } from './layout-provider';
import PwaRegister from "./pwa-register";

// 在服务端启动时初始化自动合并调度器
// if (typeof window === 'undefined') {
//   try {
//     require('../../lib/scheduler');
//   } catch (error) {
//     console.error('自动合并调度器加载失败:', error);
//   }
// }

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "阿里云 Codeup 分支检测工具",
  description: "阿里云 Codeup 分支合并状态检测工具",
  applicationName: "CodeUp 工具",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "CodeUp",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/pwa-icon.svg', sizes: 'any', type: 'image/svg+xml' }
    ],
    shortcut: '/favicon.svg',
    apple: '/apple-touch-icon.png',
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#1565c0",
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-CN">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <AppRouterCacheProvider>
          <ThemeProvider>
            <LayoutProvider>
              {children}
            </LayoutProvider>
            <PwaRegister />
          </ThemeProvider>
        </AppRouterCacheProvider>
      </body>
    </html>
  );
}
