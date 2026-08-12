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
    feishu_config_id BIGINT,
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
CREATE INDEX IF NOT EXISTS idx_auto_merge_tasks_feishu_config_id ON auto_merge_tasks(feishu_config_id);
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

-- 创建飞书通知配置表
CREATE TABLE IF NOT EXISTS feishu_notification_config (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    webhook_url TEXT NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT true,
    notify_on_success BOOLEAN NOT NULL DEFAULT true,
    notify_on_failure BOOLEAN NOT NULL DEFAULT true,
    custom_message_template TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_feishu_config_enabled ON feishu_notification_config(enabled);
CREATE INDEX IF NOT EXISTS idx_feishu_config_name ON feishu_notification_config(name);

-- 启用行级安全策略
ALTER TABLE feishu_notification_config ENABLE ROW LEVEL SECURITY;

-- 创建策略
CREATE POLICY "Enable all operations for feishu_notification_config" ON feishu_notification_config
    FOR ALL USING (true) WITH CHECK (true);

-- 创建流水线监听任务表。Token 不入库，定时任务统一读取服务端 CODEUP_TOKEN。
CREATE TABLE IF NOT EXISTS pipeline_tasks (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    pipeline_id TEXT NOT NULL,
    organization_id TEXT NOT NULL,
    repository_id TEXT NOT NULL,
    repository_name TEXT,
    repository_url TEXT NOT NULL,
    branch_name TEXT NOT NULL,
    interval_minutes INTEGER NOT NULL DEFAULT 5,
    enabled BOOLEAN NOT NULL DEFAULT true,
    force_update BOOLEAN NOT NULL DEFAULT true,
    extra_envs TEXT NOT NULL DEFAULT '{}',
    last_commit_id TEXT,
    last_pipeline_run_id TEXT,
    last_status TEXT,
    last_message TEXT,
    last_run TIMESTAMP,
    next_run TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pipeline_logs (
    id BIGSERIAL PRIMARY KEY,
    task_id BIGINT REFERENCES pipeline_tasks(id) ON DELETE CASCADE,
    task_name TEXT NOT NULL,
    status TEXT NOT NULL,
    message TEXT,
    commit_id TEXT,
    commit_message TEXT,
    pipeline_id TEXT,
    pipeline_run_id TEXT,
    pipeline_status TEXT,
    pipeline_start_time TIMESTAMP,
    pipeline_end_time TIMESTAMP,
    pipeline_duration_seconds INTEGER,
    trigger_type TEXT NOT NULL DEFAULT 'scheduled',
    request_data TEXT,
    response_data TEXT,
    error_details TEXT,
    executed_at TIMESTAMP NOT NULL DEFAULT NOW()
);

ALTER TABLE pipeline_logs ADD COLUMN IF NOT EXISTS commit_message TEXT;
ALTER TABLE pipeline_logs ADD COLUMN IF NOT EXISTS pipeline_id TEXT;
ALTER TABLE pipeline_logs ADD COLUMN IF NOT EXISTS pipeline_status TEXT;
ALTER TABLE pipeline_logs ADD COLUMN IF NOT EXISTS pipeline_start_time TIMESTAMP;
ALTER TABLE pipeline_logs ADD COLUMN IF NOT EXISTS pipeline_end_time TIMESTAMP;
ALTER TABLE pipeline_logs ADD COLUMN IF NOT EXISTS pipeline_duration_seconds INTEGER;

UPDATE pipeline_logs
SET pipeline_duration_seconds = GREATEST(
    FLOOR(EXTRACT(EPOCH FROM (pipeline_end_time - pipeline_start_time)))::INTEGER,
    0
)
WHERE pipeline_start_time IS NOT NULL
  AND pipeline_end_time IS NOT NULL
  AND pipeline_duration_seconds IS NULL;

UPDATE pipeline_logs AS logs
SET pipeline_id = tasks.pipeline_id
FROM pipeline_tasks AS tasks
WHERE logs.task_id = tasks.id AND logs.pipeline_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_pipeline_tasks_due ON pipeline_tasks(enabled, next_run);
CREATE INDEX IF NOT EXISTS idx_pipeline_tasks_repository_branch ON pipeline_tasks(repository_id, branch_name);
CREATE INDEX IF NOT EXISTS idx_pipeline_logs_task_id ON pipeline_logs(task_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_logs_executed_at ON pipeline_logs(executed_at);

ALTER TABLE pipeline_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all operations for pipeline_tasks" ON pipeline_tasks
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Enable all operations for pipeline_logs" ON pipeline_logs
    FOR ALL USING (true) WITH CHECK (true);

-- 添加外键约束
ALTER TABLE auto_merge_tasks 
ADD CONSTRAINT fk_auto_merge_tasks_feishu_config 
FOREIGN KEY (feishu_config_id) REFERENCES feishu_notification_config(id) ON DELETE SET NULL;

-- 插入示例数据（可选）
-- INSERT INTO feishu_notification_config (name, webhook_url) VALUES ('默认配置', 'https://open.feishu.cn/open-apis/bot/v2/hook/your-webhook-url');
-- INSERT INTO auto_merge_tasks (name, source_branch, target_branch, interval_minutes, repository_id, repository_name, feishu_config_id)
-- VALUES ('示例任务', 'develop', 'master', 60, '123456', '示例仓库', 1);

COMMIT;
