"use client";

import { useEffect, useState } from 'react';
import { Chip } from '@mui/material';

export default function BuildTime() {
  const buildTime = process.env.BUILD_TIME;
  const [formattedTime, setFormattedTime] = useState('');

  useEffect(() => {
    if (!buildTime) return;
    const date = new Date(buildTime);
    // 构建配置在服务端和客户端可能于不同时间求值，挂载后再显示可避免首屏 hydration 不一致。
    setFormattedTime(date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      timeZone: 'Asia/Shanghai',
    }));
  }, [buildTime]);

  if (!formattedTime) return null;

  return (
    <Chip
      label={`最近更新: ${formattedTime}`}
      size="small"
      sx={{
        fontSize: '0.7rem',
        height: '24px',
        backgroundColor: 'rgba(0, 0, 0, 0.04)',
        color: 'rgba(0, 0, 0, 0.6)',
        '&:hover': {
          backgroundColor: 'rgba(0, 0, 0, 0.08)',
        },
      }}
    />
  );
}
