'use strict';

const { PipelineDB } = require('./pipeline.database');

const DEFAULT_OPENAPI_BASE_URL = 'https://openapi-rdc.aliyuncs.com';
const activeTaskIds = globalThis.__pipelineActiveTaskIds || new Set();
globalThis.__pipelineActiveTaskIds = activeTaskIds;

function getOpenApiBaseUrl() {
  return (process.env.YUNXIAO_OPENAPI_BASE_URL || DEFAULT_OPENAPI_BASE_URL)
    .trim()
    .replace(/\/+$/, '');
}

async function fetchYunxiao(url, options) {
  const proxyUrl = process.env.CODEUP_PROXY_URL?.trim().replace(/\/+$/, '');
  if (!proxyUrl) return fetch(url, options);

  const headers = new Headers(options.headers);
  const proxyToken = process.env.CODEUP_PROXY_TOKEN?.trim();
  if (proxyToken) headers.set('X-Proxy-Token', proxyToken);

  return fetch(`${proxyUrl}/${url}`, { ...options, headers });
}

async function readJsonResponse(response, actionName) {
  const responseText = await response.text();
  let data;
  try {
    data = responseText ? JSON.parse(responseText) : null;
  } catch {
    throw new Error(`${actionName}返回了非 JSON 数据（HTTP ${response.status}）`);
  }

  if (!response.ok) {
    const reason = data?.errorMessage
      || data?.errorDescription
      || data?.message
      || JSON.stringify(data)
      || '未知错误';
    throw new Error(`${actionName}失败（HTTP ${response.status}）：${reason}`);
  }
  return data;
}

function extractCommitId(branchData) {
  const data = branchData?.result || branchData;
  const commit = data?.commit || data?.target || data;
  return commit?.id
    || commit?.sha
    || commit?.commitId
    || data?.commitId
    || data?.commitSha
    || null;
}

function extractCommitMessage(branchData) {
  const data = branchData?.result || branchData;
  const commit = data?.commit || data?.target || data;
  return commit?.message
    || commit?.title
    || commit?.subject
    || data?.commitMessage
    || data?.message
    || null;
}

async function getCommitDetails(task, commitId, token) {
  const url = `${getOpenApiBaseUrl()}/oapi/v1/codeup/organizations/${encodeURIComponent(task.organization_id)}/repositories/${encodeURIComponent(task.repository_id)}/commits/${encodeURIComponent(commitId)}`;
  const response = await fetchYunxiao(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'x-yunxiao-token': token,
    },
  });
  return readJsonResponse(response, '查询提交信息');
}

async function getRepository(task, token) {
  const url = `${getOpenApiBaseUrl()}/oapi/v1/codeup/organizations/${encodeURIComponent(task.organization_id)}/repositories/${encodeURIComponent(task.repository_id)}`;
  const response = await fetchYunxiao(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'x-yunxiao-token': token,
    },
  });
  return readJsonResponse(response, '校验代码库读取权限');
}

async function getBranchHead(task, token) {
  const url = `${getOpenApiBaseUrl()}/oapi/v1/codeup/organizations/${encodeURIComponent(task.organization_id)}/repositories/${encodeURIComponent(task.repository_id)}/branches/${encodeURIComponent(task.branch_name)}`;
  const response = await fetchYunxiao(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'x-yunxiao-token': token,
    },
  });
  const data = await readJsonResponse(response, '查询分支最新提交');
  const commitId = extractCommitId(data);
  let commitMessage = extractCommitMessage(data);

  if (!commitId) {
    // 保留返回字段便于定位上游结构变化，但不记录 Token 或请求头。
    console.error('[Pipeline] 未识别到提交 ID', {
      taskId: task.id || null,
      responseKeys: Object.keys(data || {}),
    });
    throw new Error('查询分支成功，但返回数据中没有可识别的提交 ID');
  }
  if (!commitMessage) {
    // 分支接口并非所有版本都返回提交标题，缺失时再按 SHA 查询，确保日志信息完整。
    const commit = await getCommitDetails(task, commitId, token);
    commitMessage = commit?.title || commit?.message || null;
  }
  return { commitId, commitMessage, data };
}

function buildPipelineParams(task) {
  return {
    branchModeBranchs: [task.branch_name],
    runningBranchs: {
      [task.repository_url]: task.branch_name,
    },
    envs: {
      ...(task.extra_envs || {}),
      FORCE_UPDATE: task.force_update ? '1' : '0',
    },
  };
}

async function triggerPipeline(task, token) {
  const params = buildPipelineParams(task);
  const url = `${getOpenApiBaseUrl()}/oapi/v1/flow/organizations/${encodeURIComponent(task.organization_id)}/pipelines/${encodeURIComponent(task.pipeline_id)}/runs`;
  const response = await fetchYunxiao(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-yunxiao-token': token,
    },
    body: JSON.stringify({ params: JSON.stringify(params) }),
  });
  const data = await readJsonResponse(response, '运行流水线');
  const pipelineRunId = typeof data === 'number' || typeof data === 'string'
    ? data
    : data?.pipelineRunId || data?.id || data?.result;

  if (pipelineRunId == null) {
    throw new Error('流水线触发成功，但返回数据中没有运行 ID');
  }
  return { pipelineRunId, data, params };
}

function toEpochMillis(value) {
  if (!value) return null;
  const numericValue = Number(value);
  if (Number.isFinite(numericValue)) return numericValue;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function normalizePipelineRun(data) {
  const run = data?.pipelineRun || data?.result || data;
  const status = run?.status || 'UNKNOWN';
  const finished = !['RUNNING', 'WAITING'].includes(status);
  const startTime = run?.startTime || run?.createTime || null;
  const endTime = run?.endTime || (finished ? run?.updateTime : null) || null;
  const startTimestamp = toEpochMillis(startTime);
  const endTimestamp = toEpochMillis(endTime);
  return {
    pipelineRunId: run?.pipelineRunId == null ? null : String(run.pipelineRunId),
    status,
    startTime,
    endTime,
    durationSeconds: startTimestamp && endTimestamp
      ? Math.max(Math.floor((endTimestamp - startTimestamp) / 1000), 0)
      : null,
  };
}

async function getPipelineRun(task, token) {
  if (!task.last_pipeline_run_id) return null;

  const url = `${getOpenApiBaseUrl()}/oapi/v1/flow/organizations/${encodeURIComponent(task.organization_id)}/pipelines/${encodeURIComponent(task.pipeline_id)}/runs/${encodeURIComponent(task.last_pipeline_run_id)}`;
  const response = await fetchYunxiao(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'x-yunxiao-token': token,
    },
  });
  return normalizePipelineRun(await readJsonResponse(response, '查询流水线运行状态'));
}

function getNextRun(task, startedAt) {
  return new Date(startedAt.getTime() + Number(task.interval_minutes) * 60 * 1000);
}

async function saveResult(task, result) {
  await PipelineDB.updateRunState(task.id, result);
  await PipelineDB.logExecution({
    taskId: task.id,
    taskName: task.name,
    status: result.status,
    message: result.message,
    commitId: result.commitId,
    commitMessage: result.commitMessage,
    pipelineId: task.pipeline_id,
    pipelineRunId: result.pipelineRunId,
    pipelineStatus: result.pipelineStatus,
    pipelineStartTime: result.pipelineStartTime,
    pipelineEndTime: result.pipelineEndTime,
    pipelineDurationSeconds: result.pipelineDurationSeconds,
    triggerType: result.triggerType,
    requestData: result.requestData,
    responseData: result.responseData,
    errorDetails: result.errorDetails,
  });
}

async function executePipelineTask(task, options = {}) {
  const token = options.token || process.env.CODEUP_TOKEN;
  const triggerType = options.triggerType || 'scheduled';
  const forceTrigger = options.forceTrigger === true;
  const startedAt = new Date();
  const nextRun = getNextRun(task, startedAt);

  if (!token) throw new Error('缺少 CODEUP_TOKEN，定时监听无法访问 Codeup 和 Flow');
  if (activeTaskIds.has(String(task.id))) {
    return { status: 'skipped', message: '该任务正在执行，本次检查已跳过' };
  }

  activeTaskIds.add(String(task.id));
  try {
    const { commitId, commitMessage } = await getBranchHead(task, token);

    // 首次运行只建立基线，防止刚启用监听就把历史提交当成新变更。
    if (!task.last_commit_id && !forceTrigger) {
      const message = `已记录 ${task.branch_name} 分支基线 ${commitId.slice(0, 8)}，等待后续变更`;
      await saveResult(task, {
        status: 'ready',
        message,
        commitId,
        commitMessage,
        lastRun: startedAt,
        nextRun,
        triggerType,
      });
      return { status: 'ready', message, commitId };
    }

    if (!forceTrigger && task.last_commit_id === commitId) {
      const message = `${task.branch_name} 分支未检测到新提交`;
      await saveResult(task, {
        status: 'no_change',
        message,
        commitId,
        commitMessage,
        lastRun: startedAt,
        nextRun,
        triggerType,
      });
      return { status: 'no_change', message, commitId };
    }

    const triggerResult = await triggerPipeline(task, token);
    const message = `${forceTrigger ? '已手动' : '检测到新提交并'}触发流水线 #${triggerResult.pipelineRunId}`;
    await saveResult(task, {
      status: 'success',
      message,
      commitId,
      commitMessage,
      pipelineRunId: triggerResult.pipelineRunId,
      pipelineStatus: 'RUNNING',
      pipelineStartTime: startedAt,
      lastRun: startedAt,
      nextRun,
      triggerType,
      requestData: { params: triggerResult.params },
      responseData: triggerResult.data,
    });
    return {
      status: 'success',
      message,
      commitId,
      pipelineRunId: triggerResult.pipelineRunId,
    };
  } catch (error) {
    const message = `流水线任务执行失败：${error.message}`;
    await saveResult(task, {
      status: 'failed',
      message,
      lastRun: startedAt,
      nextRun,
      triggerType,
      errorDetails: error.stack || error.message,
    });
    throw error;
  } finally {
    activeTaskIds.delete(String(task.id));
  }
}

module.exports = {
  buildPipelineParams,
  executePipelineTask,
  getBranchHead,
  getCommitDetails,
  getRepository,
  getPipelineRun,
  triggerPipeline,
};
