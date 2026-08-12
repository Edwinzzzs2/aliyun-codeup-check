import { NextResponse } from 'next/server';
import { PipelineDB } from '../../../../../lib/pipeline.database';
import { executePipelineTask } from '../../../../../lib/pipeline.service';
import {
  getAuthorizationError,
  requireRepositoryRead,
} from '../../../../../lib/codeup.authorization';

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

    // 手动操作只接受浏览器显式传入的 Token，服务端 Token 仅供后台调度器使用。
    const { token } = await requireRepositoryRead(request, task);

    const result = await executePipelineTask(task, {
      token,
      forceTrigger: force === true,
      triggerType: force === true ? 'manual' : 'manual_check',
    });
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('[Pipeline Execute] 执行失败:', error);
    const authorizationError = getAuthorizationError(error);
    return NextResponse.json(
      { success: false, message: authorizationError?.message || error.message },
      { status: authorizationError?.status || 500 }
    );
  }
}
