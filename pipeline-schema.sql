-- 流水线监听功能独立迁移，可在已有数据库上重复执行。
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
    pipeline_steps JSONB,
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
ALTER TABLE pipeline_logs ADD COLUMN IF NOT EXISTS pipeline_steps JSONB;

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

DROP POLICY IF EXISTS "Enable all operations for pipeline_tasks" ON pipeline_tasks;
CREATE POLICY "Enable all operations for pipeline_tasks" ON pipeline_tasks
    FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable all operations for pipeline_logs" ON pipeline_logs;
CREATE POLICY "Enable all operations for pipeline_logs" ON pipeline_logs
    FOR ALL USING (true) WITH CHECK (true);
