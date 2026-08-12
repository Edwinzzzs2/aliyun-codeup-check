export async function register() {
  if (
    process.env.NEXT_RUNTIME !== 'nodejs'
    || process.env.ENABLE_INTERNAL_PIPELINE_SCHEDULER !== 'true'
    || globalThis.__pipelineInternalCronJob
  ) {
    return;
  }

  const [{ default: cron }, schedulerModule] = await Promise.all([
    import('node-cron'),
    import('../lib/pipeline.scheduler.js'),
  ]);
  const PipelineScheduler = schedulerModule.PipelineScheduler
    || schedulerModule.default?.PipelineScheduler;
  const scheduler = new PipelineScheduler();

  // Docker/PM2 不会读取 vercel.json，因此在常驻 Node 进程内每分钟补一次到期任务扫描。
  globalThis.__pipelineInternalCronJob = cron.schedule('* * * * *', async () => {
    if (globalThis.__pipelineInternalCronRunning) return;
    globalThis.__pipelineInternalCronRunning = true;
    try {
      const results = await scheduler.checkAndExecuteTasks();
      if (results.length) {
        // 仅记录任务、状态和结果，不输出 Token、请求参数等敏感信息。
        console.info('[Pipeline Internal Cron] 到期任务执行完成:', results);
      }
    } catch (error) {
      console.error('[Pipeline Internal Cron] 检查失败:', error);
    } finally {
      globalThis.__pipelineInternalCronRunning = false;
    }
  });

  console.info('[Pipeline Internal Cron] 已启用每分钟流水线监听');
}
