import { NextResponse } from 'next/server';
import { PipelineDB } from '../../../../../lib/pipeline.database';
import { getPipelineRun } from '../../../../../lib/pipeline.service';
import {
  getAuthorizationError,
  requireRepositoryRead,
} from '../../../../../lib/codeup.authorization';

const ACTIVE_RUN_STATUSES = new Set(['RUNNING', 'WAITING']);

function isActiveRun(run) {
  return ACTIVE_RUN_STATUSES.has(String(run?.status || '').toUpperCase());
}

function hasActiveSteps(run) {
  return Array.isArray(run?.steps) && run.steps.some((step) => (
    ACTIVE_RUN_STATUSES.has(String(step?.status || '').toUpperCase())
  ));
}

function needsHistoricalStepsBackfill(log, run) {
  if (!run || isActiveRun(run) || hasActiveSteps(run)) return false;
  // null 代表功能上线前的历史数据尚未补齐；空数组代表已经查询过但接口没有返回步骤。
  return Object.prototype.hasOwnProperty.call(log, 'pipeline_steps')
    && log.pipeline_steps === null;
}

function needsRunRefresh(log, run) {
  // 云效的总体状态可能先于阶段状态结束；有活动节点时继续同步，直到所有节点收敛。
  return isActiveRun(run) || hasActiveSteps(run) || needsHistoricalStepsBackfill(log, run);
}

function cachedRun(log) {
  if (!log?.pipeline_status) return null;
  return {
    pipelineRunId: String(log.pipeline_run_id),
    status: log.pipeline_status,
    startTime: log.pipeline_start_time,
    endTime: log.pipeline_end_time,
    durationSeconds: log.pipeline_duration_seconds,
    steps: Array.isArray(log.pipeline_steps) ? log.pipeline_steps : [],
  };
}

function runKey(organizationId, pipelineId, pipelineRunId) {
  return [organizationId, pipelineId, pipelineRunId].map(String).join(':');
}

export async function GET(request) {
  try {
    const scope = await requireRepositoryRead(request);
    const tasks = (await PipelineDB.getAllTasks()).filter((task) => (
      String(task.organization_id) === scope.organizationId
      && String(task.repository_id) === scope.repositoryId
    ));
    const logs = await PipelineDB.getLogsWithPipelineRuns(100, tasks.map((task) => task.id));
    const taskMap = new Map(tasks.map((task) => [String(task.id), task]));
    const targets = new Map();

    const addTarget = (task, pipelineId, pipelineRunId, logId = null) => {
      if (!task || !pipelineId || !pipelineRunId) return null;
      const key = runKey(task.organization_id, pipelineId, pipelineRunId);
      const target = targets.get(key) || {
        key,
        task: {
          ...task,
          pipeline_id: String(pipelineId),
          last_pipeline_run_id: String(pipelineRunId),
        },
        logIds: [],
      };
      if (logId != null) target.logIds.push(logId);
      targets.set(key, target);
      return key;
    };

    const logEntries = logs
      .filter((log) => log.pipeline_run_id)
      .map((log) => {
        const task = taskMap.get(String(log.task_id));
        const pipelineId = log.pipeline_id || task?.pipeline_id;
        const key = task && pipelineId
          ? runKey(task.organization_id, pipelineId, log.pipeline_run_id)
          : null;
        const run = cachedRun(log);
        if (needsRunRefresh(log, run)) {
          addTarget(task, pipelineId, log.pipeline_run_id, log.id);
        }
        return { log, task, pipelineId, key, run };
      });

    const taskEntries = tasks
      .filter((task) => task.last_pipeline_run_id)
      .map((task) => {
        const key = runKey(task.organization_id, task.pipeline_id, task.last_pipeline_run_id);
        const matchingLog = logEntries.find((entry) => entry.key === key);
        if (isActiveRun(matchingLog?.run)) {
          addTarget(task, task.pipeline_id, task.last_pipeline_run_id);
        }
        return { task, key, run: matchingLog?.run || null };
      });

    // 活动态及未收敛节点持续查询；完整终态落库后始终读取本地缓存。
    const targetList = [...targets.values()];
    const settledRuns = await Promise.allSettled(
      targetList.map((target) => getPipelineRun(target.task, scope.token))
    );
    const freshRuns = new Map();
    const runErrors = new Map();
    settledRuns.forEach((result, index) => {
      const target = targetList[index];
      if (result.status === 'fulfilled') freshRuns.set(target.key, result.value);
      else runErrors.set(target.key, result.reason?.message || '查询运行状态失败');
    });

    await Promise.all(targetList.flatMap((target) => {
      const run = freshRuns.get(target.key);
      return run ? target.logIds.map((logId) => PipelineDB.updateLogPipelineRun(logId, run)) : [];
    }));

    const taskRuns = taskEntries.map((entry) => ({
      taskId: entry.task.id,
      run: freshRuns.get(entry.key) || entry.run,
      error: runErrors.get(entry.key),
    }));
    const logRuns = logEntries.map((entry) => ({
      logId: entry.log.id,
      taskId: entry.log.task_id,
      pipelineId: entry.pipelineId,
      run: freshRuns.get(entry.key) || entry.run,
      error: runErrors.get(entry.key),
    }));

    return NextResponse.json({ success: true, data: { taskRuns, logRuns } });
  } catch (error) {
    console.error('[Pipeline Runs] 获取运行状态失败:', error);
    const authorizationError = getAuthorizationError(error);
    return NextResponse.json(
      { success: false, message: authorizationError?.message || error.message },
      { status: authorizationError?.status || 500 }
    );
  }
}
