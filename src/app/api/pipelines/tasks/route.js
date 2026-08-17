import { NextResponse } from 'next/server';
import { PipelineDB } from '../../../../../lib/pipeline.database';
import { getBranchHead } from '../../../../../lib/pipeline.service';
import {
  getAuthorizationError,
  requireRepositoryRead,
} from '../../../../../lib/codeup.authorization';

const REQUIRED_FIELDS = [
  'name',
  'pipeline_id',
  'organization_id',
  'repository_id',
  'repository_url',
  'branch_name',
  'interval_minutes',
];

function validateTask(task) {
  const missing = REQUIRED_FIELDS.filter((field) => !task[field]);
  if (missing.length) return `缺少必要参数：${missing.join('、')}`;
  if (!Number.isFinite(Number(task.interval_minutes)) || Number(task.interval_minutes) < 1) {
    return '监听间隔必须大于等于 1 分钟';
  }
  if (task.weekday_interval_minutes != null
    && (!Number.isFinite(Number(task.weekday_interval_minutes))
      || Number(task.weekday_interval_minutes) < 1)) {
    return '工作日监听间隔必须大于等于 1 分钟';
  }
  if (task.weekend_interval_minutes != null
    && (!Number.isFinite(Number(task.weekend_interval_minutes))
      || Number(task.weekend_interval_minutes) < 1)) {
    return '周末监听间隔必须大于等于 1 分钟';
  }
  if (!/^https:\/\/codeup\.aliyun\.com\//i.test(task.repository_url)) {
    return '仓库 Git 地址必须是 https://codeup.aliyun.com/ 下的地址';
  }
  return null;
}

function sameRepository(task, organizationId, repositoryId) {
  return String(task.organization_id) === String(organizationId)
    && String(task.repository_id) === String(repositoryId);
}

export async function GET(request) {
  try {
    const scope = await requireRepositoryRead(request);
    const tasks = (await PipelineDB.getAllTasks())
      .filter((task) => sameRepository(task, scope.organizationId, scope.repositoryId));
    return NextResponse.json({ success: true, data: tasks });
  } catch (error) {
    console.error('[Pipeline Tasks] 获取任务失败:', error);
    const authorizationError = getAuthorizationError(error);
    return NextResponse.json(
      { success: false, message: authorizationError?.message || error.message },
      { status: authorizationError?.status || 500 }
    );
  }
}

export async function POST(request) {
  try {
    const task = await request.json();
    const validationMessage = validateTask(task);
    if (validationMessage) {
      return NextResponse.json({ success: false, message: validationMessage }, { status: 400 });
    }

    const { token } = await requireRepositoryRead(request, task);

    // 创建任务时读取一次真实 HEAD 作为基线，避免首次 Cron 误触发历史代码。
    const { commitId, commitMessage } = await getBranchHead(task, token);
    const created = await PipelineDB.createTask({
      ...task,
      interval_minutes: Number(task.interval_minutes),
      weekday_interval_minutes: task.weekday_interval_minutes == null
        ? null
        : Number(task.weekday_interval_minutes),
      weekend_interval_minutes: task.weekend_interval_minutes == null
        ? null
        : Number(task.weekend_interval_minutes),
      last_commit_id: commitId,
      extra_envs: task.extra_envs || {},
    });
    await PipelineDB.logExecution({
      taskId: created.id,
      taskName: created.name,
      status: 'ready',
      message: `已记录 ${created.branch_name} 分支基线 ${commitId.slice(0, 8)}`,
      commitId,
      commitMessage,
      pipelineId: created.pipeline_id,
      triggerType: 'setup',
    });

    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (error) {
    console.error('[Pipeline Tasks] 创建任务失败:', error);
    const authorizationError = getAuthorizationError(error);
    return NextResponse.json(
      { success: false, message: authorizationError?.message || error.message },
      { status: authorizationError?.status || 500 }
    );
  }
}

export async function PUT(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ success: false, message: '缺少任务 ID' }, { status: 400 });
    }

    const current = await PipelineDB.getTaskById(id);
    if (!current) {
      return NextResponse.json({ success: false, message: '任务不存在' }, { status: 404 });
    }
    const { token } = await requireRepositoryRead(request, current);

    const updates = await request.json();
    const nextTask = { ...current, ...updates };
    const validationMessage = validateTask(nextTask);
    if (validationMessage) {
      return NextResponse.json({ success: false, message: validationMessage }, { status: 400 });
    }

    const sourceChanged = ['organization_id', 'repository_id', 'branch_name']
      .some((field) => updates[field] !== undefined && updates[field] !== current[field]);
    if (sourceChanged) {
      await requireRepositoryRead(request, nextTask);
      const { commitId } = await getBranchHead(nextTask, token);
      updates.last_commit_id = commitId;
    }

    const updated = await PipelineDB.updateTask(id, {
      ...updates,
      interval_minutes: updates.interval_minutes === undefined
        ? undefined
        : Number(updates.interval_minutes),
      weekday_interval_minutes: updates.weekday_interval_minutes === undefined
        ? undefined
        : updates.weekday_interval_minutes == null
          ? null
          : Number(updates.weekday_interval_minutes),
      weekend_interval_minutes: updates.weekend_interval_minutes === undefined
        ? undefined
        : updates.weekend_interval_minutes == null
          ? null
          : Number(updates.weekend_interval_minutes),
    });
    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error('[Pipeline Tasks] 更新任务失败:', error);
    const authorizationError = getAuthorizationError(error);
    return NextResponse.json(
      { success: false, message: authorizationError?.message || error.message },
      { status: authorizationError?.status || 500 }
    );
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ success: false, message: '缺少任务 ID' }, { status: 400 });
    }
    const current = await PipelineDB.getTaskById(id);
    if (!current) {
      return NextResponse.json({ success: false, message: '任务不存在' }, { status: 404 });
    }
    await requireRepositoryRead(request, current);
    await PipelineDB.deleteTask(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Pipeline Tasks] 删除任务失败:', error);
    const authorizationError = getAuthorizationError(error);
    return NextResponse.json(
      { success: false, message: authorizationError?.message || error.message },
      { status: authorizationError?.status || 500 }
    );
  }
}
