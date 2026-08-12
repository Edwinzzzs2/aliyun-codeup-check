'use strict';

const { PipelineDB } = require('./pipeline.database');
const { executePipelineTask } = require('./pipeline.service');

class PipelineScheduler {
  async checkAndExecuteTasks() {
    const tasks = await PipelineDB.getDueTasks();
    const results = [];

    // 顺序执行可避免同一个 Token 在一次 Cron 中并发请求过多，单任务仍有独立错误日志。
    for (const task of tasks) {
      try {
        const result = await executePipelineTask(task, {
          token: process.env.CODEUP_TOKEN,
          triggerType: 'scheduled',
        });
        results.push({ taskId: task.id, ...result });
      } catch (error) {
        results.push({ taskId: task.id, status: 'failed', message: error.message });
      }
    }

    return results;
  }
}

module.exports = { PipelineScheduler };
