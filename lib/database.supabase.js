'use strict';

const { supabase } = require('./supabase');

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
  const date = new Date(input);
  // 统一使用北京时间（Asia/Shanghai）进行格式化，确保与服务器所在时区无关
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
  const parts = formatter.formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type)?.value || '';
  const year = get('year');
  const month = get('month');
  const day = get('day');
  const hour = get('hour');
  const minute = get('minute');
  const second = get('second');
  return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
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
      enabled: task.enabled !== undefined ? task.enabled : true,
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
    console.log(toISOStringOrNull(new Date()), 'updateTask');
    const payload = {};
    
    // 总是更新 updated_at 字段
    payload.updated_at = toISOStringOrNull(new Date());
    
    // 只更新传入的字段
    if (task.name !== undefined) payload.name = task.name;
    if (task.source_branch !== undefined) payload.source_branch = task.source_branch;
    if (task.target_branch !== undefined) payload.target_branch = task.target_branch;
    if (task.interval_minutes !== undefined) payload.interval_minutes = task.interval_minutes;
    if (task.enabled !== undefined) payload.enabled = task.enabled ? true : false;
    if (task.execute_user !== undefined) payload.execute_user = task.execute_user || null;
    if (task.repository_id !== undefined) payload.repository_id = task.repository_id || null;
    if (task.repository_name !== undefined) payload.repository_name = task.repository_name || null;
    
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
  async logExecution(taskName, status, message, mergeRequestId = null, operator = null, requestData = null, responseData = null, errorDetails = null, executionType = 'auto', mergeRequestDetailUrl = null) {
    const payload = {
      task_name: taskName,
      status,
      message,
      merge_request_id: mergeRequestId,
      merge_request_detail_url: mergeRequestDetailUrl,
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

  // 获取所有执行日志（支持分页）
  async getAllLogs(limit = 100, offset = 0) {
    const { data, error } = await client
      .from('auto_merge_logs')
      .select('*')
      .order('executed_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) throw new Error(error.message);
    return data || [];
  },

  // 获取执行日志总数
  async getLogsCount() {
    const { count, error } = await client
      .from('auto_merge_logs')
      .select('*', { count: 'exact', head: true });
    if (error) throw new Error(error.message);
    return count || 0;
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
      mergeRequestDetailUrl = null,
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
      mergeRequestDetailUrl
    );
  },

  // 飞书通知配置相关方法
  async getFeishuConfig() {
    const { data, error } = await client
      .from('feishu_notification_config')
      .select('*')
      .single();
    if (error && error.code !== 'PGRST116') { // PGRST116 表示没有找到记录
      throw new Error(error.message);
    }
    return data;
  },

  async createOrUpdateFeishuConfig(config) {
    // 先检查是否已存在配置
    const existing = await this.getFeishuConfig();
    
    const configData = {
      webhook_url: config.webhook_url,
      enabled: config.enabled !== undefined ? config.enabled : true,
      notify_on_success: config.notify_on_success !== undefined ? config.notify_on_success : true,
      notify_on_failure: config.notify_on_failure !== undefined ? config.notify_on_failure : true,
      custom_message_template: config.custom_message_template || null,
      updated_at: toISOStringOrNull(new Date())
    };

    if (existing) {
      // 更新现有配置
      const { data, error } = await client
        .from('feishu_notification_config')
        .update(configData)
        .eq('id', existing.id)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data;
    } else {
      // 创建新配置
      configData.created_at = toISOStringOrNull(new Date());
      const { data, error } = await client
        .from('feishu_notification_config')
        .insert(configData)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data;
    }
  },

  async deleteFeishuConfig() {
    const { error } = await client
      .from('feishu_notification_config')
      .delete()
      .neq('id', 0); // 删除所有记录
    if (error) throw new Error(error.message);
    return true;
  },
};

module.exports = { AutoMergeDB };