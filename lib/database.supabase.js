'use strict';

const { supabase } = require('./supabase');
const moment = require('moment');

// 本地工具函数（避免依赖原SQLite实现导致副作用）
function maskToken(token) {
  if (!token || token.length < 8) return token;
  const start = token.substring(0, 2);
  const end = token.substring(token.length - 6);
  const middle = '*'.repeat(Math.min(token.length - 8, 10));
  return `${start}${middle}${end}`;
}

function toISOStringOrNull(input) {
  if (!input) return null;
  // 保持ISO格式，让前端统一处理时区转换
  return moment(input).toISOString();
}

const client = supabase();

const AutoMergeDB = {
  // 获取所有任务
  async getAllTasks() {
    const { data, error } = await client
      .from('auto_merge_tasks')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return data || [];
  },

  // 获取启用的任务
  async getEnabledTasks() {
    const { data, error } = await client
      .from('auto_merge_tasks')
      .select('*')
      .eq('enabled', true);
    if (error) throw new Error(error.message);
    return data || [];
  },

  // 创建任务
  async createTask(task) {
    const now = new Date();
    const nextRun = new Date(now.getTime() + task.interval_minutes * 60 * 1000);
    const payload = {
      name: task.name,
      source_branch: task.source_branch,
      target_branch: task.target_branch,
      interval_minutes: task.interval_minutes,
      execute_user: task.execute_user || null,
      repository_id: task.repository_id || null,
      repository_name: task.repository_name || null,
      next_run: toISOStringOrNull(nextRun),
      created_at: toISOStringOrNull(now),
      updated_at: toISOStringOrNull(now),
    };
    const { data, error } = await client
      .from('auto_merge_tasks')
      .insert(payload)
      .select('id')
      .single();
    if (error) throw new Error(error.message);
    return data?.id;
  },

  // 更新任务
  async updateTask(id, task) {
    const payload = {
      name: task.name,
      source_branch: task.source_branch,
      target_branch: task.target_branch,
      interval_minutes: task.interval_minutes,
      enabled: task.enabled ? true : false,
      execute_user: task.execute_user || null,
      repository_id: task.repository_id || null,
      repository_name: task.repository_name || null,
      updated_at: toISOStringOrNull(new Date()),
    };
    const { error, count } = await client
      .from('auto_merge_tasks')
      .update(payload)
      .eq('id', id);
    if (error) throw new Error(error.message);
    return { changes: typeof count === 'number' ? count : 1 };
  },

  // 删除任务
  async deleteTask(id) {
    const { error, count } = await client
      .from('auto_merge_tasks')
      .delete()
      .eq('id', id);
    if (error) throw new Error(error.message);
    return { changes: typeof count === 'number' ? count : 1 };
  },

  // 更新任务执行时间
  async updateTaskRunTime(id, lastRun, nextRun) {
    const { error } = await client
      .from('auto_merge_tasks')
      .update({
        last_run: toISOStringOrNull(lastRun),
        next_run: toISOStringOrNull(nextRun),
        updated_at: toISOStringOrNull(new Date()),
      })
      .eq('id', id);
    if (error) throw new Error(error.message);
    return { changes: 1 };
  },

  // 获取需要执行的任务
  async getTasksToRun() {
    const nowIso = toISOStringOrNull(new Date());
    const { data, error } = await client
      .from('auto_merge_tasks')
      .select('*')
      .eq('enabled', true)
      .lte('next_run', nowIso);
    if (error) throw new Error(error.message);
    return data || [];
  },

  // 记录执行日志
  async logExecution(taskName, status, message, mergeRequestId = null, operator = null, requestData = null, responseData = null, errorDetails = null, executionType = 'auto') {
    const payload = {
      task_name: taskName,
      status,
      message,
      merge_request_id: mergeRequestId,
      operator,
      request_data: requestData ? JSON.stringify(requestData) : null,
      response_data: responseData ? JSON.stringify(responseData) : null,
      error_details: errorDetails,
      execution_type: executionType,
      executed_at: toISOStringOrNull(new Date()),
    };
    const { data, error } = await client
      .from('auto_merge_logs')
      .insert(payload)
      .select('id')
      .single();
    if (error) throw new Error(error.message);
    return { lastInsertRowid: data?.id };
  },

  // 获取任务执行日志
  async getTaskLogs(taskName, limit = 50) {
    const { data, error } = await client
      .from('auto_merge_logs')
      .select('*')
      .eq('task_name', taskName)
      .order('executed_at', { ascending: false })
      .limit(limit);
    if (error) throw new Error(error.message);
    return data || [];
  },

  // 获取所有执行日志
  async getAllLogs(limit = 100) {
    const { data, error } = await client
      .from('auto_merge_logs')
      .select('*')
      .order('executed_at', { ascending: false })
      .limit(limit);
    if (error) throw new Error(error.message);
    return data || [];
  },

  // 获取日志详情
  async getLogDetail(logId) {
    const { data, error } = await client
      .from('auto_merge_logs')
      .select('*')
      .eq('id', logId)
      .single();
    if (error) throw new Error(error.message);

    if (data) {
      if (data.request_data) {
        try { data.request_data = JSON.parse(data.request_data); } catch {}
      }
      if (data.response_data) {
        try { data.response_data = JSON.parse(data.response_data); } catch {}
      }
    }
    return data || null;
  },

  // 记录详细执行日志（带完整信息）
  async logDetailedExecution(params) {
    const {
      taskName,
      status,
      message,
      mergeRequestId = null,
      operator = null,
      requestData = null,
      responseData = null,
      errorDetails = null,
      executionType = 'auto',
    } = params;

    const maskedOperator = operator ? maskToken(operator) : null;

    return this.logExecution(
      taskName,
      status,
      message,
      mergeRequestId,
      maskedOperator,
      requestData,
      responseData,
      errorDetails,
      executionType,
    );
  },
};

module.exports = { AutoMergeDB };