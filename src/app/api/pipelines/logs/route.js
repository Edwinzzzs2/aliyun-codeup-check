import { NextResponse } from 'next/server';
import { PipelineDB } from '../../../../../lib/pipeline.database';
import { getCommitDetails } from '../../../../../lib/pipeline.service';
import {
  getAuthorizationError,
  requireRepositoryRead,
} from '../../../../../lib/codeup.authorization';

async function enrichCommitMessages(logs, token, tasks) {
  if (!token) return logs;

  const taskMap = new Map(tasks.map((task) => [String(task.id), task]));
  const groups = new Map();
  logs.filter((log) => log.commit_id && !log.commit_message).forEach((log) => {
    const task = taskMap.get(String(log.task_id));
    if (!task) return;
    const key = `${task.organization_id}:${task.repository_id}:${log.commit_id}`;
    const group = groups.get(key) || { task, commitId: log.commit_id, logs: [] };
    group.logs.push(log);
    groups.set(key, group);
  });

  // 同一提交可能对应多次检测日志，只查询一次 Codeup，并将标题缓存到所有关联日志。
  await Promise.allSettled([...groups.values()].map(async (group) => {
    const commit = await getCommitDetails(group.task, group.commitId, token);
    const commitMessage = commit?.title || commit?.message;
    if (!commitMessage) return;
    await Promise.all(group.logs.map(async (log) => {
      await PipelineDB.updateLogCommitMessage(log.id, commitMessage);
      log.commit_message = commitMessage;
    }));
  }));
  return logs;
}

export async function GET(request) {
  try {
    const scope = await requireRepositoryRead(request);
    const tasks = (await PipelineDB.getAllTasks()).filter((task) => (
      String(task.organization_id) === scope.organizationId
      && String(task.repository_id) === scope.repositoryId
    ));
    const taskIds = tasks.map((task) => task.id);
    const { searchParams } = new URL(request.url);
    const page = Math.max(Number(searchParams.get('page')) || 1, 1);
    const pageSize = Math.min(Math.max(Number(searchParams.get('pageSize')) || 20, 1), 100);
    const taskId = searchParams.get('taskId');
    if (taskId && !taskIds.some((id) => String(id) === String(taskId))) {
      return NextResponse.json({ success: false, message: '任务不存在或无权访问' }, { status: 404 });
    }
    const compact = searchParams.get('compact') === 'true';
    const search = searchParams.get('q') || '';
    const offset = (page - 1) * pageSize;
    const compactResult = compact
      ? await PipelineDB.getCompactLogs({ taskId, taskIds, limit: pageSize, offset, search })
      : null;
    const [rawLogs, totalCount] = compactResult
      ? [compactResult.logs, compactResult.totalCount]
      : await Promise.all([
        PipelineDB.getLogs({ taskId, taskIds, limit: pageSize, offset }),
        PipelineDB.getLogsCount(taskId, taskIds),
      ]);
    const logs = await enrichCommitMessages(rawLogs, scope.token, tasks);

    return NextResponse.json({
      success: true,
      data: logs,
      pagination: {
        page,
        pageSize,
        totalCount,
        totalPages: Math.ceil(totalCount / pageSize),
      },
    });
  } catch (error) {
    console.error('[Pipeline Logs] 获取日志失败:', error);
    const authorizationError = getAuthorizationError(error);
    return NextResponse.json(
      { success: false, message: authorizationError?.message || error.message },
      { status: authorizationError?.status || 500 }
    );
  }
}
