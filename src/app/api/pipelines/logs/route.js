import { NextResponse } from 'next/server';
import { PipelineDB } from '../../../../../lib/pipeline.database';
import { getCommitDetails } from '../../../../../lib/pipeline.service';

function getToken(request) {
  return request.headers.get('x-yunxiao-token') || process.env.CODEUP_TOKEN;
}

async function enrichCommitMessages(logs, token) {
  if (!token) return logs;

  const tasks = await PipelineDB.getAllTasks();
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
    const { searchParams } = new URL(request.url);
    const page = Math.max(Number(searchParams.get('page')) || 1, 1);
    const pageSize = Math.min(Math.max(Number(searchParams.get('pageSize')) || 20, 1), 100);
    const taskId = searchParams.get('taskId');
    const offset = (page - 1) * pageSize;
    const [rawLogs, totalCount] = await Promise.all([
      PipelineDB.getLogs({ taskId, limit: pageSize, offset }),
      PipelineDB.getLogsCount(taskId),
    ]);
    const logs = await enrichCommitMessages(rawLogs, getToken(request));

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
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
