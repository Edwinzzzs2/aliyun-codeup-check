const cron = require('node-cron');
const { AutoMergeDB } = require('./database.supabase');
const { executeAutoMerge } = require('../src/app/api/automerge/execute/route');

class AutoMergeScheduler {
  constructor() {
    this.isRunning = false;
    this.cronJob = null;
  }

  // 启动调度器
  start() {
    if (this.isRunning) {
      console.log('自动合并调度器已在运行中');
      return;
    }

    console.log('启动自动合并调度器...');
    
    // 每分钟检查一次是否有需要执行的任务
    this.cronJob = cron.schedule('* * * * *', async () => {
      await this.checkAndExecuteTasks();
    }, {
      scheduled: false
    });

    this.cronJob.start();
    this.isRunning = true;
    
    console.log('自动合并调度器启动成功');
  }

  // 停止调度器
  stop() {
    if (!this.isRunning) {
      console.log('自动合并调度器未在运行');
      return;
    }

    console.log('停止自动合并调度器...');
    
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
    }
    
    this.isRunning = false;
    console.log('自动合并调度器已停止');
  }

  // 检查并执行需要运行的任务
  async checkAndExecuteTasks() {
    try {
      const tasksToRun = await AutoMergeDB.getTasksToRun();
      
      if (tasksToRun.length === 0) {
        return;
      }

      console.log(`发现 ${tasksToRun.length} 个需要执行的自动合并任务`);

      // 并行执行所有需要运行的任务
      const promises = tasksToRun.map(async (task) => {
        try {
          console.log(`执行自动合并任务: ${task.name} (${task.source_branch} -> ${task.target_branch})`);
          const result = await executeAutoMerge(task);
          console.log(`任务 ${task.name} 执行完成:`, result.status);
          return result;
        } catch (error) {
          console.error(`任务 ${task.name} 执行失败:`, error.message);
          return { status: 'failed', error: error.message };
        }
      });

      await Promise.all(promises);
      
    } catch (error) {
      console.error('检查自动合并任务时发生错误:', error);
    }
  }

  // 获取调度器状态
  getStatus() {
    return {
      isRunning: this.isRunning,
      nextCheck: this.cronJob ? '每分钟检查一次' : null
    };
  }

  // 手动触发检查
  async triggerCheck() {
    console.log('手动触发自动合并任务检查...');
    await this.checkAndExecuteTasks();
  }
}

// 创建全局调度器实例
// const scheduler = new AutoMergeScheduler();

// // 在应用启动时自动启动调度器
// if (typeof window === 'undefined') {
//   // 只在服务端启动调度器
//   process.nextTick(() => {
//     // 确保数据库初始化
//     try {
//       require('./database.supabase');
//       console.log('Supabase 数据库初始化成功');
//     } catch (error) {
//       console.error('Supabase 数据库初始化失败:', error);
//     }
//     scheduler.start();
//   });

//   // 优雅关闭
//   process.on('SIGINT', () => {
//     console.log('\n接收到 SIGINT 信号，正在关闭自动合并调度器...');
//     scheduler.stop();
//     process.exit(0);
//   });

//   process.on('SIGTERM', () => {
//     console.log('\n接收到 SIGTERM 信号，正在关闭自动合并调度器...');
//     scheduler.stop();
//     process.exit(0);
//   });
// }

// module.exports = { AutoMergeScheduler, scheduler };
module.exports = { AutoMergeScheduler };