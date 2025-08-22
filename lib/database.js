const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// 创建数据库连接
// 在Vercel等serverless环境中使用/tmp目录，本地开发使用data目录
const isVercel = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME;
const dbPath = isVercel 
  ? path.join('/tmp', 'automerge.db')
  : path.join(process.cwd(), 'data', 'automerge.db');

// 确保目录存在
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// 在serverless环境中，如果数据库文件已存在但只读，先删除它
if (isVercel && fs.existsSync(dbPath)) {
  try {
    fs.unlinkSync(dbPath);
  } catch (error) {
    console.log('Failed to remove existing readonly database:', error.message);
  }
}

const db = new Database(dbPath);

// 本地时间格式化工具：YYYY-MM-DD HH:mm:ss
function formatLocal(dateInput) {
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  const pad = (n) => String(n).padStart(2, '0');
  const yyyy = d.getFullYear();
  const MM = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mm = pad(d.getMinutes());
  const ss = pad(d.getSeconds());
  return `${yyyy}-${MM}-${dd} ${hh}:${mm}:${ss}`;
}

// Token脱敏工具
function maskToken(token) {
  if (!token || token.length < 8) return token;
  const start = token.substring(0, 2);
  const end = token.substring(token.length - 6);
  const middle = '*'.repeat(Math.min(token.length - 8, 10));
  return `${start}${middle}${end}`;
}

// 创建自动合并任务表
db.exec(`
  CREATE TABLE IF NOT EXISTS auto_merge_tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    source_branch TEXT NOT NULL,
    target_branch TEXT NOT NULL,
    interval_minutes INTEGER NOT NULL,
    enabled BOOLEAN DEFAULT 1,
    execute_user TEXT,
    repository_id TEXT,
    repository_name TEXT,
    last_run DATETIME,
    next_run DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// 添加repository_id字段（如果不存在）
try {
  db.exec(`ALTER TABLE auto_merge_tasks ADD COLUMN repository_id TEXT`);
} catch (error) {
  // 字段已存在，忽略错误
}

// 添加repository_name字段（如果不存在）
try {
  db.exec(`ALTER TABLE auto_merge_tasks ADD COLUMN repository_name TEXT`);
} catch (error) {
  // 字段已存在，忽略错误
}

// 创建自动合并执行日志表
db.exec(`
  CREATE TABLE IF NOT EXISTS auto_merge_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_name TEXT,
    status TEXT NOT NULL, -- 'success', 'failed', 'conflict'
    message TEXT,
    merge_request_id TEXT,
    operator TEXT, -- 操作人token（脱敏）
    request_data TEXT, -- 下发数据（JSON格式）
    response_data TEXT, -- 返回数据（JSON格式）
    error_details TEXT, -- 错误详情
    execution_type TEXT DEFAULT 'auto', -- 执行类型：auto（自动）、manual（手动）
    executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// 添加新字段（如果不存在）
try {
  db.exec(`ALTER TABLE auto_merge_logs ADD COLUMN operator TEXT`);
} catch (error) {
  // 字段已存在，忽略错误
}

try {
  db.exec(`ALTER TABLE auto_merge_logs ADD COLUMN request_data TEXT`);
} catch (error) {
  // 字段已存在，忽略错误
}

try {
  db.exec(`ALTER TABLE auto_merge_logs ADD COLUMN response_data TEXT`);
} catch (error) {
  // 字段已存在，忽略错误
}

try {
  db.exec(`ALTER TABLE auto_merge_logs ADD COLUMN error_details TEXT`);
} catch (error) {
  // 字段已存在，忽略错误
}

try {
  db.exec(`ALTER TABLE auto_merge_logs ADD COLUMN execution_type TEXT DEFAULT 'auto'`);
} catch (error) {
  // 字段已存在，忽略错误
}

// 数据库操作方法
const AutoMergeDB = {
  // 获取所有任务
  getAllTasks() {
    const stmt = db.prepare('SELECT * FROM auto_merge_tasks ORDER BY created_at DESC');
    return stmt.all();
  },

  // 获取启用的任务
  getEnabledTasks() {
    const stmt = db.prepare('SELECT * FROM auto_merge_tasks WHERE enabled = 1');
    return stmt.all();
  },

  // 创建任务（使用本地时间）
  createTask(task) {
    // 计算下次执行时间（本地时间）
    const now = new Date();
    const nextRun = new Date(now.getTime() + task.interval_minutes * 60 * 1000);
    const nextRunString = formatLocal(nextRun);
    const nowString = formatLocal(now);
    
    const stmt = db.prepare(`
      INSERT INTO auto_merge_tasks (name, source_branch, target_branch, interval_minutes, execute_user, repository_id, repository_name, next_run, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      task.name,
      task.source_branch,
      task.target_branch,
      task.interval_minutes,
      task.execute_user || null,
      task.repository_id || null,
      task.repository_name || null,
      nextRunString,
      nowString,
      nowString
    );
    return result.lastInsertRowid;
  },

  // 更新任务（updated_at 使用本地时间）
  updateTask(id, task) {
    const nowString = formatLocal(new Date());
    const stmt = db.prepare(`
      UPDATE auto_merge_tasks 
      SET name = ?, source_branch = ?, target_branch = ?, interval_minutes = ?, 
          enabled = ?, execute_user = ?, repository_id = ?, repository_name = ?, updated_at = ?
      WHERE id = ?
    `);
    return stmt.run(
      task.name,
      task.source_branch,
      task.target_branch,
      task.interval_minutes,
      task.enabled ? 1 : 0,
      task.execute_user || null,
      task.repository_id || null,
      task.repository_name || null,
      nowString,
      id
    );
  },

  // 删除任务
  deleteTask(id) {
    // 删除任务，相关日志的task_id会自动设置为NULL
    const stmt = db.prepare('DELETE FROM auto_merge_tasks WHERE id = ?');
    return stmt.run(id);
  },

  // 更新任务执行时间（使用本地时间）
  updateTaskRunTime(id, lastRun, nextRun) {
    const formatTime = (input) => (input ? formatLocal(input) : null);
    
    const stmt = db.prepare(`
      UPDATE auto_merge_tasks 
      SET last_run = ?, next_run = ?, updated_at = ?
      WHERE id = ?
    `);
    return stmt.run(
      formatTime(lastRun),
      formatTime(nextRun),
      formatLocal(new Date()),
      id
    );
  },

  // 获取需要执行的任务（使用本地时间比较）
  getTasksToRun() {
    const nowString = formatLocal(new Date());
    const stmt = db.prepare(`
      SELECT * FROM auto_merge_tasks 
      WHERE enabled = 1 AND next_run <= ?
    `);
    return stmt.all(nowString);
  },

  // 记录执行日志（使用本地时间）
  logExecution(taskName, status, message, mergeRequestId = null, operator = null, requestData = null, responseData = null, errorDetails = null, executionType = 'auto') {
    const nowString = formatLocal(new Date());
    const stmt = db.prepare(`
      INSERT INTO auto_merge_logs (task_name, status, message, merge_request_id, operator, request_data, response_data, error_details, execution_type, executed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    return stmt.run(
      taskName, 
      status, 
      message, 
      mergeRequestId, 
      operator,
      requestData ? JSON.stringify(requestData) : null,
      responseData ? JSON.stringify(responseData) : null,
      errorDetails,
      executionType,
      nowString
    );
  },

  // 获取任务执行日志
  getTaskLogs(taskName, limit = 50) {
    const stmt = db.prepare(`
      SELECT * FROM auto_merge_logs 
      WHERE task_name = ? 
      ORDER BY executed_at DESC 
      LIMIT ?
    `);
    return stmt.all(taskName, limit);
  },

  // 获取所有执行日志
  getAllLogs(limit = 100) {
    const stmt = db.prepare(`
      SELECT * FROM auto_merge_logs
      ORDER BY executed_at DESC 
      LIMIT ?
    `);
    return stmt.all(limit);
  },

  // 获取日志详情
  getLogDetail(logId) {
    const stmt = db.prepare(`
      SELECT * FROM auto_merge_logs WHERE id = ?
    `);
    const log = stmt.get(logId);
    if (log) {
      // 解析JSON数据
      if (log.request_data) {
        try {
          log.request_data = JSON.parse(log.request_data);
        } catch (e) {
          // 保持原始字符串
        }
      }
      if (log.response_data) {
        try {
          log.response_data = JSON.parse(log.response_data);
        } catch (e) {
          // 保持原始字符串
        }
      }
    }
    return log;
  },

  // 记录详细执行日志（带完整信息）
  logDetailedExecution(params) {
    const {
      taskName,
      status,
      message,
      mergeRequestId = null,
      operator = null,
      requestData = null,
      responseData = null,
      errorDetails = null,
      executionType = 'auto'
    } = params;
    
    // 脱敏处理operator
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
      executionType
    );
  }
};

module.exports = { db, AutoMergeDB, maskToken };