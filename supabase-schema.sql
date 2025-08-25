-- Supabase数据库表结构
-- 请在Supabase控制台的SQL编辑器中执行此脚本

-- 创建自动合并任务表
CREATE TABLE IF NOT EXISTS auto_merge_tasks (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    source_branch TEXT NOT NULL,
    target_branch TEXT NOT NULL,
    interval_minutes INTEGER NOT NULL DEFAULT 60,
    enabled BOOLEAN NOT NULL DEFAULT true,
    execute_user TEXT,
    repository_id TEXT,
    repository_name TEXT,
    last_run TIMESTAMP,
    next_run TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 创建自动合并执行日志表
CREATE TABLE IF NOT EXISTS auto_merge_logs (
    id BIGSERIAL PRIMARY KEY,
    task_name TEXT NOT NULL,
    status TEXT NOT NULL,
    message TEXT,
    merge_request_id TEXT,
    merge_request_detail_url TEXT,
    operator TEXT,
    request_data TEXT,
    response_data TEXT,
    error_details TEXT,
    execution_type TEXT NOT NULL DEFAULT 'auto',
    executed_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_auto_merge_tasks_enabled ON auto_merge_tasks(enabled);
CREATE INDEX IF NOT EXISTS idx_auto_merge_tasks_next_run ON auto_merge_tasks(next_run);
CREATE INDEX IF NOT EXISTS idx_auto_merge_tasks_repository_id ON auto_merge_tasks(repository_id);
CREATE INDEX IF NOT EXISTS idx_auto_merge_logs_task_name ON auto_merge_logs(task_name);
CREATE INDEX IF NOT EXISTS idx_auto_merge_logs_executed_at ON auto_merge_logs(executed_at);
CREATE INDEX IF NOT EXISTS idx_auto_merge_logs_status ON auto_merge_logs(status);

-- 启用行级安全策略（RLS）
ALTER TABLE auto_merge_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE auto_merge_logs ENABLE ROW LEVEL SECURITY;

-- 创建策略允许所有操作（根据实际需求调整）
CREATE POLICY "Enable all operations for auto_merge_tasks" ON auto_merge_tasks
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Enable all operations for auto_merge_logs" ON auto_merge_logs
    FOR ALL USING (true) WITH CHECK (true);

-- Removed automatic updated_at trigger to allow application-controlled time formatting
-- This ensures consistent time format across all timestamp fields

-- 插入示例数据（可选）
-- INSERT INTO auto_merge_tasks (name, source_branch, target_branch, interval_minutes, repository_id, repository_name)
-- VALUES ('示例任务', 'develop', 'master', 60, '123456', '示例仓库');

COMMIT;