'use strict';

const beijingWeekdayFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Shanghai',
  weekday: 'short',
});

function isBeijingWeekend(date) {
  const weekday = beijingWeekdayFormatter.format(new Date(date));
  return weekday === 'Sat' || weekday === 'Sun';
}

function toValidInterval(value, fallback) {
  const interval = Number(value);
  return Number.isFinite(interval) && interval >= 1 ? interval : fallback;
}

function getTaskIntervalMinutes(task, date = new Date()) {
  const fallback = toValidInterval(task?.interval_minutes, 5);
  const configuredInterval = isBeijingWeekend(date)
    ? task?.weekend_interval_minutes
    : task?.weekday_interval_minutes;

  // 新字段为空时沿用旧的统一间隔，确保数据库升级前创建的任务行为不变。
  return toValidInterval(configuredInterval, fallback);
}

function getNextRun(task, startedAt = new Date()) {
  const intervalMinutes = getTaskIntervalMinutes(task, startedAt);
  return new Date(startedAt.getTime() + intervalMinutes * 60 * 1000);
}

module.exports = {
  getNextRun,
  getTaskIntervalMinutes,
  isBeijingWeekend,
};
