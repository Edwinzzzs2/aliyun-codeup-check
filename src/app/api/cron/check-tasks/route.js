import { NextResponse } from 'next/server';
import { AutoMergeScheduler } from '../../../../../lib/scheduler';

// 创建调度器实例
const scheduler = new AutoMergeScheduler();

function isAuthorized(request) {
  const cronSecret = process.env.CRON_SECRET;
  return Boolean(cronSecret)
    && request.headers.get('authorization') === `Bearer ${cronSecret}`;
}

export async function GET(request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ success: false, message: '未授权的 Cron 请求' }, { status: 401 });
  }
  try {
    console.log('Cron job triggered: checking auto-merge tasks');
    
    // 执行任务检查
    await scheduler.checkAndExecuteTasks();
    
    return NextResponse.json({ 
      success: true, 
      message: 'Auto-merge tasks checked successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Cron job error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      message: error.message 
    }, { status: 500 });
  }
}

// 支持POST请求（用于手动触发）
export async function POST(request) {
  return GET(request);
}
