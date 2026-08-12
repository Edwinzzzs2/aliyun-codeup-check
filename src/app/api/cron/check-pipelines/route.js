import { NextResponse } from 'next/server';
import { PipelineScheduler } from '../../../../../lib/pipeline.scheduler';

const scheduler = new PipelineScheduler();

function isAuthorized(request) {
  const cronSecret = process.env.CRON_SECRET;
  // 缺少密钥时保持关闭，避免错误部署后 Cron 接口自动降级为匿名可调用。
  return Boolean(cronSecret)
    && request.headers.get('authorization') === `Bearer ${cronSecret}`;
}

export async function GET(request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ success: false, message: '未授权的 Cron 请求' }, { status: 401 });
  }

  try {
    const results = await scheduler.checkAndExecuteTasks();
    return NextResponse.json({
      success: true,
      checkedAt: new Date().toISOString(),
      taskCount: results.length,
      results,
    });
  } catch (error) {
    console.error('[Pipeline Cron] 检查失败:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  return GET(request);
}
