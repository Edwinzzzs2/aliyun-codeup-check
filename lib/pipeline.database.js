'use strict';

const { supabase } = require('./supabase');

const client = supabase();

function toBeijingTimestamp(input) {
  if (!input) return null;

  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(new Date(input));
  const value = (type) => parts.find((part) => part.type === type)?.value || '';

  return `${value('year')}-${value('month')}-${value('day')} ${value('hour')}:${value('minute')}:${value('second')}`;
}

function parseTask(task) {
  if (!task) return task;

  try {
    return { ...task, extra_envs: JSON.parse(task.extra_envs || '{}') };
  } catch {
    return { ...task, extra_envs: {} };
  }
}

function taskPayload(task, partial = false) {
  const payload = {};
  const assign = (field, value, originalValue = value) => {
    if (!partial || originalValue !== undefined) payload[field] = value;
  };

  assign('name', task.name);
  assign('pipeline_id', task.pipeline_id ? String(task.pipeline_id) : task.pipeline_id);
  assign('organization_id', task.organization_id);
  assign('repository_id', task.repository_id ? String(task.repository_id) : task.repository_id);
  assign('repository_name', task.repository_name || null, task.repository_name);
  assign('repository_url', task.repository_url);
  assign('branch_name', task.branch_name);
  assign('interval_minutes', task.interval_minutes);
  assign('enabled', task.enabled);
  assign('force_update', task.force_update);
  assign(
    'extra_envs',
    task.extra_envs === undefined
      ? undefined
      : JSON.stringify(task.extra_envs || {})
  );
  assign('last_commit_id', task.last_commit_id || null, task.last_commit_id);

  return payload;
}

const PipelineDB = {
  async getAllTasks() {
    const { data, error } = await client
      .from('pipeline_tasks')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data || []).map(parseTask);
  },

  async getTaskById(id) {
    const { data, error } = await client
      .from('pipeline_tasks')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return parseTask(data);
  },

  async getDueTasks() {
    const { data, error } = await client
      .from('pipeline_tasks')
      .select('*')
      .eq('enabled', true)
      .lte('next_run', toBeijingTimestamp(new Date()));
    if (error) throw new Error(error.message);
    return (data || []).map(parseTask);
  },

  async createTask(task) {
    const now = new Date();
    const nextRun = new Date(now.getTime() + task.interval_minutes * 60 * 1000);
    const payload = {
      ...taskPayload(task),
      enabled: task.enabled !== false,
      force_update: task.force_update !== false,
      last_status: 'ready',
      last_message: '已记录分支基线，等待代码变更',
      next_run: toBeijingTimestamp(nextRun),
      created_at: toBeijingTimestamp(now),
      updated_at: toBeijingTimestamp(now),
    };
    const { data, error } = await client
      .from('pipeline_tasks')
      .insert(payload)
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return parseTask(data);
  },

  async updateTask(id, task) {
    const payload = {
      ...taskPayload(task, true),
      updated_at: toBeijingTimestamp(new Date()),
    };
    const { data, error } = await client
      .from('pipeline_tasks')
      .update(payload)
      .eq('id', id)
      .select('*')
      .maybeSingle();
    if (error) throw new Error(error.message);
    return parseTask(data);
  },

  async deleteTask(id) {
    const { error } = await client.from('pipeline_tasks').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },

  async updateRunState(id, state) {
    const payload = {
      last_run: toBeijingTimestamp(state.lastRun || new Date()),
      next_run: toBeijingTimestamp(state.nextRun),
      last_status: state.status,
      last_message: state.message,
      updated_at: toBeijingTimestamp(new Date()),
    };
    if (state.commitId !== undefined) payload.last_commit_id = state.commitId;
    if (state.pipelineRunId !== undefined) {
      payload.last_pipeline_run_id = state.pipelineRunId == null
        ? null
        : String(state.pipelineRunId);
    }

    const { error } = await client
      .from('pipeline_tasks')
      .update(payload)
      .eq('id', id);
    if (error) throw new Error(error.message);
  },

  async logExecution(log) {
    const payload = {
      task_id: log.taskId,
      task_name: log.taskName,
      status: log.status,
      message: log.message,
      commit_id: log.commitId || null,
      commit_message: log.commitMessage || null,
      pipeline_id: log.pipelineId == null ? null : String(log.pipelineId),
      pipeline_run_id: log.pipelineRunId == null ? null : String(log.pipelineRunId),
      pipeline_status: log.pipelineStatus || null,
      pipeline_start_time: toBeijingTimestamp(log.pipelineStartTime),
      pipeline_end_time: toBeijingTimestamp(log.pipelineEndTime),
      pipeline_duration_seconds: log.pipelineDurationSeconds ?? null,
      trigger_type: log.triggerType || 'scheduled',
      request_data: log.requestData ? JSON.stringify(log.requestData) : null,
      response_data: log.responseData ? JSON.stringify(log.responseData) : null,
      error_details: log.errorDetails || null,
      executed_at: toBeijingTimestamp(new Date()),
    };
    const { error } = await client.from('pipeline_logs').insert(payload);
    if (error) throw new Error(error.message);
  },

  async updateLogPipelineRun(id, run) {
    const payload = {
      pipeline_status: run.status || null,
      pipeline_start_time: toBeijingTimestamp(run.startTime),
      pipeline_end_time: toBeijingTimestamp(run.endTime),
      pipeline_duration_seconds: run.durationSeconds ?? null,
    };
    const { error } = await client
      .from('pipeline_logs')
      .update(payload)
      .eq('id', id);
    if (error) throw new Error(error.message);
  },

  async updateLogCommitMessage(id, commitMessage) {
    const { error } = await client
      .from('pipeline_logs')
      .update({ commit_message: commitMessage })
      .eq('id', id);
    if (error) throw new Error(error.message);
  },

  async getLogs({ taskId = null, limit = 50, offset = 0 } = {}) {
    let query = client
      .from('pipeline_logs')
      .select('*')
      .order('executed_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (taskId) query = query.eq('task_id', taskId);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data || [];
  },

  async getLogsCount(taskId = null) {
    let query = client
      .from('pipeline_logs')
      .select('*', { count: 'exact', head: true });
    if (taskId) query = query.eq('task_id', taskId);
    const { count, error } = await query;
    if (error) throw new Error(error.message);
    return count || 0;
  },
};

module.exports = { PipelineDB, toBeijingTimestamp };
