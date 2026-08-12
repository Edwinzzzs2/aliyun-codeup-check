import { NextResponse } from 'next/server';
import { AutoMergeScheduler } from '../../../../../lib/scheduler';

// Webhook端点，用于外部触发任务检查
export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { secret } = body;
    
    const expectedSecret = process.env.WEBHOOK_SECRET;
    // Webhook 未配置密钥时直接关闭，防止部署疏漏变成匿名任务触发入口。
    if (!expectedSecret) {
      return NextResponse.json(
        { success: false, message: 'Webhook 未启用' },
        { status: 503 }
      );
    }
    if (secret !== expectedSecret) {
      return NextResponse.json(
        { success: false, message: '无效的webhook密钥' },
        { status: 401 }
      );
    }

    console.log('Webhook触发任务检查:', new Date().toISOString());
    
    const scheduler = new AutoMergeScheduler();
    const result = await scheduler.checkAndExecuteTasks();
    
    return NextResponse.json({
      success: true,
      message: '任务检查完成',
      data: result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Webhook执行错误:', error);
    return NextResponse.json(
      {
        success: false,
        message: '服务器内部错误',
        error: error.message
      },
      { status: 500 }
    );
  }
}

// 支持GET请求，方便测试
export async function GET(request) {
  try {
    // 从查询参数获取secret
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get('secret');
    
    const expectedSecret = process.env.WEBHOOK_SECRET;
    if (!expectedSecret) {
      return NextResponse.json(
        { success: false, message: 'Webhook 未启用' },
        { status: 503 }
      );
    }
    if (secret !== expectedSecret) {
      return NextResponse.json(
        { success: false, message: '无效的webhook密钥' },
        { status: 401 }
      );
    }

    console.log('GET请求触发任务检查:', new Date().toISOString());
    
    const scheduler = new AutoMergeScheduler();
    const result = await scheduler.checkAndExecuteTasks();
    
    return NextResponse.json({
      success: true,
      message: '任务检查完成',
      data: result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('GET请求执行错误:', error);
    return NextResponse.json(
      {
        success: false,
        message: '服务器内部错误',
        error: error.message
      },
      { status: 500 }
    );
  }
}
