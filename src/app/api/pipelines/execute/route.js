import { NextResponse } from 'next/server';
import { PipelineDB } from '../../../../../lib/pipeline.database';
import { executePipelineTask } from '../../../../../lib/pipeline.service';

export async function POST(request) {
  try {
    const { taskId, force = false } = await request.json();
    if (!taskId) {
      return NextResponse.json({ success: false, message: '缺少任务 ID' }, { status: 400 });
    }

    const task = await PipelineDB.getTaskById(taskId);
    if (!task) {
      return NextResponse.json({ success: false, message: '任务不存在' }, { status: 404 });
    }

    const token = request.headers.get('x-yunxiao-token') || process.env.CODEUP_TOKEN;
    if (!token) {
      return NextResponse.json({ success: false, message: '请先配置云效 Token' }, { status: 400 });
    }

    const result = await executePipelineTask(task, {
      token,
      forceTrigger: force === true,
      triggerType: force === true ? 'manual' : 'manual_check',
    });
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('[Pipeline Execute] 执行失败:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
